// Funções puras do Squad Hub e dos painéis por papel: porcentagens sem divisão por zero, datas sem
// escorregar um dia, casamento de pessoa por igualdade (não por "contém") e filtro por sprint.
import { isDoneStatus } from '@/lib/jira-status';

/** Porcentagem inteira; null quando não há total (o painel diz "sem dados" em vez de mostrar 0%). */
export function percentOf(part: number | null | undefined, total: number | null | undefined): number | null {
  const t = Number(total);
  const p = Number(part);
  if (!Number.isFinite(t) || t <= 0 || !Number.isFinite(p)) return null;
  return Math.min(100, Math.max(0, Math.round((p / t) * 100)));
}

/**
 * Data "de calendário": 'YYYY-MM-DD' (prazo do Jira) vale o dia escrito, no fuso local. `new Date('2026-10-09')`
 * é meia-noite UTC e, no Brasil (UTC-3), mostrava o dia anterior. Data com hora segue o instante normal.
 */
export function parseCalendarDate(value?: string | null): Date | null {
  if (!value) return null;
  const dateOnly = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  const d = dateOnly ? new Date(Number(dateOnly[1]), Number(dateOnly[2]) - 1, Number(dateOnly[3])) : new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function formatShortDate(value?: string | null): string {
  const d = parseCalendarDate(value);
  return d ? d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }) : '';
}

/** Dias inteiros de hoje até a data (negativo = vencido). null se a data não for válida. */
export function daysUntil(value?: string | null, now: Date = new Date()): number | null {
  const d = parseCalendarDate(value);
  if (!d) return null;
  const startOfDay = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  return Math.round((startOfDay(d) - startOfDay(now)) / 86_400_000);
}

function stripAccents(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '');
}

export function normalizeName(name?: string | null): string {
  return stripAccents((name || '').toLowerCase()).replace(/\s+/g, ' ').trim();
}

/**
 * A issue é da pessoa? Só por id do Jira ou nome completo igual (sem acento nem caixa). Antes usava "contém":
 * "Ana" casava com "Mariana" e a carga de uma pessoa entrava na conta de outra.
 */
export function isAssignedTo(
  issue: { assigneeId?: string | null; assigneeName?: string | null },
  person: { jiraAccountId?: string | null; displayName?: string | null; name?: string | null; email?: string | null },
): boolean {
  const personId = (person.jiraAccountId || '').trim();
  if (personId && issue.assigneeId && issue.assigneeId.trim() === personId) return true;
  const personName = normalizeName(person.displayName || person.name);
  const assigneeName = normalizeName(issue.assigneeName);
  return !!personName && !!assigneeName && personName === assigneeName;
}

type StatusFields = { status?: string | null; statusCategory?: string | null };

export function isDoneIssue(i: StatusFields): boolean {
  return i.statusCategory ? i.statusCategory === 'done' : isDoneStatus(i.status);
}

export function isInProgressIssue(i: StatusFields): boolean {
  if (i.statusCategory) return i.statusCategory === 'indeterminate';
  return /progress|andamento|review|test|qa/i.test(i.status || '') && !isDoneStatus(i.status);
}

export function isBugIssue(i: { type?: string | null; isBug?: boolean | null }): boolean {
  return i.isBug === true || /\b(bug|defeito|erro)\b/i.test(i.type || '');
}

/** Issues da sprint pedida. Sem id de sprint, devolve tudo. */
export function issuesOfSprint<T extends { sprintId?: string | null }>(issues: T[], sprintId?: string | null): T[] {
  if (!sprintId) return issues;
  return issues.filter(i => (i.sprintId || '') === sprintId);
}

/** Dias úteis (seg–sex) entre duas datas, inclusive. */
export function countWorkdays(from: Date, to: Date): number {
  const start = new Date(from.getFullYear(), from.getMonth(), from.getDate());
  const end = new Date(to.getFullYear(), to.getMonth(), to.getDate());
  let count = 0;
  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    const dow = d.getDay();
    if (dow !== 0 && dow !== 6) count++;
  }
  return count;
}

/**
 * Quanto da sprint já passou, a partir das datas reais da sprint. Antes a tela lia `workdaysRemaining`, que o
 * servidor nunca grava: aparecia "faltam 0 dias úteis" e 100% do tempo em toda sprint.
 */
export function sprintTimeProgress(
  startIso?: string | null,
  endIso?: string | null,
  now: Date = new Date(),
): { total: number; remaining: number; pct: number } | null {
  const start = parseCalendarDate(startIso);
  const end = parseCalendarDate(endIso);
  if (!start || !end || end < start) return null;
  const total = countWorkdays(start, end);
  if (total <= 0) return null;
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  let remaining: number;
  if (today < new Date(start.getFullYear(), start.getMonth(), start.getDate())) remaining = total;
  else if (today > end) remaining = 0;
  else remaining = countWorkdays(today, end);
  return { total, remaining, pct: Math.min(100, Math.max(0, Math.round(((total - remaining) / total) * 100))) };
}

/**
 * Variação diária a partir dos snapshots do dia. `loggedSec` e `doneIssues` do snapshot são ACUMULADOS da sprint;
 * o que aconteceu num dia é a diferença para o snapshot anterior. O primeiro snapshot não tem anterior, então não
 * entra (não há como saber o que foi feito só naquele dia).
 */
export function dailyDeltas(
  snapshots: { snapshotDate: string; loggedSec?: number | null; doneIssues?: number | null }[],
): Map<string, { loggedHours: number; done: number }> {
  const sorted = [...snapshots].sort((a, b) => a.snapshotDate.localeCompare(b.snapshotDate));
  const out = new Map<string, { loggedHours: number; done: number }>();
  for (let i = 1; i < sorted.length; i++) {
    const prev = sorted[i - 1];
    const cur = sorted[i];
    out.set(cur.snapshotDate, {
      loggedHours: Math.max(0, ((cur.loggedSec ?? 0) - (prev.loggedSec ?? 0)) / 3600),
      done: Math.max(0, (cur.doneIssues ?? 0) - (prev.doneIssues ?? 0)),
    });
  }
  return out;
}

/** Composição do escopo por tipo de issue, em contagem real (sem horas inventadas por categoria). */
export function workTypeBreakdown(
  issues: { type?: string | null; isBug?: boolean | null; parentKey?: string | null }[],
): { name: string; count: number }[] {
  let bugs = 0;
  let subtasks = 0;
  let stories = 0;
  for (const i of issues) {
    if (isBugIssue(i)) bugs++;
    else if (i.parentKey) subtasks++;
    else stories++;
  }
  return [
    { name: 'Histórias e demais', count: stories },
    { name: 'Subtarefas', count: subtasks },
    { name: 'Bugs', count: bugs },
  ].filter(b => b.count > 0);
}
