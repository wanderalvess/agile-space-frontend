// app — a RAIZ DE COMPOSIÇÃO do dashboard: é aqui que os vinte e seis módulos se encontram.
// Quarenta e um membros: inicialização, os listeners delegados, roteamento de ações, capacity
// e configuração, o fluxo de carga com as invariantes de concorrência, publicação de dataset,
// cache por squad e a apresentação do cabeçalho.
//
// ⚠️ FRONTEIRA DE ORQUESTRAÇÃO GRANDE, não arquitetura final. A modularização do entrypoint
// terminou — `jiradash.js` virou só o bootstrap —, mas este arquivo continua grande e
// acoplado de propósito: a etapa que o tirou da IIFE moveu o objeto INTEIRO, sem redesenho.
// Dividi-lo por fluxo (handlers, carga, configuração) é decisão posterior, e agora ela tem
// test/app.test.mjs como rede.
//
// ⚠️ Não existe mais IIFE, e `'use strict'` foi removido por REDUNDÂNCIA, não por
// relaxamento: ES Module é sempre strict mode. Os métodos deste objeto continuam estritos,
// `this` desmembrado continua `undefined` (não `window`), e nada aqui depende de sloppy mode.
//
// ⚠️ As invariantes de concorrência do §4 do AGENTS.md moram aqui e são o que mais quebra em
// silêncio: `beginLoad()` abre geração ANTES de qualquer limpeza ou publicação;
// `isCurrentLoad(ctx)` é conferido depois de CADA fronteira assíncrona; `isSameDataset` exige
// ao mesmo tempo a mesma REFERÊNCIA de `state.allIssues` e a mesma geração;
// `publishLoadedDataset` é síncrono e usa `ctx.squadId`, nunca `squadStore.activeId`.
//
// ⚠️ `configureSquadLoadActions(...)` é a PRIMEIRA instrução de `initialize()`: o
// `squadStore` precisa das três ações de carga que moram aqui, e importar este arquivo lá
// fecharia o ciclo. Ver AGENTS.md §9.
//
// ⚠️ `initialize()` e `bindEvents()` NÃO são idempotentes. `bindEvents` registra onze
// `document.addEventListener` sem remover nada antes, então uma segunda inicialização DUPLICA
// os onze listeners — e o sintoma é silencioso: cada clique roteia duas vezes (CSV baixado em
// dobro, toggle que abre e fecha na mesma ação). Na vida real isso não acontece porque o
// `DOMContentLoaded` natural do navegador dispara UMA vez; a garantia é do evento, não do
// método. Não chame `initialize()` à mão nem dispare um `DOMContentLoaded` sintético (em teste,
// sonda ou console) sem antes implementar uma guarda própria — e isso é etapa separada.
//
// A avaliação deste módulo é inerte: nada de document, listener, storage, fetch, timer,
// configuração do port ou escrita em `state`/`squadCache`. O primeiro efeito de execução
// acontece quando `app.initialize()` é chamado — pelo bootstrap, no `DOMContentLoaded`.
import { CONFIG } from './core/config.js';
import { escapeHtml, formatDate, safeDomId, relativeTime } from './core/helpers.js';
import { state, squadCache } from './core/state.js';
import { numOrZero, validateConfigField, redactedCoordOf } from './domain/person-config.js';
import { ISSUE_FILTER_KEYS, emptyIssueFilters, toggleFilterValue } from './domain/issue-filters.js';
import { $, $$, dom } from './platform/dom.js';
import { storage } from './platform/storage.js';
import { sharedConfig } from './platform/shared-config.js';
import { auth } from './platform/auth.js';
import { jiraApi } from './platform/jira-api.js';
import { sprintBoardStore } from './platform/sprint-board-store.js';
import { authUI } from './ui/auth-ui.js';
import { ui } from './ui/ui.js';
import {
  formatCapacityCell,
  formatCapacityHours,
  capacityCalcTitle,
  utilizationColor
} from './ui/capacity-format.js';
import {
  renderers,
  reconcileErrorText,
  includeErrorText,
  lifecycleErrorText,
  personFieldErrorText,
  LIFECYCLE_UI_ACTIONS
} from './ui/renderers.js';
import { issueService } from './services/issue-service.js';
import { configureSquadLoadActions, squadStore } from './services/squad-store.js';
import { retroExport } from './services/retro-export.js';

// CP8 — guarda de request de reconciliação em voo. Enquanto ele não responde, NENHUMA escrita
// otimista acontece e um segundo clique é ignorado (duas decisões concorrentes sobre o mesmo slot
// dariam a impressão de que a segunda "não pegou"). Fica em módulo, não em `app`, para o objeto
// continuar sendo só métodos.
let reconcileInFlight = false;
// CP10 — mesma guarda para o ciclo de vida: arquivar e restaurar em sequência rápida sobre a
// MESMA linha dariam a impressão de que a segunda decisão não pegou.
let lifecycleInFlight = false;

export const app = {
  async initialize() {
    // squadStore precisa de três operações de carga que moram AQUI. Importar app lá
    // fecharia o ciclo app → squadStore → app, então ele recebe as três por callback.
    // Tem de ser antes de qualquer caminho que carregue — apply() usa as três. É uma
    // atribuição inerte: não toca auth, config nem DOM, e por isso pode vir primeiro.
    configureSquadLoadActions({
      beginLoad: () => this.beginLoad(),
      restoreFromCache: cached => this.restoreFromCache(cached),
      loadData: () => this.loadData(),
      loadShared: (squadId, jql) => this.loadFromSharedOrFetch(squadId, jql)
    });
    auth.purgeLegacy();
    // Config compartilhada ANTES do primeiro render — capacity/papel de todo mundo
    // vêm do servidor. Se falhar (proxy antigo/offline), segue com a config local.
    await sharedConfig.load();
    const activeSquad = squadStore.ensureInitialized();
    squadStore.apply(activeSquad);
    this.bindEvents();
  },
  bindEvents() {
    document.addEventListener('click', event => this.handleClick(event));
    document.addEventListener('change', event => this.handleInputChange(event));
    document.addEventListener('input', event => this.handleInputInput(event));
    // Abas de squad: renomear (duplo clique) e reordenar (arrastar).
    // Tudo delegado no document, como o resto do app — o innerHTML de #squad-tabs
    // é reescrito a cada renderTabs(), então listener preso no elemento se perderia.
    document.addEventListener('dblclick', event => this.handleDblClick(event));
    document.addEventListener('keydown', event => this.handleKeyDown(event));
    // focusout (e não blur) porque blur não borbulha e aqui tudo é delegado.
    document.addEventListener('focusout', event => this.handleFocusOut(event));
    document.addEventListener('dragstart', event => this.handleDragStart(event));
    document.addEventListener('dragover', event => this.handleDragOver(event));
    document.addEventListener('dragleave', event => this.handleDragLeave(event));
    document.addEventListener('drop', event => this.handleDrop(event));
    document.addEventListener('dragend', () => this.clearSquadDrag());
  },
  handleDblClick(event) {
    // O × tem duplo clique próprio (remover duas vezes); não abre rename.
    if (event.target.closest('[data-action="remove-squad"]')) return;
    const tab = event.target.closest('.squad-tab');
    if (!tab) return;
    event.preventDefault();
    squadStore.beginRename(tab.dataset.squadId);
  },
  handleKeyDown(event) {
    // Escape fecha o painel de filtro aberto — pelo `keydown` delegado que já existe.
    if (event.key === 'Escape' && state.issueFilterOpen && event.target.closest?.('.filter-dropdown')) {
      const dimensao = state.issueFilterOpen;
      event.preventDefault();
      state.issueFilterOpen = null;
      renderers.renderIssues();
      document.getElementById(`f-painel-${dimensao}`)?.focus();
      return;
    }
    if (!event.target.classList?.contains('squad-rename')) return;
    if (event.key === 'Enter') {
      event.preventDefault();
      squadStore.commitRename(event.target.value);
    } else if (event.key === 'Escape') {
      event.preventDefault();
      squadStore.cancelRename();
    }
  },
  handleFocusOut(event) {
    if (!event.target.classList?.contains('squad-rename')) return;
    // Enter/Escape já zeraram squadRenamingId antes de re-renderizar; o focusout
    // que vem em seguida (input removido do DOM) cai fora daqui e não grava de novo.
    if (state.squadRenamingId !== event.target.dataset.squadId) return;
    squadStore.commitRename(event.target.value);
  },
  handleDragStart(event) {
    const tab = event.target.closest('.squad-tab');
    if (!tab) return;
    state.squadDragId = tab.dataset.squadId;
    event.dataTransfer.effectAllowed = 'move';
    // Firefox só inicia o arrasto se algum dado for setado.
    event.dataTransfer.setData('text/plain', tab.dataset.squadId);
    // A classe entra no próximo tick: aplicada de imediato, ela entraria na
    // captura da imagem de arrasto e o navegador desenharia o fantasma já esmaecido.
    setTimeout(() => tab.classList.add('dragging'), 0);
  },
  handleDragOver(event) {
    if (!state.squadDragId) return;
    const tab = event.target.closest('.squad-tab');
    if (!tab || tab.dataset.squadId === state.squadDragId) return;
    // preventDefault é o que autoriza o drop neste alvo.
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
    // Metade direita da aba = soltar depois dela; metade esquerda = antes.
    const box = tab.getBoundingClientRect();
    const after = event.clientX > box.left + box.width / 2;
    for (const other of $$('.squad-tab', dom.squadTabs)) {
      if (other !== tab) other.classList.remove('drop-before', 'drop-after');
    }
    tab.classList.toggle('drop-after', after);
    tab.classList.toggle('drop-before', !after);
  },
  handleDragLeave(event) {
    const tab = event.target.closest('.squad-tab');
    if (tab) tab.classList.remove('drop-before', 'drop-after');
  },
  handleDrop(event) {
    if (!state.squadDragId) return;
    const tab = event.target.closest('.squad-tab');
    if (!tab) {
      this.clearSquadDrag();
      return;
    }
    event.preventDefault();
    const placeAfter = tab.classList.contains('drop-after');
    const dragId = state.squadDragId;
    this.clearSquadDrag();
    squadStore.reorder(dragId, tab.dataset.squadId, placeAfter);
  },
  clearSquadDrag() {
    state.squadDragId = null;
    for (const tab of $$('.squad-tab', dom.squadTabs)) {
      tab.classList.remove('dragging', 'drop-before', 'drop-after');
    }
  },
  handleClick(event) {
    const actionTarget = event.target.closest('[data-action]');
    const tabTarget = event.target.closest('[data-tab]');

    // Clique FORA de um painel de filtro aberto o fecha. Sem listener global novo: aproveita o
    // `click` delegado que já existe (§4 — `bindEvents` registra os onze e nada mais).
    if (state.issueFilterOpen && !event.target.closest('.filter-dropdown')) {
      state.issueFilterOpen = null;
      renderers.renderIssues();
    }

    if (tabTarget) {
      this.switchTab(tabTarget.dataset.tab, tabTarget);
      return;
    }

    if (!actionTarget) return;
    const { action } = actionTarget.dataset;

    if (action === 'clear-pat') {
      auth.clear();
      authUI.render();
      return;
    }
    if (action === 'toggle-config') ui.toggleConfig();
    if (action === 'load-data') this.loadData();
    if (action === 'config-unlock') this.configUnlock();
    if (action === 'config-lock') {
      sharedConfig.editCode = '';
      renderers.renderConfig({ force: true });
    }
    if (action === 'config-seed') this.configSeed(actionTarget);
    if (action === 'reload-partial-worklogs') this.reloadPartialWorklogs();
    if (action === 'add-squad') squadStore.add();
    if (action === 'retro-send') retroExport.send(actionTarget.dataset.retroSlot);
    if (action === 'retro-open') retroExport.open();
    if (action === 'switch-squad') squadStore.switchTo(actionTarget.dataset.squadId);
    if (action === 'remove-squad') {
      event.stopPropagation();
      squadStore.remove(actionTarget.dataset.squadId);
    }
    // Abre/fecha UM painel de filtro. O `<summary>` já alterna o `<details>` sozinho; o estado
    // aqui é o que sobrevive ao `innerHTML` reescrito pelo render seguinte.
    if (action === 'filter-panel') {
      event.preventDefault(); // o `open` de verdade vem do render, não do toggle nativo
      const dimensao = actionTarget.dataset.filter;
      state.issueFilterOpen = state.issueFilterOpen === dimensao ? null : dimensao;
      renderers.renderIssues();
      document.getElementById(`f-painel-${dimensao}`)?.focus();
      return;
    }
    // "Todos": esvazia SÓ esta dimensão; as outras três continuam como estão.
    if (action === 'filter-clear') {
      const dimensao = actionTarget.dataset.filter;
      if (ISSUE_FILTER_KEYS.includes(dimensao)) {
        state.issueFilters[dimensao] = [];
        state.issuePage = 1;
        renderers.renderIssues();
      }
      return;
    }
    // Drill-down de subtasks na aba HORAS. Reaproveita este `click` delegado — nenhum listener por
    // linha e nenhum listener global novo.
    if (action === 'toggle-hours-subtasks') {
      this.toggleHoursSubtasks(actionTarget.dataset.parentKey, actionTarget.id);
      return;
    }
    if (action === 'toggle-row') this.toggleIssueRow(actionTarget.dataset.issueKey);
    if (action === 'issue-prev-page') {
      state.issuePage = Math.max(1, state.issuePage - 1);
      renderers.renderIssues();
    }
    if (action === 'issue-next-page') {
      state.issuePage += 1;
      renderers.renderIssues();
    }
    if (action === 'export-allocation-csv') renderers.exportAllocationCsv();
    if (action === 'set-allocation-view') {
      const view = actionTarget.dataset.view === 'original' ? 'original' : 'ajustado';
      if (state.allocationView !== view) {
        state.allocationView = view;
        renderers.renderAllocationChart();
      }
    }
    if (action === 'set-capacity-view') {
      const view = actionTarget.dataset.view === 'ajustado' ? 'ajustado' : 'original';
      if (state.capacityChartView !== view) {
        state.capacityChartView = view;
        renderers.renderCapacityChart();
      }
    }
    if (action === 'export-chart-png') {
      renderers.exportChartPng(actionTarget.dataset.chartKey, actionTarget.dataset.baseName);
    }
    if (action === 'set-burndown-view') {
      const view = actionTarget.dataset.view === 'apontamento' ? 'apontamento' : 'fechamento';
      if (state.burndownView !== view) {
        state.burndownView = view;
        renderers.renderBurndownHours();
      }
    }
    if (action === 'toggle-planning-detail') {
      const cat = actionTarget.dataset.planningCard;
      state.planningExpanded = state.planningExpanded === cat ? null : cat;
      renderers.updatePlanningDetail();
    }
    if (action === 'close-planning-detail') {
      state.planningExpanded = null;
      renderers.updatePlanningDetail();
    }
    if (action === 'toggle-estimate-detail') {
      const person = actionTarget.dataset.person;
      state.estimateDetailFor = state.estimateDetailFor === person ? null : person;
      renderers.updateEstimateDetail();
    }
    if (action === 'close-estimate-detail') {
      state.estimateDetailFor = null;
      renderers.updateEstimateDetail();
    }
    // CP8 — as DUAS decisões humanas da reconciliação. Só por clique explícito: nada aqui é
    // disparado em boot, carga ou render.
    if (action === 'reconcile-link') this.reconcileSlot(actionTarget, 'link');
    if (action === 'reconcile-separate') this.reconcileSlot(actionTarget, 'keep-separated');
    // CP9 — busca e inclusão manual. As duas só acontecem por CLIQUE: digitar (ou pressionar
    // Enter) nunca busca e nunca cria pessoa.
    if (action === 'picker-search') this.pickerSearch();
    if (action === 'picker-include') this.pickerInclude(actionTarget);
    if (action === 'lifecycle') this.lifecycleAction(actionTarget);
  },
  handleInputChange(event) {
    const { action, filter } = event.target.dataset;
    // Filtros MÚLTIPLOS: cada checkbox é UM valor de UMA dimensão. O DOM nunca transporta lista
    // concatenada — separador dentro de um nome de status ou de pessoa quebraria a leitura.
    if (action === 'filter-issues' && ISSUE_FILTER_KEYS.includes(filter)) {
      // ⚠️ O `id` é capturado ANTES do render: depois dele o elemento clicado já não existe.
      // Ele é único por construção (`f-<dimensão>-<índice>`), então reencontrar o checkbox é um
      // `getElementById` direto — sem seletor por valor, que seria ambíguo entre valores que
      // colapsam no mesmo identificador ("Code Review" vs "Code-Review").
      const idDoCheckbox = event.target.id;
      state.issueFilters[filter] = toggleFilterValue(
        state.issueFilters[filter],
        event.target.dataset.value,
        !!event.target.checked
      );
      state.issuePage = 1;
      // O painel segue aberto (`state.issueFilterOpen` não muda): dá para marcar vários valores
      // seguidos sem reabrir o filtro a cada clique.
      renderers.renderIssues();
      // O `innerHTML` foi reescrito, então o checkbox que recebeu o clique é outro elemento —
      // devolver o foco a ele é o que mantém a navegação por teclado utilizável.
      if (idDoCheckbox) document.getElementById(idDoCheckbox)?.focus();
    }
    if (action === 'save-pat') {
      auth.token = event.target.value;
      authUI.render();
    }
    if (action === 'save-productive-hours') this.saveProductiveHours(event.target);
    if (action === 'save-sprint-config') this.saveSprintConfig(event.target);
  },
  handleInputInput(event) {
    const { action } = event.target.dataset;
    if (action === 'save-allocated') this.saveAllocated(event.target);
    // Preview local a cada tecla. NÃO persiste e NÃO chama o servidor — a gravação
    // acontece só no change, depois da validação (saveSprintConfig).
    if (action === 'save-sprint-config') this.previewSprintConfig(event.target);
  },
  // Lê os três campos de uma linha e devolve as capacities, ou null quando algum valor
  // digitado ainda não é válido (durante "31" a caminho de "3"). null = não atualiza
  // nada, que é como se evita NaN na tela sem inventar número.
  readRowCapacity(row, editedField) {
    const rawOf = field => {
      const el = row.querySelector(`input[data-field="${field}"]`);
      return el ? el.value.trim() : '';
    };
    // Campo vazio: o que está sendo editado vale 0 (é o que o change vai gravar); os
    // outros mantêm o valor efetivo que o render usou — horas vazias valem o padrão,
    // não zero.
    const valueOf = (field, fallback) => {
      const raw = rawOf(field);
      if (raw === '') return field === editedField ? 0 : fallback;
      const check = validateConfigField(field, raw);
      return check.ok ? check.value : null;
    };
    const horasEfetiva = numOrZero(row.dataset.cfgHorasEfetiva);
    const cod = valueOf('diasCodificacaoTeste', 0);
    const reg = valueOf('diasRegressivo', 0);
    const horas = valueOf('horasProdutivas', horasEfetiva);
    if (cod === null || reg === null || horas === null) return null;
    return {
      capCod: cod * horas,
      capReg: reg * horas,
      // dias/horas efetivos saem daqui também porque o title da célula é montado com
      // eles — texto e memória de cálculo têm que vir do MESMO estado.
      dias: { cod, reg },
      horas,
      rawCod: rawOf('diasCodificacaoTeste'),
      rawReg: rawOf('diasRegressivo')
    };
  },
  // Atualiza só as três células calculadas da linha. Nada de innerHTML na tabela:
  // reconstruir a cada tecla tiraria o foco e a posição do cursor do input.
  refreshCapacityRow(row) {
    const editedField = row.dataset.cfgEditing || '';
    const capacity = this.readRowCapacity(row, editedField);
    if (!capacity) return;
    const { capCod, capReg, dias, horas, rawCod, rawReg } = capacity;
    // Texto e title andam juntos: atualizar só o número deixava o tooltip preso na
    // fórmula antiga ("7 dia(s) × 6h/dia") enquanto a célula já mostrava 60.0h.
    const setCell = (key, text, title) => {
      const cell = row.querySelector(`[data-cap-cell="${key}"]`);
      if (!cell) return;
      cell.textContent = text;
      cell.title = title;
    };
    const codCalc = capacityCalcTitle(dias.cod, horas);
    const regCalc = capacityCalcTitle(dias.reg, horas);
    setCell('cod', formatCapacityCell(capCod, rawCod), codCalc);
    setCell('reg', formatCapacityCell(capReg, rawReg), regCalc);
    setCell('total', formatCapacityCell(capCod + capReg, rawCod, rawReg), `${codCalc} + ${regCalc}`);
    // Guarda o último valor VÁLIDO da linha: é daqui que o resumo soma, pra ele nunca
    // divergir do que está desenhado.
    row.dataset.capCod = String(capCod);
    row.dataset.capReg = String(capReg);
  },
  // Soma o resumo do time a partir do último valor válido de cada linha. Ler o dataset
  // (e não recalcular) garante que o resumo é exatamente a soma do que está na tela:
  // com uma entrada inválida a linha congela no último valor, e o resumo tem que
  // congelar junto — recalcular faria a linha sumir do total.
  refreshCapacitySummary() {
    const totals = { cod: 0, reg: 0, DEV: { cod: 0, reg: 0 }, QA: { cod: 0, reg: 0 } };
    for (const row of $$('#tab-config .cfg-row[data-cfg-row]')) {
      const capCod = numOrZero(row.dataset.capCod);
      const capReg = numOrZero(row.dataset.capReg);
      totals.cod += capCod;
      totals.reg += capReg;
      const papel = row.querySelector('select[data-field="papel"]')?.value;
      if (totals[papel]) {
        totals[papel].cod += capCod;
        totals[papel].reg += capReg;
      }
    }
    const set = (key, text) => {
      const el = $(`#tab-config [data-team-cap="${key}"]`);
      if (el) el.textContent = text;
    };
    // MESMO formatador das células (`ui/capacity-format.js`): com `toFixed(1)` aqui, o resumo
    // dizia 15.4h enquanto a linha já dizia 15.36h.
    const h = valor => `${formatCapacityHours(valor)}h`;
    set('cod', h(totals.cod));
    set('reg', h(totals.reg));
    set('total', h(totals.cod + totals.reg));
    set(
      'papel',
      ['DEV', 'QA']
        .filter(papel => totals[papel].cod + totals[papel].reg > 0)
        .map(
          papel =>
            `${papel} ${h(totals[papel].cod + totals[papel].reg)} (${h(totals[papel].cod)} + ${h(totals[papel].reg)})`
        )
        .join(' · ')
    );
  },
  previewSprintConfig(input) {
    const row = input.closest('.cfg-row');
    if (!row) return;
    // Marca qual campo está em edição: só ele trata vazio como 0.
    row.dataset.cfgEditing = input.dataset.field || '';
    this.refreshCapacityRow(row);
    this.refreshCapacitySummary();
  },
  async switchTab(tab, tabButton) {
    if (!CONFIG.tabs.includes(tab)) return;

    state.activeTab = tab;
    $$('.tab').forEach(button => button.classList.remove('active'));
    tabButton.classList.add('active');
    CONFIG.tabs.forEach(tabName => ui.setHidden($(`#tab-${tabName}`), tabName !== tab));

    // Abrindo a Configuração: puxa o doc mais novo do servidor (outra pessoa pode
    // ter editado). GET barato; se falhar, load() só marca available=false.
    // No modo local não há doc no servidor pra buscar — e recarregar aqui só serviria
    // pra correr o risco de sobrescrever o que a pessoa acabou de editar.
    if (tab === 'config' && sharedConfig.isShared && sharedConfig.available) await sharedConfig.load();

    if (state.allIssues.length) await this.renderActiveTab();
  },
  async configUnlock() {
    // Os controles nem são renderizados fora do modo shared; a guarda é defensiva
    // (HTML manipulado), no mesmo espírito da revalidação em saveSprintConfig.
    if (!sharedConfig.isShared) {
      ui.showError('Sem configuração compartilhada neste servidor (modo local).');
      return;
    }
    const input = $('#config-edit-code-input');
    const code = (input?.value || '').trim();
    if (!code) {
      ui.showError('Informe o código de edição.');
      return;
    }
    try {
      const ok = await sharedConfig.verify(code);
      if (!ok) {
        ui.showError('Código de edição incorreto.');
        return;
      }
      ui.clearError();
      renderers.renderConfig({ force: true });
    } catch (error) {
      ui.showError(`Não foi possível validar o código: ${error.message}`);
    }
  },
  async configSeed(button) {
    if (!sharedConfig.isShared) {
      ui.showError('Sem configuração compartilhada neste servidor (modo local).');
      return;
    }
    if (button) button.disabled = true;
    try {
      await sharedConfig.seedFromLocal();
      ui.clearError();
      renderers.renderConfig({ force: true });
    } catch (error) {
      if (button) button.disabled = false;
      ui.showError(`Falha ao publicar config no servidor: ${error.message}`);
    }
  },
  async renderActiveTab() {
    if (!state.allIssues.length) return;

    if (['charts', 'planning', 'horas', 'cycletime', 'quality'].includes(state.activeTab))
      await this.ensureWorklogsLoaded();

    if (state.activeTab === 'issues') renderers.renderIssues();
    if (state.activeTab === 'assignees') renderers.renderAssignees();
    if (state.activeTab === 'charts') renderers.renderCharts();
    if (state.activeTab === 'planning') renderers.renderPlanning();
    if (state.activeTab === 'horas') renderers.renderHoras();
    if (state.activeTab === 'cycletime') renderers.renderCycleTime();
    if (state.activeTab === 'quality') renderers.renderQuality();
    if (state.activeTab === 'config') renderers.renderConfig();
  },
  // Abre uma nova geração de carga e devolve o contexto que a operação carrega
  // consigo. squadId e jql ficam capturados aqui: no fim da carga, squadStore.activeId
  // já pode apontar para outra squad, e usá-lo gravaria o cache na squad errada.
  beginLoad() {
    state.loadGeneration += 1;
    // Quem abre uma geração assume a posse do indicador de loading. A carga que acabou
    // de ser invalidada vai retornar cedo, sem chegar ao próprio hideLoading — sem esta
    // linha o spinner dela ficaria preso na tela (ex.: criar squad sem JQL no meio de
    // uma carga). Quem tem loading próprio chama showLoading logo em seguida, no mesmo
    // tick, então não há piscada.
    ui.hideLoading();
    return { generation: state.loadGeneration, squadId: squadStore.activeId, jql: jiraApi.jql };
  },
  isCurrentLoad(ctx) {
    return state.loadGeneration === ctx.generation;
  },
  // Identidade do dataset para operações que NÃO o substituem (worklogs). Exige as
  // DUAS condições:
  //  - mesma referência de state.allIssues (setIssues sempre troca o array, então a
  //    referência é a identidade exata do dataset — e não state.dataVersion, que
  //    rebuildDerived também incrementa e descartaria uma carga ainda válida);
  //  - mesma geração. loadData incrementa a geração ANTES de trocar o array; nessa
  //    janela a referência ainda é a antiga, e checar só ela deixaria um worklog
  //    velho esconder o loading da carga nova.
  isSameDataset(dataset, generation) {
    return state.allIssues === dataset && state.loadGeneration === generation;
  },
  async ensureWorklogsLoaded() {
    if (state.worklogsLoaded) return;
    if (state.worklogLoadingPromise) return state.worklogLoadingPromise;

    const dataset = state.allIssues;
    const generation = state.loadGeneration;
    const loadingPromise = (async () => {
      ui.showLoading('Carregando apontamentos completos da sprint...');
      const failedKeys = await jiraApi.fetchFullWorklogs(dataset);
      // Dataset trocou (ou uma carga nova já começou) durante a busca. As issues antigas
      // já foram mutadas com seus worklogs (inofensivo — saíram de cena), mas nada pode
      // ser publicado no state do dataset novo: nem as falhas, nem a flag de "carregado",
      // nem o render, nem o hideLoading — que apagaria o loading da carga nova.
      if (!this.isSameDataset(dataset, generation)) return;
      for (const key of failedKeys) state.partialWorklogs.add(key);
      state.worklogsLoaded = true;
      issueService.rebuildDerived();
      renderers.renderMetrics();
      ui.hideLoading();
      this.refreshPartialWorklogWarning();
    })();

    state.worklogLoadingPromise = loadingPromise;

    try {
      await loadingPromise;
    } finally {
      // Limpeza por identidade: só a própria promise limpa a própria referência.
      // setIssues zera worklogLoadingPromise ao trocar de dataset, então uma promise
      // nova pode já estar registrada aqui quando a antiga termina — limpar sem
      // conferir faria a carga antiga apagar a referência da nova, e um segundo
      // ensureWorklogsLoaded dispararia uma busca duplicada.
      if (state.worklogLoadingPromise === loadingPromise) state.worklogLoadingPromise = null;
    }
  },
  refreshPartialWorklogWarning() {
    const count = state.partialWorklogs.size;
    if (!count) {
      ui.clearWarning();
      return;
    }
    ui.showWarning({
      message: `${count} ${count === 1 ? 'issue ficou' : 'issues ficaram'} com apontamento incompleto após retries. Gráficos de Horas, Fluxo e Qualidade podem estar subestimados.`,
      actionLabel: 'Recarregar parciais',
      actionId: 'reload-partial-worklogs'
    });
  },
  async reloadPartialWorklogs() {
    const keys = [...state.partialWorklogs];
    if (!keys.length) return;
    const dataset = state.allIssues;
    const generation = state.loadGeneration;
    const targetSet = new Set(keys);
    const targets = dataset.filter(issue => targetSet.has(issue.key));
    state.partialWorklogs.clear();
    ui.clearWarning();
    ui.showLoading(
      `Recarregando apontamentos de ${targets.length} ${targets.length === 1 ? 'issue' : 'issues'}...`
    );
    try {
      const failedKeys = await jiraApi.fetchFullWorklogs(targets);
      // Mesma regra do ensureWorklogsLoaded: recarga de um dataset que saiu de cena
      // não escreve em partialWorklogs nem mexe no loading/render do dataset atual.
      if (!this.isSameDataset(dataset, generation)) return;
      for (const key of failedKeys) state.partialWorklogs.add(key);
      issueService.rebuildDerived();
      renderers.renderMetrics();
      ui.hideLoading();
      this.refreshPartialWorklogWarning();
      await this.renderActiveTab();
    } catch (error) {
      if (!this.isSameDataset(dataset, generation)) return;
      ui.hideLoading();
      ui.showError(`Falha ao recarregar apontamentos: ${error.message}`);
    }
  },
  toggleIssueRow(key) {
    const parent = issueService.getDerived().byKey.get(key);
    if (!parent?.children?.length) return;

    if (state.expandedRows.has(key)) state.expandedRows.delete(key);
    else state.expandedRows.add(key);

    renderers.renderIssues();
  },
  // Abre/fecha o detalhe de subtasks de UM pai na aba Horas.
  //
  // ⚠️ É drill-down VISUAL: não recalcula nada e não toca em `derived`. Totais, saldo, capacity,
  // burndown e exports continuam vindo do agregado do pai, onde as subtasks já estão contadas.
  //
  // ⚠️ Só `renderedVersion.horas` é invalidado. Zerar `state.dataVersion` (ou os outros renders)
  // reconstruiria abas que não têm nada a ver com este clique.
  toggleHoursSubtasks(parentKey, buttonId) {
    if (!parentKey) return;
    // Chave obsoleta (dataset trocou entre o render e o clique) é ignorada em silêncio: o pai
    // simplesmente não existe mais no quadro.
    const alvo = issueService.getDerived().horas.parentData.find(p => p.key === parentKey);
    if (!alvo || !(alvo.subtasks || []).length) return;

    if (state.hoursExpandedParents.has(parentKey)) state.hoursExpandedParents.delete(parentKey);
    else state.hoursExpandedParents.add(parentKey);

    state.renderedVersion.horas = null;
    renderers.renderHoras();
    // O `innerHTML` da aba foi reescrito: o botão clicado é outro elemento. O id vem do índice do
    // pai no quadro, então reencontrá-lo é um `getElementById` direto.
    if (buttonId) document.getElementById(buttonId)?.focus();
  },
  saveProductiveHours(input) {
    const saved = storage.getJson('horas-produtivas', {});
    saved[input.dataset.person] = Number.parseFloat(input.value) || 0;
    storage.setJson('horas-produtivas', saved);
    if (state.allIssues.length) renderers.renderCycleTime({ force: true });
  },
  // CP8 — executa UMA decisão humana de reconciliação, sempre para UM slot.
  //   'link'           → vincula aquele slot àquele candidato (pessoa existente ou key observada)
  //   'keep-separated' → registra que aquele slot NÃO é aquele candidato
  // FAIL-CLOSED em tudo: capability desligada, edição travada, token obsoleto ou intenção sem o
  // dado necessário → erro visível, ZERO request e ZERO persistência. E NUNCA há fallback para a
  // escrita v1: um erro da reconciliação nunca vira `pushField`.
  reconcileSlot(target, action) {
    if (!sharedConfig.identityReconciliationEnabled) {
      ui.showError('Reconciliação indisponível neste servidor.');
      return;
    }
    if (!sharedConfig.unlocked) {
      ui.showError('Edição travada: informe o código de edição na aba Configuração.');
      renderers.renderConfig({ force: true });
      return;
    }
    if (reconcileInFlight) return;
    const intent = renderers.reconciliationIntentFor(target?.dataset?.reconcileToken);
    if (!intent || !intent.slot) {
      ui.showError('Item de reconciliação não reconhecido (recarregue). Nada foi alterado.');
      renderers.renderConfig({ force: true });
      return;
    }
    let payload;
    if (action === 'link') {
      // Vincular slot de SPRINT exige escopo/período resolvidos (a M2 recusa sem eles, para a
      // pessoa não ficar confirmada e fora da participação). A fila já marca isso.
      if (intent.linkable === false) {
        ui.showError(
          'Este slot ainda não pertence a uma iniciativa: rode a migração de escopo antes de vincular. Nada foi alterado.'
        );
        return;
      }
      // O slot vem SEMPRE da intenção; o cliente nunca deriva slotId e nunca cria personId.
      payload = {
        action: 'link',
        slot: intent.slot,
        personId: intent.personId ?? null,
        externalRef: intent.externalRef ?? null,
        // Nome OBSERVADO junto da mesma key — só existe quando há `externalRef` de proveniência
        // direta. É o que permite persistir o perfil com finalidade e prazo de revisão.
        observedProfile: intent.observedProfile ?? null
      };
      if (!payload.personId && !payload.externalRef) {
        ui.showError('Candidato sem identidade utilizável. Nada foi alterado.');
        return;
      }
    } else {
      if (!intent.candidatePersonId) {
        ui.showError('Só é possível manter separado de um candidato já registrado. Nada foi alterado.');
        return;
      }
      payload = { action: 'keep-separated', slot: intent.slot, candidatePersonId: intent.candidatePersonId };
    }
    reconcileInFlight = true;
    // SUCESSO: `reconcileSlot` já publicou o envelope devolvido pelo servidor (mirror) — só então
    // as versões são invalidadas e a aba é re-renderizada. ERRO/409: recarrega o documento e
    // re-renderiza, com texto LOCAL e específico por código estático.
    sharedConfig.reconcileSlot(payload).then(
      () => {
        reconcileInFlight = false;
        if (state.allIssues.length) {
          state.renderedVersion.cycletime = null;
          state.renderedVersion.horas = null;
          state.renderedVersion.charts = null;
          state.renderedVersion.planning = null;
          state.renderedVersion.quality = null;
          state.renderedVersion.assignees = null;
        }
        renderers.renderConfig({ force: true });
      },
      async error => {
        reconcileInFlight = false;
        ui.showError(reconcileErrorText(error && error.code));
        await sharedConfig.load();
        renderers.renderConfig({ force: true });
      }
    );
  },
  // CP9 — BUSCA do picker. Único ponto do app que consulta `/rest/api/2/user/search`, e só por
  // clique humano. A consulta é texto: ela nunca vira pessoa, nome persistido ou seleção.
  // Buscas fora de ordem são descartadas pelo "bilhete" de geração do picker.
  async pickerSearch() {
    if (!sharedConfig.identityRosterPickerEnabled) {
      ui.showError('Busca de pessoas indisponível neste servidor.');
      return;
    }
    if (!sharedConfig.unlocked) {
      ui.showError('Edição travada: informe o código de edição na aba Configuração.');
      renderers.renderConfig({ force: true });
      return;
    }
    const picker = renderers.personPicker();
    const bilhete = picker.beginSearch($('#picker-query')?.value ?? '');
    renderers.renderConfig({ force: true }); // mostra "buscando" (ou a recusa local)
    // Consulta vazia é recusada LOCALMENTE: nenhum GET sai, e o picker fica no seu próprio estado.
    if (bilhete === null) return;
    const resposta = await jiraApi.searchUsers(picker.query);
    // Resposta de uma busca ANTERIOR é ignorada em silêncio (a mais nova já está na tela).
    const derived = state.allIssues.length ? issueService.getDerived() : null;
    if (
      picker.publishSearch(bilhete, resposta, {
        envelope: sharedConfig.identityEnvelope,
        sessionIdentity: derived?.identity ?? null
      })
    ) {
      renderers.renderConfig({ force: true });
    }
  },
  // CP9 — INCLUSÃO manual. O escopo/período vêm do CONTEXTO resolvido no render (nunca do DOM), e
  // a identidade vem da INTENÇÃO em memória (nunca do texto digitado). FAIL-CLOSED em tudo.
  pickerInclude(target) {
    if (!sharedConfig.identityRosterPickerEnabled) {
      ui.showError('Inclusão de pessoas indisponível neste servidor.');
      return;
    }
    if (!sharedConfig.unlocked) {
      ui.showError('Edição travada: informe o código de edição na aba Configuração.');
      renderers.renderConfig({ force: true });
      return;
    }
    const contexto = renderers.pickerContext();
    if (!contexto) {
      ui.showError('Sem iniciativa e período resolvidos para esta sprint. Nada foi incluído.');
      return;
    }
    const picker = renderers.personPicker();
    const intent = picker.intentForToken(target?.dataset?.pickerToken);
    if (!intent) {
      ui.showError('Resultado não reconhecido (busque de novo). Nada foi incluído.');
      renderers.renderConfig({ force: true });
      return;
    }
    const payload = {
      analysisScopeId: contexto.analysisScopeId,
      periodId: contexto.periodId,
      personId: intent.personId ?? null,
      externalRef: intent.externalRef ?? null,
      // `username` e `active` NÃO entram no payload: eles não são persistíveis.
      observedProfile: intent.observedProfile ?? null
    };
    picker.beginSave();
    renderers.renderConfig({ force: true });
    // SUCESSO: `includePerson` já publicou o envelope (mirror) — só então as versões são
    // invalidadas e a aba é re-renderizada. ERRO: recarrega o documento e re-renderiza, com texto
    // LOCAL por código estático. NUNCA cai para `pushField` ou `reconcileSlot`.
    sharedConfig.includePerson(payload).then(
      () => {
        picker.reset();
        if (state.allIssues.length) {
          state.renderedVersion.cycletime = null;
          state.renderedVersion.horas = null;
          state.renderedVersion.charts = null;
          state.renderedVersion.planning = null;
          state.renderedVersion.quality = null;
          state.renderedVersion.assignees = null;
        }
        renderers.renderConfig({ force: true });
      },
      async error => {
        picker.failSave(error && error.code);
        ui.showError(includeErrorText(error && error.code));
        await sharedConfig.load();
        renderers.renderConfig({ force: true });
      }
    );
  },
  // CP10 — CICLO DE VIDA da participação. A identidade vem do mapa token → intenção em memória;
  // o DOM só carrega um token descartável e o código ESTÁTICO da ação. FAIL-CLOSED em tudo.
  lifecycleAction(target) {
    if (!sharedConfig.identityLifecycleEnabled) {
      ui.showError('Ciclo de vida de participação indisponível neste servidor.');
      return;
    }
    if (!sharedConfig.unlocked) {
      ui.showError('Edição travada: informe o código de edição na aba Configuração.');
      renderers.renderConfig({ force: true });
      return;
    }
    const acao = target?.dataset?.lifecycleAction;
    if (!LIFECYCLE_UI_ACTIONS.includes(acao)) {
      ui.showError('Ação de ciclo de vida não reconhecida. Nada foi alterado.');
      return;
    }
    const intent = renderers.lifecycleIntentFor(target?.dataset?.lifecycleToken, acao);
    if (!intent) {
      // Token de outro render (ou de outra instância): FALHA VISÍVEL, nunca um palpite.
      ui.showError('Linha não reconhecida (recarregue a aba). Nada foi alterado.');
      renderers.renderConfig({ force: true });
      return;
    }
    if (lifecycleInFlight) return; // uma decisão humana por vez
    lifecycleInFlight = true;
    // SUCESSO: `lifecycleAction` já publicou o envelope devolvido pelo servidor (mirror) — só então
    // as versões são invalidadas e a aba é re-renderizada.
    sharedConfig.lifecycleAction(intent).then(
      () => {
        lifecycleInFlight = false;
        if (state.allIssues.length) {
          state.renderedVersion.cycletime = null;
          state.renderedVersion.horas = null;
          state.renderedVersion.charts = null;
          state.renderedVersion.planning = null;
          state.renderedVersion.quality = null;
          state.renderedVersion.assignees = null;
        }
        renderers.renderConfig({ force: true });
      },
      async error => {
        lifecycleInFlight = false;
        ui.showError(lifecycleErrorText(error && error.code));
        await sharedConfig.load();
        renderers.renderConfig({ force: true });
      }
    );
  },
  saveSprintConfig(input) {
    // Config compartilhada ativa: edição só destravada (os campos ficam disabled
    // travados, mas revalida aqui por segurança — ex.: HTML manipulado).
    // Só vale no modo shared: em local/offline a edição é sempre livre.
    if (sharedConfig.isShared && sharedConfig.available && sharedConfig.editable && !sharedConfig.unlocked) {
      ui.showError('Edição travada: informe o código de edição na aba Configuração.');
      renderers.renderConfig({ force: true });
      return;
    }
    const { person: personToken, field } = input.dataset;

    // ── CP10: linha de pessoa REDIGIDA → rota CANÔNICA por personId ─────────────────────────
    // ⚠️ Precisa vir ANTES de `presentation.intentForToken`. O registro do CP6 não conhece este
    // token, então a resolução falharia e a linha ficaria ineditável — a configuração preservada
    // pela redação existiria sem nenhuma via de escrita, que é justamente o que a rota canônica
    // resolve. E NUNCA cai para `/config/v2/set-field` nem para o fluxo v1: os dois exigem um
    // slot com `displayName`, e essa pessoa não tem nome.
    const coordRedigida = redactedCoordOf(personToken);
    if (coordRedigida !== null) {
      const checkRed = validateConfigField(field, input.value);
      if (!checkRed.ok) {
        ui.showError(checkRed.erro);
        renderers.renderConfig({ force: true });
        return;
      }
      const intentCanonico = { personId: coordRedigida.personId, field, value: checkRed.value };
      // Coordenada ESCOPADA quando escopo e período existem; global caso contrário. Um sem o
      // outro nunca é enviado: o servidor recusa como intenção ambígua.
      if (coordRedigida.analysisScopeId && coordRedigida.periodId) {
        intentCanonico.analysisScopeId = coordRedigida.analysisScopeId;
        intentCanonico.periodId = coordRedigida.periodId;
      }
      sharedConfig.setPersonField(intentCanonico).then(
        () => {
          if (state.allIssues.length) {
            state.renderedVersion.cycletime = null;
            state.renderedVersion.horas = null;
            state.renderedVersion.charts = null;
            state.renderedVersion.planning = null;
            state.renderedVersion.quality = null;
            state.renderedVersion.assignees = null;
          }
          renderers.renderConfig({ force: true });
        },
        async error => {
          ui.showError(personFieldErrorText(error && error.code));
          await sharedConfig.load();
          renderers.renderConfig({ force: true });
        }
      );
      return;
    }

    // CP6: o DOM transporta um TOKEN opaco (personId/handle), NUNCA o displayName. O token resolve,
    // SÓ em memória, para uma INTENÇÃO de escrita validada { displayName, slot, personId,
    // externalRef } no registro do dataset atual. Sem registro ou sem intenção (token obsoleto/não
    // reconhecido) → FALHA VISÍVEL: nada é gravado nem enviado, e nunca se aceita displayName cru
    // do DOM como identidade.
    const presentation = issueService.getDerived()?.presentation;
    const intent = presentation ? presentation.intentForToken(personToken) : null;
    if (!intent) {
      ui.showError('Identidade da linha não reconhecida (recarregue a sprint). Nada foi salvo.');
      renderers.renderConfig({ force: true });
      return;
    }
    // Validação REAL antes de tocar em qualquer coisa. O min/max/step do HTML não
    // impede 31,5 nem 32; sem isto, valor inválido ia para o localStorage e para o
    // /config/set. Recusa completa (sem clamp): nada é salvo, nada é enviado, e o
    // re-render restaura o último valor válido a partir do snapshot.
    const check = validateConfigField(field, input.value);
    if (!check.ok) {
      ui.showError(check.erro);
      renderers.renderConfig({ force: true });
      return;
    }
    const value = check.value;
    const sprintId = state.sprintInfo?.id ? String(state.sprintInfo.id) : null;

    // ROTEAMENTO POR CAPACIDADE (§CP5/CP6). No fluxo normal `identityWrites` é FALSE e nada muda: a
    // escrita é v1 por displayName. Só num teste controlado com a flag TRUE o cliente usa
    // EXCLUSIVAMENTE a rota v2 por identidade — sem qualquer fallback v2→v1.
    if (sharedConfig.identityWritesEnabled) {
      // O slot vem SEMPRE da intenção — nunca reconstruído a partir do displayName. Sem slot (ex.:
      // token de outra superfície, como a tabela de estimativas) ou slot INCOERENTE com o contexto
      // atual → FALHA VISÍVEL, zero request e zero persistência.
      const slot = intent.slot;
      const slotCoerente = sprintId
        ? slot && slot.kind === 'sprint' && slot.sprintId === sprintId
        : slot && slot.kind === 'global';
      if (!slotCoerente) {
        ui.showError('Contexto de configuração não confere com a linha (recarregue). Nada foi salvo.');
        renderers.renderConfig({ force: true });
        return;
      }
      const personId = intent.personId || null;
      let externalRef = null;
      if (!personId) {
        // Sem binding confirmado: só dá para escrever se houver a referência Jira Server key na
        // observação DIRETA da linha. Handle provisório sem personId e sem key → FALHA VISÍVEL,
        // sem request e sem escrita parcial.
        if (intent.externalRef) externalRef = intent.externalRef;
        else {
          ui.showError('Sem vínculo de identidade (key do Jira) para esta pessoa. Nada foi salvo.');
          renderers.renderConfig({ force: true });
          return;
        }
      }
      // NENHUMA escrita otimista: o espelho local não é tocado antes do 200 e não há render
      // prematuro (que reexibiria o valor antigo). No SUCESSO o espelho já foi atualizado por
      // pushPersonField() — só então invalidamos as versões e renderizamos. Em erro/409, recarrega
      // do servidor e re-renderiza; NUNCA cai para pushField.
      const invalidarERenderizar = () => {
        if (state.allIssues.length) {
          state.renderedVersion.cycletime = null;
          state.renderedVersion.horas = null;
          state.renderedVersion.charts = null;
          state.renderedVersion.planning = null;
          state.renderedVersion.quality = null;
          state.renderedVersion.assignees = null;
        }
        renderers.renderConfig({ force: true });
      };
      sharedConfig.pushPersonField({ slot, personId, externalRef, field, value }).then(
        () => invalidarERenderizar(),
        async error => {
          ui.showError(`Falha ao salvar (identidade v2): ${error.message}`);
          await sharedConfig.load();
          renderers.renderConfig({ force: true });
        }
      );
      return;
    }

    // === Fluxo v1 (identityWrites false) — EXATO como sempre: chave de config = displayName. ===
    const person = intent.displayName;
    // SÓ no modo shared e destravado: manda o campo pro servidor (merge por campo). O espelho local
    // já é atualizado abaixo; se o POST falhar, recarrega do servidor pra não deixar o espelho
    // mentindo. Em local/offline a gravação é só no localStorage e o rollback está proibido.
    if (sharedConfig.isShared && sharedConfig.unlocked) {
      sharedConfig.pushField(sprintId, person, field, value).catch(async error => {
        ui.showError(`Falha ao salvar no servidor: ${error.message}`);
        await sharedConfig.load();
        renderers.renderConfig({ force: true });
      });
    }

    if (sprintId) {
      // Sprint atual conhecida → escreve no namespace per-sprint.
      const all = storage.getJson('sprint-configs-by-sprint', {});
      if (!all[sprintId]) all[sprintId] = {};
      if (!all[sprintId][person]) all[sprintId][person] = {};
      all[sprintId][person][field] = value;
      storage.setJson('sprint-configs-by-sprint', all);
    } else {
      // Sem sprint context (JQL sem Sprint = X) → escreve no Global Default (legado).
      const config = storage.getJson('sprint-config', {});
      if (!config[person]) config[person] = {};
      config[person][field] = value;
      storage.setJson('sprint-config', config);
    }

    if (state.allIssues.length) {
      state.renderedVersion.cycletime = null;
      state.renderedVersion.horas = null;
      state.renderedVersion.charts = null;
      state.renderedVersion.planning = null;
      state.renderedVersion.quality = null;
      // Card "Comprometimento estimado por pessoa" também consome papel — invalidar.
      state.renderedVersion.assignees = null;
      renderers.renderConfig({ force: true });
    }
  },
  saveAllocated(input) {
    const name = input.dataset.person;
    const value = Number.parseFloat(input.value) || 0;
    const saved = storage.getJson('horas-alocadas', {});
    saved[name] = value;
    storage.setJson('horas-alocadas', saved);

    const spent = state.horasSpentByPerson[name] || 0;
    const allocated = value * 3600;
    const pctElement = $(`#pct-${safeDomId(name)}`);
    if (!pctElement) return;

    if (allocated > 0 && spent > 0) {
      const percent = Math.round((spent / allocated) * 100);
      pctElement.textContent = `${percent}%`;
      pctElement.style.color = utilizationColor(percent);
    } else {
      pctElement.textContent = '—';
      pctElement.style.color = CONFIG.colors.muted;
    }
  },
  // Pede ao React (fora do iframe) o snapshot compartilhado desta JQL. O JWT do app
  // nunca entra aqui — quem fala com o backend é sempre o componente pai, que já tem
  // authFetch; este método só troca postMessage com ele. Fora do iframe (acesso direto
  // ao index.html, que hoje redireciona pra /jiradash antes disso rodar) não há pai pra
  // perguntar — resolve null na hora, sem round-trip.
  requestSharedSnapshot(jql) {
    if (window.self === window.top) return Promise.resolve(null);
    return new Promise(resolve => {
      let settled = false;
      const finish = value => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        window.removeEventListener('message', onMessage);
        resolve(value);
      };
      const onMessage = event => {
        if (event.data?.type !== 'JIRADASH_SNAPSHOT_RESULT' || event.data.jql !== jql) return;
        finish(event.data.snapshot || null);
      };
      // Backend fora do ar ou resposta perdida não pode travar a troca de squad pra
      // sempre — cai pro fetch ao vivo depois de um tempo curto.
      const timer = setTimeout(() => finish(null), 4000);
      window.addEventListener('message', onMessage);
      window.parent.postMessage({ type: 'JIRADASH_REQUEST_SNAPSHOT', jql }, '*');
    });
  },

  // Ponto de entrada usado por squadStore.apply() quando não há nada no squadCache em
  // memória: primeiro tenta o snapshot compartilhado (mesma JQL = mesmo dado pra todo
  // mundo, sem bater no Jira); só cai pro fetch ao vivo se ninguém nunca carregou essa
  // JQL ainda. O fetch ao vivo (loadData → publishLoadedDataset) é quem empurra o
  // snapshot de volta pro backend, então a segunda pessoa a abrir já encontra cache.
  async loadFromSharedOrFetch(squadId, jql) {
    const snapshot = await this.requestSharedSnapshot(jql);
    if (snapshot?.payload) {
      const ok = await this.restoreFromCache(snapshot.payload);
      if (ok) {
        squadCache[squadId] = snapshot.payload;
        this.renderSprintInfo(snapshot.payload.allIssues, snapshot.payload.sprintInfo, jql, {
          fetchedAt: snapshot.fetchedAt,
          fetchedByName: snapshot.fetchedByName
        });
      }
      return;
    }
    this.loadData();
  },

  // Devolve `true` só se a restauração foi realmente publicada E a geração dela ainda
  // é a corrente ao final. Quem chama usa isso para decidir se pode falar com o
  // usuário: o aviso "exibindo dados em cache" não pode aparecer sobre uma carga mais
  // nova que já tomou o lugar desta restauração.
  async restoreFromCache(cached) {
    // Restaurar do cache TAMBÉM substitui o dataset: abre geração nova para invalidar
    // qualquer loadData ainda em voo (troca de squad no meio de uma carga lenta).
    const ctx = this.beginLoad();
    ui.clearError();
    ui.clearWarning();
    state.expandedRows.clear();
    // Expansões da aba Horas pertencem ao dataset anterior: chave de outra squad não existe aqui.
    state.hoursExpandedParents.clear();
    state.issuePage = 1;
    state.issueFilters = emptyIssueFilters();
    state.issueFilterOpen = null;
    state.sprintDates.start = cached.sprintDates.start;
    state.sprintDates.end = cached.sprintDates.end;
    state.sprintInfo = cached.sprintInfo || null;
    // sprintRemoved é opcional no cache (snapshot pode ser antigo) — undefined vira null.
    // Reidrata Date a partir do snapshot (cache pode ter sido serializado/desserializado).
    state.sprintRemoved = Array.isArray(cached.sprintRemoved)
      ? cached.sprintRemoved.map(entry => ({ ...entry, removedAt: new Date(entry.removedAt) }))
      : cached.sprintRemoved !== undefined
        ? cached.sprintRemoved
        : null;
    issueService.setIssues(cached.allIssues, { worklogsLoaded: false });
    // Boards das sprints com config — o carry-forward só olha o mesmo board.
    await sprintBoardStore.ensureFor(state.sprintInfo);
    // Invalidada durante o ensureFor: o dataset já foi trocado por outra carga, então
    // não renderiza nada e avisa o chamador que a restauração não vale.
    if (!this.isCurrentLoad(ctx)) return false;
    this.updateHeader(cached.allIssues, cached.sprintInfo, ctx.jql);
    this.renderSprintInfo(cached.allIssues, cached.sprintInfo, ctx.jql);
    renderers.renderMetrics();
    ui.setDashboardVisible(true);
    ui.setConfigVisible(false);
    await this.renderActiveTab();
    // renderActiveTab tem await (worklogs): confere de novo antes de dizer que valeu.
    return this.isCurrentLoad(ctx);
  },

  // Publica os ids de customfield resolvidos por fetchFieldMeta. Síncrono, e só
  // chamado depois da geração confirmada.
  publishFieldMeta(meta) {
    state.flaggedFieldId = meta.flaggedFieldId;
    state.sprintFieldId = meta.sprintFieldId;
    state.identificadorFieldId = meta.identificadorFieldId;
    state.tipoDefeitoFieldId = meta.tipoDefeitoFieldId;
    state.rotinaFieldId = meta.rotinaFieldId;
    state.clienteFieldId = meta.clienteFieldId;
  },

  // Publicação do dataset carregado: o ÚNICO ponto em que loadData escreve no state.
  // É síncrono de propósito e por isso não pode ser marcado como async nem ganhar um
  // await lá dentro — é o que garante que ninguém se intromete entre a primeira e a
  // última atribuição. Só é chamado depois da geração ter sido confirmada.
  publishLoadedDataset(ctx, { issues, allFetched, sprintInfo, sprintStart, sprintEnd, sprintRemoved, jql }) {
    // A ordem importa: setIssues chama buildDerived, que lê state.sprintInfo e
    // state.sprintDates (isIssueInCurrentSprint). Os metadados vão antes.
    state.sprintDates.start = sprintStart;
    state.sprintDates.end = sprintEnd;
    state.sprintInfo = sprintInfo || null;
    issueService.setIssues(allFetched, { worklogsLoaded: false });
    state.sprintRemoved = sprintRemoved;
    // ctx.squadId, não squadStore.activeId: no fim da carga a squad ativa já pode ser
    // outra, e o cache iria parar na squad errada.
    squadCache[ctx.squadId] = {
      allIssues: state.allIssues,
      sprintDates: { start: sprintStart, end: sprintEnd },
      sprintInfo,
      sprintRemoved
    };
    // Fetch REAL (nunca uma restauração — publishLoadedDataset só roda a partir de
    // loadData) vira a versão compartilhada pra quem mais tiver essa JQL. postMessage
    // é síncrono de disparar; o POST em si acontece no React, fora deste método.
    if (window.self !== window.top) {
      window.parent.postMessage(
        { type: 'JIRADASH_PUSH_SNAPSHOT', jql, payload: squadCache[ctx.squadId] },
        '*'
      );
    }
    this.updateHeader(issues, sprintInfo, jql);
    this.renderSprintInfo(issues, sprintInfo, jql);
    renderers.renderMetrics();

    ui.hideLoading();
    ui.setDashboardVisible(true);
    ui.setConfigVisible(false);
  },

  async loadData() {
    const ctx = this.beginLoad();
    ui.clearError();
    ui.clearWarning();
    ui.showLoading('Conectando ao Jira...');
    ui.setDashboardVisible(false);
    state.expandedRows.clear();
    // Expansões da aba Horas pertencem ao dataset anterior: chave de outra squad não existe aqui.
    state.hoursExpandedParents.clear();
    state.issuePage = 1;
    state.issueFilters = emptyIssueFilters();
    state.issueFilterOpen = null;

    const jql = ctx.jql;

    if (!auth.authenticated) {
      ui.showError('Configure o token (PAT) do Jira primeiro.');
      ui.hideLoading();
      authUI.render();
      return;
    }
    if (!jql) {
      ui.showError('Preencha o JQL da sprint.');
      ui.hideLoading();
      return;
    }

    squadStore.saveActiveInputs();

    // Tudo abaixo trabalha em variáveis LOCAIS. O state só é tocado no bloco de
    // publicação, lá embaixo, depois da última confirmação de geração — assim uma
    // carga que ficou para trás não deixa metadados de outra sprint no meio do
    // dataset atual.
    try {
      const fieldMeta = await jiraApi.fetchFieldMeta();
      if (!this.isCurrentLoad(ctx)) return;
      // Publica os ids de campo só agora: fetchAllIssues monta o `fields=` a partir
      // deles, então precisam estar no state antes da busca — mas nunca vindos de uma
      // carga que já foi substituída.
      this.publishFieldMeta(fieldMeta);

      const [issues, sprintInfo] = await Promise.all([
        jiraApi.fetchAllIssues(jql),
        // ctx.jql, não jiraApi.jql: o input pode ter sido editado desde o início desta
        // carga, e a sprint tem que ser a mesma que originou a busca de issues.
        jiraApi.fetchSprintInfo(jql)
      ]);
      if (!this.isCurrentLoad(ctx)) return;

      const sprintStart = sprintInfo?.startDate ? new Date(sprintInfo.startDate) : null;
      const sprintEnd = sprintInfo?.endDate ? new Date(sprintInfo.endDate) : null;

      ui.showLoading('Carregando subtasks...');
      // Extrai project key do prefixo da primeira issue (mais robusto que parsear JQL).
      const projectKey = issues[0]?.key?.includes('-') ? issues[0].key.split('-')[0] : null;

      // Subtasks (essencial) + candidatas a removidas (opcional, isolado) em paralelo.
      // Qualquer falha em fetchSprintRemoved retorna null e não afeta o fluxo principal.
      const [subtasks, removedCandidates] = await Promise.all([
        jiraApi.fetchSubtasks(issues),
        projectKey && sprintInfo?.id && sprintStart
          ? jiraApi.fetchSprintRemoved(projectKey, sprintInfo.id, sprintStart, sprintEnd)
          : Promise.resolve(null)
      ]);
      if (!this.isCurrentLoad(ctx)) return;

      // Resolve o board (squad) da sprint atual e das anteriores que têm config.
      // Precisa vir ANTES do render: personConfig.snapshot() é síncrono. Subiu para
      // cá — antes da publicação — porque é o último await do fluxo, e o bloco de
      // publicação não pode ter await no meio.
      await sprintBoardStore.ensureFor(sprintInfo);
      if (!this.isCurrentLoad(ctx)) return;

      const allFetched = [...issues, ...subtasks];
      // Confirma quais candidatas realmente foram removidas via changelog.
      const sprintRemoved = removedCandidates
        ? issueService.extractRemovedFromCandidates(removedCandidates, sprintInfo.id, sprintStart)
        : null;

      this.publishLoadedDataset(ctx, {
        issues,
        allFetched,
        sprintInfo,
        sprintStart,
        sprintEnd,
        sprintRemoved,
        jql
      });

      await this.renderActiveTab();
    } catch (error) {
      // Falha de uma carga que já foi substituída não pode esconder o loading da
      // carga nova, nem restaurar cache por cima dela, nem mostrar erro sobre ela.
      if (!this.isCurrentLoad(ctx)) return;
      ui.hideLoading();
      const cached = squadCache[ctx.squadId];
      if (cached?.allIssues?.length) {
        // restoreFromCache abre a própria geração; a partir daqui o ctx desta carga
        // já não vale. Quem decide se o aviso pode aparecer é o retorno dela: só
        // avisamos se a restauração foi publicada e continua sendo a corrente.
        const restored = await this.restoreFromCache(cached);
        if (!restored) return;
        ui.showWarning({
          message: `Não foi possível atualizar agora (${error.message}). Exibindo dados em cache da carga anterior.`,
          actionLabel: 'Tentar novamente',
          actionId: 'load-data'
        });
      } else {
        ui.showError(`Erro ao conectar ao Jira: ${error.message}`);
      }
    }
  },
  updateHeader(issues, sprintInfo, jql) {
    const projectKey = issues[0]?.key?.split('-')[0] || '';
    const jqlProjectMatch = jql.match(/project\s*=\s*["']([^"']+)["']/i);
    const projectName = jqlProjectMatch ? jqlProjectMatch[1].trim() : projectKey;
    const sprintLabel = sprintInfo?.name ? ` · ${sprintInfo.name}` : '';
    const title = `Sprint Dashboard${projectKey ? ` — ${projectKey}` : ''}`;

    dom.dashTitle.textContent = title;
    dom.dashSub.textContent = `${projectName}${sprintLabel} · Jira TOTVS`;
    document.title = title;
    squadStore.updateActiveName(projectKey || projectName || 'Squad');
  },
  renderSprintInfo(issues, sprintInfo, jql, freshness) {
    const sprintId = jql.match(/Sprint\s*=\s*(\d+)/i)?.[1] || '—';

    dom.sprintInfo.innerHTML = sprintInfo?.name
      ? `
              <span><strong>Sprint:</strong> ${escapeHtml(sprintInfo.name)}</span>
              <span><strong>Estado:</strong> ${escapeHtml(sprintInfo.state || '—')}</span>
              <span><strong>Início:</strong> ${formatDate(sprintInfo.startDate)}</span>
              <span><strong>Término:</strong> ${formatDate(sprintInfo.endDate)}</span>
              <span><strong>Total:</strong> ${issues.length} issues</span>`
      : `<span><strong>Sprint:</strong> ${escapeHtml(sprintId)}</span><span><strong>Total:</strong> ${issues.length} issues</span>`;

    // Dado veio de snapshot compartilhado (não de um fetch ao vivo nesta sessão): mostra
    // quem/quando atualizou por último, pra quem tá vendo saber que pode estar velho.
    if (freshness?.fetchedAt) {
      const freshEl = document.createElement('span');
      freshEl.className = 'sprint-info-freshness';
      freshEl.textContent = `↻ ${relativeTime(freshness.fetchedAt)}${freshness.fetchedByName ? ` por ${freshness.fetchedByName}` : ''}`;
      dom.sprintInfo.appendChild(freshEl);
    }
  }
};
