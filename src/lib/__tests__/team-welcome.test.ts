import { describe, it, expect, beforeEach } from 'vitest';
import { clearJustSignedUp, hasLinkedTeam, isJustSignedUp, markJustSignedUp } from '../team-welcome';

describe('team-welcome', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('marca, lê e limpa o sinal de conta recém-criada', () => {
    expect(isJustSignedUp()).toBe(false);
    markJustSignedUp();
    expect(isJustSignedUp()).toBe(true);
    clearJustSignedUp();
    expect(isJustSignedUp()).toBe(false);
  });

  it('só considera time vinculado quando há um projeto de verdade', () => {
    expect(hasLinkedTeam('DDWMISSI')).toBe(true);
    expect(hasLinkedTeam('Sem Time')).toBe(false);
    expect(hasLinkedTeam('')).toBe(false);
    expect(hasLinkedTeam('   ')).toBe(false);
    expect(hasLinkedTeam(undefined)).toBe(false);
    expect(hasLinkedTeam(null)).toBe(false);
  });
});
