import type { SquadMember } from '@/lib/types';
import {
  CALC_METHOD_LABELS,
  DEFAULT_DAILY_HOURS,
  DEFAULT_FOCUS_FACTOR,
  SPRINT_DAYS,
  WEEK_DAYS,
  type CalcMethod,
} from './constants';
import { parseDecimal, roundTo } from './numbers';

/** Regra de cálculo das horas sugeridas pelo sistema (o servidor só guarda; quem calcula é a tela). */
export interface CapacityRule {
  method: string;
  /** Carga base em horas por dia. */
  baseHours: number;
  /** Fator de foco como o gestor digitou ("0,85" ou "0.85"). */
  focusFactorText: string;
}

/**
 * Fator de foco entre 0 (exclusive) e 1. Aceita vírgula ou ponto; devolve null quando não dá para entender.
 * (`parseFloat("0,85")` lia só o "0" e zerava a conta.)
 */
export function parseFocusFactor(text: string): number | null {
  const n = parseDecimal(text);
  return Number.isFinite(n) && n > 0 && n <= 1 ? n : null;
}

/** Valor que vai para o servidor: sempre com ponto ("0.85"), que é o que o backend lê. */
export function focusFactorForSave(text: string): string | null {
  const n = parseFocusFactor(text);
  return n === null ? null : String(roundTo(n, 4));
}

export function methodLabel(method: string | undefined | null): string {
  return CALC_METHOD_LABELS[(method || 'STANDARD') as CalcMethod] ?? 'Padrão fixo';
}

function baseOf(rule: CapacityRule): number {
  return rule.baseHours > 0 ? rule.baseHours : DEFAULT_DAILY_HOURS;
}

/** Horas por dia que a regra sugere para qualquer pessoa (a média de worklogs vem pronta do servidor). */
export function computeSuggestedHours(rule: CapacityRule): number {
  const base = baseOf(rule);
  if (rule.method === 'CUSTOM_FORMULA') {
    const factor = parseFocusFactor(rule.focusFactorText) ?? DEFAULT_FOCUS_FACTOR;
    return roundTo(base * factor, 1);
  }
  return base;
}

/** O que a coluna "Sugeridas" mostra: o valor já gravado para a pessoa; sem ele, o que a regra sugere. */
export function systemHoursOf(member: SquadMember, rule: CapacityRule): number {
  const stored = member.systemCalculatedCapacityHoursPerDay;
  if (stored && stored > 0) return stored;
  return computeSuggestedHours(rule);
}

/**
 * Valor novo ao clicar em "Recalcular". Padrão fixo e fator de foco são recalculados para todos (antes o valor já
 * gravado vencia e o botão não mudava nada). A média de worklogs depende do Jira: mantém o que o sync gravou.
 */
export function recalculatedSystemHours(member: SquadMember, rule: CapacityRule): number {
  const stored = member.systemCalculatedCapacityHoursPerDay;
  if (rule.method === 'JIRA_WORKLOG_AVERAGE' && stored && stored > 0) return stored;
  return computeSuggestedHours(rule);
}

export function realHoursOf(member: SquadMember, baseHours: number): number {
  return member.capacityHoursPerDay ?? (baseHours > 0 ? baseHours : DEFAULT_DAILY_HOURS);
}

/** Tipo de origem efetivo: o gravado; sem ele, "manual" quando a hora difere do padrão da squad. */
export function effectiveOverrideType(member: SquadMember, baseHours: number): string {
  if (member.overrideType) return member.overrideType;
  const base = baseHours > 0 ? baseHours : DEFAULT_DAILY_HOURS;
  return member.capacityHoursPerDay && member.capacityHoursPerDay !== base ? 'MANUAL_OVERRIDE' : 'SYSTEM';
}

export type SourceFilter = 'ALL' | 'OVERRIDDEN' | 'SYSTEM';

export interface RosterFilters {
  search: string;
  role: string;
  source: SourceFilter | string;
}

export function normalizeText(s: string | undefined | null): string {
  return (s || '').normalize('NFD').replace(/\p{M}+/gu, '').toLowerCase();
}

export function filterMembers(members: SquadMember[], filters: RosterFilters, baseHours: number): SquadMember[] {
  const q = normalizeText(filters.search.trim());
  return members.filter((m) => {
    const matchesSearch =
      !q ||
      normalizeText(m.displayName).includes(q) ||
      normalizeText(m.email).includes(q) ||
      normalizeText(m.jiraAccountId).includes(q);
    const matchesRole = filters.role === 'ALL' || (m.role || 'Developer') === filters.role;
    const type = effectiveOverrideType(m, baseHours);
    const matchesSource =
      filters.source === 'ALL' ||
      (filters.source === 'OVERRIDDEN' && type !== 'SYSTEM') ||
      (filters.source === 'SYSTEM' && type === 'SYSTEM');
    return matchesSearch && matchesRole && matchesSource;
  });
}

export function weeklyHours(hoursPerDay: number): number {
  return roundTo(hoursPerDay * WEEK_DAYS, 2);
}

export function sprintHours(hoursPerDay: number): number {
  return roundTo(hoursPerDay * SPRINT_DAYS, 2);
}

/** Variação (%) das horas reais sobre as sugeridas; 0 quando não há sugestão para comparar. */
export function variationPercent(real: number, suggested: number): number {
  if (!(suggested > 0)) return 0;
  return Math.round(((real - suggested) / suggested) * 100) || 0;
}

export type MemberSource = 'IMPORTED' | 'MANAGER' | 'SYSTEM';

/** "Ajustada" = o servidor marca como não-sistema, ou a hora digitada difere da sugerida. */
export function isMemberOverridden(member: SquadMember, realHours: number, suggestedHours: number): boolean {
  return (!!member.overrideType && member.overrideType !== 'SYSTEM') || realHours !== suggestedHours;
}

export function memberSource(member: SquadMember, realHours: number, suggestedHours: number): MemberSource {
  if (member.overrideType === 'IMPORTED_EXCEL') return 'IMPORTED';
  return isMemberOverridden(member, realHours, suggestedHours) ? 'MANAGER' : 'SYSTEM';
}

export interface RosterKpiValues {
  count: number;
  totalRealPerDay: number;
  totalRealPerWeek: number;
  totalSuggestedPerDay: number;
  customizedCount: number;
}

export function rosterKpis(members: SquadMember[], rule: CapacityRule): RosterKpiValues {
  const totalReal = members.reduce((sum, m) => sum + realHoursOf(m, rule.baseHours), 0);
  const totalSuggested = members.reduce((sum, m) => sum + systemHoursOf(m, rule), 0);
  return {
    count: members.length,
    totalRealPerDay: roundTo(totalReal, 2),
    totalRealPerWeek: roundTo(totalReal * WEEK_DAYS, 1),
    totalSuggestedPerDay: roundTo(totalSuggested, 2),
    customizedCount: members.filter((m) => m.overrideType && m.overrideType !== 'SYSTEM').length,
  };
}
