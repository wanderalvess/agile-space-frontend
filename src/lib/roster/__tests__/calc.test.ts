import { describe, it, expect } from 'vitest';
import type { SquadMember } from '@/lib/types';
import {
  computeSuggestedHours,
  effectiveOverrideType,
  filterMembers,
  focusFactorForSave,
  memberSource,
  parseFocusFactor,
  recalculatedSystemHours,
  rosterKpis,
  sprintHours,
  systemHoursOf,
  variationPercent,
  weeklyHours,
  type CapacityRule,
} from '../calc';
import { formatHours, parseDecimal } from '../numbers';

const member = (over: Partial<SquadMember> = {}): SquadMember => ({
  dbId: 'S_ana',
  squadId: 'S',
  jiraAccountId: 'ana',
  displayName: 'Ana Souza',
  email: 'ana@totvs.com.br',
  role: 'Developer',
  ...over,
});

const rule = (over: Partial<CapacityRule> = {}): CapacityRule => ({ method: 'STANDARD', baseHours: 6, focusFactorText: '0.85', ...over });

describe('parseDecimal', () => {
  it('aceita vírgula e ponto', () => {
    expect(parseDecimal('0,85')).toBe(0.85);
    expect(parseDecimal('0.85')).toBe(0.85);
    expect(parseDecimal(' 6,5 ')).toBe(6.5);
  });

  it('entende milhar', () => {
    expect(parseDecimal('1.234,5')).toBe(1234.5);
    expect(parseDecimal('1,234.5')).toBe(1234.5);
  });

  it('o que não é número vira NaN', () => {
    expect(parseDecimal('')).toBeNaN();
    expect(parseDecimal('abc')).toBeNaN();
    expect(parseDecimal('1,2,x')).toBeNaN();
  });
});

describe('fator de foco', () => {
  it('"0,85" e "0.85" dão o mesmo fator (parseFloat zerava a vírgula)', () => {
    expect(parseFocusFactor('0,85')).toBe(0.85);
    expect(parseFocusFactor('0.85')).toBe(0.85);
    expect(parseFloat('0,85')).toBe(0); // o comportamento antigo
  });

  it('fora de 0–1 ou ilegível é inválido', () => {
    expect(parseFocusFactor('0')).toBeNull();
    expect(parseFocusFactor('1,5')).toBeNull();
    expect(parseFocusFactor('abc')).toBeNull();
  });

  it('grava sempre com ponto', () => {
    expect(focusFactorForSave('0,85')).toBe('0.85');
    expect(focusFactorForSave('0.9')).toBe('0.9');
    expect(focusFactorForSave('x')).toBeNull();
  });

  it('a hora sugerida usa o fator e a carga base editáveis', () => {
    expect(computeSuggestedHours(rule({ method: 'CUSTOM_FORMULA', baseHours: 8, focusFactorText: '0,85' }))).toBe(6.8);
    expect(computeSuggestedHours(rule({ method: 'CUSTOM_FORMULA', baseHours: 6, focusFactorText: '0.85' }))).toBe(5.1);
  });

  it('fator ilegível cai em 0,85; padrão fixo ignora o fator', () => {
    expect(computeSuggestedHours(rule({ method: 'CUSTOM_FORMULA', baseHours: 8, focusFactorText: 'zzz' }))).toBe(6.8);
    expect(computeSuggestedHours(rule({ method: 'STANDARD', baseHours: 8, focusFactorText: '0.5' }))).toBe(8);
  });
});

describe('horas sugeridas por pessoa', () => {
  it('usa o valor gravado quando existe', () => {
    expect(systemHoursOf(member({ systemCalculatedCapacityHoursPerDay: 7 }), rule())).toBe(7);
  });

  it('sem valor gravado, usa a regra', () => {
    expect(systemHoursOf(member(), rule({ baseHours: 8 }))).toBe(8);
    expect(systemHoursOf(member({ systemCalculatedCapacityHoursPerDay: 0 }), rule({ baseHours: 8 }))).toBe(8);
  });

  it('Recalcular muda quem já tinha valor gravado (padrão fixo e fator de foco)', () => {
    const m = member({ systemCalculatedCapacityHoursPerDay: 6 });
    expect(recalculatedSystemHours(m, rule({ baseHours: 8 }))).toBe(8);
    expect(recalculatedSystemHours(m, rule({ method: 'CUSTOM_FORMULA', baseHours: 8, focusFactorText: '0,5' }))).toBe(4);
  });

  it('Recalcular mantém o que o sync gravou na média de worklogs', () => {
    const m = member({ systemCalculatedCapacityHoursPerDay: 5.2 });
    expect(recalculatedSystemHours(m, rule({ method: 'JIRA_WORKLOG_AVERAGE', baseHours: 8 }))).toBe(5.2);
    expect(recalculatedSystemHours(member(), rule({ method: 'JIRA_WORKLOG_AVERAGE', baseHours: 8 }))).toBe(8);
  });
});

describe('semanal, sprint e variação', () => {
  it('semanal = 5 dias, sprint = 10 dias, sem erro de ponto flutuante', () => {
    expect(weeklyHours(5.5)).toBe(27.5);
    expect(sprintHours(5.5)).toBe(55);
    expect(weeklyHours(6.1)).toBe(30.5);
    expect(sprintHours(0.1 + 0.2)).toBe(3);
  });

  it('variação em % sobre a sugerida', () => {
    expect(variationPercent(5.5, 6)).toBe(-8);
    expect(variationPercent(7, 6)).toBe(17);
    expect(variationPercent(6, 6)).toBe(0);
    expect(variationPercent(6, 0)).toBe(0);
  });

  it('formata horas em pt-BR', () => {
    expect(formatHours(5.5)).toBe('5,5');
    expect(formatHours(27.5)).toBe('27,5');
    expect(formatHours(6)).toBe('6');
  });
});

describe('origem da carga horária', () => {
  it('planilha vence; gestor quando difere ou o servidor marcou; senão sistema', () => {
    expect(memberSource(member({ overrideType: 'IMPORTED_EXCEL' }), 6, 6)).toBe('IMPORTED');
    expect(memberSource(member({ overrideType: 'MANUAL_OVERRIDE' }), 6, 6)).toBe('MANAGER');
    expect(memberSource(member({ overrideType: 'SYSTEM' }), 7, 6)).toBe('MANAGER');
    expect(memberSource(member({ overrideType: 'SYSTEM' }), 6, 6)).toBe('SYSTEM');
  });

  it('tipo efetivo: sem gravação, diferente do padrão da squad vira manual', () => {
    expect(effectiveOverrideType(member({ capacityHoursPerDay: 8 }), 6)).toBe('MANUAL_OVERRIDE');
    expect(effectiveOverrideType(member({ capacityHoursPerDay: 6 }), 6)).toBe('SYSTEM');
    expect(effectiveOverrideType(member({ overrideType: 'IMPORTED_EXCEL' }), 6)).toBe('IMPORTED_EXCEL');
  });
});

describe('filtros', () => {
  const people = [
    member({ jiraAccountId: 'ana', displayName: 'Ana Ribeiro', role: 'Developer', overrideType: 'MANUAL_OVERRIDE' }),
    member({ jiraAccountId: 'bru', displayName: 'Bruno Teixeira', email: 'bruno@x.com', role: 'QA', overrideType: 'SYSTEM' }),
    member({ jiraAccountId: 'joa', displayName: 'João Pires', email: undefined, role: 'QA', overrideType: 'SYSTEM' }),
  ];
  const f = (over: Partial<{ search: string; role: string; source: string }>) =>
    filterMembers(people, { search: '', role: 'ALL', source: 'ALL', ...over }, 6).map((m) => m.jiraAccountId);

  it('busca por nome, e-mail ou ID, sem acento', () => {
    expect(f({ search: 'ribeiro' })).toEqual(['ana']);
    expect(f({ search: 'bruno@' })).toEqual(['bru']);
    expect(f({ search: 'joao' })).toEqual(['joa']);
    expect(f({ search: 'bru' })).toEqual(['bru']);
  });

  it('cargo e fonte da carga', () => {
    expect(f({ role: 'QA' })).toEqual(['bru', 'joa']);
    expect(f({ source: 'OVERRIDDEN' })).toEqual(['ana']);
    expect(f({ source: 'SYSTEM' })).toEqual(['bru', 'joa']);
    expect(f({ role: 'QA', source: 'OVERRIDDEN' })).toEqual([]);
  });
});

describe('KPIs', () => {
  it('soma horas reais, sugeridas e conta personalizadas', () => {
    const people = [
      member({ jiraAccountId: 'a', capacityHoursPerDay: 5.5, systemCalculatedCapacityHoursPerDay: 6, overrideType: 'MANUAL_OVERRIDE' }),
      member({ jiraAccountId: 'b', capacityHoursPerDay: 6.5, systemCalculatedCapacityHoursPerDay: 6.5, overrideType: 'SYSTEM' }),
      member({ jiraAccountId: 'c' }),
    ];
    const k = rosterKpis(people, rule());
    expect(k.count).toBe(3);
    expect(k.totalRealPerDay).toBe(18); // 5,5 + 6,5 + 6 (padrão)
    expect(k.totalRealPerWeek).toBe(90);
    expect(k.totalSuggestedPerDay).toBe(18.5);
    expect(k.customizedCount).toBe(1);
  });

  it('time vazio zera tudo', () => {
    const k = rosterKpis([], rule());
    expect(k).toEqual({ count: 0, totalRealPerDay: 0, totalRealPerWeek: 0, totalSuggestedPerDay: 0, customizedCount: 0 });
  });
});
