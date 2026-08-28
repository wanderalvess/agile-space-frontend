import type {
  SquadConfig, SquadMetricsRollup, SquadIssueSnapshot, SquadMember,
  SquadMemberMetric, SquadDailySnapshot, SquadIssueWorklogCache
} from '@/lib/types';
import { authFetch } from '@/lib/auth-client';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8002/api';

// Raw backend shape for /api/squads/{squadId}/panels — deliberately NOT the
// rich `SquadPanel` type from '@/lib/types' (that one models the UI's JQL
// panel domain: chartType/groupBy/aggregateMetric/resultRows/etc). The
// backend entity only knows name/type/config(opaque TEXT)/visibility; the
// store is responsible for packing/unpacking the richer shape into `config`.
export interface SquadPanelRecord {
  id: string;
  squadId: string;
  ownerId: string;
  name: string;
  type: string;
  config: string;
  visibility: 'PRIVATE' | 'SQUAD';
  createdAt: string;
  updatedAt: string;
}

export type SquadPanelWritableFields = Pick<SquadPanelRecord, 'name' | 'type' | 'config' | 'visibility'>;

async function req<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await authFetch(`${API_BASE_URL}${url}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  if (!res.ok) throw new Error(`Squad API error ${res.status}: ${await res.text()}`);
  if (res.status === 204) return undefined as T;
  return res.json();
}

export const squadApi = {
  // ----- Squad Config -----
  async getSquad(squadId: string): Promise<SquadConfig | null> {
    try { return await req<SquadConfig>(`/squads/${squadId}`); }
    catch (e: any) { if (e.message?.includes('404')) return null; throw e; }
  },

  async saveSquad(squadId: string, data: Partial<SquadConfig>): Promise<SquadConfig> {
    return req<SquadConfig>(`/squads/${squadId}`, {
      method: 'POST',
      body: JSON.stringify({
        ...data,
        id: squadId,
        name: data.name || (data as any)?.squadName || squadId
      })
    });
  },

  // ----- Metrics Rollup -----
  async getRollup(squadId: string): Promise<SquadMetricsRollup | null> {
    try { return await req<SquadMetricsRollup>(`/squads/${squadId}/rollup`); }
    catch (e: any) { if (e.status === 404 || e.message?.includes('404')) return null; throw e; }
  },

  async saveRollup(squadId: string, rollup: SquadMetricsRollup): Promise<SquadMetricsRollup> {
    return req<SquadMetricsRollup>(`/squads/${squadId}/rollup`, { method: 'POST', body: JSON.stringify({ ...rollup, squadId }) });
  },

  // ----- Issue Snapshots -----
  async getIssues(squadId: string, sprintId?: string): Promise<SquadIssueSnapshot[]> {
    const qs = sprintId ? `?sprintId=${encodeURIComponent(sprintId)}` : '';
    return req<SquadIssueSnapshot[]>(`/squads/${squadId}/issues${qs}`);
  },

  async getIssuesByAssignee(squadId: string, assigneeId: string): Promise<SquadIssueSnapshot[]> {
    return req<SquadIssueSnapshot[]>(`/squads/${squadId}/issues/by-assignee?assigneeId=${encodeURIComponent(assigneeId)}`);
  },

  async getIssueByKey(squadId: string, jiraKey: string): Promise<SquadIssueSnapshot | null> {
    try { return await req<SquadIssueSnapshot>(`/squads/${squadId}/issues/${encodeURIComponent(jiraKey)}`); }
    catch (e: any) { if (e.status === 404 || e.message?.includes('404')) return null; throw e; }
  },

  async batchUpsertIssues(squadId: string, snapshots: SquadIssueSnapshot[]): Promise<SquadIssueSnapshot[]> {
    const toStr = (v: any): string => {
      if (!v) return '';
      if (typeof v === 'string') return v;
      if (typeof v === 'number') return String(v);
      if (typeof v === 'object') {
        if (typeof v.value === 'string') return v.value;
        if (typeof v.name === 'string') return v.name;
        if (typeof v.key === 'string') return v.key;
        if (typeof v.id === 'string' || typeof v.id === 'number') return String(v.id);
        return '';
      }
      return '';
    };
    const toNum = (v: any): number => (typeof v === 'number' && !isNaN(v) ? v : (typeof v === 'string' && !isNaN(Number(v)) ? Number(v) : 0));
    const toBool = (v: any): boolean => Boolean(v);

    const formatted = snapshots.map(s => {
      const issueKey = toStr(s.jiraKey || s.key || (s as any).jira_key);
      return {
        dbId: `${squadId}_${issueKey}`,
        squadId,
        jiraKey: issueKey,
        key: issueKey,
        type: toStr(s.type),
        isBug: toBool(s.isBug),
        status: toStr(s.status),
        statusCategory: toStr(s.statusCategory) || 'unknown',
        sprintId: toStr(s.sprintId),
        sprintName: toStr(s.sprintName),
        assigneeId: toStr(s.assigneeId),
        assigneeName: toStr(s.assigneeName),
        estimateSec: toNum(s.estimateSec),
        remainingSec: toNum(s.remainingSec),
        loggedSec: toNum(s.loggedSec),
        staleSinceDays: toNum(s.staleSinceDays),
        dueDate: toStr(s.dueDate),
        targetStart: toStr(s.targetStart),
        targetEnd: toStr(s.targetEnd),
        parentKey: toStr(s.parentKey),
        parentTitle: toStr(s.parentTitle),
        updatedAtJira: toStr(s.updatedAtJira),
        syncedAt: toStr(s.syncedAt),
      };
    });
    return req<SquadIssueSnapshot[]>(`/squads/${squadId}/issues/batch`, { method: 'POST', body: JSON.stringify(formatted) });
  },

  async batchDeleteIssues(squadId: string, keys: (string | { key?: string })[]): Promise<void> {
    const safeKeys = keys.map(k => (typeof k === 'string' ? k : (k && typeof k === 'object' && 'key' in k ? String(k.key) : ''))).filter(Boolean);
    return req<void>(`/squads/${squadId}/issues/batch`, { method: 'DELETE', body: JSON.stringify(safeKeys) });
  },

  // ----- Members -----
  async getMembers(squadId: string): Promise<SquadMember[]> {
    return req<SquadMember[]>(`/squads/${squadId}/members`);
  },

  async saveMember(squadId: string, jiraAccountId: string, data: Partial<SquadMember>): Promise<SquadMember> {
    return req<SquadMember>(`/squads/${squadId}/members/${encodeURIComponent(jiraAccountId)}`, {
      method: 'POST',
      body: JSON.stringify({ ...data, squadId, jiraAccountId }),
    });
  },

  async batchUpsertMembers(squadId: string, members: SquadMember[]): Promise<SquadMember[]> {
    const toStr = (v: any): string => (typeof v === 'string' ? v : (v != null && typeof v !== 'object' ? String(v) : ''));
    const toNum = (v: any): number => (typeof v === 'number' && !isNaN(v) ? v : (typeof v === 'string' && !isNaN(Number(v)) ? Number(v) : 0));

    const formatted = members.map(m => {
      const accountId = toStr(m.jiraAccountId);
      return {
        dbId: `${squadId}_${accountId}`,
        squadId,
        jiraAccountId: accountId,
        displayName: toStr(m.displayName) || accountId,
        email: toStr(m.email) || null,
        role: toStr(m.role) || null,
        capacityHoursPerDay: toNum(m.capacityHoursPerDay) || null,
        systemCalculatedCapacityHoursPerDay: toNum(m.systemCalculatedCapacityHoursPerDay) || null,
        calibrationNotes: toStr(m.calibrationNotes) || null,
        overrideType: toStr(m.overrideType) || null,
        claimedByUid: toStr(m.claimedByUid) || null,
        updatedAt: toStr(m.updatedAt) || new Date().toISOString(),
      };
    });
    return req<SquadMember[]>(`/squads/${squadId}/members/batch`, { method: 'POST', body: JSON.stringify(formatted) });
  },

  // ----- Member Metrics -----
  async getMemberMetrics(squadId: string): Promise<SquadMemberMetric[]> {
    return req<SquadMemberMetric[]>(`/squads/${squadId}/member-metrics`);
  },

  async batchUpsertMemberMetrics(squadId: string, metrics: SquadMemberMetric[]): Promise<SquadMemberMetric[]> {
    const toStr = (v: any): string => (typeof v === 'string' ? v : (v != null && typeof v !== 'object' ? String(v) : ''));
    const toNum = (v: any): number => (typeof v === 'number' && !isNaN(v) ? v : (typeof v === 'string' && !isNaN(Number(v)) ? Number(v) : 0));

    const formatted = metrics.map(m => {
      const aid = toStr(m.assigneeId);
      return {
        dbId: `${squadId}_${aid}`,
        squadId,
        assigneeId: aid,
        assigneeName: toStr(m.assigneeName) || aid,
        issuesInProgress: toNum(m.issuesInProgress),
        issuesCompleted: toNum(m.issuesCompleted),
        hoursLogged: toNum(m.hoursLogged),
        capacityHours: toNum(m.capacityHours),
        utilizationPct: toNum(m.utilizationPct),
        computedAt: toStr(m.computedAt) || new Date().toISOString(),
      };
    });
    return req<SquadMemberMetric[]>(`/squads/${squadId}/member-metrics/batch`, { method: 'POST', body: JSON.stringify(formatted) });
  },

  // ----- Daily Snapshots -----
  async getDailySnapshots(squadId: string, since?: string): Promise<SquadDailySnapshot[]> {
    const qs = since ? `?since=${encodeURIComponent(since)}` : '';
    return req<SquadDailySnapshot[]>(`/squads/${squadId}/daily-snapshots${qs}`);
  },

  async batchUpsertDailySnapshots(squadId: string, snapshots: SquadDailySnapshot[]): Promise<SquadDailySnapshot[]> {
    const toStr = (v: any): string => (typeof v === 'string' ? v : (v != null && typeof v !== 'object' ? String(v) : ''));
    const toNum = (v: any): number => (typeof v === 'number' && !isNaN(v) ? v : (typeof v === 'string' && !isNaN(Number(v)) ? Number(v) : 0));

    const formatted = snapshots.map(s => {
      const dateStr = toStr(s.snapshotDate);
      return {
        dbId: `${squadId}_${dateStr}`,
        squadId,
        snapshotDate: dateStr,
        doneIssues: toNum(s.doneIssues),
        inProgressIssues: toNum(s.inProgressIssues),
        totalIssues: toNum(s.totalIssues),
        bugIssues: toNum(s.bugIssues),
        staleIssues: toNum(s.staleIssues),
        loggedSec: toNum(s.loggedSec),
        syncedAt: toStr(s.syncedAt),
      };
    });
    return req<SquadDailySnapshot[]>(`/squads/${squadId}/daily-snapshots/batch`, { method: 'POST', body: JSON.stringify(formatted) });
  },

  // ----- Worklog Cache -----
  async getWorklogCache(squadId: string, sprintId?: string): Promise<SquadIssueWorklogCache[]> {
    const qs = sprintId ? `?sprintId=${encodeURIComponent(sprintId)}` : '';
    return req<SquadIssueWorklogCache[]>(`/squads/${squadId}/worklog-cache${qs}`);
  },

  async batchUpsertWorklogCache(squadId: string, entries: SquadIssueWorklogCache[]): Promise<SquadIssueWorklogCache[]> {
    const toStr = (v: any): string => (typeof v === 'string' ? v : (v != null && typeof v !== 'object' ? String(v) : ''));

    const formatted = entries.map(e => {
      const issueKey = toStr(e.jiraKey || (e as any).key || (e as any).jira_key);
      return {
        dbId: `${squadId}_${issueKey}`,
        squadId,
        jiraKey: issueKey,
        key: issueKey,
        sprintId: toStr(e.sprintId),
        updatedAtJira: toStr(e.updatedAtJira),
        syncedAt: toStr(e.syncedAt),
        worklogByAuthor: e.worklogByAuthor || {},
        worklogAuthorNames: e.worklogAuthorNames || {},
      };
    });
    return req<SquadIssueWorklogCache[]>(`/squads/${squadId}/worklog-cache/batch`, { method: 'POST', body: JSON.stringify(formatted) });
  },

  async deleteWorklogCacheEntry(squadId: string, jiraKey: string): Promise<void> {
    return req<void>(`/squads/${squadId}/worklog-cache/${encodeURIComponent(jiraKey)}`, { method: 'DELETE' });
  },

  // ----- Panels (ad-hoc JQL dashboard widgets) -----
  // Shape mirrors the backend entity 1:1 — `config` is an opaque TEXT/JSON
  // blob the caller owns (see useSquadPanelsStore for the rich domain shape
  // it packs in/out of that string). `ownerId` is never sent on create; the
  // backend stamps it from the JWT.
  async listPanels(squadId: string): Promise<SquadPanelRecord[]> {
    return req<SquadPanelRecord[]>(`/squads/${squadId}/panels`);
  },

  async createPanel(squadId: string, data: SquadPanelWritableFields): Promise<SquadPanelRecord> {
    return req<SquadPanelRecord>(`/squads/${squadId}/panels`, { method: 'POST', body: JSON.stringify(data) });
  },

  async updatePanel(squadId: string, panelId: string, data: Partial<SquadPanelWritableFields>): Promise<SquadPanelRecord> {
    return req<SquadPanelRecord>(`/squads/${squadId}/panels/${panelId}`, { method: 'PUT', body: JSON.stringify(data) });
  },

  async deletePanel(squadId: string, panelId: string): Promise<void> {
    return req<void>(`/squads/${squadId}/panels/${panelId}`, { method: 'DELETE' });
  },
};
