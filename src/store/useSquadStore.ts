import { create } from 'zustand';
import { squadApi } from '@/app/squad/api';
import { userApi } from '@/app/users/api';
import type {
  SquadConfig, SquadIssueSnapshot, SquadMetricsRollup, SquadMemberMetric, SquadMember,
  SquadDailySnapshot, SquadWorkflowPhase
} from '@/lib/types';

const DAILY_SNAPSHOT_WINDOW_DAYS = 21; // ~3 semanas de histórico buscadas na tela

interface SquadStoreState {
  config: SquadConfig | null;
  rollup: SquadMetricsRollup | null;
  issuesSnapshot: SquadIssueSnapshot[]; // backlog nominal — só populado por fetchSquadDetail (leadership)
  memberMetrics: SquadMemberMetric[]; // ranking/capacidade — idem
  members: SquadMember[]; // roster — visível a todo membro do squad
  myClaim: SquadMember | null; // linha do roster que o usuário atual reivindicou como sendo ele
  myIssues: SquadIssueSnapshot[]; // só issues do próprio myClaim.jiraAccountId
  dailySnapshots: SquadDailySnapshot[]; // "produtividade diária" — ordenado por data crescente
  // squadId da requisição em voo mais recente — permite descartar uma
  // resposta que chegue atrasada depois do usuário já ter trocado de squad
  // (senão dado do squad antigo podia sobrescrever o do squad novo).
  activeSquadId: string | null;
  isLoading: boolean;
  isLoadingDetail: boolean;
  isLoadingMyIssues: boolean;
  isSyncing: boolean;
  syncError: string | null;

  // --- Seletor de sprint (sync incremental v3) ---
  // null = "Atual" (ao vivo, usa rollup/issuesSnapshot/myIssues normalmente).
  // Setado = visualizando uma sprint cacheada, sem chamada ao Jira.
  viewingSprintId: string | null;
  viewedRollup: SquadMetricsRollup | null;
  viewedIssuesSnapshot: SquadIssueSnapshot[];
  viewedMyIssues: SquadIssueSnapshot[];
  isLoadingViewedSprint: boolean;
  isForceResyncingSprint: boolean;

  fetchSquad: (squadId: string) => Promise<void>;
  // Só chame isto se o viewer for SQUAD_LEADERSHIP_VIEW_ROLES — sem Firestore rules
  // o controle de visibilidade é feito no próprio componente (isLeadershipViewer).
  fetchSquadDetail: (squadId: string) => Promise<void>;
  fetchMembers: (squadId: string, uid?: string, userHints?: { email?: string; jiraAccountId?: string; name?: string }) => Promise<void>;
  claimMember: (squadId: string, jiraAccountId: string, uid: string) => Promise<void>;
  saveMemberCapacity: (
    squadId: string,
    jiraAccountId: string,
    updates: {
      displayName?: string;
      role?: string;
      email?: string;
      capacityHoursPerDay?: number;
      systemCalculatedCapacityHoursPerDay?: number;
      calibrationNotes?: string;
      overrideType?: string;
    }
  ) => Promise<void>;
  batchUpdateMembers: (squadId: string, members: SquadMember[]) => Promise<void>;
  deleteMember: (squadId: string, jiraAccountId: string) => Promise<void>;
  fetchMyIssues: (squadId: string, jiraAccountId: string) => Promise<void>;
  fetchDailySnapshots: (squadId: string) => Promise<void>;
  saveSquadConfig: (
    squadId: string,
    updates: {
      jiraProjectKey: string;
      syncJql: string;
      rankingEnabled: boolean;
      defaultDailyCapacityHours: number;
      jiraDomain?: string;
      sprintFieldId?: string;
      capacityCalculationMethod?: string;
      capacityJql?: string;
      capacityFormula?: string;
      rapidViewId?: number | string;
      phases?: SquadWorkflowPhase[];
    }
  ) => Promise<void>;
  syncSquad: (uid: string, squadId: string, forceFull?: boolean) => Promise<void>;
  // Cache-only — troca qual sprint a tela mostra sem chamar o Jira.
  selectSprint: (
    squadId: string, sprintId: string | null,
    opts: { isLeadershipViewer: boolean; myClaimedAssigneeId?: string }
  ) => Promise<void>;
  // Escape hatch pra sprint encerrada (ex: worklog lançado depois do fechamento)
  // — só reescreve a partição daquela sprintId, nunca toca na sprint ativa.
  forceResyncSprint: (uid: string, squadId: string, targetSprintId: string) => Promise<void>;
  reset: () => void;
}

export const useSquadStore = create<SquadStoreState>()((set, get) => ({
  config: null,
  rollup: null,
  issuesSnapshot: [],
  memberMetrics: [],
  members: [],
  myClaim: null,
  myIssues: [],
  dailySnapshots: [],
  activeSquadId: null,
  isLoading: false,
  isLoadingDetail: false,
  isLoadingMyIssues: false,
  isSyncing: false,
  syncError: null,

  viewingSprintId: null,
  viewedRollup: null,
  viewedIssuesSnapshot: [],
  viewedMyIssues: [],
  isLoadingViewedSprint: false,
  isForceResyncingSprint: false,

  fetchSquad: async (squadId) => {
    if (!squadId) return;
    set({ activeSquadId: squadId, isLoading: true });
    try {
      const [config, rollup] = await Promise.all([
        squadApi.getSquad(squadId),
        squadApi.getRollup(squadId),
      ]);
      // Descarta se, enquanto essa leitura estava em voo, o usuário já
      // trocou de squad — senão dado do squad antigo pisa no do squad novo.
      if (get().activeSquadId !== squadId) return;
      set({ config, rollup });
    } catch (err) {
      console.error('Erro ao buscar dados do squad:', err);
    } finally {
      if (get().activeSquadId === squadId) set({ isLoading: false });
    }
  },

  // Só chame isto se o viewer for SQUAD_LEADERSHIP_VIEW_ROLES — sem Firestore rules
  // o controle de visibilidade é feito no próprio componente (isLeadershipViewer).
  fetchSquadDetail: async (squadId) => {
    if (!squadId) return;
    set({ activeSquadId: squadId, isLoadingDetail: true });
    try {
      const [issuesSnapshot, memberMetrics] = await Promise.all([
        squadApi.getIssues(squadId),
        squadApi.getMemberMetrics(squadId),
      ]);
      if (get().activeSquadId !== squadId) return;
      set({
        issuesSnapshot,
        memberMetrics: [...memberMetrics].sort((a, b) => (b.hoursLogged || 0) - (a.hoursLogged || 0)),
      });
    } catch (err) {
      console.error('Erro ao buscar detalhe do squad:', err);
    } finally {
      if (get().activeSquadId === squadId) set({ isLoadingDetail: false });
    }
  },

  // Roster é legível por qualquer membro do squad (não é dado sensível) —
  // Identifica automaticamente quem é o usuário atual no squad (auto-binding por UID, email, Jira ID ou nome).
  fetchMembers: async (squadId, uid, userHints) => {
    if (!squadId) return;
    try {
      const members = await squadApi.getMembers(squadId);
      const userEmail = (userHints?.email || (uid && uid.includes('@') ? uid : '')).toLowerCase().trim();
      const userJiraId = (userHints?.jiraAccountId || (uid && !uid.includes('@') ? uid : '')).trim();
      const userName = (userHints?.name || '').toLowerCase().trim();

      const myClaim = members.find(m => {
        if (uid && m.claimedByUid === uid) return true;
        if (userJiraId && m.jiraAccountId === userJiraId) return true;
        if (userEmail && m.email && m.email.toLowerCase().trim() === userEmail) return true;
        if (userEmail && m.jiraAccountId && m.jiraAccountId.toLowerCase().trim() === userEmail) return true;
        if (userName && m.displayName && m.displayName.toLowerCase().trim() === userName) return true;
        return false;
      }) || null;

      // Sem essa checagem, uma troca rápida de squad enquanto isto ainda
      // estava em voo pisava no roster/claim do squad novo com dado do
      // squad antigo — mesmo problema de race que fetchSquad/fetchSquadDetail
      // já evitam via activeSquadId.
      if (get().activeSquadId !== squadId) return;
      set({
        members,
        myClaim,
      });
    } catch (err) {
      console.error('Erro ao buscar roster do squad:', err);
    }
  },

  // "Isso sou eu" — Refaz fetchMembers pra atualizar myClaim local.
  claimMember: async (squadId, jiraAccountId, uid) => {
    await squadApi.saveMember(squadId, jiraAccountId, { claimedByUid: uid, updatedAt: new Date().toISOString() });
    await get().fetchMembers(squadId, uid);
  },

  saveMemberCapacity: async (squadId, jiraAccountId, updates) => {
    const payload = {
      jiraAccountId,
      ...(updates.displayName !== undefined ? { displayName: updates.displayName } : {}),
      ...(updates.role !== undefined ? { role: updates.role } : {}),
      ...(updates.email !== undefined ? { email: updates.email } : {}),
      ...(updates.capacityHoursPerDay !== undefined ? { capacityHoursPerDay: updates.capacityHoursPerDay } : {}),
      ...(updates.systemCalculatedCapacityHoursPerDay !== undefined ? { systemCalculatedCapacityHoursPerDay: updates.systemCalculatedCapacityHoursPerDay } : {}),
      ...(updates.calibrationNotes !== undefined ? { calibrationNotes: updates.calibrationNotes } : {}),
      ...(updates.overrideType !== undefined ? { overrideType: updates.overrideType } : {}),
      updatedAt: new Date().toISOString(),
    };
    await squadApi.saveMember(squadId, jiraAccountId, payload);
    set(state => ({
      members: state.members.map(m => m.jiraAccountId === jiraAccountId
        ? { ...m, ...payload }
        : m),
    }));
  },

  deleteMember: async (squadId, jiraAccountId) => {
    await squadApi.deleteMember(squadId, jiraAccountId);
    set(state => ({
      members: state.members.filter(m => m.jiraAccountId !== jiraAccountId),
    }));
  },

  batchUpdateMembers: async (squadId, updatedMembers) => {
    await squadApi.batchUpsertMembers(squadId, updatedMembers);
    set(state => ({
      members: state.members.map(m => {
        const found = updatedMembers.find(u => u.jiraAccountId === m.jiraAccountId);
        return found ? { ...m, ...found } : m;
      }),
    }));
  },

  // "Minhas issues" — só funciona depois de claimMember; filtra por assigneeId.
  // Sempre reflete a sprint ATIVA — pra ver "minhas issues" de uma sprint passada,
  // use selectSprint (viewedMyIssues).
  fetchMyIssues: async (squadId, jiraAccountId) => {
    if (!squadId || !jiraAccountId) { set({ myIssues: [] }); return; }
    set({ isLoadingMyIssues: true });
    try {
      const myIssues = await squadApi.getIssuesByAssignee(squadId, jiraAccountId);
      if (get().activeSquadId !== squadId) return;
      set({ myIssues });
    } catch (err) {
      console.error('Erro ao buscar minhas issues:', err);
    } finally {
      set({ isLoadingMyIssues: false });
    }
  },

  // "Produtividade diária" — série curta (~3 semanas).
  fetchDailySnapshots: async (squadId) => {
    if (!squadId) return;
    try {
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - DAILY_SNAPSHOT_WINDOW_DAYS);
      const cutoffStr = `${cutoff.getFullYear()}-${String(cutoff.getMonth() + 1).padStart(2, '0')}-${String(cutoff.getDate()).padStart(2, '0')}`;
      const days = await squadApi.getDailySnapshots(squadId, cutoffStr);
      if (get().activeSquadId !== squadId) return;
      set({ dailySnapshots: days });
    } catch (err) {
      console.error('Erro ao buscar produtividade diária:', err);
    }
  },

  saveSquadConfig: async (squadId, updates) => {
    // Detecta a transição false->true de rankingEnabled pra forçar uma sync
    // FULL seguinte (backfill de issueWorklogCache pra partição inteira).
    const current = get().config;
    const rankingJustEnabled = updates.rankingEnabled && !current?.rankingEnabled;
    const payload: Partial<SquadConfig> = {
      squadId,
      name: current?.name || squadId,
      jiraProjectKey: updates.jiraProjectKey.trim(),
      syncJql: updates.syncJql.trim(),
      rankingEnabled: updates.rankingEnabled,
      defaultDailyCapacityHours: updates.defaultDailyCapacityHours,
      ...(updates.capacityCalculationMethod ? { capacityCalculationMethod: updates.capacityCalculationMethod } : {}),
      ...(updates.capacityJql !== undefined ? { capacityJql: updates.capacityJql } : {}),
      ...(updates.capacityFormula !== undefined ? { capacityFormula: updates.capacityFormula } : {}),
      ...(updates.jiraDomain ? { jiraDomain: updates.jiraDomain.trim() } : {}),
      ...(updates.sprintFieldId ? { sprintFieldId: updates.sprintFieldId.trim() } : {}),
      ...(updates.rapidViewId !== undefined ? { rapidViewId: updates.rapidViewId } : {}),
      ...(updates.phases !== undefined ? { phases: updates.phases } : {}),
      ...(rankingJustEnabled ? { rankingEnabledAt: new Date().toISOString() } : {}),
      updatedAt: new Date().toISOString(),
    };
    await squadApi.saveSquad(squadId, payload);
    set(state => ({ config: { ...(state.config as SquadConfig), ...payload } }));
  },

  // O motor de sync (full/delta, parsing de sprint, métricas por pessoa, freios
  // de segurança contra apagar em massa) roda inteiro no backend agora
  // (SquadSyncService) — este action só dispara e refaz fetch do que mudou.
  // Ver plano de unificação Squad Pulse + jiradash, Fase 2.
  syncSquad: async (uid, squadId, forceFull) => {
    set({ isSyncing: true, syncError: null });
    try {
      if (uid && squadId && squadId !== 'Sem Time') {
        userApi.saveUser({ id: uid, squadId }).catch(() => {});
      }
      await squadApi.sync(squadId, forceFull);

      const [config, rollup, memberMetrics] = await Promise.all([
        squadApi.getSquad(squadId),
        squadApi.getRollup(squadId),
        squadApi.getMemberMetrics(squadId),
      ]);
      if (get().activeSquadId !== squadId) return;
      set({
        config,
        rollup,
        memberMetrics: config?.rankingEnabled
          ? [...memberMetrics].sort((a, b) => (b.hoursLogged || 0) - (a.hoursLogged || 0))
          : [],
      });
    } catch (err: any) {
      const message = err?.message || 'Erro ao sincronizar com o Jira.';
      set({ syncError: message });
      throw err;
    } finally {
      set({ isSyncing: false });
    }
  },

  // Cache-only — troca qual sprint a tela mostra. "Atual" (sprintId=null) é
  // um no-op local. Qualquer outra sprint busca da API sem chamar o Jira.
  selectSprint: async (squadId, sprintId, opts) => {
    set({ viewingSprintId: sprintId });
    if (!sprintId) {
      set({ viewedRollup: null, viewedIssuesSnapshot: [], viewedMyIssues: [] });
      return;
    }
    set({ isLoadingViewedSprint: true });
    try {
      const [viewedRollup, issuesForSprint, myIssuesForSprint] = await Promise.all([
        squadApi.getRollup(squadId),
        squadApi.getIssues(squadId, sprintId),
        opts?.myClaimedAssigneeId
          ? squadApi.getIssuesByAssignee(squadId, opts.myClaimedAssigneeId).then(all => all.filter(s => s.sprintId === sprintId))
          : Promise.resolve([]),
      ]);
      if (get().viewingSprintId !== sprintId) return;
      set({ viewedRollup, viewedIssuesSnapshot: issuesForSprint, viewedMyIssues: myIssuesForSprint });
    } catch (err) {
      console.error('Erro ao buscar sprint selecionada:', err);
    } finally {
      if (get().viewingSprintId === sprintId) set({ isLoadingViewedSprint: false });
    }
  },

  // Escape hatch pra sprint ENCERRADA — reescreve só aquela partição no
  // backend (SquadSyncService.forceResyncSprint), nunca toca em
  // config.activeSprintId. Leadership-only.
  forceResyncSprint: async (uid, squadId, targetSprintId) => {
    set({ isForceResyncingSprint: true });
    try {
      await squadApi.forceResyncSprint(squadId, targetSprintId);
      const config = await squadApi.getSquad(squadId);

      if (get().viewingSprintId === targetSprintId) {
        const [viewedRollup, viewedIssuesSnapshot] = await Promise.all([
          squadApi.getRollup(squadId),
          squadApi.getIssues(squadId, targetSprintId),
        ]);
        if (get().viewingSprintId === targetSprintId) set({ viewedRollup, viewedIssuesSnapshot });
      }
      set(state => ({ config: state.config && config ? { ...state.config, sprintHistory: config.sprintHistory } : state.config }));
    } finally {
      set({ isForceResyncingSprint: false });
    }
  },

  reset: () => set({
    config: null, rollup: null, issuesSnapshot: [], memberMetrics: [],
    members: [], myClaim: null, myIssues: [], dailySnapshots: [],
    activeSquadId: null, isLoading: false, isLoadingDetail: false, isLoadingMyIssues: false,
    isSyncing: false, syncError: null,
    viewingSprintId: null, viewedRollup: null, viewedIssuesSnapshot: [], viewedMyIssues: [],
    isLoadingViewedSprint: false, isForceResyncingSprint: false,
  }),
}));
