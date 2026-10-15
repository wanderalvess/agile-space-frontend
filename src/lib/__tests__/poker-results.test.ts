import { describe, it, expect } from 'vitest';
import { summarizeRound, buildRoundCopyText, copyUnitSuffix, sumRoleHours } from '../poker-results';
import type { Participant, Vote } from '../types';

const P = (id: string, role: Participant['role'], globalRole: string): Participant => ({ id, nickname: id, role, globalRole } as Participant);
const V = (participantId: string, value: string): Vote => ({ participantId, value } as Vote);

const people = [
  P('d1', 'dev', 'Developer'), P('d2', 'dev', 'Developer'), P('d3', 'dev', 'Developer'),
  P('q1', 'qa', 'QA'), P('u1', 'dev', 'UX'), P('sm', 'organizador', 'Scrum Master'),
];

describe('summarizeRound', () => {
  it('horas: média por papel arredondada para cima e total = soma das médias', () => {
    const s = summarizeRound([V('d1', '8'), V('d2', '6'), V('d3', '16'), V('q1', '4'), V('u1', '2'), V('sm', '40')], people, 'hours');
    expect(s.rolePoints).toEqual({ Developer: '10', QA: '4', UX: '2' });
    expect(s.totalHours).toBe('16');
    expect(s.activeRoles).toEqual(['Developer', 'QA', 'UX']);
    expect(s.byRole.Developer?.resultValue).toBe('10');
    expect(s.consensus).toBe(false);
    expect(s.min).toBe('2');
    expect(s.max).toBe('16');
  });

  it('ignora gestão nas métricas, a menos que seja liberada', () => {
    const votes = [V('d1', '5'), V('sm', '5')];
    expect(summarizeRound(votes, people, 'fibonacci').consensus).toBe(false);
    expect(summarizeRound(votes, people, 'fibonacci', { allowManagementToVote: true }).consensus).toBe(true);
  });

  it('respeita o modo de arredondamento', () => {
    const votes = [V('d1', '5'), V('d2', '6')];
    expect(summarizeRound(votes, people, 'hours').rolePoints.Developer).toBe('6');
    expect(summarizeRound(votes, people, 'hours', { roundingMode: 'down' }).rolePoints.Developer).toBe('5');
  });

  it('camisetas sem equivalência: mais votado; com equivalência: média em horas', () => {
    const votes = [V('d1', 'M'), V('d2', 'M'), V('d3', 'G')];
    const plain = summarizeRound(votes, people, 'tshirt');
    expect(plain.avg).toBe('M');
    expect(plain.tshirtNumeric).toBe(false);
    expect(plain.byRole.Developer?.resultLabel).toBe('MAIS VOTADO');

    const eq = summarizeRound(votes, people, 'tshirt', { tshirtEquivalents: { M: { value: 1, unit: 'dia' }, G: { value: 1, unit: 'semana' } } });
    expect(eq.tshirtNumeric).toBe(true);
    expect(eq.byRole.Developer?.resultLabel).toBe('MÉDIA (H)');
    expect(Number(eq.byRole.Developer?.resultValue)).toBeGreaterThan(8);
  });
});

describe('Copiar estimativa da rodada', () => {
  it('horas: "(DEV 10h / QA 4h / UX 2h)"', () => {
    const s = summarizeRound([V('d1', '8'), V('d2', '6'), V('d3', '16'), V('q1', '4'), V('u1', '2')], people, 'hours');
    expect(buildRoundCopyText(s, 'hours')).toBe('(DEV 10h / QA 4h / UX 2h)');
  });
  it('fibonacci usa " SP"; camisetas puras não levam unidade', () => {
    expect(copyUnitSuffix('fibonacci', false)).toBe(' SP');
    expect(copyUnitSuffix('tshirt', false)).toBe('');
    expect(copyUnitSuffix('tshirt', true)).toBe('h');
    const s = summarizeRound([V('d1', '5'), V('q1', '3')], people, 'fibonacci');
    expect(buildRoundCopyText(s, 'fibonacci')).toBe('(DEV 5 SP / QA 3 SP)');
  });
  it('sem votos técnicos devolve vazio', () => {
    expect(buildRoundCopyText(summarizeRound([V('sm', '8')], people, 'hours'), 'hours')).toBe('');
  });
});

describe('sumRoleHours', () => {
  it('soma por papel usando rolePoints ou os campos legados', () => {
    const totals = sumRoleHours([
      { rolePoints: { Developer: '10', QA: '4', UX: '2' } },
      { devPoints: '6', qaPoints: '3' },
      { rolePoints: { Developer: '0' } },
    ]);
    expect(totals).toEqual({ Developer: 16, QA: 7, UX: 2 });
  });
});

import { divergenceLabel } from '../poker-results';

describe('divergenceLabel', () => {
  const s = summarizeRound([V('d1', '6'), V('d2', '8'), V('d3', '16'), V('q1', '4'), V('q1', '4')], people, 'hours');
  it('mostra o pior caso com a faixa de horas', () => {
    expect(divergenceLabel(s, { Developer: 'destructive', QA: 'warning' }, 'hours')).toBe('Divergência crítica no DEV · 6h a 16h');
    expect(divergenceLabel(s, { Developer: 'warning' }, 'hours')).toBe('Divergência no DEV · 6h a 16h');
  });
  it('sem divergência não devolve nada; outros baralhos não mostram faixa', () => {
    expect(divergenceLabel(s, {}, 'hours')).toBeUndefined();
    expect(divergenceLabel(s, { Developer: 'destructive' }, 'fibonacci')).toBe('Divergência crítica no DEV');
  });
});
