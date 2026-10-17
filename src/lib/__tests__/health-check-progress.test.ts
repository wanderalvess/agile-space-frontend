import { describe, expect, it } from 'vitest';
import {
  finishedAtOf,
  followState,
  isBoardFinished,
  knownStage,
  pendingPeople,
  publishedStageOf,
  respondedLabel,
  respondedPercent,
  responseCounts,
  shouldRefetchProgress,
} from '../health-check-progress';
import { mergeHealthRows, rowFromBoard, summaryOfBoard } from '../health-check-lobby';
import type { HealthCheckBoard } from '../types';

const board = (over: Partial<HealthCheckBoard> = {}): HealthCheckBoard => ({
  id: 'b1', creatorId: 'u1', status: 'collecting', createdAt: '2026-10-14T10:00:00Z', dimensions: [{ key: 'a', title: 'A', description: '' }], scaleType: 'traffic_light', ...over,
});

describe('isBoardFinished: lifecycleStatus com fallback para status', () => {
  it('lê lifecycleStatus quando vem', () => {
    expect(isBoardFinished({ status: 'collecting', lifecycleStatus: 'FINISHED' })).toBe(true);
    expect(isBoardFinished({ status: 'finished', lifecycleStatus: 'OPEN' })).toBe(false);
  });
  it('backend antigo: cai no status', () => {
    expect(isBoardFinished({ status: 'finished' })).toBe(true);
    expect(isBoardFinished({ status: 'collecting' })).toBe(false);
  });
});

describe('finishedAtOf', () => {
  it('data real, ou nulo quando é desconhecida (nada de inventar)', () => {
    expect(finishedAtOf({ finishedAt: '2026-10-14T12:00:00Z' })?.toISOString()).toBe('2026-10-14T12:00:00.000Z');
    expect(finishedAtOf({ finishedAt: null })).toBeNull();
    expect(finishedAtOf({})).toBeNull();
    expect(finishedAtOf({ finishedAt: 'lixo' })).toBeNull();
  });
});

describe('responseCounts', () => {
  it('sem respondedCount (backend antigo) não há contagem', () => {
    expect(responseCounts({}, [{}, {}])).toBeNull();
    expect(responseCounts({ participantsCount: 3 })).toBeNull();
  });

  it('usa o total da lista de participantes já sincronizada', () => {
    expect(responseCounts({ respondedCount: 2, completedCount: 1, participantsCount: 9 }, [{}, {}, {}])).toEqual({ responded: 2, completed: 1, participants: 3 });
  });

  it('na lista do lobby (sem participantes carregados) usa participantsCount do quadro', () => {
    expect(responseCounts({ respondedCount: 5, participantsCount: 8 })).toEqual({ responded: 5, completed: null, participants: 8 });
  });

  it('nunca mostra mais respondentes do que pessoas (alguém saiu da sala) nem completos acima dos respondentes', () => {
    expect(responseCounts({ respondedCount: 5, completedCount: 4 }, [{}, {}, {}])).toEqual({ responded: 3, completed: 3, participants: 3 });
    expect(responseCounts({ respondedCount: 1, completedCount: 4, participantsCount: 3 })).toEqual({ responded: 1, completed: 1, participants: 3 });
  });

  it('sem nenhum total conhecido não inventa', () => {
    expect(responseCounts({ respondedCount: 2 })).toBeNull();
  });

  it('rótulo e percentual', () => {
    const c = { responded: 5, completed: 3, participants: 8 };
    expect(respondedLabel(c)).toBe('5 de 8 já responderam');
    expect(respondedLabel({ responded: 1, completed: null, participants: 1 })).toBe('1 de 1 já respondeu');
    expect(respondedLabel({ responded: 0, completed: null, participants: 4 })).toBe('0 de 4 já responderam');
    expect(respondedPercent(c)).toBe(63);
    expect(respondedPercent({ responded: 0, completed: null, participants: 0 })).toBe(0);
  });
});

describe('pendingPeople: "Ainda não votaram"', () => {
  const participants = [
    { id: 'u1', nickname: 'Carla' },
    { id: 'u2', nickname: 'Beto' },
    { id: 'u3', nickname: 'Ana' },
  ];

  it('resolve os nomes pelos participantes do quadro e ordena', () => {
    expect(pendingPeople({ pendingParticipantIds: ['u1', 'u3'] }, participants)).toEqual([{ id: 'u3', name: 'Ana' }, { id: 'u1', name: 'Carla' }]);
  });

  it('quem já saiu da sala, repetidos e ids inválidos ficam de fora', () => {
    expect(pendingPeople({ pendingParticipantIds: ['u2', 'u2', 'fantasma', 7 as unknown as string] }, participants)).toEqual([{ id: 'u2', name: 'Beto' }]);
  });

  it('lista vazia: todos votaram (diferente de "não sei")', () => {
    expect(pendingPeople({ pendingParticipantIds: [] }, participants)).toEqual([]);
  });

  it('sem o campo (não é o facilitador ou backend antigo) devolve null: o bloco não aparece', () => {
    expect(pendingPeople({}, participants)).toBeNull();
    expect(pendingPeople(null, participants)).toBeNull();
  });
});

describe('shouldRefetchProgress: refaz quando respondedCount muda', () => {
  const base = { enabled: true, finished: false };
  it('primeira vez e a cada mudança', () => {
    expect(shouldRefetchProgress({ ...base, respondedCount: 0, lastFetchedFor: null })).toBe(true);
    expect(shouldRefetchProgress({ ...base, respondedCount: 2, lastFetchedFor: 1 })).toBe(true);
  });
  it('não repete para o mesmo número', () => {
    expect(shouldRefetchProgress({ ...base, respondedCount: 2, lastFetchedFor: 2 })).toBe(false);
  });
  it('não consulta sem ser facilitador, com o radar encerrado ou sem o campo no servidor (backend antigo)', () => {
    expect(shouldRefetchProgress({ ...base, enabled: false, respondedCount: 2, lastFetchedFor: null })).toBe(false);
    expect(shouldRefetchProgress({ ...base, finished: true, respondedCount: 2, lastFetchedFor: null })).toBe(false);
    expect(shouldRefetchProgress({ ...base, respondedCount: undefined, lastFetchedFor: null })).toBe(false);
  });
});

describe('etapa da apresentação: publicar, seguir e soltar', () => {
  it('knownStage só aceita as etapas desta tela', () => {
    expect(knownStage('radar')).toBe('radar');
    expect(knownStage('freq')).toBe('freq');
    expect(knownStage('etapa-do-futuro')).toBeNull();
    expect(knownStage(null)).toBeNull();
    expect(knownStage(3)).toBeNull();
  });

  it('publishedStageOf: undefined = servidor sem o recurso; null = sem apresentação', () => {
    expect(publishedStageOf(undefined)).toBeUndefined();
    expect(publishedStageOf({})).toBeUndefined();
    expect(publishedStageOf({ presentationStage: null })).toBeNull();
    expect(publishedStageOf({ presentationStage: 'plan' })).toBe('plan');
  });

  it('participante segue a etapa publicada enquanto "Acompanhar" está ligado', () => {
    expect(followState({ follow: true, published: 'comments', isFacilitator: false })).toEqual({ following: true, stage: 'comments' });
  });

  it('solto (opção desligada), sem apresentação ou com etapa desconhecida: não segue', () => {
    expect(followState({ follow: false, published: 'comments', isFacilitator: false })).toEqual({ following: false, stage: null });
    expect(followState({ follow: true, published: null, isFacilitator: false })).toEqual({ following: false, stage: null });
    expect(followState({ follow: true, published: undefined, isFacilitator: false })).toEqual({ following: false, stage: null });
    expect(followState({ follow: true, published: 'etapa-do-futuro', isFacilitator: false })).toEqual({ following: false, stage: null });
  });

  it('o facilitador nunca segue (nem o ADMIN que publica)', () => {
    expect(followState({ follow: true, published: 'radar', isFacilitator: true })).toEqual({ following: false, stage: null });
  });
});

describe('lobby do Radar com os campos novos', () => {
  it('status vem de lifecycleStatus; sem ele, do status antigo', () => {
    expect(rowFromBoard(board({ status: 'collecting', lifecycleStatus: 'FINISHED' })).status).toBe('finished');
    expect(rowFromBoard(board({ status: 'finished' })).status).toBe('finished');
    expect(rowFromBoard(board()).status).toBe('collecting');
  });

  it('respostas: o histórico da Home manda; sem ele, respondedCount; sem nenhum, nulo (nada de zero inventado)', () => {
    expect(rowFromBoard(board({ respondedCount: 4, participantsCount: 6 })).answers).toBe(4);
    expect(rowFromBoard(board({ respondedCount: 4, participantsCount: 6 })).participants).toBe(6);
    expect(rowFromBoard(board({ respondedCount: 4 }), 9).answers).toBe(9);
    const old = rowFromBoard(board());
    expect(old.answers).toBeNull();
    expect(old.participants).toBeNull();
    expect(old.finishedAt).toBeNull();
  });

  it('finishedAt chega na linha', () => {
    expect(rowFromBoard(board({ status: 'finished', finishedAt: '2026-10-14T12:00:00Z' })).finishedAt).toBe('2026-10-14T12:00:00Z');
  });

  it('mergeHealthRows continua somando o que só existe neste navegador', () => {
    const rows = mergeHealthRows([board({ respondedCount: 1, participantsCount: 2 })], [{ roomId: 'x', title: 'Local', team: '', createdAt: '2026-10-01T10:00:00Z' }]);
    expect(rows.map((r) => r.id)).toEqual(['b1', 'x']);
    expect(rows[1].answers).toBeNull();
  });

  it('resumo só de radar encerrado (lifecycle ou status)', () => {
    const summary = { topMetrics: [], lowMetrics: [], results: [{ dimensionKey: 'a', values: { green: 2, yellow: 0, red: 0 } }] };
    expect(summaryOfBoard(board({ lifecycleStatus: 'FINISHED', summary }))).not.toBeNull();
    expect(summaryOfBoard(board({ summary }))).toBeNull();
  });
});
