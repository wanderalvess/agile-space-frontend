import { describe, expect, it, vi } from 'vitest';
import { buildCsv, buildMarkdown, buildReport, exportFileName, respondentsText } from '../health-check-export';
import { readPlanRecord, runPlan, writePlanRecord, type PlanDeps, type PlanItemInput } from '../health-check-plan';
import type { HealthCheckBoard, HealthCheckDimension, HealthCheckVote } from '../types';

const NOW = new Date(2026, 9, 16, 12, 0, 0);
const dims: HealthCheckDimension[] = [
  { key: 'a', title: 'Apoio e suporte', description: '' },
  { key: 'p', title: 'Processos | fluxo', description: '' },
];

const vote = (dimensionKey: string, value: string, comment = ''): HealthCheckVote =>
  ({ id: `${dimensionKey}-${value}-${Math.random()}`, boardId: 'b', participantId: '', participantRole: 'OUTRO', dimensionKey, value: value as HealthCheckVote['value'], comment, timestamp: '2026-10-16T10:00:00Z' }) as HealthCheckVote;

function board(scale: HealthCheckBoard['scaleType'], results: { dimensionKey: string; values: Record<string, number> }[]): Pick<HealthCheckBoard, 'sprintName' | 'team' | 'scaleType' | 'summary'> {
  return { sprintName: 'Radar Sprint 42', team: 'PHX', scaleType: scale, summary: { topMetrics: [], lowMetrics: [], results } };
}

describe('relatório do radar (semáforo)', () => {
  const b = board('traffic_light', [
    { dimensionKey: 'a', values: { green: 6, yellow: 3, red: 1 } },
    { dimensionKey: 'p', values: { green: 2, yellow: 5, red: 3 } },
  ]);
  const votes = [vote('p', 'red', 'Muita reunião, "pouca" decisão'), vote('p', 'green', '   '), vote('a', 'green', 'ok')];
  const report = buildReport({ board: b, dimensions: dims, votes, squadName: 'Phoenix', now: NOW });

  it('reúne nota, faixa, fortes e atenção pela regra única', () => {
    expect(report.title).toBe('Radar Sprint 42');
    expect(report.squad).toBe('Phoenix');
    expect(report.date).toBe('16/10/2026');
    expect(report.climate).toBeCloseTo(6, 5);
    expect(report.strong).toEqual(['Apoio e suporte']);
    expect(report.attention.map((a) => [a.title, a.level])).toEqual([['Processos | fluxo', 'critical']]);
    expect(report.totalVotes).toBe(20);
  });

  it('comentários anônimos sem texto vazio, por dimensão', () => {
    expect(report.dimensions[1].comments).toEqual(['Muita reunião, "pouca" decisão']);
    expect(report.dimensions[0].comments).toEqual(['ok']);
  });

  it('Markdown tem tabela com as colunas da escala, nota e situação', () => {
    const md = buildMarkdown(report);
    expect(md).toContain('# Radar de clima: Radar Sprint 42');
    expect(md).toContain('| Dimensão | Ótimo | Atenção | Ruim | Nota | Situação |');
    expect(md).toContain('| Apoio e suporte | 6 | 3 | 1 | 7,5 | Forte |');
    expect(md).toContain('| Processos \\| fluxo | 2 | 5 | 3 | 4,5 | Crítico |');
    expect(md).toContain('- Processos | fluxo (crítico): 3 de 10 votos ruins, nota 4,5');
    expect(md).toContain('**Nota de clima:** 6,0 de 10 (No caminho)');
    expect(md).toContain('Comentários anônimos');
  });

  it('CSV tem BOM, uma coluna por valor, média e nota, e escapa aspas', () => {
    const csv = buildCsv(report);
    expect(csv.charCodeAt(0)).toBe(0xfeff);
    const lines = csv.slice(1).split('\n');
    expect(lines[0]).toBe('"Data","Radar","Squad","Dimensão","Ótimo","Atenção","Ruim","Votos","Média (1 a 3)","Nota de clima (0 a 10)","Situação"');
    expect(lines[1]).toBe('"16/10/2026","Radar Sprint 42","Phoenix","Apoio e suporte","6","3","1","10","2,50","7,5","Forte"');
    expect(lines).toHaveLength(3);
  });
});

describe('relatório nas outras escalas (antes saíam zeros)', () => {
  it('escala de 1 a 5: uma coluna por nota', () => {
    const b = board('numbers_5', [
      { dimensionKey: 'a', values: { '5': 4, '4': 4, '3': 2 } },
      { dimensionKey: 'p', values: { '1': 3, '2': 2, '3': 5 } },
    ]);
    const r = buildReport({ board: b, dimensions: dims, votes: [], now: NOW });
    const csv = buildCsv(r).slice(1).split('\n');
    expect(csv[0]).toContain('"Nota 5","Nota 4","Nota 3","Nota 2","Nota 1"');
    expect(csv[0]).toContain('"Média (1 a 5)"');
    expect(csv[1]).toContain('"4","4","2","0","0"');
    expect(r.dimensions[1].level).toBe('critical');
    expect(buildMarkdown(r)).toContain('| Dimensão | Nota 5 | Nota 4 | Nota 3 | Nota 2 | Nota 1 | Nota | Situação |');
  });

  it('escala emocional: Bom, Médio, Ruim', () => {
    const b = board('emojis', [
      { dimensionKey: 'a', values: { happy: 7, neutral: 2, sad: 1 } },
      { dimensionKey: 'p', values: { happy: 1, neutral: 4, sad: 5 } },
    ]);
    const r = buildReport({ board: b, dimensions: dims, votes: [], now: NOW });
    expect(buildMarkdown(r)).toContain('| Dimensão | Bom | Médio | Ruim | Nota | Situação |');
    expect(r.attention).toHaveLength(1);
  });

  it('sem resumo no servidor, conta pelos votos', () => {
    const b = { sprintName: 'X', team: 'PHX', scaleType: 'traffic_light' as const, summary: undefined };
    const r = buildReport({ board: b, dimensions: dims, votes: [vote('a', 'green'), vote('a', 'red')], now: NOW });
    expect(r.dimensions[0].total).toBe(2);
  });

  it('sem nenhum voto, a nota fica vazia e nada quebra', () => {
    const r = buildReport({ board: board('traffic_light', []), dimensions: dims, votes: [], now: NOW });
    expect(r.climate).toBeNull();
    expect(buildMarkdown(r)).toContain('**Nota de clima:** — de 10');
    expect(buildCsv(r)).toContain('"Sem respostas"');
  });
});

describe('textos auxiliares', () => {
  it('respondentes por dimensão', () => {
    expect(respondentsText({ min: 10, max: 10 })).toBe('10 respostas por dimensão');
    expect(respondentsText({ min: 8, max: 10 })).toBe('8 a 10 respostas por dimensão');
    expect(respondentsText({ min: 1, max: 1 })).toBe('1 resposta por dimensão');
    expect(respondentsText({ min: 0, max: 0 })).toBe('Nenhuma resposta');
  });

  it('nome de arquivo sem acento, espaço nem símbolo', () => {
    expect(exportFileName('Radar da Sprint 42 · Phoenix!', 'csv', '2026-10-16')).toBe('radar-radar-da-sprint-42-phoenix-2026-10-16.csv');
    expect(exportFileName('???', 'pdf', '2026-10-16')).toBe('radar-clima-2026-10-16.pdf');
  });
});

describe('plano de ação', () => {
  const items: PlanItemInput[] = [
    { key: 'p', what: 'Melhorar: Processos', why: 'Radar: 3 de 10 votos ruins, nota 4,5.', who: 'Ana', priority: 'critica' },
    { key: 'v', what: 'Melhorar: Velocidade', why: 'Radar: 2 de 10 votos ruins, nota 5,5.', who: '', priority: 'media' },
  ];
  const deps = (over: Partial<PlanDeps> = {}): PlanDeps => ({
    createBoard: vi.fn(async () => ({ id: 'plano-1' })),
    createTask: vi.fn(async () => ({})),
    saveKanbanCard: vi.fn(async () => ({})),
    ...over,
  });

  it('plano da squad: cria o plano e uma ação por item, com quem e por quê', async () => {
    const d = deps();
    const r = await runPlan({ destination: 'squad', items, radarId: 'r1', radarTitle: 'Radar Sprint 42', team: 'PHX', deps: d });
    expect(d.createBoard).toHaveBeenCalledWith({ title: 'Plano de ação: Radar Sprint 42', team: 'PHX' });
    expect(d.createTask).toHaveBeenCalledTimes(2);
    expect(d.createTask).toHaveBeenNthCalledWith(1, 'plano-1', expect.objectContaining({ what: 'Melhorar: Processos', who: 'Ana', order: 0 }));
    expect(r).toMatchObject({ planId: 'plano-1', planFailed: false, outcomes: { p: 'ok', v: 'ok' } });
  });

  it('falha no meio: mostra o que foi criado e o que falta, e a nova tentativa só refaz o que faltou', async () => {
    let calls = 0;
    const d = deps({ createTask: vi.fn(async () => { calls += 1; if (calls === 2) throw new Error('x'); return {}; }) });
    const first = await runPlan({ destination: 'squad', items, radarId: 'r1', radarTitle: 'R', team: 'PHX', deps: d });
    expect(first.outcomes).toEqual({ p: 'ok', v: 'error' });
    const again = await runPlan({ destination: 'squad', items, radarId: 'r1', radarTitle: 'R', team: 'PHX', existingPlanId: first.planId, alreadyDone: new Set(['p']), deps: d });
    expect(d.createBoard).toHaveBeenCalledTimes(1);
    expect(d.createTask).toHaveBeenCalledTimes(3);
    expect(again.outcomes).toEqual({ p: 'ok', v: 'ok' });
  });

  it('plano da squad que não foi criado não tenta as ações', async () => {
    const d = deps({ createBoard: vi.fn(async () => { throw new Error('x'); }) });
    const r = await runPlan({ destination: 'squad', items, radarId: 'r1', radarTitle: 'R', team: 'PHX', deps: d });
    expect(r.planFailed).toBe(true);
    expect(d.createTask).not.toHaveBeenCalled();
    expect(r.outcomes).toEqual({ p: 'error', v: 'error' });
  });

  it('Kanban pessoal: um cartão por item, com a etiqueta e o link de origem', async () => {
    const d = deps();
    const r = await runPlan({ destination: 'kanban', items, radarId: 'r1', radarTitle: 'R', team: 'PHX', deps: d, now: NOW });
    expect(d.createBoard).not.toHaveBeenCalled();
    expect(d.saveKanbanCard).toHaveBeenCalledWith(expect.objectContaining({ title: 'Melhorar: Processos', priority: 'critica', tag: 'Radar de clima', originLink: '/health-check/r1' }));
    expect(r.outcomes).toEqual({ p: 'ok', v: 'ok' });
  });

  it('trava local do plano: grava e lê por radar, e aguenta armazenamento quebrado', () => {
    const mem = new Map<string, string>();
    const storage = { getItem: (k: string) => mem.get(k) ?? null, setItem: (k: string, v: string) => void mem.set(k, v) };
    expect(readPlanRecord('r1', storage)).toBeNull();
    writePlanRecord({ boardId: 'r1', destination: 'squad', planId: 'p1', items: [{ key: 'p', what: 'x' }], createdAt: 'agora' }, storage);
    expect(readPlanRecord('r1', storage)?.planId).toBe('p1');
    expect(readPlanRecord('r2', storage)).toBeNull();
    mem.set('healthCheck.plans.v1', '{quebrado');
    expect(readPlanRecord('r1', storage)).toBeNull();
    expect(readPlanRecord('r1', undefined)).toBeNull();
  });
});

describe('convite em texto', () => {
  it('diz o que é, quantas perguntas e o link, sem prometer prazo', async () => {
    const { buildInviteText } = await import('../health-check-export');
    expect(buildInviteText({ title: 'Radar Sprint 42', squad: 'Phoenix', dimensionCount: 8, url: 'https://x/health-check/1' })).toBe(
      'Radar de clima: Radar Sprint 42 da squad Phoenix. Responda quando puder: são 8 perguntas e as respostas são anônimas. Link: https://x/health-check/1'
    );
    expect(buildInviteText({ title: 'R', squad: '', dimensionCount: 1, url: 'u' })).toContain('são 1 pergunta e');
  });
});
