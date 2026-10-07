// Escopo analítico — CP7 da épica "identidade e roster v2" (#7).
//
// Fronteira PEQUENA e PURA de LEITURA. Responde ao resto do app:
//   1. qual escopo vale para a sprint atual (decidido pela referência da SQUAD ativa)?
//   2. quais períodos ANTERIORES pertencem a esse escopo (carry-forward)?
//   3. qual seletor vigia, e a qual revisão o período está preso?
//   4. um slot legado pertence a QUAL escopo (para config/capacity não vazarem entre escopos)?
// Nada aqui toca DOM, storage, Jira, `state` ou relógio — avaliação inerte.
//
// ── DUAS CAMADAS DE REGRA, deliberadamente separadas ────────────────────────────────────────
//   (a) VALIDAÇÃO GENÉRICA DO MODELO (este arquivo): diz se o documento é *estruturalmente*
//       coerente. A MESMA sprint em escopos DIFERENTES é modelo VÁLIDO — dois times podem
//       analisar a mesma sprint. Só irregularidade real (chave que não bate com o registro,
//       referência pendente, kind fora do CP7, duplicidade dentro do mesmo escopo) invalida.
//   (b) REGRAS DA M1b (server/analysis-scope-domain.js): podem recusar uma ATRIBUIÇÃO automática
//       ambígua sem declarar o envelope inteiro inválido.
//
// ── QUEM DESAMBIGUA ────────────────────────────────────────────────────────────────────────
// A referência OPCIONAL `analysisScopeId` da squad ativa. Sem referência → caminho LEGADO (por
// board), byte a byte. Com referência VÁLIDA → aquele escopo, exclusivamente. Com referência
// EXPLÍCITA porém desconhecida/inválida/sem período para a sprint atual → FAIL-CLOSED: sem
// carry-forward e sem config por sprint — nunca cai no legado de outro escopo.
//
// Invariantes: `analysisScopeId`/`periodId` são OPACOS (o servidor os cria); só
// `period.kind === 'sprint'` existe (release/date-range/continuous são recusados, L16); nenhuma
// pessoa/participação nasce de igualdade de displayName; revisão de seletor é IMUTÁVEL.

import { priorSprintIdsSameBoard } from './sprints.js';
import { slotIdCanonical } from './person-presentation.js';

export const PERIOD_KIND_SPRINT = 'sprint';
export const PERIOD_KINDS_BLOQUEADOS = Object.freeze(['release', 'date-range', 'continuous']);

// Modos da seleção de escopo (o que o roster e a herança consomem).
export const SCOPE_MODE_LEGACY = 'legacy';
export const SCOPE_MODE_SCOPED = 'scoped';
export const SCOPE_MODE_BLOCKED = 'blocked';

const isPlainObject = v => typeof v === 'object' && v !== null && !Array.isArray(v);
const nonEmptyString = v => typeof v === 'string' && v !== '';
// sprintId: string numérica CANÔNICA positiva ('200'); '0', '007', '2.0', 'abc', 200 → não.
export const isCanonicalSprintId = v => typeof v === 'string' && /^[1-9]\d*$/.test(v);
// boardId: inteiro seguro POSITIVO. Objeto, array, booleano, string, 0, negativo, fração e NaN
// são recusados — a evidência de board é numérica no Jira.
export const isValidBoardId = v => typeof v === 'number' && Number.isSafeInteger(v) && v > 0;
const isCanonicalRevision = v => Number.isSafeInteger(v) && v >= 1;
// personId é opaco e prefixado — nunca um displayName.
const isPersonId = v => typeof v === 'string' && v.startsWith('person:') && v.length > 'person:'.length;

// ── CP10: ciclo de vida da participação, na MESMA régua do servidor ─────────────────────────
// `archived`/`archivedAt`/`restoredAt` (arquivar e restaurar) e `explicitExclude` (não herdar por
// carry-forward deste período em diante). Devolve o CÓDIGO do problema ou `null`.
// ⚠️ `explicitInclude` e `explicitExclude` verdadeiros no mesmo registro é CONTRADIÇÃO: escolher
// um vencedor em silêncio esconderia a corrupção em vez de recusá-la.
const CARIMBO_CANONICO_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;
const ehCarimboCanonico = v => {
  if (typeof v !== 'string' || !CARIMBO_CANONICO_RE.test(v)) return false;
  const t = Date.parse(v);
  return Number.isFinite(t) && new Date(t).toISOString() === v;
};
function erroDeCicloDeVida(registro) {
  if (registro.explicitInclude !== undefined && typeof registro.explicitInclude !== 'boolean') {
    return 'identity.participation.explicitInclude:invalid';
  }
  if (registro.explicitExclude !== undefined && typeof registro.explicitExclude !== 'boolean') {
    return 'identity.participation.explicitExclude:invalid';
  }
  if (registro.explicitInclude === true && registro.explicitExclude === true) {
    return 'identity.participation.explicit:contradictory';
  }
  if (registro.archived !== undefined && typeof registro.archived !== 'boolean') {
    return 'identity.participation.archived:invalid';
  }
  if (registro.archivedAt !== undefined && !ehCarimboCanonico(registro.archivedAt)) {
    return 'identity.participation.archivedAt:invalid';
  }
  if (registro.restoredAt !== undefined && !ehCarimboCanonico(registro.restoredAt)) {
    return 'identity.participation.restoredAt:invalid';
  }
  if (registro.excludedAt !== undefined && !ehCarimboCanonico(registro.excludedAt)) {
    return 'identity.participation.excludedAt:invalid';
  }
  if (registro.archived === true && registro.archivedAt === undefined) {
    return 'identity.participation.archivedAt:invalid';
  }
  if (registro.explicitExclude === true && registro.excludedAt === undefined) {
    return 'identity.participation.excludedAt:invalid';
  }
  return null;
}

const MODELO_VAZIO = Object.freeze({
  scopes: Object.freeze({}),
  selectors: Object.freeze({}),
  periods: Object.freeze({}),
  participation: Object.freeze({}),
  slotScopes: Object.freeze({}),
  slotPersons: Object.freeze({})
});
const vazio = (status, errors = []) => ({ status, ...MODELO_VAZIO, errors });

// Revisão VIGENTE pela regra canônica: a única com `effectiveTo` nulo/ausente. Duas revisões
// abertas é ambiguidade e já foi recusada na validação — aqui nunca precisa "escolher".
export function activeSelectorRevision(lista) {
  if (!Array.isArray(lista)) return null;
  const abertas = lista.filter(
    s => isPlainObject(s) && (s.effectiveTo === undefined || s.effectiveTo === null)
  );
  return abertas.length === 1 ? abertas[0] : null;
}

function validarSelectors(seletores, escopos) {
  for (const [scopeId, lista] of Object.entries(seletores)) {
    if (!Array.isArray(lista)) return 'identity.selectors:not-array';
    if (!Object.prototype.hasOwnProperty.call(escopos, scopeId)) return 'identity.selectors.scope:unknown';
    const revisoes = [];
    let abertas = 0;
    for (const s of lista) {
      if (!isPlainObject(s) || !isCanonicalRevision(s.revision)) return 'identity.selectors.entry:invalid';
      if (s.effectiveTo !== undefined && s.effectiveTo !== null && !nonEmptyString(s.effectiveTo)) {
        return 'identity.selectors.entry:invalid';
      }
      if (s.boards !== undefined) {
        if (!Array.isArray(s.boards) || !s.boards.every(isValidBoardId)) {
          return 'identity.selectors.boards:invalid';
        }
        if (new Set(s.boards).size !== s.boards.length) return 'identity.selectors.boards:duplicated';
      }
      // `effectiveFrom` é obrigatório quando presente ser string não vazia; a revisão que ABRE a
      // vigência precisa dele (é o que dá ordem temporal às revisões).
      if (s.effectiveFrom !== undefined && !nonEmptyString(s.effectiveFrom)) {
        return 'identity.selectors.effectiveFrom:invalid';
      }
      if (s.effectiveTo === undefined || s.effectiveTo === null) abertas += 1;
      revisoes.push(s.revision);
    }
    if (new Set(revisoes).size !== revisoes.length) return 'identity.selectors.revision:duplicated';
    // Regra de revisão ativa INEQUÍVOCA: no máximo uma revisão aberta por escopo.
    if (abertas > 1) return 'identity.selectors.active:ambiguous';
  }
  return null;
}

function validarPeriods(periodos, escopos, seletores) {
  for (const [scopeId, mapa] of Object.entries(periodos)) {
    if (!isPlainObject(mapa)) return 'identity.periods:not-object';
    if (!Object.prototype.hasOwnProperty.call(escopos, scopeId)) return 'identity.periods.scope:unknown';
    const sprints = [];
    for (const [periodId, p] of Object.entries(mapa)) {
      if (isPlainObject(p) && PERIOD_KINDS_BLOQUEADOS.includes(p.kind)) {
        return 'identity.periods.kind:unsupported'; // recusa EXPLÍCITA (L16)
      }
      if (!isPlainObject(p) || p.kind !== PERIOD_KIND_SPRINT) return 'identity.periods.entry:invalid';
      if (!nonEmptyString(periodId) || p.periodId !== periodId) return 'identity.periods.periodId:incoherent';
      if (p.analysisScopeId !== scopeId) return 'identity.periods.scopeId:incoherent';
      if (!isCanonicalSprintId(p.sprintId)) return 'identity.periods.sprintId:invalid';
      if (!isCanonicalRevision(p.selectorRevision)) return 'identity.periods.selectorRevision:invalid';
      // Referência período → seletor NÃO pode ficar pendente.
      const lista = seletores[scopeId];
      if (!Array.isArray(lista) || !lista.some(s => s.revision === p.selectorRevision)) {
        return 'identity.periods.selectorRevision:unknown';
      }
      sprints.push(p.sprintId);
    }
    // Duplicidade DENTRO do mesmo escopo é erro; a mesma sprint em escopos DIFERENTES é válida.
    if (new Set(sprints).size !== sprints.length) return 'identity.periods.sprintId:duplicated';
  }
  return null;
}

function validarParticipation(participacao, escopos, periodos, people) {
  const temPeople = isPlainObject(people);
  // Participação NÃO VAZIA exige `identity.people` como objeto: sem o registro de pessoas não há
  // como verificar que o personId existe, e participação não verificável é fail-closed.
  const temParticipacao = Object.values(participacao).some(
    porPeriodo =>
      isPlainObject(porPeriodo) &&
      Object.values(porPeriodo).some(
        porPessoa => isPlainObject(porPessoa) && Object.keys(porPessoa).length > 0
      )
  );
  if (temParticipacao && !temPeople) return 'identity.participation.people:missing';
  for (const [scopeId, porPeriodo] of Object.entries(participacao)) {
    if (!isPlainObject(porPeriodo)) return 'identity.participation:not-object';
    if (!Object.prototype.hasOwnProperty.call(escopos, scopeId))
      return 'identity.participation.scope:unknown';
    for (const [periodId, porPessoa] of Object.entries(porPeriodo)) {
      if (!isPlainObject(porPessoa)) return 'identity.participation.period:not-object';
      const doEscopo = periodos[scopeId];
      if (!isPlainObject(doEscopo) || !Object.prototype.hasOwnProperty.call(doEscopo, periodId)) {
        return 'identity.participation.period:unknown';
      }
      for (const [personId, registro] of Object.entries(porPessoa)) {
        // A chave é SEMPRE um personId opaco — nunca um displayName.
        if (!isPersonId(personId)) return 'identity.participation.personId:invalid';
        if (temPeople && !Object.prototype.hasOwnProperty.call(people, personId)) {
          return 'identity.participation.personId:unknown';
        }
        if (!isPlainObject(registro)) return 'identity.participation.entry:invalid';
        // MESMA régua do servidor (`server/analysis-scope-domain.js#assertParticipationLifecycle`):
        // ler "qualquer coisa ≠ true" como false transformaria corrupção em decisão silenciosa.
        const cicloDeVida = erroDeCicloDeVida(registro);
        if (cicloDeVida !== null) return cicloDeVida;
      }
    }
  }
  return null;
}

// Índice slotId → analysisScopeId (ou null). Valida cada registro: objeto, tupla canônica, chave
// coerente com os componentes e escopo existente quando resolvido.
// Estados CONHECIDOS do registro de slot legado — string arbitrária é recusada.
const SLOT_STATUS_PENDING = 'pending';
const SLOT_STATUS_CONFIRMED = 'confirmed';
const SLOT_STATUSES = [SLOT_STATUS_PENDING, SLOT_STATUS_CONFIRMED];
const SLOT_SCOPE_UNRESOLVED = 'unresolved';
const SLOT_SCOPE_RESOLVED = 'resolved';
const SLOT_SCOPE_STATUSES = [SLOT_SCOPE_UNRESOLVED, SLOT_SCOPE_RESOLVED];

// Validação de UM registro de slot legado — MESMA régua e MESMOS códigos do servidor
// (`server/analysis-scope-domain.js`). Devolve o código estático ou `null`. NUNCA corrige nada:
// um binding "confirmado" que aponta para pessoa inexistente não é confirmado, é corrupção.
export function validarRegistroDeSlot(id, registro, escopos, people, temPeople = isPlainObject(people)) {
  if (!isPlainObject(registro)) return 'identity.bindings.legacy-slots.record:not-object';
  const canonico = slotIdCanonical(registro.slot);
  if (canonico === null) return 'identity.bindings.legacy-slots.slot:invalid';
  if (canonico !== id) return 'identity.bindings.legacy-slots.slotId:incoherent';

  const status = registro.status;
  if (!SLOT_STATUSES.includes(status)) return 'identity.bindings.legacy-slots.status:invalid';
  const scopeStatus = registro.scopeStatus;
  if (!SLOT_SCOPE_STATUSES.includes(scopeStatus))
    return 'identity.bindings.legacy-slots.scopeStatus:incoherent';

  // escopo ↔ scopeStatus: os dois andam juntos, nos DOIS sentidos.
  const escopo = registro.resolvedScopeId;
  const temEscopo = escopo !== undefined && escopo !== null;
  if (temEscopo) {
    if (!nonEmptyString(escopo) || !Object.prototype.hasOwnProperty.call(escopos, escopo)) {
      return 'identity.bindings.legacy-slots.resolvedScopeId:unknown';
    }
    if (scopeStatus !== SLOT_SCOPE_RESOLVED) return 'identity.bindings.legacy-slots.scopeStatus:incoherent';
  } else if (scopeStatus !== SLOT_SCOPE_UNRESOLVED) {
    // `resolved` sem `resolvedScopeId` é incoerente; sem escopo o estado previsto é `unresolved`.
    return 'identity.bindings.legacy-slots.scopeStatus:incoherent';
  }

  // pessoa ↔ status: personId não nulo TEM de existir em `people`; `confirmed` EXIGE personId.
  const personId = registro.personId;
  const temPerson = personId !== undefined && personId !== null;
  if (temPerson) {
    if (!isPersonId(personId)) return 'identity.bindings.legacy-slots.personId:invalid';
    // Sem `people` não há como verificar — e vínculo não verificável é fail-closed.
    if (!temPeople || !Object.prototype.hasOwnProperty.call(people, personId)) {
      return 'identity.bindings.legacy-slots.personId:unknown';
    }
  } else if (status === SLOT_STATUS_CONFIRMED) {
    return 'identity.bindings.legacy-slots.personId:missing';
  }
  return null;
}

function indexarSlots(bindings, escopos, people) {
  const vazioIdx = { index: {}, persons: {}, erro: null };
  if (bindings === undefined) return vazioIdx;
  if (!isPlainObject(bindings)) return { index: null, persons: null, erro: 'identity.bindings:not-object' };
  const slots = bindings['legacy-slots'];
  if (slots === undefined) return vazioIdx;
  if (!isPlainObject(slots)) {
    return { index: null, persons: null, erro: 'identity.bindings.legacy-slots:not-object' };
  }
  const index = {};
  const persons = {};
  const falha = erro => ({ index: null, persons: null, erro });
  const temPeople = isPlainObject(people);
  for (const [id, registro] of Object.entries(slots)) {
    const erro = validarRegistroDeSlot(id, registro, escopos, people, temPeople);
    if (erro) return falha(erro);
    index[id] = registro.resolvedScopeId ?? null;
    // O `personId` só vale como VÍNCULO com binding CONFIRMADO (é o que liga o slot legado a uma
    // pessoa canônica, já verificada em `people`). Pendente = sem vínculo, nunca por displayName.
    persons[id] = registro.status === SLOT_STATUS_CONFIRMED ? registro.personId : null;
  }
  return { index, persons, erro: null };
}

// Leitura FAIL-CLOSED do modelo. Nunca lança. Qualquer irregularidade descarta o modelo INTEIRO e
// o app segue no caminho legado por board (comportamento seguro conhecido).
//   status: 'absent' | 'supported' | 'unsupported' | 'invalid'
export function readScopeModel(envelope) {
  if (envelope === undefined || envelope === null) return vazio('absent');
  if (!isPlainObject(envelope)) return vazio('invalid', ['identity:not-object']);
  if (envelope.schemaVersion !== 2) return vazio('unsupported');

  const { scopes, selectors, periods, participation } = envelope;
  for (const [nome, valor] of [
    ['scopes', scopes],
    ['selectors', selectors],
    ['periods', periods],
    ['participation', participation]
  ]) {
    if (valor !== undefined && !isPlainObject(valor))
      return vazio('invalid', [`identity.${nome}:not-object`]);
  }
  if (scopes === undefined && periods === undefined) return vazio('absent'); // v2 sem escopo ainda

  const escopos = isPlainObject(scopes) ? scopes : {};
  const seletores = isPlainObject(selectors) ? selectors : {};
  const periodos = isPlainObject(periods) ? periods : {};
  const participacao = isPlainObject(participation) ? participation : {};

  for (const [scopeId, registro] of Object.entries(escopos)) {
    if (!nonEmptyString(scopeId) || !isPlainObject(registro)) {
      return vazio('invalid', ['identity.scopes.record:invalid']);
    }
    // A chave do mapa É a identidade do escopo.
    if (registro.analysisScopeId !== scopeId)
      return vazio('invalid', ['identity.scopes.analysisScopeId:incoherent']);
  }
  for (const validar of [
    () => validarSelectors(seletores, escopos),
    () => validarPeriods(periodos, escopos, seletores),
    () => validarParticipation(participacao, escopos, periodos, envelope.people)
  ]) {
    const erro = validar();
    if (erro) return vazio('invalid', [erro]);
  }
  const {
    index: slotScopes,
    persons: slotPersons,
    erro: erroSlots
  } = indexarSlots(envelope.bindings, escopos, envelope.people);
  if (erroSlots) return vazio('invalid', [erroSlots]);

  return {
    status: 'supported',
    scopes: escopos,
    selectors: seletores,
    periods: periodos,
    participation: participacao,
    slotScopes,
    slotPersons,
    errors: []
  };
}

// Períodos (array) de um escopo — o mapa vira lista para as varreduras.
export function periodsOfScope(model, scopeId) {
  const mapa = model?.periods?.[scopeId];
  return isPlainObject(mapa) ? Object.values(mapa) : [];
}

// ── SELEÇÃO DO ESCOPO: quem manda é a referência da squad ativa ─────────────────────────────
// Devolve SEMPRE um dos três modos, nunca lança:
//   { mode:'legacy' }                          → carry-forward por board, comportamento legado
//   { mode:'scoped', analysisScopeId, period } → aquele escopo, exclusivamente
//   { mode:'blocked', reason }                 → referência explícita que não resolve: fail-closed
export function resolveScopeSelection(model, { currentSprintId, analysisScopeId = null } = {}) {
  const sid = currentSprintId == null ? null : String(currentSprintId);
  // AUSENTE (null/undefined) ≠ MALFORMADA. A remoção legítima da referência produz "ausente"
  // (legado); uma propriedade PRESENTE com tipo/shape inválido — número, objeto, array, string
  // vazia ou contaminada por espaços — é `blocked` com razão estática, nunca legado.
  const referenciaAusente = analysisScopeId === null || analysisScopeId === undefined;
  if (!referenciaAusente) {
    const valida =
      typeof analysisScopeId === 'string' &&
      analysisScopeId !== '' &&
      analysisScopeId === analysisScopeId.trim();
    if (!valida) return { mode: SCOPE_MODE_BLOCKED, reason: 'invalid-scope-reference' };
  }
  const pedido = referenciaAusente ? null : analysisScopeId;

  if (pedido) {
    // Referência EXPLÍCITA: nunca cai no legado em silêncio.
    if (!model || model.status !== 'supported')
      return { mode: SCOPE_MODE_BLOCKED, reason: 'scope-model-unavailable' };
    if (!Object.prototype.hasOwnProperty.call(model.scopes, pedido)) {
      return { mode: SCOPE_MODE_BLOCKED, reason: 'unknown-scope' };
    }
    const period = periodsOfScope(model, pedido).find(p => p.sprintId === sid) || null;
    if (!period) return { mode: SCOPE_MODE_BLOCKED, reason: 'no-period-for-sprint' };
    // CP10 — LINHAGEM do período: ele mesmo e os anteriores do MESMO escopo, do mais recente para
    // o mais antigo. É ela que dá sentido a "excluir do carry-forward DESTE período em diante":
    // a decisão fica registrada no período em que foi tomada, e os períodos seguintes precisam
    // olhar para trás para encontrá-la. Sem isso, `explicitExclude` valeria só na sprint em que
    // foi clicado — e "em diante" seria falso.
    const lineage = periodsOfScope(model, pedido)
      .filter(p => Number(p.sprintId) <= Number(sid))
      .sort((a, b) => Number(b.sprintId) - Number(a.sprintId))
      .map(p => p.periodId);
    return { mode: SCOPE_MODE_SCOPED, analysisScopeId: pedido, period, lineage };
  }

  // SEM referência de squad → LEGADO, sempre. O escopo NUNCA é inferido a partir do documento:
  // é exatamente isso que preserva a equivalência do caminho legado (uma migração já feita no
  // documento não muda o comportamento de quem não referenciou escopo nenhum).
  return { mode: SCOPE_MODE_LEGACY };
}

// Consulta PURA: em qual escopo esta sprint tem período? Só responde quando é inequívoco (a mesma
// sprint em dois escopos devolve null). Não é seleção — quem seleciona é `resolveScopeSelection`.
export function scopeContextForSprint(model, sprintId) {
  const sid = sprintId == null ? null : String(sprintId);
  if (!model || model.status !== 'supported' || !nonEmptyString(sid)) return null;
  let achado = null;
  for (const scopeId of Object.keys(model.periods || {})) {
    const period = periodsOfScope(model, scopeId).find(p => p.sprintId === sid);
    if (!period) continue;
    if (achado) return null; // ambíguo: precisa da referência da squad
    achado = { analysisScopeId: scopeId, period };
  }
  return achado;
}

// Sprints ANTERIORES elegíveis ao carry-forward, da mais recente para a mais antiga. É a MESMA
// função que o roster e a herança campo a campo consomem, para nunca divergirem.
//   legacy  → exatamente `priorSprintIdsSameBoard(snap)`
//   scoped  → períodos do escopo ativo (interseção com a config, ordem decrescente: mesma régua)
//   blocked → [] (referência explícita que não resolve nunca herda de ninguém)
export function priorPeriodsSameScope(snap, model, selection) {
  const { currentSprintId, sprintsByid } = snap || {};
  const sel =
    selection || resolveScopeSelection(model, { currentSprintId, analysisScopeId: snap?.analysisScopeId });
  if (sel.mode === SCOPE_MODE_LEGACY) return priorSprintIdsSameBoard(snap);
  if (sel.mode === SCOPE_MODE_BLOCKED) return [];
  const doEscopo = new Set(periodsOfScope(model, sel.analysisScopeId).map(p => p.sprintId));
  return Object.keys(sprintsByid || {})
    .filter(id => Number(id) < Number(currentSprintId))
    .filter(id => doEscopo.has(String(id)))
    .sort((a, b) => Number(b) - Number(a));
}

// Escopo a que um slot legado pertence: `null` = ainda não resolvido (não é de ninguém).
export function scopeOfSlot(model, slot) {
  const id = slotIdCanonical(slot);
  if (id === null || !model?.slotScopes) return null;
  return model.slotScopes[id] ?? null;
}

// Um slot legado pode ser usado nesta seleção?
//   legacy  → SIM (comportamento conhecido; a equivalência vem da AUSÊNCIA de referência de squad)
//   blocked → NÃO
//   scoped  → só quando `resolvedScopeId === selection.analysisScopeId`. Slot NÃO RESOLVIDO é
//             FAIL-CLOSED: num escopo explícito, config sem dono não entra no roster nem fornece
//             capacity (não se usa "slot sem dono vale em todo escopo" para simular equivalência).
//
// Com PARTICIPAÇÃO registrada para o período selecionado, ela passa a controlar a pertinência: só
// entra o slot cujo binding CONFIRMADO aponta para um `personId` presente naquele mapa. Slot sem
// vínculo (personId pendente/ausente) é recusado — nunca se escolhe homônimo por displayName.
// Sem participação (estado normal durante a migração) vale só a regra de escopo acima.
export function slotBelongsToSelection(model, selection, slot) {
  if (!selection || selection.mode === SCOPE_MODE_LEGACY) return true;
  if (selection.mode === SCOPE_MODE_BLOCKED) return false;
  const id = slotIdCanonical(slot);
  if (id === null) return false;
  const escopo = model?.slotScopes?.[id] ?? null;
  if (escopo !== selection.analysisScopeId) return false;

  const personId = model?.slotPersons?.[id] ?? null;
  const doPeriodo = model?.participation?.[selection.analysisScopeId]?.[selection.period?.periodId];
  const temMapa = isPlainObject(doPeriodo) && Object.keys(doPeriodo).length > 0;

  // ── CP10: o CICLO DE VIDA decide, e decide ANTES da regra de presença ────────────────────
  // Sem isto, "arquivar" e "excluir do carry-forward" eram decorativos: a rota respondia
  // sucesso, o painel mostrava a marca, e a pessoa continuava no roster e fornecendo capacity.
  // A busca é pela LINHAGEM (este período e os anteriores do mesmo escopo, do mais recente ao
  // mais antigo) porque a decisão vale "deste período EM DIANTE": ela fica gravada no período em
  // que foi tomada e precisa ser encontrada olhando para trás.
  if (personId !== null) {
    const efetivo = effectiveParticipation(model, selection.analysisScopeId, selection.lineage, personId);
    if (efetivo && !participationIsActive(efetivo.registro)) return false;
  }

  if (!temMapa) return true;
  if (personId === null) return false; // sem vínculo confirmado → não verificável → fora
  return Object.prototype.hasOwnProperty.call(doPeriodo, personId);
}

// Um registro de participação está ATIVO? Arquivada ou excluída do carry-forward → NÃO.
// ⚠️ Positivo por AUSÊNCIA: só `true` explícito desativa. Um registro sem os campos (todo documento
// anterior ao CP10) segue ativo, e é isso que preserva o comportamento legado byte a byte.
export function participationIsActive(registro) {
  if (!isPlainObject(registro)) return false;
  return registro.archived !== true && registro.explicitExclude !== true;
}

// Provider da atividade observada. A discrepância compara com o que o JIRA SERVER reportou; key de
// outro provider não descreve quem trabalhou nesta sprint.
const PROVIDER_ATIVIDADE = 'jira-server';

// ── CP10: discrepância EXCLUÍDA-MAS-ATIVA ───────────────────────────────────────────────────
// Uma pessoa arquivada ou excluída do carry-forward pode ter atividade REAL no Jira na sprint
// selecionada — ela aparece em `derived.assignees`, que é verdade do Jira e nunca é filtrada.
//
// ⚠️ A atividade vence, e isso está certo: o JiraDash não esconde trabalho que existe. Mas a
// discrepância NÃO pode passar em silêncio — a exclusão pareceria plenamente efetiva enquanto a
// pessoa continua entregando, e ninguém reveria a decisão. Esta função a torna visível.
//
// É uma OBSERVAÇÃO de sessão, derivada do Jira: não é persistida no documento. Persistir exigiria
// escrita a cada carga (com as capabilities desligadas, inclusive) e gravaria no documento
// compartilhado um fato que vale só para a squad e o JQL daquele navegador.
// ⚠️ A associação é por PROVENIÊNCIA DIRETA — a key observada naquela linha do dataset —, nunca
// por igualdade de `displayName`. Um mapa nome → personId escolhe o ÚLTIMO homônimo em silêncio e
// pode atribuir a atividade de uma pessoa à decisão de outra: o aviso apontaria para quem não fez
// nada, e a exclusão de quem realmente está entregando passaria batida.
//
// Quando a proveniência não resolve mas existe alguém INATIVO com aquele nome, o caso vira AVISO
// AGREGADO (`ambiguos`): sabemos que pode haver contradição, e deliberadamente NÃO dizemos de quem.
//
// `atividade` é uma lista de `{ nome, key }` — a key vem do objeto Jira observado na linha.
export function excludedButActive(model, selection, atividade, envelope) {
  const vazio = { pessoas: [], ambiguos: 0 };
  if (!selection || selection.mode !== SCOPE_MODE_SCOPED) return vazio;
  const people = isPlainObject(envelope?.people) ? envelope.people : {};

  // Índice por key DO PROVIDER `jira-server`, e contagem por NOME — esta só serve para detectar
  // ambiguidade, nunca para escolher.
  //
  // ⚠️ A unicidade do CP3 é `(provider, key)`, não `key`. Indexar percorrendo TODOS os providers
  // colapsaria duas identidades distintas que compartilhassem a mesma string de key, e o último
  // provider iterado venceria — de novo o erro de decidir identidade por coincidência textual. A
  // atividade que chega aqui vem do Jira Server, então o índice é EXCLUSIVAMENTE dele: a key de
  // outro provider não descreve quem trabalhou nesta sprint.
  const porKey = new Map();
  const inativosPorNome = new Map();
  const inativo = personId => {
    const efetivo = effectiveParticipation(model, selection.analysisScopeId, selection.lineage, personId);
    return efetivo && !participationIsActive(efetivo.registro) ? efetivo : null;
  };
  for (const [personId, pessoa] of Object.entries(people)) {
    if (!isPlainObject(pessoa)) continue;
    const ext = isPlainObject(pessoa.externalIdentities) ? pessoa.externalIdentities : {};
    const ref = ext[PROVIDER_ATIVIDADE];
    if (isPlainObject(ref) && typeof ref.key === 'string' && ref.key !== '') porKey.set(ref.key, personId);
    const registro = pessoa.displayName;
    if (isPlainObject(registro) && typeof registro.value === 'string' && registro.value !== '') {
      const lista = inativosPorNome.get(registro.value) || [];
      lista.push(personId);
      inativosPorNome.set(registro.value, lista);
    }
  }

  const pessoas = [];
  let ambiguos = 0;
  for (const linha of atividade || []) {
    const nome = typeof linha === 'string' ? linha : linha?.nome;
    const key = typeof linha === 'string' ? null : (linha?.key ?? null);
    const personId = key !== null ? porKey.get(key) : undefined;
    if (personId !== undefined) {
      const efetivo = inativo(personId);
      if (!efetivo) continue;
      pessoas.push({
        personId,
        periodId: efetivo.periodId,
        motivo: efetivo.registro.archived === true ? 'archived' : 'excluded-from-carry-forward'
      });
      continue;
    }
    // Sem proveniência utilizável: só vira aviso se houver ALGUÉM inativo com aquele nome — do
    // contrário não há contradição nenhuma a relatar, e avisar seria ruído.
    const candidatos = (inativosPorNome.get(nome) || []).filter(pid => inativo(pid) !== null);
    if (candidatos.length > 0) ambiguos += 1;
  }
  return { pessoas, ambiguos };
}

// Registro EFETIVO de uma pessoa ao longo de uma LINHAGEM de períodos (mais recente primeiro): o
// primeiro que existir. `null` quando ela nunca teve registro nenhum — que é o estado normal
// durante a migração e NÃO significa "excluída".
export function effectiveParticipation(model, scopeId, lineage, personId) {
  if (!Array.isArray(lineage)) return null;
  for (const periodId of lineage) {
    const registro = participationFor(model, scopeId, periodId, personId);
    if (registro) return { periodId, registro };
  }
  return null;
}

// Revisão vigente de um escopo (regra canônica: a única aberta).
export function activeSelector(model, scopeId) {
  return activeSelectorRevision(model?.selectors?.[scopeId]);
}

// Revisão EXATA que produziu um período — preservada mesmo depois de o seletor ser trocado.
export function selectorOfPeriod(model, scopeId, period) {
  const lista = model?.selectors?.[scopeId];
  if (!Array.isArray(lista) || !isPlainObject(period)) return null;
  return lista.find(s => s.revision === period.selectorRevision) || null;
}

// Participação de uma pessoa num período. SÓ LEITURA (inclusão/reconciliação são CP8) e SEMPRE
// por `personId` — displayName nunca é chave.
export function participationFor(model, scopeId, periodId, personId) {
  const porPeriodo = model?.participation?.[scopeId];
  if (!isPlainObject(porPeriodo)) return null;
  const porPessoa = porPeriodo[periodId];
  if (!isPlainObject(porPessoa)) return null;
  const registro = porPessoa[personId];
  return isPlainObject(registro) ? registro : null;
}
