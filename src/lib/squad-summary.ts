/**
 * Contas da aba Resumo do hub da squad (antes na página /painel e na "Visão geral"): progresso da sprint,
 * colunas do board resumido e a lista "Precisa de atenção". Funções puras: a tela só desenha o resultado.
 */
import type { SquadIssueSnapshot, SquadMember, SquadMetricsRollup } from '@/lib/types';
import { hubHref } from '@/lib/squad-hub';

export function byUpdatedDesc(a: SquadIssueSnapshot, b: SquadIssueSnapshot): number {
  return (b.updatedAtJira || '').localeCompare(a.updatedAtJira || '');
}

export interface SprintStats {
  total: number;
  done: number;
  inProgress: number;
  todo: number;
  pct: number;
}

/** Progresso pela contagem de issues (o placar do servidor é por issue e por hora, não por story point). */
export function sprintStats(rollup: SquadMetricsRollup | null, issues: SquadIssueSnapshot[]): SprintStats {
  const total = rollup?.totalIssues ?? issues.length;
  const done = rollup?.doneIssues ?? issues.filter((i) => i.statusCategory === 'done').length;
  const inProgress = rollup?.inProgressIssues ?? issues.filter((i) => i.statusCategory === 'indeterminate').length;
  const todo = Math.max(total - done - inProgress, 0);
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;
  return { total, done, inProgress, todo, pct };
}

export interface BoardColumn {
  id: 'todo' | 'doing' | 'done';
  label: string;
  items: SquadIssueSnapshot[];
}

/** As três colunas do board resumido, por categoria do Jira, com as mais recentes primeiro. */
export function boardColumns(issues: SquadIssueSnapshot[]): BoardColumn[] {
  const sorted = [...issues].sort(byUpdatedDesc);
  return [
    { id: 'todo', label: 'A fazer', items: sorted.filter((i) => i.statusCategory === 'new' || i.statusCategory === 'unknown') },
    { id: 'doing', label: 'Em andamento', items: sorted.filter((i) => i.statusCategory === 'indeterminate') },
    { id: 'done', label: 'Concluído', items: sorted.filter((i) => i.statusCategory === 'done') },
  ];
}

/** Ninguém do time tem hora por dia (nem manual, nem calculada): a capacidade da sprint sai imprecisa. */
export function isCapacityMissing(members: Pick<SquadMember, 'capacityHoursPerDay' | 'systemCalculatedCapacityHoursPerDay'>[]): boolean {
  return members.length > 0 && members.every((m) => !m.capacityHoursPerDay && !m.systemCalculatedCapacityHoursPerDay);
}

export type AttentionTone = 'danger' | 'warn' | 'info';

export interface AttentionItem {
  id: 'overdue' | 'stale' | 'not-synced' | 'no-people';
  tone: AttentionTone;
  text: string;
  /** Rótulo e destino do link; sem eles o item é só texto. */
  actionLabel?: string;
  href?: string;
  /** O item pede uma ação que não é navegação (sincronizar). */
  action?: 'sync';
}

export function buildAttention(input: {
  overdue: number;
  stale: number;
  hasRollup: boolean;
  peopleCount: number;
  canSync: boolean;
  /** Quem pode abrir a tela de Pessoas (SQUAD_PEOPLE_ADMIN_ROLES). */
  canOpenPeople: boolean;
}): AttentionItem[] {
  const items: AttentionItem[] = [];
  const { overdue, stale } = input;
  if (overdue > 0) {
    items.push({
      id: 'overdue',
      tone: 'danger',
      text: `${overdue} ${overdue === 1 ? 'item está' : 'itens estão'} com o prazo vencido.`,
      actionLabel: 'Ver no Cronograma',
      href: hubHref('cronograma'),
    });
  }
  if (stale > 0) {
    items.push({
      id: 'stale',
      tone: 'warn',
      text: `${stale} ${stale === 1 ? 'item está' : 'itens estão'} sem nenhuma mudança há mais de 3 dias.`,
      actionLabel: 'Ver nas Métricas',
      href: hubHref('metricas'),
    });
  }
  if (!input.hasRollup) {
    items.push({
      id: 'not-synced',
      tone: 'info',
      text: 'A sprint ainda não foi sincronizada com o Jira, então os números estão vazios.',
      actionLabel: input.canSync ? 'Sincronizar agora' : undefined,
      action: input.canSync ? 'sync' : undefined,
    });
  }
  if (input.peopleCount === 0) {
    items.push({
      id: 'no-people',
      tone: 'warn',
      text: 'Nenhuma pessoa do time foi sincronizada ainda.',
      actionLabel: input.canOpenPeople ? 'Abrir Pessoas' : undefined,
      href: input.canOpenPeople ? '/squad/roster' : undefined,
    });
  }
  return items;
}

// ── Métricas da sprint ──────────────────────────────────────────────────────────────

/** Largura de uma barra (0 a 100) em relação ao maior valor da lista: a escala acompanha o time, não um teto fixo. */
export function barPercent(value: number, max: number): number {
  if (!(max > 0) || !(value > 0)) return 0;
  return Math.min(100, Math.round((value / max) * 100));
}

export type MetricKpiKey = 'stale' | 'bugs' | 'hours' | 'done';

/** Qual KPI vai primeiro para cada papel (o que a pessoa mais olha). */
const ROLE_FIRST_KPI: Record<string, MetricKpiKey> = {
  'Scrum Master': 'stale',
  'Tech Lead': 'hours',
  'Product Owner': 'done',
  'People Lead': 'hours',
  'Agile Master': 'hours',
  QA: 'bugs',
  Developer: 'done',
};

/** Põe em primeiro o KPI do papel, sem mexer na ordem dos demais. */
export function orderKpis<T extends { key: string }>(kpis: T[], role?: string): T[] {
  const first = role ? ROLE_FIRST_KPI[role] : undefined;
  const idx = first ? kpis.findIndex((k) => k.key === first) : -1;
  if (idx <= 0) return kpis;
  return [kpis[idx], ...kpis.filter((_, i) => i !== idx)];
}
