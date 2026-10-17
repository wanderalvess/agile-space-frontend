import { describe, expect, it } from 'vitest';
import type { RetroBoard, RetroCard } from '../types';
import {
  filterLobbyRows,
  isRetroInProgress,
  mergeLobbyRows,
  pendingActionsOf,
  retroLobbyPhaseLabel,
  summarizeRetroBoard,
} from '../retro-lobby';

const board = (over: Partial<RetroBoard> = {}): RetroBoard => ({
  id: 'b1',
  creatorId: 'u1',
  isCardsRevealed: false,
  votingStatus: 'disabled',
  isAuthorsRevealed: false,
  createdAt: '2025-10-17T10:00:00Z',
  ...over,
});

const card = (over: Partial<RetroCard> & { id: string }): RetroCard => ({
  boardId: 'b1', columnKey: 'wentWell', content: 'texto', authorId: 'u1', votes: [], order: 1, ...over,
});

describe('situação da retro no lobby', () => {
  it('descreve a fase em palavras', () => {
    expect(retroLobbyPhaseLabel({ isCardsRevealed: false, votingStatus: 'disabled' })).toBe('Escrita');
    expect(retroLobbyPhaseLabel({ isCardsRevealed: true, votingStatus: 'disabled' })).toBe('Revelada');
    expect(retroLobbyPhaseLabel({ isCardsRevealed: true, votingStatus: 'active' })).toBe('Votação');
    expect(retroLobbyPhaseLabel({ isCardsRevealed: true, votingStatus: 'finished' })).toBe('Votação encerrada');
  });

  it('em andamento = criada nas últimas 24 h e sem votação encerrada', () => {
    const now = Date.parse('2025-10-17T18:00:00Z');
    expect(isRetroInProgress(board(), now)).toBe(true);
    expect(isRetroInProgress(board({ votingStatus: 'finished' }), now)).toBe(false);
    expect(isRetroInProgress(board({ createdAt: '2025-10-16T10:00:00Z' }), now)).toBe(false);
    expect(isRetroInProgress(board({ createdAt: 'nada' }), now)).toBe(false);
    expect(isRetroInProgress(board({ createdAt: '2025-10-18T10:00:00Z' }), now)).toBe(false);
  });
});

describe('ações e contagens', () => {
  const cards = [
    card({ id: '1' }),
    card({ id: '2', columnKey: 'toImprove' }),
    card({ id: '3', columnKey: 'actionItems', content: 'Congelar deploy', isDone: false }),
    card({ id: '4', columnKey: 'actionItems', content: 'Template de issue', isDone: true }),
    card({ id: '5', columnKey: 'actionItems', content: '   ' }),
  ];

  it('pendentes: só coluna de ação, sem concluídas e sem texto vazio', () => {
    expect(pendingActionsOf(board(), cards).map((c) => c.id)).toEqual(['3']);
  });

  it('resumo separa cartões de feedback das ações', () => {
    expect(summarizeRetroBoard(board(), cards)).toEqual({ cards: 2, actions: 3, actionsDone: 1 });
  });
});

describe('lista do lobby', () => {
  const remote = [board({ id: 'a', title: 'Retro 41', createdAt: '2025-10-03T10:00:00Z' }), board({ id: 'b', title: '', createdAt: '2025-09-19T10:00:00Z' })];

  it('junta servidor e navegador sem repetir, da mais nova para a mais antiga', () => {
    const rows = mergeLobbyRows(remote, [
      { roomId: 'a', title: 'Retro 41 (local)', team: 'X', createdAt: '2025-10-03T10:00:00Z' },
      { roomId: 'c', title: 'Retro 42', team: 'Phoenix', createdAt: '2025-10-15T10:00:00Z' },
    ]);
    expect(rows.map((r) => r.id)).toEqual(['c', 'a', 'b']);
    expect(rows.find((r) => r.id === 'a')!.title).toBe('Retro 41');
    expect(rows.find((r) => r.id === 'b')!.title).toBe('Retrospectiva sem título');
    expect(rows.find((r) => r.id === 'c')!.board).toBeUndefined();
  });

  it('filtra por ano e por ações abertas', () => {
    const rows = mergeLobbyRows(
      [board({ id: 'a', createdAt: '2025-10-03T10:00:00Z' }), board({ id: 'b', createdAt: '2024-09-19T10:00:00Z' })],
      [],
    );
    const open = new Map([['b', 2]]);
    const now = new Date('2025-10-17T10:00:00Z');
    expect(filterLobbyRows(rows, 'all', open, now)).toHaveLength(2);
    expect(filterLobbyRows(rows, 'year', open, now).map((r) => r.id)).toEqual(['a']);
    expect(filterLobbyRows(rows, 'open-actions', open, now).map((r) => r.id)).toEqual(['b']);
  });
});
