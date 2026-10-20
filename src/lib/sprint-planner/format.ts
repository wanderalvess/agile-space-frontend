/**
 * Formatação do Sprint Planner, só para exibição. Os números (capacidade, termômetro, dias úteis) vêm prontos
 * do backend; aqui não se recalcula nada, só se escreve em PT-BR.
 */

import type { Tone } from '@/components/room-kit/tokens';
import type { AbsenceView, PlanStatus, SubtaskClass, SubtaskOrigin, Thermometer } from './api';

export type StepId = 'capacidade' | 'escopo' | 'distribuicao' | 'revisao';

export const PLAN_STEPS: readonly { id: StepId; label: string }[] = [
  { id: 'capacidade', label: 'Capacidade' },
  { id: 'escopo', label: 'Escopo' },
  { id: 'distribuicao', label: 'Distribuição' },
  { id: 'revisao', label: 'Revisar e enviar' },
];

export const STATUS_ORDER: readonly PlanStatus[] = ['RASCUNHO', 'ESCOPO', 'DISTRIBUICAO', 'REVISAO', 'ENVIADO'];

/** Etapa do stepper em que o plano está (o RASCUNHO é a etapa Capacidade). */
export function stepOfStatus(status: PlanStatus): StepId {
  switch (status) {
    case 'ESCOPO': return 'escopo';
    case 'DISTRIBUICAO': return 'distribuicao';
    case 'REVISAO':
    case 'ENVIADO': return 'revisao';
    default: return 'capacidade';
  }
}

export function isStepId(v: string | null | undefined): v is StepId {
  return !!v && PLAN_STEPS.some((s) => s.id === v);
}

export const STATUS_LABEL: Record<PlanStatus, string> = {
  RASCUNHO: 'Capacidade',
  ESCOPO: 'Escopo',
  DISTRIBUICAO: 'Distribuição',
  REVISAO: 'Revisão',
  ENVIADO: 'Enviado ao Jira',
};

export const STATUS_TONE: Record<PlanStatus, Tone> = {
  RASCUNHO: 'neutral',
  ESCOPO: 'brand',
  DISTRIBUICAO: 'brand',
  REVISAO: 'warn',
  ENVIADO: 'success',
};

/** Próximo status (avançar uma etapa), sem ENVIADO: a gravação no Jira ainda não existe. */
export function nextStatus(status: PlanStatus): PlanStatus | null {
  const i = STATUS_ORDER.indexOf(status);
  const next = STATUS_ORDER[i + 1];
  return next && next !== 'ENVIADO' ? next : null;
}

export function previousStatus(status: PlanStatus): PlanStatus | null {
  const i = STATUS_ORDER.indexOf(status);
  return i > 0 && status !== 'ENVIADO' ? STATUS_ORDER[i - 1] : null;
}

/** Só RASCUNHO e ESCOPO podem ser excluídos (regra do backend). */
export function canDeleteStatus(status: PlanStatus): boolean {
  return status === 'RASCUNHO' || status === 'ESCOPO';
}

/** "12,5 h"; inteiros sem casa decimal. */
export function formatHours(h: number | null | undefined): string {
  const v = typeof h === 'number' && Number.isFinite(h) ? h : 0;
  const rounded = Math.round(v * 10) / 10;
  return `${rounded.toLocaleString('pt-BR', { maximumFractionDigits: 1 })} h`;
}

export function formatPct(p: number | null | undefined): string {
  if (typeof p !== 'number' || !Number.isFinite(p)) return '–';
  return `${Math.round(p).toLocaleString('pt-BR')}%`;
}

/** "2026-10-21" → "21/10". Datas do backend são LocalDate ISO; sem fuso para não trocar o dia. */
export function formatDay(iso: string | null | undefined): string {
  if (!iso) return '–';
  const [, m, d] = iso.slice(0, 10).split('-');
  return m && d ? `${d}/${m}` : iso;
}

const WEEKDAYS = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];

export function weekdayOf(iso: string): string {
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number);
  if (!y || !m || !d) return '';
  return WEEKDAYS[new Date(Date.UTC(y, m - 1, d)).getUTCDay()];
}

export function formatRange(start: string, end: string): string {
  return start === end ? formatDay(start) : `${formatDay(start)} a ${formatDay(end)}`;
}

export function formatWorkingDays(n: number): string {
  return n === 1 ? '1 dia útil' : `${n} dias úteis`;
}

/** Como a ausência aparece: "Dia inteiro" ou "4 h por dia". */
export function absenceAmount(a: Pick<AbsenceView, 'hoursPerDay'>): string {
  return a.hoursPerDay == null ? 'Dia inteiro' : `${formatHours(a.hoursPerDay)} por dia`;
}

export const ZONE_TONE: Record<Thermometer['zone'], Tone> = {
  VERDE: 'success',
  AMARELO: 'warn',
  VERMELHO: 'danger',
  SEM_CAPACIDADE: 'neutral',
};

/** Frase do estado do termômetro (o estado e a zona são do backend). */
export function thermometerLabel(t: Thermometer | undefined): string {
  if (!t || t.state === 'SEM_CAPACIDADE' || t.zone === 'SEM_CAPACIDADE') return 'Sem capacidade';
  if (t.state === 'COBERTO_PELA_RESERVA') return 'Coberto pela reserva';
  if (t.state === 'ACIMA_DA_RESERVA') return 'Acima da reserva';
  if (t.zone === 'VERDE') return 'Com folga';
  if (t.zone === 'AMARELO') return 'Perto do limite';
  return 'No limite';
}

export const CLASS_LABEL: Record<SubtaskClass, string> = {
  DEV: 'DEV',
  QA: 'QA',
  FORA_DA_CONTA: 'Fora da conta',
  SEM_CLASSIFICACAO: 'Sem classificação',
};

export const CLASS_TONE: Record<SubtaskClass, Tone> = {
  DEV: 'brand',
  QA: 'success',
  FORA_DA_CONTA: 'neutral',
  SEM_CLASSIFICACAO: 'warn',
};

export const ORIGIN_LABEL: Record<SubtaskOrigin, string> = {
  PADRAO: 'Padrão',
  HERDADO: 'Herdado da sprint anterior',
  MANUAL: 'Ajustado pela liderança',
};

/** Hoje em ISO local (yyyy-mm-dd), para valores iniciais de campos de data. */
export function todayIso(now: Date = new Date()): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${now.getFullYear()}-${p(now.getMonth() + 1)}-${p(now.getDate())}`;
}

/** Validação local do formulário de plano (o backend valida de novo e responde 422). */
export function validatePlanForm(f: { sprintName: string; startDate: string; endDate: string }): string | null {
  if (!f.sprintName.trim()) return 'Informe o nome da sprint.';
  if (!f.startDate || !f.endDate) return 'Informe o início e o fim da sprint.';
  if (f.endDate < f.startDate) return 'O fim da sprint não pode ser antes do início.';
  return null;
}
