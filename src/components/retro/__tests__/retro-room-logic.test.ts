import { describe, expect, it } from 'vitest';
import type { RetroCard, RetroColumnDef, RetroParticipant, TimerState } from '@/lib/types';
import { RETRO_TEMPLATES } from '../../../lib/types';
import {
  RETRO_PHASES,
  checkVote,
  contributionSummary,
  dueStatus,
  formatDueDate,
  formatDueShort,
  groupCardsByColumn,
  importCards,
  isActionCard,
  isColumnSortedByVotes,
  isStageNavLocked,
  mapGlobalToTeamRole,
  neighborStage,
  overlayPending,
  pausedTimer,
  planCardMove,
  presenceCategoryOf,
  removeById,
  resetTimer,
  resolveColumns,
  resumedTimer,
  retroPhase,
  sortColumnCards,
  startedTimer,
  timerFromBoard,
  upsertById,
  voteLimitMessage,
  voteLimitOptions,
  votesUsedInColumn,
} from '../retro-room-logic';

const card = (over: Partial<RetroCard> & { id: string }): RetroCard => ({
  boardId: 'b1',
  columnKey: 'wentWell',
  content: over.id,
  authorId: 'u1',
  votes: [],
  order: 1000,
  ...over,
});

describe('fases', () => {
  it('deriva a fase do estado do quadro', () => {
    expect(retroPhase({ isCardsRevealed: false, votingStatus: 'disabled' })).toBe('write');
    expect(retroPhase({ isCardsRevealed: true, votingStatus: 'disabled' })).toBe('reveal');
    expect(retroPhase({ isCardsRevealed: true, votingStatus: 'active' })).toBe('vote');
    expect(retroPhase({ isCardsRevealed: true, votingStatus: 'finished' })).toBe('act');
  });

  it('cards ocultos mandam: votação ativa sem revelar ainda é Escrever', () => {
    expect(retroPhase({ isCardsRevealed: false, votingStatus: 'active' })).toBe('write');
  });

  it('são quatro fases na ordem da cerimônia', () => {
    expect(RETRO_PHASES.map((p) => p.label)).toEqual(['Escrever', 'Revelar', 'Votar', 'Agir']);
  });
});

describe('colunas', () => {
  it('ordena pelas posições gravadas', () => {
    const cols: RetroColumnDef[] = [
      { id: 'b', title: 'B', theme: 'warning', order: 1 },
      { id: 'a', title: 'A', theme: 'success', order: 0 },
    ];
    expect(resolveColumns({ columns: cols }).map((c) => c.id)).toEqual(['a', 'b']);
  });

  it('quadro antigo sem colunas usa o modelo clássico', () => {
    expect(resolveColumns({ columns: undefined })).toBe(RETRO_TEMPLATES.classic);
    expect(resolveColumns({ columns: [] })).toBe(RETRO_TEMPLATES.classic);
  });

  it('card de coluna de ação, pelo tema ou pelo id antigo', () => {
    const cols = RETRO_TEMPLATES.classic;
    expect(isActionCard({ columnKey: 'actionItems' }, cols)).toBe(true);
    expect(isActionCard({ columnKey: 'wentWell' }, cols)).toBe(false);
    expect(isActionCard({ columnKey: 'actionItems' }, [])).toBe(true);
  });

  it('agrupa por coluna', () => {
    const g = groupCardsByColumn([card({ id: '1' }), card({ id: '2', columnKey: 'x' }), card({ id: '3' })]);
    expect(Object.keys(g).sort()).toEqual(['wentWell', 'x']);
    expect(g.wentWell.map((c) => c.id)).toEqual(['1', '3']);
  });
});

describe('ordem por votos', () => {
  it('sem escolha explícita ordena durante e depois da votação', () => {
    expect(isColumnSortedByVotes({ votingStatus: 'disabled' }, 'a')).toBe(false);
    expect(isColumnSortedByVotes({ votingStatus: 'active' }, 'a')).toBe(true);
    expect(isColumnSortedByVotes({ votingStatus: 'finished' }, 'a')).toBe(true);
  });

  it('a escolha do facilitador vale mais que o estado da votação', () => {
    expect(isColumnSortedByVotes({ votingStatus: 'active', columnSorts: { a: false } }, 'a')).toBe(false);
    expect(isColumnSortedByVotes({ votingStatus: 'disabled', columnSorts: { a: true } }, 'a')).toBe(true);
  });

  it('coluna de ação nunca ordena por votos', () => {
    expect(isColumnSortedByVotes({ votingStatus: 'finished', columnSorts: { a: true } }, 'a', 'action')).toBe(false);
  });

  it('ordena por votos com desempate pela ordem original, e sem duplicata', () => {
    const list = [
      card({ id: 'a', order: 3, votes: ['x'] }),
      card({ id: 'b', order: 1, votes: ['x', 'y'] }),
      card({ id: 'c', order: 2, votes: ['x'] }),
      card({ id: 'a', order: 3, votes: ['x'] }),
    ];
    expect(sortColumnCards(list, true).map((c) => c.id)).toEqual(['b', 'c', 'a']);
    expect(sortColumnCards(list, false).map((c) => c.id)).toEqual(['b', 'c', 'a']);
  });
});

describe('votos e limite por painel', () => {
  const cards = [
    card({ id: 'a', columnKey: 'good', votes: ['me'] }),
    card({ id: 'b', columnKey: 'good', votes: [] }),
    card({ id: 'c', columnKey: 'bad', votes: [] }),
  ];

  it('conta os votos usados só no painel', () => {
    expect(votesUsedInColumn(cards, 'good', 'me')).toBe(1);
    expect(votesUsedInColumn(cards, 'bad', 'me')).toBe(0);
  });

  it('votação fechada não aceita voto', () => {
    expect(checkVote({ board: { votingStatus: 'disabled', maxVotesPerParticipant: 3 }, cards, cardId: 'b', userId: 'me' })).toEqual({ ok: false, reason: 'closed' });
    expect(checkVote({ board: { votingStatus: 'finished' }, cards, cardId: 'b', userId: 'me' })).toEqual({ ok: false, reason: 'closed' });
  });

  it('card desconhecido', () => {
    expect(checkVote({ board: { votingStatus: 'active' }, cards, cardId: 'zzz', userId: 'me' })).toEqual({ ok: false, reason: 'unknown-card' });
  });

  it('no limite do painel bloqueia um voto novo, mas outro painel segue livre', () => {
    const board = { votingStatus: 'active' as const, maxVotesPerParticipant: 1 };
    expect(checkVote({ board, cards, cardId: 'b', userId: 'me' })).toEqual({ ok: false, reason: 'limit', max: 1 });
    expect(checkVote({ board, cards, cardId: 'c', userId: 'me' })).toEqual({ ok: true, removing: false });
  });

  it('retirar o voto passa mesmo no limite', () => {
    const board = { votingStatus: 'active' as const, maxVotesPerParticipant: 1 };
    expect(checkVote({ board, cards, cardId: 'a', userId: 'me' })).toEqual({ ok: true, removing: true });
  });

  it('sem limite (0 ou ausente) nunca bloqueia', () => {
    expect(checkVote({ board: { votingStatus: 'active', maxVotesPerParticipant: 0 }, cards, cardId: 'b', userId: 'me' })).toEqual({ ok: true, removing: false });
    expect(checkVote({ board: { votingStatus: 'active' }, cards, cardId: 'b', userId: 'me' })).toEqual({ ok: true, removing: false });
  });

  it('mensagem do limite concorda no singular e no plural', () => {
    expect(voteLimitMessage(1)).toContain('seu único voto');
    expect(voteLimitMessage(5)).toContain('seus 5 votos');
  });

  it('opções do limite incluem o valor atual fora da lista e deixam "Sem limite" por último', () => {
    expect(voteLimitOptions(5).map((o) => o.label)).toEqual(['3', '5', '10', 'Sem limite']);
    expect(voteLimitOptions(7).map((o) => o.value)).toEqual(['3', '5', '7', '10', '0']);
    expect(voteLimitOptions(0).map((o) => o.value)).toEqual(['3', '5', '10', '0']);
  });
});

describe('arrastar cards', () => {
  const base = (over: Partial<Parameters<typeof planCardMove>[0]> = {}) => ({
    allCards: [
      card({ id: 'a1', columnKey: 'good', order: 1000, authorId: 'me' }),
      card({ id: 'a2', columnKey: 'good', order: 2000, authorId: 'u2' }),
      card({ id: 'b1', columnKey: 'bad', order: 1000, authorId: 'u2' }),
    ],
    activeId: 'a1',
    overId: 'a2',
    overIsColumn: false,
    board: { isCardsRevealed: true, columnSorts: {}, maxVotesPerParticipant: 0 },
    userId: 'me',
    isCreator: false,
    now: 5000,
    ...over,
  });

  it('na fase anônima só o autor ou o facilitador move', () => {
    const board = { isCardsRevealed: false, columnSorts: {}, maxVotesPerParticipant: 0 };
    expect(planCardMove(base({ board, activeId: 'a2', overId: 'b1' }))).toEqual({ kind: 'blocked', reason: 'anonymous' });
    expect(planCardMove(base({ board, activeId: 'a2', overId: 'b1', isCreator: true })).kind).toBe('move');
    expect(planCardMove(base({ board, activeId: 'a1', overId: 'b1' })).kind).toBe('move');
  });

  it('card ou alvo inexistente é ignorado; soltar em si mesmo também', () => {
    expect(planCardMove(base({ activeId: 'nope' }))).toEqual({ kind: 'ignore' });
    expect(planCardMove(base({ overId: 'nope' }))).toEqual({ kind: 'ignore' });
    expect(planCardMove(base({ overId: 'a1' }))).toEqual({ kind: 'ignore' });
  });

  it('soltar na própria coluna (área vazia) não faz nada', () => {
    expect(planCardMove(base({ overId: 'good', overIsColumn: true }))).toEqual({ kind: 'ignore' });
  });

  it('coluna ordenada por votos não aceita reposicionar dentro dela', () => {
    const board = { isCardsRevealed: true, columnSorts: { good: true }, maxVotesPerParticipant: 0 };
    expect(planCardMove(base({ board }))).toEqual({ kind: 'ignore' });
  });

  it('soltar numa coluna manda o card para o fim dela', () => {
    const plan = planCardMove(base({ overId: 'bad', overIsColumn: true }));
    expect(plan.kind).toBe('move');
    if (plan.kind === 'move') expect(plan.moves).toEqual([expect.objectContaining({ id: 'a1', columnKey: 'bad', order: 2000 })]);
  });

  it('coluna de destino vazia usa o relógio como ordem', () => {
    const plan = planCardMove(base({ overId: 'nova', overIsColumn: true }));
    if (plan.kind === 'move') expect(plan.moves[0]).toMatchObject({ columnKey: 'nova', order: 5000 });
  });

  it('reordenar para depois do vizinho calcula o meio ou o fim', () => {
    const plan = planCardMove(base());
    expect(plan.kind).toBe('move');
    if (plan.kind === 'move') expect(plan.moves[0]).toMatchObject({ id: 'a1', order: 3000 });
  });

  it('entre dois cards usa o ponto médio', () => {
    const allCards = [
      card({ id: 'x', order: 1000 }),
      card({ id: 'y', order: 3000 }),
      card({ id: 'z', order: 5000 }),
    ];
    const plan = planCardMove(base({ allCards, activeId: 'z', overId: 'y', userId: 'u1' }));
    if (plan.kind === 'move') expect(plan.moves[0]).toMatchObject({ id: 'z', order: 2000 });
  });

  it('sem espaço entre os vizinhos renumera a coluna inteira', () => {
    const allCards = [
      card({ id: 'x', order: 10 }),
      card({ id: 'y', order: 10.5 }),
      card({ id: 'z', order: 99 }),
    ];
    const plan = planCardMove(base({ allCards, activeId: 'z', overId: 'y', userId: 'u1' }));
    expect(plan.kind).toBe('move');
    if (plan.kind === 'move') {
      expect(plan.moves.map((m) => [m.id, m.order])).toEqual([['x', 1000], ['z', 2000], ['y', 3000]]);
    }
  });

  it('mudar de painel com voto respeita o limite do painel de destino', () => {
    const allCards = [
      card({ id: 'a1', columnKey: 'good', authorId: 'me', votes: ['me'] }),
      card({ id: 'b1', columnKey: 'bad', authorId: 'u2', votes: ['me'] }),
    ];
    const board = { isCardsRevealed: true, columnSorts: {}, maxVotesPerParticipant: 1 };
    expect(planCardMove(base({ allCards, board, overId: 'bad', overIsColumn: true }))).toEqual({ kind: 'blocked', reason: 'vote-limit' });
    // sem voto no card, mover é livre
    const semVoto = [card({ id: 'a1', columnKey: 'good', authorId: 'me' }), allCards[1]];
    expect(planCardMove(base({ allCards: semVoto, board, overId: 'bad', overIsColumn: true })).kind).toBe('move');
  });
});

describe('navegação entre colunas', () => {
  const cols = RETRO_TEMPLATES.classic;
  it('anda com volta nas pontas', () => {
    expect(neighborStage(cols, 'wentWell', 1)).toBe('toImprove');
    expect(neighborStage(cols, 'actionItems', 1)).toBe('wentWell');
    expect(neighborStage(cols, 'wentWell', -1)).toBe('actionItems');
  });
  it('sem colunas, fica onde está', () => {
    expect(neighborStage([], 'x', 1)).toBe('x');
  });
  it('sincronização trava todo mundo menos o facilitador', () => {
    expect(isStageNavLocked({ syncStageEnabled: true }, false)).toBe(true);
    expect(isStageNavLocked({ syncStageEnabled: true }, true)).toBe(false);
    expect(isStageNavLocked({ syncStageEnabled: false }, false)).toBe(false);
    expect(isStageNavLocked({}, false)).toBe(false);
  });
});

describe('timer', () => {
  const running: TimerState = { status: 'running', endTime: 100_000, initialDuration: 300, remainingOnPause: 300 };

  it('inicia a partir de agora', () => {
    expect(startedTimer(120, 1000)).toEqual({ status: 'running', endTime: 121_000, initialDuration: 120, remainingOnPause: 120 });
  });

  it('pausar guarda o que sobrou; sem fim definido não faz nada', () => {
    expect(pausedTimer(running, 70_000)).toMatchObject({ status: 'paused', remainingOnPause: 30 });
    expect(pausedTimer(running, 200_000)).toMatchObject({ remainingOnPause: 0 });
    expect(pausedTimer({ ...running, endTime: null }, 0)).toBeNull();
    expect(pausedTimer(undefined, 0)).toBeNull();
  });

  it('retomar conta a partir do que sobrou', () => {
    const paused: TimerState = { status: 'paused', endTime: null, initialDuration: 300, remainingOnPause: 45 };
    expect(resumedTimer(paused, 1000)).toMatchObject({ status: 'running', endTime: 46_000 });
    expect(resumedTimer(undefined, 0)).toBeNull();
  });

  it('zerar volta à duração escolhida', () => {
    expect(resetTimer(running)).toEqual({ status: 'stopped', endTime: null, initialDuration: 300, remainingOnPause: 300 });
    expect(resetTimer(undefined)).toBeNull();
  });

  it('timer da tela tem padrões de 5 minutos', () => {
    expect(timerFromBoard(undefined)).toEqual({ status: 'stopped', initialDuration: 300, remainingOnPause: 300, endTime: null });
    expect(timerFromBoard({ ...running, endTime: '100000' as unknown as number }).endTime).toBe(100_000);
  });
});

describe('reducers dos eventos', () => {
  it('upsert troca o existente e acrescenta o novo', () => {
    const list = [card({ id: 'a', content: 'velho' })];
    expect(upsertById(list, card({ id: 'a', content: 'novo' }))[0].content).toBe('novo');
    expect(upsertById(list, card({ id: 'b' })).map((c) => c.id)).toEqual(['a', 'b']);
    expect(list[0].content).toBe('velho');
  });

  it('remove por id', () => {
    expect(removeById([card({ id: 'a' }), card({ id: 'b' })], 'a').map((c) => c.id)).toEqual(['b']);
  });

  it('importados substituem os de mesmo id e vão para o fim', () => {
    const out = importCards([card({ id: 'a' }), card({ id: 'b' })], [card({ id: 'a', content: 'x' }), card({ id: 'c' })]);
    expect(out.map((c) => c.id)).toEqual(['b', 'a', 'c']);
  });

  it('mudança em voo sobrevive ao eco do servidor', () => {
    const server = [card({ id: 'a', votes: [] }), card({ id: 'b' })];
    const pending = new Map([['a', card({ id: 'a', votes: ['me'] })]]);
    const out = overlayPending(server, pending);
    expect(out.find((c) => c.id === 'a')!.votes).toEqual(['me']);
    expect(overlayPending(server, new Map())).toEqual(server);
  });
});

describe('pessoas', () => {
  it('cargo global -> papel da retro', () => {
    expect(mapGlobalToTeamRole('Scrum Master')).toBe('AM');
    expect(mapGlobalToTeamRole('Product Owner (PO)')).toBe('PO');
    expect(mapGlobalToTeamRole('Tech Lead')).toBe('PL');
    expect(mapGlobalToTeamRole('Analista de QA')).toBe('QA');
    expect(mapGlobalToTeamRole('Designer / UI-UX')).toBe('UX');
    expect(mapGlobalToTeamRole('Desenvolvedor(a)')).toBe('DEV');
    expect(mapGlobalToTeamRole('SME')).toBe('SME');
    expect(mapGlobalToTeamRole('Stakeholder / Observador')).toBe('OUTRO');
  });

  it('categoria de presença', () => {
    expect(presenceCategoryOf('DEV')).toBe('Developer');
    expect(presenceCategoryOf('PO')).toBe('Management');
    expect(presenceCategoryOf('OUTRO')).toBeNull();
    expect(presenceCategoryOf(undefined)).toBeNull();
  });
});

describe('contribuições ao vivo', () => {
  const participants: RetroParticipant[] = [
    { id: 'me', boardId: 'b1', nickname: 'Você', isCreator: false },
    { id: 'u2', boardId: 'b1', nickname: 'Ana', isCreator: false },
  ];
  const cols = RETRO_TEMPLATES.classic;

  it('conta só colunas de feedback e separa a autoria que o servidor escondeu', () => {
    const cards = [
      card({ id: '1', authorId: 'me' }),
      card({ id: '2', authorId: '' as unknown as string, hidden: true }),
      card({ id: '3', authorId: 'u2' }),
      card({ id: '4', authorId: 'u2', columnKey: 'toImprove' }),
      card({ id: '5', authorId: 'me', columnKey: 'actionItems' }),
    ];
    const s = contributionSummary(cards, cols, participants, 'me');
    expect(s.total).toBe(4);
    expect(s.mine).toBe(1);
    expect(s.anonymous).toBe(1);
    expect(s.byAuthor).toEqual([
      { id: 'me', name: 'Você', count: 1 },
      { id: 'u2', name: 'Ana', count: 2 },
    ]);
  });

  it('quadro vazio', () => {
    expect(contributionSummary([], cols, participants, 'me')).toEqual({ total: 0, mine: 0, byAuthor: [], anonymous: 0 });
  });
});

describe('prazo das ações', () => {
  const now = new Date(2025, 9, 17, 15, 0, 0); // 17/10/2025

  it('vencido, perto e tranquilo', () => {
    expect(dueStatus('2025-10-16', false, now)).toBe('overdue');
    expect(dueStatus('2025-10-17', false, now)).toBe('soon');
    expect(dueStatus('2025-10-20', false, now)).toBe('soon');
    expect(dueStatus('2025-10-21', false, now)).toBe('ok');
  });

  it('ação concluída nunca vence; sem prazo ou prazo ilegível é none', () => {
    expect(dueStatus('2025-01-01', true, now)).toBe('ok');
    expect(dueStatus(undefined, false, now)).toBe('none');
    expect(dueStatus('amanhã', false, now)).toBe('none');
  });

  it('formata o prazo', () => {
    expect(formatDueDate('2025-10-22')).toBe('22/10/2025');
    expect(formatDueShort('2025-10-22T00:00:00Z')).toBe('22/10');
    expect(formatDueDate('semana que vem')).toBe('semana que vem');
    expect(formatDueDate(undefined)).toBe('');
  });
});
