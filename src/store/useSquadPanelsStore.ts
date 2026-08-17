import { create } from 'zustand';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  deleteDoc,
  deleteField,
  query,
  where,
  setDoc,
  Firestore
} from 'firebase/firestore';
import { fetchJiraIssues, fetchAllJiraIssues } from '@/services/jiraService';
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

interface SquadPanelsState {
  panels: SquadPanel[];
  isLoading: boolean;
  runningIds: Set<string>;

  fetchPanels: (firestore: Firestore, squadId: string, uid: string) => Promise<void>;
  createPanel: (
    firestore: Firestore, squadId: string, uid: string, ownerName: string,
    input: { title: string; jql: string; chartType: SquadPanelChartType; groupBy: SquadPanelGroupBy; aggregateMetric: SquadPanelAggregateMetric; visibility: 'private' | 'squad' }
  ) => Promise<string>;
  updatePanel: (
    firestore: Firestore, squadId: string, panelId: string,
    updates: Partial<Pick<SquadPanel, 'title' | 'jql' | 'chartType' | 'groupBy' | 'aggregateMetric' | 'visibility'>>
  ) => Promise<void>;
  deletePanel: (firestore: Firestore, squadId: string, panelId: string) => Promise<void>;
  runPanel: (firestore: Firestore, squadId: string, panelId: string, uid: string) => Promise<void>;
  reset: () => void;
}

export const useSquadPanelsStore = create<SquadPanelsState>()((set, get) => ({
  panels: [],
  isLoading: false,
  runningIds: new Set(),

  // Rules só permitem OR simples num doc (dono OU squad-visível) — Firestore
  // não faz OR entre campos diferentes numa query só, então roda duas
  // queries e mescla/deduplica aqui.
  fetchPanels: async (firestore, squadId, uid) => {
    if (!squadId || !uid) return;
    set({ isLoading: true });
    try {
      const col = collection(firestore, 'squads', squadId, 'panels');
      const [mineSnap, squadSnap] = await Promise.all([
        getDocs(query(col, where('ownerId', '==', uid))),
        getDocs(query(col, where('visibility', '==', 'squad'))),
      ]);
      const byId = new Map<string, SquadPanel>();
      [...mineSnap.docs, ...squadSnap.docs].forEach(d => byId.set(d.id, { id: d.id, ...d.data() } as SquadPanel));
      set({
        panels: Array.from(byId.values()).sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || '')),
      });
    } catch (err) {
      console.error('Erro ao buscar painéis:', err);
    } finally {
      set({ isLoading: false });
    }
  },

  createPanel: async (firestore, squadId, uid, ownerName, input) => {
    const ref = doc(collection(firestore, 'squads', squadId, 'panels'));
    const now = new Date().toISOString();
    const panel: SquadPanel = {
      id: ref.id,
      squadId,
      ownerId: uid,
      ownerName,
      title: input.title.trim(),
      jql: input.jql.trim(),
      chartType: input.chartType,
      groupBy: input.groupBy,
      aggregateMetric: input.aggregateMetric,
      visibility: input.visibility,
      createdAt: now,
      updatedAt: now,
    };
    await setDoc(ref, panel);
    set(state => ({ panels: [panel, ...state.panels] }));
    return ref.id;
  },

  updatePanel: async (firestore, squadId, panelId, updates) => {
    const ref = doc(firestore, 'squads', squadId, 'panels', panelId);
    const payload = { ...updates, updatedAt: new Date().toISOString() };
    await setDoc(ref, payload, { merge: true });
    set(state => ({ panels: state.panels.map(p => p.id === panelId ? { ...p, ...payload } : p) }));
  },

  deletePanel: async (firestore, squadId, panelId) => {
    await deleteDoc(doc(firestore, 'squads', squadId, 'panels', panelId));
    set(state => ({ panels: state.panels.filter(p => p.id !== panelId) }));
  },

  // Só o dono chama isto de verdade (UI só mostra o botão pro dono) — roda
  // com o PAT pessoal de quem está logado, nunca o de outra pessoa.
  runPanel: async (firestore, squadId, panelId, uid) => {
    const panel = get().panels.find(p => p.id === panelId);
    if (!panel) return;

    set(state => ({ runningIds: new Set(state.runningIds).add(panelId) }));
    const ref = doc(firestore, 'squads', squadId, 'panels', panelId);

    try {
      const jiraSettingsSnap = await getDoc(doc(firestore, 'users', uid, 'config', 'jira'));
      if (!jiraSettingsSnap.exists()) {
        throw new Error('Configure seu Personal Access Token do Jira em Configurações antes de rodar o painel.');
      }
      const { domain, token } = jiraSettingsSnap.data() as { domain: string; token: string };

      // Firestore rejeita `undefined` em campo (setDoc lança) — pra "limpar"
      // um campo que não se aplica ao chartType atual (ex: editou de tabela
      // pra número), usa o sentinel deleteField() na escrita; localmente
      // `undefined` já é inofensivo, então o estado em memória usa direto.
      let localUpdate: Partial<SquadPanel> = {};
      let firestoreUpdate: Record<string, unknown> = {};
      const lastRunAt = new Date().toISOString();

      if (panel.chartType === 'number') {
        // `total` já vem exato na primeira página — não precisa paginar tudo
        // só pra contar.
        const { total } = await fetchJiraIssues(domain, token, panel.jql, { maxResults: 1, fields: ['issuetype'] });
        localUpdate = { resultTotal: total, resultRows: undefined, resultIssues: undefined };
        firestoreUpdate = { resultTotal: total, resultRows: deleteField(), resultIssues: deleteField() };
      } else if (panel.chartType === 'table') {
        const { issues, total } = await fetchJiraIssues(domain, token, panel.jql, {
          maxResults: PANEL_TABLE_LIMIT, fields: ['summary', 'issuetype', 'status', 'parent'],
        });
        const resultIssues: SquadPanelIssueRow[] = issues.map(i => ({
          key: i.key, title: i.title, status: i.status, type: i.type,
          parentKey: i.parentKey || '', parentTitle: i.parentTitle || '',
        }));
        localUpdate = { resultTotal: total, resultIssues, resultRows: undefined };
        firestoreUpdate = { resultTotal: total, resultIssues, resultRows: deleteField() };
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
        localUpdate = { resultTotal: total, resultRows, resultIssues: undefined };
        firestoreUpdate = { resultTotal: total, resultRows, resultIssues: deleteField() };
      }

      await setDoc(ref, { ...firestoreUpdate, lastRunAt, lastRunError: '' }, { merge: true });
      set(state => ({ panels: state.panels.map(p => p.id === panelId ? { ...p, ...localUpdate, lastRunAt, lastRunError: '' } : p) }));
    } catch (err: any) {
      const message = err?.message || 'Erro ao rodar o painel.';
      try {
        await setDoc(ref, { lastRunError: message }, { merge: true });
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

  reset: () => set({ panels: [], isLoading: false, runningIds: new Set() }),
}));
