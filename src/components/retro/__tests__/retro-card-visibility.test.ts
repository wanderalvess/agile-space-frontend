import { describe, it, expect } from 'vitest';
import { canShowCardContent } from '../retro-card-visibility';

const base = { isCardsRevealed: false, isAuthor: false, isActionPlan: false };

describe('canShowCardContent (anonimato da Retro)', () => {
  it('card oculto pelo servidor nunca mostra texto, nem depois que isCardsRevealed vira true', () => {
    expect(canShowCardContent({ hidden: true }, base)).toBe(false);
    expect(canShowCardContent({ hidden: true }, { ...base, isCardsRevealed: true })).toBe(false);
    expect(canShowCardContent({ hidden: true }, { ...base, isActionPlan: true })).toBe(false);
  });

  it('card completo: autor e coluna de ação veem antes de revelar; os demais só depois', () => {
    expect(canShowCardContent({}, base)).toBe(false);
    expect(canShowCardContent({ hidden: false }, { ...base, isAuthor: true })).toBe(true);
    expect(canShowCardContent({}, { ...base, isActionPlan: true })).toBe(true);
    expect(canShowCardContent({}, { ...base, isCardsRevealed: true })).toBe(true);
  });
});
