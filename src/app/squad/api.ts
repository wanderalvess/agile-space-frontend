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
    const formatted = snapshots.map(s => {
      const issueKey = s.jiraKey || s.key || (s as any).jira_key || '';
      return {
        ...s,
        jiraKey: issueKey,
        key: issueKey,
        dbId: `${squadId}_${issueKey}`,
        squadId,
      };
    });
    return req<SquadIssueSnapshot[]>(`/squads/${squadId}/issues/batch`, { method: 'POST', body: JSON.stringify(formatted) });
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
    const formatted = entries.map(e => {
      const issueKey = e.jiraKey || (e as any).key || (e as any).jira_key || '';
      return {
        ...e,
        jiraKey: issueKey,
        key: issueKey,
        dbId: `${squadId}_${issueKey}`,
        squadId,
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
