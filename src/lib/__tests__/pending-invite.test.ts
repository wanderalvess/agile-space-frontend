import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { PENDING_INVITE_TTL_MS, clearPendingInvite, readPendingInvite, savePendingInvite } from '../pending-invite';

describe('convite pendente do navegador', () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => localStorage.clear());

  it('guarda, lê e apaga o token', () => {
    savePendingInvite('abcdef1234567890');
    expect(readPendingInvite()).toBe('abcdef1234567890');
    clearPendingInvite();
    expect(readPendingInvite()).toBeNull();
  });

  it('expira depois do prazo', () => {
    savePendingInvite('abcdef1234567890');
    expect(readPendingInvite(Date.now() + PENDING_INVITE_TTL_MS + 1000)).toBeNull();
    expect(readPendingInvite()).toBeNull();
  });

  it('recusa token com formato estranho (não vira caminho de redirecionamento)', () => {
    savePendingInvite('../../evil');
    savePendingInvite('a b');
    expect(readPendingInvite()).toBeNull();
    localStorage.setItem('agileSpace_pendingInvite', '{"token":"//evil.com","at":1}');
    expect(readPendingInvite(2)).toBeNull();
    localStorage.setItem('agileSpace_pendingInvite', 'lixo');
    expect(readPendingInvite()).toBeNull();
  });
});
