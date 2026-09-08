// Estado mutável global do dashboard, como SINGLETON.
//
// Compartilhado por IMPORTAÇÃO DIRETA da mesma instância: o registro de módulos do
// browser avalia este arquivo uma única vez, então todo importador recebe as MESMAS
// referências. É isso que sustenta as duas invariantes de concorrência do AGENTS.md §4 —
// a geração de carga (state.loadGeneration) e a identidade do dataset (state.allIssues).
//
// ⚠️ NUNCA copie: `{ ...state }`, `structuredClone`, JSON round-trip ou qualquer outra
// instância quebram as duas invariantes sem que lint ou teste acusem. Também não congele
// nem sele: os dois objetos são mutados de propósito, o tempo todo.
import { CONFIG } from './config.js';

export const state = {
  allIssues: [],
  derived: null,
  charts: {},
  expandedRows: new Set(),
  // Pais com subtasks expandidas no quadro "Estimado vs Apontado por issue pai" (aba Horas).
  // ⚠️ Estado PRÓPRIO, separado de `expandedRows`, que é o detalhamento da aba Issues: compartilhar
  // o Set faria abrir uma linha lá abrir a outra aqui. Só memória — nada em localStorage —, e é
  // limpo em `setIssues` (carga nova, troca de squad, restauração de cache).
  hoursExpandedParents: new Set(),
  flaggedFieldId: CONFIG.defaultFlaggedFieldId,
  sprintFieldId: CONFIG.defaultSprintFieldId,
  // IDs (customfield_xxxxx) descobertos por nome em fetchFieldMeta — usados para
  // detalhar os defeitos abertos na aba Qualidade. null = campo não encontrado na
  // instância do Jira, e o detalhe simplesmente não aparece.
  identificadorFieldId: null,
  tipoDefeitoFieldId: null,
  // IDs (customfield_xxxxx) resolvidos por nome em fetchFieldMeta — usados só pela
  // exportação de retro. rotina = "Agrupador de Rotina", cliente = "Nome Fantasia / Razão Social".
  rotinaFieldId: null,
  clienteFieldId: null,
  horasSpentByPerson: {},
  sprintDates: { start: null, end: null },
  sprintInfo: null,
  // CP7 — referência de ESCOPO ANALÍTICO da squad ativa, publicada por `squadStore.apply()` (a
  // aplicação é quem monta o contexto; `person-config` só LÊ daqui, sem importar `squad-store`,
  // para não criar ciclo). `null` = squad sem referência = caminho legado por board.
  activeAnalysisScopeId: null,
  // null = consulta de removidas não rodou ou falhou; [] = OK sem removidas;
  // [..] = lista no formato { issue, removedAt: Date, author: string }
  sprintRemoved: null,
  activeTab: 'charts',
  issuePage: 1,
  // Filtros da aba Issues: um ARRAY por dimensão, vazio = "todos".
  // ⚠️ Este literal precisa ser IDÊNTICO ao de `emptyIssueFilters()` (domain/issue-filters.js), que
  // é o usado nos resets de carga e troca de squad. `core/` não importa `domain/` (§4 do
  // AGENTS.md), então a igualdade é garantida por teste, não pelo compilador.
  // Só de sessão: nada disso vai para storage, config compartilhada ou envelope.
  issueFilters: { status: [], type: [], impediment: [], assignee: [] },
  // Qual painel de filtro está ABERTO ('status' | 'type' | 'impediment' | 'assignee' | null).
  // ⚠️ Precisa viver no estado porque `renderIssues()` reescreve o `innerHTML` inteiro da aba a
  // cada marcação: sem isso, o painel fechava sozinho a cada clique e marcar três status viraria
  // três reaberturas.
  issueFilterOpen: null,
  dataVersion: 0,
  renderedVersion: {},
  worklogsLoaded: false,
  worklogLoadingPromise: null,
  partialWorklogs: new Set(),
  allocationView: 'ajustado',
  // View do gráfico "Capacidade Produtiva vs Alocação": 'original' usa
  // timeoriginalestimate (committed), 'ajustado' usa meta.estimated (restante +
  // apontado na sprint, com teto no Original que entrou na sprint — ver getEstimatedInSprint).
  capacityChartView: 'original',
  // Cache dos buckets calculados em renderPlanning — permite o toggle re-renderizar
  // só o chart sem precisar refazer o loop.
  capacityCharts: null,
  burndownView: 'fechamento',
  cachedBurndown: null,
  planningExpanded: null,
  // Drill-down do card "Comprometimento estimado por pessoa" — nome da pessoa cujo
  // detalhe está aberto, ou null se nenhum aberto.
  estimateDetailFor: null,
  // Aba de squad em modo de edição de nome (id da squad) ou null. Fica no state
  // porque renderTabs() desenha a partir daqui: a aba vira <input> em vez de <button>,
  // em vez de um input ser injetado dentro do botão (input dentro de button é HTML
  // inválido e a barra de espaço acaba ativando o botão).
  squadRenamingId: null,
  // Id da squad sendo arrastada no reordenamento das abas, ou null.
  squadDragId: null,
  // Geração da carga de dados. Toda operação que SUBSTITUI o dataset (loadData,
  // restoreFromCache) incrementa isto no início e carrega o valor consigo. Ao voltar
  // de cada await, a operação confere se ainda é a geração corrente; se não for,
  // descarta os próprios resultados em vez de escrever no state. Sem isso, uma carga
  // lenta que termina depois de uma troca de squad publica metadados de sprint por
  // cima do dataset novo.
  loadGeneration: 0
};

export const squadCache = {}; // { [squadId]: { allIssues, sprintDates, sprintInfo } }
