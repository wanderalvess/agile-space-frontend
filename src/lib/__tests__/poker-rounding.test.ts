import { describe, it, expect } from 'vitest';
import { roundEstimate, resolveRoundingMode, calculateRoleEfforts, mapJiraTypeToIssueType } from '../poker-utils';
import type { Participant, Vote } from '../types';

describe('roundEstimate — arredondamento da média (configurável, padrão para cima)', () => {
  it('padrão e "up" arredondam sempre para cima', () => {
    expect(roundEstimate(2.1)).toBe(3);
    expect(roundEstimate(2.1, 'up')).toBe(3);
    expect(roundEstimate(4, 'up')).toBe(4);
  });

  it('"nearest" e "down" seguem a configuração', () => {
    expect(roundEstimate(2.4, 'nearest')).toBe(2);
    expect(roundEstimate(2.5, 'nearest')).toBe(3);
    expect(roundEstimate(2.9, 'down')).toBe(2);
  });

  it('"deck" encaixa na carta mais próxima do baralho e desempata para a maior', () => {
    expect(roundEstimate(4, 'deck', 'fibonacci')).toBe(5); // 3 e 5 empatam -> 5
    expect(roundEstimate(6, 'deck', 'fibonacci')).toBe(5);
    expect(roundEstimate(7, 'deck', 'fibonacci')).toBe(8);
    expect(roundEstimate(17, 'deck', 'fibonacci')).toBe(21);
    expect(roundEstimate(11, 'deck', 'hours')).toBe(12);
  });

  it('modo desconhecido ou ausente cai no padrão "up"', () => {
    expect(resolveRoundingMode(undefined)).toBe('up');
    expect(resolveRoundingMode('qualquer')).toBe('up');
    expect(resolveRoundingMode('deck')).toBe('deck');
  });

  it('calculateRoleEfforts usa o modo escolhido', () => {
    const dev = (id: string): Participant => ({ id, roomId: 'r', nickname: id, role: 'dev', globalRole: 'Developer' } as Participant);
    const vote = (id: string, value: string): Vote => ({ id: `r_${id}`, roomId: 'r', participantId: id, value, timestamp: '' });
    const people = [dev('a'), dev('b')];
    const votes = [vote('a', '2'), vote('b', '3')]; // média 2,5
    expect(calculateRoleEfforts(votes, people, 'fibonacci').rolePoints.Developer).toBe('3');
    expect(calculateRoleEfforts(votes, people, 'fibonacci', undefined, 'down').rolePoints.Developer).toBe('2');
    expect(calculateRoleEfforts(votes, people, 'fibonacci', undefined, 'deck').rolePoints.Developer).toBe('3');
  });
});

describe('mapJiraTypeToIssueType', () => {
  it('não confunde "Build" ou "Requirement" com design', () => {
    expect(mapJiraTypeToIssueType('Build')).toBe('other');
    expect(mapJiraTypeToIssueType('Requirement')).toBe('other');
    expect(mapJiraTypeToIssueType('UX Task')).toBe('design');
    expect(mapJiraTypeToIssueType('Bug')).toBe('qa');
  });
});
