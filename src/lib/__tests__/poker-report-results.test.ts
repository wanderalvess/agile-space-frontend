import { describe, it, expect } from 'vitest';
import { buildSessionReport } from '../poker-report';
import { buildReportKpiItems, buildResultsPage, situationSummary } from '../poker-report-results';
import { bigSession, smallSession } from './fixtures/poker-report-sample';

describe('página de resultados', () => {
  const big = buildResultsPage(buildSessionReport(bigSession()));

  it('números-chave batem com o relatório completo', () => {
    const ids = big.kpis.map((k) => k.id);
    expect(ids).toEqual(['estimated', 'total', 'first', 'avg', 'divergent', 'largest']);
    expect(big.kpis[0]).toMatchObject({ value: '8', unit: 'de 12' });
    expect(big.kpis[1]).toMatchObject({ value: '125', unit: 'h', main: true });
    expect(big.kpis.find((k) => k.id === 'divergent')?.tone).toBe('danger');
    expect(big.kpis.find((k) => k.id === 'largest')?.value).toBe('31h');
  });

  it('horas por papel somam o total e as barras seguem a maior', () => {
    expect(big.roleBars.map((b) => b.label)).toEqual(['DEV', 'QA', 'UX', 'DESIGNER']);
    expect(big.roleBars.reduce((s, b) => s + b.value, 0)).toBe(125);
    expect(big.roleBars[0].ratio).toBe(1);
    expect(big.roleBars.reduce((s, b) => s + b.share, 0)).toBeCloseTo(1, 5);
  });

  it('situação das tarefas cobre toda a pauta', () => {
    expect(big.situation.reduce((s, x) => s + x.count, 0)).toBe(12);
    expect(big.situation.reduce((s, x) => s + x.share, 0)).toBeCloseTo(1, 5);
    expect(situationSummary(big.situation)).toContain('6 consenso');
  });

  it('maiores (até 3) e pendências', () => {
    expect(big.largest.map((l) => l.task.totalLabel)).toEqual(['31h', '26h', '19h']);
    expect(big.pending.map((p) => p.task.key)).toEqual(['PTV-1206', 'PTV-1208', 'PTV-1211']);
    expect(big.cancelled).toBe(1);
    expect(big.omitted).toEqual([]);
  });

  it('não inventa dados: sem rodadas, sem horário e sem facilitador viram avisos', () => {
    const input = smallSession();
    const r = buildResultsPage(
      buildSessionReport({ ...input, rounds: [], sessionStartedAt: undefined, sessionEndedAt: undefined, participants: input.participants.filter((p) => !p.isFacilitator) })
    );
    expect(r.kpis.map((k) => k.id)).not.toContain('first');
    expect(r.kpis.map((k) => k.id)).not.toContain('avg');
    expect(r.durationLabel).toBeNull();
    expect(r.omitted.join(' ')).toMatch(/rodadas/);
    expect(r.omitted.join(' ')).toMatch(/Duração/);
    expect(r.omitted.join(' ')).toMatch(/Facilitador/);
  });

  it('baralho sem horas não mostra horas por papel e avisa', () => {
    const input = bigSession();
    const r = buildResultsPage(buildSessionReport({ ...input, deck: 'fibonacci' }));
    expect(r.roleBars).toEqual([]);
    expect(r.omitted.join(' ')).toMatch(/Horas por papel/);
  });

  it('indicadores do documento executivo mantêm a ordem', () => {
    const labels = buildReportKpiItems(buildSessionReport(bigSession())).map((k) => k.label);
    expect(labels.slice(0, 2)).toEqual(['Tarefas estimadas', 'Total de horas']);
    expect(labels).toContain('Esforço DESIGNER');
    expect(labels[labels.length - 1]).toBe('Tempo gasto');
  });
});
