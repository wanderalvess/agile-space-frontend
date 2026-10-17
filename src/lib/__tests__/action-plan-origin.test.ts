import { describe, expect, it, vi } from 'vitest';
import {
  PlanSourceConflictError,
  boardOrigin,
  checkOrigin,
  conflictOf,
  dueDateOf,
  findPlanBySource,
  formatDueDate,
  hasOriginContract,
  isOverdue,
  matchesDueFilter,
  matchesProgress,
  normalizeDueDate,
  normalizeSourceType,
  originChipLabel,
  planCounts,
  sortByDue,
  sourceRoute,
  todayIso,
} from '../action-plan-origin';
import type { ActionPlanBoard } from '../types';

const NOW = new Date(2026, 9, 17, 15, 30).getTime(); // 17/10/2026 15:30, fuso local

const plan = (over: Partial<ActionPlanBoard> = {}): ActionPlanBoard => ({
  id: 'p1', creatorId: 'u', title: 'Plano', team: 'PHX', createdAt: '2026-10-16T10:00:00Z', ...over,
});

describe('origem', () => {
  it('normaliza o tipo: minúsculas valem, ausente é desconhecido, estranho vira manual', () => {
    expect(normalizeSourceType('health_check')).toBe('HEALTH_CHECK');
    expect(normalizeSourceType(undefined)).toBeUndefined();
    expect(normalizeSourceType(null)).toBeUndefined();
    expect(normalizeSourceType('OUTRA')).toBe('MANUAL');
  });

  it('o servidor conhece origem quando devolve sourceType (MANUAL inclusive)', () => {
    expect(hasOriginContract(plan())).toBe(false);
    expect(hasOriginContract(plan({ sourceType: 'MANUAL' }))).toBe(true);
  });

  it('rota certa por tipo; manual e id vazio não têm rota', () => {
    expect(sourceRoute('RETRO', 'r1')).toBe('/retro/r1');
    expect(sourceRoute('HEALTH_CHECK', 'hc 1')).toBe('/health-check/hc%201');
    expect(sourceRoute('BRAINSTORMING', 'b1')).toBe('/brainstorming/b1');
    expect(sourceRoute('SHOWCASE', 's1')).toBe('/showcase/s1');
    expect(sourceRoute('MANUAL', 'x')).toBeNull();
    expect(sourceRoute('RETRO', '')).toBeNull();
    expect(sourceRoute(undefined, 'x')).toBeNull();
  });

  it('boardOrigin só existe para plano que veio de uma sessão', () => {
    expect(boardOrigin(plan())).toBeNull();
    expect(boardOrigin(plan({ sourceType: 'MANUAL' }))).toBeNull();
    expect(boardOrigin(plan({ sourceType: 'HEALTH_CHECK', sourceId: 'hc1', sourceTitle: ' Sprint 42 ' }))).toEqual({
      type: 'HEALTH_CHECK', label: 'Radar de clima', title: 'Sprint 42', href: '/health-check/hc1',
    });
    expect(boardOrigin(plan({ sourceType: 'SHOWCASE', sourceId: 's1' }))?.label).toBe('Review');
  });

  it('rótulo da tabela: vazio quando o servidor não sabe, Manual quando sabe', () => {
    expect(originChipLabel(plan())).toBe('');
    expect(originChipLabel(plan({ sourceType: 'MANUAL' }))).toBe('Manual');
    expect(originChipLabel(plan({ sourceType: 'RETRO' }))).toBe('Retro');
  });
});

describe('trava contra plano repetido', () => {
  it('conflictOf reconhece só o 409 e lê o existingPlanId', () => {
    expect(conflictOf(new PlanSourceConflictError('Já existe.', 'abc'))).toEqual({ existingPlanId: 'abc', message: 'Já existe.' });
    expect(conflictOf(new PlanSourceConflictError('Já existe.'))?.existingPlanId).toBeUndefined();
    expect(conflictOf({ status: 403, message: 'x' })).toBeNull();
    expect(conflictOf(new Error('queda'))).toBeNull();
    expect(conflictOf(null)).toBeNull();
  });

  it('findPlanBySource confere o tipo e o id, porque o backend antigo devolve a lista toda', () => {
    const list = [plan({ id: 'a' }), plan({ id: 'b', sourceType: 'RETRO', sourceId: 'r1' }), plan({ id: 'c', sourceType: 'HEALTH_CHECK', sourceId: 'r1' })];
    expect(findPlanBySource(list, 'HEALTH_CHECK', 'r1')?.id).toBe('c');
    expect(findPlanBySource(list, 'HEALTH_CHECK', 'outro')).toBeUndefined();
    expect(findPlanBySource([plan({ id: 'a' })], 'HEALTH_CHECK', 'r1')).toBeUndefined();
    expect(findPlanBySource(list, 'RETRO', '  ')).toBeUndefined();
  });

  const found = plan({ id: 'srv', title: 'Plano do servidor', sourceType: 'HEALTH_CHECK', sourceId: 'hc1' });
  const lock = { id: 'loc', title: 'Plano local' };

  it('o servidor achou: trava real', async () => {
    const r = await checkOrigin({ type: 'HEALTH_CHECK', sourceId: 'hc1', find: async () => [found], lock });
    expect(r).toEqual({ kind: 'server', plan: { id: 'srv', title: 'Plano do servidor' } });
  });

  it('sem plano no servidor e sem aviso local: livre', async () => {
    expect(await checkOrigin({ type: 'HEALTH_CHECK', sourceId: 'hc1', find: async () => [] })).toEqual({ kind: 'none', stale: false });
  });

  it('consulta falhou: o aviso local vale como reserva', async () => {
    const r = await checkOrigin({ type: 'HEALTH_CHECK', sourceId: 'hc1', find: async () => { throw new Error('queda'); }, lock });
    expect(r).toEqual({ kind: 'local', plan: lock });
  });

  it('backend antigo (plano do aviso volta sem origem): o aviso local continua valendo', async () => {
    const getBoard = vi.fn(async () => plan({ id: 'loc' }));
    const r = await checkOrigin({ type: 'HEALTH_CHECK', sourceId: 'hc1', find: async () => [plan({ id: 'x' })], getBoard, lock });
    expect(r).toEqual({ kind: 'local', plan: lock });
    expect(getBoard).toHaveBeenCalledWith('loc');
  });

  it('backend novo e o plano do aviso sumiu ou é de outra origem: o aviso fica velho e não trava', async () => {
    const gone = Object.assign(new Error('Plano de ação não encontrado.'), { status: 404 });
    expect(await checkOrigin({ type: 'HEALTH_CHECK', sourceId: 'hc1', find: async () => [], getBoard: async () => { throw gone; }, lock })).toEqual({ kind: 'none', stale: true });
    expect(await checkOrigin({ type: 'HEALTH_CHECK', sourceId: 'hc1', find: async () => [], getBoard: async () => plan({ id: 'loc', sourceType: 'MANUAL' }), lock })).toEqual({ kind: 'none', stale: true });
  });

  it('não deu para conferir o plano do aviso (403/rede): o aviso local vale', async () => {
    const r = await checkOrigin({ type: 'HEALTH_CHECK', sourceId: 'hc1', find: async () => [], getBoard: async () => { throw Object.assign(new Error('x'), { status: 403 }); }, lock });
    expect(r.kind).toBe('local');
  });
});

describe('contagens', () => {
  it('sem tasksTotal (backend antigo) não há contagem', () => {
    expect(planCounts(plan())).toBeNull();
  });

  it('calcula abertas e % concluído, sem passar de 100', () => {
    expect(planCounts(plan({ tasksTotal: 5, tasksDone: 2 }))).toEqual({ total: 5, done: 2, open: 3, pct: 40 });
    expect(planCounts(plan({ tasksTotal: 0, tasksDone: 0 }))).toEqual({ total: 0, done: 0, open: 0, pct: 0 });
    expect(planCounts(plan({ tasksTotal: 2, tasksDone: 9 }))?.done).toBe(2);
  });

  it('filtros: "com ações abertas" e "concluídos" saem das contagens; sem contagem não casam', () => {
    const some = planCounts(plan({ tasksTotal: 4, tasksDone: 1 }));
    const all = planCounts(plan({ tasksTotal: 4, tasksDone: 4 }));
    const empty = planCounts(plan({ tasksTotal: 0, tasksDone: 0 }));
    expect(matchesProgress(some, 'open')).toBe(true);
    expect(matchesProgress(some, 'done')).toBe(false);
    expect(matchesProgress(all, 'done')).toBe(true);
    expect(matchesProgress(all, 'open')).toBe(false);
    expect(matchesProgress(empty, 'done')).toBe(false);
    expect(matchesProgress(empty, 'open')).toBe(false);
    expect(matchesProgress(null, 'open')).toBe(false);
    expect(matchesProgress(null, 'all')).toBe(true);
  });
});

describe('prazo', () => {
  it('todayIso usa a data local', () => {
    expect(todayIso(NOW)).toBe('2026-10-17');
  });

  it('só aceita yyyy-MM-dd existente', () => {
    expect(normalizeDueDate('2026-10-25')).toBe('2026-10-25');
    expect(normalizeDueDate('2026-10-25T00:00:00')).toBe('2026-10-25');
    expect(normalizeDueDate('2026-02-30')).toBe('');
    expect(normalizeDueDate('25/10/2026')).toBe('');
    expect(normalizeDueDate(null)).toBe('');
    expect(dueDateOf({})).toBe('');
    expect(formatDueDate('2026-10-25')).toBe('25/10/2026');
    expect(formatDueDate('lixo')).toBe('');
  });

  it('atrasada: prazo antes de hoje e ação não concluída', () => {
    expect(isOverdue({ dueDate: '2026-10-16', status: 'todo' }, NOW)).toBe(true);
    expect(isOverdue({ dueDate: '2026-10-16', status: 'blocked' }, NOW)).toBe(true);
    expect(isOverdue({ dueDate: '2026-10-17', status: 'todo' }, NOW)).toBe(false); // vence hoje: ainda no prazo
    expect(isOverdue({ dueDate: '2026-10-18', status: 'todo' }, NOW)).toBe(false);
    expect(isOverdue({ dueDate: '2026-10-01', status: 'done' }, NOW)).toBe(false);
    expect(isOverdue({ dueDate: null, status: 'todo' }, NOW)).toBe(false);
    expect(isOverdue({ status: 'todo' }, NOW)).toBe(false);
  });

  it('filtro por prazo', () => {
    const late = { dueDate: '2026-10-01', status: 'doing' as const };
    const ok = { dueDate: '2026-12-01', status: 'todo' as const };
    const none = { status: 'todo' as const };
    expect([late, ok, none].filter((t) => matchesDueFilter(t, 'overdue', NOW))).toEqual([late]);
    expect([late, ok, none].filter((t) => matchesDueFilter(t, 'with', NOW))).toEqual([late, ok]);
    expect([late, ok, none].filter((t) => matchesDueFilter(t, 'without', NOW))).toEqual([none]);
    expect([late, ok, none].filter((t) => matchesDueFilter(t, 'all', NOW))).toHaveLength(3);
  });

  it('ordena pelo prazo mais próximo, sem prazo no fim, empate na ordem do plano', () => {
    const t = (id: string, dueDate?: string | null) => ({ id, dueDate });
    const sorted = sortByDue([t('a'), t('b', '2026-12-01'), t('c', '2026-11-01'), t('d', null), t('e', '2026-11-01')]);
    expect(sorted.map((x) => x.id)).toEqual(['c', 'e', 'b', 'a', 'd']);
  });
});
