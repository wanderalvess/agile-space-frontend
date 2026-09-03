import { create } from 'zustand';
import { squadApi } from '@/app/squad/api';
import { userApi } from '@/app/users/api';
import { fetchAllJiraIssues, type JiraIssue } from '@/services/jiraService';
import { getJiraCredentials } from '@/hooks/useJiraSettings';
import type {
  SquadConfig, SquadIssueSnapshot, SquadMetricsRollup, SquadMemberMetric, SquadMember,
  SquadDailySnapshot, SquadSprintHistoryEntry, SquadIssueWorklogCache
} from '@/lib/types';

const STALE_THRESHOLD_DAYS = 3;
const DUE_SOON_THRESHOLD_DAYS = 3;
const DAILY_SNAPSHOT_WINDOW_DAYS = 21; // ~3 semanas de histórico buscadas na tela

// 2 semanas úteis — aproximação fixa (este app já assume janelas fixas em
// outros lugares, ex: streak de 15 dias no PerformanceDashboard). Fallback só
// usado quando a sprint ativa não pôde ser identificada (sprintFieldId não
// configurado, ou campo ausente nas issues encontradas).
const SPRINT_WORKDAYS_ASSUMED = 10;

// Intervalo default entre reconciliações completas (sync incremental v3) —
// squads/{squadId}.reconcileIntervalHours sobrescreve por squad.
const RECONCILE_INTERVAL_DEFAULT_HOURS = 6;

// Sprint "coringa" usada quando o squad não configurou sprintFieldId — tudo
// cai num balde só, igual ao comportamento de antes da v3 (sync sempre FULL,
// sem seletor de sprint, sem partição).
const UNMAPPED_SPRINT_ID = 'UNMAPPED';

// Campos sempre pedidos ao Jira: tipo/status/data + assignee (backlog nominal,
// v2) + tempo estimado/restante/logado — squad não usa story points (campo
// sempre 0 aqui, confirmado ao vivo), rastreia hora nas issues filhas
// (codificação/code review/teste) via campos nativos do Jira, não customfield.
// `worklog` só entra quando rankingEnabled — é o único campo que carrega
// hora POR PESSOA (quem logou), e ranking nasce desligado por padrão.
const SQUAD_SYNC_FIELDS_BASE = [
  'summary', 'issuetype', 'status', 'created', 'updated', 'duedate',
  'assignee', 'parent', 'timeoriginalestimate', 'timeestimate', 'timespent',
  'aggregatetimeoriginalestimate', 'aggregatetimeestimate', 'aggregatetimespent',
  'customfield_10015', 'customfield_10014', 'startDate',
  'customfield_10005', 'customfield_10008', 'customfield_10007',
  'customfield_10010', 'customfield_10020', 'customfield_10016',
  'customfield_10100', 'customfield_10101', 'customfield_10004'
];
const SQUAD_SYNC_FIELDS_WITH_WORKLOG = [...SQUAD_SYNC_FIELDS_BASE, 'worklog'];

// Firestore aceita no máximo 500 operações por batch. Uma sprint ativa
// normalmente fica bem abaixo disso, mas syncJql é texto livre editado por
// quem lidera o squad — nada garante que o escopo fique pequeno.
const BATCH_CHUNK_SIZE = 400;

function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

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

const daysSince = (isoDate: string): number => {
  if (!isoDate) return 0;
  const then = new Date(isoDate).getTime();
  if (Number.isNaN(then)) return 0;
  return Math.max(0, Math.floor((Date.now() - then) / 86_400_000));
};

const isBugType = (type: string): boolean => /bug|defeito|erro/i.test(type || '');

// Negativo de daysSince — dias até uma data futura (negativo se já passou).
const daysUntil = (isoDate: string): number => {
  if (!isoDate) return NaN;
  const then = new Date(isoDate).getTime();
  if (Number.isNaN(then)) return NaN;
  return Math.floor((then - Date.now()) / 86_400_000);
};

const todayStr = (): string => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

// Formata um ISO pra literal de data/hora aceito pelo JQL: "YYYY-MM-DD HH:mm".
function formatForJql(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

// Subtrai minutos de um ISO — usado como buffer de segurança na sync delta
// (o campo `updated` do Jira só tem granularidade de minuto no JQL; sem essa
// folga, uma issue atualizada no mesmo minuto da última sync podia ser
// perdida). Reprocessar uma issue que já estava em dia é inofensivo (upsert
// idempotente).
function subtractMinutes(iso: string, minutes: number): string {
  return new Date(new Date(iso).getTime() - minutes * 60_000).toISOString();
}

// Campo Sprint vem em dois formatos: Jira Cloud devolve objeto já parseado
// ({id,name,state,startDate,endDate,...}); Jira Server/DC devolve o
// toString() do objeto Java do Greenhopper como string
// ("com.atlassian.greenhopper...[id=1,state=ACTIVE,name=...,startDate=...]").
// Um issue pode ter passado por várias sprints — pega a ACTIVE, senão a última.
function parseSprintField(raw: unknown): { id: string; name: string; state: string; startDate: string; endDate: string } | null {
  const arr = Array.isArray(raw) ? raw : (raw ? [raw] : []);
  const parsed = arr.map((v: any) => {
    if (v && typeof v === 'object') {
      return { id: String(v.id ?? ''), name: v.name || '', state: v.state || '', startDate: v.startDate || '', endDate: v.endDate || '' };
    }
    if (typeof v === 'string') {
      const get = (key: string) => {
        const m = v.match(new RegExp(`${key}=([^,\\]]+)`));
        return m ? m[1] : '';
      };
      return { id: get('id'), name: get('name'), state: get('state'), startDate: get('startDate'), endDate: get('endDate') };
    }
    return null;
  }).filter((v): v is { id: string; name: string; state: string; startDate: string; endDate: string } => !!v);

  if (parsed.length === 0) return null;
  const active = parsed.find(p => p.state.toUpperCase() === 'ACTIVE');
  const target = active || parsed[parsed.length - 1];
  if (!target.startDate || target.startDate === '<null>' || !target.endDate || target.endDate === '<null>') return null;
  return target;
}

// Dias úteis (seg-sex) entre duas datas ISO, inclusive.
function countWorkdays(startIso: string, endIso: string): number {
  const start = new Date(startIso);
  const end = new Date(endIso);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end < start) return 0;
  let count = 0;
  const cur = new Date(start.getFullYear(), start.getMonth(), start.getDate());
  const endDay = new Date(end.getFullYear(), end.getMonth(), end.getDate());
  while (cur <= endDay) {
    const day = cur.getDay();
    if (day !== 0 && day !== 6) count++;
    cur.setDate(cur.getDate() + 1);
  }
  return count;
}

function groupBy<T>(items: T[], keyFn: (item: T) => string): Map<string, T[]> {
  const map = new Map<string, T[]>();
  items.forEach(item => {
    const key = keyFn(item);
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(item);
  });
  return map;
}

// Agrupa por pessoa: itens em progresso/concluídos (contagem, não pontos —
// squad não usa story points) vêm do assignee atual da issue; hora logada
// vem do autor de CADA worklog (pode ser gente diferente do assignee atual
// — mais correto pra quem de fato lançou a hora). Usado na sync FULL, onde
// `issues` já é o conjunto completo da partição — numa sync delta isso
// SUBESTIMARIA a hora logada (só veria worklog de quem mudou), por isso a
// sync delta usa computeMemberMetricsFromCache em vez desta função.
function computeMemberMetrics(
  issues: JiraIssue[],
  rankingEnabled: boolean,
  workdays: number,
  getCapacityHoursPerDay: (assigneeId: string) => number
): SquadMemberMetric[] {
  const map = new Map<string, { assigneeId: string; assigneeName: string; issuesInProgress: number; issuesCompleted: number; hoursLogged: number }>();
  const ensure = (id: string, name: string) => {
    if (!id) return null;
    if (!map.has(id)) map.set(id, { assigneeId: id, assigneeName: name || id, issuesInProgress: 0, issuesCompleted: 0, hoursLogged: 0 });
    return map.get(id)!;
  };

  issues.forEach(issue => {
    const aid = issue.assigneeId || '';
    if (aid) {
      const m = ensure(aid, issue.assignee || aid)!;
      if (issue.statusCategory === 'indeterminate') m.issuesInProgress += 1;
      if (issue.statusCategory === 'done') m.issuesCompleted += 1;
    }
    if (rankingEnabled) {
      (issue.worklogs || []).forEach((wl: any) => {
        const wid = wl?.author?.accountId || wl?.author?.key || wl?.author?.name || '';
        if (!wid) return;
        const m = ensure(wid, wl?.author?.displayName || wid)!;
        m.hoursLogged += (wl?.timeSpentSeconds || 0) / 3600;
      });
    }
  });

  const computedAt = new Date().toISOString();
  return Array.from(map.values()).map(m => {
    const capacityHours = getCapacityHoursPerDay(m.assigneeId) * workdays;
    return {
      ...m,
      capacityHours,
      utilizationPct: capacityHours > 0 ? m.hoursLogged / capacityHours : 0,
      computedAt,
    };
  });
}

// Equivalente a computeMemberMetrics, mas fonte é o cache local (Firestore),
// não a fetch do Jira que acabou de rodar — é o que permite uma sync DELTA
// recalcular ranking correto sem re-buscar issues que não mudaram. Contagem
// em progresso/concluída vem de `partitionIssues` (a partição MERGED, cache +
// delta); hora logada vem de `worklogCacheDocs` (idem).
function computeMemberMetricsFromCache(
  partitionIssues: SquadIssueSnapshot[],
  worklogCacheDocs: SquadIssueWorklogCache[],
  workdays: number,
  getCapacityHoursPerDay: (assigneeId: string) => number
): SquadMemberMetric[] {
  const map = new Map<string, { assigneeId: string; assigneeName: string; issuesInProgress: number; issuesCompleted: number; hoursLogged: number }>();
  const ensure = (id: string, name: string) => {
    if (!id) return null;
    if (!map.has(id)) map.set(id, { assigneeId: id, assigneeName: name || id, issuesInProgress: 0, issuesCompleted: 0, hoursLogged: 0 });
    return map.get(id)!;
  };
  partitionIssues.forEach(s => {
    if (!s.assigneeId) return;
    const m = ensure(s.assigneeId, s.assigneeName)!;
    if (s.statusCategory === 'indeterminate') m.issuesInProgress += 1;
    if (s.statusCategory === 'done') m.issuesCompleted += 1;
  });
  worklogCacheDocs.forEach(w => {
    Object.entries(w.worklogByAuthor || {}).forEach(([wid, hours]) => {
      const m = ensure(wid, w.worklogAuthorNames?.[wid] || wid)!;
      m.hoursLogged += hours;
    });
  });
  const computedAt = new Date().toISOString();
  return Array.from(map.values()).map(m => {
    const capacityHours = getCapacityHoursPerDay(m.assigneeId) * workdays;
    return {
      ...m,
      capacityHours,
      utilizationPct: capacityHours > 0 ? m.hoursLogged / capacityHours : 0,
      computedAt,
    };
  });
}

function extractWorklogByAuthor(issue: JiraIssue): Record<string, number> {
  const acc: Record<string, number> = {};
  (issue.worklogs || []).forEach((wl: any) => {
    const wid = wl?.author?.accountId || wl?.author?.key || wl?.author?.name || '';
    if (!wid) return;
    acc[wid] = (acc[wid] || 0) + (wl?.timeSpentSeconds || 0) / 3600;
  });
  return acc;
}

function extractWorklogAuthorNames(issue: JiraIssue): Record<string, string> {
  const acc: Record<string, string> = {};
  (issue.worklogs || []).forEach((wl: any) => {
    const wid = wl?.author?.accountId || wl?.author?.key || wl?.author?.name || '';
    if (wid) acc[wid] = wl?.author?.displayName || wid;
  });
  return acc;
}

type ParsedSprint = { id: string; name: string; state: string; startDate: string; endDate: string };

// Escolhe a sprint "efetiva" (a que a tela mostra como "atual") entre as
// sprints encontradas no conjunto de issues desta sync — normalmente só uma
// (syncJql tipicamente é `sprint in openSprints()`), mas Jira deixa mais de
// uma sprint com state ACTIVE ao mesmo tempo na prática (ex: uma sprint
// antiga que ninguém clicou "Concluir", quase toda feita, mas tecnicamente
// ainda aberta) — visto ao vivo neste squad. Contagem de issues NÃO serve de
// desempate aqui: a sprint esquecida-mas-aberta pode ter mais issues (quase
// tudo concluído) que a sprint realmente corrente. Data de início mais
// recente é o sinal forte de "é esta a sprint de agora".
function pickEffectiveSprint(sprintMeta: Map<string, ParsedSprint & { count: number }>): string {
  if (sprintMeta.size === 0) return UNMAPPED_SPRINT_ID;
  const active = Array.from(sprintMeta.values()).filter(s => s.state.toUpperCase() === 'ACTIVE');
  const candidates = active.length > 0 ? active : Array.from(sprintMeta.values());
  const byStartDate = candidates.filter(s => s.startDate).sort((a, b) => b.startDate.localeCompare(a.startDate));
  if (byStartDate.length > 0) return byStartDate[0].id;
  const byCount = candidates.sort((a, b) => b.count - a.count);
  return byCount.length > 0 ? byCount[0].id : UNMAPPED_SPRINT_ID;
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
      ...(rankingJustEnabled ? { rankingEnabledAt: new Date().toISOString() } : {}),
      updatedAt: new Date().toISOString(),
    };
    await squadApi.saveSquad(squadId, payload);
    set(state => ({ config: { ...(state.config as SquadConfig), ...payload } }));
  },

  syncSquad: async (uid, squadId, forceFull) => {
    set({ isSyncing: true, syncError: null });
    try {
      if (uid && squadId && squadId !== 'Sem Time') {
        userApi.saveUser({ id: uid, squadId }).catch(() => {});
      }

      // Config do squad: agora vem da API REST
      let config = await squadApi.getSquad(squadId);
      const defaultProjKey = config?.jiraProjectKey && config.jiraProjectKey !== 'MISSI'
        ? config.jiraProjectKey
        : (squadId === 'MISSI' ? 'DDWMISSI' : squadId);

      if (!config || !config.jiraProjectKey || config.jiraProjectKey === 'MISSI') {
        const defaultConfig: SquadConfig = {
          squadId,
          name: squadId,
          jiraProjectKey: defaultProjKey,
          syncJql: `project = "${defaultProjKey}" AND sprint in openSprints()`,
          defaultDailyCapacityHours: 6,
          rankingEnabled: false,
          updatedAt: new Date().toISOString(),
          ...(config || {}),
        };
        defaultConfig.jiraProjectKey = defaultProjKey;
        if (!config?.syncJql || config.syncJql.includes('project = "MISSI"') || config.syncJql.includes('project = MISSI')) {
          defaultConfig.syncJql = `project = "${defaultProjKey}" AND sprint in openSprints()`;
        }
        try {
          config = await squadApi.saveSquad(squadId, defaultConfig);
          set(state => ({ config }));
        } catch (e) {
          config = defaultConfig;
        }
      }

      // Obtém credenciais do Jira (Spring Boot, localStorage ou Firestore)
      const jiraCreds = await getJiraCredentials(uid);
      if (!jiraCreds || !jiraCreds.token) {
        throw new Error('Configure seu Token de Acesso do Jira em Conexão Jira antes de sincronizar.');
      }

      const { domain: personalDomain, token } = jiraCreds;
      const domain = config.jiraDomain || personalDomain;
      const rankingEnabled = !!config.rankingEnabled;
      const sprintFieldConfigured = !!config.sprintFieldId;
      const reconcileIntervalHours = config.reconcileIntervalHours || RECONCILE_INTERVAL_DEFAULT_HOURS;

      const isMigrationSync = !config.schemaVersion;

      const rankingJustEnabled = rankingEnabled && (
        !config.lastFullReconcileAt ||
        (!!config.rankingEnabledAt && Date.parse(config.lastFullReconcileAt) < Date.parse(config.rankingEnabledAt))
      );

      let isFull =
        !!forceFull
        || !sprintFieldConfigured
        || !config.lastSyncAt
        || !config.lastFullReconcileAt
        || !config.activeSprintId
        || (Date.now() - Date.parse(config.lastFullReconcileAt)) > reconcileIntervalHours * 3_600_000
        || config.lastSyncStatus === 'error'
        || rankingJustEnabled;

      const baseFields = rankingEnabled ? SQUAD_SYNC_FIELDS_WITH_WORKLOG : SQUAD_SYNC_FIELDS_BASE;
      const fields = sprintFieldConfigured ? [...baseFields, config.sprintFieldId!] : baseFields;

      const fetchScope = async (jql: string) => fetchAllJiraIssues(domain, token, jql, { fields, sprintFieldId: config.sprintFieldId });

      const deltaJql = isFull ? config.syncJql : `(${config.syncJql}) AND updated >= "${formatForJql(subtractMinutes(config.lastSyncAt!, 2))}"`;
      let { issues } = await fetchScope(deltaJql);

      const syncedAt = new Date().toISOString();

      // --- Mapeia pra snapshots + descobre sprintId por issue ---
      const sprintMeta = new Map<string, ParsedSprint & { count: number }>();
      let snapshots: SquadIssueSnapshot[] = issues.map(issue => {
        const statusCategory = issue.statusCategory || 'unknown';
        const parsed = parseSprintField(issue.sprintRaw);
        if (parsed) {
          const existing = sprintMeta.get(parsed.id);
          sprintMeta.set(parsed.id, { ...parsed, count: (existing?.count || 0) + 1 });
        }
        return {
          key: issue.key,
          jiraKey: issue.key,
          title: issue.title || issue.key,
          type: issue.type,
          isBug: isBugType(issue.type),
          status: issue.status,
          statusCategory,
          estimateSec: issue.timeEstimate || 0,
          remainingSec: issue.timeRemaining || 0,
          loggedSec: issue.timeSpent || 0,
          updatedAtJira: issue.updated || '',
          staleSinceDays: daysSince(issue.updated || ''),
          dueDate: issue.dueDate || '',
          targetStart: issue.targetStart || issue.dueDate || (issue.updated ? issue.updated.substring(0, 10) : ''),
          targetEnd: issue.targetEnd || issue.dueDate || (issue.updated ? issue.updated.substring(0, 10) : ''),
          assigneeId: issue.assigneeId || '',
          assigneeName: issue.assignee || '',
          parentKey: issue.parentKey || '',
          parentTitle: issue.parentTitle || '',
          sprintId: parsed?.id || '',
          sprintName: parsed?.name || '',
          syncedAt,
        };
      });

      const hasAnySprint = sprintMeta.size > 0 || sprintFieldConfigured;

      // Parent-fallback: subtarefas s/ sprint próprio herdam do pai
      if (hasAnySprint) {
        const byKey = new Map(snapshots.map(s => [s.key, s]));
        for (const s of snapshots) {
          if (s.sprintId || !s.parentKey) continue;
          const sibling = byKey.get(s.parentKey);
          if (sibling?.sprintId) {
            s.sprintId = sibling.sprintId;
            s.sprintName = sibling.sprintName;
            continue;
          }
          const parentSnap = await squadApi.getIssueByKey(squadId, s.parentKey);
          if (parentSnap?.sprintId) {
            s.sprintId = parentSnap.sprintId;
            s.sprintName = parentSnap.sprintName;
          }
        }
      }
      if (!hasAnySprint) {
        snapshots = snapshots.map(s => ({ ...s, sprintId: UNMAPPED_SPRINT_ID, sprintName: '' }));
      } else {
        snapshots = snapshots.map(s => s.sprintId ? s : { ...s, sprintId: UNMAPPED_SPRINT_ID });
      }

      // --- Rollover: sprint efetiva mudou? ---
      let effectiveSprintId = hasAnySprint ? pickEffectiveSprint(sprintMeta) : UNMAPPED_SPRINT_ID;
      if (!isFull && config.activeSprintId && effectiveSprintId !== config.activeSprintId && effectiveSprintId !== UNMAPPED_SPRINT_ID) {
        isFull = true;
        const full = await fetchScope(config.syncJql);
        issues = full.issues;
        sprintMeta.clear();
        snapshots = issues.map(issue => {
          const statusCategory = issue.statusCategory || 'unknown';
          const parsed = parseSprintField(issue.sprintRaw);
          if (parsed) {
            const existing = sprintMeta.get(parsed.id);
            sprintMeta.set(parsed.id, { ...parsed, count: (existing?.count || 0) + 1 });
          }
          return {
            key: issue.key, title: issue.title || issue.key, type: issue.type, isBug: isBugType(issue.type), status: issue.status, statusCategory,
            estimateSec: issue.timeEstimate || 0, remainingSec: issue.timeRemaining || 0, loggedSec: issue.timeSpent || 0,
            updatedAtJira: issue.updated || '', staleSinceDays: daysSince(issue.updated || ''), dueDate: issue.dueDate || '',
            targetStart: issue.targetStart || issue.dueDate || (issue.updated ? issue.updated.substring(0, 10) : ''),
            targetEnd: issue.targetEnd || issue.dueDate || (issue.updated ? issue.updated.substring(0, 10) : ''),
            assigneeId: issue.assigneeId || '', assigneeName: issue.assignee || '',
            parentKey: issue.parentKey || '', parentTitle: issue.parentTitle || '',
            sprintId: parsed?.id || UNMAPPED_SPRINT_ID, sprintName: parsed?.name || '',
            syncedAt,
          };
        });
        effectiveSprintId = pickEffectiveSprint(sprintMeta);
      }

      // Roster: busca atual + auto-semeia novos assignees vistos neste lote
      const existingMembers = await squadApi.getMembers(squadId);
      const rosterMap = new Map<string, SquadMember>(existingMembers.map(m => [m.jiraAccountId, m]));
      const defaultCapacity = config.defaultDailyCapacityHours || 6;
      const getCapacityHoursPerDay = (assigneeId: string) => rosterMap.get(assigneeId)?.capacityHoursPerDay || defaultCapacity;

      const seenAssignees = new Map<string, string>();
      snapshots.forEach(s => { if (s.assigneeId) seenAssignees.set(s.assigneeId, s.assigneeName); });
      const rosterSeeds: SquadMember[] = [];
      seenAssignees.forEach((name, id) => {
        if (!rosterMap.has(id)) {
          const seed: SquadMember = { dbId: `${squadId}_${id}`, squadId, jiraAccountId: id, displayName: name || id, capacityHoursPerDay: defaultCapacity, updatedAt: syncedAt };
          rosterMap.set(id, seed);
          rosterSeeds.push(seed);
        }
      });
      if (rosterSeeds.length > 0) {
        for (const group of chunk(rosterSeeds, BATCH_CHUNK_SIZE)) {
          await squadApi.batchUpsertMembers(squadId, group);
        }
      }

      // Reconciliação de migração: roda UMA VEZ contra a coleção inteira
      if (isMigrationSync) {
        const allExisting = await squadApi.getIssues(squadId);
        const allNewKeys = new Set(snapshots.map(s => s.key));
        if (snapshots.length === 0 && allExisting.length > 0) {
          throw new Error(`A sincronização voltou com 0 issues, mas havia ${allExisting.length} antes. Verifique a JQL — nada foi apagado.`);
        }
        const migrationToDelete = allExisting.filter(s => !allNewKeys.has(s.key)).map(s => s.key);
        if (allExisting.length > 5 && migrationToDelete.length > allExisting.length * 0.9) {
          throw new Error(`A sincronização ia apagar ${migrationToDelete.length} de ${allExisting.length} issues de uma vez — abortado por segurança. Confira a JQL.`);
        }
        for (const group of chunk(migrationToDelete, BATCH_CHUNK_SIZE)) {
          await squadApi.batchDeleteIssues(squadId, group);
        }
      }

      const groups = groupBy(snapshots, s => s.sprintId);
      const updatedSprintHistory: SquadSprintHistoryEntry[] = [...(config.sprintHistory || [])];
      let totalIssueCountForActiveSprint = 0;
      let rollupForActiveSprint: SquadMetricsRollup | null = null;
      let memberMetricsForActiveSprint: SquadMemberMetric[] = [];

      for (const [sprintId, groupSnapshots] of Array.from(groups.entries())) {
        let mergedSnapshots: SquadIssueSnapshot[];
        let keysToDelete: string[] = [];

        if (isMigrationSync) {
          mergedSnapshots = groupSnapshots;
        } else if (isFull) {
          const existingPartition = await squadApi.getIssues(squadId, sprintId);
          if (groupSnapshots.length === 0 && existingPartition.length > 0) {
            throw new Error(`A sincronização da sprint ${sprintId} voltou com 0 issues, mas havia ${existingPartition.length} antes. Verifique a JQL — nada foi apagado.`);
          }
          const newKeys = new Set(groupSnapshots.map(s => s.key));
          keysToDelete = existingPartition.filter(s => !newKeys.has(s.key)).map(s => s.key);
          if (existingPartition.length > 5 && keysToDelete.length > existingPartition.length * 0.9) {
            throw new Error(`A sincronização ia apagar ${keysToDelete.length} de ${existingPartition.length} issues da sprint ${sprintId} — abortado por segurança. Confira a JQL.`);
          }
          mergedSnapshots = groupSnapshots;
        } else {
          const existingPartition = await squadApi.getIssues(squadId, sprintId);
          const existingByKey = new Map<string, SquadIssueSnapshot>(existingPartition.map(s => [s.key, s]));
          groupSnapshots.forEach(s => existingByKey.set(s.key, s));
          mergedSnapshots = Array.from(existingByKey.values());
        }

        for (const group of chunk(groupSnapshots, BATCH_CHUNK_SIZE)) {
          await squadApi.batchUpsertIssues(squadId, group);
        }
        if (keysToDelete.length > 0) {
          for (const group of chunk(keysToDelete, BATCH_CHUNK_SIZE)) {
            await squadApi.batchDeleteIssues(squadId, group);
          }
        }

        // --- issueWorklogCache ---
        const groupRawIssues = issues.filter(i => groupSnapshots.some(s => s.key === i.key));
        let mergedWorklogCache: SquadIssueWorklogCache[] = [];
        if (rankingEnabled) {
          const existingWorklogCache = await squadApi.getWorklogCache(squadId, isMigrationSync ? undefined : sprintId);
          const worklogEntries: SquadIssueWorklogCache[] = groupRawIssues.map(issue => ({
            key: issue.key,
            jiraKey: issue.key,
            sprintId,
            worklogByAuthor: extractWorklogByAuthor(issue) as any,
            worklogAuthorNames: extractWorklogAuthorNames(issue) as any,
            updatedAtJira: issue.updated || '',
            syncedAt,
          }));
          for (const group of chunk(worklogEntries, BATCH_CHUNK_SIZE)) {
            await squadApi.batchUpsertWorklogCache(squadId, group);
          }
          if (isFull) {
            for (const key of keysToDelete) {
              await squadApi.deleteWorklogCacheEntry(squadId, key);
            }
          }
          const existingByKey = new Map<string, SquadIssueWorklogCache>(existingWorklogCache.map(w => [w.key, w]));
          worklogEntries.forEach(w => existingByKey.set(w.key, w));
          mergedWorklogCache = Array.from(existingByKey.values());
        }

        // --- rollup desta partição ---
        const totalIssues = mergedSnapshots.length;
        const doneIssues = mergedSnapshots.filter(s => s.statusCategory === 'done').length;
        const inProgressIssues = mergedSnapshots.filter(s => s.statusCategory === 'indeterminate').length;
        const bugIssues = mergedSnapshots.filter(s => s.isBug).length;
        const staleIssues = mergedSnapshots.filter(s => s.statusCategory !== 'done' && s.staleSinceDays > STALE_THRESHOLD_DAYS).length;
        const estimateTotalSec = mergedSnapshots.reduce((sum, s) => sum + s.estimateSec, 0);
        const loggedTotalSec = mergedSnapshots.reduce((sum, s) => sum + s.loggedSec, 0);
        const remainingTotalSec = mergedSnapshots.reduce((sum, s) => sum + s.remainingSec, 0);
        const byType: Record<string, number> = {};
        mergedSnapshots.forEach(s => { byType[s.type] = (byType[s.type] || 0) + 1; });
        const byStatus: Record<string, number> = {};
        mergedSnapshots.forEach(s => { byStatus[s.status] = (byStatus[s.status] || 0) + 1; });
        const openWithDueDate = mergedSnapshots.filter(s => s.statusCategory !== 'done' && s.dueDate);
        const overdueIssues = openWithDueDate.filter(s => daysUntil(s.dueDate) < 0).length;
        const dueSoonIssues = openWithDueDate.filter(s => { const d = daysUntil(s.dueDate); return d >= 0 && d <= DUE_SOON_THRESHOLD_DAYS; }).length;

        const meta = sprintMeta.get(sprintId);
        const sprintWorkdays = meta ? countWorkdays(meta.startDate, meta.endDate) : 0;

        const rollupForGroup: SquadMetricsRollup = {
          squadId,
          sprintId,
          computedAt: syncedAt,
          totalIssues, doneIssues, inProgressIssues, bugIssues, staleIssues,
          overdueIssues, dueSoonIssues,
          estimateTotalSec, loggedTotalSec, remainingTotalSec,
          ...(meta && sprintWorkdays > 0 ? { sprintName: meta.name, workdaysTotal: sprintWorkdays } : {}),
          extraMetrics: {
            byType, byStatus,
            ...(meta && sprintWorkdays > 0 ? { activeSprintStart: meta.startDate, activeSprintEnd: meta.endDate } : {}),
          },
        };

        await squadApi.saveRollup(squadId, rollupForGroup);

        if (sprintId === effectiveSprintId) {
          rollupForActiveSprint = rollupForGroup;
          totalIssueCountForActiveSprint = totalIssues;
          if (rankingEnabled) {
            const workdays = sprintWorkdays || SPRINT_WORKDAYS_ASSUMED;
            memberMetricsForActiveSprint = isFull
              ? computeMemberMetrics(groupRawIssues, true, workdays, getCapacityHoursPerDay)
              : computeMemberMetricsFromCache(mergedSnapshots, mergedWorklogCache, workdays, getCapacityHoursPerDay);
          }
        }

        const historyIdx = updatedSprintHistory.findIndex(h => h.sprintId === sprintId);
        const historyEntry: SquadSprintHistoryEntry = {
          sprintId, sprintName: meta?.name || (historyIdx >= 0 ? updatedSprintHistory[historyIdx].sprintName : ''),
          sprintStart: meta?.startDate || (historyIdx >= 0 ? updatedSprintHistory[historyIdx].sprintStart : ''),
          sprintEnd: meta?.endDate || (historyIdx >= 0 ? updatedSprintHistory[historyIdx].sprintEnd : ''),
          sprintWorkdays, state: 'active', lastSyncedAt: syncedAt,
        };
        if (historyIdx >= 0) updatedSprintHistory[historyIdx] = { ...updatedSprintHistory[historyIdx], ...historyEntry };
        else updatedSprintHistory.push(historyEntry);
      }

      // Congela sprint anterior se houve troca nesta sync FULL — o estado
      // "encerrada" vive só em sprintHistory (SquadMetricsRollup não tem
      // coluna state/closedAt na entity Postgres).
      if (isFull && config.activeSprintId && config.activeSprintId !== effectiveSprintId && config.activeSprintId !== UNMAPPED_SPRINT_ID) {
        const idx = updatedSprintHistory.findIndex(h => h.sprintId === config.activeSprintId);
        if (idx >= 0) updatedSprintHistory[idx] = { ...updatedSprintHistory[idx], state: 'closed', closedAt: syncedAt };
      }

      // memberMetrics: upsert completo (replace)
      await squadApi.batchUpsertMemberMetrics(squadId, rankingEnabled ? memberMetricsForActiveSprint : []);

      // Daily snapshot
      if (rollupForActiveSprint) {
        const dailySnapshot: SquadDailySnapshot = {
          squadId,
          snapshotDate: todayStr(),
          totalIssues: rollupForActiveSprint.totalIssues,
          doneIssues: rollupForActiveSprint.doneIssues,
          inProgressIssues: rollupForActiveSprint.inProgressIssues,
          bugIssues: rollupForActiveSprint.bugIssues,
          staleIssues: rollupForActiveSprint.staleIssues,
          loggedSec: rollupForActiveSprint.loggedTotalSec,
          syncedAt,
        };
        await squadApi.batchUpsertDailySnapshots(squadId, [dailySnapshot]);
      }

      // Atualiza config do squad
      await squadApi.saveSquad(squadId, {
        lastSyncAt: syncedAt, lastSyncBy: uid, lastSyncStatus: 'success',
        lastSyncIssueCount: totalIssueCountForActiveSprint, lastSyncError: '',
        activeSprintId: effectiveSprintId,
        lastFullReconcileAt: isFull ? syncedAt : (config.lastFullReconcileAt || syncedAt),
        schemaVersion: 2, sprintHistory: updatedSprintHistory,
      });

      set(state => ({
        rollup: rollupForActiveSprint,
        memberMetrics: rankingEnabled ? memberMetricsForActiveSprint.sort((a, b) => (b.hoursLogged || 0) - (a.hoursLogged || 0)) : [],
        config: state.config ? {
          ...state.config, lastSyncAt: syncedAt, lastSyncStatus: 'success',
          lastSyncIssueCount: totalIssueCountForActiveSprint, activeSprintId: effectiveSprintId,
          lastFullReconcileAt: isFull ? syncedAt : (state.config.lastFullReconcileAt || syncedAt),
          schemaVersion: 2, sprintHistory: updatedSprintHistory,
        } : state.config,
      }));
    } catch (err: any) {
      const message = err?.message || 'Erro ao sincronizar com o Jira.';
      set({ syncError: message });
      try {
        await squadApi.saveSquad(squadId, { lastSyncStatus: 'error', lastSyncError: message });
      } catch {
        // se nem isso gravar, o erro em tela já basta
      }
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

  // Escape hatch pra sprint ENCERRADA — reescreve só aquela partição, nunca
  // toca em config.activeSprintId. Leadership-only.
  forceResyncSprint: async (uid, squadId, targetSprintId) => {
    set({ isForceResyncingSprint: true });
    try {
      const config = await squadApi.getSquad(squadId);
      if (!config) throw new Error('Squad sem configuração.');

      // Obtém credenciais do Jira (Spring Boot, localStorage ou Firestore)
      const jiraCreds = await getJiraCredentials(uid);
      if (!jiraCreds || !jiraCreds.token) throw new Error('Configure seu Token de Acesso do Jira antes.');

      const { domain: personalDomain, token } = jiraCreds;
      const domain = config.jiraDomain || personalDomain;
      const rankingEnabled = !!config.rankingEnabled;
      const baseFields = rankingEnabled ? SQUAD_SYNC_FIELDS_WITH_WORKLOG : SQUAD_SYNC_FIELDS_BASE;
      const fields = config.sprintFieldId ? [...baseFields, config.sprintFieldId] : baseFields;

      const targetJql = /sprint\s+in\s+openSprints\(\)/i.test(config.syncJql)
        ? config.syncJql.replace(/sprint\s+in\s+openSprints\(\)/i, `sprint = ${targetSprintId}`)
        : `project = ${config.jiraProjectKey} AND sprint = ${targetSprintId}`;

      const { issues } = await fetchAllJiraIssues(domain, token, targetJql, { fields, sprintFieldId: config.sprintFieldId });
      const syncedAt = new Date().toISOString();

      const snapshots: SquadIssueSnapshot[] = issues.map(issue => ({
        key: issue.key, type: issue.type, isBug: isBugType(issue.type), status: issue.status,
        statusCategory: issue.statusCategory || 'unknown',
        estimateSec: issue.timeEstimate || 0, remainingSec: issue.timeRemaining || 0, loggedSec: issue.timeSpent || 0,
        updatedAtJira: issue.updated || '', staleSinceDays: daysSince(issue.updated || ''), dueDate: issue.dueDate || '',
        targetStart: issue.targetStart || issue.dueDate || (issue.updated ? issue.updated.substring(0, 10) : ''),
        targetEnd: issue.targetEnd || issue.dueDate || (issue.updated ? issue.updated.substring(0, 10) : ''),
        assigneeId: issue.assigneeId || '', assigneeName: issue.assignee || '',
        parentKey: issue.parentKey || '', parentTitle: issue.parentTitle || '',
        sprintId: targetSprintId, sprintName: '', syncedAt,
      }));

      const existingPartition = await squadApi.getIssues(squadId, targetSprintId);
      const newKeys = new Set(snapshots.map(s => s.key));
      const keysToDelete = existingPartition.filter(s => !newKeys.has(s.key)).map(s => s.key);

      for (const group of chunk(snapshots, BATCH_CHUNK_SIZE)) {
        await squadApi.batchUpsertIssues(squadId, group);
      }
      if (keysToDelete.length > 0) {
        for (const group of chunk(keysToDelete, BATCH_CHUNK_SIZE)) {
          await squadApi.batchDeleteIssues(squadId, group);
        }
      }

      if (rankingEnabled) {
        const worklogEntries: SquadIssueWorklogCache[] = issues.map(issue => ({
          key: issue.key, sprintId: targetSprintId,
          worklogByAuthor: extractWorklogByAuthor(issue) as any,
          worklogAuthorNames: extractWorklogAuthorNames(issue) as any,
          updatedAtJira: issue.updated || '', syncedAt,
        }));
        for (const group of chunk(worklogEntries, BATCH_CHUNK_SIZE)) {
          await squadApi.batchUpsertWorklogCache(squadId, group);
        }
      }

      const totalIssues = snapshots.length;
      const doneIssues = snapshots.filter(s => s.statusCategory === 'done').length;
      const inProgressIssues = snapshots.filter(s => s.statusCategory === 'indeterminate').length;
      const bugIssues = snapshots.filter(s => s.isBug).length;
      const staleIssues = snapshots.filter(s => s.statusCategory !== 'done' && s.staleSinceDays > STALE_THRESHOLD_DAYS).length;
      const byType: Record<string, number> = {};
      snapshots.forEach(s => { byType[s.type] = (byType[s.type] || 0) + 1; });
      const byStatus: Record<string, number> = {};
      snapshots.forEach(s => { byStatus[s.status] = (byStatus[s.status] || 0) + 1; });
      const openWithDueDate = snapshots.filter(s => s.statusCategory !== 'done' && s.dueDate);
      const rollupForSprint: SquadMetricsRollup = {
        squadId,
        sprintId: targetSprintId,
        computedAt: syncedAt,
        totalIssues, doneIssues, inProgressIssues, bugIssues, staleIssues,
        estimateTotalSec: snapshots.reduce((sum, s) => sum + s.estimateSec, 0),
        loggedTotalSec: snapshots.reduce((sum, s) => sum + s.loggedSec, 0),
        remainingTotalSec: snapshots.reduce((sum, s) => sum + s.remainingSec, 0),
        overdueIssues: openWithDueDate.filter(s => daysUntil(s.dueDate) < 0).length,
        dueSoonIssues: openWithDueDate.filter(s => { const d = daysUntil(s.dueDate); return d >= 0 && d <= DUE_SOON_THRESHOLD_DAYS; }).length,
        extraMetrics: { byType, byStatus },
      };
      await squadApi.saveRollup(squadId, rollupForSprint);

      const sprintHistory = [...(config.sprintHistory || [])];
      const idx = sprintHistory.findIndex(h => h.sprintId === targetSprintId);
      if (idx >= 0) sprintHistory[idx] = { ...sprintHistory[idx], lastSyncedAt: syncedAt };
      await squadApi.saveSquad(squadId, { sprintHistory });

      if (get().viewingSprintId === targetSprintId) {
        set({ viewedRollup: rollupForSprint, viewedIssuesSnapshot: snapshots });
      }
      set(state => ({ config: state.config ? { ...state.config, sprintHistory } : state.config }));
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
