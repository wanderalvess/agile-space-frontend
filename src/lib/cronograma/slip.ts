/**
 * Detecção automática de atraso de uma fase, sem depender de alguém atualizar o Jira na mão.
 * Quatro sinais, do mais forte ao mais fraco:
 *  1. já devia ter terminado (não concluída, fim planejado no passado)
 *  2. já devia ter começado (status "a fazer", início planejado no passado)
 *  3. concluiu, mas depois do prazo (usa a data de resolução)
 *  4. sobrou mais trabalho (tempo restante) do que dias até o prazo; o mais fraco, por isso "presumido"
 * Só vale com datas REAIS do Jira (`datesAreInferred === false`): declarar atraso sobre prazo inventado é pior
 * que não declarar nada.
 */
import { JORNADA, businessDaysBetween } from './dates';
import type { CronoTask } from './task';

export type SlipReason = 'none' | 'overdue' | 'not-started' | 'remaining-work' | 'finished-late';

export interface InferredSlip {
  /** Dias úteis de atraso (0 = nada detectado). */
  days: number;
  reason: SlipReason;
  /** observed = fato que já aconteceu; presumed = heurística. */
  confidence: 'observed' | 'presumed';
}

const NONE: InferredSlip = { days: 0, reason: 'none', confidence: 'observed' };

export function inferSlip(
  task: Pick<CronoTask, 'datesAreInferred' | 'statusCategory' | 'start' | 'end' | 'resolvedAt' | 'remainingSec'>,
  today: number,
  capacityHours: number = JORNADA.capacidadePadraoH,
): InferredSlip {
  if (task.datesAreInferred) return { days: 0, reason: 'none', confidence: 'presumed' };

  if (task.statusCategory === 'done') {
    if (task.end && task.resolvedAt) {
      const days = businessDaysBetween(task.end.day, task.resolvedAt.day);
      if (days > 0) return { days, reason: 'finished-late', confidence: 'observed' };
    }
    return NONE;
  }

  if (task.end && task.end.day < today) {
    const days = businessDaysBetween(task.end.day, today);
    if (days > 0) return { days, reason: 'overdue', confidence: 'observed' };
  }

  if (task.statusCategory === 'new' && task.start && task.start.day < today) {
    const days = businessDaysBetween(task.start.day, today);
    if (days > 0) return { days, reason: 'not-started', confidence: 'observed' };
  }

  if (task.remainingSec > 0 && task.end) {
    const daysLeft = Math.max(0, businessDaysBetween(today, task.end.day));
    const remainingDays = task.remainingSec / 3600 / Math.max(capacityHours, 0.5);
    if (remainingDays > daysLeft) {
      return { days: Math.ceil(remainingDays - daysLeft), reason: 'remaining-work', confidence: 'presumed' };
    }
  }

  return NONE;
}

export function slipReasonText(reason: SlipReason, endLabel: string): string {
  switch (reason) {
    case 'overdue': return `Devia ter terminado em ${endLabel} e ainda está aberta.`;
    case 'not-started': return 'Devia ter começado e ainda está como "a fazer".';
    case 'finished-late': return `Foi concluída depois do prazo (${endLabel}).`;
    case 'remaining-work': return 'Sobrou mais trabalho do que dias até o prazo (estimativa, não confirmado).';
    default: return '';
  }
}
