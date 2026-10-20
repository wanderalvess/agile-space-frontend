/**
 * Lógica de APRESENTAÇÃO da Distribuição (E4). Saldo, termômetro, avisos e a cascata de datas vêm do servidor; aqui
 * só se organiza o que chegou (quem é dono de quê, texto da cadeia) e se pré-valida a data para dar resposta rápida.
 * A palavra final é sempre o 422 do backend.
 */
import { isoOfDay, isWeekendDay, parseDay } from '@/lib/cronograma/dates';
import type { PhaseKind } from '@/lib/cronograma/phases';
import type { DistributionPerson, DistributionSubtask, DistributionTask, DistributionView } from './api';
import { formatDay } from './format';

export type Ownership = 'mine' | 'other' | 'free';
export type Distributable = DistributionSubtask & { cls: 'DEV' | 'QA' };

/** Só DEV e QA entram na distribuição; "Sem classificação" e "Fora da conta" não. */
export const isDistributable = (s: DistributionSubtask): s is Distributable => s.cls === 'DEV' || s.cls === 'QA';

export function ownershipOf(s: DistributionSubtask, me: string | null): Ownership {
  if (!s.assigneeId) return 'free';
  return me && s.assigneeId === me ? 'mine' : 'other';
}

/** Fase do Gantt da squad: Code Review entre a Codificação (DEV) e o QA. */
export function phaseKindOf(s: Pick<DistributionSubtask, 'cls' | 'codeReview'>): PhaseKind {
  if (s.codeReview) return 'Review';
  return s.cls === 'QA' ? 'QA' : 'DEV';
}

const PHASE_LABEL: Record<string, string> = { DEV: 'Codificação', Review: 'Code Review', QA: 'Teste QA' };

export function phaseLabelOf(s: Pick<DistributionSubtask, 'cls' | 'codeReview'>): string {
  return PHASE_LABEL[phaseKindOf(s)] ?? 'Outra fase';
}

export type DistTask = Omit<DistributionTask, 'subtasks'> & { subtasks: Distributable[] };

/** Tarefas só com as subtarefas distribuíveis; `ignored` conta as que ficaram de fora (sem classificação / fora da conta). */
export function distributableTasks(view: DistributionView): { tasks: DistTask[]; ignored: number } {
  let ignored = 0;
  const tasks = view.tasks.map((t) => {
    const subtasks = t.subtasks.filter(isDistributable);
    ignored += t.subtasks.length - subtasks.length;
    return { ...t, subtasks };
  });
  return { tasks, ignored };
}

export function allSubtasks(view: DistributionView): Distributable[] {
  return view.tasks.flatMap((t) => t.subtasks.filter(isDistributable));
}

/** Texto da trava de início: "Começa quando o Code Review termina". null se a subtarefa não tem antecessora. */
export function chainNote(s: DistributionSubtask, byKey: Map<string, DistributionSubtask>): string | null {
  if (!s.startsAfterKey) return null;
  const pred = byKey.get(s.startsAfterKey);
  if (!pred) return `Começa quando ${s.startsAfterKey} termina`;
  const name = pred.codeReview ? 'o Code Review' : pred.cls === 'QA' ? 'o teste' : 'a Codificação';
  return `Começa quando ${name} termina`;
}

/** O início fica travado (acompanha a antecessora): é o caso do QA depois do Code Review. */
export const startIsLocked = (s: DistributionSubtask): boolean =>
  s.cls === 'QA' && !!s.startsAfterKey && !!(s.startDate || s.minStartDate);

/** Feriados da sprint como mapa dia (número) -> rótulo. Aceita "yyyy-MM-dd" ou { day, label }. */
export function sprintHolidayDays(view: DistributionView): Map<number, string | null> {
  const m = new Map<number, string | null>();
  for (const h of view.sprint.holidays) {
    const day = typeof h === 'string' ? h : h?.day;
    const n = parseDay(day);
    if (n !== null) m.set(n, typeof h === 'string' ? null : h.label ?? null);
  }
  return m;
}

/**
 * Pré-validação só para UX (o servidor decide): fim depois do início, dentro da sprint e não antes do `minStartDate`.
 * Não barra fim de semana nem feriado: o servidor aceita (feriado só vira aviso) e conta a cascata em dias úteis. Devolve a mensagem ou null.
 */
export function validateDates(s: DistributionSubtask, view: DistributionView, start: string, end: string): string | null {
  const a = parseDay(start);
  const b = parseDay(end);
  if (a === null || b === null) return 'Informe o início e o fim.';
  if (b < a) return 'O fim não pode ser antes do início.';
  const lo = parseDay(view.sprint.startDate);
  const hi = parseDay(view.sprint.endDate);
  if (lo !== null && a < lo) return `O início não pode ser antes da sprint (${formatDay(view.sprint.startDate)}).`;
  if (hi !== null && b > hi) return `O fim não pode ser depois da sprint (${formatDay(view.sprint.endDate)}).`;
  const min = parseDay(s.minStartDate);
  if (min !== null && a < min) {
    return `O início não pode ser antes de ${formatDay(s.minStartDate)}${s.startsAfterKey ? `, quando ${s.startsAfterKey} termina` : ''}.`;
  }
  return null;
}

/** Primeiro dia útil a partir de `iso`. */
export function nextBusinessIso(iso: string): string {
  let d = parseDay(iso) ?? 0;
  while (isWeekendDay(d)) d += 1;
  return isoOfDay(d);
}

/** Quem a liderança pode escolher: só o papel da subtarefa (outro papel o servidor recusa com 422), por nome. */
export function assignablePeople(people: DistributionPerson[], cls: 'DEV' | 'QA'): DistributionPerson[] {
  return people.filter((p) => p.role === cls).sort((x, y) => x.name.localeCompare(y.name, 'pt-BR'));
}

export interface Progress { withDates: number; total: number; missing: DistributionPerson[] }

/** Andamento para a liderança: de quem tem subtarefa, quantos já marcaram todas as datas. */
export function progressOf(view: DistributionView): Progress {
  const owners = new Map<string, boolean>();
  for (const s of allSubtasks(view)) {
    if (!s.assigneeId) continue;
    const ok = !!s.startDate && !!s.endDate;
    owners.set(s.assigneeId, (owners.get(s.assigneeId) ?? true) && ok);
  }
  const missing = view.people.filter((p) => owners.get(p.accountId) === false);
  return { withDates: owners.size - missing.length, total: owners.size, missing };
}

export interface DateChange { key: string; who: string | null; mine: boolean; startDate: string | null; endDate: string | null }

/** O que mudou de data entre duas versões (para o aviso "X atualizou datas"). */
export function dateChanges(prev: DistributionView, next: DistributionView): DateChange[] {
  const before = new Map(allSubtasks(prev).map((s) => [s.key, s]));
  const out: DateChange[] = [];
  for (const s of allSubtasks(next)) {
    const o = before.get(s.key);
    if (!o) continue;
    if (o.startDate !== s.startDate || o.endDate !== s.endDate) {
      out.push({ key: s.key, who: s.assigneeName, mine: !!next.myAccountId && s.assigneeId === next.myAccountId, startDate: s.startDate, endDate: s.endDate });
    }
  }
  return out;
}

const WARNING_LABEL: Record<string, string> = {
  PERSON_OVER_CAPACITY: 'Acima da capacidade',
  SUBTASK_UNASSIGNED: 'Sem dono',
  SUBTASK_NO_DATES: 'Sem datas',
  DATES_OUTSIDE_SPRINT: 'Fora da sprint',
  TASK_ON_HOLIDAY: 'Em feriado',
  QA_BEFORE_DEV: 'QA antes do DEV',
  CODE_REVIEW_BEFORE_CODING: 'Code Review antes da Codificação',
};

export function warningTitle(code: string): string {
  return WARNING_LABEL[code] ?? 'Atenção';
}
