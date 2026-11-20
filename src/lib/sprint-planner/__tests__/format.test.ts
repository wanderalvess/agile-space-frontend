import { describe, expect, it } from 'vitest';
import {
  absenceAmount,
  canDeleteStatus,
  formatDay,
  formatHours,
  formatPct,
  formatRange,
  isStepId,
  nextStatus,
  previousStatus,
  stepOfStatus,
  thermometerLabel,
  validatePlanForm,
  weekdayOf,
} from '../format';
import type { Thermometer } from '../api';

const t = (over: Partial<Thermometer>): Thermometer => ({
  allocatedHours: 0, capacityHours: 100, pct: 0, zone: 'VERDE', state: 'DENTRO_DA_CAPACIDADE', reservePct: 0, reserveLimitHours: 100, ...over,
});

describe('formatação do Sprint Planner', () => {
  it('horas em PT-BR, sem recalcular', () => {
    expect(formatHours(28)).toBe('28 h');
    expect(formatHours(12.5)).toBe('12,5 h');
    expect(formatHours(null)).toBe('0 h');
    expect(formatPct(86.4)).toBe('86%');
    expect(formatPct(null)).toBe('–');
  });

  it('datas LocalDate sem fuso', () => {
    expect(formatDay('2026-11-02')).toBe('02/11');
    expect(weekdayOf('2026-11-02')).toBe('seg');
    expect(formatRange('2026-10-21', '2026-11-03')).toBe('21/10 a 03/11');
    expect(formatRange('2026-10-21', '2026-10-21')).toBe('21/10');
  });

  it('status ↔ etapa e transições de uma etapa só, sem ENVIADO', () => {
    expect(stepOfStatus('RASCUNHO')).toBe('capacidade');
    expect(stepOfStatus('ESCOPO')).toBe('escopo');
    expect(stepOfStatus('DISTRIBUICAO')).toBe('distribuicao');
    expect(stepOfStatus('REVISAO')).toBe('revisao');
    expect(stepOfStatus('ENVIADO')).toBe('revisao');
    expect(nextStatus('RASCUNHO')).toBe('ESCOPO');
    expect(nextStatus('REVISAO')).toBeNull();
    expect(previousStatus('RASCUNHO')).toBeNull();
    expect(previousStatus('ESCOPO')).toBe('RASCUNHO');
    expect(previousStatus('ENVIADO')).toBeNull();
    expect(canDeleteStatus('RASCUNHO')).toBe(true);
    expect(canDeleteStatus('ESCOPO')).toBe(true);
    expect(canDeleteStatus('DISTRIBUICAO')).toBe(false);
    expect(isStepId('escopo')).toBe(true);
    expect(isStepId('xx')).toBe(false);
  });

  it('frase do termômetro segue zona e estado do backend', () => {
    expect(thermometerLabel(undefined)).toBe('Sem capacidade');
    expect(thermometerLabel(t({ zone: 'VERDE' }))).toBe('Com folga');
    expect(thermometerLabel(t({ zone: 'AMARELO' }))).toBe('Perto do limite');
    expect(thermometerLabel(t({ zone: 'VERMELHO' }))).toBe('No limite');
    expect(thermometerLabel(t({ zone: 'VERMELHO', state: 'COBERTO_PELA_RESERVA' }))).toBe('Coberto pela reserva');
    expect(thermometerLabel(t({ zone: 'VERMELHO', state: 'ACIMA_DA_RESERVA' }))).toBe('Acima da reserva');
    expect(thermometerLabel(t({ zone: 'SEM_CAPACIDADE', state: 'SEM_CAPACIDADE' }))).toBe('Sem capacidade');
  });

  it('ausência: dia inteiro ou horas por dia', () => {
    expect(absenceAmount({ hoursPerDay: null })).toBe('Dia inteiro');
    expect(absenceAmount({ hoursPerDay: 4 })).toBe('4 h por dia');
  });

  it('valida o formulário de plano', () => {
    expect(validatePlanForm({ sprintName: ' ', startDate: '2026-10-21', endDate: '2026-11-03' })).toMatch(/nome/);
    expect(validatePlanForm({ sprintName: 'S1', startDate: '', endDate: '2026-11-03' })).toMatch(/início/);
    expect(validatePlanForm({ sprintName: 'S1', startDate: '2026-11-03', endDate: '2026-10-21' })).toMatch(/antes/);
    expect(validatePlanForm({ sprintName: 'S1', startDate: '2026-10-21', endDate: '2026-11-03' })).toBeNull();
  });
});
