import { describe, it, expect, beforeEach } from 'vitest';
import { clearJustSignedUp, hasLinkedTeam, isJustSignedUp, JUST_SIGNED_UP_TTL_MS, markJustSignedUp } from '../team-welcome';

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

  it('o sinal expira depois do TTL e não sobra para o próximo login', () => {
    localStorage.setItem('agileSpace_justSignedUp', String(Date.now() - JUST_SIGNED_UP_TTL_MS - 1000));
    expect(isJustSignedUp()).toBe(false);
    expect(localStorage.getItem('agileSpace_justSignedUp')).toBeNull();
    localStorage.setItem('agileSpace_justSignedUp', '1'); // formato antigo sem data: inválido
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
