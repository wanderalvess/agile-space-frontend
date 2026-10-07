// Reconciliação assistida por slot — CP8 (M2) da épica "identidade e roster v2" (#7).
//
// Fronteira PEQUENA e PURA. Monta a FILA de slots legados PENDENTES com sugestões EXPLICÁVEIS,
// para que um humano tome uma de duas decisões, sempre por SLOT:
//   1. VINCULAR aquele slot a uma pessoa (candidato existente ou key observada, que o SERVIDOR
//      transforma em pessoa nova);
//   2. MANTER SEPARADO aquele slot daquele candidato.
// Nada aqui toca DOM, storage, fetch, `state` ou relógio — a avaliação do módulo é inerte, e o
// gerador de token é INJETADO (contador/PRNG) para ser determinístico em teste.
//
// ── O QUE ESTE MÓDULO NUNCA FAZ ────────────────────────────────────────────────────────────
//   - NUNCA cria `personId` (invariante do servidor, desde o CP3): só oferece `personId` que já
//     existe em `identity.people`, ou a `externalRef` OBSERVADA da própria linha;
//   - igualdade de `displayName` gera SUGESTÃO, nunca vínculo — nenhum candidato é confirmado
//     automaticamente e homônimo ambíguo continua PENDENTE;
//   - `username` (o `name` do Jira) vive só na sessão: pode ELEVAR a força de uma sugestão,
//     jamais autorizar a ação, e jamais é persistido;
//   - a Jira `key` fica só na estrutura de sessão da intenção — nunca em DOM, HTML, log, URL,
//     export ou storage;
//   - `slotId` é REVERSÍVEL (decodifica o displayName): fica interno, nunca vai a DOM. O que a UI
//     transporta é um TOKEN opaco e descartável.
//
// ── FAIL-CLOSED ────────────────────────────────────────────────────────────────────────────
// Qualquer irregularidade estrutural (registro de slot inválido, `separations` malformada,
// pessoa inexistente, key duplicada entre pessoas) descarta a fila INTEIRA com código estático.
// Uma fila "quase certa" convidaria a uma decisão humana errada — e decisão humana é justamente
// o que este checkpoint persiste.

import { stripStatusMarker } from './person-presentation.js';
import { validarRegistroDeSlot } from './analysis-scope.js';

// ── Força das sugestões (ordem crescente) e razões ESTÁTICAS ────────────────────────────────
export const STRENGTH_WEAK = 'weak';
export const STRENGTH_MEDIUM = 'medium';
export const STRENGTH_STRONG = 'strong';
const ORDEM_FORCA = { [STRENGTH_WEAK]: 1, [STRENGTH_MEDIUM]: 2, [STRENGTH_STRONG]: 3 };
const maiorForca = (a, b) => (ORDEM_FORCA[a] >= ORDEM_FORCA[b] ? a : b);

export const REASON_NAME_EQUALITY = 'name-equality';
export const REASON_SESSION_USERNAME_UNIQUE = 'session-username-unique';
export const REASON_NEIGHBOUR_CONFIRMED = 'neighbour-confirmed-binding';
export const REASON_OBSERVED_KEY_LINKED = 'observed-key-linked';
export const REASON_OBSERVED_KEY_NEW = 'observed-key-unlinked';
export const REASON_AMBIGUOUS = 'ambiguous-multiple-candidates';

// Tipos de candidato. `person` aponta para identidade JÁ PERSISTIDA; `external` é a key observada
// na sessão que ainda não tem pessoa — só o SERVIDOR pode transformá-la em `personId`.
export const CANDIDATE_PERSON = 'person';
export const CANDIDATE_EXTERNAL = 'external';

export const DECISION_KEEP_SEPARATED = 'keep-separated';
export const CONFIRMATION_METHOD = 'human-ui';
const PROVIDER = 'jira-server';

const isPlainObject = v => typeof v === 'object' && v !== null && !Array.isArray(v);
const nonEmptyString = v => typeof v === 'string' && v !== '';
const isPersonId = v => typeof v === 'string' && v.startsWith('person:') && v.length > 'person:'.length;

const vazio = (status, errors = []) => ({
  status,
  errors,
  items: [],
  stats: { total: 0, pending: 0, confirmed: 0, withCandidates: 0, ambiguous: 0, separated: 0 },
  intentForToken: () => null
});

// ── `identity.separations` — local CANÔNICO da decisão "manter separado" ─────────────────────
// Coleção PRÓPRIA, separada do estado principal do binding, justamente para não inventar um
// status que deixasse o slot "resolvido e não vinculado" ao mesmo tempo. A decisão é por
// slot+candidato: manter separado de UMA pessoa não rejeita candidatos futuros diferentes.
//
//   identity.separations[slotId][personId] = {
//     decision: 'keep-separated', decidedAt: '<servidor>', confirmationMethod: 'human-ui',
//     actor: null
//   }
//
// Nada mais é persistido: sem username, sem `active`, sem força da sugestão, sem key nova, sem
// texto livre e sem justificativa pessoal. MESMOS códigos do servidor.
export function validarSeparacoes(separations, slots, people) {
  if (separations === undefined) return null;
  if (!isPlainObject(separations)) return 'identity.separations:not-object';
  const temPeople = isPlainObject(people);
  for (const [slotId, porCandidato] of Object.entries(separations)) {
    if (!isPlainObject(porCandidato)) return 'identity.separations.record:not-object';
    // Referência estrutural: a decisão vale para um slot legado que EXISTE.
    if (!nonEmptyString(slotId) || !Object.prototype.hasOwnProperty.call(slots || {}, slotId)) {
      return 'identity.separations.slot:unknown';
    }
    for (const [personId, registro] of Object.entries(porCandidato)) {
      if (!isPersonId(personId)) return 'identity.separations.personId:invalid';
      if (!temPeople || !Object.prototype.hasOwnProperty.call(people, personId)) {
        return 'identity.separations.personId:unknown';
      }
      if (!isPlainObject(registro)) return 'identity.separations.entry:invalid';
      if (registro.decision !== DECISION_KEEP_SEPARATED) return 'identity.separations.decision:invalid';
      if (registro.confirmationMethod !== CONFIRMATION_METHOD) {
        return 'identity.separations.confirmationMethod:invalid';
      }
      // L15 continua adiada: auditoria NÃO é atribuída a uma pessoa.
      if (registro.actor !== null) return 'identity.separations.actor:invalid';
      if (!nonEmptyString(registro.decidedAt)) return 'identity.separations.decidedAt:invalid';
    }
  }
  return null;
}

// ── Validação INTEGRAL do registro de pessoas — MESMA régua e MESMOS códigos do servidor ─────
// (`server/reconciliation-domain.js#assertPeopleIntegrity`). Não basta "people existe": cada
// registro é validado por inteiro, incluindo os METADADOS DE RETENÇÃO que tornam o dado pessoal
// auditável (Rev. 7). Um perfil sem finalidade/carimbo/revisão é recusado, e uma string solta
// NÃO é um perfil válido.
//
//   people[personId] = {
//     personId,                                  // igual à CHAVE do mapa
//     displayName: null | { value, observedAt, purpose, reviewAfter },
//     externalIdentities: { <provider>: { key, observedAt, status, purpose, reviewAfter } }
//   }
// ⚠️ Cada FINALIDADE pertence a UM campo: `roster-display` só no `displayName`, `identity-link` só
// na external identity. Datas são CANÔNICAS (ISO-8601 UTC com ms, com round-trip) e `reviewAfter`
// vem estritamente DEPOIS de `observedAt` — a revisão desses dois campos é ANUAL (Rev. 7).
export const PURPOSE_ROSTER_DISPLAY = 'roster-display';
export const PURPOSE_IDENTITY_LINK = 'identity-link';
const STATUS_EXTERNO_CONHECIDOS = ['current'];
const CARIMBO_CANONICO = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;

export function isCanonicalTimestamp(v) {
  if (typeof v !== 'string' || !CARIMBO_CANONICO.test(v)) return false;
  const t = Date.parse(v);
  return Number.isFinite(t) && new Date(t).toISOString() === v;
}
const revisaoDepois = (reviewAfter, observedAt) => Date.parse(reviewAfter) > Date.parse(observedAt);

function erroDoRegistroDeNome(registro) {
  if (registro === undefined || registro === null) return null; // perfil ausente é legítimo
  if (!isPlainObject(registro) || !nonEmptyString(registro.value)) {
    return 'identity.people.displayName:invalid';
  }
  if (!isCanonicalTimestamp(registro.observedAt)) return 'identity.people.displayName.observedAt:invalid';
  if (registro.purpose !== PURPOSE_ROSTER_DISPLAY) return 'identity.people.displayName.purpose:invalid';
  if (!isCanonicalTimestamp(registro.reviewAfter)) return 'identity.people.displayName.reviewAfter:invalid';
  if (!revisaoDepois(registro.reviewAfter, registro.observedAt)) {
    return 'identity.people.displayName.reviewAfter:not-after';
  }
  return null;
}

// Valida `people` por inteiro e, de quebra, devolve o índice key → personId do provider Jira.
export function validarPessoas(people) {
  const porKey = new Map();
  if (people === undefined) return { porKey, erro: null };
  if (!isPlainObject(people)) return { porKey: null, erro: 'identity.people:not-object' };
  const falha = erro => ({ porKey: null, erro });
  const vistas = new Set(); // `${provider}\n${key}` — unicidade global por provider
  for (const [personId, pessoa] of Object.entries(people)) {
    if (!isPlainObject(pessoa)) return falha('identity.people.record:not-object');
    if (!isPersonId(personId)) return falha('identity.people.personId:invalid');
    if (pessoa.personId !== personId) return falha('identity.people.personId:incoherent');
    const erroNome = erroDoRegistroDeNome(pessoa.displayName);
    if (erroNome) return falha(erroNome);
    const ext = pessoa.externalIdentities;
    if (ext === undefined) continue;
    if (!isPlainObject(ext)) return falha('identity.people.externalIdentities:not-object');
    for (const [provider, ref] of Object.entries(ext)) {
      if (!nonEmptyString(provider)) return falha('identity.people.externalIdentities:not-object');
      if (!isPlainObject(ref)) return falha('identity.people.externalIdentity:invalid');
      if (!nonEmptyString(ref.key)) return falha('identity.people.externalIdentity.key:invalid');
      if (!isCanonicalTimestamp(ref.observedAt))
        return falha('identity.people.externalIdentity.observedAt:invalid');
      if (!STATUS_EXTERNO_CONHECIDOS.includes(ref.status)) {
        return falha('identity.people.externalIdentity.status:invalid');
      }
      if (ref.purpose !== PURPOSE_IDENTITY_LINK) {
        return falha('identity.people.externalIdentity.purpose:invalid');
      }
      if (!isCanonicalTimestamp(ref.reviewAfter))
        return falha('identity.people.externalIdentity.reviewAfter:invalid');
      if (!revisaoDepois(ref.reviewAfter, ref.observedAt)) {
        return falha('identity.people.externalIdentity.reviewAfter:not-after');
      }
      const chave = `${provider}\n${ref.key}`;
      if (vistas.has(chave)) return falha('identity.people.externalKey:duplicated');
      vistas.add(chave);
      if (provider === PROVIDER) porKey.set(ref.key, personId);
    }
  }
  return { porKey, erro: null };
}

// Quantas vezes cada `username` foi OBSERVADO nesta sessão (registro do CP2: convergido por key
// + provisórias). Só memória; nunca sai daqui em atributo, storage ou documento.
function contarUsernames(sessionIdentity) {
  const contagem = new Map();
  const somar = username => {
    if (!nonEmptyString(username)) return;
    contagem.set(username, (contagem.get(username) || 0) + 1);
  };
  if (sessionIdentity && sessionIdentity.byKey instanceof Map) {
    for (const obs of sessionIdentity.byKey.values()) somar(obs && obs.username);
  }
  if (Array.isArray(sessionIdentity?.provisional)) {
    for (const obs of sessionIdentity.provisional) somar(obs && obs.username);
  }
  return contagem;
}

// ── VIZINHO: definição DETERMINÍSTICA (e a única deste checkpoint) ───────────────────────────
// Vizinho de um slot é OUTRO slot de SPRINT cujo `resolvedScopeId` é o MESMO e NÃO NULO.
// Consequências, todas deliberadas:
//   - slot NÃO RESOLVIDO não tem vizinhos (nada a comparar);
//   - slot GLOBAL nunca é vizinho de slot de sprint, nem tem vizinhos — o Global Default não
//     pertence a escopo nenhum;
//   - escopos diferentes NUNCA são vizinhos: a vizinhança jamais atravessa escopo.
// Vizinho só eleva a FORÇA de uma sugestão; nunca produz binding automático.
function saoVizinhos(a, b) {
  if (a.slot.kind !== 'sprint' || b.slot.kind !== 'sprint') return false;
  const ea = a.registro.resolvedScopeId ?? null;
  const eb = b.registro.resolvedScopeId ?? null;
  return ea !== null && ea === eb;
}

// Monta a fila. `nextToken` é INJETADO e gera tokens opacos e descartáveis (novos a cada
// reconstrução): o DOM só transporta esses tokens, nunca personId, key, username ou slotId.
//
// Entradas (todas opcionais, exceto `nextToken`):
//   envelope        — envelope v2 já carregado em memória;
//   provenance      — proveniência de linha do CP6 (`directFor(displayName)`): associação DIRETA
//                     entre a linha e o objeto de usuário do Jira que a criou. É a ÚNICA fonte de
//                     key/username/status — varredura por nome nunca decide identidade;
//   sessionIdentity — registro de observação do CP2 (`derived.identity`), só para a contagem de
//                     usernames que ELEVA força;
//   scopeModel/selection — contexto de escopo do CP7 (`analysisScopeId` quando resolvido).
export function buildReconciliationQueue({
  envelope = null,
  provenance = null,
  sessionIdentity = null,
  scopeModel = null,
  selection = null,
  nextToken
} = {}) {
  if (typeof nextToken !== 'function') throw new Error('reconciliation.deps.nextToken:missing');
  if (envelope === undefined || envelope === null) return vazio('absent');
  if (!isPlainObject(envelope)) return vazio('invalid', ['identity:not-object']);
  if (envelope.schemaVersion !== 2) return vazio('unsupported');

  const bindings = envelope.bindings;
  if (bindings !== undefined && !isPlainObject(bindings)) {
    return vazio('invalid', ['identity.bindings:not-object']);
  }
  const slotsBrutos = isPlainObject(bindings) ? bindings['legacy-slots'] : undefined;
  if (slotsBrutos !== undefined && !isPlainObject(slotsBrutos)) {
    return vazio('invalid', ['identity.bindings.legacy-slots:not-object']);
  }
  const slots = isPlainObject(slotsBrutos) ? slotsBrutos : {};
  const people = envelope.people;
  const escopos = isPlainObject(envelope.scopes) ? envelope.scopes : {};
  // Períodos por escopo — usados para decidir se um slot de sprint é VINCULÁVEL (a M2 exige
  // exatamente um período para a sprint). Shape já validado pelo leitor do CP7.
  const periodos = isPlainObject(envelope.periods) ? envelope.periods : {};

  // TODOS os registros passam pela MESMA régua do CP7 (mesmos códigos no cliente e no servidor).
  const registros = [];
  for (const [id, registro] of Object.entries(slots)) {
    const erro = validarRegistroDeSlot(id, registro, escopos, people);
    if (erro) return vazio('invalid', [erro]);
    registros.push({ id, registro, slot: registro.slot });
  }
  const erroSep = validarSeparacoes(envelope.separations, slots, people);
  if (erroSep) return vazio('invalid', [erroSep]);
  const { porKey, erro: erroKeys } = validarPessoas(people);
  if (erroKeys) return vazio('invalid', [erroKeys]);

  const separations = isPlainObject(envelope.separations) ? envelope.separations : {};
  const usernames = contarUsernames(sessionIdentity);
  const confirmados = registros.filter(r => r.registro.status === 'confirmed');

  const intentByToken = new Map();
  const registrarToken = intent => {
    const token = nextToken();
    intentByToken.set(token, intent);
    return token;
  };

  // Homônimo = MESMO displayName cru em mais de um slot legado. É o único caso em que o
  // `username` de sessão é exposto na tela (desambiguação visual), nunca em atributo/storage.
  const contagemDeNome = new Map();
  for (const r of registros) {
    const n = r.slot.displayName;
    contagemDeNome.set(n, (contagemDeNome.get(n) || 0) + 1);
  }

  const items = [];
  let separatedTotal = 0;
  for (const entrada of registros) {
    if (entrada.registro.status === 'confirmed') continue; // já vinculado: fora da fila
    const { id, registro, slot } = entrada;
    const displayName = slot.displayName;
    // Associação DIRETA linha ↔ objeto Jira. Linha vinda só de config/carry-forward não tem
    // proveniência: sem key, sem username e sem status — e isso NÃO impede a sugestão por nome.
    const direto = provenance ? provenance.directFor(displayName) : null;
    const key = direto && nonEmptyString(direto.key) ? direto.key : null;
    const username = direto && nonEmptyString(direto.username) ? direto.username : null;
    const usernameUnico = username !== null && usernames.get(username) === 1;

    const porCandidato = new Map(); // chave de agrupamento → candidato
    const acrescentar = (chave, base, forca, razao) => {
      const atual = porCandidato.get(chave);
      if (!atual) {
        porCandidato.set(chave, { ...base, strength: forca, reasons: [razao] });
        return;
      }
      atual.strength = maiorForca(atual.strength, forca);
      // A `externalRef` de uma razão nunca é perdida ao fundir com outra que não a tem (ordem das
      // razões não pode decidir se o candidato leva a key observada).
      if (!atual.externalRef && base.externalRef) atual.externalRef = base.externalRef;
      if (!atual.reasons.includes(razao)) atual.reasons.push(razao);
    };

    // (a) KEY OBSERVADA — evidência de identidade da PRÓPRIA linha, nunca de nome.
    if (key !== null) {
      const pid = porKey.get(key) ?? null;
      if (pid !== null) {
        // Já existe pessoa persistida com esta key: a key LOCALIZA o candidato. Continua sem
        // confirmar o slot — quem confirma é a ação humana.
        // ⚠️ O candidato carrega `personId` E `externalRef`: é a key observada que autoriza gravar
        // o perfil, e o servidor recusa perfil sem ela. Sem os dois, o caminho real "key já
        // conhecida" não conseguiria atualizar a pessoa que ele mesmo localizou.
        acrescentar(
          `p:${pid}`,
          {
            kind: CANDIDATE_PERSON,
            personId: pid,
            externalRef: { provider: PROVIDER, kind: 'key', value: key }
          },
          STRENGTH_STRONG,
          REASON_OBSERVED_KEY_LINKED
        );
      } else {
        // Key sem pessoa persistida: o candidato é a REFERÊNCIA EXTERNA. Só o servidor pode
        // transformá-la em `personId`, e só dentro do lock.
        acrescentar(
          `k:${key}`,
          { kind: CANDIDATE_EXTERNAL, externalRef: { provider: PROVIDER, kind: 'key', value: key } },
          STRENGTH_STRONG,
          REASON_OBSERVED_KEY_NEW
        );
      }
    }

    // (b) IGUALDADE DE displayName — sugestão MÉDIA, jamais vínculo.
    for (const outro of confirmados) {
      if (outro.id === id) continue;
      if (outro.slot.displayName !== displayName) continue;
      const pid = outro.registro.personId;
      acrescentar(
        `p:${pid}`,
        { kind: CANDIDATE_PERSON, personId: pid },
        STRENGTH_MEDIUM,
        REASON_NAME_EQUALITY
      );
      // (c) ELEVAÇÕES. Vizinhança e username só sobem a força de um candidato que já existe.
      if (saoVizinhos(entrada, outro)) {
        acrescentar(
          `p:${pid}`,
          { kind: CANDIDATE_PERSON, personId: pid },
          STRENGTH_STRONG,
          REASON_NEIGHBOUR_CONFIRMED
        );
      }
      if (usernameUnico) {
        acrescentar(
          `p:${pid}`,
          { kind: CANDIDATE_PERSON, personId: pid },
          STRENGTH_STRONG,
          REASON_SESSION_USERNAME_UNIQUE
        );
      }
    }

    // (d) "MANTER SEPARADO" suprime o candidato SÓ NESTE SLOT. Outro candidato continua
    // disponível, e o slot vizinho não é afetado.
    const separadosDoSlot = isPlainObject(separations[id]) ? separations[id] : {};
    let suprimidos = 0;
    for (const chave of [...porCandidato.keys()]) {
      const cand = porCandidato.get(chave);
      if (cand.kind !== CANDIDATE_PERSON) continue;
      if (Object.prototype.hasOwnProperty.call(separadosDoSlot, cand.personId)) {
        porCandidato.delete(chave);
        suprimidos += 1;
      }
    }
    separatedTotal += suprimidos;

    // Um slot de SPRINT só pode ser VINCULADO quando o escopo está resolvido E existe EXATAMENTE
    // UM período para a sprint: é a mesma régua que a M2 aplica antes de criar a participação. A
    // fila confere as DUAS coisas para a UI nunca oferecer uma ação que o servidor vai recusar —
    // conferir só o escopo deixaria "Vincular" visível e o erro só apareceria depois do clique.
    // "Manter separado" continua disponível: ele não cria participação.
    const escopoDoSlot = nonEmptyString(registro.resolvedScopeId ?? '') ? registro.resolvedScopeId : null;
    const escopoResolvido = registro.scopeStatus === 'resolved' && escopoDoSlot !== null;
    let blockedReason = null;
    if (slot.kind === 'sprint') {
      if (!escopoResolvido) blockedReason = 'scope-unresolved';
      else {
        const doEscopo = isPlainObject(periodos[escopoDoSlot]) ? periodos[escopoDoSlot] : {};
        const casam = Object.values(doEscopo).filter(p => isPlainObject(p) && p.sprintId === slot.sprintId);
        if (casam.length === 0) blockedReason = 'period-missing';
        else if (casam.length > 1) blockedReason = 'period-ambiguous';
      }
    }
    const linkable = blockedReason === null;

    const candidates = [...porCandidato.values()]
      .map(c => ({
        token: registrarToken({
          action: 'link',
          slot,
          personId: c.kind === CANDIDATE_PERSON ? c.personId : null,
          // A `externalRef` acompanha TODO candidato vindo da key observada — inclusive o que já
          // tem `personId`. É ela que autoriza o servidor a gravar o perfil; sem ela, o caminho
          // real "key já conhecida" seria recusado com `reconcile.observedProfile:unexpected`.
          externalRef: c.externalRef ?? null,
          candidatePersonId: c.kind === CANDIDATE_PERSON ? c.personId : null,
          // Perfil OBSERVADO desta linha — existe SOMENTE junto da key da proveniência DIRETA.
          // Nunca sai de igualdade de nome, e vive só nesta estrutura de sessão (jamais em
          // DOM/storage).
          observedProfile: c.externalRef ? { displayName } : null,
          linkable
        }),
        kind: c.kind,
        strength: c.strength,
        reasons: [...c.reasons],
        // Nome de APRESENTAÇÃO do candidato, só quando persistido (nunca fabricado, nunca o
        // personId como nome). Sem nome persistido a UI mostra apenas a força e as razões.
        presentationName: nomePersistido(people, c.personId)
      }))
      .sort((a, b) => ORDEM_FORCA[b.strength] - ORDEM_FORCA[a.strength]);

    // Homônimo AMBÍGUO continua pendente: nenhuma preferência automática entre os candidatos.
    const ambiguous = candidates.length > 1;
    items.push({
      token: registrarToken({ action: 'inspect', slot, personId: null, externalRef: null }),
      slot,
      kind: slot.kind,
      sprintId: slot.kind === 'sprint' ? slot.sprintId : null,
      analysisScopeId: registro.resolvedScopeId ?? null,
      linkable,
      // Razão ESTÁTICA de por que Vincular está indisponível (a UI traduz localmente).
      blockedReason,
      // `[X]` sai do nome visível (§CP6) — status é outra coisa, e o nome nunca vira identidade.
      presentationName: stripStatusMarker(displayName),
      // `username` fica NESTE objeto de memória só para desambiguar HOMÔNIMO na tela; nunca em
      // atributo, storage ou documento — e só quando o displayName cru se repete.
      username: contagemDeNome.get(displayName) > 1 ? username : null,
      state: registro.status,
      scopeState: registro.scopeStatus,
      candidates,
      ambiguous,
      reasons: ambiguous ? [REASON_AMBIGUOUS] : [],
      separatedCandidates: suprimidos
    });
  }

  // Ordem estável e sem revelar nada: primeiro quem tem candidato forte, depois pelo nome seguro.
  items.sort((a, b) => {
    const fa = a.candidates[0] ? ORDEM_FORCA[a.candidates[0].strength] : 0;
    const fb = b.candidates[0] ? ORDEM_FORCA[b.candidates[0].strength] : 0;
    if (fa !== fb) return fb - fa;
    return a.presentationName.localeCompare(b.presentationName, 'pt-BR');
  });

  return {
    status: 'ready',
    errors: [],
    items,
    stats: {
      total: registros.length,
      pending: items.length,
      confirmed: confirmados.length,
      withCandidates: items.filter(i => i.candidates.length > 0).length,
      ambiguous: items.filter(i => i.ambiguous).length,
      separated: separatedTotal
    },
    // Round-trip da ação: token do DOM → INTENÇÃO validada em memória. Token desconhecido ou
    // obsoleto → null, e o chamador FALHA de forma visível (nada é enviado nem gravado).
    intentForToken(token) {
      return intentByToken.get(token) ?? null;
    },
    // Contexto do CP7 apenas ecoado, para a UI mostrar a iniciativa quando resolvida.
    scopeSelection: selection ?? null,
    scopeAvailable: scopeModel?.status === 'supported',
    // Conflitos ABERTOS do documento, por tipo — no NÍVEL DA FILA, não da linha.
    // ⚠️ Fronteira honesta: o conflito guarda `slotDigest` (HMAC do segredo do SERVIDOR). O
    // cliente não tem o segredo e não recomputa digest, então NÃO afirma a qual slot um conflito
    // pertence. Associá-lo à linha exigiria expor o `slotId` reversível ou o segredo — nenhum dos
    // dois é aceitável. Quem devolve o conflito específico de uma ação é a resposta 409 da rota.
    openConflicts: conflitosAbertos(envelope)
  };
}

// Nome de apresentação PERSISTIDO de uma pessoa. Nunca fabricado, nunca o personId, nunca
// deduzido por igualdade de displayName: só o registro que o documento realmente guarda — e no
// SHAPE APROVADO (`{ value, observedAt, purpose, reviewAfter }`). Uma string solta NÃO é perfil
// válido: sem finalidade e sem prazo de revisão, o dado não pode ser exibido.
export function nomeObservadoDe(pessoa) {
  const registro = isPlainObject(pessoa) ? pessoa.displayName : null;
  if (!isPlainObject(registro) || !nonEmptyString(registro.value)) return null;
  return erroDoRegistroDeNome(registro) === null ? registro.value : null;
}
function nomePersistido(people, personId) {
  if (!isPersonId(personId) || !isPlainObject(people)) return null;
  const valor = nomeObservadoDe(people[personId]);
  return valor === null ? null : stripStatusMarker(valor);
}

// Conflitos ABERTOS do documento, agregados por TIPO. Nenhum valor bruto e nenhuma associação
// inventada: só `kind` (código estático) e a contagem.
function conflitosAbertos(envelope) {
  const lista = Array.isArray(envelope.conflicts) ? envelope.conflicts : [];
  const porTipo = new Map();
  for (const c of lista) {
    if (!isPlainObject(c) || c.resolution != null || !nonEmptyString(c.kind)) continue;
    porTipo.set(c.kind, (porTipo.get(c.kind) || 0) + 1);
  }
  return [...porTipo.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([kind, count]) => ({ kind, count }));
}

// ── Materialização de roster a partir de PARTICIPAÇÃO ───────────────────────────────────────
// O CP8 pode mostrar no roster uma pessoa que já existe em `participation` — mas SOMENTE quando o
// documento guarda dados suficientes para apresentá-la. Regras, todas fail-closed:
//   - só no modo `scoped`, com escopo E período resolvidos;
//   - o nome vem EXCLUSIVAMENTE do registro `identity.people[personId].displayName` no SHAPE
//     APROVADO (valor + carimbo + finalidade + revisão); nada é fabricado, o `personId` nunca vira
//     nome visível e NENHUMA união por displayName acontece;
//   - sem registro válido a pessoa NÃO entra (contada em `skipped`), e a fronteira fica documentada
//     em vez de disfarçada com um rótulo inventado.
// A M2 PERSISTE esse registro ao vincular um candidato cuja key foi observada, então a
// materialização é real — não um caminho morto.
export function participationRosterNames(envelope, participationMap) {
  const nomes = new Set();
  let skipped = 0;
  if (!isPlainObject(participationMap)) return { names: nomes, skipped };
  const people = isPlainObject(envelope?.people) ? envelope.people : null;
  for (const personId of Object.keys(participationMap)) {
    const valor = people ? nomeObservadoDe(people[personId]) : null;
    if (valor === null) skipped += 1;
    else nomes.add(valor);
  }
  return { names: nomes, skipped };
}
