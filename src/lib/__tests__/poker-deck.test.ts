import { describe, it, expect } from 'vitest';
import { DECKS } from '../types';
import { HOURS_MAX_DEFAULT, HOURS_MAX_PRESETS, effectiveMaxHours, getDeckCards, normalizeMaxHours } from '../poker-deck';

const SPECIAL = ['?', '☕'];

describe('getDeckCards — baralho de horas com limite', () => {
  it('sala sem o campo (antiga) mantém o baralho completo', () => {
    expect(getDeckCards('hours')).toEqual(DECKS.hours);
    expect(getDeckCards('hours', undefined)).toEqual(DECKS.hours);
    expect(getDeckCards('hours', null)).toEqual(DECKS.hours);
    expect(effectiveMaxHours(undefined)).toBe(50);
  });

  it('padrão das salas novas é 40: corta 45 e 50 e mantém "?" e café', () => {
    expect(HOURS_MAX_DEFAULT).toBe(40);
    const cards = getDeckCards('hours', HOURS_MAX_DEFAULT);
    expect(cards).not.toContain('45');
    expect(cards).not.toContain('50');
    expect(cards.slice(-3)).toEqual(['40', '?', '☕']);
    expect(cards.filter((c) => !SPECIAL.includes(c))).toEqual(DECKS.hours.filter((c) => !SPECIAL.includes(c) && Number(c) <= 40));
  });

  it.each([8, 16, 20, 30, 50])('limite %i só tem cartas numéricas até ele', (max) => {
    const nums = getDeckCards('hours', max).filter((c) => !SPECIAL.includes(c)).map(Number);
    expect(Math.max(...nums)).toBe(max);
    expect(nums).toEqual([...nums].sort((a, b) => a - b));
    expect(getDeckCards('hours', max).slice(-2)).toEqual(SPECIAL);
  });

  it('limite 8 tem 0 a 8 mais as especiais', () => {
    expect(getDeckCards('hours', 8)).toEqual(['0', '1', '2', '3', '4', '5', '6', '7', '8', '?', '☕']);
  });

  it('limite fora das cartas existentes entra como carta (24 entre 20 e 25)', () => {
    const cards = getDeckCards('hours', 24);
    expect(cards.slice(-5)).toEqual(['18', '20', '24', '?', '☕']);
    expect(cards).not.toContain('25');
  });

  it('limite acima de 50 acrescenta a própria carta (60, 100)', () => {
    expect(getDeckCards('hours', 60).slice(-4)).toEqual(['50', '60', '?', '☕']);
    expect(getDeckCards('hours', 100).slice(-4)).toEqual(['50', '100', '?', '☕']);
  });

  it('prende em 1..100, arredonda para baixo e ignora lixo', () => {
    expect(normalizeMaxHours(0)).toBe(1);
    expect(normalizeMaxHours(-5)).toBe(1);
    expect(normalizeMaxHours(250)).toBe(100);
    expect(normalizeMaxHours(12.9)).toBe(12);
    expect(normalizeMaxHours('16')).toBe(16);
    expect(normalizeMaxHours('abc')).toBeUndefined();
    expect(normalizeMaxHours(null)).toBeUndefined();
    expect(normalizeMaxHours('')).toBeUndefined();
    expect(getDeckCards('hours', 'abc')).toEqual(DECKS.hours);
  });

  it('os outros baralhos não mudam, com ou sem limite', () => {
    expect(getDeckCards('fibonacci', 8)).toEqual(DECKS.fibonacci);
    expect(getDeckCards('tshirt', 8)).toEqual(DECKS.tshirt);
  });

  it('todas as opções prontas geram baralho com a própria carta de limite', () => {
    for (const max of HOURS_MAX_PRESETS) expect(getDeckCards('hours', max)).toContain(String(max));
  });
});
