import { DECKS, type DeckType } from './types';

/** Horas máximas do baralho "Horas reais" nas salas novas. */
export const HOURS_MAX_DEFAULT = 40;
/** Limites do valor personalizado (inteiro). */
export const HOURS_MAX_MIN = 1;
export const HOURS_MAX_LIMIT = 100;
/** Maior carta do baralho completo de horas: sala sem o campo equivale a este limite. */
export const HOURS_MAX_FULL_DECK = 50;
/** Opções prontas da configuração "Horas máximas do baralho". */
export const HOURS_MAX_PRESETS = [8, 16, 20, 24, 30, 40, 50] as const;

/**
 * Limite lido da configuração da sala. `undefined` = sala sem o campo (criada antes da opção):
 * mantém o baralho completo. Aceita número ou texto numérico; arredonda para baixo e prende em 1..100.
 */
export function normalizeMaxHours(value: unknown): number | undefined {
  if (value === null || value === undefined || value === '') return undefined;
  const n = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(n)) return undefined;
  return Math.min(HOURS_MAX_LIMIT, Math.max(HOURS_MAX_MIN, Math.floor(n)));
}

const isNumericCard = (v: string) => v.trim() !== '' && !Number.isNaN(Number(v));

/**
 * Cartas que valem para votar. Só o baralho de horas é limitado: ficam as cartas numéricas até o
 * limite (a própria carta do limite entra se não existir no baralho padrão) e as especiais
 * ("?" e café) continuam. Sem limite informado, devolve o baralho completo.
 */
export function getDeckCards(deck: DeckType, maxHours?: unknown): readonly string[] {
  const full = DECKS[deck] ?? [];
  if (deck !== 'hours') return full;
  const max = normalizeMaxHours(maxHours);
  if (max === undefined) return full;
  const numbers = full.filter((v) => isNumericCard(v) && Number(v) <= max);
  if (!numbers.includes(String(max))) {
    numbers.push(String(max));
    numbers.sort((a, b) => Number(a) - Number(b));
  }
  return [...numbers, ...full.filter((v) => !isNumericCard(v))];
}

/** Valor mostrado na configuração: sala sem o campo equivale ao baralho completo (50). */
export function effectiveMaxHours(value: unknown): number {
  return normalizeMaxHours(value) ?? HOURS_MAX_FULL_DECK;
}
