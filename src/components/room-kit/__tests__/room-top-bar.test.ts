import { describe, it, expect } from 'vitest';
import { normalizeRoomTitle, pendingTiers, presenceLabel, presenceStack, type TopBarPerson } from '../room-top-bar-utils';

const person = (id: string, online: boolean): TopBarPerson => ({ id, name: `Pessoa ${id}`, online });

describe('normalizeRoomTitle', () => {
  it('apara e compacta espaços', () => {
    expect(normalizeRoomTitle('  Refinamento   da   Sprint 42 ', 'Sala')).toBe('Refinamento da Sprint 42');
  });

  it('não salva título vazio nem igual ao atual', () => {
    expect(normalizeRoomTitle('   ', 'Sala')).toBeNull();
    expect(normalizeRoomTitle('Sala', 'Sala')).toBeNull();
    expect(normalizeRoomTitle(' Sala ', 'Sala')).toBeNull();
  });
});

describe('presenceStack', () => {
  it('põe quem está online primeiro e mantém a ordem dentro de cada grupo', () => {
    const s = presenceStack([person('a', false), person('b', true), person('c', false), person('d', true)]);
    expect(s.visible.map((p) => p.id)).toEqual(['b', 'd', 'a', 'c']);
    expect(s.onlineCount).toBe(2);
    expect(s.total).toBe(4);
    expect(s.extra).toBe(0);
  });

  it('limita a pilha e conta o excedente', () => {
    const many = Array.from({ length: 8 }, (_, i) => person(String(i), true));
    const s = presenceStack(many, 5);
    expect(s.visible).toHaveLength(5);
    expect(s.extra).toBe(3);
  });

  it('sala vazia não quebra', () => {
    const s = presenceStack([]);
    expect(s).toEqual({ visible: [], extra: 0, onlineCount: 0, total: 0 });
  });

  it('descreve a presença em português', () => {
    expect(presenceLabel({ onlineCount: 3, total: 5 })).toBe('Participantes (3 online de 5)');
    expect(presenceLabel({ onlineCount: 1, total: 1 })).toBe('Participantes (1 online)');
    expect(presenceLabel({ onlineCount: 0, total: 0 })).toBe('Participantes (ninguém na sala)');
  });
});

describe('pendingTiers', () => {
  it('marca a camada que tem contagem ou ponto', () => {
    expect(pendingTiers([{ badge: 2 }, { tier: 'wide' }])).toEqual({ core: true, mid: false, wide: false });
    expect(pendingTiers([{ tier: 'mid', badge: 1 }])).toEqual({ core: false, mid: true, wide: false });
    expect(pendingTiers([{ tier: 'wide', dot: true }])).toEqual({ core: false, mid: false, wide: true });
  });

  it('contagem zero não conta como pendente', () => {
    expect(pendingTiers([{ badge: 0 }, { badge: undefined }])).toEqual({ core: false, mid: false, wide: false });
  });
});
