import { create } from 'zustand';
import { squadApi, type SquadPanelRecord } from '@/app/squad/api';
import { fetchJiraIssues, fetchAllJiraIssues } from '@/services/jiraService';
import { getJiraCredentials } from '@/hooks/useJiraSettings';
import type { SquadPanel, SquadPanelChartType, SquadPanelGroupBy, SquadPanelAggregateMetric, SquadPanelResultRow, SquadPanelIssueRow } from '@/lib/types';

// Painel é uma ferramenta ad-hoc, não o sync principal do squad — limites bem
// mais conservadores, evita alguém com vários painéis estourar o rate limit
// pessoal do Jira (20 req/min, ver api/jira/search/route.ts).
const PANEL_TABLE_LIMIT = 50;
const PANEL_GROUP_MAX_PAGES = 5; // teto de 500 issues por painel bar/pie

const GROUP_BY_FIELDS: Record<Exclude<SquadPanelGroupBy, 'none'>, string[]> = {
  status: ['status'],
  type: ['issuetype'],
  priority: ['priority'],
  assignee: ['assignee'],
  // Campo nativo do Jira em issues filhas (subtarefa) — não precisa de
  // plugin/issueFunction, só pedir `parent` no fetch.
  parent: ['parent'],
};

function extractGroupLabel(issue: any, groupBy: SquadPanelGroupBy): string {
  switch (groupBy) {
    case 'status': return issue.status || 'Sem status';
    case 'type': return issue.type || 'Sem tipo';
    case 'priority': return issue.priority || 'Sem prioridade';
    case 'assignee': return issue.assignee || 'Sem responsável';
    case 'parent': return issue.parentKey ? `${issue.parentKey} ${issue.parentTitle || ''}`.trim() : 'Sem issue pai';
    default: return '';
  }
}

// Campos brutos do Jira a pedir por métrica — mapIssue já resolve
// aggregate-ou-individual sozinho, então basta pedir a variante individual
// (issue filha não tem aggregate de nada abaixo dela).
const TIME_FIELDS: Record<Exclude<SquadPanelAggregateMetric, 'count'>, string[]> = {
  estimateHours: ['timeoriginalestimate'],
  remainingHours: ['timeestimate'],
  loggedHours: ['timespent'],
};

function extractMetricSeconds(issue: any, metric: SquadPanelAggregateMetric): number {
  switch (metric) {
    case 'estimateHours': return issue.timeEstimate || 0;
    case 'remainingHours': return issue.timeRemaining || 0;
    case 'loggedHours': return issue.timeSpent || 0;
    default: return 0;
  }
}

// Tudo que o backend não conhece (é um blob TEXT opaco pra ele) vive aqui —
// serializado dentro de SquadPanelRecord.config. `ownerName` precisa entrar
// aqui também: o backend só guarda ownerId (do JWT), então pra exibir "quem
// criou" num painel de visibilidade squad, a gente carrega o nome dentro do
// próprio blob.
interface PanelConfigBlob {
  jql: string;
  groupBy: SquadPanelGroupBy;
  aggregateMetric: SquadPanelAggregateMetric;
  ownerName: string;
  resultTotal?: number;
  resultRows?: SquadPanelResultRow[];
  resultIssues?: SquadPanelIssueRow[];
  lastRunAt?: string;
  lastRunError?: string;
}

function parseConfig(raw: string): Partial<PanelConfigBlob> {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

// PUT substitui `config` inteiro (não faz merge no backend) — então toda
// escrita precisa montar o blob completo. Undefined nunca aparece no JSON
// final (JSON.stringify já omite a chave), o que substitui o antigo sentinel
// deleteField() do Firestore: basta não incluir o campo pra "limpar" ele.
function buildConfig(fields: PanelConfigBlob): string {
  return JSON.stringify(fields);
}

function toFrontendPanel(record: SquadPanelRecord): SquadPanel {
  const cfg = parseConfig(record.config);
  return {
    id: record.id,
    squadId: record.squadId,
    ownerId: record.ownerId,
    ownerName: cfg.ownerName || record.ownerId,
    title: record.name,
    jql: cfg.jql || '',
    chartType: (record.type as SquadPanelChartType) || 'number',
    groupBy: cfg.groupBy || 'none',
    aggregateMetric: cfg.aggregateMetric || 'count',
    visibility: record.visibility === 'SQUAD' ? 'squad' : 'private',
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
    lastRunAt: cfg.lastRunAt,
    lastRunError: cfg.lastRunError,
    resultTotal: cfg.resultTotal,
    resultRows: cfg.resultRows,
    resultIssues: cfg.resultIssues,
  };
}

// Backend responde 403 (SecurityException) quando quem chama PUT/DELETE não
// é o dono do painel — mesma regra pra painel squad ou privado. Mensagem
// amigável aqui, e ainda assim relança pro caller poder tratar/togglear UI.
function friendlyErrorMessage(err: any, forbiddenMessage: string): string {
  if (typeof err?.message === 'string' && err.message.includes('403')) return forbiddenMessage;
  return err?.message || 'Erro ao comunicar com o servidor.';
}

interface SquadPanelsState {
  panels: SquadPanel[];
  isLoading: boolean;
  runningIds: Set<string>;
  panelsError: string | null;

  fetchPanels: (squadId: string) => Promise<void>;
  createPanel: (
    squadId: string, ownerName: string,
    input: { title: string; jql: string; chartType: SquadPanelChartType; groupBy: SquadPanelGroupBy; aggregateMetric: SquadPanelAggregateMetric; visibility: 'private' | 'squad' }
  ) => Promise<string>;
  updatePanel: (
    squadId: string, panelId: string,
    updates: Partial<Pick<SquadPanel, 'title' | 'jql' | 'chartType' | 'groupBy' | 'aggregateMetric' | 'visibility'>>
  ) => Promise<void>;
  deletePanel: (squadId: string, panelId: string) => Promise<void>;
  runPanel: (squadId: string, panelId: string, uid: string) => Promise<void>;
  reset: () => void;
}

export const useSquadPanelsStore = create<SquadPanelsState>()((set, get) => ({
  panels: [],
  isLoading: false,
  runningIds: new Set(),
  panelsError: null,

  // O merge "meus painéis privados + painéis squad-visíveis" agora é feito
  // no backend (a partir do JWT) — GET /api/squads/{squadId}/panels já volta
  // exatamente o conjunto certo, sem precisar rodar duas queries e deduplicar
  // aqui como fazia a versão Firestore.
  fetchPanels: async (squadId) => {
    if (!squadId) return;
    set({ isLoading: true, panelsError: null });
    try {
      const records = await squadApi.listPanels(squadId);
      const panels = records
        .map(toFrontendPanel)
        .sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || ''));
      set({ panels });
    } catch (err: any) {
      console.error('Erro ao buscar painéis:', err);
      set({ panelsError: err?.message || 'Erro ao buscar painéis.' });
    } finally {
      set({ isLoading: false });
    }
  },

  createPanel: async (squadId, ownerName, input) => {
    const payload = {
      name: input.title.trim(),
      type: input.chartType,
      visibility: (input.visibility === 'squad' ? 'SQUAD' : 'PRIVATE') as 'PRIVATE' | 'SQUAD',
      config: buildConfig({
        jql: input.jql.trim(),
        groupBy: input.groupBy,
        aggregateMetric: input.aggregateMetric,
        ownerName,
      }),
    };
    try {
      const saved = await squadApi.createPanel(squadId, payload);
      const panel = toFrontendPanel(saved);
      set(state => ({ panels: [panel, ...state.panels] }));
      return panel.id;
    } catch (err: any) {
      const message = friendlyErrorMessage(err, 'Você não tem permissão para criar painéis neste squad.');
      set({ panelsError: message });
      throw err;
    }
  },

  updatePanel: async (squadId, panelId, updates) => {
    const current = get().panels.find(p => p.id === panelId);
    const payload: Partial<Pick<SquadPanelRecord, 'name' | 'type' | 'config' | 'visibility'>> = {};

    if (updates.title !== undefined) payload.name = updates.title.trim();
    if (updates.chartType !== undefined) payload.type = updates.chartType;
    if (updates.visibility !== undefined) payload.visibility = updates.visibility === 'squad' ? 'SQUAD' : 'PRIVATE';

    // `config` é reescrito por inteiro — sempre parte do que já existia
    // localmente pra não perder jql/groupBy/aggregateMetric/resultados
    // cacheados que esta chamada não está mexendo.
    if (updates.jql !== undefined || updates.groupBy !== undefined || updates.aggregateMetric !== undefined) {
      payload.config = buildConfig({
        jql: updates.jql !== undefined ? updates.jql.trim() : (current?.jql || ''),
        groupBy: updates.groupBy !== undefined ? updates.groupBy : (current?.groupBy || 'none'),
        aggregateMetric: updates.aggregateMetric !== undefined ? updates.aggregateMetric : (current?.aggregateMetric || 'count'),
        ownerName: current?.ownerName || '',
        resultTotal: current?.resultTotal,
        resultRows: current?.resultRows,
        resultIssues: current?.resultIssues,
        lastRunAt: current?.lastRunAt,
        lastRunError: current?.lastRunError,
      });
    }

    try {
      const saved = await squadApi.updatePanel(squadId, panelId, payload);
      const panel = toFrontendPanel(saved);
      set(state => ({ panels: state.panels.map(p => p.id === panelId ? panel : p) }));
    } catch (err: any) {
      const message = friendlyErrorMessage(err, 'Apenas o dono do painel pode editá-lo.');
      set({ panelsError: message });
      throw err;
    }
  },

  deletePanel: async (squadId, panelId) => {
    try {
      await squadApi.deletePanel(squadId, panelId);
      set(state => ({ panels: state.panels.filter(p => p.id !== panelId) }));
    } catch (err: any) {
      const message = friendlyErrorMessage(err, 'Apenas o dono do painel pode excluí-lo.');
      set({ panelsError: message });
      throw err;
    }
  },

  // Só o dono chama isto de verdade (UI só mostra o botão pro dono) — roda
  // com o PAT pessoal de quem está logado, nunca o de outra pessoa.
  runPanel: async (squadId, panelId, uid) => {
    const panel = get().panels.find(p => p.id === panelId);
    if (!panel) return;

    set(state => ({ runningIds: new Set(state.runningIds).add(panelId) }));

    const baseConfig = {
      jql: panel.jql,
      groupBy: panel.groupBy,
      aggregateMetric: panel.aggregateMetric,
      ownerName: panel.ownerName,
    };

    try {
      const jiraCreds = await getJiraCredentials(uid);
      if (!jiraCreds || !jiraCreds.token) {
        throw new Error('Configure seu Token de Acesso do Jira em Conexão Jira antes de rodar o painel.');
      }
      const { domain, token } = jiraCreds;

      let resultUpdate: Partial<PanelConfigBlob> = {};

      if (panel.chartType === 'number') {
        // `total` já vem exato na primeira página — não precisa paginar tudo
        // só pra contar.
        const { total } = await fetchJiraIssues(domain, token, panel.jql, { maxResults: 1, fields: ['issuetype'] });
        resultUpdate = { resultTotal: total };
      } else if (panel.chartType === 'table') {
        const { issues, total } = await fetchJiraIssues(domain, token, panel.jql, {
          maxResults: PANEL_TABLE_LIMIT, fields: ['summary', 'issuetype', 'status', 'parent'],
        });
        const resultIssues: SquadPanelIssueRow[] = issues.map(i => ({
          key: i.key, title: i.title, status: i.status, type: i.type,
          parentKey: i.parentKey || '', parentTitle: i.parentTitle || '',
        }));
        resultUpdate = { resultTotal: total, resultIssues };
      } else {
        // bar/pie: agrupa por campo escolhido — precisa de todas as issues
        // no escopo (paginado, capado em PANEL_GROUP_MAX_PAGES). Métrica
        // 'count' soma 1 por issue; as de hora somam o campo de tempo
        // (segundos) convertido em horas, ex: horas restantes das
        // subtarefas somadas por issue pai.
        const metric = panel.aggregateMetric || 'count';
        const groupFields = GROUP_BY_FIELDS[panel.groupBy as Exclude<SquadPanelGroupBy, 'none'>] || ['status'];
        const fields = metric === 'count' ? groupFields : Array.from(new Set([...groupFields, ...TIME_FIELDS[metric]]));
        const { issues, total } = await fetchAllJiraIssues(domain, token, panel.jql, { fields, maxPages: PANEL_GROUP_MAX_PAGES });
        const totals = new Map<string, number>();
        issues.forEach(issue => {
          const label = extractGroupLabel(issue, panel.groupBy);
          const amount = metric === 'count' ? 1 : extractMetricSeconds(issue, metric) / 3600;
          totals.set(label, (totals.get(label) || 0) + amount);
        });
        const resultRows: SquadPanelResultRow[] = Array.from(totals.entries())
          .map(([label, value]) => ({ label, value: metric === 'count' ? value : Math.round(value * 10) / 10 }))
          .sort((a, b) => b.value - a.value);
        resultUpdate = { resultTotal: total, resultRows };
      }

      const lastRunAt = new Date().toISOString();
      const saved = await squadApi.updatePanel(squadId, panelId, {
        config: buildConfig({ ...baseConfig, ...resultUpdate, lastRunAt, lastRunError: '' }),
      });
      const mapped = toFrontendPanel(saved);
      set(state => ({ panels: state.panels.map(p => p.id === panelId ? mapped : p) }));
    } catch (err: any) {
      const message = err?.message || 'Erro ao rodar o painel.';
      try {
        await squadApi.updatePanel(squadId, panelId, {
          config: buildConfig({
            ...baseConfig,
            resultTotal: panel.resultTotal,
            resultRows: panel.resultRows,
            resultIssues: panel.resultIssues,
            lastRunAt: panel.lastRunAt,
            lastRunError: message,
          }),
        });
      } catch {
        // se nem isso gravar, o erro em tela já basta
      }
      set(state => ({ panels: state.panels.map(p => p.id === panelId ? { ...p, lastRunError: message } : p) }));
      throw err;
    } finally {
      set(state => {
        const next = new Set(state.runningIds);
        next.delete(panelId);
        return { runningIds: next };
      });
    }
  },

  reset: () => set({ panels: [], isLoading: false, runningIds: new Set(), panelsError: null }),
}));
