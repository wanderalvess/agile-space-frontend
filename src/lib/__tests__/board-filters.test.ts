import { describe, expect, it } from 'vitest';
import { matchesPersonFilter } from '../board-filters';

const issue = { assignee: 'ana.souza', assigneeName: 'Ana Paula Souza' };

describe('matchesPersonFilter', () => {
  it('acha pelo nome inteiro, sem acento nem diferença de caixa', () => {
    expect(matchesPersonFilter('ana paula', issue)).toBe(true);
    expect(matchesPersonFilter('JOÃO', { assigneeName: 'Joao Lima' })).toBe(true);
  });
  it('acha pelo primeiro nome, pelo nome ou pelo login', () => {
    expect(matchesPersonFilter('Ana', issue)).toBe(true);
    expect(matchesPersonFilter('Ana Maria', issue)).toBe(true);
    expect(matchesPersonFilter('Ana', { assignee: 'ana.souza' })).toBe(true);
  });
  it('acha pelo campo "dev" da issue', () => {
    expect(matchesPersonFilter('Bruno', { assigneeName: 'Carla', extraFields: [{ label: 'Dev responsável', value: 'Bruno Alves' }] })).toBe(true);
  });
  it('não confunde pessoas diferentes nem pega trecho de outra palavra', () => {
    expect(matchesPersonFilter('Carla', issue)).toBe(false);
    expect(matchesPersonFilter('Paulo', { assigneeName: 'Paula Reis', assignee: 'paula.reis' })).toBe(false);
  });
  it('filtro vazio ou issue sem responsável não casa', () => {
    expect(matchesPersonFilter('', issue)).toBe(false);
    expect(matchesPersonFilter('Ana', {})).toBe(false);
  });
});
