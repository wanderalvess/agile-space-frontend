// Configuração por pessoa: validação dos campos, roster da sprint e capacity.
//
// ⚠️ `personConfig` usa `this` em `capacityHours` e `capacitySeconds`, que compõem os
// métodos por período. Não desmembre esses métodos nem os passe soltos como callback.
//
// `isActiveConfig`, `HORAS_PRODUTIVAS_PADRAO` e `CONFIG_FIELD_RULES` ficam PRIVADOS: são
// detalhe de implementação e se observam pelos efeitos (roster, valor padrão, validação).
//
// `snapshot()` continua SÍNCRONO de propósito — todo o render depende disso. `state` é só
// lido; a avaliação deste módulo é inerte: nada de storage, `sprintBoardStore`, DOM, `Set`
// ou request antes de um método ser chamado.
//
// ⚠️ Limitação conhecida: a identidade da pessoa é o `displayName` do Jira, então `Fulano` e
// `Fulano [X]` são duas entradas distintas. Isso NÃO foi resolvido aqui — ver a issue
// "Estudar identidade e ciclo de vida do roster de pessoas".
import { state } from '../core/state.js';
// `priorPeriodsSameScope` é o ÚNICO ponto de entrada da lista de períodos anteriores: sem escopo
// resolvido ele devolve exatamente `priorSprintIdsSameBoard(snap)` (o legado por board).
import {
  priorPeriodsSameScope,
  resolveScopeSelection,
  slotBelongsToSelection,
  participationIsActive,
  SCOPE_MODE_LEGACY,
  SCOPE_MODE_SCOPED
} from './analysis-scope.js';
import { participationRosterNames, nomeObservadoDe } from './reconciliation.js';
import { storage } from '../platform/storage.js';
import { sprintBoardStore } from '../platform/sprint-board-store.js';
import { sharedConfig } from '../platform/shared-config.js';

// Config "ativa": tem papel OU dias/horas > 0. Entrada toda zerada = pessoa fora do time.
// É assim que a aba Configuração remove alguém: esvaziar os campos grava papel '' e 0/0.
export const numOrZero = v => {
  const n = typeof v === 'number' ? v : parseFloat(v);
  return Number.isFinite(n) ? n : 0;
};
// O legado `diasSprint` só conta quando o campo novo está AUSENTE: um
// diasCodificacaoTeste: 0 explícito significa "zero dias", e voltar para o legado
// ressuscitaria alguém que a pessoa acabou de zerar.
const isActiveConfig = c =>
  !!c &&
  (!!(c.papel && String(c.papel).trim()) ||
    numOrZero(c.diasCodificacaoTeste) > 0 ||
    numOrZero(c.diasRegressivo) > 0 ||
    (c.diasCodificacaoTeste === undefined && numOrZero(c.diasSprint) > 0) ||
    numOrZero(c.horasProdutivas) > 0);

// Horas produtivas/dia assumidas quando a pessoa não tem o campo configurado.
// Constante única pra que personConfig.get e o preview ao vivo não divirjam.
const HORAS_PRODUTIVAS_PADRAO = 8;

// ── CP10: linhas de pessoas REDIGIDAS ───────────────────────────────────────────────────────
// Uma pessoa redigida não tem nome, e o roster inteiro é chaveado por nome. Ela entra por um
// TOKEN EFÊMERO — não persistido e descartado quando o dataset é SUBSTITUÍDO. Dentro do mesmo
// dataset ele é ESTÁVEL: a mesma tupla reusa o mesmo token em toda montagem do roster (ver
// `abrirGeracao`), porque vários renderers montam o roster e o token já está publicado no DOM.
//
// ⚠️ O token NÃO é o `personId`. `personId` é identificador PERSISTENTE: usá-lo como chave de
// roster o levaria a `data-*`, a `title` e a qualquer export — virando rastreador de longa
// duração exatamente da pessoa que pediu para ser removida. O mapa token → personId vive só aqui.
export const REDACTED_LABEL = '[dados pessoais removidos]';
const REDACTED_PREFIX = 'redacted:';
const redigidas = new Map(); // token → { personId, analysisScopeId, periodId }
const tokenPorTupla = new Map(); // `${personId}\n${analysisScopeId}\n${periodId}` → token
let seqRedigida = 0;

// ⚠️ "Efêmero" é NÃO PERSISTIDO e descartado ao trocar o dataset — não é "rotacionado a cada
// render". O roster é remontado por VÁRIOS renderers (Configuração, Assignees, Planning, Horas,
// Qualidade, Cycle Time...), e cunhar tokens novos a cada leitura invalidava o token que a
// Configuração já tinha publicado no DOM: bastava outra aba renderizar para `redactedCoordOf`
// devolver `null` na linha visível, e a escrita canônica deixava de ser reconhecida — sem nenhum
// sinal na tela, porque a guarda de assinatura podia devolver o HTML antigo do cache.
//
// Por isso o registro vive por GERAÇÃO: o contexto que produziu os tokens — envelope de identidade,
// modelo de escopo, escopo analítico e sprint. Dentro da mesma geração a mesma tupla
// (personId, analysisScopeId, periodId) reusa o MESMO token, quantas vezes o roster for montado.
let geracao = null;
let geracaoSeq = 0;
// Contador exposto para as guardas de assinatura de render: quando ele muda, todo HTML que
// carregava tokens da geração anterior PRECISA ser substituído, nunca servido do cache.
export const redactedGeneration = () => geracaoSeq;

// Envelope e modelo de escopo comparados por REFERÊNCIA: `sharedConfig` os substitui inteiros a
// cada `load()`/`mirror()`, então referência nova é dataset novo.
const mesmaGeracao = (a, b) =>
  a !== null &&
  a.envelope === b.envelope &&
  a.scopeModel === b.scopeModel &&
  a.analysisScopeId === b.analysisScopeId &&
  a.currentSprintId === b.currentSprintId;

const abrirGeracao = ctx => {
  // Chamada sem envelope não cunha nem invalida nada: é o caminho legado (e a régua
  // `getSprintRoster`, que passa tudo `null` de propósito). Deixar que ela limpasse o registro
  // reintroduziria exatamente o bug — outra leitura derrubando o token já publicado.
  if (ctx.envelope === null || ctx.envelope === undefined) return;
  if (mesmaGeracao(geracao, ctx)) return;
  geracao = ctx;
  geracaoSeq += 1;
  redigidas.clear();
  tokenPorTupla.clear();
};

// ⚠️ ORDEM: a geração precisa ser sincronizada ANTES de qualquer assinatura de cache de render.
// Ler `redactedGeneration()` antes de montar o roster devolvia o número da geração ANTERIOR — a
// assinatura gravada ficava uma geração atrasada e, no render seguinte, um dataset novo com
// `updatedAt`/`dataVersion` iguais podia sair pelo cache ANTES de a geração nova ser aberta:
// DOM e mapa continuariam no dataset anterior. Quem renderiza chama isto primeiro; `getScopeRoster`
// chama a mesma função, então a segunda passagem é no-op.
export const syncRedactedGeneration = (
  confSnap,
  scopeModel = confSnap?.scopeModel ?? null,
  analysisScopeId = confSnap?.analysisScopeId ?? null,
  identityEnvelope = confSnap?.identityEnvelope ?? null
) => {
  abrirGeracao({
    envelope: identityEnvelope,
    scopeModel,
    analysisScopeId,
    currentSprintId: confSnap?.currentSprintId ?? null
  });
  return geracaoSeq;
};

const registrarRedigida = (personId, selecao) => {
  const analysisScopeId = selecao?.analysisScopeId ?? null;
  const periodId = selecao?.period?.periodId ?? null;
  const tupla = `${personId}\n${analysisScopeId ?? ''}\n${periodId ?? ''}`;
  const jaCunhado = tokenPorTupla.get(tupla);
  if (jaCunhado !== undefined) return jaCunhado;
  // A sequência NUNCA reinicia: um token de geração anterior resolve para `null` (falha visível),
  // jamais para outra pessoa.
  const token = `${REDACTED_PREFIX}${++seqRedigida}`;
  redigidas.set(token, { personId, analysisScopeId, periodId });
  tokenPorTupla.set(tupla, token);
  return token;
};
// Rótulo de apresentação de uma chave de roster: o texto neutro quando ela é de pessoa redigida,
// `null` quando é um nome comum (e aí quem apresenta é a régua de sempre).
export const redactedRosterLabel = chave => (redigidas.has(chave) ? REDACTED_LABEL : null);
export const redactedPersonIdOf = chave => redigidas.get(chave)?.personId ?? null;
// COORDENADA canônica completa da linha — é ela que a escrita usa. Devolvida junto porque o
// momento em que o roster é montado é o único em que escopo e período estão resolvidos.
export const redactedCoordOf = chave => {
  const reg = redigidas.get(chave);
  return reg ? { ...reg } : null;
};

// Leitura da configuração CANÔNICA no cliente — o espelho da régua do servidor
// (`readCanonicalConfig` em `server/identity-domain.js`). Coordenada escopada quando a seleção a
// tem; o Global Default entra como último recurso, como em toda a herança.
function canonicalConfigDe(envelope, personId, selecao) {
  const cfg = envelope?.config;
  if (!cfg || typeof cfg !== 'object') return null;
  const escopada = selecao?.analysisScopeId
    ? cfg.scoped?.[selecao.analysisScopeId]?.[selecao.period?.periodId]?.[personId]
    : undefined;
  const global = cfg.global?.[personId];
  if (!escopada && !global) return null;
  return { ...(global || {}), ...(escopada || {}) };
}

// Limites REAIS dos campos de configuração. Os atributos min/max/step do <input> são
// só dica visual: o browser deixa digitar 31,5 e deixa colar 32, e o valor era
// persistido do jeito que viesse. Esta é a régua que vale no front — a mesma existe
// no proxy.js, porque o servidor não pode confiar no cliente.
// Forma NUMÉRICA aceita no texto cru: dígitos, um único separador decimal (vírgula OU ponto) e um
// sinal opcional. Sem isto, `Number` aceitaria `0x18` (24), `1e1` (10) e `Infinity`.
//
// ⚠️ Vale SÓ para `horasProdutivas` (`forma: FORMA_NUMERICA` na regra). Os campos de DIAS mantêm o
// contrato anterior byte a byte — converte com `Number` e exige inteiro de 0 a 31 —, porque
// endurecê-los seria mudança sem relação com este ajuste. Em dias, `1e1` continua virando 10.
const FORMA_NUMERICA = /^[+-]?(?:\d+(?:[.,]\d*)?|[.,]\d+)$/;

const CONFIG_FIELD_RULES = {
  diasCodificacaoTeste: { label: 'Dias de Codificação/Teste', min: 0, max: 31, inteiro: true },
  diasRegressivo: { label: 'Dias de Regressivo', min: 0, max: 31, inteiro: true },
  // Legado: a UI nova não grava mais nele, mas um HTML em cache ainda poderia mandar.
  diasSprint: { label: 'Dias da sprint (legado)', min: 0, max: 31, inteiro: true },
  // Horas produtivas são FRACIONÁRIAS: a jornada real de uma pessoa é 5,12h/dia, não um múltiplo
  // de meia hora. `casas: 2` é o limite de precisão — não é arredondamento (ver `casasAte`).
  horasProdutivas: {
    label: 'Horas produtivas/dia',
    min: 0,
    max: 24,
    casas: 2,
    forma: FORMA_NUMERICA
  }
};

// "No máximo N casas decimais", à prova de IEEE-754. `5.12 * 100` é 511.9999999999999 em ponto
// flutuante: comparar com `Number.isInteger` recusaria um valor legítimo. A folga de 1e-9 fica
// ordens de grandeza abaixo de uma terceira casa real (0.001 vira 0.1 nesta escala), então
// `5.123` continua recusado.
const casasAte = (valor, casas) => {
  const escala = 10 ** casas;
  const ampliado = valor * escala;
  return Math.abs(ampliado - Math.round(ampliado)) < 1e-9;
};

// Valida o valor CRU de um campo de configuração antes de qualquer persistência.
// Devolve { ok: true, value } ou { ok: false, erro }. Nunca faz clamp silencioso:
// valor fora da régua é recusado inteiro, pra pessoa ver o que digitou errado.
// Campo vazio confirmado vale 0 — é assim que se zera alguém (ver §6 do AGENTS.md).
export const validateConfigField = (field, rawValue) => {
  if (field === 'papel') {
    const papel = String(rawValue ?? '');
    return ['', 'DEV', 'QA'].includes(papel)
      ? { ok: true, value: papel }
      : { ok: false, erro: 'Papel inválido: use DEV, QA ou vazio.' };
  }
  const rule = CONFIG_FIELD_RULES[field];
  if (!rule) return { ok: false, erro: `Campo de configuração desconhecido: ${field}.` };

  const texto = String(rawValue ?? '').trim();
  // Number (e não parseFloat) de propósito: parseFloat('6abc') devolveria 6. Só os campos com
  // `forma` (hoje, apenas horas) conferem o formato ANTES — em dias, nada mudou.
  if (rule.forma && texto !== '' && !rule.forma.test(texto)) {
    return { ok: false, erro: `${rule.label}: informe um número válido.` };
  }
  // ⚠️ VÍRGULA é entrada de primeira classe: quem digita `5,12` quer o mesmo que `5.12`, e o que
  // será PERSISTIDO é o número JSON 5.12 nos dois casos. A troca não altera o valor.
  const value = texto === '' ? 0 : Number(texto.replace(',', '.'));
  if (!Number.isFinite(value)) return { ok: false, erro: `${rule.label}: informe um número válido.` };
  if (rule.inteiro && !Number.isInteger(value)) {
    return { ok: false, erro: `${rule.label}: use dias inteiros, sem fração.` };
  }
  if (value < rule.min || value > rule.max) {
    return { ok: false, erro: `${rule.label}: use um valor entre ${rule.min} e ${rule.max}.` };
  }
  // Precisão: `5,123` é recusado INTEIRO — nunca arredondado para 5,12. Truncar em silêncio
  // gravaria um número que a pessoa não digitou.
  if (rule.casas !== undefined && !casasAte(value, rule.casas)) {
    return {
      ok: false,
      erro: `${rule.label}: use no máximo ${rule.casas} casas decimais (ex.: 5,12 ou 5.12).`
    };
  }
  return { ok: true, value };
};

// Roster da sprint atual: nomes de pessoas relevantes pra cálculos de Capacity.
// União de:
//  (1) quem tem issue/subtask atribuída na sprint (derived.assignees). Vem do JQL da
//      squad, é verdade do Jira, nunca é filtrado.
//  (2) quem tem config explícita pra esta sprint (mesmo sem issue assigned e mesmo zerado).
//  (3) carry-forward: o time da sprint anterior mais recente DO MESMO BOARD, só quem
//      estava ativo. Resolve início de sprint (poucas issues assigned) e quem está de
//      férias sem issue — o time aparece com os valores já herdados e editáveis.
// (2) e (3) leem o doc de config, que é global por sprintId e compartilhado entre todas
// as squads. O filtro por board é o que impede vazamento entre times, e ele não depende
// de nenhum estado local do browser: o resultado é idêntico em máquina nova, aba
// anônima e perfil limpo.
// Inclui inativas [X] — quem decide se conta na Capacity é o config (dias × horas).
// Pra tirar alguém do time, zere os campos na aba Configuração: ela sai do carry-forward
// das próximas sprints (segue visível nesta, com capacity 0, pra poder ser corrigida).
// Exclui só "Não atribuído".
// CP7 — MESMA composição do roster, com duas mudanças que só valem quando há ESCOPO:
//   (a) a lista de períodos anteriores vem do escopo ativo (selecionado pela referência da SQUAD);
//   (b) config explícita e carry-forward consideram só slots que PERTENCEM ao escopo ativo — um
//       slot resolvido para OUTRO escopo não vaza para o roster nem fornece capacity.
// Sem referência de squad e sem escopo para a sprint, tudo é o legado byte a byte (inclusive o
// fail-closed sem board). Referência EXPLÍCITA que não resolve → `blocked`: sem config por sprint
// e sem carry-forward, nunca o legado de outro escopo.
//
// ⚠️ Esta é a MESMA seleção que `personConfig.get` usa na herança campo a campo, para roster e
// herança nunca divergirem.
// CP8 — uma pessoa que já existe em PARTICIPAÇÃO pode ser materializada no roster, mas só quando o
// documento guarda dados suficientes para apresentá-la (ver `participationRosterNames`). Sem nome
// persistido é FAIL-CLOSED: a pessoa não aparece, e nenhum nome é fabricado nem deduzido do
// `personId`. Isso só acontece no modo `scoped`, então o caminho legado sai byte a byte igual.
export const getScopeRoster = (
  derived,
  confSnap,
  scopeModel = confSnap?.scopeModel ?? null,
  analysisScopeId = confSnap?.analysisScopeId ?? null,
  identityEnvelope = confSnap?.identityEnvelope ?? null
) => {
  const names = new Set();
  // Abre (ou reaproveita) a geração de tokens deste contexto — ver `abrirGeracao`. Só descarta os
  // tokens anteriores quando dataset, envelope ou contexto de escopo/sprint foi SUBSTITUÍDO.
  syncRedactedGeneration(confSnap, scopeModel, analysisScopeId, identityEnvelope);
  for (const [name] of derived?.assignees || []) {
    if (name && name !== 'Não atribuído') names.add(name);
  }
  const sid = confSnap?.currentSprintId;
  if (sid) {
    const selecao = resolveScopeSelection(scopeModel, { currentSprintId: sid, analysisScopeId });
    const doEscopo = (sprintId, name) =>
      slotBelongsToSelection(scopeModel, selecao, {
        kind: 'sprint',
        sprintId: String(sprintId),
        displayName: name
      });
    // Qualquer nome com config explícita nesta sprint entra, mesmo zerado. NÃO checar
    // isActive aqui é proposital: não existe UI pra adicionar pessoa, então uma pessoa
    // zerada por engano precisa continuar visível (com capacity 0) pra poder ser
    // corrigida. Zerar remove do time nas PRÓXIMAS sprints, via o filtro do
    // carry-forward abaixo — que é onde a auto-limpeza sempre foi documentada.
    const currentSprintConfig = confSnap.sprintsByid?.[sid] || {};
    for (const name of Object.keys(currentSprintConfig)) {
      if (name && doEscopo(sid, name)) names.add(name);
    }
    for (const pid of priorPeriodsSameScope(confSnap, scopeModel, selecao)) {
      const active = Object.keys(confSnap.sprintsByid[pid] || {}).filter(
        n => doEscopo(pid, n) && isActiveConfig(confSnap.sprintsByid[pid][n])
      );
      if (active.length) {
        active.forEach(n => names.add(n));
        break;
      } // só a anterior mais recente COM roster
    }
    // CP8: materialização por PARTICIPAÇÃO — só no escopo/período selecionados e só com nome
    // persistido. Nunca por igualdade de displayName e nunca com nome inventado.
    if (selecao.mode === SCOPE_MODE_SCOPED) {
      const mapa = scopeModel?.participation?.[selecao.analysisScopeId]?.[selecao.period?.periodId];
      // CP10 — materializar por participação NÃO pode ressuscitar quem foi arquivado ou excluído
      // do carry-forward: seria a rota de ciclo de vida respondendo sucesso e a pessoa voltando
      // pela porta dos fundos, no mesmo render.
      const ativos = {};
      for (const [pid, registro] of Object.entries(mapa || {})) {
        if (participationIsActive(registro)) ativos[pid] = registro;
      }
      for (const nome of participationRosterNames(identityEnvelope, ativos).names) names.add(nome);

      // ── CP10: pessoas REDIGIDAS nas superfícies administrativas ────────────────────────────
      // Só com `identityWrites` LIGADA. Com ela desligada — o fluxo atual — nada muda: quem foi
      // redigido simplesmente não aparece, porque o roster é chaveado por NOME e ela não tem mais
      // nome. É esse o comportamento do CP10.
      //
      // ⚠️ Ligada, a pessoa PRECISA aparecer aqui: sem isso, papel/dias/horas dela existiriam no
      // documento sem nenhuma superfície que os mostrasse ou editasse, e a ativação produtiva
      // exigiria escrever tela nova. A linha entra com um TOKEN EFÊMERO (não `personId`) e rótulo
      // `[dados pessoais removidos]`.
      //
      // ⚠️ Isto NÃO a devolve às métricas: elas vêm de `derived.assignees`, que é verdade do Jira
      // e continua chaveada por nome. E não religa nada ao Jira: sem key e sem nome, não há o que
      // consultar.
      if (sharedConfig.identityWritesEnabled) {
        for (const [pid, registro] of Object.entries(ativos)) {
          if (nomeObservadoDe(identityEnvelope?.people?.[pid]) !== null) continue; // tem nome: já entrou
          const conf = canonicalConfigDe(identityEnvelope, pid, selecao);
          // Sem configuração canônica não há o que administrar — e inventar uma linha vazia só
          // pelo `personId` seria expor a existência da pessoa sem utilidade nenhuma.
          if (conf === null && !registro) continue;
          names.add(registrarRedigida(pid, selecao));
        }
      }
    }
  } else if (sharedConfig.identityWritesEnabled) {
    // ── CP10: GLOBAL DEFAULT da pessoa redigida ─────────────────────────────────────────────
    // Sem sprint não há escopo, período nem participação — e a materialização acima, que depende
    // dos três, nunca roda. Sem este ramo o Global Default de quem foi redigido ficaria
    // INALCANÇÁVEL: os valores existiriam no documento e nenhuma tela os mostraria ou editaria.
    //
    // O critério aqui é o único que faz sentido fora de um período: ter configuração GLOBAL. Quem
    // não tem nada em `identity.config.global` não entra — uma linha vazia só pelo `personId`
    // exporia a existência da pessoa sem utilidade nenhuma.
    //
    // ⚠️ O token nasce com `analysisScopeId: null` e `periodId: null`, e é assim que a escrita sai:
    // a coordenada global é a AUSÊNCIA dos dois, nunca um deles sozinho (o servidor recusa meia
    // coordenada como intenção ambígua).
    for (const [pid, pessoa] of Object.entries(identityEnvelope?.people || {})) {
      if (nomeObservadoDe(pessoa) !== null) continue; // tem nome: entra pelo caminho normal
      const global = identityEnvelope?.config?.global?.[pid];
      if (!global || typeof global !== 'object' || Object.keys(global).length === 0) continue;
      names.add(registrarRedigida(pid, null));
    }
  }
  return names;
};

// Roster LEGADO — sempre por BOARD, ignorando o modelo de escopo E a referência da squad, mesmo
// que o snapshot traga os dois. Continua existindo (o CP7 não o apaga) como caminho conhecido e
// como régua da prova de equivalência: com UM escopo por board, `getScopeRoster` devolve isto.
export const getSprintRoster = (derived, confSnap) => getScopeRoster(derived, confSnap, null, null, null);

export const personConfig = {
  // Storage layout:
  // - 'sprint-configs-by-sprint' (novo): { sprintId: { person: { papel,
  //   diasCodificacaoTeste, diasRegressivo, horasProdutivas } } }. `diasSprint` ainda
  //   aparece em documentos antigos e é lido como alias de diasCodificacaoTeste — a UI
  //   atual não grava mais nele (ver §6 do AGENTS.md).
  // - 'sprint-config' (legado): { person: { ... } } — agora funciona como "Global Default"
  //   (fallback final quando nenhuma sprint específica tem config pra essa pessoa).
  // - 'horas-produtivas' (legado mais antigo): fallback só pra horasProdutivas.
  // - 'sprint-boards': cache sprintId -> board do Jira. Não é config: é dado derivado,
  //   usado pra herdar valores só dentro da mesma squad.
  snapshot() {
    return {
      currentSprintId: state.sprintInfo?.id ? String(state.sprintInfo.id) : null,
      currentBoardId: state.sprintInfo?.originBoardId ?? null,
      sprintBoards: sprintBoardStore.all(),
      sprintsByid: storage.getJson('sprint-configs-by-sprint', {}),
      globalDefault: storage.getJson('sprint-config', {}),
      legacyHours: storage.getJson('horas-produtivas', {}),
      // CP7: modelo de ESCOPO ANALÍTICO, lido do envelope v2 que já está em memória (nenhum IO
      // novo). Vem no snapshot para que roster e herança campo a campo usem SEMPRE a mesma lista
      // de períodos anteriores. Sem envelope/escopo (o normal hoje) é `absent` e tudo segue legado.
      scopeModel: sharedConfig.scopeModel,
      // CP7: referência OPCIONAL da SQUAD ativa, publicada pela aplicação em `state` quando a aba
      // é aplicada. É ela — e só ela — que desambigua quando a MESMA sprint pertence a escopos
      // diferentes. Ausente = caminho legado.
      analysisScopeId: state.activeAnalysisScopeId ?? null,
      // CP8: o envelope v2 já em memória. Serve SÓ para o nome de apresentação PERSISTIDO de quem
      // aparece em `participation` — nenhum IO novo, e nada é lido dele fora dessa materialização.
      identityEnvelope: sharedConfig.identityEnvelope
    };
  },
  get(name, snap, scopeModel, analysisScopeId) {
    snap = snap || this.snapshot();
    const { currentSprintId, sprintsByid, globalDefault, legacyHours } = snap;
    // MESMA seleção de escopo do roster (`getScopeRoster`), para nunca divergirem.
    const modelo = scopeModel === undefined ? (snap.scopeModel ?? null) : scopeModel;
    const escopoPedido = analysisScopeId === undefined ? (snap.analysisScopeId ?? null) : analysisScopeId;
    const selecao = resolveScopeSelection(modelo, {
      currentSprintId,
      analysisScopeId: escopoPedido
    });
    // Herança campo a campo: a MESMA lista de períodos anteriores que o roster usa. Sem escopo
    // resolvido ela é exatamente `priorSprintIdsSameBoard` — herdar só do MESMO board,
    // fail-closed sem board.
    // ── CP10: linha de pessoa REDIGIDA lê a configuração CANÔNICA ─────────────────────────
    // A chave não é um nome: é o token efêmero cunhado pelo roster. Não existe balde v1 para ela
    // (a redação o removeu), então a herança por sprint/global não tem o que ler — a fonte é
    // `identity.config`, sob `personId`. Sem isto, papel/dias/horas preservados pela redação
    // seriam invisíveis e a capacity dela apareceria zerada.
    const coordRedigida = redactedCoordOf(name);
    if (coordRedigida !== null) {
      const personIdRedigido = coordRedigida.personId;
      const canonica = canonicalConfigDe(snap.identityEnvelope, personIdRedigido, selecao) || {};
      const horas = canonica.horasProdutivas;
      return {
        horasProdutivas: horas ?? HORAS_PRODUTIVAS_PADRAO,
        papel: canonica.papel ?? '',
        diasCodificacaoTeste: canonica.diasCodificacaoTeste ?? 0,
        diasRegressivo: canonica.diasRegressivo ?? 0,
        rawHoras: horas ?? '',
        rawCodificacaoTeste: canonica.diasCodificacaoTeste ?? '',
        rawRegressivo: canonica.diasRegressivo ?? '',
        // Nada aqui é "herdado": veio da fonte canônica, não de uma sprint anterior.
        papelInherited: false,
        codificacaoTesteInherited: false,
        regressivoInherited: false,
        horasInherited: false,
        inheritedFrom: { papel: null, codificacaoTeste: null, regressivo: null, horas: null }
      };
    }

    const priorIds = priorPeriodsSameScope(snap, modelo, selecao);
    // Config POR SPRINT só é lida quando o slot pertence ao escopo ativo: um slot resolvido para
    // outro escopo não pode fornecer capacity. No modo `blocked` nenhuma sprint é lida (só o
    // Global Default, que não tem escopo, continua como último recurso).
    const slotUtilizavel = (sprintId, pessoa) =>
      selecao.mode === SCOPE_MODE_LEGACY ||
      slotBelongsToSelection(modelo, selecao, {
        kind: 'sprint',
        sprintId: String(sprintId),
        displayName: pessoa
      });

    // Fallback por campo: current sprint → última sprint anterior (mesmo board) com
    // valor → global default. Retorna { value, inherited, source } pra UI sinalizar
    // herança visualmente.
    //
    // `names` aceita mais de um nome para cobrir o campo legado. A ordem importa e a
    // varredura é POR ORIGEM: dentro de cada origem o nome novo vence e só na ausência
    // dele o legado é consultado. Fazer o contrário — procurar o campo novo em todas as
    // origens e só depois o legado — deixaria uma sprint anterior ganhar de um valor
    // legado explícito da sprint atual.
    const readAt = (bucket, names) => {
      if (!bucket) return undefined;
      for (const fieldName of names) {
        if (bucket[fieldName] !== undefined) return bucket[fieldName];
      }
      return undefined;
    };
    const resolveField = (...names) => {
      if (currentSprintId && slotUtilizavel(currentSprintId, name)) {
        const value = readAt(sprintsByid[currentSprintId]?.[name], names);
        if (value !== undefined) return { value, inherited: false, source: null };
      }
      for (const id of priorIds) {
        if (!slotUtilizavel(id, name)) continue;
        const value = readAt(sprintsByid[id]?.[name], names);
        if (value !== undefined) return { value, inherited: true, source: id };
      }
      const value = readAt(globalDefault[name], names);
      if (value !== undefined) return { value, inherited: !!currentSprintId, source: 'global' };
      return { value: undefined, inherited: false, source: null };
    };

    const papelField = resolveField('papel');
    // Codificação/Teste herda o legado `diasSprint` de documentos antigos: uma config
    // de 10 dias × 6h continua valendo 60h, agora inteiramente no período de
    // Codificação/Teste. Regressivo não tem legado — ausente significa 0.
    const codificacaoTesteField = resolveField('diasCodificacaoTeste', 'diasSprint');
    const regressivoField = resolveField('diasRegressivo');
    let horasField = resolveField('horasProdutivas');
    // Legacy: 'horas-produtivas' antigo cobre só o campo de horas, fica como última opção.
    if (horasField.value === undefined && legacyHours[name] !== undefined) {
      horasField = { value: legacyHours[name], inherited: !!currentSprintId, source: 'global' };
    }

    return {
      horasProdutivas: horasField.value ?? HORAS_PRODUTIVAS_PADRAO,
      papel: papelField.value ?? '',
      diasCodificacaoTeste: codificacaoTesteField.value ?? 0,
      diasRegressivo: regressivoField.value ?? 0,
      rawHoras: horasField.value ?? '',
      // raw* alimentam os inputs: '' vira placeholder "—", mas um 0 explícito precisa
      // aparecer como 0, senão a pessoa não distingue "zerado" de "não configurado".
      rawCodificacaoTeste: codificacaoTesteField.value ?? '',
      rawRegressivo: regressivoField.value ?? '',
      hasConfiguredHoras: horasField.value !== undefined,
      // Sinalização de herança por campo (pra renderConfig aplicar estilo). Os dois
      // períodos têm herança independente: dá pra ter Codificação/Teste fixado nesta
      // sprint e Regressivo ainda vindo da anterior.
      papelInherited: papelField.inherited,
      horasInherited: horasField.inherited,
      codificacaoTesteInherited: codificacaoTesteField.inherited,
      regressivoInherited: regressivoField.inherited,
      // Útil pra tooltip "herdado de Sprint X" ou "Global Default".
      inheritedFrom: {
        papel: papelField.source,
        horas: horasField.source,
        codificacaoTeste: codificacaoTesteField.source,
        regressivo: regressivoField.source
      }
    };
  },
  // Capacity por período: dias × horas produtivas/dia. Nunca some dias com horas.
  // Ex.: 7 dias Cod./Teste + 3 dias Regressivo a 6h/dia → 42h + 18h = 60h.
  capacityCodificacaoTesteHours(conf) {
    return numOrZero(conf?.horasProdutivas) * numOrZero(conf?.diasCodificacaoTeste);
  },
  capacityRegressivoHours(conf) {
    return numOrZero(conf?.diasRegressivo) * numOrZero(conf?.horasProdutivas);
  },
  // Total das duas fases. É o que todos os consumidores antigos de capacityHours()
  // continuam recebendo — nenhuma métrica existente muda de valor por causa da divisão
  // em períodos.
  capacityHours(conf) {
    return this.capacityCodificacaoTesteHours(conf) + this.capacityRegressivoHours(conf);
  },
  capacitySeconds(conf) {
    return this.capacityHours(conf) * 3600;
  },
  diasTotal(conf) {
    return numOrZero(conf?.diasCodificacaoTeste) + numOrZero(conf?.diasRegressivo);
  }
};
