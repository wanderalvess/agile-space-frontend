// Adaptador da configuração compartilhada (/config): estado, destrave e escrita por campo.
//
// ⚠️ `this` é o próprio objeto e o código depende disso: três dos quatro getters (`isShared`,
// `isLocal`, `unlocked`) e os OITO métodos passam por `this`. O getter e o setter de `editCode`
// vão direto ao `sessionStorage`, mas são alcançados por `this.editCode` de dentro de
// `unlocked`, `verify`, `pushField` e `seedFromLocal`. Não desmembre esses membros, não faça
// destructuring deles e não os passe soltos como callback.
//
// `fetch`, `sessionStorage` e `localStorage` são efeitos de CHAMADA: a avaliação deste
// módulo é inerte — não dispara request, não lê nem escreve storage e não toca o DOM.
import { readIdentityEnvelope } from '../domain/person-schema.js';
import { readScopeModel } from '../domain/analysis-scope.js';
import { storage } from './storage.js';

// Chave do espelho do envelope de identidade — SEPARADA das duas chaves v1
// (`sprint-configs-by-sprint`, `sprint-config`). O envelope nunca é misturado à v1.
const IDENTITY_MIRROR_KEY = 'jiradash-identity-mirror';

const ehObjeto = v => typeof v === 'object' && v !== null && !Array.isArray(v);

// ── Projeção ALLOWLIST E TIPADA do envelope para o espelho local ────────────────────────────
//
// ⚠️ Não é uma cópia com remoções, e também não basta filtrar NOMES de campo: cada FOLHA copiada
// é validada por TIPO. Filtrar só o nome deixava passar dado pessoal escondido dentro de um campo
// permitido — `displayName.value = { key: 'K' }` ou `origins: [{ key: 'K' }]` chegariam ao
// `localStorage` intactos, porque o leitor do envelope é deliberadamente raso e continua
// classificando o documento como `supported`.
//
// Regra final, sem exceção: campo fora da allowlist NÃO é copiado; folha permitida com tipo
// errado — composta, array com elemento não escalar, número onde se espera string — faz a
// projeção INTEIRA devolver `null`, e quem chama REMOVE o espelho.
//
// Campo desconhecido continua intacto no SERVIDOR e na MEMÓRIA: a projeção vale só para o
// `localStorage`.
const eString = v => typeof v === 'string';
const eStringOuNulo = v => v === null || typeof v === 'string';
const eNulo = v => v === null;
const eInteiro = v => Number.isSafeInteger(v);
const eBoardId = v => Number.isSafeInteger(v) && v > 0;
const eBooleano = v => typeof v === 'boolean';
const eArrayDe = valido => v => Array.isArray(v) && v.every(valido);

// Régua da CONFIG — a MESMA da v1 (`domain/person-config.js` no front, `proxy.js` no servidor):
// campo fora da lista não é copiado, e valor fora do intervalo aborta a projeção.
const eInteiroEntre = (min, max) => v =>
  typeof v === 'number' && Number.isFinite(v) && Number.isInteger(v) && v >= min && v <= max;
const CONFIG_REGRAS = {
  papel: v => typeof v === 'string' && ['', 'DEV', 'QA'].includes(v),
  diasCodificacaoTeste: eInteiroEntre(0, 31),
  diasRegressivo: eInteiroEntre(0, 31),
  diasSprint: eInteiroEntre(0, 31),
  // Fracionária com até DUAS casas — a mesma régua do front e do servidor. O espelho não pode ser
  // mais estreito que a rota: um `5.12` aceito pelo servidor e recusado aqui sumiria do espelho
  // tipado, e a tela mostraria configuração diferente da persistida.
  // A folga de 1e-9 é IEEE-754: `5.12 * 100` é 511.9999999999999, e `5.123` continua fora.
  horasProdutivas: v =>
    typeof v === 'number' &&
    Number.isFinite(v) &&
    v >= 0 &&
    v <= 24 &&
    Math.abs(v * 100 - Math.round(v * 100)) < 1e-9
};

// Copia só os campos da especificação, validando o TIPO de cada um. `null` = folha inválida.
function folhas(valor, spec) {
  if (!ehObjeto(valor)) return null;
  const out = {};
  for (const [campo, valido] of Object.entries(spec)) {
    const v = valor[campo];
    if (v === undefined) continue;
    if (!valido(v)) return null;
    out[campo] = v;
  }
  return out;
}
// Mapa de objetos: aplica `projetar` a cada valor; qualquer valor fora do contrato aborta (null).
const mapaProjetado = (valor, projetar) => {
  if (valor === undefined) return undefined;
  if (!ehObjeto(valor)) return null;
  const out = {};
  for (const [k, v] of Object.entries(valor)) {
    if (!eString(k)) return null;
    const p = projetar(v);
    if (p === null) return null;
    out[k] = p;
  }
  return out;
};
// Atribui `out[campo]` a partir de um sub-mapa opcional, propagando a falha.
const atribuir = (out, campo, projetado) => {
  if (projetado === null) return false;
  if (projetado !== undefined) out[campo] = projetado;
  return true;
};

const AUDITORIA = { confirmationMethod: eString, actor: eNulo, confirmedAt: eString };

export function envelopeSemChaves(identity) {
  if (!ehObjeto(identity)) return null;
  if (!eInteiro(identity.schemaVersion)) return null;
  const out = { schemaVersion: identity.schemaVersion };

  if (identity.migration !== undefined) {
    const m = folhas(identity.migration, {
      state: eString,
      fromSchemaVersion: eInteiro,
      startedAt: eString,
      autoMigrated: eInteiro
    });
    if (m === null) return null;
    out.migration = m;
  }

  const people = mapaProjetado(identity.people, pessoa => {
    if (!ehObjeto(pessoa)) return null;
    const p = folhas(pessoa, { personId: eString });
    if (p === null) return null;
    if (pessoa.displayName !== undefined) {
      if (pessoa.displayName === null) p.displayName = null;
      else {
        // ⚠️ `value` é uma STRING. Um objeto aqui é dado pessoal escondido numa folha permitida.
        const dn = folhas(pessoa.displayName, {
          value: eString,
          observedAt: eString,
          purpose: eString,
          reviewAfter: eString
        });
        if (dn === null) return null;
        p.displayName = dn;
      }
    }
    const ext = mapaProjetado(pessoa.externalIdentities, ref => {
      // A KEY nunca é copiada — só a PRESENÇA do vínculo, que basta para diagnóstico.
      const r = folhas(ref, {
        observedAt: eString,
        status: eString,
        purpose: eString,
        reviewAfter: eString,
        keyRedacted: eBooleano
      });
      if (r === null) return null;
      if (ref.key !== undefined) r.keyRedacted = true;
      return r;
    });
    if (!atribuir(p, 'externalIdentities', ext)) return null;
    return p;
  });
  if (!atribuir(out, 'people', people)) return null;

  if (identity.bindings !== undefined) {
    if (!ehObjeto(identity.bindings)) return null;
    const slots = mapaProjetado(identity.bindings['legacy-slots'], reg => {
      const r = folhas(reg, {
        resolvedScopeId: eStringOuNulo,
        scopeStatus: eString,
        personId: eStringOuNulo,
        status: eString,
        confirmedAt: eString,
        confirmationMethod: eString,
        actor: eNulo
      });
      if (r === null) return null;
      if (reg.slot !== undefined) {
        const s = folhas(reg.slot, { kind: eString, sprintId: eString, displayName: eString });
        if (s === null) return null;
        r.slot = s;
      }
      if (reg.config !== undefined) {
        const cfg = folhas(reg.config, CONFIG_REGRAS);
        if (cfg === null) return null;
        r.config = cfg;
      }
      return r;
    });
    if (slots === null) return null;
    out.bindings = {};
    if (slots !== undefined) out.bindings['legacy-slots'] = slots;
  }

  const escopos = mapaProjetado(identity.scopes, s => {
    const r = folhas(s, { analysisScopeId: eString, createdAt: eString });
    if (r === null) return null;
    if (s.createdFrom !== undefined) {
      const cf = folhas(s.createdFrom, { kind: eString, boardId: eBoardId, ...AUDITORIA });
      if (cf === null) return null;
      r.createdFrom = cf;
    }
    return r;
  });
  if (!atribuir(out, 'scopes', escopos)) return null;

  const seletores = mapaProjetado(identity.selectors, lista => {
    if (!Array.isArray(lista)) return null;
    const proj = [];
    for (const s of lista) {
      const r = folhas(s, {
        revision: eInteiro,
        boards: eArrayDe(eBoardId),
        effectiveFrom: eString,
        effectiveTo: eStringOuNulo
      });
      if (r === null) return null;
      proj.push(r);
    }
    return proj;
  });
  if (!atribuir(out, 'selectors', seletores)) return null;

  const periodos = mapaProjetado(identity.periods, mapa =>
    mapaProjetado(mapa, p => {
      const r = folhas(p, {
        periodId: eString,
        analysisScopeId: eString,
        kind: eString,
        sprintId: eString,
        selectorRevision: eInteiro,
        resolvedAt: eString
      });
      if (r === null) return null;
      if (p.evidence !== undefined) {
        const e = folhas(p.evidence, {
          kind: eString,
          boardId: eBoardId,
          observedAt: eString,
          ...AUDITORIA
        });
        if (e === null) return null;
        r.evidence = e;
      }
      return r;
    })
  );
  if (!atribuir(out, 'periods', periodos)) return null;

  const participacao = mapaProjetado(identity.participation, porPeriodo =>
    mapaProjetado(porPeriodo, porPessoa =>
      // ⚠️ `origins` é lista de CÓDIGOS estáticos — só strings. Um objeto dentro dela seria dado
      // pessoal escondido num campo permitido.
      mapaProjetado(porPessoa, reg =>
        folhas(reg, {
          origins: eArrayDe(eString),
          explicitInclude: eBooleano,
          // CP10 — ciclo de vida. Todas FOLHAS simples: booleano ou carimbo. Um objeto em qualquer
          // uma delas seria dado pessoal escondido num campo permitido, e a projeção some inteira.
          explicitExclude: eBooleano,
          archived: eBooleano,
          archivedAt: eString,
          restoredAt: eString,
          excludedAt: eString
        })
      )
    )
  );
  if (!atribuir(out, 'participation', participacao)) return null;

  // CP10 — configuração CANÔNICA. Não é dado pessoal: as chaves são `analysisScopeId`,
  // `periodId`, `sprintId` e `personId` (todos opacos ou numéricos) e as folhas são a régua de
  // configuração. É o que permite ao cliente administrar quem foi redigido.
  if (identity.config !== undefined) {
    if (!ehObjeto(identity.config)) return null;
    const out2 = {};
    const escopada = mapaProjetado(identity.config.scoped, porPeriodo =>
      mapaProjetado(porPeriodo, porPessoa => mapaProjetado(porPessoa, c => folhas(c, CONFIG_REGRAS)))
    );
    if (!atribuir(out2, 'scoped', escopada)) return null;
    const naoResolvida = mapaProjetado(identity.config.unresolvedSprints, porPessoa =>
      mapaProjetado(porPessoa, c => folhas(c, CONFIG_REGRAS))
    );
    if (!atribuir(out2, 'unresolvedSprints', naoResolvida)) return null;
    const global = mapaProjetado(identity.config.global, c => folhas(c, CONFIG_REGRAS));
    if (!atribuir(out2, 'global', global)) return null;
    out.config = out2;
  }

  const separacoes = mapaProjetado(identity.separations, porCandidato =>
    mapaProjetado(porCandidato, reg =>
      folhas(reg, { decision: eString, decidedAt: eString, confirmationMethod: eString, actor: eNulo })
    )
  );
  if (!atribuir(out, 'separations', separacoes)) return null;

  if (identity.conflicts !== undefined) {
    if (!Array.isArray(identity.conflicts)) return null;
    const lista = [];
    for (const c of identity.conflicts) {
      const r = folhas(c, {
        id: eString,
        kind: eString,
        slotDigest: eString,
        hmacKeyVersion: eString,
        attemptedPersonId: eStringOuNulo,
        attemptedKeyDigest: eStringOuNulo,
        occupiedBy: eStringOuNulo,
        detectedAt: eString,
        missingSprintIds: eArrayDe(eString)
      });
      if (r === null) return null;
      if (c.resolution !== undefined) {
        if (c.resolution === null) r.resolution = null;
        else {
          const res = folhas(c.resolution, { kind: eString, resolvedAt: eString, ...AUDITORIA });
          if (res === null) return null;
          r.resolution = res;
        }
      }
      lista.push(r);
    }
    out.conflicts = lista;
  }

  const redacoes = mapaProjetado(identity.redactions, rec => {
    if (!ehObjeto(rec)) return null;
    const r = {};
    for (const [campo, spec] of [
      ['blockedExternalIdentities', { digest: eString, provider: eString, hmacKeyVersion: eString }],
      ['blockedLegacySlots', { digest: eString, hmacKeyVersion: eString }]
    ]) {
      if (rec[campo] === undefined) continue;
      if (!Array.isArray(rec[campo])) return null;
      const bloco = [];
      for (const b of rec[campo]) {
        const p = folhas(b, spec);
        if (p === null) return null;
        bloco.push(p);
      }
      r[campo] = bloco;
    }
    return r;
  });
  if (!atribuir(out, 'redactions', redacoes)) return null;

  return out;
}

// Configuração compartilhada — servida pelo proxy (/config) e igual pra todo mundo.
// O servidor é a fonte da verdade; o localStorage vira ESPELHO local: load() grava o
// doc do servidor nas mesmas chaves que personConfig.snapshot() já lê, então todo o
// resto do app continua síncrono e intacto. Se o proxy for antigo/offline (GET /config
// falha), available=false e o app se comporta como antes (config local por browser).
// Edição exige o código (CONFIG_EDIT_CODE no proxy): destrava via /config/verify-code,
// e cada campo salvo vai por /config/set (merge por campo no servidor — dois editores
// simultâneos não se sobrescrevem).
export const sharedConfig = {
  available: false, // GET /config respondeu?
  editable: false, // servidor tem CONFIG_EDIT_CODE configurado?
  doc: null, // último doc visto do servidor
  // Modo declarado pelo SERVIDOR (campo configMode do /config):
  //   'shared'  → config compartilhada; servidor é a fonte da verdade;
  //   'local'   → o proxy roda em máquina de desenvolvimento e não guarda config
  //               nenhuma; o localStorage é a fonte e ninguém mais é afetado;
  //   'offline' → GET /config falhou; cai no fallback local de sempre.
  // Não se adivinha isso por location.hostname: localhost, IP, reverse proxy e
  // acesso de outra máquina quebram a heurística. Quem sabe é o servidor.
  mode: 'offline',
  // CP1 — leitura TOLERANTE do envelope de identidade (schema v2), em memória.
  // identityStatus: 'absent' | 'supported' | 'unsupported' | 'invalid' (domain/person-schema.js).
  // CP4 — o envelope é ESPELHADO numa chave SEPARADA do localStorage (`jiradash-identity-mirror`,
  // constante IDENTITY_MIRROR_KEY), NUNCA misturado às duas chaves v1. Isso segue o plano
  // aprovado ("o espelho local preserva o envelope; a v1 continua nas duas chaves atuais").
  // O envelope é espelhado OPACO — inclusive versão desconhecida/ inválida —, sem
  // reinterpretação: quem valida é o leitor (domain/person-schema.js). Nada disso muda o fluxo
  // v1; o consumo do envelope pelos checkpoints seguintes é outro passo.
  identityStatus: 'absent',
  identityEnvelope: null,
  identitySchemaVersion: null,
  identityErrors: [],
  // CP7 — modelo de ESCOPO ANALÍTICO lido do MESMO envelope, só em memória. Publicado junto com
  // `identityEnvelope` (em applyIdentity) para que roster e herança leiam sempre o mesmo estado.
  // Ausente/inválido → status 'absent'/'invalid' e o app segue no caminho legado por board.
  scopeModel: null,
  // CP4 — capacidades declaradas pelo servidor no GET /config (estado do servidor, não do
  // documento). Espelho SÓ em memória. Enquanto `identityWrites` for false, nenhuma rota de
  // escrita por identidade é usada; o fluxo v1 segue idêntico. Ausência do campo (proxy
  // antigo) = tudo desligado, fail-closed.
  capabilities: {
    identityV2: false,
    dualProjection: false,
    identityWrites: false,
    identityReconciliation: false,
    identityRosterPicker: false,
    identityLifecycle: false,
    identityRedaction: false,
    identityRetentionSweep: false
  },
  get identityWritesEnabled() {
    return this.isShared && this.available && this.capabilities.identityWrites === true;
  },
  // CP8 — capability PRÓPRIA da reconciliação. NUNCA sinônimo de `identityWrites`: o painel de
  // reconciliação pode existir com a escrita normal por identidade desligada, e o inverso também
  // vale. Fail-closed: proxy antigo (sem o campo) mantém tudo desligado.
  get identityReconciliationEnabled() {
    return this.isShared && this.available && this.capabilities.identityReconciliation === true;
  },
  // CP9 — capability PRÓPRIA do picker/inclusão manual. INDEPENDENTE de `identityWrites`,
  // `dualProjection` e `identityReconciliation`: nenhuma delas liga ou desliga esta. Fail-closed —
  // proxy antigo (sem o campo) mantém desligado, e o navegador não faz `/user/search` com ela false.
  get identityRosterPickerEnabled() {
    return this.isShared && this.available && this.capabilities.identityRosterPicker === true;
  },
  // CP10 — capability PRÓPRIA do ciclo de vida (arquivar/restaurar/excluir do carry-forward).
  // INDEPENDENTE de todas as anteriores; fail-closed. Com ela false o cliente não renderiza os
  // controles nem chama a rota.
  get identityLifecycleEnabled() {
    return this.isShared && this.available && this.capabilities.identityLifecycle === true;
  },
  // ⚠️ A REDAÇÃO não ganha atalho de UI neste checkpoint: ela é irreversível e a decisão é
  // administrativa. A capability existe no servidor, a rota existe, mas o cliente não a dispara.
  get isShared() {
    return this.mode === 'shared';
  },
  get isLocal() {
    return this.mode === 'local';
  },
  get editCode() {
    return sessionStorage.getItem('config-edit-code') || '';
  },
  set editCode(v) {
    if (v) sessionStorage.setItem('config-edit-code', v);
    else sessionStorage.removeItem('config-edit-code');
  },
  get unlocked() {
    return this.isShared && this.available && this.editable && !!this.editCode;
  },
  // Espelha o doc do servidor no localStorage — as duas chaves v1 (mesmas do snapshot()) e,
  // em chave SEPARADA, o envelope de identidade (CP4). As chaves v1 nunca recebem o envelope.
  // PONTO ÚNICO de publicação do doc: além de gravar as chaves, republica o envelope EM MEMÓRIA
  // (applyIdentity) — assim `identityEnvelope`/`identityStatus` nunca ficam obsoletos após uma
  // escrita v1 (pushField/seed) OU v2 (pushPersonField). doc, espelho e memória saem coerentes.
  mirror(doc) {
    this.doc = doc;
    storage.setJson('sprint-configs-by-sprint', doc.sprintsByid || {});
    storage.setJson('sprint-config', doc.globalDefault || {});
    // ⚠️ ORDEM: `applyIdentity` ANTES de `mirrorIdentity`. O espelho só grava envelope
    // `supported`, e quem determina o status é o leitor — invertendo, o espelho decidiria com o
    // status da carga anterior.
    this.applyIdentity(doc);
    this.mirrorIdentity(doc);
  },
  // Espelho do envelope — FAIL-CLOSED. Depende do status que `applyIdentity` acabou de publicar:
  //
  //   supported + estruturalmente sanitizável → grava a CÓPIA SANITIZADA (sem Jira key);
  //   absent                                  → REMOVE o espelho;
  //   unsupported | invalid | não sanitizável → REMOVE o espelho.
  //
  // ⚠️ Isto substitui o "espelho OPACO" do CP4, e a troca é deliberada. Antes da M2 nenhuma
  // pessoa era criada no fluxo normal, então nenhum dado pessoal em claro existia no envelope;
  // com a reconciliação ele passa a existir. Persistir "como veio" o que o cliente não entende
  // deixaria uma versão futura — ou um documento corrompido — gravar uma key (ou outro dado
  // pessoal) numa posição desconhecida do localStorage. Nunca guardamos o que não sabemos
  // sanitizar. O envelope COMPLETO continua em memória (é dele que a fila de reconciliação lê
  // para casar a key observada na sessão), e o espelho nunca volta ao servidor: `seedFromLocal`
  // publica só as duas chaves v1.
  mirrorIdentity(doc) {
    if (!doc || doc.identity === undefined || this.identityStatus !== 'supported') {
      storage.remove(IDENTITY_MIRROR_KEY);
      return;
    }
    const sanitizado = envelopeSemChaves(doc.identity);
    if (sanitizado === null) storage.remove(IDENTITY_MIRROR_KEY);
    else storage.setJson(IDENTITY_MIRROR_KEY, sanitizado);
  },
  // Interpreta doc.identity e publica o resultado SÓ em memória. Nunca lança: qualquer
  // surpresa vira 'invalid' com código estático — uma exceção aqui não pode derrubar a
  // carga do documento legado, e nenhum valor recebido aparece em erro ou log.
  applyIdentity(doc) {
    let read;
    try {
      read = readIdentityEnvelope(doc);
    } catch {
      read = {
        status: 'invalid',
        envelope: null,
        schemaVersion: null,
        errors: ['identity:reader-exception']
      };
    }
    this.identityStatus = read.status;
    this.identityEnvelope = read.envelope;
    this.identitySchemaVersion = read.schemaVersion;
    this.identityErrors = read.errors;
    // CP7: o modelo de escopo acompanha o envelope. `readScopeModel` é fail-closed e não lança;
    // o try/catch é cinto de segurança para nunca derrubar a carga do documento legado.
    try {
      this.scopeModel = readScopeModel(read.envelope);
    } catch {
      this.scopeModel = null;
    }
  },
  // CP4: lê as capacidades declaradas pelo servidor. Fail-closed — só liga uma flag que
  // venha explicitamente `true`; qualquer ausência (proxy antigo) mantém tudo desligado.
  applyCapabilities(doc) {
    const c =
      doc && typeof doc.capabilities === 'object' && doc.capabilities !== null ? doc.capabilities : {};
    this.capabilities = {
      identityV2: c.identityV2 === true,
      dualProjection: c.dualProjection === true,
      identityWrites: c.identityWrites === true,
      identityReconciliation: c.identityReconciliation === true,
      identityRosterPicker: c.identityRosterPicker === true,
      identityLifecycle: c.identityLifecycle === true,
      identityRedaction: c.identityRedaction === true,
      identityRetentionSweep: c.identityRetentionSweep === true
    };
  },
  async load() {
    try {
      const res = await fetch('/config', { cache: 'no-store' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const doc = await res.json();
      // Compatibilidade: proxy ANTIGO responde sem configMode. Esse era o contrato
      // anterior — sempre compartilhado. Assumir 'local' na ausência do campo
      // transformaria um servidor compartilhado de verdade em modo local e faria o
      // time inteiro editar só o próprio navegador sem perceber. Só o proxy novo
      // declara 'local', e ele declara explicitamente.
      this.mode = doc.configMode === 'local' ? 'local' : 'shared';
      this.available = true;
      this.doc = doc;
      // CP1: interpreta o envelope identity em memória — nos DOIS modos, antes do desvio
      // local. Não altera espelho, projeção legada nem fluxo; só publica identity*.
      this.applyIdentity(doc);
      // CP4: capacidades do servidor, só em memória. Não afetam o fluxo v1.
      this.applyCapabilities(doc);
      if (this.isLocal) {
        // Nada de espelhar a v1: no modo local o servidor não tem config e o
        // localStorage já É a fonte da verdade. Espelhar aqui apagaria a config
        // do usuário com um documento vazio. E não há identidade canônica no modo
        // local: removemos qualquer espelho de envelope de uma sessão shared anterior.
        this.editable = false;
        storage.remove(IDENTITY_MIRROR_KEY);
        return true;
      }
      this.editable = !!doc.editable;
      // Servidor ainda vazio (pós-deploy): NÃO espelha a V1 — preserva a config local deste
      // browser pra poder publicá-la como seed. Mas o ENVELOPE é espelhado nos dois casos, na
      // sua chave separada (não interfere na config local a publicar). Com doc preenchido,
      // mirror() faz as duas coisas; com v1 vazia, só o envelope.
      if (!this.serverDocIsEmpty()) this.mirror(doc);
      else this.mirrorIdentity(doc);
      return true;
    } catch {
      this.available = false;
      this.mode = 'offline';
      // Sem documento não há envelope nem capacidades: zera para não vazar estado de uma
      // carga anterior — inclusive o espelho do envelope.
      this.applyIdentity(null);
      this.applyCapabilities(null);
      storage.remove(IDENTITY_MIRROR_KEY);
      return false; // proxy antigo/offline — segue com config local
    }
  },
  async verify(code) {
    const res = await fetch('/config/verify-code', { method: 'POST', headers: { 'x-edit-code': code } });
    if (res.status === 204) {
      this.editCode = code;
      return true;
    }
    if (res.status === 403) return false;
    throw new Error(`Servidor respondeu ${res.status}`);
  },
  async pushField(sprintId, person, field, value) {
    const res = await fetch('/config/set', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-edit-code': this.editCode },
      body: JSON.stringify({ sprintId: sprintId ?? null, person, field, value })
    });
    if (res.status === 403) {
      this.editCode = '';
      throw new Error('Código de edição inválido/expirado — destrave de novo.');
    }
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.error || `Servidor respondeu ${res.status}`);
    }
    this.mirror(await res.json());
  },
  // CP5 — escrita v2 por identidade, projeção dupla. SÓ pode ser chamada quando o servidor
  // declara `identityWrites: true` (teste controlado); no fluxo normal deste checkpoint a flag
  // é false e o app continua usando pushField (v1). ⚠️ NUNCA cai em silêncio para a rota v1 num
  // erro: qualquer falha propaga para o chamador decidir.
  async pushPersonField({ slot, personId = null, externalRef = null, field, value }) {
    if (!this.identityWritesEnabled) {
      // Contrato: a rota v2 não existe para o cliente enquanto identityWrites não for true.
      throw new Error('Escrita v2 indisponível (identityWrites desligado).');
    }
    const res = await fetch('/config/v2/set-field', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-edit-code': this.editCode },
      body: JSON.stringify({ slot, personId, externalRef, field, value })
    });
    if (res.status === 409) {
      const body = await res.json().catch(() => ({}));
      if (body.error === 'v1-projection-blocked') {
        throw new Error(
          'Conflito de projeção v1: este slot já pertence a outra identidade (homônimo). Nada foi alterado.'
        );
      }
      throw new Error(body.error || 'Conflito ao salvar (409).');
    }
    if (res.status === 403) {
      this.editCode = '';
      throw new Error('Código de edição inválido/expirado — destrave de novo.');
    }
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.error || `Servidor respondeu ${res.status}`);
    }
    this.mirror(await res.json());
  },
  // CP8 — RECONCILIAÇÃO assistida por slot. Método PRÓPRIO: não reutiliza `pushField` (que é a
  // escrita v1 por displayName) nem `pushPersonField` (que é a escrita de campo do CP5). Chama
  // EXCLUSIVAMENTE a rota de reconciliação e nunca é acionado sozinho em load/render — só por
  // ação humana explícita.
  //
  // ⚠️ O `externalRef` do intent vive só em memória, na intenção da fila; ele vai no corpo do
  // request e NUNCA é gravado em localStorage. A única coisa que entra no espelho local é o
  // ENVELOPE devolvido pelo servidor, por `mirror()` — ponto único de publicação, sem fetch extra.
  // O payload nunca é logado.
  async reconcileSlot(intent) {
    if (!this.isShared || !this.available) throw new Error('Reconciliação exige config compartilhada.');
    if (!this.unlocked) throw new Error('Edição travada: destrave com o código antes de reconciliar.');
    const res = await fetch('/config/v2/reconcile-slot', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-edit-code': this.editCode },
      body: JSON.stringify(intent)
    });
    if (res.status === 403) {
      this.editCode = '';
      const erro = new Error('Código de edição inválido/expirado — destrave de novo.');
      erro.code = 'edit-code-invalid';
      throw erro;
    }
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      // 409 estruturado (conflito de binding / projeção v1) e 400 com código estático são
      // PROPAGADOS com o código, para a UI escolher um texto local — nunca ecoar valor do servidor.
      const erro = new Error(typeof body.error === 'string' ? body.error : `http-${res.status}`);
      erro.code = typeof body.error === 'string' ? body.error : `http-${res.status}`;
      erro.status = res.status;
      erro.occupiedBy = body.occupiedBy ?? null;
      erro.attemptedPersonId = body.attemptedPersonId ?? null;
      throw erro;
    }
    const doc = await res.json();
    this.mirror(doc); // publica o envelope ANTES de qualquer re-render
    return doc.reconciliation ?? null;
  },
  // CP9 — INCLUSÃO MANUAL de pessoa no roster. Método PRÓPRIO: não reutiliza `pushField`,
  // `pushPersonField` nem `reconcileSlot`. Chama EXCLUSIVAMENTE a rota de inclusão e nunca é
  // acionado sozinho em boot/load/render — só por ação humana explícita.
  //
  // ⚠️ A `key` do intent vive só em memória (na intenção do picker); vai no corpo do request e
  // NUNCA é gravada em localStorage. `username` e `active` não entram no payload. A única coisa
  // que entra no espelho local é o ENVELOPE devolvido pelo servidor, por `mirror()` — ponto único
  // de publicação, sem fetch extra. O payload nunca é logado.
  async includePerson(intent) {
    if (!this.isShared || !this.available) throw new Error('Inclusão exige config compartilhada.');
    if (!this.unlocked) throw new Error('Edição travada: destrave com o código antes de incluir.');
    const res = await fetch('/config/v2/include-person', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-edit-code': this.editCode },
      body: JSON.stringify(intent)
    });
    if (res.status === 403) {
      this.editCode = '';
      const erro = new Error('Código de edição inválido/expirado — destrave de novo.');
      erro.code = 'edit-code-invalid';
      throw erro;
    }
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      const erro = new Error(typeof body.error === 'string' ? body.error : `http-${res.status}`);
      erro.code = typeof body.error === 'string' ? body.error : `http-${res.status}`;
      erro.status = res.status;
      erro.occupiedBy = body.occupiedBy ?? null;
      erro.attemptedPersonId = body.attemptedPersonId ?? null;
      throw erro;
    }
    const doc = await res.json();
    this.mirror(doc); // publica o envelope ANTES de qualquer re-render
    return doc.inclusion ?? null;
  },
  // CP10 — EDIÇÃO CANÔNICA por identidade. É a via da pessoa REDIGIDA: sem binding e sem balde v1,
  // `pushField` (v1) e `/config/v2/set-field` (que exige slot com displayName) não têm coordenada
  // para escrever. Aqui vai só `personId` opaco + escopo/período — nenhum nome sai daqui.
  async setPersonField(intent) {
    if (!this.isShared || !this.available) throw new Error('Edição canônica exige config compartilhada.');
    if (!this.unlocked) throw new Error('Edição travada: destrave com o código antes de editar.');
    const res = await fetch('/config/v2/set-person-field', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-edit-code': this.editCode },
      body: JSON.stringify(intent)
    });
    if (res.status === 403) {
      this.editCode = '';
      const erro = new Error('Código de edição inválido/expirado — destrave de novo.');
      erro.code = 'edit-code-invalid';
      throw erro;
    }
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      const erro = new Error(typeof body.error === 'string' ? body.error : `http-${res.status}`);
      erro.code = typeof body.error === 'string' ? body.error : `http-${res.status}`;
      erro.status = res.status;
      throw erro;
    }
    const doc = await res.json();
    this.mirror(doc); // publica o envelope ANTES de qualquer re-render
    return doc.personConfig ?? null;
  },
  // CP10 — ciclo de vida da participação. A pessoa vai SEMPRE por `personId` opaco, resolvido a
  // partir do handle da sessão; nome, key e username nunca entram no corpo. Ponto de publicação
  // ÚNICO: `mirror()`, como nas rotas anteriores.
  async lifecycleAction(intent) {
    if (!this.isShared || !this.available) throw new Error('Ciclo de vida exige config compartilhada.');
    if (!this.unlocked) throw new Error('Edição travada: destrave com o código antes de decidir.');
    const res = await fetch('/config/v2/participation', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-edit-code': this.editCode },
      body: JSON.stringify(intent)
    });
    if (res.status === 403) {
      this.editCode = '';
      const erro = new Error('Código de edição inválido/expirado — destrave de novo.');
      erro.code = 'edit-code-invalid';
      throw erro;
    }
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      const erro = new Error(typeof body.error === 'string' ? body.error : `http-${res.status}`);
      erro.code = typeof body.error === 'string' ? body.error : `http-${res.status}`;
      erro.status = res.status;
      throw erro;
    }
    const doc = await res.json();
    this.mirror(doc);
    return doc.participation ?? null;
  },
  // Doc do servidor sem nenhuma pessoa configurada (estado pós-deploy).
  serverDocIsEmpty() {
    const d = this.doc || {};
    const hasSprint = Object.values(d.sprintsByid || {}).some(sp => Object.keys(sp || {}).length > 0);
    return !hasSprint && Object.keys(d.globalDefault || {}).length === 0;
  },
  // Seed inicial: publica a config local (deste browser) como doc do servidor.
  async seedFromLocal() {
    const res = await fetch('/config', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'x-edit-code': this.editCode },
      body: JSON.stringify({
        sprintsByid: storage.getJson('sprint-configs-by-sprint', {}),
        globalDefault: storage.getJson('sprint-config', {})
      })
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.error || `Servidor respondeu ${res.status}`);
    }
    this.mirror(await res.json());
  }
};
