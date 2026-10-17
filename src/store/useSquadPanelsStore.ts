import { create } from 'zustand';
import { squadApi, SquadApiError, type SquadPanelRecord } from '@/app/squad/api';
import { getJiraCredentials } from '@/hooks/useJiraSettings';
import { runPanelQuery } from '@/lib/squad-panel-engine';
import type { SquadPanel, SquadPanelChartType, SquadPanelGroupBy, SquadPanelAggregateMetric, SquadPanelResultRow, SquadPanelIssueRow } from '@/lib/types';

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
export function friendlyErrorMessage(err: any, forbiddenMessage: string): string {
  if (err instanceof SquadApiError && err.status === 403) return forbiddenMessage;
  if (typeof err?.message === 'string' && err.message.includes('403')) return forbiddenMessage;
  return err?.message || 'Erro ao comunicar com o servidor.';
}

export type PanelsUnavailable = 'forbidden' | 'not_found' | 'error';

/** Status HTTP da falha de listar painéis -> motivo de indisponibilidade. */
export function unavailableReason(err: unknown): PanelsUnavailable {
  if (err instanceof SquadApiError) {
    if (err.status === 403) return 'forbidden';
    if (err.status === 404) return 'not_found';
  }
  return 'error';
}

interface SquadPanelsState {
  panels: SquadPanel[];
  isLoading: boolean;
  runningIds: Set<string>;
  panelsError: string | null;
  /**
   * Por que a squad não guarda painéis no servidor para esta pessoa: 'forbidden' (403), 'not_found' (404, o servidor
   * ainda não tem a rota) ou 'error' (falha de rede/servidor). null = disponível. A tela esconde a opção "No servidor
   * da squad" e fica só com "Neste navegador".
   */
  panelsUnavailable: PanelsUnavailable | null;

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
  panelsUnavailable: null,

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
      set({ panels, panelsUnavailable: null });
    } catch (err: any) {
      const reason = unavailableReason(err);
      // 403 e 404 são respostas esperadas (a tela cai em "Neste navegador"); só falha inesperada vai para o console.
      if (reason === 'error') console.error('Erro ao buscar painéis:', err);
      set({ panels: [], panelsError: err?.message || 'Erro ao buscar painéis.', panelsUnavailable: reason });
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

      const resultUpdate: Partial<PanelConfigBlob> = await runPanelQuery({ domain, token }, {
        jql: panel.jql,
        chartType: panel.chartType,
        groupBy: panel.groupBy,
        aggregateMetric: panel.aggregateMetric,
      });

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

  reset: () => set({ panels: [], isLoading: false, runningIds: new Set(), panelsError: null, panelsUnavailable: null }),
}));
