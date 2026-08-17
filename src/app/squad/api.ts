import type {
  SquadConfig, SquadMetricsRollup, SquadIssueSnapshot, SquadMember,
  SquadMemberMetric, SquadDailySnapshot, SquadIssueWorklogCache
} from '@/lib/types';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8002/api';

async function req<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE_URL}${url}`, {
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
    return req<SquadConfig>(`/squads/${squadId}`, { method: 'POST', body: JSON.stringify({ ...data, id: squadId }) });
  },

  // ----- Metrics Rollup -----
  async getRollup(squadId: string): Promise<SquadMetricsRollup | null> {
    try { return await req<SquadMetricsRollup>(`/squads/${squadId}/rollup`); }
    catch (e: any) { if (e.message?.includes('404')) return null; throw e; }
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
    catch (e: any) { if (e.message?.includes('404')) return null; throw e; }
  },

  async batchUpsertIssues(squadId: string, snapshots: SquadIssueSnapshot[]): Promise<SquadIssueSnapshot[]> {
    return req<SquadIssueSnapshot[]>(`/squads/${squadId}/issues/batch`, { method: 'POST', body: JSON.stringify(snapshots) });
  },

  async batchDeleteIssues(squadId: string, keys: string[]): Promise<void> {
    return req<void>(`/squads/${squadId}/issues/batch`, { method: 'DELETE', body: JSON.stringify(keys) });
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
    return req<SquadMember[]>(`/squads/${squadId}/members/batch`, { method: 'POST', body: JSON.stringify(members) });
  },

  // ----- Member Metrics -----
  async getMemberMetrics(squadId: string): Promise<SquadMemberMetric[]> {
    return req<SquadMemberMetric[]>(`/squads/${squadId}/member-metrics`);
  },

  async batchUpsertMemberMetrics(squadId: string, metrics: SquadMemberMetric[]): Promise<SquadMemberMetric[]> {
    return req<SquadMemberMetric[]>(`/squads/${squadId}/member-metrics/batch`, { method: 'POST', body: JSON.stringify(metrics) });
  },

  // ----- Daily Snapshots -----
  async getDailySnapshots(squadId: string, since?: string): Promise<SquadDailySnapshot[]> {
    const qs = since ? `?since=${encodeURIComponent(since)}` : '';
    return req<SquadDailySnapshot[]>(`/squads/${squadId}/daily-snapshots${qs}`);
  },

  async batchUpsertDailySnapshots(squadId: string, snapshots: SquadDailySnapshot[]): Promise<SquadDailySnapshot[]> {
    return req<SquadDailySnapshot[]>(`/squads/${squadId}/daily-snapshots/batch`, { method: 'POST', body: JSON.stringify(snapshots) });
  },

  // ----- Worklog Cache -----
  async getWorklogCache(squadId: string, sprintId?: string): Promise<SquadIssueWorklogCache[]> {
    const qs = sprintId ? `?sprintId=${encodeURIComponent(sprintId)}` : '';
    return req<SquadIssueWorklogCache[]>(`/squads/${squadId}/worklog-cache${qs}`);
  },

  async batchUpsertWorklogCache(squadId: string, entries: SquadIssueWorklogCache[]): Promise<SquadIssueWorklogCache[]> {
    return req<SquadIssueWorklogCache[]>(`/squads/${squadId}/worklog-cache/batch`, { method: 'POST', body: JSON.stringify(entries) });
  },

  async deleteWorklogCacheEntry(squadId: string, jiraKey: string): Promise<void> {
    return req<void>(`/squads/${squadId}/worklog-cache/${encodeURIComponent(jiraKey)}`, { method: 'DELETE' });
  },
};
