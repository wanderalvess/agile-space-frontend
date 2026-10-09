'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import {
  authFetch,
  getAuthToken,
  setAuthToken,
  clearAuthToken,
  clearUserScopedStorage,
  rememberSessionUser,
  TOKEN_STORAGE_KEY,
  tokenUserId,
  UNAUTHORIZED_EVENT,
  type AuthResponse,
} from '@/lib/auth-client';

/** Tempo máximo esperando o backend responder na abertura do app; passado isso o spinner não pode ficar eterno. */
const HYDRATE_TIMEOUT_MS = 15000;

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || process.env.NEXT_PUBLIC_SPRING_API_URL || 'http://localhost:8002/api';

interface RegisterPayload {
  email: string;
  name: string;
  password: string;
  jiraAccountId?: string;
}

interface CreateProjectPayload {
  id: string;
  name: string;
  segmentName?: string;
  tribeName?: string;
}

interface AuthContextType {
  session: AuthResponse | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<AuthResponse>;
  register: (payload: RegisterPayload) => Promise<AuthResponse>;
  logout: () => void;
  switchProject: (projectId: string) => Promise<void>;
  createProject: (payload: CreateProjectPayload) => Promise<AuthResponse>;
  joinProject: (projectKey: string, roleName: string) => Promise<AuthResponse>;
  claimRosterMember: (memberId: string) => Promise<AuthResponse>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

async function parseErrorMessage(res: Response, fallback: string): Promise<string> {
  try {
    const body = await res.json();
    return body?.message || body?.error || fallback;
  } catch {
    return fallback;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<AuthResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const logout = useCallback(() => {
    clearAuthToken();
    clearUserScopedStorage();
    setSession(null);
  }, []);

  // Hidrata a sessão a partir do token salvo, validando-o contra o backend
  useEffect(() => {
    const token = getAuthToken();
    if (!token) {
      setIsLoading(false);
      return;
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), HYDRATE_TIMEOUT_MS);

    authFetch(`${API_BASE_URL}/auth/me`, { signal: controller.signal })
      .then(async (res) => {
        if (!res.ok) {
          // Só 401/403 significam "token inválido". Erro 5xx (deploy, banco fora) não pode derrubar a
          // sessão: o token fica guardado e recarregar a página depois que o servidor voltar restaura a sessão.
          if (res.status === 401 || res.status === 403) clearAuthToken();
          setSession(null);
          return;
        }
        const data: AuthResponse = await res.json();
        rememberSessionUser(data.id);
        setSession(data);
      })
      .catch(() => {
        // Rede fora ou tempo esgotado: mantém o token, só não há sessão agora.
        setSession(null);
      })
      .finally(() => {
        clearTimeout(timer);
        setIsLoading(false);
      });

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, []);

  // Outra aba entrou, saiu ou trocou de conta: esta aba não pode continuar mostrando (e enviando) como a
  // pessoa anterior. Recarregar refaz a sessão a partir do token que está guardado agora.
  useEffect(() => {
    const handleStorage = (event: StorageEvent) => {
      if (event.key !== TOKEN_STORAGE_KEY) return;
      if (event.newValue === event.oldValue) return;
      // Mesma pessoa entrando de novo em outra aba: nada a refazer aqui (e não perde o que está sendo digitado).
      if (event.newValue && event.oldValue && tokenUserId(event.newValue) === tokenUserId(event.oldValue)) return;
      window.location.reload();
    };
    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, []);

  // Reage a 401s vindos de qualquer chamada autenticada (token expirado/inválido)
  useEffect(() => {
    const handleUnauthorized = () => logout();
    window.addEventListener(UNAUTHORIZED_EVENT, handleUnauthorized);
    return () => window.removeEventListener(UNAUTHORIZED_EVENT, handleUnauthorized);
  }, [logout]);

  const login = useCallback(async (email: string, password: string) => {
    const res = await fetch(`${API_BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    if (!res.ok) {
      throw new Error(await parseErrorMessage(res, 'E-mail ou senha incorretos'));
    }
    const data: AuthResponse = await res.json();
    rememberSessionUser(data.id);
    setAuthToken(data.token);
    setSession(data);
    return data;
  }, []);

  const register = useCallback(async (payload: RegisterPayload) => {
    const res = await fetch(`${API_BASE_URL}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      throw new Error(await parseErrorMessage(res, 'Não foi possível concluir o cadastro'));
    }
    const data: AuthResponse = await res.json();
    rememberSessionUser(data.id);
    setAuthToken(data.token);
    setSession(data);
    return data;
  }, []);

  const switchProject = useCallback(async (projectId: string) => {
    const res = await authFetch(`${API_BASE_URL}/auth/switch-project?projectId=${encodeURIComponent(projectId)}`, {
      method: 'POST',
    });
    if (!res.ok) {
      throw new Error(await parseErrorMessage(res, 'Não foi possível trocar de projeto'));
    }
    const data: AuthResponse = await res.json();
    setSession(data);
  }, []);

  const createProject = useCallback(async (payload: CreateProjectPayload) => {
    const res = await authFetch(`${API_BASE_URL}/projects`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      throw new Error(await parseErrorMessage(res, 'Não foi possível criar o projeto'));
    }
    const data: AuthResponse = await res.json();
    setSession(data);
    return data;
  }, []);

  const joinProject = useCallback(async (projectKey: string, roleName: string) => {
    const res = await authFetch(
      `${API_BASE_URL}/projects/${encodeURIComponent(projectKey)}/join?roleName=${encodeURIComponent(roleName)}`,
      { method: 'POST' }
    );
    if (!res.ok) {
      throw new Error(await parseErrorMessage(res, 'Não foi possível entrar no projeto'));
    }
    const data: AuthResponse = await res.json();
    setSession(data);
    return data;
  }, []);

  /**
   * "Sou eu": liga a conta a uma pessoa que já existe no roster do projeto,
   * preservando o papel que veio do Jira. Resolve o caso do e-mail do Jira
   * diferente do e-mail de login sem precisar de convite.
   */
  const claimRosterMember = useCallback(async (memberId: string) => {
    const res = await authFetch(`${API_BASE_URL}/onboarding/claim/${encodeURIComponent(memberId)}`, {
      method: 'POST',
    });
    if (!res.ok) {
      throw new Error(await parseErrorMessage(res, 'Não foi possível concluir o vínculo'));
    }
    const data: AuthResponse = await res.json();
    setSession(data);
    return data;
  }, []);

  return (
    <AuthContext.Provider
      value={{
        session,
        isAuthenticated: !!session,
        isLoading,
        login,
        register,
        logout,
        switchProject,
        createProject,
        joinProject,
        claimRosterMember,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
