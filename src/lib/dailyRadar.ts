import type { SquadIssueSnapshot } from '@/lib/types';

/**
 * Radar automático da sprint pra pauta da daily — heurística pura em cima do
 * snapshot já sincronizado do squad (SquadIssueSnapshot), sem chamada nova ao
 * Jira e sem IA. Ver plano "Radar Proativo da Sprint".
 */

export const STALE_DAYS_THRESHOLD = 2;
export const DUE_SOON_DAYS = 2;

export interface RadarItem {
  key: string;
  title: string;
  assigneeName: string;
  detail: string;
  overdue?: boolean;
}

export interface DailyRadar {
  completedRecently: RadarItem[];
  stale: RadarItem[];
  dueSoon: RadarItem[];
}

/** Último dia útil antes de referenceDate — pula fim de semana na volta de segunda. */
function lastBusinessDay(referenceDate: Date): Date {
  const day = referenceDate.getDay(); // 0 = domingo, 1 = segunda
  const daysBack = day === 1 ? 3 : day === 0 ? 2 : 1;
  const result = new Date(referenceDate);
  result.setDate(result.getDate() - daysBack);
  result.setHours(0, 0, 0, 0);
  return result;
}

function toDateOnly(value: string): Date | null {
  if (!value) return null;
  const d = new Date(value.length <= 10 ? `${value}T00:00:00` : value);
  return isNaN(d.getTime()) ? null : d;
}

function daysBetween(a: Date, b: Date): number {
  const MS_PER_DAY = 24 * 60 * 60 * 1000;
  return Math.round((b.getTime() - a.getTime()) / MS_PER_DAY);
}

export function buildDailyRadar(issues: SquadIssueSnapshot[], referenceDate: Date = new Date()): DailyRadar {
  const today = new Date(referenceDate);
  today.setHours(0, 0, 0, 0);
  const lastBizDay = lastBusinessDay(referenceDate);

  const completedRecently: RadarItem[] = [];
  const stale: Array<RadarItem & { staleSinceDays: number }> = [];
  const dueSoon: Array<RadarItem & { diffDays: number }> = [];

  for (const issue of issues) {
    const assigneeName = issue.assigneeName || 'Sem responsável';

    if (issue.statusCategory === 'done') {
      const resolvedAt = toDateOnly(issue.resolutionDate || '');
      if (resolvedAt && resolvedAt.getTime() >= lastBizDay.getTime()) {
        completedRecently.push({
          key: issue.key,
          title: issue.title || issue.key,
          assigneeName,
          detail: 'Concluído',
        });
      }
      continue;
    }

    if (issue.statusCategory === 'indeterminate' && (issue.staleSinceDays || 0) >= STALE_DAYS_THRESHOLD) {
      stale.push({
        key: issue.key,
        title: issue.title || issue.key,
        assigneeName,
        staleSinceDays: issue.staleSinceDays,
        detail: `Parado há ${issue.staleSinceDays}d`,
      });
    }

    const due = toDateOnly(issue.dueDate || '');
    if (due) {
      const diff = daysBetween(today, due);
      if (diff <= DUE_SOON_DAYS) {
        const overdue = diff < 0;
        dueSoon.push({
          key: issue.key,
          title: issue.title || issue.key,
          assigneeName,
          overdue,
          diffDays: diff,
          detail: overdue
            ? `Venceu há ${Math.abs(diff)}d`
            : diff === 0
              ? 'Vence hoje'
              : `Vence em ${diff}d`,
        });
      }
    }
  }

  stale.sort((a, b) => b.staleSinceDays - a.staleSinceDays);
  dueSoon.sort((a, b) => a.diffDays - b.diffDays);

  return { completedRecently, stale, dueSoon };
}

/** syncedAt mais recente entre as issues — usado pra avisar dado desatualizado. */
export function getLatestSyncedAt(issues: SquadIssueSnapshot[]): string | null {
  let latest: string | null = null;
  for (const issue of issues) {
    if (issue.syncedAt && (!latest || issue.syncedAt > latest)) latest = issue.syncedAt;
  }
  return latest;
}
