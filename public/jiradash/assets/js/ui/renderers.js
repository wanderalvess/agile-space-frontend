// renderizadores do dashboard: um renderX() por aba ou seção, HTML por template string e
// innerHTML. Trinta e quatro membros, na ordem em que sempre estiveram (o painel de reconciliação
// do CP8, o picker do CP9 e o ciclo de vida do CP10 acrescentaram sete).
//
// ⚠️ FRONTEIRA LEGADA, não arquitetura final. Este arquivo é grande e acoplado de propósito:
// a etapa que o tirou do entrypoint moveu o objeto INTEIRO, sem redesenho, justamente para
// que a divisão por aba possa acontecer depois com equivalência já protegida por teste. Não
// leia o tamanho dele como aprovação do formato.
//
// ⚠️ Os sete `new Chart` do app moram aqui: dois em `renderCharts`, dois em `renderPlanning`,
// um em `renderCapacityChart`, um em `renderAllocationChart` e um em `renderCycleTime`.
// `Chart` continua sendo o GLOBAL do CDN, declarado ao ESLint como readonly: não existe import
// de Chart.js, wrapper nem fallback. Destruir antes de substituir é obrigatório — quem cria
// passa por chartFactory.destroy.
//
// ⚠️ Template literals MULTILINHA com whitespace SIGNIFICATIVO: o espaço inicial das linhas
// internas faz parte do VALOR da string, ou seja, do HTML que vai para a tela. Reindentar o
// interior de um template muda conteúdo, não aparência. O Prettier não mexe nesse interior;
// você também não deve.
//
// ⚠️ Escaping é contrato: escapeHtml para texto, escapeAttr para atributo. Onde o valor
// entra cru é deliberado (HTML já montado por outro membro). Não acrescente nem remova
// escape "de passagem".
//
// ⚠️ Memoização de render: SETE membros comparam `state.dataVersion` com
// `state.renderedVersion.<aba>` e saem cedo se nada mudou — `renderAssignees`, `renderCharts`,
// `renderPlanning`, `renderCycleTime`, `renderConfig`, `renderHoras` e `renderQuality`. Só
// `renderCycleTime` e `renderConfig` aceitam `{ force = false }` para furar a guarda. A versão
// é publicada no FIM do render — não antecipe nem atrase. `renderMetrics` e `renderIssues` não
// têm guarda de propósito: redesenham sempre.
//
// ⚠️ Oito membros dependem do receptor, porque CONTÊM `this.` (23 ocorrências no total):
// `renderIssues`, `renderCharts`, `renderPlanning`, `renderBurndownHours`,
// `renderHoursProgressBlock`, `renderCarryOverCard`, `renderCycleTime` e `renderQuality`.
// Só esses oito quebram se forem desmembrados do objeto, convertidos em arrow ou passados
// soltos como callback.
//
// Os 14 métodos ALVO desses `this.` — `buildBurndownData`, `burndownHoursProgress`,
// `computeEstimationAdherence`, `computeCapacityConsumption`, `getCarryOverData`,
// `jiraIssueLink`, `renderProgressBlock`, `renderAdherenceCard`,
// `renderCapacityConsumptionCard`, `renderCarryOverCard`, `renderHoursProgressBlock`,
// `renderAllocationChart`, `renderCapacityChart` e `renderBurndownHours` — são outra coisa:
// ser chamado por `this.x()` não cria dependência de receptor em `x`. Os que não contêm
// `this.` funcionam desmembrados — inclusive `renderCapacityChart` e `renderAllocationChart`,
// que são APENAS alvos (de `renderPlanning`). Só TRÊS membros aparecem nas duas listas, porque
// chamam e são chamados: `renderBurndownHours`, `renderHoursProgressBlock` e
// `renderCarryOverCard`.
//
// Onze membros não escrevem no DOM — devolvem string de HTML ou dado puro: `jiraIssueLink`,
// `buildBurndownData`, `burndownHoursProgress`, `renderHoursProgressBlock`,
// `computeEstimationAdherence`, `renderAdherenceCard`, `computeCapacityConsumption`,
// `getCarryOverData`, `renderCarryOverCard`, `renderCapacityConsumptionCard` e
// `renderProgressBlock`. São eles que test/renderers.test.mjs cobre; o resto é comparado no
// teste diferencial de navegador. Duas ressalvas: `computeCapacityConsumption` LÊ o Web
// Storage por `personConfig.snapshot()`, e `exportAllocationCsv` — que também não usa `dom` —
// termina em `csv.download`, que cria `<a>`, Blob e object URL.
//
// A avaliação deste módulo é inerte: nada de document, localStorage, canvas, Chart, download
// ou URL.createObjectURL antes de um método ser chamado.
import { CONFIG } from '../core/config.js';
import {
  escapeHtml,
  escapeAttr,
  normalize,
  compactName,
  initials,
  secondsToHours,
  secondsToHoursNumber,
  formatDate,
  pctClass,
  r1,
  issueKeyList,
  customFieldText
} from '../core/helpers.js';
import { state, squadCache } from '../core/state.js';
import { IMPEDIMENT_OPTIONS, filterSummaryText, issueMatchesFilters } from '../domain/issue-filters.js';
import { newRoleBuckets, addToRole, sortByRoleThenName } from '../domain/roles.js';
import {
  getIssueTypeRole,
  isContainerType,
  isExcludedFromCapacityChart,
  isIssueInCurrentSprint,
  getTrilha,
  EXEC_CATEGORIES,
  newExecBuckets,
  JORNADA_DIARIA_HORAS,
  COR_REGRESSIVO
} from '../domain/issues.js';
import { issueRules, STATUS_GROUP_ORDER, getStatusGroup } from '../domain/issue-rules.js';
import { sprintWindow, isLogInSprintWindow } from '../domain/worklogs.js';
import {
  getScopeRoster,
  personConfig,
  redactedRosterLabel,
  syncRedactedGeneration
} from '../domain/person-config.js';
import { stripStatusMarker, STATUS_LABEL, STATUS_GLYPH } from '../domain/person-presentation.js';
import { resolveScopeSelection, excludedButActive } from '../domain/analysis-scope.js';
import {
  buildReconciliationQueue,
  CANDIDATE_EXTERNAL,
  validarPessoas,
  nomeObservadoDe
} from '../domain/reconciliation.js';
import {
  createPersonPicker,
  PICKER_IDLE,
  PICKER_INVALID_QUERY,
  PICKER_LOADING,
  PICKER_EMPTY,
  PICKER_UNAVAILABLE,
  PICKER_SAVING,
  PICKER_ERROR,
  SOURCE_KNOWN
} from '../domain/person-picker.js';
import { $, $$, dom } from '../platform/dom.js';
import { sharedConfig } from '../platform/shared-config.js';
import { csv } from '../platform/csv.js';
import { ui } from './ui.js';
import { renderStatusBadge } from './status-badge.js';
import {
  formatCapacityBarLabel,
  formatCapacityCell,
  formatCapacityHours,
  roundCapacityHours,
  capacityCalcTitle,
  utilizationColor
} from './capacity-format.js';
import { chartFactory } from '../charts/chart-factory.js';
import { issueService } from '../services/issue-service.js';

// CP6: indicador ÚNICO dos três estados de status de conta, usado nas superfícies de roster
// (Configuração e Comprometimento estimado). Glifo textual (distinguível sem cor) + `title` e
// `aria-label` com o texto acessível. Compartilhado para não divergir entre as duas tabelas.
export const statusIndicatorHtml = status => {
  const label = STATUS_LABEL[status] || STATUS_LABEL.unknown;
  const glyph = STATUS_GLYPH[status] || STATUS_GLYPH.unknown;
  return `<span class="person-status person-status-${status}" title="${escapeAttr(label)}" aria-label="${escapeAttr(label)}">${glyph}</span> `;
};

// ── CP8: painel de RECONCILIAÇÃO assistida por slot ─────────────────────────────────────────
// A fila é reconstruída a cada render da aba Configuração e vive SÓ em memória. Os tokens são
// opacos, sequenciais e DESCARTÁVEIS: um render novo invalida os anteriores, e um clique com
// token velho falha de forma visível em vez de agir sobre a linha errada.
let filaReconciliacao = null;
let seqTokenReconciliacao = 0;
const nextTokenReconciliacao = () => `rq${++seqTokenReconciliacao}`;

// Rótulos ESTÁTICOS. O texto compreensível é sempre LOCAL — nenhuma mensagem do servidor é
// ecoada, e nenhum detalhe pessoal aparece.
const FORCA_LABEL = { strong: 'Forte', medium: 'Média', weak: 'Fraca' };
const RAZAO_LABEL = {
  'observed-key-linked': 'vínculo do Jira observado nesta sessão aponta para esta pessoa',
  'observed-key-unlinked': 'vínculo do Jira observado nesta sessão ainda não tem pessoa criada',
  'name-equality': 'mesmo nome de exibição em outro slot já vinculado',
  'neighbour-confirmed-binding': 'a mesma pessoa já está vinculada em slot vizinho da mesma iniciativa',
  'session-username-unique': 'usuário único nesta sessão (só reforça a sugestão)',
  'ambiguous-multiple-candidates': 'mais de um candidato plausível — nenhuma preferência automática'
};
// Por que "Vincular" está indisponível — texto LOCAL por razão estática da fila.
const MOTIVO_BLOQUEIO = {
  'scope-unresolved': 'Sem iniciativa resolvida: rode a migração de escopo antes de vincular.',
  'period-missing': 'A iniciativa deste slot não tem período para esta sprint.',
  'period-ambiguous': 'A iniciativa deste slot tem mais de um período para esta sprint.',
  default: 'Vinculação indisponível para este slot.'
};
export const RECONCILE_ERROR_TEXT = {
  // ⚠️ Nos 409 a configuração e a participação ficam INTACTAS, mas um registro OPACO de conflito
  // pode ser gravado.
  'binding-conflict':
    'Este slot já está vinculado a outra pessoa. A configuração e a participação ficam intactas; só um registro opaco de conflito é guardado.',
  'v1-projection-blocked':
    'Conflito de projeção v1: a mesma pessoa ficaria em duas linhas do mesmo período. A configuração e a participação ficam intactas; só um registro opaco de conflito é guardado.',
  'reconcile.slot:unknown': 'Este slot não existe mais no documento — recarregue. Nada foi alterado.',
  'reconcile.slot:invalid': 'Slot inválido. Nada foi alterado.',
  'reconcile.scope:unresolved':
    'Este slot ainda não pertence a uma iniciativa: rode a migração de escopo antes de vincular. Nada foi alterado.',
  'reconcile.period:missing': 'A iniciativa deste slot não tem período para esta sprint. Nada foi alterado.',
  'reconcile.period:ambiguous':
    'A iniciativa deste slot tem mais de um período para esta sprint. Nada foi alterado.',
  'identity.redaction:legacy-slot-blocked': 'Slot bloqueado por redação. Nada foi alterado.',
  'identity.redaction:external-key-blocked': 'Candidato bloqueado por redação. Nada foi alterado.',
  'identity.redaction:key-version-mismatch':
    'Bloqueio de redação não verificável nesta versão de chave. Nada foi alterado.',
  'identity.redaction:unavailable': 'Servidor sem segredo de redação — reconciliação indisponível.',
  'edit-code-invalid': 'Código de edição inválido/expirado — destrave de novo.',
  'reconcile-failed': 'Falha interna do servidor ao reconciliar. Nada foi alterado.'
};
// Texto para os códigos ESTRUTURAIS do envelope: são muitos e todos significam a mesma coisa para
// quem usa. Nenhum código cru vai para a tela.
export const reconcileErrorText = code => {
  if (RECONCILE_ERROR_TEXT[code]) return RECONCILE_ERROR_TEXT[code];
  if (typeof code === 'string' && code.startsWith('identity.')) {
    return 'Documento de identidade inconsistente — reconciliação recusada. Nada foi alterado.';
  }
  return 'Não foi possível reconciliar. Nada foi alterado.';
};

// ── CP9: picker de pessoas e inclusão manual ────────────────────────────────────────────────
// A instância do picker vive em MEMÓRIA e sobrevive entre renders (a busca não pode se perder a
// cada re-render), mas seus TOKENS são descartados a cada nova busca. `pickerContext` guarda o
// escopo/período resolvidos no último render — é ele que a ação de inclusão usa, para o cliente
// nunca "escolher" um período por conta própria.
let picker = null;
let pickerContext = null;
// CP10 — mapa token → intenção do ciclo de vida. Vive SÓ em memória e é limpo a cada render: o
// DOM nunca carrega `personId`, `analysisScopeId` ou `periodId`.
const lifecycleTokens = new Map();
let seqTokenLifecycle = 0;
const nextTokenLifecycle = () => `lc${++seqTokenLifecycle}`;
let seqTokenPicker = 0;
const nextTokenPicker = () => `pk${++seqTokenPicker}`;
const obterPicker = () => {
  if (!picker) {
    picker = createPersonPicker({
      nextToken: nextTokenPicker,
      // Carimbo da OBSERVAÇÃO LOCAL — o instante em que o JiraDash processou o resultado, nunca um
      // timestamp devolvido pelo Jira.
      now: () => new Date().toISOString()
    });
  }
  return picker;
};

const PICKER_ESTADO_TEXTO = {
  [PICKER_IDLE]: 'Digite parte do nome e clique em Buscar.',
  // Recusa LOCAL: o Jira nem foi consultado, então a mensagem não afirma nada sobre ele.
  [PICKER_INVALID_QUERY]: 'Digite algum texto antes de buscar — o Jira não foi consultado.',
  [PICKER_LOADING]: 'Buscando no Jira…',
  [PICKER_EMPTY]: 'Nenhuma pessoa encontrada no Jira.',
  [PICKER_SAVING]: 'Incluindo…'
};
// CP10 — ações do ciclo de vida aceitas pela UI. Lista FECHADA e estática: o `data-*` do DOM só
// pode conter um destes códigos, e qualquer outro valor é recusado antes de virar request.
export const LIFECYCLE_UI_ACTIONS = Object.freeze([
  'archive-participation',
  'restore-participation',
  'exclude-from-period-forward'
]);
// Texto LOCAL por código estático — nenhuma mensagem do servidor é ecoada.
export const LIFECYCLE_ERROR_TEXT = {
  'lifecycle.participation:unknown':
    'Esta pessoa não tem participação registrada neste período. Nada foi alterado.',
  'lifecycle.analysisScopeId:unknown':
    'A iniciativa desta sprint não existe mais no documento. Recarregue a aba; nada foi alterado.',
  'lifecycle.periodId:unknown':
    'O período desta sprint não existe mais no documento. Recarregue a aba; nada foi alterado.',
  'lifecycle.personId:unknown': 'Esta pessoa não existe mais no documento. Nada foi alterado.',
  'lifecycle.period.kind:unsupported':
    'Só períodos de sprint têm ciclo de vida nesta versão. Nada foi alterado.',
  'edit-code-invalid': 'Código de edição inválido ou expirado — destrave de novo. Nada foi alterado.'
};
// Texto LOCAL da edição CANÔNICA, por código estático — nenhuma mensagem do servidor é ecoada.
export const PERSON_FIELD_ERROR_TEXT = {
  'personConfig.personId:unknown': 'Esta pessoa não existe mais no documento. Nada foi salvo.',
  'personConfig.field:unknown': 'Campo de configuração desconhecido. Nada foi salvo.',
  'personConfig.value:invalid': 'Valor fora da régua de configuração. Nada foi salvo.',
  'personConfig.coord:incomplete':
    'Contexto de iniciativa e período incompleto (recarregue a aba). Nada foi salvo.',
  'personConfig.analysisScopeId:unknown':
    'A iniciativa desta sprint não existe mais no documento. Nada foi salvo.',
  'personConfig.periodId:unknown': 'O período desta sprint não existe mais no documento. Nada foi salvo.',
  'edit-code-invalid': 'Código de edição inválido ou expirado — destrave de novo. Nada foi salvo.'
};
export function personFieldErrorText(code) {
  if (typeof code === 'string' && PERSON_FIELD_ERROR_TEXT[code]) return PERSON_FIELD_ERROR_TEXT[code];
  return 'Não foi possível salvar a configuração. Nada foi alterado.';
}

export function lifecycleErrorText(code) {
  if (typeof code === 'string' && LIFECYCLE_ERROR_TEXT[code]) return LIFECYCLE_ERROR_TEXT[code];
  // Documento corrompido cai aqui: a mensagem descreve o EFEITO (nada mudou), sem ecoar o código
  // interno nem qualquer valor vindo do servidor.
  return 'Não foi possível aplicar a decisão. Nada foi alterado.';
}
export const INCLUDE_ERROR_TEXT = {
  // ⚠️ Nos 409 a configuração e a participação ficam INTACTAS, mas um registro OPACO de conflito
  // pode ser gravado — dizer "nada foi alterado" seria impreciso.
  'binding-conflict':
    'Esta coordenada da sprint já pertence a outra pessoa. A configuração e a participação ficam intactas; só um registro opaco de conflito é guardado.',
  'v1-projection-blocked':
    'Conflito de projeção v1: a mesma pessoa ficaria em duas linhas desta sprint. A configuração e a participação ficam intactas; só um registro opaco de conflito é guardado.',
  // ⚠️ O binding pode estar PENDENTE — a coordenada é que pertence a outra iniciativa, não
  // necessariamente a pessoa. E, como nos demais 409, um conflito opaco pode ser registrado.
  'scope-projection-blocked':
    'Esta coordenada da sprint pertence a outra iniciativa. Mover entre iniciativas é decisão própria; a configuração e a participação ficam intactas, e só um registro opaco de conflito é guardado.',
  'include.person.displayName:missing':
    'Esta pessoa não tem nome registrado para exibir no roster. Nada foi alterado.',
  'include.analysisScopeId:unknown': 'A iniciativa selecionada não existe mais. Nada foi alterado.',
  'include.periodId:unknown': 'O período desta sprint não existe mais. Nada foi alterado.',
  'include.period.kind:unsupported': 'Só é possível incluir em período de sprint. Nada foi alterado.',
  'identity.redaction:external-key-blocked': 'Pessoa bloqueada por redação. Nada foi alterado.',
  'identity.redaction:legacy-slot-blocked': 'Coordenada bloqueada por redação. Nada foi alterado.',
  'identity.redaction:unavailable': 'Servidor sem segredo de redação — inclusão indisponível.',
  'edit-code-invalid': 'Código de edição inválido/expirado — destrave de novo.',
  'include-person-failed': 'Falha interna do servidor ao incluir. Nada foi alterado.'
};
export const includeErrorText = code => {
  if (INCLUDE_ERROR_TEXT[code]) return INCLUDE_ERROR_TEXT[code];
  if (typeof code === 'string' && (code.startsWith('identity.') || code.startsWith('include.'))) {
    return 'Documento de identidade inconsistente — inclusão recusada. Nada foi alterado.';
  }
  return 'Não foi possível incluir a pessoa. Nada foi alterado.';
};

export const renderers = {
  jiraIssueLink(issue) {
    const safeKey = escapeHtml(issue.key);
    return `<a class="issue-key" href="${CONFIG.jiraBrowseBase}${encodeURIComponent(issue.key)}" target="_blank" rel="noopener noreferrer">${safeKey}</a>`;
  },
  renderMetrics() {
    const { metrics } = issueService.getDerived();
    const churn = issueService.getSprintChurn();
    const bugs = issueService.getSprintBugs();
    const addedCount = churn?.added.length ?? 0;
    const bugsOpenCount = bugs?.abertos.length ?? 0;

    dom.metricsGrid.innerHTML = `
            ${ui.renderMetric({ label: 'Issues (pai)', value: metrics.activeTotal, sub: `${metrics.subtaskCount} subtasks` })}
            ${ui.renderMetric({ label: 'Concluídas', value: metrics.done, className: pctClass(metrics.pct), sub: `${metrics.pct}% do total` })}
            ${ui.renderMetric({ label: 'Scope creep', value: churn ? addedCount : '—', className: addedCount > 0 ? 'warning' : '', sub: churn ? (addedCount > 0 ? 'adicionadas após sprint start' : 'sem adições após start') : 'sprint sem startDate' })}
            ${ui.renderMetric({ label: 'Impedidas', value: metrics.impediments, className: metrics.impediments > 0 ? 'danger' : '', sub: 'Flagged: Impediment' })}
            ${ui.renderMetric({ label: 'Bugs abertos', value: bugs ? bugsOpenCount : '—', className: bugsOpenCount > 0 ? 'danger' : '', sub: bugs ? (bugsOpenCount > 0 ? 'criados na sprint, sem resolução' : 'nenhum em aberto') : 'sprint sem janela' })}
            ${metrics.totalSp > 0 ? ui.renderMetric({ label: 'Story points', value: `${metrics.doneSp}<span style="font-size:14px;color:#aaa"> / ${metrics.totalSp}</span>`, sub: 'concluídos' }) : ''}
          `;
  },
  // UM filtro da barra: `<details>` + `<summary>` + checkboxes.
  //
  // ⚠️ Nada de `<select multiple>`: ele exige Ctrl/Cmd para marcar o segundo valor, e um clique
  // simples DESFAZ toda a seleção anterior — é o jeito clássico de perder as marcações sem
  // entender por quê. `<details>` é nativo, abre por clique e por teclado (Enter/Espaço no
  // `summary`), e os checkboxes ficam navegáveis por Tab sem nenhuma tecla modificadora.
  //
  // Cada checkbox transporta UM valor em `data-value` — nunca uma lista concatenada, cujo
  // separador quebraria no primeiro status que o contivesse.
  //
  // ⚠️ O `id` vem do ÍNDICE da opção, nunca do valor. `safeDomId` NÃO é injetivo: "Code Review",
  // "Code-Review" e "Code/Review" colapsam no mesmo identificador, e dois `<label for>` iguais
  // marcariam o checkbox errado — além de deixar a devolução de foco ambígua. O índice é único
  // dentro do painel por construção, e o valor continua sendo lido de `data-value`.
  issueFilterDropdown(dimensao, titulo, opcoes) {
    const selecionados = state.issueFilters[dimensao] || [];
    const aberto = state.issueFilterOpen === dimensao;
    const rotuloDe = valor => opcoes.find(o => o.value === valor)?.label ?? valor;
    const resumo = filterSummaryText(dimensao, selecionados, rotuloDe);
    const marcados = new Set(selecionados);
    const itens = opcoes
      .map(({ value, label }, indice) => {
        const id = `f-${dimensao}-${indice}`;
        return `
                  <label class="filter-option" for="${escapeAttr(id)}">
                    <input type="checkbox" id="${escapeAttr(id)}" data-action="filter-issues" data-filter="${escapeAttr(dimensao)}" data-value="${escapeAttr(value)}" ${marcados.has(value) ? 'checked' : ''} />
                    <span>${escapeHtml(label)}</span>
                  </label>`;
      })
      .join('');
    return `
              <details class="filter-dropdown" ${aberto ? 'open' : ''}>
                <summary id="${escapeAttr(`f-painel-${dimensao}`)}" data-action="filter-panel" data-filter="${escapeAttr(dimensao)}" aria-label="${escapeAttr(`${titulo}: ${resumo}`)}">
                  <span class="filter-summary-text">${escapeHtml(resumo)}</span>
                  <span class="filter-caret" aria-hidden="true">▾</span>
                </summary>
                <div class="filter-panel" role="group" aria-label="${escapeAttr(`Filtrar por ${titulo.toLowerCase()}`)}">
                  <button class="btn btn-sm filter-clear" type="button" data-action="filter-clear" data-filter="${escapeAttr(dimensao)}" ${selecionados.length ? '' : 'disabled'}>Todos</button>
                  ${itens || '<div class="empty-msg">Nenhuma opção.</div>'}
                </div>
              </details>`;
  },
  renderIssues() {
    const derived = issueService.getDerived();
    const filtros = state.issueFilters;
    const assigneeNames = [
      ...new Set(derived.parents.map(i => i.fields.assignee?.displayName || 'Não atribuído'))
    ].sort();
    const pageSize = CONFIG.issuePageSize;

    // ⚠️ A regra de correspondência vive em `domain/issue-filters.js` (pura, testável): OR dentro
    // da dimensão, AND entre dimensões, dimensão vazia não filtra. Aqui só se traduz a issue para
    // os quatro atributos que a regra conhece — e continua valendo só para PAIS, como sempre.
    const filtered = derived.parents.filter(issue => {
      const meta = derived.parentMetaByKey.get(issue.key);
      return issueMatchesFilters(
        {
          status: issue.fields.status.name,
          type: issue.fields.issuetype.name,
          assignee: issue.fields.assignee?.displayName || 'Não atribuído',
          isDone: !!meta?.isDone,
          isImpediment: !!meta?.isImpediment
        },
        filtros
      );
    });

    const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
    state.issuePage = Math.min(Math.max(1, state.issuePage), totalPages);
    const startIndex = (state.issuePage - 1) * pageSize;
    const pageItems = filtered.slice(startIndex, startIndex + pageSize);
    const endIndex = filtered.length ? startIndex + pageItems.length : 0;

    const rows = pageItems
      .map(parent => {
        const children = parent.children || [];
        const hasChildren = children.length > 0;
        const expanded = state.expandedRows.has(parent.key);
        const doneChildren = children.filter(
          child => issueService.getDerived().issueMetaByKey.get(child.key)?.isDone
        ).length;
        const allDone = hasChildren && doneChildren === children.length;
        const parentSummary = parent.fields.summary || 'Sem título';
        const parentAssignee = parent.fields.assignee
          ? compactName(parent.fields.assignee.displayName)
          : 'Não atribuído';
        const parentType = parent.fields.issuetype?.name || '—';
        const isImpediment = derived.parentMetaByKey.get(parent.key)?.isImpediment;

        const isContainerWithoutChildren = !hasChildren && isContainerType(parent);
        const subtaskBadge = hasChildren
          ? `<span class="subtask-count ${allDone ? 'all-done' : ''}">${doneChildren}/${children.length} subtasks</span>`
          : isContainerWithoutChildren
            ? `<span class="subtask-count warn" title="Tipo container (${escapeAttr(parentType)}) sem subtasks. Trabalho deve ser quebrado em subtasks para classificar DEV/QA corretamente.">⚠ sem subtasks</span>`
            : '';

        const impedimentDot = isImpediment ? '<span class="imp-dot" title="Issue impedida"></span>' : '';

        const parentRow = `
              <div class="grid-row parent-row ${expanded ? 'expanded' : ''} ${hasChildren ? '' : 'no-children'}" data-action="toggle-row" data-issue-key="${escapeAttr(parent.key)}">
                <div class="expand-btn ${expanded ? 'open' : ''}">${hasChildren ? '▶' : ''}</div>
                ${this.jiraIssueLink(parent)}
                <div class="truncate">
                  <div style="display:flex;align-items:center;gap:5px;min-width:0;">${impedimentDot}<div class="issue-summary" title="${escapeAttr(parentSummary)}">${escapeHtml(parentSummary)}</div></div>
                  ${subtaskBadge}
                </div>
                ${renderStatusBadge(parent.fields.status.name)}
                <div class="truncate text-muted" title="${escapeAttr(parentAssignee)}">${escapeHtml(parentAssignee)}</div>
                <div class="truncate text-muted" title="${escapeAttr(parentType)}">${escapeHtml(parentType)}</div>
              </div>`;

        const childRows =
          hasChildren && expanded
            ? `<div class="subtasks-area">${children
                .map(child => {
                  const childSummary = child.fields.summary || 'Sem título';
                  const childAssignee = child.fields.assignee
                    ? compactName(child.fields.assignee.displayName)
                    : 'Não atribuído';
                  const childType = child.fields.issuetype?.name || '—';
                  return `
                    <div class="grid-row subtask-row">
                      <div></div>
                      ${this.jiraIssueLink(child)}
                      <div class="issue-summary" title="${escapeAttr(childSummary)}">${escapeHtml(childSummary)}</div>
                      ${renderStatusBadge(child.fields.status.name)}
                      <div class="truncate text-muted" title="${escapeAttr(childAssignee)}">${escapeHtml(childAssignee)}</div>
                      <div class="truncate text-muted" title="${escapeAttr(childType)}">${escapeHtml(childType)}</div>
                    </div>`;
                })
                .join('')}</div>`
            : '';

        return parentRow + childRows;
      })
      .join('');

    $('#tab-issues').innerHTML = `
            <div class="filter-bar">
              ${this.issueFilterDropdown(
                'status',
                'Status',
                derived.statuses.map(s => ({ value: s, label: s }))
              )}
              ${this.issueFilterDropdown(
                'type',
                'Tipo',
                derived.types.map(t => ({ value: t, label: t }))
              )}
              ${this.issueFilterDropdown('impediment', 'Situação', IMPEDIMENT_OPTIONS)}
              ${this.issueFilterDropdown(
                'assignee',
                'Responsável',
                assigneeNames.map(n => ({ value: n, label: n }))
              )}
              <span>${filtered.length} issues</span>
            </div>
            <div class="table-wrap">
              <div class="grid-row parent-row row-header">
                <div></div><div>Chave</div><div>Título / Subtasks</div><div>Status</div><div>Responsável</div><div>Tipo</div>
              </div>
              ${rows || '<div class="empty-msg">Nenhuma issue encontrada.</div>'}
              <div class="pagination-bar">
                <span>Exibindo ${filtered.length ? startIndex + 1 : 0}-${endIndex} de ${filtered.length} issues · ${pageSize} por página</span>
                <div class="btn-row">
                  <button class="btn btn-sm" type="button" data-action="issue-prev-page" ${state.issuePage <= 1 ? 'disabled' : ''}>Anterior</button>
                  <span>Página ${state.issuePage} de ${totalPages}</span>
                  <button class="btn btn-sm" type="button" data-action="issue-next-page" ${state.issuePage >= totalPages ? 'disabled' : ''}>Próxima</button>
                </div>
              </div>
            </div>`;
  },
  renderAssignees() {
    if (state.renderedVersion.assignees === state.dataVersion && $('#tab-assignees').innerHTML.trim()) return;
    // Fresh render: zera estado de painel expandido (dados podem ter mudado).
    state.estimateDetailFor = null;

    const derived = issueService.getDerived();
    const { assignees, horas } = derived;
    const confSnap = personConfig.snapshot();
    const hoursCell = secs =>
      secs > 0 ? `${(secs / 3600).toFixed(1)}h` : '<span class="text-muted">—</span>';
    const capacityByTrilha = newRoleBuckets();
    let totalIssues = 0;
    let totalDone = 0;

    // Capacity DEV/QA: roster da sprint. Respeita o que está preenchido na Configuração
    // — inativa [X] com dias/horas configurados entra normalmente (caso retorno de
    // férias no meio da sprint). Cap = 0 (sem config) → não soma.
    for (const name of getScopeRoster(derived, confSnap)) {
      const conf = personConfig.get(name, confSnap);
      const cap = personConfig.capacityHours(conf);
      if (cap > 0) addToRole(capacityByTrilha, conf.papel, cap);
    }

    // === Tabela principal: identidade + issues + horas apontadas ===
    const personRowHtml = (name, data) => {
      const percent = data.total ? `${Math.round((data.done / data.total) * 100)}%` : '—';
      const conf = personConfig.get(name, confSnap);
      const papel = conf.papel || '—';
      totalIssues += data.total;
      totalDone += data.done;

      const personTrilhas = horas.horasByPersonByTrilha[name] || newRoleBuckets();
      const personCats = horas.horasByPersonByCategory[name] || newExecBuckets();
      const gestaoCell =
        personTrilhas.GESTAO > 0
          ? `<span title="Horas em gestão / reuniões — overhead esperado, não produtivo">${(personTrilhas.GESTAO / 3600).toFixed(1)}h</span>`
          : '<span class="text-muted">—</span>';
      const defeitoCell =
        personCats.DEFEITO > 0
          ? `<span class="warning" title="Horas apontadas em issues/subtasks de tipo Defeito na janela da sprint — recorte já contido em h DEV/h QA">${(personCats.DEFEITO / 3600).toFixed(1)}h</span>`
          : '<span class="text-muted">—</span>';

      return `
              <div class="grid-row arow">
                <div class="avatar">${escapeHtml(initials(name))}</div>
                <div class="truncate" title="${escapeAttr(name)}">${escapeHtml(name)}</div>
                <div class="text-center text-muted" style="font-size:12px;">${escapeHtml(papel)}</div>
                <div class="text-center">${data.total}</div>
                <div class="text-center success font-semibold">${data.done}</div>
                <div class="text-right text-muted">${percent}</div>
                <div class="text-right">${hoursCell(personTrilhas.DEV)}</div>
                <div class="text-right">${hoursCell(personTrilhas.QA)}</div>
                <div class="text-right">${defeitoCell}</div>
                <div class="text-right">${gestaoCell}</div>
              </div>`;
    };
    // Fidelidade com a aba Horas e o gráfico Planejado vs Apontado: quem apontou hora
    // em issue da sprint mas NÃO é responsável por nenhuma unidade de trabalho ganha
    // linha mesmo assim (issues 0) — senão as horas dele constam no rodapé Realizado
    // (por issue) mas somem das linhas, e a tabela não fecha com as outras visões.
    const assigneeNameSet = new Set(assignees.map(([name]) => name));
    const extraAuthors = Object.keys(horas.horasSpentByPerson)
      .filter(name => !assigneeNameSet.has(name) && (horas.horasSpentByPerson[name] || 0) > 0)
      .sort((a, b) => (horas.horasSpentByPerson[b] || 0) - (horas.horasSpentByPerson[a] || 0));
    const rows =
      assignees.map(([name, data]) => personRowHtml(name, data)).join('') +
      extraAuthors.map(name => personRowHtml(name, { total: 0, done: 0 })).join('');

    const overallPct = totalIssues ? Math.round((totalDone / totalIssues) * 100) : 0;
    const realizadoH = role => horas.realizadoByTrilha[role] / 3600;
    const capH = role => capacityByTrilha[role];
    const fmtH = v => (v > 0 ? `${v.toFixed(1)}h` : '—');
    // Capacity tem régua própria de apresentação (até duas casas): o realizado vem de worklog e
    // segue como sempre, em uma casa.
    const fmtCap = v => (v > 0 ? `${formatCapacityHours(v)}h` : '—');
    const eficPct = role => (capH(role) > 0 ? Math.round((realizadoH(role) / capH(role)) * 100) : null);
    const eficText = role => {
      const pct = eficPct(role);
      if (pct === null) return '<span class="text-muted">—</span>';
      const cls = pct > 100 ? 'danger' : pct >= 70 ? 'success' : 'warning';
      return `<span class="${cls}">${pct}%</span>`;
    };

    const realizadoDefeitoH = (horas.realizadoByCategory?.DEFEITO || 0) / 3600;
    const footer = assignees.length
      ? `
            <div class="grid-row arow arow-footer">
              <div></div>
              <div class="text-muted-soft">Realizado (por tipo da subtask)</div>
              <div class="text-center text-muted-soft">—</div>
              <div class="text-center">${totalIssues}</div>
              <div class="text-center success">${totalDone}</div>
              <div class="text-right text-muted">${overallPct}%</div>
              <div class="text-right">${fmtH(realizadoH('DEV'))}</div>
              <div class="text-right">${fmtH(realizadoH('QA'))}</div>
              <div class="text-right">${fmtH(realizadoDefeitoH)}</div>
              <div class="text-right">${fmtH(realizadoH('GESTAO'))}</div>
            </div>
            <div class="grid-row arow arow-footer">
              <div></div>
              <div class="text-muted-soft">Capacity (por papel configurado)</div>
              <div class="text-center text-muted-soft">—</div>
              <div class="text-center text-muted-soft">—</div>
              <div class="text-center text-muted-soft">—</div>
              <div class="text-right text-muted-soft">—</div>
              <div class="text-right">${fmtCap(capH('DEV'))}</div>
              <div class="text-right">${fmtCap(capH('QA'))}</div>
              <div class="text-right text-muted-soft">—</div>
              <div class="text-right text-muted-soft">—</div>
            </div>`
      : '';

    // === Card dedicado: comprometimento estimado por pessoa ===
    // Métrica focada na Estimativa Original. Drill-down "Sem est." abre painel embaixo.
    const deliveryClass = pct => (pct == null ? '' : pct > 80 ? 'success' : pct >= 40 ? 'warning' : 'danger');
    let totalEstSecs = 0;
    let totalEstDoneSecs = 0;
    let totalWithoutEstimate = 0;

    const estRows = assignees
      .map(([name, data]) => {
        const conf = personConfig.get(name, confSnap);
        // CP6: token opaco no atributo de identidade; nome de apresentação sem `[X]`; status só de
        // associação direta (proveniência do bucket), nunca por igualdade de nome.
        const ident = derived.presentation
          ? derived.presentation.resolve(name, {
              provenance: derived.rowProvenance,
              envelope: sharedConfig.identityEnvelope
            })
          : { token: name, presentationName: stripStatusMarker(name), status: 'unknown' };
        const token = ident.token;
        // CP10 — linha de pessoa REDIGIDA: rótulo neutro, nunca um nome fabricado nem o
        // `personId`. O token de apresentação continua opaco, como em todas as superfícies.
        const rotuloRedigido = redactedRosterLabel(name);
        const shownName = rotuloRedigido ?? ident.presentationName;
        const papel = conf.papel || '—';
        const estSecs = data.estimatedTotalSecs || 0;
        const doneSecs = data.estimatedDoneSecs || 0;
        const withoutEstList = data.withoutEstimateIssues || [];
        const withoutEstCount = withoutEstList.length;
        totalEstSecs += estSecs;
        totalEstDoneSecs += doneSecs;
        totalWithoutEstimate += withoutEstCount;

        const estHrs = estSecs / 3600;
        const doneHrs = doneSecs / 3600;
        const estCell = estHrs > 0 ? `${estHrs.toFixed(1)}h` : '<span class="text-muted">—</span>';
        const pct = estHrs > 0 ? Math.round((doneHrs / estHrs) * 100) : null;
        const pctCell =
          pct === null
            ? '<span class="text-muted">—</span>'
            : `<span class="${deliveryClass(pct)} font-semibold" title="${doneHrs.toFixed(1)}h entregues de ${estHrs.toFixed(1)}h estimadas">${pct}%</span>`;
        const semEstCell =
          withoutEstCount > 0
            ? `<span class="warning font-semibold erow-clickable" data-action="toggle-estimate-detail" data-person="${escapeAttr(token)}" title="Clique pra ver quais issues estão sem estimativa">${withoutEstCount}</span>`
            : '<span class="text-muted">—</span>';

        return `
              <div class="grid-row erow">
                <div class="avatar">${escapeHtml(initials(shownName))}</div>
                <div class="truncate" title="${escapeAttr(shownName)}">${statusIndicatorHtml(ident.status)}${escapeHtml(shownName)}</div>
                <div class="text-center text-muted" style="font-size:12px;">${escapeHtml(papel)}</div>
                <div class="text-right">${estCell}</div>
                <div class="text-right">${pctCell}</div>
                <div class="text-right">${semEstCell}</div>
              </div>`;
      })
      .join('');

    const totalEstHrs = totalEstSecs / 3600;
    const totalEstDoneHrs = totalEstDoneSecs / 3600;
    const overallEstPct = totalEstHrs > 0 ? Math.round((totalEstDoneHrs / totalEstHrs) * 100) : null;
    const estFooter = assignees.length
      ? `
            <div class="grid-row erow erow-footer">
              <div></div>
              <div class="text-muted-soft">Total da sprint</div>
              <div class="text-center text-muted-soft">—</div>
              <div class="text-right">${totalEstHrs > 0 ? totalEstHrs.toFixed(1) + 'h' : '<span class="text-muted-soft">—</span>'}</div>
              <div class="text-right">${overallEstPct === null ? '<span class="text-muted-soft">—</span>' : `<span class="${deliveryClass(overallEstPct)}">${overallEstPct}%</span>`}</div>
              <div class="text-right">${totalWithoutEstimate > 0 ? `<span class="warning">${totalWithoutEstimate}</span>` : '<span class="text-muted-soft">—</span>'}</div>
            </div>`
      : '';

    const estimateCard = assignees.length
      ? `
            <div class="chart-card mt-20">
              <div class="chart-title">Comprometimento estimado por pessoa</div>
              <div class="chart-subtitle">Quanto cada pessoa se comprometeu a entregar via Estimativa Original (subtasks + parents sem subtasks; canceladas fora).</div>
              <div class="table-wrap" style="margin-top:12px;">
                <div class="grid-row erow row-header">
                  <div></div>
                  <div>Responsável</div>
                  <div class="text-center">Papel</div>
                  <div class="text-right">h Est.</div>
                  <div class="text-right">% Entr.</div>
                  <div class="text-right" title="Issues atribuídas sem Estimativa Original. Tipos como Defeito, Code Review, Documentação Técnica, Apoio (não Apoio - Cliente), Reunião e Associado não contam (não exigem estimativa).">Sem est.</div>
                </div>
                ${estRows}
                ${estFooter}
              </div>
              <div id="estimate-detail" class="churn-detail" hidden></div>
              <div style="margin-top:12px;font-size:11px;color:var(--text-soft);line-height:1.7;">
                <strong>h Est.</strong> — soma da Estimativa Original atribuída à pessoa.<br>
                <strong>% Entr.</strong> — proporção já concluída do estimado. <span class="success">verde > 80%</span> · <span class="warning">amarelo 40-80%</span> · <span class="danger">vermelho < 40%</span>.<br>
                <strong>Sem est.</strong> — só conta tipos que exigem estimativa (Codificação, Execução de TI, Teste Automatizado, Apoio - Cliente, etc.). <em>Defeito, Code Review, Documentação Técnica, Apoio, Reunião e Associado</em> não entram aqui. Clique no número pra ver quais issues estão sem estimar.
              </div>
            </div>`
      : '';

    $('#tab-assignees').innerHTML = `
            <div class="chart-card">
              <div class="chart-title">Pessoas — issues e horas apontadas</div>
              <div class="table-wrap" style="margin-top:12px;">
                <div class="grid-row arow row-header">
                  <div></div>
                  <div>Responsável</div>
                  <div class="text-center">Papel</div>
                  <div class="text-center">Issues</div>
                  <div class="text-center">Feito</div>
                  <div class="text-right">% done</div>
                  <div class="text-right">h DEV</div>
                  <div class="text-right">h QA</div>
                  <div class="text-right">h Defeito</div>
                  <div class="text-right">h Gestão</div>
                </div>
                ${rows || '<div class="empty-msg">Nenhum responsável encontrado.</div>'}
                ${footer}
              </div>
              ${
                assignees.length
                  ? `
                <div style="display:flex;gap:18px;margin-top:12px;font-size:12px;align-items:center;flex-wrap:wrap;">
                  <span><strong>Eficiência da sprint</strong>:</span>
                  <span>DEV ${eficText('DEV')}</span>
                  <span>·</span>
                  <span>QA ${eficText('QA')}</span>
                  <span style="color:var(--text-soft);">(realizado / capacity)</span>
                </div>`
                  : ''
              }
              <div style="margin-top:12px;font-size:11px;color:var(--text-soft);line-height:1.7;">
                <strong>Papel</strong> — vem da configuração da pessoa.<br>
                <strong>h DEV / h QA / h Gestão</strong> — apontadas, separadas pelo tipo da subtask. Divergências (ex.: pessoa DEV com horas QA) são informação útil, não bug.<br>
                <strong>h Defeito</strong> — recorte: horas apontadas em issues de tipo Defeito na janela da sprint. Já estão contidas em h DEV/h QA (Defeito conta como trilha DEV) — não some as colunas. Mesma lente do "Horas em Defeitos" (Qualidade) e da categoria Defeito no gráfico Planejado vs Apontado.<br>
                <strong>h Gestão</strong> — overhead esperado (cerimônias, sub-tarefas de gestão); não conta como produtivo.<br>
                Pessoas com horas apontadas mas <strong>0 issues</strong> apontaram em issues da sprint sem serem responsáveis por nenhuma unidade de trabalho.
              </div>
            </div>
            ${estimateCard}`;

    state.renderedVersion.assignees = state.dataVersion;
  },
  // Atualiza o painel de drill-down do card "Comprometimento estimado por pessoa".
  // Chamado por handleClick quando usuário clica em "Sem est." de uma pessoa.
  updateEstimateDetail() {
    const container = $('#estimate-detail');
    if (!container) return;

    // Realça a célula clicável da pessoa selecionada.
    $$('[data-action="toggle-estimate-detail"]').forEach(cell => {
      cell.classList.toggle('is-active', cell.dataset.person === state.estimateDetailFor);
    });

    if (!state.estimateDetailFor) {
      container.innerHTML = '';
      container.hidden = true;
      return;
    }

    const derived = issueService.getDerived();
    // CP6: estimateDetailFor guarda o TOKEN opaco; resolve para o displayName do dataset atual.
    const detailName = derived.presentation
      ? derived.presentation.slotNameOf(state.estimateDetailFor)
      : state.estimateDetailFor;
    const entry = detailName == null ? undefined : derived.assignees.find(([name]) => name === detailName);
    const list = entry?.[1]?.withoutEstimateIssues || [];

    const chipsHtml = list.length
      ? list
          .map(
            issue => `
            <div class="churn-chip">
              <a class="issue-key" href="${CONFIG.jiraBrowseBase}${encodeURIComponent(issue.key)}" target="_blank" rel="noopener noreferrer">${escapeHtml(issue.key)}</a>
              <span class="churn-chip-meta" title="${escapeAttr(issue.summary)}">${escapeHtml(issue.type)}${issue.summary ? ` · ${escapeHtml(issue.summary.length > 60 ? issue.summary.slice(0, 60) + '…' : issue.summary)}` : ''}</span>
            </div>`
          )
          .join('')
      : '<div style="font-size:12px;color:var(--text-muted);">Nenhuma issue sem estimativa para esta pessoa.</div>';

    container.innerHTML = `
            <div class="churn-detail-header">
              <span><strong>${escapeHtml(stripStatusMarker(detailName || ''))}</strong> · sem estimativa · ${list.length} issue${list.length === 1 ? '' : 's'}</span>
              <button class="churn-detail-close" type="button" data-action="close-estimate-detail">× fechar</button>
            </div>
            <div class="churn-chips">${chipsHtml}</div>`;
    container.hidden = false;
  },
  buildBurndownData() {
    const derived = issueService.getDerived();
    if (!state.sprintDates.start) return null;

    const sprintEnd = state.sprintDates.end || new Date();
    const sprintEndEod = new Date(sprintEnd);
    sprintEndEod.setHours(23, 59, 59, 999);
    const today = new Date();
    today.setHours(23, 59, 59, 999);
    // dataEnd precisa usar sprintEndEod (não sprintEnd cru): o Jira devolve
    // endDate com horário (ex.: 18:00), e sem isso o último dia da sprint
    // virava null porque endOfDay (23:59:59) > dataEnd (18:00).
    const dataEnd = today < sprintEndEod ? today : sprintEndEod;

    const sprintDays = [];
    let cursor = new Date(state.sprintDates.start);
    cursor.setHours(0, 0, 0, 0);
    // Reatribui em vez de mutar in-place — mesmo motivo de productiveHoursBetween:
    // setDate é invisível para a análise estática e continua sendo o avanço correto
    // sob horário de verão.
    while (cursor <= sprintEndEod) {
      if (cursor.getDay() !== 0 && cursor.getDay() !== 6) sprintDays.push(new Date(cursor));
      const nextDay = new Date(cursor);
      nextDay.setDate(nextDay.getDate() + 1);
      cursor = nextDay;
    }
    if (sprintDays.length < 2) return null;

    const labels = sprintDays.map(d => d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }));
    const lastIndex = sprintDays.length - 1;

    const win = sprintWindow();
    // addedDate por épico (quando entrou nesta sprint), pro burnup mostrar scope creep.
    // Planejadas: addedDate <= start. Adicionadas depois: addedDate > start.
    const churn = issueService.getSprintChurn();
    const addedByKey = new Map();
    if (churn) {
      for (const entry of [...churn.planned, ...churn.added])
        addedByKey.set(entry.issue.key, entry.addedDate);
    }
    const sprintStart = state.sprintDates.start;
    const parentInfo = derived.parents.map(parent => {
      const meta = derived.parentMetaByKey.get(parent.key) || {};
      const estHours = (meta.estimatedEffective || 0) / 3600;
      const addedDate = addedByKey.get(parent.key) || sprintStart;

      const resolved = parent.fields.resolutiondate ? new Date(parent.fields.resolutiondate) : null;

      const isDoneByCategory = parent.fields.status?.statusCategory?.key === 'done';
      const isDone = meta.isDone || isDoneByCategory;

      const closedAt =
        resolved || (isDone && meta.enteredCurrentStatus ? new Date(meta.enteredCurrentStatus) : null);

      // Eventos de worklog dentro da janela da sprint, somando o próprio parent + filhos,
      // ordenados por data. Usado pelo burndown "Por apontamento" (progressivo).
      const events = [];
      const addLogs = issue => {
        for (const log of issue.fields.worklog?.worklogs || []) {
          if (!win || !isLogInSprintWindow(log, win)) continue;
          events.push({ date: new Date(log.started), sec: log.timeSpentSeconds || 0 });
        }
      };
      addLogs(parent);
      for (const child of parent.children || []) addLogs(child);
      events.sort((a, b) => a.date - b.date);

      return { estHours, closedAt, events, addedDate };
    });

    const totalIssues = parentInfo.length;
    const totalEstHours = parentInfo.reduce((s, p) => s + p.estHours, 0);

    const idealHours = sprintDays.map((_, i) => Number((totalEstHours * (1 - i / lastIndex)).toFixed(2)));
    const idealIssues = sprintDays.map((_, i) => Number((totalIssues * (1 - i / lastIndex)).toFixed(2)));

    const actualHoursBinary = [];
    const actualHoursProgressive = [];
    const actualIssues = [];
    // Burnup de escopo (Fase 2): escopo total presente na sprint vs escopo concluído,
    // dia a dia. Total sobe quando entra issue depois do start (scope creep).
    const scopeTotalHours = [];
    const scopeDoneHours = [];

    for (const day of sprintDays) {
      const endOfDay = new Date(day);
      endOfDay.setHours(23, 59, 59, 999);
      if (endOfDay > dataEnd) {
        actualHoursBinary.push(null);
        actualHoursProgressive.push(null);
        actualIssues.push(null);
        scopeTotalHours.push(null);
        scopeDoneHours.push(null);
        continue;
      }
      let remBinary = 0;
      let remProgressive = 0;
      let remIssues = 0;
      let scopeTotal = 0;
      let scopeDone = 0;
      for (const p of parentInfo) {
        const stillOpen = !p.closedAt || p.closedAt > endOfDay;
        if (!stillOpen) continue;
        remBinary += p.estHours;
        remIssues += 1;

        // Progressivo: estHours - horas apontadas no escopo (parent+filhos) até o EoD.
        let workedSec = 0;
        for (const ev of p.events) {
          if (ev.date <= endOfDay) workedSec += ev.sec;
          else break;
        }
        remProgressive += Math.max(0, p.estHours - workedSec / 3600);
      }
      // Burnup conta por presença/fechamento (independe de aberto/fechado):
      // total = já entrou na sprint até o EoD; done = já fechou até o EoD.
      for (const p of parentInfo) {
        if (p.addedDate && p.addedDate > endOfDay) continue; // ainda não tinha entrado
        scopeTotal += p.estHours;
        if (p.closedAt && p.closedAt <= endOfDay) scopeDone += p.estHours;
      }
      actualHoursBinary.push(Number(Math.max(0, remBinary).toFixed(2)));
      actualHoursProgressive.push(Number(Math.max(0, remProgressive).toFixed(2)));
      actualIssues.push(remIssues);
      scopeTotalHours.push(Number(scopeTotal.toFixed(2)));
      scopeDoneHours.push(Number(scopeDone.toFixed(2)));
    }

    return {
      labels,
      idealHours,
      actualHoursBinary,
      actualHoursProgressive,
      idealIssues,
      actualIssues,
      scopeTotalHours,
      scopeDoneHours,
      scopeAddedAfterStart: churn ? churn.added.length : 0,
      parentsWithoutEstimate: parentInfo.filter(p => p.estHours === 0).length,
      totalParents: parentInfo.length
    };
  },
  renderCharts() {
    if (state.renderedVersion.charts === state.dataVersion && $('#statusChart')) return;

    const derived = issueService.getDerived();
    const { metrics, charts } = derived;
    // Base = escopo válido (canceladas e tipo Gestão fora do denominador).
    const pctIssues = metrics.pct;
    const issueColor =
      pctIssues >= 80
        ? CONFIG.colors.success
        : pctIssues >= 50
          ? CONFIG.colors.warning
          : CONFIG.colors.danger;

    // Conclusão "Por horas" espelha exatamente a curva de burndown selecionada
    // (Fechamento ou Apontamento): % = 1 − restante hoje ÷ inicial. Assim o número
    // sempre fecha com o ponto final do gráfico. No toggle é recalculado em renderBurndownHours.
    const burndown = this.buildBurndownData();
    const hoursProgress = this.burndownHoursProgress(burndown, state.burndownView);
    const adherence = this.computeEstimationAdherence(derived);
    const consumo = this.computeCapacityConsumption(derived);
    const carryOver = this.getCarryOverData(derived);

    $('#tab-charts').innerHTML = `
            <div class="chart-card mb-20">
              <div class="chart-title">Conclusão da Sprint</div>
              <div style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:28px;padding-top:6px;">
                ${this.renderProgressBlock('Por quantidade de issues', `${metrics.done} de ${metrics.activeTotal} issues concluídas`, pctIssues, issueColor)}
                <div id="hoursProgressBlock">${this.renderHoursProgressBlock(hoursProgress)}</div>
              </div>
            </div>
            ${this.renderAdherenceCard(adherence)}
            ${this.renderCapacityConsumptionCard(consumo, hoursProgress.pct)}
            ${
              burndown
                ? `
              <div class="charts-grid">
                <div class="chart-card">
                  <div class="chart-title" style="display:flex;align-items:center;justify-content:space-between;gap:8px;flex-wrap:wrap;">
                    <span>Burndown — Issues</span>
                    <button class="btn btn-sm" type="button" data-action="export-chart-png" data-chart-key="burndownI" data-base-name="burndown-issues" title="Baixa o gráfico como PNG com fundo transparente">↓ PNG</button>
                  </div>
                  <div class="chart-wrap" style="height:260px;"><canvas id="burndownIChart"></canvas></div>
                </div>
                <div class="chart-card">
                  <div class="chart-title" style="display:flex;align-items:center;justify-content:space-between;gap:8px;flex-wrap:wrap;">
                    <span>
                      Burndown — Escopo estimado (por fechamento)
                      ${
                        burndown.parentsWithoutEstimate > 0
                          ? `
                        <span class="perf-note" title="Issues sem Estimativa Ajustada não pesam neste burndown de escopo, mas continuam contando no burndown de issues. Sprints com muitas issues nessa condição fazem o gráfico parecer melhor do que a realidade — trate como baseline incompleto.">
                          ⚠ ${burndown.parentsWithoutEstimate} de ${burndown.totalParents} sem estimativa
                        </span>`
                          : ''
                      }
                    </span>
                    <div style="display:flex;gap:6px;align-items:center;flex-wrap:wrap;">
                      <span class="chart-subtitle" style="margin:0;" title="A issue só queima sua Estimativa Ajustada quando entra em Done (resolutiondate). Mede entrega por resultado, não horas apontadas. Consumo de esforço fica no card 'Consumo de Capacidade'.">Estimativa Ajustada · queima ao fechar</span>
                      <button class="btn btn-sm" type="button" data-action="export-chart-png" data-chart-key="burndownH" data-base-name="burndown-escopo" title="Baixa o gráfico como PNG com fundo transparente">↓ PNG</button>
                    </div>
                  </div>
                  <div class="chart-wrap" style="height:260px;"><canvas id="burndownHChart"></canvas></div>
                </div>
              </div>
              <div class="chart-card mt-20">
                <div class="chart-title" style="display:flex;align-items:center;justify-content:space-between;gap:8px;flex-wrap:wrap;">
                  <span>
                    Burnup — Escopo da Sprint
                    ${
                      burndown.scopeAddedAfterStart > 0
                        ? `
                      <span class="perf-note warning" title="Escopo cresceu durante a sprint: ${burndown.scopeAddedAfterStart} issue(s) entraram depois do início. A linha 'Escopo total' sobe quando isso acontece — se ela cresce enquanto o time entrega, o burndown sozinho esconde a mudança de escopo.">
                        ⚠ ${burndown.scopeAddedAfterStart} adicionada${burndown.scopeAddedAfterStart === 1 ? '' : 's'} após o início
                      </span>`
                        : ''
                    }
                  </span>
                  <button class="btn btn-sm" type="button" data-action="export-chart-png" data-chart-key="burnup" data-base-name="burnup-escopo" title="Baixa o gráfico como PNG com fundo transparente">↓ PNG</button>
                </div>
                <div class="chart-subtitle" style="margin-bottom:8px;">Escopo total (Estimativa Ajustada presente na sprint) vs concluído ao longo do tempo. O gap é o que falta entregar; saltos na linha total = scope creep.</div>
                <div class="chart-wrap" style="height:260px;"><canvas id="burnupChart"></canvas></div>
              </div>`
                : ''
            }
            <div class="charts-grid mt-20">
              <div class="chart-card">
                <div class="chart-title">Distribuição por Status</div>
                <div class="chart-subtitle">Issues pai, sem subtarefas</div>
                <div class="donut-with-list">
                  <div class="chart-wrap"><canvas id="statusChart"></canvas></div>
                  <ul class="donut-legend" id="statusLegend"></ul>
                </div>
              </div>
              <div class="chart-card">
                <div class="chart-title">Distribuição por Tipo de Issue</div>
                <div class="chart-subtitle">Issues pai, sem subtarefas</div>
                <div class="donut-with-list">
                  <div class="chart-wrap"><canvas id="typeChart"></canvas></div>
                  <ul class="donut-legend" id="typeLegend"></ul>
                </div>
              </div>
            </div>
            ${this.renderCarryOverCard(carryOver)}`;

    chartFactory.destroy(['status', 'type', 'burndownH', 'burndownI', 'burnup']);

    const statusGrouped = new Map();
    for (const parent of derived.parents) {
      const rawName = parent.fields.status?.name || 'Sem status';
      const group = getStatusGroup(parent);
      if (!statusGrouped.has(group)) statusGrouped.set(group, { total: 0, details: new Map() });
      const entry = statusGrouped.get(group);
      entry.total += 1;
      entry.details.set(rawName, (entry.details.get(rawName) || 0) + 1);
    }
    const statusEntries = STATUS_GROUP_ORDER.filter(group => statusGrouped.has(group))
      .map(group => {
        const entry = statusGrouped.get(group);
        return {
          label: group,
          total: entry.total,
          details: [...entry.details.entries()]
            .map(([name, count]) => ({ name, count }))
            .sort((a, b) => b.count - a.count)
        };
      })
      .sort((a, b) => b.total - a.total);
    const statusTotal = statusEntries.reduce((s, e) => s + e.total, 0);

    const donutBaseOpts = {
      responsive: true,
      maintainAspectRatio: false,
      cutout: '60%',
      plugins: { legend: { display: false } }
    };

    const renderDonutLegend = (containerId, entries, total) => {
      const html = entries
        .map((e, i) => {
          const pct = total > 0 ? Math.round((e.total / total) * 100) : 0;
          const color = CONFIG.chartPalette[i % CONFIG.chartPalette.length];
          return `<li><span class="dot" style="background:${color};"></span><span class="label" title="${escapeAttr(e.label)}">${escapeHtml(e.label)}</span><span class="value">${e.total}<span class="pct">(${pct}%)</span></span></li>`;
        })
        .join('');
      $(containerId).innerHTML = html;
    };

    state.charts.status = new Chart($('#statusChart'), {
      type: 'doughnut',
      data: {
        labels: statusEntries.map(e => e.label),
        datasets: [
          { data: statusEntries.map(e => e.total), backgroundColor: CONFIG.chartPalette, borderWidth: 0 }
        ]
      },
      options: {
        ...donutBaseOpts,
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: ctx => {
                const pct = statusTotal > 0 ? Math.round((ctx.parsed / statusTotal) * 100) : 0;
                return `${ctx.label}: ${ctx.parsed} (${pct}%)`;
              },
              afterBody: items => {
                const entry = statusEntries[items[0].dataIndex];
                if (!entry?.details?.length) return [];
                return ['', 'Status do Jira:', ...entry.details.map(d => `  • ${d.name}: ${d.count}`)];
              }
            }
          }
        }
      }
    });
    renderDonutLegend('#statusLegend', statusEntries, statusTotal);

    const typeEntries = Object.entries(charts.typeCount)
      .map(([label, total]) => ({ label, total }))
      .sort((a, b) => b.total - a.total);
    const typeTotal = typeEntries.reduce((s, e) => s + e.total, 0);

    state.charts.type = new Chart($('#typeChart'), {
      type: 'doughnut',
      data: {
        labels: typeEntries.map(e => e.label),
        datasets: [
          { data: typeEntries.map(e => e.total), backgroundColor: CONFIG.chartPalette, borderWidth: 0 }
        ]
      },
      options: {
        ...donutBaseOpts,
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: ctx => {
                const pct = typeTotal > 0 ? Math.round((ctx.parsed / typeTotal) * 100) : 0;
                return `${ctx.label}: ${ctx.parsed} (${pct}%)`;
              }
            }
          }
        }
      }
    });
    renderDonutLegend('#typeLegend', typeEntries, typeTotal);

    state.cachedBurndown = burndown;
    if (burndown) {
      this.renderBurndownHours();
      state.charts.burndownI = chartFactory.burndown(
        '#burndownIChart',
        burndown.labels,
        burndown.idealIssues,
        burndown.actualIssues,
        CONFIG.colors.success,
        'Issues restantes'
      );
      state.charts.burnup = chartFactory.burnup(
        '#burnupChart',
        burndown.labels,
        burndown.scopeTotalHours,
        burndown.scopeDoneHours,
        'Horas (estimativa ajustada)'
      );
    }

    state.renderedVersion.charts = state.dataVersion;
  },
  renderPlanning() {
    if (state.renderedVersion.planning === state.dataVersion && $('#capacityChart')) return;
    // Fresh render: zera estado de painel expandido (dados podem ter mudado).
    state.planningExpanded = null;

    const derived = issueService.getDerived();
    const churn = issueService.getSprintChurn();
    const pctOf = (n, total) => (total > 0 ? Math.round((n / total) * 100) : 0);

    // Card clicável de uma categoria do churn — abre painel embaixo com chips.
    // unavailable=true → card desabilitado (sem clique, valor "—").
    // showPct=false → não exibe percentual (usado em Removidas, denominador não faz sentido).
    const churnCard = ({ cat, label, count, sub, className, showPct = true, unavailable = false }) => {
      if (unavailable) {
        return `
                <div class="metric-card churn-card churn-card-unavailable" title="${escapeAttr(sub)}">
                  <div class="metric-label">${escapeHtml(label)}</div>
                  <div class="metric-value text-muted">—</div>
                  <div class="metric-sub">${sub}</div>
                </div>`;
      }
      const pctLabel = showPct
        ? ` <span style="font-size:14px;color:#aaa">(${pctOf(count, churn ? churn.total : 0)}%)</span>`
        : '';
      return `
              <div class="metric-card churn-card" data-action="toggle-planning-detail" data-planning-card="${cat}">
                <div class="metric-label">${escapeHtml(label)} <span class="churn-toggle">▶</span></div>
                <div class="metric-value ${className || ''}">${count}${pctLabel}</div>
                <div class="metric-sub">${sub}</div>
              </div>`;
    };

    const removedUnavailable = churn && churn.removed === null;
    const removedCount = churn && Array.isArray(churn.removed) ? churn.removed.length : 0;

    const churnSection = churn
      ? `
            <div class="chart-card mb-20">
              <div class="chart-title">Composição da sprint</div>
              <div class="chart-subtitle">${churn.total} issue${churn.total === 1 ? '' : 's'} pai na sprint atual${churn.sprintName ? ` · ${escapeHtml(churn.sprintName)}` : ''}</div>
              <div class="metrics-grid" style="margin-top:12px;">
                ${churnCard({
                  cat: 'planned',
                  label: 'Planejadas',
                  count: churn.planned.length,
                  sub: 'entraram antes do início da sprint'
                })}
                ${churnCard({
                  cat: 'added',
                  label: 'Adicionadas após start',
                  count: churn.added.length,
                  sub: churn.added.length > 0 ? 'scope creep — entrou durante a sprint' : 'nenhuma',
                  className: churn.added.length > 0 ? 'warning' : ''
                })}
                ${churnCard({
                  cat: 'carryover',
                  label: 'Carryover',
                  count: churn.carryover.length,
                  sub: churn.carryover.length > 0 ? 'vieram de outra sprint antes desta' : 'nenhuma'
                })}
                ${churnCard({
                  cat: 'removed',
                  label: 'Removidas',
                  count: removedCount,
                  sub: removedUnavailable
                    ? 'consulta indisponível'
                    : removedCount > 0
                      ? 'tiradas da sprint após start'
                      : 'nenhuma',
                  showPct: false,
                  unavailable: removedUnavailable
                })}
              </div>
              <div id="planning-detail" class="churn-detail" hidden></div>
              <div style="margin-top:10px;font-size:11px;color:var(--text-soft);line-height:1.5;">
                Clique em um card pra listar as issues da categoria. <strong>Planejadas</strong> + <strong>Adicionadas</strong> = total atual na sprint. <strong>Carryover</strong> é ortogonal (pode estar em qualquer das duas anteriores). <strong>Removidas</strong> vêm de uma consulta JQL paralela (mesmo projeto, fora da sprint, atualizadas na janela) + leitura do changelog — funcionam mesmo sem APIs privadas.
              </div>
            </div>`
      : '';

    $('#tab-planning').innerHTML = `
            ${churnSection}
            <div class="chart-card mb-20">
              <div class="chart-title" style="display:flex;align-items:center;justify-content:space-between;gap:8px;flex-wrap:wrap;">
                <span>Capacity vs Comprometimento estimado por pessoa</span>
                <div style="display:flex;gap:6px;align-items:center;flex-wrap:wrap;">
                  <div class="btn-row" style="gap:2px;" role="group" aria-label="Visão de estimativa">
                    <button class="btn btn-sm" type="button" data-action="set-allocation-view" data-view="original" title="Soma timeoriginalestimate de cada issue da sprint (= Estimativa Original do Jira, planejamento bruto)">Original (Jira)</button>
                    <button class="btn btn-sm" type="button" data-action="set-allocation-view" data-view="ajustado" title="Restante + Apontado na sprint, limitado ao que da Estimativa Original entrou nesta sprint (Original − apontado antes). Desconta rollover e não infla com estouro de apontamento">Ajustado (sprint)</button>
                  </div>
                  <button class="btn btn-sm" type="button" data-action="export-allocation-csv" title="Exporta as issues consideradas no cálculo do gráfico para conferência no Jira">↓ Exportar CSV</button>
                </div>
              </div>
              <div id="assigneeSubtitle" class="chart-subtitle"></div>
              <div style="position:relative;height:280px;"><canvas id="assigneeChart"></canvas></div>
            </div>
            <div class="charts-grid mb-20">
              <div class="chart-card">
                <div class="chart-title" style="display:flex;align-items:center;justify-content:space-between;gap:8px;flex-wrap:wrap;">
                  <span>Capacidade Produtiva vs Alocação</span>
                  <div style="display:flex;gap:6px;align-items:center;flex-wrap:wrap;">
                    <div class="btn-row" style="gap:2px;" role="group" aria-label="Visão de estimativa">
                      <button class="btn btn-sm" type="button" data-action="set-capacity-view" data-view="original" title="Estimativa Original (timeoriginalestimate) — committed no planning, valor fixo">Original (Jira)</button>
                      <button class="btn btn-sm" type="button" data-action="set-capacity-view" data-view="ajustado" title="Restante + Apontado na sprint, limitado ao que da Estimativa Original entrou nesta sprint — desconta rollover e não infla com estouro">Ajustado (sprint)</button>
                    </div>
                    <button class="btn btn-sm" type="button" data-action="export-chart-png" data-chart-key="capacity" data-base-name="capacidade-vs-alocacao" title="Baixa o gráfico como PNG com fundo transparente">↓ PNG</button>
                  </div>
                </div>
                <div id="capacitySubtitle" class="chart-subtitle">Capacity (supply) · Estimado Original (committed) · Apontado (feito) · Gestão/NA/Defeito fora</div>
                <div id="capacityPeriodSummary" style="margin-bottom:8px;font-size:11px;color:var(--text-soft);line-height:1.5;"></div>
                <div style="position:relative;height:280px;"><canvas id="capacityChart"></canvas></div>
                <div id="capacityNoEstWarning" style="margin-top:8px;font-size:11px;color:var(--text-soft);line-height:1.5;" hidden></div>
              </div>
              <div class="chart-card">
                <div class="chart-title">Saldo da Sprint <span style="display:inline-block;width:16px;height:16px;border-radius:50%;background:var(--text-soft);color:#fff;font-size:11px;line-height:16px;text-align:center;cursor:help;font-weight:600;vertical-align:middle;" title="Saldo = Capacity Vivo − Restante. Tudo medido por PAPEL configurado (DEV/QA). &#10;&#10;Pode divergir do 'Capacidade Produtiva vs Alocação (Ajustado)' do outro chart porque lá o Estimado é por TRILHA da issue (tipo do trabalho), enquanto Apontado é por papel da pessoa — mistura propositalmente as duas lentes.&#10;&#10;• Este chart responde: 'o TIME tem horas livres para mais escopo?' (lente papel, consistente).&#10;• O outro responde: 'trabalho do tipo X cabe na capacity das pessoas de tipo X?' (lente mista, expõe vazamento entre papéis).&#10;&#10;Pra planejamento de PO, use este. Pra calibrar composição do time, use o outro.">?</span></div>
                <div class="chart-subtitle" title="Capacity total = Codificação/Teste + Regressivo. O apontamento NÃO é atribuído automaticamente a um período — o Jira não tem hoje um campo confiável pra isso — então o saldo continua sendo total por papel.">Capacity Vivo (queima pelo apontamento real do time) · Restante a fazer · Apontado (feito) · Gestão/NA/Defeito fora · capacity total = Cod./Teste + Regressivo</div>
                <div style="position:relative;height:280px;"><canvas id="capacityAtualChart"></canvas></div>
                <div id="saldoSprintLabel" style="margin-top:8px;font-size:12px;line-height:1.5;text-align:center;font-weight:600;"></div>
                <div id="saldoSprintWarning" style="margin-top:6px;font-size:11px;color:var(--text-soft);line-height:1.5;" hidden></div>
              </div>
            </div>
            <div class="chart-card">
              <div class="chart-title">Planejado vs Apontado por pessoa</div>
              <div class="chart-subtitle">Barra 1 = jornada planejada (8h/dia × total de dias configurados), dividida em Capacity Codificação/Teste + Capacity Regressivo + Gestão planejada (o resto da jornada). Barra 2 = apontado real por categoria. Cores pareadas: azul = tarefas, âmbar = gestão. Total no topo de cada barra; passe o mouse pra ver jornada, capacity por período, apontado e saldo.</div>
              <div style="position:relative;height:280px;"><canvas id="sprintViewChart"></canvas></div>
            </div>`;

    chartFactory.destroy(['capacity', 'capacityAtual', 'sprintView', 'assignee']);

    const confSnap = personConfig.snapshot();

    // Capacity (supply): por papel da pessoa configurada — soma das capacities.
    const roleCap = newRoleBuckets();
    // Estimado Original: por trilha da issue (demand committed no planning).
    const roleEstOriginal = newRoleBuckets();
    // Estimado Ajustado: por trilha da issue, usa meta.estimated (restante + apontado
    // na sprint, capado no Original que entrou na sprint — ver getEstimatedInSprint).
    const roleEstAjustado = newRoleBuckets();
    // Restante: por trilha da issue, só pendentes (timeestimate).
    const roleRestante = newRoleBuckets();
    // Apontado: por papel da pessoa (supply usada, lente de utilização).
    const roleSpent = newRoleBuckets();
    // Apontado em issues sem Estimativa Original — alimenta o aviso embaixo do
    // gráfico "Capacidade Produtiva vs Alocação" mostrando o gap real.
    const roleSpentNoEst = newRoleBuckets();

    // Capacity = roster da sprint. Respeita o que está preenchido na Configuração:
    // inativas [X] entram se tiverem dias/horas configurados (ex.: pessoa que volta
    // de férias na metade da sprint e o time já contabiliza parte do mês). Pra excluir
    // alguém, basta deixar dias e horas vazios na Configuração.
    // roleCap segue sendo o TOTAL (soma dos dois períodos) — nenhum consumidor existente
    // muda de valor. Os buckets por período existem só para empilhar a barra de supply.
    const roleCapCodificacaoTeste = newRoleBuckets();
    const roleCapRegressivo = newRoleBuckets();
    for (const name of getScopeRoster(derived, confSnap)) {
      const conf = personConfig.get(name, confSnap);
      addToRole(roleCapCodificacaoTeste, conf.papel, personConfig.capacityCodificacaoTesteHours(conf));
      addToRole(roleCapRegressivo, conf.papel, personConfig.capacityRegressivoHours(conf));
      addToRole(roleCap, conf.papel, personConfig.capacityHours(conf));
    }

    // Loop único: alimenta Estimado/Restante (por trilha) e Apontado (por papel).
    // Gestão e Não classificado ficam fora dos dois gráficos (overhead, não produtivo).
    // Defeito também fica fora — é trabalho reativo, não compromisso planejado.
    const win = sprintWindow();
    for (const issue of derived.issues) {
      const meta = derived.issueMetaByKey.get(issue.key);
      if (!meta) continue;
      const trilha = getTrilha(issue);
      if (trilha === 'GESTAO' || trilha === 'NA') continue;
      if (isExcludedFromCapacityChart(issue)) continue;

      // Estimado Original — por trilha da issue, sem filtro de assignee.
      // Mostra o "compromisso total" planejado pra esse tipo de trabalho.
      const originalSecs = meta.originalEstimated || 0;
      if (originalSecs > 0) addToRole(roleEstOriginal, trilha, originalSecs / 3600);

      // Estimado Ajustado — por trilha. meta.estimated = restante + apontado na sprint
      // com teto no Original que entrou na sprint (desconta rollover, não infla com estouro).
      const ajustadoSecs = meta.estimated || 0;
      if (ajustadoSecs > 0) addToRole(roleEstAjustado, trilha, ajustadoSecs / 3600);

      // Restante — só pendentes (não isDone). Usa timeestimate "vivo" do Jira.
      if (!meta.isDone) {
        const restanteSecs =
          issue.fields.timeestimate || issue.fields.timetracking?.remainingEstimateSeconds || 0;
        if (restanteSecs > 0) addToRole(roleRestante, trilha, restanteSecs / 3600);
      }

      // Apontado — por papel do AUTOR do worklog (não do assignee da issue).
      // Evita creditar horas a quem só está no campo Assignee mas não apontou.
      for (const log of issue.fields.worklog?.worklogs || []) {
        if (win && !isLogInSprintWindow(log, win)) continue;
        const author = log.author?.displayName;
        if (!author) continue;
        const secs = log.timeSpentSeconds || 0;
        if (secs <= 0) continue;
        const papel = personConfig.get(author, confSnap).papel;
        const hrs = secs / 3600;
        addToRole(roleSpent, papel, hrs);
        // Warning: apontamento em issue sem Estimativa Original.
        if (originalSecs === 0) addToRole(roleSpentNoEst, papel, hrs);
      }
    }

    // Cache os buckets pro toggle do "Capacidade Produtiva vs Alocação" reusar
    // sem reprocessar o loop. renderCapacityChart() lê daqui.
    state.capacityCharts = {
      roleCap,
      roleCapCodificacaoTeste,
      roleCapRegressivo,
      roleEstOriginal,
      roleEstAjustado,
      roleRestante,
      roleSpent,
      roleSpentNoEst
    };
    // Visão de Apontamento por pessoa: só quem tem Capacity PREENCHIDA na Configuração
    // desta sprint (dias × horas > 0) — mesma regra do "Capacity vs Comprometimento
    // estimado por pessoa". Inativa [X] entra se configurada; quem apontou hora mas não
    // tem config fica fora deste gráfico (as horas continuam íntegras na aba Horas).
    const sprintViewPeople = new Set(getScopeRoster(derived, confSnap));
    const personRows = [...sprintViewPeople]
      .map(name => {
        const conf = personConfig.get(name, confSnap);
        const spent = (derived.horas.horasSpentByPerson[name] || 0) / 3600;
        const catSecs = derived.horas.horasByPersonByCategory[name] || newExecBuckets();
        const byCategory = {};
        for (const cat of EXEC_CATEGORIES) byCategory[cat.key] = r1((catSecs[cat.key] || 0) / 3600);
        // Planejado: jornada = 8h/dia × TODOS os dias configurados (Cod./Teste +
        // Regressivo); Capacity = horas produtivas × dias, por período; Gestão
        // planejada = o resto da jornada. Documento legado cai no fallback de
        // diasSprint dentro do personConfig, então o resultado anterior é preservado.
        // ⚠️ Capacity em DUAS casas (horas produtivas podem ser 5,12/dia); worklog e estimativa
        // seguem em uma, como sempre. `gestaoPlanejada` é o complemento da capacity dentro da
        // jornada, então acompanha a mesma precisão — senão a pilha 'plan' não fecha.
        const capCod = roundCapacityHours(personConfig.capacityCodificacaoTesteHours(conf));
        const capReg = roundCapacityHours(personConfig.capacityRegressivoHours(conf));
        const cap = roundCapacityHours(capCod + capReg);
        const jornada = r1(JORNADA_DIARIA_HORAS * personConfig.diasTotal(conf));
        const gestaoPlanejada = roundCapacityHours(Math.max(0, jornada - cap));
        return {
          name: compactName(name),
          capCod,
          capReg,
          cap,
          jornada,
          gestaoPlanejada,
          spent: r1(spent),
          role: conf.papel,
          byCategory
        };
      })
      .filter(row => row.cap > 0)
      .sort(sortByRoleThenName);

    // Chart "Capacidade Produtiva vs Alocação" — respeita o toggle Original/Ajustado.
    this.renderCapacityChart();

    // Chart "Saldo da Sprint" — Capacity Vivo (queima por apontamento real) vs Restante.
    const capacityLabels = ['Desenvolvimento', 'Teste'];
    const capacityRoles = ['DEV', 'QA'];
    // Capacity Vivo: capacity inicial menos apontamento REAL do time (por papel).
    // Resposta direta da pergunta "quantas horas produtivas o time ainda tem disponíveis".
    // Visualmente: Cap Vivo + Apontado = Capacity Inicial (sempre).
    // Negativo (time apontou mais do que tinha de capacity) é exibido como 0 + warning.
    const capacityVivoRaw = {};
    const capacityVivo = {};
    const wasNegative = {};
    const saldoLivre = {};
    for (const role of capacityRoles) {
      capacityVivoRaw[role] = roleCap[role] - roleSpent[role];
      capacityVivo[role] = Math.max(0, capacityVivoRaw[role]);
      wasNegative[role] = capacityVivoRaw[role] < 0;
      saldoLivre[role] = capacityVivo[role] - roleRestante[role];
    }

    state.charts.capacityAtual = new Chart($('#capacityAtualChart'), {
      type: 'bar',
      data: {
        labels: capacityLabels,
        datasets: [
          {
            label: 'Capacity Vivo',
            data: capacityRoles.map(role => r1(capacityVivo[role])),
            backgroundColor: '#2d2d2d',
            borderRadius: 4
          },
          {
            label: 'Restante',
            data: capacityRoles.map(role => r1(roleRestante[role])),
            backgroundColor: '#BA7517',
            borderRadius: 4
          },
          {
            label: 'Apontado',
            data: capacityRoles.map(role => r1(roleSpent[role])),
            backgroundColor: '#26C6DA',
            borderRadius: 4
          }
        ]
      },
      options: chartFactory.barChartOpts('Horas'),
      plugins: [chartFactory.barLabelPlugin]
    });

    // Label de Saldo Livre abaixo do gráfico — cor semântica (verde sobra, vermelho falta).
    const saldoLabel = $('#saldoSprintLabel');
    if (saldoLabel) {
      const formatSaldo = (role, label) => {
        const v = saldoLivre[role];
        const sign = v > 0 ? '+' : v < 0 ? '' : ''; // negativo já vem com sinal
        const cls = v > 5 ? 'success' : v >= -5 ? 'warning' : 'danger';
        return `<span><strong>${label}</strong> <span class="${cls}">${sign}${r1(v)}h</span></span>`;
      };
      saldoLabel.innerHTML = `Saldo livre: ${formatSaldo('DEV', 'DEV')} · ${formatSaldo('QA', 'QA')}`;
    }

    // Warning: capacity vivo negativa (time apontou mais que sua capacity produtiva).
    // Pode ser overrun real ou capacity config desatualizada (dias/horas planejados).
    const saldoWarn = $('#saldoSprintWarning');
    if (saldoWarn) {
      const negRoles = capacityRoles
        .filter(r => wasNegative[r])
        .map(r => `${r} apontou ${r1(roleSpent[r])}h em ${r1(roleCap[r])}h de capacity`);
      if (negRoles.length) {
        saldoWarn.innerHTML = `<span class="warning">⚠</span> ${negRoles.join(' · ')} — apontamento ultrapassou a capacity planejada (overrun real ou config de dias/horas desatualizada).`;
        saldoWarn.hidden = false;
      } else {
        saldoWarn.hidden = true;
      }
    }

    // Desenha o TOTAL de cada barra empilhada no topo. Agrupa datasets por `stack`
    // ('plan' e 'real'), soma só os visíveis (respeita legenda) e escreve o total acima
    // da coluna — o número sempre bate com o topo desenhado.
    const stackTotalPlugin = {
      id: 'stackTotals',
      afterDatasetsDraw(chart) {
        const { ctx, chartArea } = chart;
        const yScale = chart.scales.y;
        const textColor = (
          getComputedStyle(document.documentElement).getPropertyValue('--text') || '#1a1a1a'
        ).trim();
        const stacks = {};
        chart.data.datasets.forEach((ds, i) => {
          (stacks[ds.stack || String(i)] ??= []).push(i);
        });
        const n = chart.data.labels.length;
        for (let j = 0; j < n; j += 1) {
          for (const idxs of Object.values(stacks)) {
            let total = 0;
            let anyVisible = false;
            for (const d of idxs) {
              if (!chart.isDatasetVisible(d)) continue;
              anyVisible = true;
              total += chart.data.datasets[d].data[j] || 0;
            }
            if (!anyVisible || total <= 0) continue;
            const bar = chart.getDatasetMeta(idxs[0]).data[j];
            if (!bar) continue;
            const y = Math.max(yScale.getPixelForValue(total) - 5, chartArea.top + 10);
            ctx.save();
            ctx.fillStyle = textColor;
            ctx.font = 'bold 12px -apple-system,sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'bottom';
            // A pilha 'plan' é capacity + gestão planejada: uma casa aqui esconderia a segunda
            // casa da capacity e o total deixaria de bater com as parcelas desenhadas.
            ctx.fillText(`${formatCapacityBarLabel(total)}h`, bar.x, y);
            ctx.restore();
          }
        }
      }
    };

    // Duas barras por pessoa (Chart.js agrupa por `stack`):
    //  - 'plan'  = jornada planejada: Capacity Cod./Teste + Capacity Regressivo + Gestão planejada
    //  - 'real'  = apontado real, quebrado por categoria de execução
    // Cores pareadas de propósito: Capacity Sprint↔Tarefas (azul) e Gestão planejada↔
    // Gestão apontada (âmbar), pra comparar planejado vs realizado do mesmo tipo a olho.
    state.charts.sprintView = new Chart($('#sprintViewChart'), {
      type: 'bar',
      data: {
        labels: personRows.map(p => p.name),
        datasets: [
          {
            label: 'Capacity Cod./Teste (plan.)',
            data: personRows.map(p => p.capCod),
            backgroundColor: '#378ADD',
            borderRadius: 4,
            stack: 'plan',
            valueFormatter: formatCapacityBarLabel
          },
          {
            label: 'Capacity Regressivo (plan.)',
            data: personRows.map(p => p.capReg),
            backgroundColor: COR_REGRESSIVO,
            borderRadius: 4,
            stack: 'plan',
            valueFormatter: formatCapacityBarLabel
          },
          {
            label: 'Gestão planejada',
            data: personRows.map(p => p.gestaoPlanejada),
            backgroundColor: '#BA7517',
            borderRadius: 4,
            stack: 'plan',
            valueFormatter: formatCapacityBarLabel
          },
          ...EXEC_CATEGORIES.map(cat => ({
            label: cat.label,
            data: personRows.map(p => p.byCategory[cat.key]),
            backgroundColor: cat.color,
            borderRadius: 4,
            stack: 'real'
          }))
        ]
      },
      options: {
        ...chartFactory.barChartOpts('Horas'),
        plugins: {
          legend: { position: 'bottom', labels: { font: { size: 11 }, boxWidth: 12, padding: 10 } },
          tooltip: {
            callbacks: {
              footer: items => {
                if (!items.length) return '';
                const p = personRows[items[0].dataIndex];
                const totalApontado = r1(EXEC_CATEGORIES.reduce((s, c) => s + p.byCategory[c.key], 0));
                const saldoTarefa = r1(p.cap - p.byCategory.TAREFA);
                return (
                  `Jornada (planejado): ${p.jornada}h = Capacity ${p.cap}h + Gestão plan. ${p.gestaoPlanejada}h\n` +
                  `Capacity: Cod./Teste ${p.capCod}h + Regressivo ${p.capReg}h\n` +
                  `Apontado total: ${totalApontado}h\n` +
                  `Saldo tarefas (Capacity − Tarefas apontadas): ${saldoTarefa > 0 ? '+' : ''}${saldoTarefa}h`
                );
              }
            }
          }
        },
        scales: {
          x: { stacked: true, ticks: { font: { size: 11 } } },
          y: {
            stacked: true,
            beginAtZero: true,
            ticks: { font: { size: 11 }, callback: v => `${v}h` },
            title: { display: true, text: 'Horas', font: { size: 11 }, color: CONFIG.colors.muted }
          }
        }
      },
      plugins: [chartFactory.barLabelPlugin, stackTotalPlugin]
    });

    this.renderAllocationChart();

    state.renderedVersion.planning = state.dataVersion;
  },
  // Toggle do painel expansível dos cards de Composição da sprint.
  // Renderiza chips (key + tipo + data/autor) da categoria selecionada; null = fechado.
  // Para 'removed': mostra data da remoção + autor + status badge.
  updatePlanningDetail() {
    const container = $('#planning-detail');
    if (!container) return;

    $$('[data-planning-card]').forEach(card => {
      const isActive = card.dataset.planningCard === state.planningExpanded;
      card.classList.toggle('is-active', isActive);
      const arrow = card.querySelector('.churn-toggle');
      if (arrow) arrow.textContent = isActive ? '▼' : '▶';
    });

    if (!state.planningExpanded) {
      container.innerHTML = '';
      container.hidden = true;
      return;
    }

    const churn = issueService.getSprintChurn();
    if (!churn) {
      container.hidden = true;
      return;
    }

    const labelMap = {
      planned: 'Planejadas',
      added: 'Adicionadas após start',
      carryover: 'Carryover',
      removed: 'Removidas da sprint'
    };
    const isRemoved = state.planningExpanded === 'removed';
    // 'removed' pode ser null (indisponível) — null → [] na visualização.
    const entries = Array.isArray(churn[state.planningExpanded]) ? churn[state.planningExpanded] : [];
    const fmtShortDate = date =>
      new Date(date).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });

    const chipsHtml = entries.length
      ? entries
          .map(entry => {
            const issue = entry.issue;
            const type = issue.fields.issuetype?.name || '—';
            const keyLink = `<a class="issue-key" href="${CONFIG.jiraBrowseBase}${encodeURIComponent(issue.key)}" target="_blank" rel="noopener noreferrer">${escapeHtml(issue.key)}</a>`;
            if (isRemoved) {
              // Removidas: data da remoção + autor + status badge (mais informação que as outras).
              const dateLabel = entry.removedAt ? fmtShortDate(entry.removedAt) : '';
              const author = entry.author || '';
              const status = issue.fields.status?.name || '';
              const badge = status
                ? ` <span class="badge-inline ${issueRules.getStatusBadgeClass(status)}" title="${escapeAttr(status)}">${escapeHtml(status)}</span>`
                : '';
              const metaParts = [escapeHtml(type)];
              if (dateLabel) metaParts.push(dateLabel);
              if (author) metaParts.push(escapeHtml(author));
              return `
                <div class="churn-chip">
                  ${keyLink}
                  <span class="churn-chip-meta">${metaParts.join(' · ')}${badge}</span>
                </div>`;
            }
            const dateLabel = entry.addedDate ? fmtShortDate(entry.addedDate) : '';
            return `
              <div class="churn-chip">
                ${keyLink}
                <span class="churn-chip-meta">${escapeHtml(type)}${dateLabel ? ` · ${dateLabel}` : ''}</span>
              </div>`;
          })
          .join('')
      : '<div style="font-size:12px;color:var(--text-muted);">Nenhuma issue nesta categoria.</div>';

    container.innerHTML = `
            <div class="churn-detail-header">
              <span><strong>${escapeHtml(labelMap[state.planningExpanded] || '')}</strong> · ${entries.length} issue${entries.length === 1 ? '' : 's'}</span>
              <button class="churn-detail-close" type="button" data-action="close-planning-detail">× fechar</button>
            </div>
            <div class="churn-chips">${chipsHtml}</div>`;
    container.hidden = false;
  },
  renderBurndownHours() {
    const b = state.cachedBurndown;
    if (!b) return;
    const view = state.burndownView === 'apontamento' ? 'apontamento' : 'fechamento';
    const actualHours = view === 'apontamento' ? b.actualHoursProgressive : b.actualHoursBinary;
    chartFactory.destroy(['burndownH']);
    state.charts.burndownH = chartFactory.burndown(
      '#burndownHChart',
      b.labels,
      b.idealHours,
      actualHours,
      CONFIG.colors.info,
      'Horas restantes'
    );
    $$('[data-action="set-burndown-view"]').forEach(btn => {
      btn.classList.toggle('btn-primary', btn.dataset.view === view);
    });
    // Mantém o card "Por horas concluídas" sincronizado com a curva exibida.
    const block = $('#hoursProgressBlock');
    if (block) block.innerHTML = this.renderHoursProgressBlock(this.burndownHoursProgress(b, view));
  },
  // (Re)cria o chart "Capacidade Produtiva vs Alocação" usando o bucket que corresponde
  // ao toggle atual (Original / Ajustado). Lê dados do cache state.capacityCharts
  // populado em renderPlanning — chamado tanto na renderização inicial quanto no toggle.
  renderCapacityChart() {
    const data = state.capacityCharts;
    if (!data || !$('#capacityChart')) return;
    const view = state.capacityChartView === 'ajustado' ? 'ajustado' : 'original';
    const roleEst = view === 'original' ? data.roleEstOriginal : data.roleEstAjustado;
    const estLabel = view === 'original' ? 'Estimado Original' : 'Estimado Ajustado';
    const subtitle =
      view === 'original'
        ? 'Capacity (supply) · Estimado Original (committed) · Apontado (feito) · Gestão/NA/Defeito fora'
        : 'Capacity (supply) · Estimado Ajustado (restante + apontado na sprint, teto no Original) · Apontado (feito) · Gestão/NA/Defeito fora';
    const capacityLabels = ['Desenvolvimento', 'Teste'];
    const capacityRoles = ['DEV', 'QA'];

    // A barra de supply é empilhada nos dois períodos; Estimado e Apontado ficam em
    // stacks próprios, ou seja, seguem sendo barras separadas. A soma visual das duas
    // fases é exatamente o capacityHours() total de antes.
    const baseOpts = chartFactory.barChartOpts('Horas');
    chartFactory.destroy(['capacity']);
    state.charts.capacity = new Chart($('#capacityChart'), {
      type: 'bar',
      data: {
        labels: capacityLabels,
        datasets: [
          {
            label: 'Capacity Cod./Teste',
            data: capacityRoles.map(role => r1(data.roleCapCodificacaoTeste[role])),
            backgroundColor: '#2d2d2d',
            borderRadius: 4,
            stack: 'cap'
          },
          {
            label: 'Capacity Regressivo',
            data: capacityRoles.map(role => r1(data.roleCapRegressivo[role])),
            backgroundColor: COR_REGRESSIVO,
            borderRadius: 4,
            stack: 'cap'
          },
          {
            label: estLabel,
            data: capacityRoles.map(role => r1(roleEst[role])),
            backgroundColor: CONFIG.chartPalette[4],
            borderRadius: 4,
            stack: 'est'
          },
          {
            label: 'Apontado',
            data: capacityRoles.map(role => r1(data.roleSpent[role])),
            backgroundColor: '#26C6DA',
            borderRadius: 4,
            stack: 'apontado'
          }
        ]
      },
      options: {
        ...baseOpts,
        plugins: {
          ...baseOpts.plugins,
          tooltip: {
            callbacks: {
              footer: items => {
                if (!items.length) return '';
                const role = capacityRoles[items[0].dataIndex];
                const cod = r1(data.roleCapCodificacaoTeste[role]);
                const reg = r1(data.roleCapRegressivo[role]);
                return `Capacity total: ${r1(cod + reg)}h (Cod./Teste ${cod}h + Regressivo ${reg}h)`;
              }
            }
          }
        },
        scales: {
          x: { ...baseOpts.scales.x, stacked: true },
          y: { ...baseOpts.scales.y, stacked: true }
        }
      },
      plugins: [chartFactory.barLabelPlugin]
    });

    // Resumo por período (compacto). Subtotais por papel só quando há valor.
    const periodSummary = $('#capacityPeriodSummary');
    if (periodSummary) {
      const totalCod = capacityRoles.reduce((sum, role) => sum + data.roleCapCodificacaoTeste[role], 0);
      const totalReg = capacityRoles.reduce((sum, role) => sum + data.roleCapRegressivo[role], 0);
      const porPapel = capacityRoles
        .filter(role => data.roleCap[role] > 0)
        .map(
          role =>
            `${role} ${r1(data.roleCap[role])}h (${r1(data.roleCapCodificacaoTeste[role])}h + ${r1(data.roleCapRegressivo[role])}h)`
        );
      periodSummary.textContent =
        `Capacity Cod./Teste ${r1(totalCod)}h · Regressivo ${r1(totalReg)}h · Total ${r1(totalCod + totalReg)}h` +
        (porPapel.length ? ` · ${porPapel.join(' · ')}` : '');
    }

    // Subtítulo dinâmico explicando a lente ativa.
    const subtitleEl = $('#capacitySubtitle');
    if (subtitleEl) subtitleEl.textContent = subtitle;

    // Botões: realça o ativo.
    $$('[data-action="set-capacity-view"]').forEach(btn => {
      btn.classList.toggle('btn-primary', btn.dataset.view === view);
    });

    // Aviso: apontado em issues sem Estimativa Original (gap real). Texto adapta à view.
    const noEstWarn = $('#capacityNoEstWarning');
    if (noEstWarn) {
      const noEstParts = [];
      if (data.roleSpentNoEst.DEV > 0)
        noEstParts.push(`<strong>DEV</strong> ${data.roleSpentNoEst.DEV.toFixed(1)}h`);
      if (data.roleSpentNoEst.QA > 0)
        noEstParts.push(`<strong>QA</strong> ${data.roleSpentNoEst.QA.toFixed(1)}h`);
      if (noEstParts.length) {
        const tail =
          view === 'original'
            ? 'não aparecem na barra Estimado Original'
            : 'são contabilizadas em Ajustado quando há timeestimate, mas indicam falta de commitment no planning';
        noEstWarn.innerHTML = `<span class="warning">⚠</span> ${noEstParts.join(' · ')} apontadas em issues sem Estimativa Original — ${tail}. Veja quais em <em>Pessoas → Comprometimento estimado</em>.`;
        noEstWarn.hidden = false;
      } else {
        noEstWarn.hidden = true;
      }
    }
  },
  // Exporta canvas de qualquer chart como PNG transparente. Chart.js renderiza sem
  // fill no fundo por padrão, então o PNG sai com alpha — bom pra colar em slides/docs.
  // Adiciona sufixo do toggle quando aplicável pra distinguir views (Original/Ajustado,
  // Fechamento/Apontamento).
  exportChartPng(chartKey, baseName) {
    const chart = state.charts[chartKey];
    if (!chart) return;
    let suffix = '';
    if (chartKey === 'capacity') {
      suffix = `-${state.capacityChartView === 'ajustado' ? 'ajustado' : 'original'}`;
    } else if (chartKey === 'burndownH') {
      suffix = `-${state.burndownView === 'apontamento' ? 'apontamento' : 'fechamento'}`;
    }
    const projectKey = state.allIssues[0]?.key?.split('-')[0] || 'sprint';
    const stamp = new Date().toISOString().slice(0, 10);
    const fileName = `${baseName}${suffix}-${projectKey}-${stamp}.png`;
    const url = chart.toBase64Image('image/png', 1.0);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  },
  renderAllocationChart() {
    if (!state.allIssues.length) return;
    const derived = issueService.getDerived();
    const confSnap = personConfig.snapshot();

    // Sprint-ajustado (visão atual): meta.estimated (restante + apontado na sprint,
    // teto no Original que entrou na sprint), somado por assignee.
    // Original (Jira): timeoriginalestimate cru, mostra o planejamento bruto.
    // FILTROS iguais ao card "Comprometimento estimado por pessoa" (aba Pessoas):
    // cancelada fora (não é comprometimento) e só issues da sprint atual (carryover de
    // subtask em outra sprint fica fora) — os dois números batem entre si.
    const ajustadoByPerson = {};
    const originalByPerson = {};
    for (const issue of derived.issues) {
      const name = issue.fields.assignee?.displayName;
      if (!name) continue;
      const meta = derived.issueMetaByKey.get(issue.key);
      if (meta?.isCancelled) continue;
      if (!isIssueInCurrentSprint(issue)) continue;
      const adj = (meta?.estimated || 0) / 3600;
      if (adj > 0) ajustadoByPerson[name] = (ajustadoByPerson[name] || 0) + adj;
      const orig =
        (issue.fields.timeoriginalestimate || issue.fields.timetracking?.originalEstimateSeconds || 0) / 3600;
      if (orig > 0) originalByPerson[name] = (originalByPerson[name] || 0) + orig;
    }

    // Conjunto de pessoas: quem tem Capacity PREENCHIDA na Configuração desta sprint
    // (dias × horas > 0) — a mesma coluna Capacity da aba Configuração. Inativas [X]
    // entram se configuradas; quem está sem config fica fora mesmo com estimativa
    // (o aviso no subtítulo lista essas horas pra não sumirem em silêncio).
    const allPeople = [...new Set(getScopeRoster(derived, confSnap))].filter(
      name =>
        name && name !== 'Não atribuído' && personConfig.capacityHours(personConfig.get(name, confSnap)) > 0
    );

    const allocRows = allPeople
      .map(name => {
        const conf = personConfig.get(name, confSnap);
        return {
          name: compactName(name),
          // Capacity vai com DUAS casas (a régua de horas produtivas permite 5,12h/dia); as
          // estimativas continuam em uma casa, como sempre — são grandezas diferentes.
          capCod: roundCapacityHours(personConfig.capacityCodificacaoTesteHours(conf)),
          capReg: roundCapacityHours(personConfig.capacityRegressivoHours(conf)),
          cap: roundCapacityHours(personConfig.capacityHours(conf)),
          est: r1(ajustadoByPerson[name] || 0),
          orig: r1(originalByPerson[name] || 0),
          role: conf.papel
        };
      })
      .sort(sortByRoleThenName);

    // Estimativas de gente fora do gráfico (sem config preenchida) — lista no subtítulo.
    const shownPeople = new Set(allPeople);
    const hiddenWithEstimate = [
      ...new Set([...Object.keys(ajustadoByPerson), ...Object.keys(originalByPerson)])
    ]
      .filter(name => !shownPeople.has(name))
      .map(name => `${compactName(name)} ${r1(ajustadoByPerson[name] || originalByPerson[name] || 0)}h`);

    const view = state.allocationView === 'original' ? 'original' : 'ajustado';
    const isOriginal = view === 'original';
    const secondLabel = isOriginal ? 'Estimado original (Jira)' : 'Estimado ajustado (sprint)';
    const secondData = allocRows.map(p => (isOriginal ? p.orig : p.est));

    // Capacity empilhada nos dois períodos (stack 'cap'); o Estimado fica em stack
    // próprio, então continua comparável com o TOPO da pilha — que é o mesmo total
    // de capacity de antes.
    const allocOpts = chartFactory.barChartOpts('Horas');
    chartFactory.destroy(['assignee']);
    state.charts.assignee = new Chart($('#assigneeChart'), {
      type: 'bar',
      data: {
        labels: allocRows.map(p => p.name),
        datasets: [
          {
            label: 'Capacity Cod./Teste',
            data: allocRows.map(p => p.capCod),
            backgroundColor: '#2d2d2d',
            borderRadius: 4,
            stack: 'cap',
            valueFormatter: formatCapacityBarLabel
          },
          {
            label: 'Capacity Regressivo',
            data: allocRows.map(p => p.capReg),
            backgroundColor: COR_REGRESSIVO,
            borderRadius: 4,
            stack: 'cap',
            valueFormatter: formatCapacityBarLabel
          },
          {
            label: secondLabel,
            data: secondData,
            backgroundColor: CONFIG.chartPalette[4],
            borderRadius: 4,
            stack: 'est'
          }
        ]
      },
      options: {
        ...allocOpts,
        plugins: {
          ...allocOpts.plugins,
          tooltip: {
            callbacks: {
              footer: items => {
                if (!items.length) return '';
                const p = allocRows[items[0].dataIndex];
                const est = isOriginal ? p.orig : p.est;
                return (
                  `Cod./Teste: ${p.capCod}h\nRegressivo: ${p.capReg}h\n` +
                  `Capacity total: ${p.cap}h\n${secondLabel}: ${est}h\n` +
                  `Saldo total (Capacity − Estimado): ${r1(p.cap - est) > 0 ? '+' : ''}${r1(p.cap - est)}h`
                );
              }
            }
          }
        },
        scales: {
          x: { ...allocOpts.scales.x, stacked: true },
          y: { ...allocOpts.scales.y, stacked: true }
        }
      },
      plugins: [chartFactory.barLabelPlugin]
    });

    const totalOrig = allocRows.reduce((sum, p) => sum + p.orig, 0);
    const totalAdj = allocRows.reduce((sum, p) => sum + p.est, 0);
    const delta = totalOrig - totalAdj;
    const deltaLabel =
      delta > 0
        ? `Δ ${r1(delta)}h (Original maior — provável trabalho já feito em sprints anteriores)`
        : delta < 0
          ? `Δ ${r1(delta)}h (Ajustado maior — provável processo com pai estimado ou rollover sem original)`
          : 'Δ 0h';
    const subtitle = $('#assigneeSubtitle');
    if (subtitle) {
      const hiddenNote = hiddenWithEstimate.length
        ? ` · ⚠ Com estimativa mas sem config (fora do gráfico): ${hiddenWithEstimate.join(', ')}`
        : '';
      subtitle.textContent = `Total Original: ${r1(totalOrig)}h · Total Ajustado: ${r1(totalAdj)}h · ${deltaLabel}${hiddenNote}`;
    }

    $$('[data-action="set-allocation-view"]').forEach(btn => {
      btn.classList.toggle('btn-primary', btn.dataset.view === view);
    });
  },
  exportAllocationCsv() {
    if (!state.allIssues.length) return;
    const derived = issueService.getDerived();
    const confSnap = personConfig.snapshot();

    // Conjunto de pessoas igual ao do gráfico: quem tem Capacity preenchida na
    // Configuração desta sprint (dias × horas > 0), inclusive inativas [X].
    // Mesmos filtros de issue do gráfico: cancelada e fora da sprint atual não entram.
    const chartPeople = new Set(
      [...new Set(getScopeRoster(derived, confSnap))].filter(
        name =>
          name && name !== 'Não atribuído' && personConfig.capacityHours(personConfig.get(name, confSnap)) > 0
      )
    );

    const issueRows = derived.issues
      .filter(issue => {
        const name = issue.fields.assignee?.displayName;
        if (!name || !chartPeople.has(name)) return false;
        const meta = derived.issueMetaByKey.get(issue.key) || {};
        if (meta.isCancelled || !isIssueInCurrentSprint(issue)) return false;
        const originalSec =
          issue.fields.timeoriginalestimate || issue.fields.timetracking?.originalEstimateSeconds || 0;
        return (meta.estimated || 0) > 0 || originalSec > 0;
      })
      .map(issue => {
        const meta = derived.issueMetaByKey.get(issue.key) || {};
        const name = issue.fields.assignee.displayName;
        const conf = personConfig.get(name, confSnap);
        const originalSec =
          issue.fields.timeoriginalestimate || issue.fields.timetracking?.originalEstimateSeconds || 0;
        const remainingSec =
          issue.fields.timeestimate || issue.fields.timetracking?.remainingEstimateSeconds || 0;
        return [
          issue.key,
          issue.fields.summary || '',
          issue.fields.issuetype?.name || '',
          issue.fields.status?.name || '',
          name,
          conf.papel || '',
          r1(originalSec / 3600),
          r1(remainingSec / 3600),
          r1((meta.spent || 0) / 3600),
          r1((meta.estimated || 0) / 3600),
          // ⚠️ Export com DUAS casas nas colunas de capacity: com uma casa, 35.84h saía 35.8h da
          // planilha e a conta não fechava com a tela.
          roundCapacityHours(personConfig.capacityCodificacaoTesteHours(conf)),
          roundCapacityHours(personConfig.capacityRegressivoHours(conf)),
          roundCapacityHours(personConfig.capacityHours(conf))
        ];
      })
      .sort((a, b) => a[4].localeCompare(b[4]) || a[0].localeCompare(b[0]));

    // Colunas do issueRows após .map(): [0]=Issue, [4]=Responsável, [6]=Original, [9]=Ajustado.
    const aggregateRows = [...chartPeople]
      .map(name => {
        const conf = personConfig.get(name, confSnap);
        const original = issueRows.filter(row => row[4] === name).reduce((sum, row) => sum + row[6], 0);
        const ajustado = issueRows.filter(row => row[4] === name).reduce((sum, row) => sum + row[9], 0);
        const capCod = personConfig.capacityCodificacaoTesteHours(conf);
        const capReg = personConfig.capacityRegressivoHours(conf);
        const cap = capCod + capReg;
        // CP6: agregação/filtro por nome CRU (homônimos permanecem distintos); só a célula
        // exibida perde o `[X]`. Nunca exporta key/username/alias/handle/personId.
        return [
          stripStatusMarker(name),
          conf.papel || '',
          roundCapacityHours(capCod),
          roundCapacityHours(capReg),
          roundCapacityHours(cap),
          r1(original),
          r1(ajustado),
          // A diferença tem capacity dentro dela: arredondá-la em uma casa reintroduziria o
          // erro que as colunas ao lado deixaram de ter.
          roundCapacityHours(ajustado - cap)
        ];
      })
      .filter(row => row[4] > 0 || row[5] > 0 || row[6] > 0)
      .sort((a, b) => a[0].localeCompare(b[0]));

    const rows = [
      ['Agregado por responsável (bate com as barras do gráfico em ambas as views)'],
      [
        'Responsável',
        'Papel',
        'Cap. Cod./Teste (h)',
        'Cap. Regressivo (h)',
        'Capacity Total (h)',
        'Original Total (h)',
        'Ajustado Total (h)',
        'Diferença (Ajust - Cap Total)'
      ],
      ...aggregateRows,
      [],
      ['Issues consideradas no cálculo (com Original > 0 OU Ajustado > 0)'],
      [
        'Fórmula: Estimado Ajustado (h) = min(Restante + Apontado na sprint, Original − Apontado antes da sprint). Sem Original, sem teto.'
      ],
      [
        'Issue',
        'Resumo',
        'Tipo',
        'Status',
        'Responsável',
        'Papel',
        'Estimativa Original (h)',
        'Restante (h)',
        'Apontado na sprint (h)',
        'Estimado Ajustado (h)',
        'Cap. Cod./Teste (h)',
        'Cap. Regressivo (h)',
        'Capacity Total (h)'
      ],
      // Coluna "Responsável" (índice 4) sai sem o `[X]` — igual à apresentação segura.
      ...issueRows.map(row => row.map((cell, i) => (i === 4 ? stripStatusMarker(cell) : cell)))
    ];

    const projectKey = state.allIssues[0]?.key?.split('-')[0] || 'sprint';
    const stamp = new Date().toISOString().slice(0, 10);
    csv.download(`alocacao-${projectKey}-${stamp}.csv`, rows);
  },
  // % de horas concluídas derivado da MESMA série do burndown, para o card bater com a
  // curva. completed = inicial − restante hoje; planned = inicial (idealHours[0] = soma das
  // estimativas efetivas). 'fechamento' = horas caem só ao fechar a issue; 'apontamento' =
  // subtrai o worklog dia a dia.
  burndownHoursProgress(burndown, view) {
    if (!burndown) return { pct: 0, completedH: 0, plannedH: 0 };
    const v = view === 'apontamento' ? 'apontamento' : 'fechamento';
    const actual = v === 'apontamento' ? burndown.actualHoursProgressive : burndown.actualHoursBinary;
    const plannedH = burndown.idealHours[0] || 0;
    const lastReal = [...actual].reverse().find(x => x != null);
    const remainingH = lastReal == null ? plannedH : lastReal;
    const completedH = Math.max(0, plannedH - remainingH);
    const pct = plannedH > 0 ? Math.round((completedH / plannedH) * 100) : 0;
    return { pct, completedH, plannedH };
  },
  renderHoursProgressBlock(hp) {
    const color =
      hp.pct >= 80 ? CONFIG.colors.success : hp.pct >= 50 ? CONFIG.colors.warning : CONFIG.colors.danger;
    const sub = `${secondsToHours(hp.completedH * 3600)} de ${secondsToHours(hp.plannedH * 3600)} (estimativa ajustada)`;
    return this.renderProgressBlock('Por escopo estimado concluído', sub, hp.pct, color);
  },
  // Aderência de Estimativa da SPRINT — KPI de planejamento, SEPARADO da conclusão. Só roda
  // sobre issues concluídas (meta.isDone), porque aderência só é interpretável depois de
  // entregar (issue em andamento ainda recebe apontamentos). Mid-sprint a base cresce
  // conforme entrega, sem acusar déficit de trabalho ainda não feito.
  //
  // Base (decisão do usuário): apontado NA SPRINT ÷ Estimativa AJUSTADA das entregas, ambos
  // sprint-scoped. Nível de épico via *Effective (de-dup pai+filhos, igual ao burndown).
  // NOTA matemática: como a Ajustada tem teto no Original que entrou na sprint, este %
  // PODE passar de 100% — estouro de apontamento (subestimativa) aparece aqui, além do
  // Carry-over (saldo por issue, base Original). Abaixo de 100% = parte do compromisso
  // ajustado não virou apontamento. Ver [[project-completion-vs-effort-kpi]].
  computeEstimationAdherence(derived) {
    let estAjustadoSec = 0;
    let spentSprintSec = 0;
    let doneCount = 0;
    for (const parent of derived.parents) {
      const meta = derived.parentMetaByKey.get(parent.key);
      if (!meta || !meta.isDone) continue;
      // Produtivo: fora Gestão e tipos excluídos (defeito/etc). Containers NA ficam — o
      // *Effective rola a estimativa/horas dos filhos produtivos pra cima.
      if (isExcludedFromCapacityChart(parent) || getTrilha(parent) === 'GESTAO') continue;
      const ajustadoSec = meta.estimatedEffective || 0;
      if (ajustadoSec <= 0) continue; // sem baseline ajustado não dá pra medir aderência
      estAjustadoSec += ajustadoSec;
      spentSprintSec += meta.spentTotal || 0; // apontado na janela da sprint (pai + filhos)
      doneCount += 1;
    }
    const pct = estAjustadoSec > 0 ? Math.round((spentSprintSec / estAjustadoSec) * 100) : 0;
    return { estAjustadoSec, spentSprintSec, pct, doneCount };
  },
  renderAdherenceCard(a) {
    const tip =
      'Aderência da sprint sobre issues CONCLUÍDAS: apontado na sprint ÷ Estimativa Ajustada das entregas. Métrica retrospectiva — só avalia o que já foi entregue, então a sprint não precisa ter acabado. 100% = apontamento bateu o compromisso ajustado. Acima de 100% = estouro (apontou-se mais que a estimativa que entrou na sprint — subestimativa). Abaixo = superestimativa, subapontamento ou restante não zerado. NÃO é conclusão.';
    const titleHtml = `Aderência de Estimativa (sprint) <span style="display:inline-block;width:16px;height:16px;border-radius:50%;background:var(--text-soft);color:#fff;font-size:11px;line-height:16px;text-align:center;cursor:help;font-weight:600;vertical-align:middle;" title="${escapeHtml(tip)}">?</span>`;
    // Sem nenhuma issue concluída com estimativa ainda: card neutro, aparece após a 1ª entrega.
    if (a.estAjustadoSec <= 0) {
      return `
              <div class="chart-card mb-20">
                <div class="chart-title">${titleHtml}</div>
                <div style="padding-top:6px;font-size:13px;color:var(--text-soft);">Aparece após a primeira issue concluída com estimativa — é avaliada sobre o que já foi entregue.</div>
              </div>`;
    }
    // Ideal ≈ 100%. Bem abaixo = parte do ajustado virou restante não queimado
    // (superestimativa, subapontamento, ou remaining não zerado no fechamento).
    // Acima de 100% = estouro: apontou-se mais que a estimativa que entrou na sprint.
    const color =
      a.pct > 115
        ? CONFIG.colors.danger
        : a.pct > 100
          ? CONFIG.colors.warning
          : a.pct >= 85
            ? CONFIG.colors.success
            : a.pct >= 65
              ? CONFIG.colors.warning
              : CONFIG.colors.danger;
    const gap = 100 - a.pct;
    const issuesTxt = `${a.doneCount} issue${a.doneCount === 1 ? '' : 's'} concluída${a.doneCount === 1 ? '' : 's'}`;
    let leitura;
    if (a.pct > 100)
      leitura = `Apontou-se ${a.pct - 100}% além da estimativa que entrou na sprint — subestimativa/estouro nas entregas. O detalhe por issue aparece no Carry-over.`;
    else if (a.pct >= 85)
      leitura = 'Apontamento das entregas bateu o compromisso ajustado — estimativa e apontamento aderentes.';
    else
      leitura = `${gap}% da estimativa ajustada das entregas não foi apontado — possível superestimativa, subapontamento ou restante não zerado no fechamento.`;
    return `
            <div class="chart-card mb-20">
              <div class="chart-title">${titleHtml}</div>
              <div style="padding-top:6px;max-width:520px;">
                <div style="font-size:12px;color:#888;margin-bottom:6px;">Apontado na sprint vs Estimativa Ajustada — ${issuesTxt}</div>
                <div style="font-size:32px;font-weight:700;color:${color};line-height:1;">${a.pct}%</div>
                <div style="font-size:12px;color:#888;margin:5px 0 10px;">${secondsToHours(a.spentSprintSec)} apontadas de ${secondsToHours(a.estAjustadoSec)} (estimativa ajustada)</div>
                <div style="height:8px;background:#f0f0ec;border-radius:4px;overflow:hidden;">
                  <div style="height:100%;width:${Math.min(a.pct, 100)}%;background:${color};border-radius:4px;"></div>
                </div>
                <div style="font-size:12px;color:var(--text-soft);margin-top:10px;">${escapeHtml(leitura)}</div>
              </div>
            </div>`;
  },
  // Consumo de Capacidade (Fase 3) — visão de ESFORÇO, separada da entrega. Responde
  // "quanto da capacidade produtiva planejada do time já foi gasta", não "quanto foi
  // entregue". apontado produtivo na sprint ÷ capacidade produtiva (DEV+QA). Mesma lente do
  // chart "Capacidade Produtiva vs Alocação" (apontado por papel do autor, capacity por
  // papel configurado), pra os totais baterem.
  computeCapacityConsumption(derived) {
    const confSnap = personConfig.snapshot();
    const win = sprintWindow();
    const productiveRoles = new Set(['DEV', 'QA']);
    let capacityH = 0;
    for (const name of getScopeRoster(derived, confSnap)) {
      const conf = personConfig.get(name, confSnap);
      if (productiveRoles.has(conf.papel)) capacityH += personConfig.capacityHours(conf);
    }
    let spentSec = 0;
    for (const issue of derived.issues) {
      const trilha = getTrilha(issue);
      if (trilha === 'GESTAO' || trilha === 'NA') continue;
      if (isExcludedFromCapacityChart(issue)) continue;
      for (const log of issue.fields.worklog?.worklogs || []) {
        if (win && !isLogInSprintWindow(log, win)) continue;
        const author = log.author?.displayName;
        if (!author) continue;
        if (!productiveRoles.has(personConfig.get(author, confSnap).papel)) continue;
        spentSec += log.timeSpentSeconds || 0;
      }
    }
    const spentH = spentSec / 3600;
    const pct = capacityH > 0 ? Math.round((spentH / capacityH) * 100) : 0;
    return { capacityH, spentH, pct };
  },
  // Carry-over / Transbordo (Fase 4) — issues que passam entre sprints. Mostra a vida da
  // issue: Estimativa Original (vida toda) vs Ajustada (compromisso desta sprint), apontado
  // ANTES da sprint vs apontado NA sprint, e o saldo (Ajustada − apontado na sprint).
  // É aqui que mora o sinal de estouro real (saldo negativo = esforço passou a estimativa).
  getCarryOverData(derived) {
    const sprintStart = state.sprintDates.start;
    if (!sprintStart) return null;
    const churn = issueService.getSprintChurn();
    const carrySet = new Set((churn?.carryover || []).map(e => e.issue.key));
    const beforeStart = issue => {
      let s = 0;
      for (const log of issue.fields.worklog?.worklogs || []) {
        if (new Date(log.started) < sprintStart) s += log.timeSpentSeconds || 0;
      }
      return s;
    };
    const rows = [];
    for (const parent of derived.parents) {
      const meta = derived.parentMetaByKey.get(parent.key);
      if (!meta) continue;
      // Fora tipos sem commitment de estimativa: Gestão/Reunião, Defeito e "Apoio" exato
      // (mantém "Apoio - Cliente", que exige estimativa). Mesma regra dos outros cards.
      const typeName = normalize(parent.fields.issuetype?.name);
      if (getTrilha(parent) === 'GESTAO') continue;
      if (isExcludedFromCapacityChart(parent)) continue;
      if (CONFIG.estimateNotRequiredExactTypes.includes(typeName)) continue;
      let antSec = beforeStart(parent);
      for (const child of parent.children || []) antSec += beforeStart(child);
      const isCarry = carrySet.has(parent.key);
      if (antSec <= 0 && !isCarry) continue; // não transbordou: sem apontado anterior nem carryover
      // Ajustada do Carry-over = Estimativa Original − apontado ANTES da sprint (definição
      // do usuário: "tira da Original o que já foi feito em sprints passadas"). Cap em 0.
      // Difere do meta.estimated/estimatedEffective (restante + apontado) do resto do
      // dashboard de propósito: aqui nunca passa da Original, e o saldo mostra estouro real.
      const origSec = meta.originalEstimatedEffective || 0;
      const ajustSec = Math.max(0, origSec - antSec);
      const sprintSpentSec = meta.spentTotal || 0;
      rows.push({
        key: parent.key,
        status: parent.fields.status?.name || '',
        isDone: !!meta.isDone,
        origH: origSec / 3600,
        antH: antSec / 3600,
        ajustH: ajustSec / 3600,
        sprintH: sprintSpentSec / 3600,
        saldoH: (ajustSec - sprintSpentSec) / 3600
      });
    }
    rows.sort((a, b) => b.antH - a.antH);
    return rows;
  },
  renderCarryOverCard(rows) {
    if (rows === null) return ''; // sprint sem startDate: changelog/janela indisponível
    const tip =
      'Issues que vieram de outra sprint (carryover) ou já tinham apontamento antes do início desta sprint. Aqui a Estimativa Ajustada = Estimativa Original − apontado antes da sprint (a parcela da estimativa que cabe nesta sprint, sem o que já foi feito antes; nunca passa da Original). Saldo = Ajustada − apontado na sprint: negativo = esforço estourou a parcela estimada desta sprint; positivo = ainda havia estimativa a consumir.';
    const titleHtml = `Carry-over — Transbordo <span style="display:inline-block;width:16px;height:16px;border-radius:50%;background:var(--text-soft);color:#fff;font-size:11px;line-height:16px;text-align:center;cursor:help;font-weight:600;vertical-align:middle;" title="${escapeHtml(tip)}">?</span>`;
    if (rows.length === 0) {
      return `
              <div class="chart-card mt-20">
                <div class="chart-title">${titleHtml}</div>
                <div style="padding-top:6px;font-size:13px;color:var(--text-soft);">Nenhuma issue transbordada — sem apontamento anterior ao início nem carryover de outra sprint.</div>
              </div>`;
    }
    const h = n => (n > 0 ? `${n.toFixed(1)}h` : '—');
    const body = rows
      .map(r => {
        const saldoColor =
          r.saldoH < -0.05
            ? CONFIG.colors.danger
            : r.saldoH > 0.05
              ? CONFIG.colors.muted
              : CONFIG.colors.success;
        const saldoTxt = `${r.saldoH >= 0 ? '+' : ''}${r.saldoH.toFixed(1)}h`;
        const statusBadge = r.isDone
          ? `<span style="color:${CONFIG.colors.success};font-weight:600;">${escapeHtml(r.status)}</span>`
          : escapeHtml(r.status);
        return `
              <tr style="border-top:1px solid var(--border);">
                <td style="padding:6px 8px;">${this.jiraIssueLink({ key: r.key })}</td>
                <td style="padding:6px 8px;font-size:12px;">${statusBadge}</td>
                <td style="padding:6px 8px;text-align:right;">${h(r.origH)}</td>
                <td style="padding:6px 8px;text-align:right;color:var(--text-soft);">${h(r.antH)}</td>
                <td style="padding:6px 8px;text-align:right;">${h(r.ajustH)}</td>
                <td style="padding:6px 8px;text-align:right;">${h(r.sprintH)}</td>
                <td style="padding:6px 8px;text-align:right;font-weight:600;color:${saldoColor};">${saldoTxt}</td>
              </tr>`;
      })
      .join('');
    return `
            <div class="chart-card mt-20">
              <div class="chart-title">${titleHtml}</div>
              <div class="chart-subtitle" style="margin-bottom:8px;">${rows.length} issue${rows.length === 1 ? '' : 's'} que passaram por mais de uma sprint. Saldo negativo = esforço estourou o compromisso ajustado.</div>
              <div style="overflow-x:auto;">
                <table style="width:100%;border-collapse:collapse;font-size:13px;">
                  <thead>
                    <tr style="text-align:left;color:#888;font-size:11px;">
                      <th style="padding:6px 8px;">Issue</th>
                      <th style="padding:6px 8px;">Status</th>
                      <th style="padding:6px 8px;text-align:right;" title="Estimativa Original — vida toda da issue">Est. Original</th>
                      <th style="padding:6px 8px;text-align:right;" title="Apontado antes do início desta sprint">Apont. anterior</th>
                      <th style="padding:6px 8px;text-align:right;" title="Estimativa Original − apontado antes da sprint = parcela da estimativa que cabe nesta sprint (nunca passa da Original)">Est. Ajustada</th>
                      <th style="padding:6px 8px;text-align:right;" title="Apontado dentro da janela desta sprint">Apont. na sprint</th>
                      <th style="padding:6px 8px;text-align:right;" title="Ajustada − Apontado na sprint">Saldo</th>
                    </tr>
                  </thead>
                  <tbody>${body}</tbody>
                </table>
              </div>
            </div>`;
  },
  renderCapacityConsumptionCard(c, deliveryPct) {
    if (c.capacityH <= 0) return '';
    const tip =
      'Esforço consumido, NÃO entrega: apontado produtivo na sprint ÷ capacidade produtiva planejada (DEV+QA). Um time pode ter gasto muita capacidade e entregue pouco (gargalo, retrabalho, impedimento, QA, subestimativa). Compare com o escopo concluído: se o consumo corre na frente da entrega, há risco.';
    const titleHtml = `Consumo de Capacidade <span style="display:inline-block;width:16px;height:16px;border-radius:50%;background:var(--text-soft);color:#fff;font-size:11px;line-height:16px;text-align:center;cursor:help;font-weight:600;vertical-align:middle;" title="${escapeHtml(tip)}">?</span>`;
    const gap = c.pct - deliveryPct; // consumo correndo na frente da entrega
    const color =
      c.pct > 100 ? CONFIG.colors.danger : gap > 20 ? CONFIG.colors.warning : CONFIG.colors.success;
    let leitura;
    if (c.pct > 100)
      leitura = `Time apontou ${c.pct - 100}% além da capacidade produtiva planejada — sobrealocação ou capacity subdimensionada.`;
    else if (gap > 20)
      leitura = `Consumo (${c.pct}%) bem à frente do escopo entregue (${deliveryPct}%) — esforço não está virando entrega na mesma velocidade (gargalo, retrabalho, impedimento ou subestimativa).`;
    else leitura = `Consumo (${c.pct}%) alinhado com o escopo entregue (${deliveryPct}%).`;
    return `
            <div class="chart-card mb-20">
              <div class="chart-title">${titleHtml}</div>
              <div style="padding-top:6px;max-width:520px;">
                <div style="font-size:12px;color:#888;margin-bottom:6px;">Apontado produtivo na sprint vs capacidade produtiva planejada</div>
                <div style="font-size:32px;font-weight:700;color:${color};line-height:1;">${c.pct}%</div>
                <div style="font-size:12px;color:#888;margin:5px 0 10px;">${secondsToHours(c.spentH * 3600)} apontadas de ${secondsToHours(c.capacityH * 3600)} de capacidade · escopo entregue ${deliveryPct}%</div>
                <div style="height:8px;background:#f0f0ec;border-radius:4px;overflow:hidden;">
                  <div style="height:100%;width:${Math.min(c.pct, 100)}%;background:${color};border-radius:4px;"></div>
                </div>
                <div style="font-size:12px;color:var(--text-soft);margin-top:10px;">${escapeHtml(leitura)}</div>
              </div>
            </div>`;
  },
  renderProgressBlock(label, sub, percent, color) {
    return `
            <div>
              <div style="font-size:12px;color:#888;margin-bottom:6px;">${escapeHtml(label)}</div>
              <div style="font-size:32px;font-weight:700;color:${color};line-height:1;">${percent}%</div>
              <div style="font-size:12px;color:#888;margin:5px 0 10px;">${escapeHtml(sub)}</div>
              <div style="height:8px;background:#f0f0ec;border-radius:4px;overflow:hidden;">
                <div style="height:100%;width:${Math.min(percent, 100)}%;background:${color};border-radius:4px;"></div>
              </div>
            </div>`;
  },
  renderCycleTime({ force = false } = {}) {
    const confSnap = personConfig.snapshot();
    const getPersonConf = name => personConfig.get(name, confSnap);
    const signature = `${state.dataVersion}:${confSnap.currentSprintId || 'none'}:${JSON.stringify(confSnap.sprintsByid)}:${JSON.stringify(confSnap.globalDefault)}`;
    if (!force && state.renderedVersion.cycletime === signature && $('#tab-cycletime').innerHTML.trim())
      return;

    const derived = issueService.getDerived();
    // Aging WIP = issues ainda ativas. Exclui Concluídas E Canceladas (issueRules.isClosed
    // cobre os dois), pra não inflar a tabela com trabalho que já saiu da WIP.
    // "Teste de Aceitação Concluído" é aceite já validado aguardando saída da WIP —
    // não é trabalho em andamento, então fica fora do rastreio de aging.
    const isAcceptanceDone = name => {
      const n = normalize(name);
      return n.includes('aceitação concluído') || n.includes('aceitacao concluido');
    };
    const parents = derived.parents.filter(
      issue =>
        issue.fields.assignee &&
        getIssueTypeRole(issue) !== 'GESTAO' &&
        !normalize(issue.fields.status.name).includes('comprometido') &&
        !isAcceptanceDone(issue.fields.status.name) &&
        !issueRules.isClosed(issue.fields.status.name)
    );

    const getProductiveHours = issue =>
      getPersonConf(issue.fields.assignee?.displayName || '').horasProdutivas;
    const getSituation = issue => {
      const meta = derived.parentMetaByKey.get(issue.key);
      if (meta?.isImpediment) return 'impedida';
      const estimatedSeconds = meta?.estimatedEffective || 0;
      if (!estimatedSeconds) return 'sem-est';
      const estimatedHours = estimatedSeconds / 3600;
      const elapsedHours = issueService.productiveHoursSince(
        meta.enteredCurrentStatus,
        getProductiveHours(issue)
      );
      return elapsedHours > estimatedHours ? 'atrasada' : 'ok';
    };

    const counts = { ok: 0, atrasada: 0, impedida: 0, 'sem-est': 0 };
    parents.forEach(issue => (counts[getSituation(issue)] += 1));

    const situationLabel = {
      ok: 'No prazo',
      atrasada: 'Atrasada',
      impedida: 'Impedida',
      'sem-est': 'Sem estimativa'
    };
    const situationColor = {
      ok: CONFIG.colors.success,
      atrasada: CONFIG.colors.danger,
      impedida: CONFIG.colors.warning,
      'sem-est': CONFIG.colors.muted
    };
    const situationOrder = { atrasada: 0, impedida: 1, 'sem-est': 2, ok: 3 };

    const issueRows = [...parents]
      .sort((a, b) => situationOrder[getSituation(a)] - situationOrder[getSituation(b)])
      .map(issue => {
        const meta = derived.parentMetaByKey.get(issue.key);
        const situation = getSituation(issue);
        const productiveHours = getProductiveHours(issue);
        const estimatedSeconds = meta?.estimatedEffective || 0;
        const estimatedDays =
          estimatedSeconds > 0 ? `${(estimatedSeconds / (productiveHours * 3600)).toFixed(1)}d` : '—';
        const dateEntered = meta?.enteredCurrentStatus || new Date(issue.fields.created);
        const elapsedDays = issueService.productiveHoursSince(dateEntered, productiveHours) / productiveHours;
        const fullAssignee = issue.fields.assignee?.displayName || 'Não atribuído';
        const assignee = issue.fields.assignee ? compactName(fullAssignee) : 'Não atribuído';
        const noConfiguredHours = !getPersonConf(fullAssignee).hasConfiguredHoras;
        const warn = noConfiguredHours
          ? '<span class="danger" style="font-size:10px;" title="Horas produtivas não configuradas">⚠</span>'
          : '';
        const summary = issue.fields.summary || 'Sem título';

        return `
                <div class="grid-row cy-row">
                  ${this.jiraIssueLink(issue)}
                  <div class="issue-summary" title="${escapeAttr(summary)}">${escapeHtml(summary)}</div>
                  <div class="truncate text-muted" title="${escapeAttr(fullAssignee)}">${escapeHtml(assignee)} ${warn}</div>
                  ${renderStatusBadge(issue.fields.status.name)}
                  <div class="text-right text-muted">${formatDate(dateEntered)}</div>
                  <div class="text-right font-semibold">${elapsedDays.toFixed(1)}d</div>
                  <div class="text-right text-muted">${estimatedDays}</div>
                  <div class="text-right font-semibold" style="color:${situationColor[situation]};">${situationLabel[situation]}</div>
                </div>`;
      })
      .join('');

    // === Cycle Time por status (issues concluídas) ===
    // Descobre os status reais que aparecem no histórico das issues concluídas.
    // Tempo em cada status = horas produtivas (8h-18h, sem fim de semana),
    // depois normalizado para dias produtivos via prodHoursPerDay do responsável.
    const doneWithCycle = [];
    const statusEntryOffsets = {}; // status → [seconds desde a criação até primeira entrada na issue]
    for (const parent of derived.parents) {
      const meta = derived.parentMetaByKey.get(parent.key);
      if (!meta?.isDone || !parent.fields.resolutiondate) continue;
      const prodHoursPerDay = getProductiveHours(parent);
      if (!(prodHoursPerDay > 0)) continue;
      const events = issueService.getStatusEvents(parent);
      if (!events.length) continue;
      const cycleByStatus = issueService.cycleTimeByStatus(parent, prodHoursPerDay);
      if (!cycleByStatus) continue;
      const cycleByStatusDays = {};
      for (const [status, hours] of Object.entries(cycleByStatus)) {
        cycleByStatusDays[status] = hours / prodHoursPerDay;
      }
      // Capturar momento de primeira entrada em cada status para ordenar o eixo.
      const created = events[0].date;
      const seen = new Set();
      for (const ev of events) {
        // Pula status terminais (Concluído E Cancelado) — não acumulam cycle time.
        if (!ev.status || issueRules.isClosed(ev.status)) continue;
        if (seen.has(ev.status)) continue;
        seen.add(ev.status);
        if (!statusEntryOffsets[ev.status]) statusEntryOffsets[ev.status] = [];
        statusEntryOffsets[ev.status].push(Math.max(0, (ev.date - created) / 1000));
      }
      const totalDays = Object.values(cycleByStatusDays).reduce((sum, value) => sum + value, 0);
      doneWithCycle.push({ issue: parent, meta, cycleByStatusDays, totalDays });
    }

    // Ordem do fluxo: status com média de entrada mais cedo aparece primeiro.
    const orderedStatuses = Object.keys(statusEntryOffsets)
      .filter(status => doneWithCycle.some(entry => (entry.cycleByStatusDays[status] || 0) > 0))
      .sort((a, b) => {
        const avgA = statusEntryOffsets[a].reduce((s, v) => s + v, 0) / statusEntryOffsets[a].length;
        const avgB = statusEntryOffsets[b].reduce((s, v) => s + v, 0) / statusEntryOffsets[b].length;
        return avgA - avgB;
      });

    // Cor estável por status (mesmo índice na palette → mesma cor entre renders).
    const statusColor = {};
    orderedStatuses.forEach((status, index) => {
      statusColor[status] = CONFIG.chartPalette[index % CONFIG.chartPalette.length];
    });

    // Métricas agregadas por status, em dias produtivos.
    const statusDayTotals = {};
    const statusDayCounts = {};
    for (const entry of doneWithCycle) {
      for (const [status, days] of Object.entries(entry.cycleByStatusDays)) {
        if (days <= 0) continue;
        statusDayTotals[status] = (statusDayTotals[status] || 0) + days;
        statusDayCounts[status] = (statusDayCounts[status] || 0) + 1;
      }
    }
    const formatDays = days => (days > 0 ? `${days.toFixed(1)}d` : '—');
    const statusAvg = status =>
      statusDayCounts[status] ? statusDayTotals[status] / statusDayCounts[status] : 0;

    const TOP_N = 15;
    const topIssues = [...doneWithCycle].sort((a, b) => b.totalDays - a.totalDays).slice(0, TOP_N);

    const cycleHeader = doneWithCycle.length
      ? `Cycle Time por status — ${doneWithCycle.length} issue${doneWithCycle.length === 1 ? '' : 's'} concluída${doneWithCycle.length === 1 ? '' : 's'}`
      : 'Cycle Time por status';

    const cycleSection =
      doneWithCycle.length && orderedStatuses.length
        ? `
            <div class="chart-title" style="margin:4px 0 12px;">${cycleHeader}</div>
            <div class="metrics-grid mb-24">
              ${orderedStatuses
                .map(status =>
                  ui.renderMetric({
                    label: status,
                    value: formatDays(statusAvg(status)),
                    sub: statusDayCounts[status]
                      ? `média de ${statusDayCounts[status]} issue${statusDayCounts[status] === 1 ? '' : 's'}`
                      : 'sem registros'
                  })
                )
                .join('')}
            </div>
            <div style="position:relative;height:${Math.max(200, topIssues.length * 26 + 80)}px;margin-bottom:8px;">
              <canvas id="cycleBucketsChart"></canvas>
            </div>
            <div style="margin-bottom:24px;font-size:11px;color:var(--text-soft);line-height:1.5;">
              Cada barra é uma issue concluída; segmentos = dias produtivos gastos em cada status (8h–18h, sem fim de semana, baseado nas horas produtivas do responsável).
              Statuses são descobertos do histórico real. ${topIssues.length < doneWithCycle.length ? `Mostrando top ${topIssues.length} por duração total.` : ''}
            </div>
          `
        : `
            <div class="chart-title" style="margin:4px 0 12px;">${cycleHeader}</div>
            <div style="margin-bottom:24px;font-size:13px;color:var(--text-soft);">Nenhuma issue concluída na sprint ainda — aparece aqui após a primeira entrega.</div>
          `;

    $('#tab-cycletime').innerHTML = `
            ${cycleSection}
            <div class="chart-title" style="margin:4px 0 12px;">Aging WIP — em andamento</div>
            <div class="metrics-grid mb-24">
              ${ui.renderMetric({ label: 'No prazo', value: counts.ok, className: 'success' })}
              ${ui.renderMetric({ label: 'Atrasadas', value: counts.atrasada, className: counts.atrasada > 0 ? 'danger' : '' })}
              ${ui.renderMetric({ label: 'Impedidas', value: counts.impedida, className: counts.impedida > 0 ? 'warning' : '', sub: 'não contam no cycle time' })}
              ${ui.renderMetric({ label: 'Sem estimativa', value: counts['sem-est'] })}
            </div>
            <div class="table-wrap">
              <div class="grid-row cy-row row-header">
                <div>Chave</div><div>Resumo</div><div>Responsável</div><div>Status atual</div>
                <div class="text-right">Desde</div><div class="text-right">No status</div>
                <div class="text-right">Estimado</div><div class="text-right">Situação</div>
              </div>
              ${issueRows || '<div class="empty-msg">Nenhuma issue encontrada.</div>'}
            </div>`;

    chartFactory.destroy(['cycleBuckets']);
    if (doneWithCycle.length && orderedStatuses.length) {
      const labels = topIssues.map(entry => entry.issue.key);
      const datasets = orderedStatuses.map(status => ({
        label: status,
        data: topIssues.map(entry => Math.round((entry.cycleByStatusDays[status] || 0) * 10) / 10),
        backgroundColor: statusColor[status],
        borderWidth: 0
      }));
      state.charts.cycleBuckets = new Chart($('#cycleBucketsChart'), {
        type: 'bar',
        data: { labels, datasets },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          indexAxis: 'y',
          scales: {
            x: {
              stacked: true,
              beginAtZero: true,
              title: { display: true, text: 'Dias', font: { size: 11 }, color: CONFIG.colors.muted },
              ticks: { font: { size: 11 }, callback: v => `${v}d` }
            },
            y: { stacked: true, ticks: { font: { size: 11 } } }
          },
          plugins: {
            legend: { position: 'bottom', labels: { font: { size: 11 }, boxWidth: 12, padding: 10 } },
            tooltip: {
              callbacks: {
                label: ctx => {
                  const value = ctx.parsed.x;
                  return value > 0 ? `${ctx.dataset.label}: ${value.toFixed(1)}d` : null;
                },
                footer: items => {
                  const total = items.reduce((sum, item) => sum + (item.parsed.x || 0), 0);
                  return total > 0 ? `Total: ${total.toFixed(1)}d` : '';
                }
              }
            }
          }
        }
      });
    }

    state.renderedVersion.cycletime = signature;
  },
  // Round-trip da ação de reconciliação: token do DOM → INTENÇÃO validada, só em memória. Token
  // desconhecido/obsoleto (render novo, capability desligada) → null, e o chamador falha de forma
  // visível, sem enviar nada.
  reconciliationIntentFor(token) {
    return filaReconciliacao ? filaReconciliacao.intentForToken(token) : null;
  },
  // Painel INCREMENTAL de reconciliação — devolve o HTML (ou '' quando não deve aparecer).
  // Só existe quando: a capability PRÓPRIA `identityReconciliation` está ligada, o envelope é
  // suportado e há slot pendente. NENHUM request é disparado aqui.
  buildReconciliationPanel(derived, confSnap) {
    filaReconciliacao = null;
    if (!sharedConfig.identityReconciliationEnabled) return '';
    const scopeModel = confSnap.scopeModel;
    const selection = resolveScopeSelection(scopeModel, {
      currentSprintId: confSnap.currentSprintId,
      analysisScopeId: confSnap.analysisScopeId
    });
    const fila = buildReconciliationQueue({
      envelope: sharedConfig.identityEnvelope,
      provenance: derived?.rowProvenance ?? null,
      sessionIdentity: derived?.identity ?? null,
      scopeModel,
      selection,
      nextToken: nextTokenReconciliacao
    });
    if (fila.status !== 'ready' || fila.items.length === 0) return '';
    filaReconciliacao = fila;

    const podeAgir = sharedConfig.unlocked;
    const disabled = podeAgir ? '' : 'disabled';
    const conflitos = fila.openConflicts.length
      ? `<div class="config-no-sprint-warning">⚠ <strong>${escapeHtml(String(fila.openConflicts.reduce((s, c) => s + c.count, 0)))}</strong> conflito(s) em aberto no documento: ${escapeHtml(fila.openConflicts.map(c => c.kind).join(', '))}. Resolva vinculando o slot correspondente.</div>`
      : '';

    const linhas = fila.items
      .map(item => {
        const onde =
          item.kind === 'sprint' ? `Sprint ${escapeHtml(String(item.sprintId))}` : 'Global Default';
        const escopo = item.analysisScopeId
          ? '<span class="reconcile-scope" title="Iniciativa (escopo analítico) já resolvida para este slot">iniciativa resolvida</span>'
          : '<span class="reconcile-scope" title="Este slot ainda não pertence a nenhuma iniciativa">sem iniciativa</span>';
        // `username` só aparece para HOMÔNIMO, como desambiguação visual de sessão. Nunca em
        // atributo, storage ou documento — por isso vai no texto, escapado, e não em data-*.
        const desambiguacao = item.username
          ? ` <span class="text-muted" style="font-size:11px;" title="Usuário observado nesta sessão — não é persistido">(${escapeHtml(item.username)})</span>`
          : '';
        // Slot de sprint sem iniciativa resolvida: Vincular fica indisponível (a M2 recusaria,
        // para ninguém ficar confirmado e fora da participação). "Manter separado" continua.
        const semEscopo = item.linkable === false;
        const avisoEscopo = semEscopo
          ? `<div class="warning" style="font-size:11px;">${escapeHtml(MOTIVO_BLOQUEIO[item.blockedReason] || MOTIVO_BLOQUEIO.default)} Manter separado continua disponível.</div>`
          : '';
        const acoes = item.candidates.length
          ? item.candidates
              .map(c => {
                const forca = FORCA_LABEL[c.strength] || c.strength;
                const razoes = c.reasons.map(r => RAZAO_LABEL[r] || r).join('; ');
                const alvo =
                  c.kind === CANDIDATE_EXTERNAL
                    ? 'criar identidade a partir do vínculo observado'
                    : c.presentationName
                      ? `vincular a ${escapeHtml(c.presentationName)}`
                      : 'vincular à pessoa já registrada';
                const separar =
                  c.kind === CANDIDATE_EXTERNAL
                    ? ''
                    : `<button class="btn btn-sm" type="button" ${disabled} data-action="reconcile-separate" data-reconcile-token="${escapeAttr(c.token)}" title="Registra que este slot NÃO é este candidato. Vale só para este slot.">Manter separado</button>`;
                return `
                  <div class="reconcile-candidate" style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin:4px 0;">
                    <span class="reconcile-strength reconcile-strength-${escapeAttr(c.strength)}" title="${escapeAttr(razoes)}">${escapeHtml(forca)}</span>
                    <span style="font-size:12px;">${alvo}</span>
                    <span class="text-muted" style="font-size:11px;">${escapeHtml(razoes)}</span>
                    ${semEscopo ? '' : `<button class="btn btn-sm" type="button" ${disabled} data-action="reconcile-link" data-reconcile-token="${escapeAttr(c.token)}" title="Vincula SOMENTE este slot a esta pessoa.">Vincular</button>`}
                    ${separar}
                  </div>`;
              })
              .join('')
          : `<div class="text-muted" style="font-size:12px;">Sem candidato — nenhuma ação disponível. A busca de usuários no Jira não existe neste checkpoint, e texto livre nunca é aceito.</div>`;
        const ambiguo = item.ambiguous
          ? `<div class="warning" style="font-size:11px;">Homônimo ambíguo: continua pendente até uma decisão humana — não há preferência automática.</div>`
          : '';
        const separados = item.separatedCandidates
          ? `<div class="text-muted" style="font-size:11px;">${escapeHtml(String(item.separatedCandidates))} candidato(s) mantido(s) separado(s) neste slot.</div>`
          : '';
        return `
              <div class="reconcile-row" data-reconcile-slot="${escapeAttr(item.token)}" style="padding:8px 16px;border-top:1px solid var(--border);">
                <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;">
                  <strong style="font-size:13px;">${escapeHtml(item.presentationName)}</strong>${desambiguacao}
                  <span class="text-muted" style="font-size:11px;">${onde}</span>
                  ${escopo}
                </div>
                ${ambiguo}
                ${avisoEscopo}
                ${acoes}
                ${separados}
              </div>`;
      })
      .join('');

    return `
            <div class="chart-card mb-16">
              <div class="chart-title">Reconciliação de identidade — ${escapeHtml(String(fila.stats.pending))} slot(s) pendente(s)</div>
              <div class="chart-subtitle">Cada decisão vale para UM slot (e um candidato). Nada é propagado para outra sprint, para o Global Default ou para slot vizinho.</div>
              ${conflitos}
              ${podeAgir ? '' : '<div class="config-no-sprint-warning">🔒 Destrave a edição para reconciliar.</div>'}
              <div class="table-wrap">${linhas}</div>
            </div>`;
  },
  // Instância viva do picker e o contexto resolvido no último render — o `app` usa os dois para
  // montar a ação; nenhum deles é derivado do DOM.
  personPicker() {
    return obterPicker();
  },
  pickerContext() {
    return pickerContext;
  },
  // ── CP10: ciclo de vida da participação ───────────────────────────────────────────────────
  // Traduz um TOKEN de sessão na intenção completa. Token de outro render (ou de outra instância)
  // não resolve — e é isso que garante que nenhum identificador persistente precise viver no DOM.
  lifecycleIntentFor(token, action) {
    const ctx = lifecycleTokens.get(token);
    if (!ctx) return null;
    return {
      action,
      analysisScopeId: ctx.analysisScopeId,
      periodId: ctx.periodId,
      personId: ctx.personId
    };
  },
  // Painel do CICLO DE VIDA — devolve o HTML (ou '' quando não deve aparecer).
  //
  // Exige, CUMULATIVAMENTE: modo shared disponível, capability PRÓPRIA ligada, edição destravada,
  // sprint atual conhecida, `analysisScopeId` explícito e período de SPRINT resolvido de forma
  // única. Falta qualquer um → nada é oferecido.
  //
  // ⚠️ TOKEN OPACO, sempre. `personId` é identificador PERSISTENTE: publicá-lo em `data-*` o
  // transformaria num rastreador de longa duração no DOM — exatamente a correção que o CP9 fez no
  // CP6. Ele vive só no mapa token → intenção, que é descartado a cada render.
  buildLifecyclePanel(confSnap, derivedParaCiclo = null) {
    lifecycleTokens.clear();
    if (!sharedConfig.identityLifecycleEnabled || !sharedConfig.unlocked) return '';
    if (!confSnap.currentSprintId) return '';
    const scopeModel = confSnap.scopeModel;
    const selection = resolveScopeSelection(scopeModel, {
      currentSprintId: confSnap.currentSprintId,
      analysisScopeId: confSnap.analysisScopeId
    });
    if (selection.mode !== 'scoped' || !selection.period?.periodId) return '';

    const envelope = sharedConfig.identityEnvelope;
    // MESMA régua da reconciliação e do picker: envelope irregular → painel VAZIO, nunca parcial.
    const { porKey, erro } = validarPessoas(envelope?.people);
    if (erro !== null || porKey === null) return '';

    const { analysisScopeId, period } = selection;
    const mapa = scopeModel?.participation?.[analysisScopeId]?.[period.periodId];
    if (!mapa || typeof mapa !== 'object') return '';

    const linhas = Object.keys(mapa)
      .map(personId => {
        const registro = mapa[personId];
        const nome = nomeObservadoDe(envelope?.people?.[personId]);
        // Pessoa sem nome legível (redigida, por exemplo) continua LISTADA: o ciclo de vida
        // opera sobre a participação, que é opaca, e escondê-la tiraria da UI a única forma de
        // arquivar alguém já redigido.
        const rotulo = nome === null ? 'pessoa sem nome registrado' : stripStatusMarker(nome);
        const token = nextTokenLifecycle();
        lifecycleTokens.set(token, { analysisScopeId, periodId: period.periodId, personId });
        const arquivada = registro?.archived === true;
        const excluida = registro?.explicitExclude === true;
        const marcas = [
          arquivada ? '<span class="reconcile-scope">arquivada</span>' : '',
          excluida ? '<span class="reconcile-scope">fora do carry-forward</span>' : ''
        ].join('');
        const botao = (acao, texto, titulo, desabilitado) =>
          `<button class="btn btn-sm" type="button" data-action="lifecycle" data-lifecycle-action="${escapeAttr(acao)}" data-lifecycle-token="${escapeAttr(token)}" title="${escapeAttr(titulo)}" ${desabilitado ? 'disabled' : ''}>${escapeHtml(texto)}</button>`;
        const acoes = arquivada
          ? botao(
              'restore-participation',
              'Restaurar',
              'Devolve a participação deste período ao estado anterior. Nada é apagado.',
              false
            )
          : botao(
              'archive-participation',
              'Arquivar',
              'Arquiva a participação DESTE período. O histórico e a configuração são preservados.',
              false
            );
        const excluir = botao(
          'exclude-from-period-forward',
          'Não herdar daqui em diante',
          'A pessoa deixa de ser trazida por carry-forward deste período em diante. Períodos anteriores não mudam.',
          excluida
        );
        return `
              <div class="reconcile-row" style="padding:8px 16px;border-top:1px solid var(--border);">
                <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
                  <strong style="font-size:13px;">${escapeHtml(rotulo)}</strong>${marcas}
                  ${acoes}${excluir}
                </div>
              </div>`;
      })
      .join('');
    if (!linhas) return '';

    // ⚠️ DISCREPÂNCIA: quem foi arquivado/excluído mas TEM atividade no Jira nesta sprint. A
    // atividade vence (o JiraDash não esconde trabalho que existe), mas a exclusão não pode
    // parecer plenamente efetiva enquanto a pessoa continua entregando.
    //
    // ⚠️ A associação é por PROVENIÊNCIA DIRETA (`directFor`: uma única key observada naquele
    // bucket, sem observação sem key) — nunca por igualdade de nome. Bucket homônimo ou ambíguo
    // entra na contagem agregada e NÃO tem `personId` escolhido: apontar o último homônimo
    // atribuiria a atividade de uma pessoa à decisão de outra.
    const provenanceCiclo = derivedParaCiclo?.rowProvenance ?? null;
    const atividade = (derivedParaCiclo?.assignees || [])
      .map(([nome]) => nome)
      .filter(nome => nome && nome !== 'Não atribuído')
      .map(nome => ({ nome, key: provenanceCiclo?.directFor(nome)?.key ?? null }));
    const divergencia = excludedButActive(scopeModel, selection, atividade, envelope);
    const partes = [];
    if (divergencia.pessoas.length === 1) {
      partes.push(
        '1 pessoa está arquivada ou fora do carry-forward, mas TEM atividade no Jira nesta sprint.'
      );
    } else if (divergencia.pessoas.length > 1) {
      partes.push(
        `${divergencia.pessoas.length} pessoas estão arquivadas ou fora do carry-forward, mas TÊM atividade no Jira nesta sprint.`
      );
    }
    if (divergencia.ambiguos > 0) {
      partes.push(
        `${divergencia.ambiguos} linha(s) com atividade não puderam ser associadas com segurança (nome ambíguo ou sem vínculo observado) e podem contradizer uma exclusão.`
      );
    }
    const avisoDivergencia = partes.length
      ? `<div class="warning" style="font-size:12px;margin:6px 0;">${escapeHtml(
          `${partes.join(' ')} A atividade prevalece nas métricas — revise a decisão.`
        )}</div>`
      : '';

    return `
            <div class="chart-card mb-16">
              <div class="chart-title">Ciclo de vida da participação</div>
              <div class="chart-subtitle">Arquivar preserva o histórico, a configuração e a capacidade — nada é apagado. Excluir do carry-forward vale deste período em diante e não altera períodos anteriores.</div>
              ${avisoDivergencia}
              <div class="table-wrap">${linhas}</div>
            </div>`;
  },
  // Painel do PICKER — devolve o HTML (ou '' quando não deve aparecer). NENHUM request é
  // disparado aqui: a busca só acontece por clique humano.
  //
  // O painel exige, CUMULATIVAMENTE: modo shared disponível, capability própria ligada, edição
  // destravada, sprint atual conhecida, `analysisScopeId` explícito e válido e período de SPRINT
  // resolvido de forma única. Falta qualquer um → nada é oferecido. Não há inclusão no Global
  // Default, em modo local, em escopo bloqueado ou sem período.
  buildPickerPanel(derived, confSnap) {
    pickerContext = null;
    if (!sharedConfig.identityRosterPickerEnabled || !sharedConfig.unlocked) return '';
    if (!confSnap.currentSprintId) return '';
    const scopeModel = confSnap.scopeModel;
    const selection = resolveScopeSelection(scopeModel, {
      currentSprintId: confSnap.currentSprintId,
      analysisScopeId: confSnap.analysisScopeId
    });
    // Só o modo `scoped` serve: `legacy` não tem iniciativa explícita e `blocked` é fail-closed.
    if (selection.mode !== 'scoped' || !selection.period?.periodId) return '';
    pickerContext = { analysisScopeId: selection.analysisScopeId, periodId: selection.period.periodId };

    const p = obterPicker();
    const candidatos = p.candidates;
    const linhas = candidatos
      .map(c => {
        const nome = c.presentationName;
        // `username` é texto de SESSÃO para desambiguar — nunca vai a atributo, storage ou payload.
        const usuario = c.username
          ? ` <span class="text-muted" style="font-size:11px;" title="Usuário observado nesta sessão — não é persistido">(${escapeHtml(c.username)})</span>`
          : '';
        const quando = ` <span class="text-muted" style="font-size:11px;">observado em ${escapeHtml(new Date(c.observedAt).toLocaleString('pt-BR'))}</span>`;
        const origem =
          c.source === SOURCE_KNOWN
            ? '<span class="reconcile-scope" title="Pessoa já registrada neste documento">já conhecida</span>'
            : '';
        // Resultado sem key (ou sem nome) APARECE, mas não é selecionável: não há vínculo externo.
        const acao = c.selectable
          ? `<button class="btn btn-sm" type="button" data-action="picker-include" data-picker-token="${escapeAttr(c.token)}" title="Inclui esta pessoa no período desta sprint. Nada é criado no Jira.">Adicionar ao roster</button>`
          : `<span class="text-muted" style="font-size:11px;">sem vínculo utilizável — não pode ser incluída</span>`;
        return `
              <div class="reconcile-row" style="padding:8px 16px;border-top:1px solid var(--border);">
                <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
                  ${statusIndicatorHtml(c.status)}<strong style="font-size:13px;">${escapeHtml(nome || '—')}</strong>${usuario}${origem}${quando}
                  ${acao}
                </div>
              </div>`;
      })
      .join('');

    // `empty` e `unavailable` são estados DIFERENTES e a mensagem precisa deixar isso claro.
    let aviso = PICKER_ESTADO_TEXTO[p.state] || '';
    if (p.state === PICKER_UNAVAILABLE) {
      aviso =
        candidatos.length > 0
          ? 'Busca indisponível — mostrando pessoas já conhecidas deste time.'
          : 'Busca indisponível e nenhuma pessoa conhecida está disponível.';
    }
    if (p.state === PICKER_ERROR) aviso = includeErrorText(p.error);
    const avisoHtml = aviso
      ? `<div class="${p.state === PICKER_ERROR ? 'warning' : 'text-muted'}" style="font-size:12px;margin:6px 0;">${escapeHtml(aviso)}</div>`
      : '';

    return `
            <div class="chart-card mb-16">
              <div class="chart-title">Incluir pessoa no roster</div>
              <div class="chart-subtitle">A busca consulta o Jira apenas para LEITURA. Incluir alguém altera só a configuração do JiraDash — nenhuma issue, apontamento ou atribuição é criada.</div>
              <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin:8px 0;">
                <input type="search" id="picker-query" autocomplete="off" placeholder="Parte do nome" value="${escapeAttr(p.query)}" style="width:220px;padding:4px 8px;font-size:12px;border:1px solid var(--border);border-radius:6px;" />
                <button class="btn btn-sm" type="button" data-action="picker-search" ${p.state === PICKER_LOADING ? 'disabled' : ''}>Buscar</button>
                <span class="text-muted" style="font-size:11px;">o texto digitado é só consulta — nunca vira uma pessoa</span>
              </div>
              ${avisoHtml}
              <div class="table-wrap">${linhas}</div>
            </div>`;
  },
  renderConfig({ force = false } = {}) {
    const confSnap = personConfig.snapshot();
    // Estado da config compartilhada — entra na signature pra re-renderizar em
    // destravar/travar e quando o doc do servidor muda.
    const shared = sharedConfig;
    // Travas só existem no modo shared: em local e offline a edição é sempre livre,
    // porque o único destino é o localStorage deste navegador.
    const locked = shared.isShared && shared.available && shared.editable && !shared.unlocked;
    const readOnlyServer = shared.isShared && shared.available && !shared.editable;
    const sharedSig = `${shared.mode}:${shared.available}:${shared.editable}:${shared.unlocked}:${shared.doc?.updatedAt || ''}`;
    // Signature inclui o ID da sprint atual + snapshot completo, pra invalidar quando
    // muda de sprint ou quando algum config muda em qualquer namespace.
    // CP10 — a GERAÇÃO de tokens de linha redigida entra na assinatura. Se ela mudou, o HTML em
    // cache carrega tokens que não resolvem mais: servi-lo deixaria na tela uma linha ineditável.
    // Com a geração aqui, ou o token do DOM continua válido, ou o DOM é substituído por inteiro.
    //
    // ⚠️ SINCRONIZAR ANTES da assinatura e ANTES da guarda. Quem abre a geração é a montagem do
    // roster, que só acontece lá embaixo: ler o contador aqui sem sincronizar gravaria uma
    // assinatura uma geração ATRASADA, e o render seguinte — dataset novo com `updatedAt` e
    // `dataVersion` iguais — sairia pelo cache antes de a geração nova existir, deixando DOM e mapa
    // no dataset anterior.
    const geracaoRedigidas = syncRedactedGeneration(confSnap);
    const signature = `${state.dataVersion}:${sharedSig}:${geracaoRedigidas}:${confSnap.currentSprintId || 'none'}:${JSON.stringify(confSnap.sprintsByid)}:${JSON.stringify(confSnap.globalDefault)}`;
    if (!force && state.renderedVersion.config === signature && $('#tab-config').innerHTML.trim()) return;

    const derived = issueService.getDerived();
    const sprintName = state.sprintInfo?.name || '';
    const hasSprintContext = !!confSnap.currentSprintId;

    // Cabeçalho da seção indica em qual sprint estamos editando.
    const title = hasSprintContext
      ? `Configuração — ${escapeHtml(sprintName || `Sprint ${confSnap.currentSprintId}`)}`
      : `Configuração — Global Default`;

    // Banner quando o JQL não tem Sprint = X — edições caem no Global Default.
    const noSprintWarning = hasSprintContext
      ? ''
      : `
            <div class="config-no-sprint-warning">
              ⚠ <strong>JQL sem <code>Sprint = X</code></strong> — as edições abaixo são salvas no <strong>Global Default</strong>
              (fallback usado quando uma sprint específica não tem config própria pra pessoa).
              Pra editar config de uma sprint específica, ajuste o JQL pra <code>Sprint = ID</code> antes de carregar.
            </div>`;

    // Resolve label "herdado de Sprint X" pra tooltip dos campos herdados.
    const inheritedLabel = source => {
      if (source === 'global') return 'Herdado do Global Default';
      if (!source) return '';
      // É um sprintId — tenta achar o nome em squadCache (snapshots) ou retorna "Sprint <id>"
      const cached = Object.values(squadCache).find(c => String(c.sprintInfo?.id) === source);
      const name = cached?.sprintInfo?.name;
      return name ? `Herdado de ${name}` : `Herdado da Sprint ${source}`;
    };

    // Config compartilhada travada (ou servidor sem código): campos desabilitados.
    // Sem servidor (proxy antigo/offline): edição local liberada como sempre foi.
    const editDisabled = locked || readOnlyServer ? 'disabled' : '';

    // Lista todas as pessoas relevantes pra esta sprint (com issue OU com config
    // explícita). Inclui inativas [X] pra permitir edição/visualização.
    const assignees = [...getScopeRoster(derived, confSnap)].sort();
    const capacityCell = formatCapacityCell;

    // Somatórios do time, para o resumo no rodapé da aba.
    const teamTotals = {
      cod: 0,
      reg: 0,
      total: 0,
      porPapel: { DEV: { cod: 0, reg: 0 }, QA: { cod: 0, reg: 0 } }
    };

    // CP6: identidade de apresentação. O DOM transporta um token OPACO (personId de binding
    // confirmado, senão handle de sessão) — nunca o displayName/key. A configuração legada segue
    // chaveada pelo displayName cru (`name`), resolvido do token só em memória na escrita.
    const presentation = derived.presentation;
    // Proveniência = associação DIRETA linha ↔ objeto Jira observado. Linha vinda só de
    // config/carry-forward não tem proveniência: status desconhecido e sem externalRef.
    const provenance = derived.rowProvenance;
    const envelope = sharedConfig.identityEnvelope;
    const slotFor = name =>
      confSnap.currentSprintId
        ? { kind: 'sprint', sprintId: String(confSnap.currentSprintId), displayName: name }
        : { kind: 'global', displayName: name };
    const personRows = assignees
      .map(name => {
        const conf = personConfig.get(name, confSnap);
        // ── CP10: linha de pessoa REDIGIDA ───────────────────────────────────────────────────
        // ⚠️ Ela NÃO passa por `presentation.resolve`. O registro do CP6 resolve por
        // slot / nome / proveniência — nada disso existe para quem foi redigido — e devolveria um
        // handle DIFERENTE do token do roster: o DOM carregaria um identificador que
        // `redactedPersonIdOf` não reconhece, e a escrita cairia no fluxo v1, sem coordenada.
        // A chave do roster JÁ é o token efêmero; é ela que vai ao DOM.
        const rotuloRedigido = redactedRosterLabel(name);
        const ident = rotuloRedigido
          ? { token: name, presentationName: rotuloRedigido, status: 'unknown' }
          : presentation
            ? presentation.resolve(name, { slot: slotFor(name), provenance, envelope })
            : { token: name, presentationName: stripStatusMarker(name), status: 'unknown' };
        const token = ident.token;
        const shownName = ident.presentationName;
        const capCod = personConfig.capacityCodificacaoTesteHours(conf);
        const capReg = personConfig.capacityRegressivoHours(conf);
        const capTotal = capCod + capReg;

        teamTotals.cod += capCod;
        teamTotals.reg += capReg;
        teamTotals.total += capTotal;
        if (teamTotals.porPapel[conf.papel]) {
          teamTotals.porPapel[conf.papel].cod += capCod;
          teamTotals.porPapel[conf.papel].reg += capReg;
        }

        const papelCls = conf.papelInherited ? 'input-inherited' : '';
        const codCls = conf.codificacaoTesteInherited ? 'input-inherited' : '';
        const regCls = conf.regressivoInherited ? 'input-inherited' : '';
        const horasCls = conf.horasInherited ? 'input-inherited' : '';
        const papelTitle = conf.papelInherited
          ? `title="${escapeAttr(inheritedLabel(conf.inheritedFrom.papel))}"`
          : '';
        const codTitle = conf.codificacaoTesteInherited
          ? `title="${escapeAttr(inheritedLabel(conf.inheritedFrom.codificacaoTeste))}"`
          : 'title="Dias do período de Codificação e Teste"';
        const regTitle = conf.regressivoInherited
          ? `title="${escapeAttr(inheritedLabel(conf.inheritedFrom.regressivo))}"`
          : 'title="Dias do período de Regressivo"';
        // ⚠️ O campo de horas é `type="text"` com `inputmode="decimal"`, NÃO `type="number"`.
        // Em `number`, o browser recusa a vírgula antes de qualquer JavaScript: quem digitasse
        // `5,12` veria `512` ou o campo esvaziar no blur, e nenhuma validação nossa seria
        // consultada. Com `text` o valor cru chega inteiro a `validateConfigField`, que aceita
        // vírgula e ponto. `inputmode="decimal"` preserva o teclado numérico, e o `aria-label`
        // supre o rótulo que o `type=number` dava de graça.
        const horasTitle = conf.horasInherited
          ? `title="${escapeAttr(inheritedLabel(conf.inheritedFrom.horas))}"`
          : 'title="Horas produtivas por dia — 0 a 24, até duas casas decimais (aceita vírgula ou ponto)"';
        // Memória de cálculo no tooltip das capacities — evita a dúvida "de onde saiu isso".
        const codCalc = capacityCalcTitle(conf.diasCodificacaoTeste, conf.horasProdutivas);
        const regCalc = capacityCalcTitle(conf.diasRegressivo, conf.horasProdutivas);

        // data-cfg-horas-efetiva guarda as horas/dia que o RENDER usou. O preview ao vivo
        // precisa dela: um campo de horas vazio não vale 0 na tela, vale o padrão — sem
        // isso a capacity despencaria pra 0 assim que a pessoa digitasse noutra coluna.
        return `
              <div class="grid-row cfg-row" style="padding:8px 16px;" data-cfg-row="${escapeAttr(token)}" data-cfg-horas-efetiva="${escapeAttr(conf.horasProdutivas)}" data-cap-cod="${escapeAttr(capCod)}" data-cap-reg="${escapeAttr(capReg)}">
                <div class="avatar">${escapeHtml(initials(shownName))}</div>
                <div class="truncate" title="${escapeAttr(shownName)}">${statusIndicatorHtml(ident.status)}${escapeHtml(shownName)}</div>
                <div>
                  <select class="role-select ${papelCls}" ${papelTitle} ${editDisabled} data-action="save-sprint-config" data-person="${escapeAttr(token)}" data-field="papel">
                    <option value="">—</option>
                    <option value="DEV" ${conf.papel === 'DEV' ? 'selected' : ''}>DEV</option>
                    <option value="QA" ${conf.papel === 'QA' ? 'selected' : ''}>QA</option>
                  </select>
                </div>
                <div class="text-right">
                  <input class="number-input ${codCls}" ${codTitle} ${editDisabled} type="number" min="0" max="31" step="1" value="${escapeAttr(conf.rawCodificacaoTeste)}" placeholder="—" data-action="save-sprint-config" data-person="${escapeAttr(token)}" data-field="diasCodificacaoTeste" />
                </div>
                <div class="text-right">
                  <input class="number-input ${regCls}" ${regTitle} ${editDisabled} type="number" min="0" max="31" step="1" value="${escapeAttr(conf.rawRegressivo)}" placeholder="—" data-action="save-sprint-config" data-person="${escapeAttr(token)}" data-field="diasRegressivo" />
                </div>
                <div class="text-right">
                  <input class="number-input ${horasCls}" ${horasTitle} ${editDisabled} type="text" inputmode="decimal" autocomplete="off" aria-label="Horas produtivas por dia" value="${escapeAttr(conf.rawHoras)}" placeholder="—" data-action="save-sprint-config" data-person="${escapeAttr(token)}" data-field="horasProdutivas" />
                </div>
                <div class="text-right text-muted" style="font-size:12px;" data-cap-cell="cod" title="${escapeAttr(codCalc)}">${escapeHtml(capacityCell(capCod, conf.rawCodificacaoTeste))}</div>
                <div class="text-right text-muted" style="font-size:12px;" data-cap-cell="reg" title="${escapeAttr(regCalc)}">${escapeHtml(capacityCell(capReg, conf.rawRegressivo))}</div>
                <div class="text-right font-semibold" style="font-size:12px;" data-cap-cell="total" title="${escapeAttr(`${codCalc} + ${regCalc}`)}">${escapeHtml(capacityCell(capTotal, conf.rawCodificacaoTeste, conf.rawRegressivo))}</div>
              </div>`;
      })
      .join('');

    // Conta quantos campos estão herdados pra dar feedback no rodapé. Os dois períodos
    // contam separado — cada um tem herança própria.
    const inheritedCount = assignees.reduce((sum, name) => {
      const conf = personConfig.get(name, confSnap);
      return (
        sum +
        (conf.papelInherited ? 1 : 0) +
        (conf.codificacaoTesteInherited ? 1 : 0) +
        (conf.regressivoInherited ? 1 : 0) +
        (conf.horasInherited ? 1 : 0)
      );
    }, 0);

    // Resumo do time. A separação DEV/QA só aparece quando há papel configurado —
    // sem nome de pessoa, só o agregado por papel.
    const papelParts = ['DEV', 'QA']
      .filter(role => teamTotals.porPapel[role].cod + teamTotals.porPapel[role].reg > 0)
      .map(role => {
        const t = teamTotals.porPapel[role];
        // MESMO formatador do preview ao vivo (`app.refreshCapacitySummary`): com `toFixed(1)`
        // aqui, o render inicial dizia 30.7h e a primeira tecla corrigia para 30.72h.
        const h = v => `${formatCapacityHours(v)}h`;
        return `${role} ${h(t.cod + t.reg)} (${h(t.cod)} + ${h(t.reg)})`;
      });
    // Os <span data-team-cap> são os alvos do preview ao vivo: só o texto deles muda
    // enquanto a pessoa digita, sem reconstruir o resumo.
    const teamSummary = `
            <div class="metrics-grid" style="margin-top:14px;">
              ${ui.renderMetric({ label: 'Capacity Codificação/Teste', value: `<span data-team-cap="cod">${escapeHtml(formatCapacityHours(teamTotals.cod))}h</span>` })}
              ${ui.renderMetric({ label: 'Capacity Regressivo', value: `<span data-team-cap="reg">${escapeHtml(formatCapacityHours(teamTotals.reg))}h</span>` })}
              ${ui.renderMetric({ label: 'Capacity Total', value: `<span data-team-cap="total">${escapeHtml(formatCapacityHours(teamTotals.total))}h</span>`, sub: `<span data-team-cap="papel">${escapeHtml(papelParts.join(' · '))}</span>` })}
            </div>`;

    const footerNote = hasSprintContext
      ? `
            <div style="margin-top:12px;font-size:11px;color:var(--text-soft);line-height:1.6;">
              Valores em <em>itálico</em> são herdados (da sprint anterior mais recente ou do Global Default).
              ${inheritedCount > 0 ? `Há <strong>${inheritedCount}</strong> campo(s) herdado(s) — edite pra fixar pra esta sprint.` : 'Todos os campos foram configurados pra esta sprint.'}
              Editar qualquer campo salva o valor especificamente pra esta sprint.
            </div>`
      : `
            <div style="margin-top:12px;font-size:11px;color:var(--text-soft);line-height:1.6;">
              Configurações aqui são salvas no <strong>Global Default</strong> e usadas como fallback pra qualquer sprint sem config própria.
            </div>`;

    // Barra de status da config compartilhada + controles de trava.
    const updatedAtLabel = shared.doc?.updatedAt
      ? ` · atualizada em ${new Date(shared.doc.updatedAt).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}`
      : '';
    // Seed só existe no modo shared: publicar a config local num servidor que nem
    // guarda config não faz sentido.
    const showSeed =
      shared.isShared &&
      shared.unlocked &&
      shared.serverDocIsEmpty() &&
      (Object.keys(confSnap.sprintsByid).length > 0 || Object.keys(confSnap.globalDefault).length > 0);
    // Quatro estados VISUALMENTE distintos. "Local" e "servidor compartilhado vazio"
    // não são a mesma coisa e não podem parecer a mesma coisa: no primeiro ninguém
    // mais é afetado; no segundo, publicar o seed muda a config de todo mundo.
    const sharedBar = shared.isLocal
      ? `
            <div class="config-no-sprint-warning">
              💻 <strong>Modo local</strong> — alterações salvas somente neste navegador e não afetam outros usuários.
              O servidor está rodando sem configuração compartilhada (<code>CONFIG_MODE=local</code>).
            </div>`
      : !shared.available
        ? `
            <div class="config-no-sprint-warning">
              ⚠ <strong>Config compartilhada indisponível</strong> — o servidor não respondeu em <code>/config</code>.
              As edições abaixo valem só neste navegador até o servidor voltar.
            </div>`
        : readOnlyServer
          ? `
            <div class="config-no-sprint-warning">
              🔒 <strong>Somente leitura</strong> — a config é compartilhada (todos veem a mesma), mas o servidor
              está sem <code>CONFIG_EDIT_CODE</code>; edição desabilitada até configurá-lo.
            </div>`
          : shared.unlocked
            ? `
            <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin-bottom:12px;font-size:12px;">
              <span style="color:var(--success);font-weight:600;">🔓 Edição destravada</span>
              <span style="color:var(--text-soft);">config compartilhada — suas edições valem pra todos${updatedAtLabel}</span>
              <button class="btn btn-sm" type="button" data-action="config-lock">Travar</button>
              ${showSeed ? `<button class="btn btn-sm" type="button" data-action="config-seed" title="O servidor ainda não tem config — publica a config salva neste navegador como ponto de partida pra todos">Publicar config local no servidor</button>` : ''}
            </div>`
            : `
            <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin-bottom:12px;font-size:12px;">
              <span style="font-weight:600;">🔒 Config compartilhada</span>
              <span style="color:var(--text-soft);">todos veem a mesma${updatedAtLabel} — pra editar, informe o código:</span>
              <input type="password" id="config-edit-code-input" autocomplete="off" placeholder="Código de edição" style="width:150px;padding:4px 8px;font-size:12px;border:1px solid var(--border);border-radius:6px;" />
              <button class="btn btn-sm" type="button" data-action="config-unlock">Destravar edição</button>
            </div>`;

    // CP8: painel de reconciliação. Construído DEPOIS da tabela, sem request e sem tocar o
    // documento — só reconstrói a fila em memória e devolve HTML (vazio quando não deve aparecer).
    const reconcilePanel = this.buildReconciliationPanel(derived, confSnap);
    // CP9: painel do picker. Também não faz request — só desenha o estado atual em memória.
    const pickerPanel = this.buildPickerPanel(derived, confSnap);
    // CP10: painel do ciclo de vida. Idem — nenhum request; só HTML a partir do que já está em
    // memória, com tokens opacos descartáveis.
    const lifecyclePanel = this.buildLifecyclePanel(confSnap, derived);

    $('#tab-config').innerHTML = `
            ${noSprintWarning}
            ${pickerPanel}
            ${lifecyclePanel}
            ${reconcilePanel}
            <div class="chart-card mb-16">
              <div class="chart-title">${title}</div>
              ${sharedBar}
              <div class="table-wrap">
                <div class="grid-row cfg-row row-header" style="background:transparent;padding:4px 16px 6px;">
                  <div></div>
                  <div>Colaborador</div>
                  <div>Papel</div>
                  <div class="text-right" title="Dias do período de Codificação e Teste">Cod./Teste (dias)</div>
                  <div class="text-right" title="Dias do período de Regressivo">Regressivo (dias)</div>
                  <div class="text-right" title="Horas produtivas por dia">Hrs prod./dia</div>
                  <div class="text-right" title="Dias de Codificação/Teste × horas produtivas/dia">Cap. Cod./Teste</div>
                  <div class="text-right" title="Dias de Regressivo × horas produtivas/dia">Cap. Regressivo</div>
                  <div class="text-right" title="Cap. Codificação/Teste + Cap. Regressivo">Cap. Total</div>
                </div>
                ${personRows || '<div class="empty-msg">Nenhum responsável encontrado.</div>'}
              </div>
              ${teamSummary}
              ${footerNote}
            </div>`;

    state.renderedVersion.config = signature;
  },
  // UMA linha do quadro "Estimado vs Apontado por issue pai", com o drill-down de subtasks.
  //
  // ⚠️ A seta aparece por regra ESTRUTURAL — o pai tem subtask materializada no dataset —, nunca
  // pelo TIPO da issue. Bug, Tarefa e Capacitação com filho são tão expansíveis quanto História;
  // `isContainerType()` não é consultado aqui.
  //
  // ⚠️ Os IDs saem do ÍNDICE do pai no quadro, jamais de resumo/tipo/status: texto do Jira em id
  // colide (dois resumos iguais) e ainda vazaria conteúdo para o DOM. `aria-controls` aponta para
  // o contêiner dos filhos, e é pelo id do botão que o foco volta depois do re-render.
  horasParentRow(p, indice, barW) {
    const estH = secondsToHoursNumber(p.estimated);
    const sptH = secondsToHoursNumber(p.spent);
    const summary = p.fullLabel.includes(' · ') ? p.fullLabel.slice(p.fullLabel.indexOf(' · ') + 3) : '';
    const statusBadge = p.status
      ? `<span class="badge-inline ${issueRules.getStatusBadgeClass(p.status)}" title="${escapeAttr(p.status)}">${escapeHtml(p.status)}</span>`
      : '';
    const subtasks = p.subtasks || [];
    const temFilhos = subtasks.length > 0;
    const aberto = temFilhos && state.hoursExpandedParents.has(p.key);
    const idPainel = `horas-subtasks-${indice}`;
    const idBotao = `horas-subtasks-btn-${indice}`;
    // Sem filhos: um espaçador do MESMO tamanho do botão, para a chave e o resumo não dançarem
    // entre linhas com e sem seta.
    const botao = temFilhos
      ? `<button type="button" class="hours-expand" id="${escapeAttr(idBotao)}" data-action="toggle-hours-subtasks" data-parent-key="${escapeAttr(p.key)}" aria-expanded="${aberto ? 'true' : 'false'}" aria-controls="${escapeAttr(idPainel)}" aria-label="${escapeAttr(`${aberto ? 'Ocultar' : 'Exibir'} subtasks de ${p.key}`)}"><span aria-hidden="true">${aberto ? '▾' : '▸'}</span></button>`
      : '<span class="hours-expand-spacer" aria-hidden="true"></span>';

    // ⚠️ O contêiner existe SEMPRE que há botão — fechado ele fica `hidden` e vazio, aberto perde o
    // `hidden` e recebe as linhas. `aria-controls` apontando para um id inexistente é referência
    // quebrada: o leitor de tela anuncia um controle que não controla nada, e "ir para a região
    // controlada" não leva a lugar nenhum. Mesmo id nos dois estados, sempre.
    const linhasFilhas = temFilhos
      ? `
                  <div class="hours-subtasks" id="${escapeAttr(idPainel)}"${aberto ? '' : ' hidden'}>
                    ${aberto ? subtasks.map(sub => this.horasSubtaskRow(sub, barW)).join('') : ''}
                  </div>`
      : '';

    return `
                  <div style="display:flex;align-items:center;gap:12px;padding:6px 0;border-bottom:1px solid #f5f5f0;min-height:46px;">
                    ${botao}
                    <div style="flex:0 0 240px;display:flex;flex-direction:column;gap:2px;overflow:hidden;">
                      <div style="display:flex;align-items:center;gap:6px;white-space:nowrap;overflow:hidden;">
                        <a href="${CONFIG.jiraBrowseBase}${encodeURIComponent(p.key)}" target="_blank" rel="noopener noreferrer" class="issue-key" style="font-size:12px;font-weight:600;white-space:nowrap;flex-shrink:0;">${escapeHtml(p.key)}</a>
                        ${statusBadge}
                      </div>
                      <span class="text-muted" style="font-size:11px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="${escapeAttr(p.fullLabel)}">${escapeHtml(summary)}</span>
                    </div>
                    <div style="flex:1;display:flex;flex-direction:column;gap:4px;">
                      <div style="display:flex;align-items:center;gap:6px;">
                        <div style="flex:1;background:#f0f0ec;border-radius:3px;overflow:hidden;height:13px;"><div style="width:${barW(p.estimated).toFixed(1)}%;background:#378ADD;height:100%;border-radius:3px;"></div></div>
                        <span style="flex:0 0 44px;text-align:right;font-size:11px;color:#378ADD;font-weight:600;">${estH > 0 ? estH + 'h' : '—'}</span>
                      </div>
                      <div style="display:flex;align-items:center;gap:6px;">
                        <div style="flex:1;background:#f0f0ec;border-radius:3px;overflow:hidden;height:13px;"><div style="width:${barW(p.spent).toFixed(1)}%;background:#1D9E75;height:100%;border-radius:3px;"></div></div>
                        <span style="flex:0 0 44px;text-align:right;font-size:11px;color:#1D9E75;font-weight:600;">${sptH > 0 ? sptH + 'h' : '—'}</span>
                      </div>
                    </div>
                  </div>${linhasFilhas}`;
  },
  // UMA subtask do drill-down. Usa a MESMA escala (`barW`) do quadro: a barra do filho é
  // comparável à do pai. Transformá-la em percentual próprio mudaria a semântica visual sem aviso.
  horasSubtaskRow(sub, barW) {
    const estH = secondsToHoursNumber(sub.estimated);
    const sptH = secondsToHoursNumber(sub.spent);
    const statusBadge = sub.status
      ? `<span class="badge-inline ${issueRules.getStatusBadgeClass(sub.status)}" title="${escapeAttr(sub.status)}">${escapeHtml(sub.status)}</span>`
      : '';
    // Responsável é informação SECUNDÁRIA — e ausente é ausente, não "Não atribuído" inventado.
    const responsavel = sub.assignee
      ? `<span class="hours-subtask-assignee" title="${escapeAttr(sub.assignee)}">${escapeHtml(compactName(sub.assignee))}</span>`
      : '';
    return `
                      <div class="hours-subtask-row">
                        <div class="hours-subtask-ident">
                          <div class="hours-subtask-head">
                            <a href="${CONFIG.jiraBrowseBase}${encodeURIComponent(sub.key)}" target="_blank" rel="noopener noreferrer" class="issue-key">${escapeHtml(sub.key)}</a>
                            ${statusBadge}
                          </div>
                          <span class="hours-subtask-summary" title="${escapeAttr(`${sub.key} · ${sub.summary}${sub.issueType ? ` · ${sub.issueType}` : ''}`)}">${escapeHtml(sub.summary)}</span>
                          ${responsavel}
                        </div>
                        <div class="hours-subtask-bars">
                          <div class="hours-subtask-bar">
                            <div class="hours-bar-track"><div style="width:${barW(sub.estimated).toFixed(1)}%;background:#378ADD;height:100%;border-radius:3px;"></div></div>
                            <span class="hours-bar-value" style="color:#378ADD;">${estH > 0 ? estH + 'h' : '—'}</span>
                          </div>
                          <div class="hours-subtask-bar">
                            <div class="hours-bar-track"><div style="width:${barW(sub.spent).toFixed(1)}%;background:#1D9E75;height:100%;border-radius:3px;"></div></div>
                            <span class="hours-bar-value" style="color:#1D9E75;">${sptH > 0 ? sptH + 'h' : '—'}</span>
                          </div>
                        </div>
                      </div>`;
  },
  renderHoras() {
    if (state.renderedVersion.horas === state.dataVersion && $('#tab-horas').innerHTML.trim()) return;

    const derived = issueService.getDerived();
    const { horas } = derived;
    state.horasSpentByPerson = horas.horasSpentByPerson;
    const totalParents = derived.parents.length;
    const shownParents = horas.parentData.length;
    const hiddenParents = totalParents - shownParents;
    const remaining = horas.totalEstimated - horas.totalSpent;
    const balanceClass = remaining >= 0 ? 'success' : 'danger';
    const balanceText =
      remaining >= 0
        ? `${secondsToHours(remaining)} restantes`
        : `${secondsToHours(Math.abs(remaining))} excedidas`;
    const confSnap = personConfig.snapshot();
    const maxSecs = Math.max(1, ...horas.parentData.map(p => Math.max(p.estimated, p.spent)));
    const barW = secs => (secs <= 0 ? 0 : Math.min(100, (secs / maxSecs) * 100));

    const rows = horas.assignees
      .map(([name, spent]) => {
        const conf = personConfig.get(name, confSnap);
        const capacityHours = personConfig.capacityHours(conf);
        const capacitySecs = capacityHours * 3600;
        const percent = capacitySecs > 0 ? Math.round((spent / capacitySecs) * 100) : null;
        const percentColor = percent === null ? CONFIG.colors.muted : utilizationColor(percent);
        const saldoSecs = capacitySecs > 0 ? capacitySecs - spent : null;
        const saldoColor =
          saldoSecs === null
            ? CONFIG.colors.muted
            : saldoSecs >= 0
              ? CONFIG.colors.success
              : CONFIG.colors.danger;
        const saldoText =
          saldoSecs === null ? '—' : `${saldoSecs >= 0 ? '+' : ''}${(saldoSecs / 3600).toFixed(1)}h`;

        return `
              <div class="grid-row hrow">
                <div class="avatar">${escapeHtml(initials(name))}</div>
                <div class="truncate" title="${escapeAttr(name)}">${escapeHtml(name)}</div>
                <div class="text-muted" style="font-size:12px;">${escapeHtml(conf.papel || '—')}</div>
                <div class="text-right">${secondsToHours(spent)}</div>
                <div class="text-right text-muted">${capacityHours > 0 ? capacityHours.toFixed(1) + 'h' : '—'}</div>
                <div class="text-right font-semibold" style="color:${percentColor};">${percent !== null ? `${percent}%` : '—'}</div>
                <div class="text-right font-semibold" style="color:${saldoColor};">${escapeHtml(saldoText)}</div>
              </div>`;
      })
      .join('');

    const realizadoHByRole = role => (horas.realizadoByTrilha[role] || 0) / 3600;
    const realizadoNA = realizadoHByRole('NA');
    const realizadoGestao = realizadoHByRole('GESTAO');

    // Breakdown do Não classificado por tipo de issue.
    // Distingue 3 origens: (a) tipo fora do mapa, (b) container com hora no pai, (c) sem tipo.
    const naBreakdown = new Map(); // typeName -> { secs, kind, sample }
    if (realizadoNA > 0) {
      for (const issue of derived.issues) {
        if (getTrilha(issue) !== 'NA') continue;
        const meta = derived.issueMetaByKey.get(issue.key);
        const spent = meta?.spent || 0;
        if (spent <= 0) continue;
        const typeName = issue.fields.issuetype?.name || 'Sem tipo';
        const kind = isContainerType(issue) ? 'container' : 'fora-do-mapa';
        const entry = naBreakdown.get(typeName) || { secs: 0, kind, samples: [] };
        entry.secs += spent;
        if (entry.samples.length < 3) entry.samples.push(issue.key);
        naBreakdown.set(typeName, entry);
      }
    }
    const naBreakdownEntries = [...naBreakdown.entries()].sort((a, b) => b[1].secs - a[1].secs);

    $('#tab-horas').innerHTML = `
            <div class="metrics-grid mb-24">
              ${ui.renderMetric({ label: 'Gestão / Reuniões', value: realizadoGestao > 0 ? realizadoGestao.toFixed(1) + 'h' : '—', sub: realizadoGestao > 0 ? 'overhead esperado — já descontado do capacity produtivo' : 'sem apontamentos em Gestão' })}
              ${ui.renderMetric({ label: 'Não classificado', value: realizadoNA > 0 ? realizadoNA.toFixed(1) + 'h' : '—', sub: realizadoNA > 0 ? 'horas fora de DEV/QA — verificar mapa ou containers sem subtasks' : 'tudo classificado', className: realizadoNA > 0 ? 'warning' : '' })}
            </div>
            ${
              naBreakdownEntries.length
                ? `
              <div class="chart-card mb-24" style="border-left:3px solid var(--warning);">
                <div class="chart-title warning" style="margin-bottom:8px;">⚠ Detalhamento do "Não classificado"</div>
                <div style="font-size:12px;color:var(--text-muted);margin-bottom:10px;">
                  Estes tipos de issue contribuíram com horas fora de DEV/QA.
                  <strong>"container"</strong> = pai container com hora no próprio pai (deveria ter subtask).
                  <strong>"fora-do-mapa"</strong> = tipo não classificado em DEV nem QA — adicionar ao mapa.
                </div>
                <div style="display:grid;grid-template-columns:1fr 90px 110px 1fr;gap:8px;font-size:12px;padding:6px 0;border-bottom:1px solid var(--border-soft);color:var(--text-soft);font-weight:600;text-transform:uppercase;letter-spacing:.04em;">
                  <div>Tipo</div><div class="text-right">Horas</div><div>Origem</div><div>Exemplos</div>
                </div>
                ${naBreakdownEntries
                  .map(
                    ([type, info]) => `
                  <div style="display:grid;grid-template-columns:1fr 90px 110px 1fr;gap:8px;font-size:12px;padding:6px 0;border-bottom:1px solid var(--border-soft);align-items:center;">
                    <div class="truncate" title="${escapeAttr(type)}">${escapeHtml(type)}</div>
                    <div class="text-right warning font-semibold">${(info.secs / 3600).toFixed(1)}h</div>
                    <div><span class="badge ${info.kind === 'container' ? 'b-review' : 'b-blocked'}" style="display:inline-block;">${info.kind}</span></div>
                    <div class="truncate text-muted" style="font-family:monospace;font-size:11px;" title="${escapeAttr(info.samples.join(', '))}">${escapeHtml(info.samples.join(', '))}</div>
                  </div>`
                  )
                  .join('')}
              </div>`
                : ''
            }
            <div class="metrics-grid mb-24">
              ${ui.renderMetric({ label: 'Total estimado', value: secondsToHours(horas.totalEstimated), sub: 'pais + subtasks da sprint' })}
              ${ui.renderMetric({ label: 'Total apontado', value: secondsToHours(horas.totalSpent), sub: 'horas já registradas' })}
              ${ui.renderMetric({ label: 'Saldo', value: balanceText, className: balanceClass, sub: horas.totalEstimated > 0 ? `${Math.round((horas.totalSpent / horas.totalEstimated) * 100)}% consumido` : 'sem estimativas' })}
            </div>
            <div class="table-wrap mb-24">
              <div class="grid-row hrow row-header">
                <div></div><div>Responsável</div><div>Papel</div><div class="text-right">Apontado</div><div class="text-right">Capacity</div><div class="text-right">% Utilizado</div><div class="text-right">Saldo</div>
              </div>
              ${rows || '<div class="empty-msg">Nenhum apontamento encontrado.</div>'}
            </div>
            <div class="chart-card">
              <div class="chart-title">
                Estimado vs Apontado por issue pai (horas)
                ${
                  hiddenParents > 0
                    ? `
                  <span class="perf-note" title="${hiddenParents} issue(s) pai do sprint estão ocultas por não terem estimativa nem apontamento. O total do sprint vem do JQL; aqui exibimos apenas as que têm algum dado para visualizar.">
                    ⚠ ${shownParents} de ${totalParents} exibidas
                  </span>`
                    : ''
                }
              </div>
              <div style="display:flex;gap:18px;margin-bottom:12px;font-size:12px;align-items:center;">
                <div style="display:flex;align-items:center;gap:5px;"><div style="width:12px;height:12px;background:#378ADD;border-radius:2px;flex-shrink:0;"></div><span>Estimado</span></div>
                <div style="display:flex;align-items:center;gap:5px;"><div style="width:12px;height:12px;background:#1D9E75;border-radius:2px;flex-shrink:0;"></div><span>Apontado</span></div>
              </div>
              ${
                horas.parentData.length
                  ? horas.parentData.map((p, indice) => this.horasParentRow(p, indice, barW)).join('')
                  : '<div class="empty-msg">Nenhuma issue com estimativa.</div>'
              }
            </div>`;

    state.renderedVersion.horas = state.dataVersion;
  },
  renderQuality() {
    if (state.renderedVersion.quality === state.dataVersion && $('#tab-quality').innerHTML.trim()) return;

    const derived = issueService.getDerived();
    const bugs = issueService.getSprintBugs();
    const horasDefeitoHrs = bugs ? bugs.horasDefeitoSecs / 3600 : 0;

    // Detalhe dos defeitos abertos: lista cada bug ainda aberto com seu Identificador e
    // Tipo do Defeito (customfields descobertos por nome em fetchFieldMeta). Só aparece
    // quando há defeitos abertos e pelo menos um dos campos existe na instância do Jira.
    const temCamposDefeito = !!(state.identificadorFieldId || state.tipoDefeitoFieldId);
    const abertosDetalhe =
      bugs && bugs.abertos.length > 0 && temCamposDefeito
        ? `
            <div style="margin-top:14px;">
              <div style="font-size:11px;font-weight:600;color:var(--text-soft);margin-bottom:6px;text-transform:uppercase;letter-spacing:.04em;">Defeitos abertos — detalhamento</div>
              <div style="display:grid;grid-template-columns:auto 1fr 1fr;gap:0;font-size:12px;border:1px solid var(--border);border-radius:8px;overflow:hidden;">
                <div style="padding:6px 10px;background:var(--bg-soft,rgba(255,255,255,.03));font-weight:600;color:var(--text-soft);">Chave</div>
                <div style="padding:6px 10px;background:var(--bg-soft,rgba(255,255,255,.03));font-weight:600;color:var(--text-soft);">Identificador</div>
                <div style="padding:6px 10px;background:var(--bg-soft,rgba(255,255,255,.03));font-weight:600;color:var(--text-soft);">Tipo do Defeito</div>
                ${bugs.abertos
                  .map(issue => {
                    const identificador = customFieldText(issue.fields[state.identificadorFieldId]) || '—';
                    const tipoDefeito = customFieldText(issue.fields[state.tipoDefeitoFieldId]) || '—';
                    return `
                    <div style="padding:6px 10px;border-top:1px solid var(--border);">${this.jiraIssueLink(issue)}</div>
                    <div style="padding:6px 10px;border-top:1px solid var(--border);" title="${escapeAttr(identificador)}">${escapeHtml(identificador)}</div>
                    <div style="padding:6px 10px;border-top:1px solid var(--border);" title="${escapeAttr(tipoDefeito)}">${escapeHtml(tipoDefeito)}</div>`;
                  })
                  .join('')}
              </div>
            </div>`
        : '';

    // Totalizadores: quantos defeitos CRIADOS na sprint caíram em cada Identificador e em
    // cada Tipo do Defeito. Defeito sem o campo preenchido entra como "Não informado".
    const agrupaPorCampo = (issues, fieldId) => {
      const counts = {};
      for (const issue of issues) {
        const text = (fieldId && customFieldText(issue.fields[fieldId])) || 'Não informado';
        counts[text] = (counts[text] || 0) + 1;
      }
      return Object.entries(counts).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
    };
    const totalizadorCol = (titulo, rows) => `
            <div style="flex:1;min-width:220px;">
              <div style="font-size:11px;font-weight:600;color:var(--text-soft);margin-bottom:6px;text-transform:uppercase;letter-spacing:.04em;">${titulo}</div>
              <div style="display:grid;grid-template-columns:1fr auto;font-size:12px;border:1px solid var(--border);border-radius:8px;overflow:hidden;">
                ${rows
                  .map(
                    ([label, count]) => `
                  <div style="padding:5px 10px;border-top:1px solid var(--border);" title="${escapeAttr(label)}">${escapeHtml(label)}</div>
                  <div style="padding:5px 10px;border-top:1px solid var(--border);text-align:right;font-weight:600;">${count}</div>`
                  )
                  .join('')}
              </div>
            </div>`;
    const totalizadores =
      bugs && bugs.created.length > 0 && temCamposDefeito
        ? `
            <div style="margin-top:14px;">
              <div style="font-size:11px;font-weight:600;color:var(--text-soft);margin-bottom:8px;text-transform:uppercase;letter-spacing:.04em;">Totais por categoria — defeitos criados na sprint</div>
              <div style="display:flex;flex-wrap:wrap;gap:16px;">
                ${state.identificadorFieldId ? totalizadorCol('Por Identificador', agrupaPorCampo(bugs.created, state.identificadorFieldId)) : ''}
                ${state.tipoDefeitoFieldId ? totalizadorCol('Por Tipo do Defeito', agrupaPorCampo(bugs.created, state.tipoDefeitoFieldId)) : ''}
              </div>
            </div>`
        : '';

    // Horas por Tipo do Defeito: lente de ESFORÇO (apontamento na janela), diferente da
    // contagem acima (defeitos CRIADOS na sprint). Denominadores distintos — por isso vai
    // em bloco separado. A soma bate com o card "Horas em Defeitos".
    const horasPorTipoRows = bugs
      ? Object.entries(bugs.horasPorTipoDefeitoSecs)
          .map(([tipo, secs]) => [tipo, secs / 3600])
          .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      : [];
    const horasPorTipo =
      bugs && state.tipoDefeitoFieldId && horasPorTipoRows.length > 0
        ? `
            <div style="margin-top:14px;">
              <div style="font-size:11px;font-weight:600;color:var(--text-soft);margin-bottom:4px;text-transform:uppercase;letter-spacing:.04em;">Horas por tipo do defeito</div>
              <div style="font-size:11px;color:var(--text-soft);margin-bottom:8px;">esforço apontado nas subtasks de Defeito na janela da sprint — soma bate com "Horas em Defeitos", independente de quando o bug foi criado</div>
              <div style="display:flex;flex-wrap:wrap;gap:16px;">
                ${totalizadorCol(
                  'Por Tipo do Defeito',
                  horasPorTipoRows.map(([tipo, h]) => [tipo, `${h.toFixed(1)}h`])
                )}
              </div>
            </div>`
        : '';

    const bugsSection = bugs
      ? `
            <div class="chart-card mb-20">
              <div class="chart-title">Bugs na sprint</div>
              <div class="chart-subtitle">bugs (issues pai ou subtasks de tipo Defeito/Bug) criados dentro da janela da sprint</div>
              <div class="metrics-grid" style="margin-top:12px;">
                ${ui.renderMetric({ label: 'Criados na sprint', value: bugs.created.length, sub: 'bugs identificados durante a sprint', className: bugs.created.length > 0 ? 'warning' : '' })}
                ${ui.renderMetric({ label: 'Resolvidos', value: bugs.resolvidosNaSprint.length, sub: 'dos criados, já fechados na própria sprint', className: bugs.resolvidosNaSprint.length > 0 ? 'success' : '' })}
                ${ui.renderMetric({ label: 'Ainda abertos', value: bugs.abertos.length, sub: bugs.abertos.length > 0 ? 'criados na sprint, sem resolução' : 'nenhum', className: bugs.abertos.length > 0 ? 'danger' : '' })}
                ${ui.renderMetric({ label: 'Horas em Defeitos', value: horasDefeitoHrs > 0 ? `${horasDefeitoHrs.toFixed(1)}h` : '—', sub: horasDefeitoHrs > 0 ? 'apontadas em subtasks de Defeito na janela da sprint' : 'sem apontamento em Defeitos', className: horasDefeitoHrs > 0 ? 'warning' : '' })}
              </div>
              ${
                bugs.created.length > 0
                  ? `
                <div style="margin-top:12px;font-size:11px;color:var(--text-soft);line-height:1.7;">
                  <div><strong>Bugs criados:</strong> ${issueKeyList(bugs.created)}</div>
                </div>`
                  : ''
              }
              ${abertosDetalhe}
              ${totalizadores}
              ${horasPorTipo}
              <div style="margin-top:10px;font-size:11px;color:var(--text-soft);line-height:1.5;">
                Considera issues (pai ou subtask) cujo <code>issuetype</code> contém "bug", "defeito" ou "defect" — captura "Bug", "Defeito (Sub-tarefa)", etc.
                Cada bug é contado uma vez pelo seu próprio key. Variação A: só o que aconteceu dentro da janela da sprint.
                <strong>Horas em Defeitos</strong>: apontamento total nas subtasks de tipo Defeito durante a sprint — mede o esforço gasto consertando bugs (independente de quando o bug foi criado).
              </div>
            </div>`
      : `
            <div class="chart-card mb-20">
              <div class="chart-title">Bugs na sprint</div>
              <div style="font-size:13px;color:var(--text-soft);">Sprint sem janela definida (precisa de <code>Sprint = ID</code> no JQL com startDate/endDate).</div>
            </div>`;

    // Tempo excedido — parents com timeExceeded === true.
    // IMPORTANTE: usa Estimativa Original (committed), não Ajustado. Estouro só faz
    // sentido contra o valor congelado no planning — se usar Ajustado, o próprio
    // apontado entra na conta e a métrica fica artificialmente pequena.
    const excedidasParents = derived.parents
      .map(parent => ({ issue: parent, meta: derived.parentMetaByKey.get(parent.key) }))
      .filter(entry => entry.meta?.timeExceeded)
      .map(entry => {
        const est = (entry.meta.originalEstimatedEffective || 0) / 3600;
        const spt = entry.meta.spentTotal / 3600;
        return { ...entry, estH: est, sptH: spt, excedente: spt - est };
      })
      .sort((a, b) => b.excedente - a.excedente);

    const excedidasRows = excedidasParents
      .map(
        entry => `
            <div class="grid-row cy-row">
              ${this.jiraIssueLink(entry.issue)}
              <div class="issue-summary" title="${escapeAttr(entry.issue.fields.summary || '')}">${escapeHtml(entry.issue.fields.summary || 'Sem título')}</div>
              <div class="truncate text-muted" title="${escapeAttr(entry.issue.fields.assignee?.displayName || 'Não atribuído')}">${escapeHtml(entry.issue.fields.assignee?.displayName ? compactName(entry.issue.fields.assignee.displayName) : 'Não atribuído')}</div>
              ${renderStatusBadge(entry.issue.fields.status.name)}
              <div class="text-right text-muted">${entry.estH.toFixed(1)}h</div>
              <div class="text-right">${entry.sptH.toFixed(1)}h</div>
              <div class="text-right warning font-semibold">+${entry.excedente.toFixed(1)}h</div>
              <div></div>
            </div>`
      )
      .join('');

    const excedidasSection = `
            <div class="chart-card mb-20">
              <div class="chart-title">Tempo excedido</div>
              <div class="chart-subtitle">issues pai onde o apontado ultrapassou a Estimativa Original (committed no planning)</div>
              <div class="metrics-grid" style="margin-top:12px;margin-bottom:16px;">
                ${ui.renderMetric({ label: 'Issues excedidas', value: excedidasParents.length, className: excedidasParents.length > 0 ? 'warning' : 'success', sub: excedidasParents.length > 0 ? 'apontado > Estimativa Original' : 'nenhuma' })}
                ${ui.renderMetric({ label: 'Excedente total', value: excedidasParents.length ? `${excedidasParents.reduce((s, e) => s + e.excedente, 0).toFixed(1)}h` : '—', sub: excedidasParents.length ? 'soma do estouro acima do committed' : '' })}
              </div>
              ${
                excedidasParents.length
                  ? `
                <div class="table-wrap">
                  <div class="grid-row cy-row row-header">
                    <div>Chave</div><div>Resumo</div><div>Responsável</div><div>Status</div>
                    <div class="text-right">Est. Original</div><div class="text-right">Apontado</div><div class="text-right">Excedente</div><div></div>
                  </div>
                  ${excedidasRows}
                </div>`
                  : ''
              }
              <div style="margin-top:10px;font-size:11px;color:var(--text-soft);line-height:1.5;">
                Compara o <strong>apontado total</strong> contra a <strong>Estimativa Original</strong> (timeoriginalestimate) — o valor congelado no planning. Pais sem Estimativa Original (ex.: estimativa só nas subtasks) somam a estimativa dos filhos.
              </div>
            </div>`;

    // Impedidas — parents com isImpediment === true
    const impedidasParents = derived.parents.filter(
      parent => derived.parentMetaByKey.get(parent.key)?.isImpediment
    );

    const impedidasRows = impedidasParents
      .map(parent => {
        const meta = derived.parentMetaByKey.get(parent.key);
        const dateEntered = meta?.enteredCurrentStatus || new Date(parent.fields.created);
        return `
              <div class="grid-row cy-row">
                ${this.jiraIssueLink(parent)}
                <div class="issue-summary" title="${escapeAttr(parent.fields.summary || '')}">${escapeHtml(parent.fields.summary || 'Sem título')}</div>
                <div class="truncate text-muted" title="${escapeAttr(parent.fields.assignee?.displayName || 'Não atribuído')}">${escapeHtml(parent.fields.assignee?.displayName ? compactName(parent.fields.assignee.displayName) : 'Não atribuído')}</div>
                ${renderStatusBadge(parent.fields.status.name)}
                <div class="text-right text-muted">${formatDate(dateEntered)}</div>
                <div class="text-right danger font-semibold">Impedida</div>
                <div></div><div></div>
              </div>`;
      })
      .join('');

    const impedidasSection = `
            <div class="chart-card">
              <div class="chart-title">Impedidas</div>
              <div class="chart-subtitle">issues pai com flag de impediment ativa</div>
              <div class="metrics-grid" style="margin-top:12px;margin-bottom:16px;">
                ${ui.renderMetric({ label: 'Issues impedidas', value: impedidasParents.length, className: impedidasParents.length > 0 ? 'danger' : 'success', sub: impedidasParents.length > 0 ? 'Flagged: Impediment ativa' : 'nenhuma' })}
              </div>
              ${
                impedidasParents.length
                  ? `
                <div class="table-wrap">
                  <div class="grid-row cy-row row-header">
                    <div>Chave</div><div>Resumo</div><div>Responsável</div><div>Status</div>
                    <div class="text-right">No status desde</div><div class="text-right">Flag</div><div></div><div></div>
                  </div>
                  ${impedidasRows}
                </div>`
                  : ''
              }
            </div>`;

    $('#tab-quality').innerHTML = `
            ${bugsSection}
            ${excedidasSection}
            ${impedidasSection}`;

    state.renderedVersion.quality = state.dataVersion;
  }
};
