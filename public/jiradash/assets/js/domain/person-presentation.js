// Modelo de APRESENTAÇÃO de identidade — CP6 da épica "identidade e roster v2" (#7).
//
// Fronteira PEQUENA e PURA: separa identidade · apresentação · status · participação da
// configuração LEGADA (chaveada por displayName, que NÃO muda neste checkpoint). Nada aqui toca
// DOM, storage, fetch, `state` ou relógio — a avaliação do módulo é inerte. O gerador de handle é
// INJETADO (contador/PRNG) para ser testável e determinístico.
//
// Contrato dos handles de sessão (§CP6):
//   - OPACO: nunca derivado de key, username, displayName ou do marcador `[X]`;
//   - nunca persistido nem exportado (só vive no DOM/memória da sessão);
//   - `handleForKey`: mesma key EXATA → MESMO handle; keys distintas → handles distintos;
//   - `handleForProvisional`: um handle novo a cada chamada (observação sem key não é unida);
//   - estável durante o dataset; descartado quando o dataset é reconstruído (nova instância).
//
// ⚠️ LIMITAÇÃO DESTE CHECKPOINT — homônimos NÃO ganham linha nem handle próprios. O pipeline legado
// continua agregando métricas por `displayName`: duas pessoas com o MESMO nome compartilham um
// bucket (é o que preserva a equivalência das métricas). A proveniência detecta as múltiplas keys,
// marca o bucket como AMBÍGUO, mostra `？ Status desconhecido` e impede a escolha de identidade, de
// `externalRef` e a escrita v2 automática — mas não separa as pessoas. Separar métricas e linhas por
// `personId` fica para uma etapa posterior.
//
// O TOKEN do DOM é SEMPRE um handle OPACO de sessão — nunca o `personId`, que é identificador
// PERSISTENTE. Ele resolve, SÓ em memória, para uma INTENÇÃO de escrita validada
// `{ displayName, slot, personId, externalRef }` — nunca só um displayName. A `externalRef` (a key
// do Jira Server) vive APENAS nessa estrutura de sessão; jamais em atributo DOM, HTML, log, erro,
// export ou storage. O cliente NUNCA cria `personId`: ele só vem de um binding CONFIRMADO do
// envelope (CP4/CP5); sem envelope, versão desconhecida, ou ambiguidade → FAIL-CLOSED (sem
// personId, sem escolher pessoa em silêncio) e a UI segue com handle opaco + comportamento legado.

import { observeJiraUser } from './person-identity.js';

export const STATUS_ACTIVE = 'active';
export const STATUS_INACTIVE = 'inactive';
export const STATUS_UNKNOWN = 'unknown';

// Texto ACESSÍVEL dos três estados (compreensível sem depender de cor) e um glifo textual.
export const STATUS_LABEL = {
  [STATUS_ACTIVE]: 'Ativo',
  [STATUS_INACTIVE]: 'Inativo no Jira',
  [STATUS_UNKNOWN]: 'Status desconhecido'
};
export const STATUS_GLYPH = {
  [STATUS_ACTIVE]: '●',
  [STATUS_INACTIVE]: '○',
  [STATUS_UNKNOWN]: '？'
};

// Sentinela interna de ambiguidade — nunca escapa do módulo.
const AMBIGUOUS = Symbol('ambiguous');

// Remove o sufixo TERMINAL de status `[X]` do displayName — SÓ apresentação. Não altera a chave de
// configuração (que continua sendo o displayName cru, com `[X]`). Só o marcador terminal, com os
// espaços ao redor, sai; um `[X]` no meio do nome permanece. Se a remoção esvaziaria o texto,
// devolve o nome original aparado (nunca vazio).
export function stripStatusMarker(displayName) {
  if (typeof displayName !== 'string') return '';
  const semMarca = displayName.replace(/\s*\[[Xx]\]\s*$/, '').trim();
  return semMarca || displayName.trim();
}

// Status a partir do `active` OBSERVADO na sessão: true → ativo, false → inativo, ausente/null →
// desconhecido. `active` nunca é persistido nem reaproveitado de sessão anterior (isso é garantido
// por quem alimenta a observação, person-identity.js).
export function statusFromActive(active) {
  if (active === true) return STATUS_ACTIVE;
  if (active === false) return STATUS_INACTIVE;
  return STATUS_UNKNOWN;
}

// Codec CANÔNICO do slot legado — IDÊNTICO a `server/slot-codec.js`: tupla em ordem fixa e
// `slotId = base64url(JSON.stringify(tupla))`, reversível e imune à colisão por '|'/concatenação.
// Reproduzido aqui (não uma concatenação com separador) porque o módulo do servidor é CommonJS e
// este roda no browser; os casos adversariais fixados no servidor valem igual.
export function slotTupleCanonical(slot) {
  if (!slot || typeof slot !== 'object') return null;
  if (slot.kind === 'global') {
    return typeof slot.displayName === 'string' ? ['global', slot.displayName] : null;
  }
  if (slot.kind === 'sprint') {
    return typeof slot.sprintId === 'string' && typeof slot.displayName === 'string'
      ? ['sprint', slot.sprintId, slot.displayName]
      : null;
  }
  return null;
}
function base64urlUtf8(str) {
  const bytes = new TextEncoder().encode(str); // UTF-8, como o Buffer do servidor
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
export function slotIdCanonical(slot) {
  const tuple = slotTupleCanonical(slot);
  return tuple === null ? null : base64urlUtf8(JSON.stringify(tuple));
}

// Índice slotId → personId a partir do envelope. FAIL-CLOSED e ESTRITO: um binding só conta como
// CONFIRMADO quando TUDO abaixo vale, senão é ignorado (nunca "corrigido" nem escolhido em
// silêncio):
//   - envelope objeto com `schemaVersion === 2` (versão desconhecida → nenhum personId);
//   - `bindings` e `bindings['legacy-slots']` com shape válido;
//   - a CHAVE do registro é exatamente `slotIdCanonical(record.slot)` (chave coerente);
//   - `record.slot` válido; `record.status === 'confirmed'`;
//   - `personId` string não-vazia E presente em `envelope.people`.
// Duas bindings do MESMO slot com personId divergente → ambíguo (nenhum personId).
function buildBindingIndex(envelope) {
  if (!envelope || typeof envelope !== 'object' || Array.isArray(envelope)) return null;
  if (envelope.schemaVersion !== 2) return null; // versão desconhecida → fail-closed
  const bindings = envelope.bindings;
  if (!bindings || typeof bindings !== 'object' || Array.isArray(bindings)) return null;
  const slots = bindings['legacy-slots'];
  if (!slots || typeof slots !== 'object' || Array.isArray(slots)) return null;
  const people = envelope.people;
  const peopleOk = people && typeof people === 'object' && !Array.isArray(people);
  const hasPerson = pid => peopleOk && Object.prototype.hasOwnProperty.call(people, pid);
  const index = new Map();
  for (const [key, rec] of Object.entries(slots)) {
    if (!rec || typeof rec !== 'object') continue;
    if (rec.status !== 'confirmed') continue; // pendente/qualquer outro → não confirmado
    const pid = rec.personId;
    if (typeof pid !== 'string' || pid === '') continue;
    const id = slotIdCanonical(rec.slot);
    if (id === null || id !== key) continue; // slot malformado ou chave incoerente com record.slot
    if (!hasPerson(pid)) continue; // personId inexistente em people
    if (index.has(id)) {
      if (index.get(id) !== pid) index.set(id, AMBIGUOUS);
    } else {
      index.set(id, pid);
    }
  }
  return index;
}

// ── PROVENIÊNCIA DE LINHA ────────────────────────────────────────────────────────────────────
// Igualdade de displayName NUNCA escolhe identidade. Status e `externalRef` só existem quando há
// ASSOCIAÇÃO DIRETA entre a linha e o objeto de usuário do Jira que a criou: a proveniência é
// registrada NO MOMENTO em que o bucket da pessoa nasce no pipeline (`buildDerived`), não por
// varredura do registro de sessão por nome.
//
// Consequências (todas fail-closed):
//   - linha vinda SÓ de config/carry-forward (slot legado, sem objeto Jira observado) →
//     `directFor` = null → status DESCONHECIDO e SEM `externalRef` (não habilita escrita v2);
//   - duas keys distintas criando o MESMO bucket (homônimos) → ambíguo → null: o bucket legado
//     continua agregado (métricas inalteradas), mas NENHUMA das identidades é escolhida — sem
//     status, sem `externalRef` e sem escrita v2 automática;
//   - observação sem key (provisória) misturada → ambíguo → null (não há vínculo utilizável).
// A key fica só nesta estrutura de sessão; nunca vai a DOM, export, storage ou log.
export function createRowProvenance() {
  const byName = new Map(); // displayName do bucket → { keys: Map<key, obs>, keyless: number }
  return {
    // Registra que ESTE objeto de usuário do Jira criou/alimentou o bucket deste displayName.
    observe(displayName, user) {
      if (typeof displayName !== 'string' || displayName === '') return null;
      const obs = observeJiraUser(user, null);
      if (!obs) return null;
      let rec = byName.get(displayName);
      if (!rec) {
        rec = { keys: new Map(), keyless: 0 };
        byName.set(displayName, rec);
      }
      const key = obs.externalRef ? obs.externalRef.value : null;
      if (key === null) rec.keyless += 1;
      else rec.keys.set(key, obs); // mesma key: última observação vence (igual ao registro CP2)
      return obs;
    },
    // Associação direta ou nada: exige UMA única key e nenhuma observação sem key.
    directFor(displayName) {
      const rec = byName.get(displayName);
      if (!rec || rec.keyless > 0 || rec.keys.size !== 1) return null;
      const [key, obs] = [...rec.keys.entries()][0];
      return { key, active: obs.active, username: obs.username, externalRef: safeExternalRef(obs) };
    }
  };
}

// externalRef seguro a partir de uma observação de sessão: só o vínculo Jira Server `key`. Fica
// SÓ em memória (na intenção de escrita); nunca vai a DOM/export/storage.
function safeExternalRef(observation) {
  const ref = observation && observation.externalRef;
  if (
    ref &&
    typeof ref === 'object' &&
    ref.provider === 'jira-server' &&
    ref.kind === 'key' &&
    typeof ref.value === 'string' &&
    ref.value !== ''
  ) {
    return { provider: 'jira-server', kind: 'key', value: ref.value };
  }
  return null;
}

// Registro de apresentação por DATASET. Nova instância = novo dataset (handles descartados). O
// gerador `nextHandle` é injetado: em produção um contador; em teste, um contador/PRNG controlado.
export function createPresentationRegistry({ nextHandle } = {}) {
  if (typeof nextHandle !== 'function') throw new Error('presentation.deps.nextHandle:missing');
  const handleByKey = new Map(); // key exata → handle (convergência)
  const handleBySlot = new Map(); // displayName → handle (slot sem key resolvida)
  const intentByToken = new Map(); // token → { displayName, slot, personId, externalRef } | AMBIGUOUS
  let idxEnvelope; // envelope memoizado para o índice de bindings
  let idx = null;

  const handleForKey = key => {
    let h = handleByKey.get(key);
    if (h === undefined) {
      h = nextHandle();
      handleByKey.set(key, h);
    }
    return h;
  };
  const handleForSlotName = displayName => {
    let h = handleBySlot.get(displayName);
    if (h === undefined) {
      h = nextHandle();
      handleBySlot.set(displayName, h);
    }
    return h;
  };
  const bindingIndex = envelope => {
    if (idxEnvelope !== envelope) {
      idxEnvelope = envelope;
      idx = buildBindingIndex(envelope);
    }
    return idx;
  };
  // Registra a intenção do token. Idempotente e robusto à ordem de render: para o MESMO displayName
  // enriquece (nunca faz downgrade de slot/personId/externalRef já conhecidos); displayName
  // divergente no mesmo token → AMBÍGUO (fail-closed na escrita).
  const registerIntent = (token, intent) => {
    const prev = intentByToken.get(token);
    if (prev === AMBIGUOUS) return;
    if (!prev) {
      intentByToken.set(token, intent);
      return;
    }
    if (prev.displayName !== intent.displayName) {
      intentByToken.set(token, AMBIGUOUS);
      return;
    }
    intentByToken.set(token, {
      displayName: prev.displayName,
      slot: prev.slot || intent.slot || null,
      personId: prev.personId || intent.personId || null,
      externalRef: prev.externalRef || intent.externalRef || null
    });
  };

  return {
    // Handle estável para uma key observada (assignee e autor de worklog da MESMA key convergem).
    handleForKey,
    // Handle DISTINTO a cada chamada — para observação provisória (sem key), que nunca é unida.
    handleForProvisional() {
      return nextHandle();
    },
    // personId de um slot legado, só de binding CONFIRMADO e coerente; null quando
    // pendente/ausente/versão desconhecida/ambíguo (fail-closed).
    personIdForSlot(slot, envelope) {
      const index = bindingIndex(envelope);
      if (!index) return null;
      const id = slotIdCanonical(slot);
      if (id === null) return null;
      const pid = index.get(id);
      return typeof pid === 'string' ? pid : null; // AMBIGUOUS (Symbol) → null
    },
    // Resolve um displayName (chave do roster/config) para apresentação. Status e `externalRef` só
    // saem de ASSOCIAÇÃO DIRETA (`provenance.directFor`) — igualdade de nome nunca escolhe
    // identidade nem habilita escrita. `slot` habilita a busca do personId no envelope. Devolve o
    // nome de apresentação sem `[X]`, o status e o username (SÓ memória, para desambiguar
    // homônimo). Registra a intenção de escrita — recuperável por `intentForToken`.
    //
    // ⚠️ O TOKEN É SEMPRE O HANDLE OPACO — inclusive quando o binding está CONFIRMADO. Antes o
    // token virava o próprio `personId` quando ele existia, e isso contradizia a garantia de
    // "token opaco e descartável": `personId` é um identificador PERSISTENTE (pseudonimizado, mas
    // estável entre sessões e entre navegadores), então publicá-lo em `data-*` o transformaria em
    // rastreador de longa duração no DOM. O `personId` continua existindo — só que apenas dentro
    // do mapa token → intenção, em memória, que é de onde a escrita o lê.
    resolve(displayName, { slot = null, provenance = null, envelope = null } = {}) {
      const presentationName = stripStatusMarker(displayName);
      const direct = provenance ? provenance.directFor(displayName) : null;
      const status = direct ? statusFromActive(direct.active) : STATUS_UNKNOWN;
      const username = direct ? direct.username : null;
      const externalRef = direct ? direct.externalRef : null; // só memória
      const personId = slot ? this.personIdForSlot(slot, envelope) : null;
      const handle = direct && direct.key ? handleForKey(direct.key) : handleForSlotName(displayName);
      const token = handle;
      registerIntent(token, { displayName, slot: slot || null, personId: personId ?? null, externalRef });
      return { token, personId: personId ?? null, handle, displayName, presentationName, status, username };
    },
    // Round-trip da escrita: token do DOM → INTENÇÃO validada em memória
    // `{ displayName, slot, personId, externalRef }`. null quando o token é desconhecido (obsoleto)
    // ou ambíguo → o chamador FALHA de forma visível, nunca grava na pessoa errada nem usa
    // displayName cru como identidade.
    intentForToken(token) {
      const v = intentByToken.get(token);
      return v && v !== AMBIGUOUS ? v : null;
    },
    // Conveniência: só o displayName do slot legado (fail-closed igual a intentForToken).
    slotNameOf(token) {
      const intent = this.intentForToken(token);
      return intent ? intent.displayName : null;
    }
  };
}
