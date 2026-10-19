'use client';

import { inviteErrorFrom } from '@/lib/invite-api';
import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import {
  authFetch,
  getAuthToken,
  setAuthToken,
  clearAuthToken,
  shouldRefreshToken,
  clearUserScopedStorage,
  rememberSessionUser,
  TOKEN_STORAGE_KEY,
  tokenUserId,
  UNAUTHORIZED_EVENT,
  type AuthResponse,
} from '@/lib/auth-client';
import { clearJustSignedUp } from '@/lib/team-welcome';
import { invalidateMyMemberships, resetMyMemberships } from '@/lib/memberships-store';
import { ApiError } from '@/lib/api-error';

/** Tempo máximo esperando o backend responder na abertura do app; passado isso o spinner não pode ficar eterno. */
const HYDRATE_TIMEOUT_MS = 15000;
/** Tentativas extras da checagem de sessão quando o servidor responde 429/5xx ou a rede falha. */
const HYDRATE_RETRIES = 3;
/** Depois que as tentativas esgotam com o token ainda guardado, continua tentando de tempos em tempos (servidor voltando de deploy/queda). */
const RECOVER_INTERVAL_MS = 5000;
const RECOVER_MAX_ATTEMPTS = 120;

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
  acceptInvite: (token: string) => Promise<AuthResponse>;
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

  // Limpa só o que é local. Usado também quando o servidor já recusou o token (401): chamar o servidor
  // de novo aqui geraria outro 401 e outro evento.
  const clearSessionLocally = useCallback(() => {
    clearAuthToken();
    clearUserScopedStorage();
    resetMyMemberships();
    setSession(null);
  }, []);

  // Saída pedida pela pessoa: avisa o servidor (best-effort) para invalidar o token, inclusive em outros
  // aparelhos, e limpa o local de qualquer jeito. fetch puro, não authFetch, para um 401 não virar evento.
  const logout = useCallback(() => {
    const token = getAuthToken();
    if (token) {
      void fetch(`${API_BASE_URL}/auth/logout`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        keepalive: true,
      }).catch(() => {});
    }
    clearSessionLocally();
  }, [clearSessionLocally]);

  // Hidrata a sessão a partir do token salvo, validando-o contra o backend
  useEffect(() => {
    const token = getAuthToken();
    if (!token) {
      setIsLoading(false);
      return;
    }

    let cancelled = false;
    let controller: AbortController | null = null;

    const wait = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms));

    const hydrate = async () => {
      for (let attempt = 0; attempt <= HYDRATE_RETRIES; attempt++) {
        controller = new AbortController();
        const timer = setTimeout(() => controller?.abort(), HYDRATE_TIMEOUT_MS);
        let retryAfterMs = 0;
        try {
          const res = await authFetch(`${API_BASE_URL}/auth/me`, { signal: controller.signal });
          if (cancelled) return;
          if (res.ok) {
            const data: AuthResponse = await res.json();
            if (cancelled) return;
            rememberSessionUser(data.id);
            setSession(data);
            return;
          }
          // Só 401/403 significam "token inválido". 429 (limite de requisições), 5xx (deploy, banco fora) e
          // falhas de rede são passageiros: o token fica guardado e a checagem é refeita, em vez de mandar
          // a pessoa ao login por um soluço do servidor.
          if (res.status === 401 || res.status === 403) {
            clearAuthToken();
            setSession(null);
            return;
          }
          const header = Number(res.headers.get('Retry-After'));
          retryAfterMs = Number.isFinite(header) && header > 0 ? Math.min(header, 10) * 1000 : 0;
        } catch {
          if (cancelled) return;
        } finally {
          clearTimeout(timer);
        }
        if (attempt < HYDRATE_RETRIES) await wait(retryAfterMs || 800 * 2 ** attempt);
        if (cancelled) return;
      }
      // Esgotou as tentativas: mantém o token, só não há sessão agora. Sem o laço abaixo a pessoa ficava no login
      // mesmo com o servidor de volta e o token válido, até recarregar a página.
      setSession(null);
      return 'retry-later' as const;
    };

    // Servidor ainda fora: tenta de novo em segundo plano até voltar (ou o token ser recusado, ou a pessoa sair).
    const recover = async () => {
      for (let attempt = 0; attempt < RECOVER_MAX_ATTEMPTS; attempt++) {
        await wait(RECOVER_INTERVAL_MS);
        if (cancelled || !getAuthToken()) return;
        const recoverController = new AbortController();
        const timer = setTimeout(() => recoverController.abort(), HYDRATE_TIMEOUT_MS);
        try {
          const res = await authFetch(`${API_BASE_URL}/auth/me`, { signal: recoverController.signal });
          if (cancelled) return;
          if (res.ok) {
            const data: AuthResponse = await res.json();
            if (cancelled) return;
            rememberSessionUser(data.id);
            setSession(data);
            return;
          }
          if (res.status === 401 || res.status === 403) {
            clearAuthToken();
            return;
          }
        } catch {
          if (cancelled) return;
        } finally {
          clearTimeout(timer);
        }
      }
    };

    hydrate()
      .then((outcome) => {
        if (!cancelled) setIsLoading(false);
        if (outcome === 'retry-later') return recover();
      })
      .catch(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
      controller?.abort();
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
    const handleUnauthorized = () => clearSessionLocally();
    window.addEventListener(UNAUTHORIZED_EVENT, handleUnauthorized);
    return () => window.removeEventListener(UNAUTHORIZED_EVENT, handleUnauthorized);
  }, [clearSessionLocally]);

  // Renovação deslizante: com a sessão aberta, passada a metade da validade o token é trocado por um novo
  // (o servidor limita a sessão a 7 dias desde o login). Falha de rede não derruba a sessão; 401 sim,
  // via authFetch. Também confere ao voltar para a aba, que pode ter ficado dormindo.
  const hasSession = session !== null;
  useEffect(() => {
    if (!hasSession) return;
    let running = false;
    const tick = async () => {
      if (running || !shouldRefreshToken(getAuthToken())) return;
      running = true;
      try {
        const res = await authFetch(`${API_BASE_URL}/auth/refresh`, { method: 'POST' });
        if (res.ok) {
          const data: AuthResponse = await res.json();
          if (data?.token) setAuthToken(data.token);
        }
      } catch {
        /* sem rede agora: tenta de novo no próximo ciclo */
      } finally {
        running = false;
      }
    };
    const onVisible = () => {
      if (document.visibilityState === 'visible') void tick();
    };
    const timer = setInterval(() => void tick(), 5 * 60 * 1000);
    document.addEventListener('visibilitychange', onVisible);
    void tick();
    return () => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [hasSession]);

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
    // Os vínculos não mudam com a troca, mas a squad ativa validada sim: refaz a leitura.
    invalidateMyMemberships();
    setSession(data);
  }, []);

  const createProject = useCallback(async (payload: CreateProjectPayload) => {
    const res = await authFetch(`${API_BASE_URL}/projects`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      throw new ApiError(await parseErrorMessage(res, 'Não foi possível criar o projeto'), res.status);
    }
    const data: AuthResponse = await res.json();
    invalidateMyMemberships();
    setSession(data);
    return data;
  }, []);

  const joinProject = useCallback(async (projectKey: string, roleName: string) => {
    const res = await authFetch(
      `${API_BASE_URL}/projects/${encodeURIComponent(projectKey)}/join?roleName=${encodeURIComponent(roleName)}`,
      { method: 'POST' }
    );
    if (!res.ok) {
      throw new ApiError(await parseErrorMessage(res, 'Não foi possível entrar no projeto'), res.status);
    }
    const data: AuthResponse = await res.json();
    // Entrou por escolha própria: o aviso "encontramos o seu e-mail" só vale pro vínculo automático do cadastro.
    clearJustSignedUp();
    invalidateMyMemberships();
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
      throw new ApiError(await parseErrorMessage(res, 'Não foi possível concluir o vínculo'), res.status);
    }
    const data: AuthResponse = await res.json();
    clearJustSignedUp();
    invalidateMyMemberships();
    setSession(data);
    return data;
  }, []);

  /** Aceita o convite e já adota a sessão devolvida (com a squad ativa), pra não cair de volta no onboarding. */
  const acceptInvite = useCallback(async (token: string) => {
    const res = await authFetch(`${API_BASE_URL}/invites/${encodeURIComponent(token)}/accept`, { method: 'POST' });
    if (!res.ok) {
      // 429 vira InviteApiError (status 429) para a página do convite oferecer "Tentar de novo" em vez de "inválido".
      if (res.status === 429) throw await inviteErrorFrom(res);
      throw new Error(await parseErrorMessage(res, 'Não foi possível aceitar o convite.'));
    }
    const data: AuthResponse = await res.json();
    clearJustSignedUp();
    if (data.token) setAuthToken(data.token);
    invalidateMyMemberships();
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
        acceptInvite,
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
