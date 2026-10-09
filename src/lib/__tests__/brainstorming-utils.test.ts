import { describe, expect, it } from 'vitest';
import { applyGroupDeleted, applyIdeaDeleted, getQuadrant, ideaSignature, upsertById, votesOf } from '../brainstorming-utils';
import type { BrainstormingGroup, BrainstormingIdea } from '../types';

function idea(over: Partial<BrainstormingIdea> & { id: string }): BrainstormingIdea {
  return {
    boardId: 'b1', content: 'texto', authorId: 'u1', votes: [], position: { x: 0, y: 0 },
    parentId: null, groupId: null, createdAt: '2026-10-09T00:00:00Z', ...over,
  };
}

describe('getQuadrant', () => {
  it('ideia sem qualificadores ou 50/50 ainda não foi classificada (antes o Plano a tratava como Quick Win)', () => {
    expect(getQuadrant(undefined)).toBe('unclassified');
    expect(getQuadrant(null)).toBe('unclassified');
    expect(getQuadrant({})).toBe('unclassified');
    expect(getQuadrant({ roi: 50, effort: 50 })).toBe('unclassified');
  });

  it('mapeia os quatro quadrantes que a tela de matriz grava', () => {
    expect(getQuadrant({ roi: 80, effort: 20 })).toBe('quick_wins');
    expect(getQuadrant({ roi: 80, effort: 80 })).toBe('strategic');
    expect(getQuadrant({ roi: 20, effort: 20 })).toBe('secondary');
    expect(getQuadrant({ roi: 20, effort: 80 })).toBe('discard');
  });
});

describe('listas da sala', () => {
  it('upsertById insere novo e substitui existente mantendo a ordem', () => {
    const list = [idea({ id: 'a' }), idea({ id: 'b' })];
    expect(upsertById(list, idea({ id: 'c' })).map(i => i.id)).toEqual(['a', 'b', 'c']);
    const replaced = upsertById(list, idea({ id: 'a', content: 'novo' }));
    expect(replaced.map(i => i.id)).toEqual(['a', 'b']);
    expect(replaced[0].content).toBe('novo');
    expect(list[0].content).toBe('texto');
  });

  it('apagar ideia solta só a ligação das filhas', () => {
    const result = applyIdeaDeleted([idea({ id: 'p' }), idea({ id: 'c', parentId: 'p' }), idea({ id: 'x', parentId: 'outra' })], 'p');
    expect(result.map(i => i.id)).toEqual(['c', 'x']);
    expect(result[0].parentId).toBeNull();
    expect(result[1].parentId).toBe('outra');
  });

  it('apagar grupo devolve as ideias a "Sem grupo" (antes elas sumiam da tela)', () => {
    const groups: BrainstormingGroup[] = [
      { id: 'g1', boardId: 'b1', title: 'A', order: 0 },
      { id: 'g2', boardId: 'b1', title: 'B', order: 1 },
    ];
    const result = applyGroupDeleted(groups, [idea({ id: 'i1', groupId: 'g1' }), idea({ id: 'i2', groupId: 'g2' })], 'g1');
    expect(result.groups.map(g => g.id)).toEqual(['g2']);
    expect(result.ideas[0].groupId).toBeNull();
    expect(result.ideas[1].groupId).toBe('g2');
  });

  it('votesOf tolera ausência de votos', () => {
    expect(votesOf({ votes: ['a'] })).toEqual(['a']);
    expect(votesOf({ votes: undefined as unknown as string[] })).toEqual([]);
  });
});

describe('ideaSignature', () => {
  it('muda quando posição, ligação, texto, grupo ou votos mudam, e só então', () => {
    const base = [idea({ id: 'a', position: { x: 1, y: 2 } })];
    const same = ideaSignature([idea({ id: 'a', position: { x: 1, y: 2 } })]);
    expect(ideaSignature(base)).toBe(same);
    expect(ideaSignature([idea({ id: 'a', position: { x: 9, y: 2 } })])).not.toBe(same);
    expect(ideaSignature([idea({ id: 'a', position: { x: 1, y: 2 }, parentId: 'b' })])).not.toBe(same);
    expect(ideaSignature([idea({ id: 'a', position: { x: 1, y: 2 }, content: 'outro' })])).not.toBe(same);
    expect(ideaSignature([idea({ id: 'a', position: { x: 1, y: 2 }, votes: ['u'] })])).not.toBe(same);
    expect(ideaSignature([idea({ id: 'a', position: { x: 1, y: 2 }, groupId: 'g' })])).not.toBe(same);
  });
});
