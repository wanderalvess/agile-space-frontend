// @vitest-environment jsdom
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';

const authFetch = vi.fn();
const clearAuthToken = vi.fn();
let storedToken: string | null = 'token-de-teste';

vi.mock('../../lib/auth-client', () => ({
  authFetch: (...args: unknown[]) => authFetch(...args),
  getAuthToken: () => storedToken,
  setAuthToken: vi.fn(),
  clearAuthToken: () => clearAuthToken(),
  clearUserScopedStorage: vi.fn(),
  rememberSessionUser: vi.fn(),
  tokenUserId: () => 'u1',
  TOKEN_STORAGE_KEY: 'agileSpace_auth_token',
  UNAUTHORIZED_EVENT: 'agilespace:unauthorized',
}));

import { AuthProvider, useAuth } from '../AuthContext';

function res(status: number, body?: unknown, headers: Record<string, string> = {}) {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: { get: (k: string) => headers[k] ?? null },
    json: async () => body,
  } as unknown as Response;
}

function Probe() {
  const { isAuthenticated, isLoading } = useAuth();
  return <div data-testid="estado">{isLoading ? 'carregando' : isAuthenticated ? 'logado' : 'deslogado'}</div>;
}

describe('AuthProvider - checagem da sessão ao abrir a página', () => {
  beforeEach(() => {
    authFetch.mockReset();
    clearAuthToken.mockReset();
    storedToken = 'token-de-teste';
  });
  afterEach(() => vi.useRealTimers());

  it('429 passageiro não manda a pessoa ao login: tenta de novo e entra', async () => {
    authFetch
      .mockResolvedValueOnce(res(429, undefined, { 'Retry-After': '0' }))
      .mockResolvedValueOnce(res(200, { id: 'u1', token: 't', email: 'a@totvs.com.br', name: 'Ana', role: 'MEMBER' }));
    render(<AuthProvider><Probe /></AuthProvider>);
    await waitFor(() => expect(screen.getByTestId('estado').textContent).toBe('logado'), { timeout: 5000 });
    expect(authFetch).toHaveBeenCalledTimes(2);
    expect(clearAuthToken).not.toHaveBeenCalled();
  });

  it('401 apaga o token e fica deslogado sem insistir', async () => {
    authFetch.mockResolvedValue(res(401));
    render(<AuthProvider><Probe /></AuthProvider>);
    await waitFor(() => expect(screen.getByTestId('estado').textContent).toBe('deslogado'));
    expect(clearAuthToken).toHaveBeenCalledTimes(1);
    expect(authFetch).toHaveBeenCalledTimes(1);
  });

  it('erro 5xx persistente esgota as tentativas, fica deslogado mas MANTÉM o token', async () => {
    authFetch.mockResolvedValue(res(503, undefined, { 'Retry-After': '0' }));
    render(<AuthProvider><Probe /></AuthProvider>);
    await waitFor(() => expect(screen.getByTestId('estado').textContent).toBe('deslogado'), { timeout: 12000 });
    expect(authFetch).toHaveBeenCalledTimes(4); // 1 + 3 tentativas extras
    expect(clearAuthToken).not.toHaveBeenCalled();
  }, 15000);

  it('sem token nem chama o servidor', async () => {
    storedToken = null;
    render(<AuthProvider><Probe /></AuthProvider>);
    await waitFor(() => expect(screen.getByTestId('estado').textContent).toBe('deslogado'));
    expect(authFetch).not.toHaveBeenCalled();
  });
});
