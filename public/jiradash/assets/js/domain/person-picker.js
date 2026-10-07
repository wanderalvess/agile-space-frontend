// Picker de pessoas — CP9 da épica "identidade e roster v2" (#7).
//
// Fronteira PEQUENA e PURA que modela a busca e a seleção. Nada aqui toca DOM, storage, fetch,
// `state` ou relógio: o gerador de token e o relógio são INJETADOS, e o transporte (o GET ao Jira)
// é do chamador. A avaliação do módulo é inerte.
//
// ── O QUE ESTE MÓDULO NUNCA FAZ ────────────────────────────────────────────────────────────
//   - NUNCA transforma o TEXTO DIGITADO em pessoa. A consulta é só consulta: não vira nome
//     persistido, não vira fallback de seleção e não gera intenção;
//   - NUNCA cria `personId` (invariante do servidor desde o CP3);
//   - NUNCA expõe `key`, `personId` ou `username` em atributo `data-*` — o DOM leva apenas um
//     TOKEN opaco e descartável;
//   - NUNCA persiste `username` ou `active`: os dois vivem só na sessão;
//   - resultado SEM `key` não é selecionável (não há vínculo externo utilizável).
//
// ── MÁQUINA DE ESTADOS ─────────────────────────────────────────────────────────────────────
//   idle → loading → results | empty | unavailable
//   results → saving → results (sucesso) | error (falha)
// `empty` ("o Jira respondeu e não achou ninguém") e `unavailable` ("não deu para perguntar")
// são estados DIFERENTES e precisam continuar assim: um convida a refinar a busca, o outro avisa
// que a lista mostrada é só o diretório já conhecido.

import { stripStatusMarker, statusFromActive, STATUS_UNKNOWN } from './person-presentation.js';
import { validarPessoas, nomeObservadoDe, isCanonicalTimestamp } from './reconciliation.js';

export const PICKER_IDLE = 'idle';
// Recusa LOCAL da consulta (texto vazio). É estado PRÓPRIO: nunca `empty`, que afirma algo sobre
// a resposta do Jira e só pode existir depois de um GET bem-sucedido com zero resultados.
export const PICKER_INVALID_QUERY = 'invalid-query';
export const PICKER_LOADING = 'loading';
export const PICKER_RESULTS = 'results';
export const PICKER_EMPTY = 'empty';
export const PICKER_UNAVAILABLE = 'unavailable';
export const PICKER_SAVING = 'saving';
export const PICKER_ERROR = 'error';

// Origem de um candidato: `jira` veio da busca (tem key observada); `known` veio do diretório já
// persistido no envelope (tem personId e pode não ter key alguma nesta sessão).
export const SOURCE_JIRA = 'jira';
export const SOURCE_KNOWN = 'known';

const PROVIDER = 'jira-server';
const isPlainObject = v => typeof v === 'object' && v !== null && !Array.isArray(v);
const nonEmptyString = v => typeof v === 'string' && v !== '';
const isPersonId = v => typeof v === 'string' && v.startsWith('person:') && v.length > 'person:'.length;

// ── DIRETÓRIO LOCAL CONHECIDO ───────────────────────────────────────────────────────────────
// Fallback usado quando a busca está indisponível. Sai EXCLUSIVAMENTE do envelope suportado que já
// está em memória: nenhuma pessoa nasce de igualdade de nome, nenhuma key é lida do localStorage
// (o espelho é redigido e não consegue reconstruir `externalRef`) e nada é inventado a partir do
// texto pesquisado. Sem `/config` carregado, o diretório é simplesmente vazio.
//
// Só entram registros com `personId` válido E nome PERSISTIDO no shape aprovado — sem nome não há
// como apresentar a pessoa, e fabricar rótulo está fora de questão.
// ⚠️ FAIL-CLOSED DE VERDADE: a régua é a MESMA da reconciliação — `validarPessoas` (coerência do
// `personId` com a chave do mapa, metadados de retenção da external identity e unicidade
// `(provider, key)`) e `nomeObservadoDe` (perfil no shape aprovado: valor + carimbo canônico +
// finalidade certa + revisão posterior). Um envelope irregular produz diretório VAZIO — nunca uma
// lista parcial, que convidaria a incluir a pessoa errada.
export function localDirectory(envelope, consulta = '') {
  if (!isPlainObject(envelope) || envelope.schemaVersion !== 2) return [];
  const people = envelope.people;
  if (!isPlainObject(people)) return [];
  if (validarPessoas(people).erro !== null) return []; // envelope irregular → nada, não "o que der"
  const filtro = typeof consulta === 'string' ? consulta.trim().toLowerCase() : '';
  const encontrados = [];
  for (const [personId, pessoa] of Object.entries(people)) {
    if (!isPersonId(personId)) continue;
    const nome = nomeObservadoDe(pessoa);
    if (nome === null) continue;
    if (filtro !== '' && !nome.toLowerCase().includes(filtro)) continue;
    encontrados.push({ personId, displayName: nome });
  }
  return encontrados.sort((a, b) => a.displayName.localeCompare(b.displayName, 'pt-BR'));
}

// Observação DIRETA da sessão para uma key exata — é o que enriquece status/username de uma pessoa
// conhecida. Nunca casa por nome, e sem observação o status fica DESCONHECIDO.
//
// ⚠️ A observação só vale com `observedAt` CANÔNICO (ISO-8601 UTC com ms, validado por
// round-trip — a mesma régua da retenção). Um registro sem carimbo, ou com um carimbo que não é
// uma data de verdade (`'ontem'`, `'2026-02-31'`), não prova QUANDO o `active` foi visto — e
// status de conta sem data é palpite. Sem isso → tratada como inexistente.
function observacaoDaKey(sessionIdentity, key) {
  if (!nonEmptyString(key)) return null;
  const byKey = sessionIdentity?.byKey;
  if (!(byKey instanceof Map)) return null;
  const obs = byKey.get(key);
  if (!isPlainObject(obs) || !isCanonicalTimestamp(obs.observedAt)) return null;
  return obs;
}

// Key persistida de uma pessoa conhecida — usada só para ENRIQUECER com a observação de sessão.
// Ela nunca sai daqui: não vira intenção (a pessoa conhecida é selecionada por `personId`) e nunca
// entra em DOM/storage.
function keyPersistida(envelope, personId) {
  const pessoa = isPlainObject(envelope?.people) ? envelope.people[personId] : null;
  const ref = isPlainObject(pessoa?.externalIdentities) ? pessoa.externalIdentities[PROVIDER] : null;
  return isPlainObject(ref) && nonEmptyString(ref.key) ? ref.key : null;
}

// Cria uma INSTÂNCIA de picker. Cada instância tem seu próprio espaço de tokens: um token de outra
// instância (ou de uma busca anterior) não resolve — fail-closed.
//
//   nextToken() → string opaca; now() → carimbo ISO da OBSERVAÇÃO LOCAL (o instante em que o
//   JiraDash processou o resultado — nunca um timestamp vindo do Jira).
export function createPersonPicker({ nextToken, now } = {}) {
  if (typeof nextToken !== 'function') throw new Error('picker.deps.nextToken:missing');
  if (typeof now !== 'function') throw new Error('picker.deps.now:missing');

  let estado = PICKER_IDLE;
  let consultaAtual = '';
  let candidatos = [];
  let erro = null;
  let geracao = 0; // busca fora de ordem: só a ÚLTIMA disparada pode publicar
  const intentByToken = new Map();

  const publicar = (novoEstado, lista = [], motivo = null) => {
    estado = novoEstado;
    candidatos = lista;
    erro = motivo;
  };

  return {
    get state() {
      return estado;
    },
    get query() {
      return consultaAtual;
    },
    get candidates() {
      return candidatos;
    },
    get error() {
      return erro;
    },
    // Abre uma busca e devolve o "bilhete" da geração. Quem chama o transporte guarda este número
    // e o devolve ao publicar — resposta de uma busca ANTERIOR é descartada.
    //
    // Consulta vazia é recusada AQUI, sem gerar bilhete: devolve `null`, o estado vira
    // `invalid-query` e NENHUM GET acontece. O chamador não deve prosseguir.
    beginSearch(consulta) {
      consultaAtual = typeof consulta === 'string' ? consulta : '';
      intentByToken.clear(); // tokens do render anterior deixam de valer
      if (consultaAtual.trim() === '') {
        geracao += 1; // invalida qualquer busca em voo
        publicar(PICKER_INVALID_QUERY);
        return null;
      }
      geracao += 1;
      publicar(PICKER_LOADING);
      return geracao;
    },
    isCurrent(bilhete) {
      return bilhete === geracao;
    },
    // Publica o RESULTADO da busca. `resposta` é o que `jiraApi.searchUsers` devolveu, já com a
    // allowlist aplicada. Quando indisponível, cai no diretório conhecido (que pode ser vazio) —
    // e os dois casos continuam sendo estados DISTINTOS na tela.
    publishSearch(bilhete, resposta, { envelope = null, sessionIdentity = null } = {}) {
      if (bilhete === null || bilhete !== geracao) return false; // obsoleta ou recusada localmente
      const observedAt = now();
      if (!isPlainObject(resposta) || resposta.status === 'unavailable') {
        publicar(PICKER_UNAVAILABLE, this.knownCandidates({ envelope, sessionIdentity, observedAt }));
        return true;
      }
      // Recusa local não vira afirmação sobre o Jira.
      if (resposta.status === 'invalid-query') {
        publicar(PICKER_INVALID_QUERY);
        return true;
      }
      const lista = Array.isArray(resposta.results) ? resposta.results : [];
      const mapeados = lista.map(r => {
        const key = nonEmptyString(r?.key) ? r.key : null;
        const displayName = nonEmptyString(r?.displayName) ? r.displayName : null;
        // Sem key não há vínculo externo: o resultado APARECE, mas não é selecionável.
        const selectable = key !== null && displayName !== null;
        return {
          token: selectable
            ? this._registrar({
                source: SOURCE_JIRA,
                externalRef: { provider: PROVIDER, kind: 'key', value: key },
                observedProfile: { displayName }
              })
            : null,
          source: SOURCE_JIRA,
          selectable,
          presentationName: displayName === null ? null : stripStatusMarker(displayName),
          // `username` e `active` ficam SÓ aqui, em memória de sessão.
          username: nonEmptyString(r?.username) ? r.username : null,
          status: statusFromActive(r?.active ?? null),
          observedAt
        };
      });
      publicar(mapeados.length === 0 ? PICKER_EMPTY : PICKER_RESULTS, mapeados);
      return true;
    },
    // Diretório já conhecido, enriquecido pela observação DIRETA de sessão (por key exata).
    knownCandidates({ envelope = null, sessionIdentity = null, observedAt = null } = {}) {
      const carimbo = observedAt ?? now();
      return localDirectory(envelope, consultaAtual).map(({ personId, displayName }) => {
        const obs = observacaoDaKey(sessionIdentity, keyPersistida(envelope, personId));
        return {
          token: this._registrar({ source: SOURCE_KNOWN, personId }),
          source: SOURCE_KNOWN,
          selectable: true,
          presentationName: stripStatusMarker(displayName),
          username: obs && nonEmptyString(obs.username) ? obs.username : null,
          // Sem observação recente o status é DESCONHECIDO — nunca "ativo por omissão".
          status: obs ? statusFromActive(obs.active ?? null) : STATUS_UNKNOWN,
          observedAt: carimbo
        };
      });
    },
    beginSave() {
      estado = PICKER_SAVING;
    },
    failSave(codigo) {
      estado = PICKER_ERROR;
      erro = typeof codigo === 'string' ? codigo : 'unknown';
    },
    reset() {
      consultaAtual = '';
      geracao += 1;
      intentByToken.clear();
      publicar(PICKER_IDLE);
    },
    // Round-trip da seleção: token do DOM → INTENÇÃO validada, só em memória. Token inexistente,
    // obsoleto (outra busca) ou de outra instância → null, e o chamador falha de forma visível.
    //
    // A intenção de um resultado do Jira carrega EXATAMENTE:
    //   { externalRef: { provider, kind:'key', value }, observedProfile: { displayName } }
    // `username` e `active` NÃO entram — eles não são persistíveis.
    intentForToken(token) {
      const v = intentByToken.get(token);
      return v ?? null;
    },
    _registrar(intent) {
      const token = nextToken();
      intentByToken.set(token, intent);
      return token;
    }
  };
}
