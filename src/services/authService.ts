/**
 * authService.ts
 * Serviço de Autenticação Padrão e Gestão de Sessão do Agile Space (TOTVS).
 */

import { UserProjectAccess } from './projectService';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8002/api';

export interface UserSession {
  id: string;
  email: string;
  name: string;
  role: string;
  authProvider: string;
  jiraAccountId?: string;
  avatarSeed?: string;
  activeProjectId?: string;
  activeProjectName?: string;
  activeProjectRole?: string;
  segmentName?: string;
  tribeName?: string;
  isTransversalLeader: boolean;
  accessibleProjects: {
    projectId: string;
    projectName: string;
    segmentName: string;
    tribeName: string;
    roleName: string;
    roleKey: string;
    isDirectAssignment: boolean;
    isLeadership: boolean;
  }[];
}

export interface AuthResponse extends UserSession {
  token: string;
  tokenType: string;
  expiresIn: number;
}

export interface LoginPayload {
  email: string;
  password?: string;
}

export interface RegisterPayload {
  email: string;
  name: string;
  password?: string;
  jiraAccountId?: string;
  defaultProjectId?: string;
  segmentName?: string;
  tribeName?: string;
}

export const authService = {
  /**
   * Realiza login e armazena o token na sessão
   */
  async login(payload: LoginPayload): Promise<AuthResponse> {
    const res = await fetch(`${API_BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => null);
      throw new Error(err?.message || 'E-mail ou senha incorretos');
    }

    const data: AuthResponse = await res.json();
    if (typeof window !== 'undefined' && data.token) {
      localStorage.setItem('agile_space_token', data.token);
      localStorage.setItem('agile_space_user', JSON.stringify(data));
    }
    return data;
  },

  /**
   * Registra novo usuário
   */
  async register(payload: RegisterPayload): Promise<AuthResponse> {
    const res = await fetch(`${API_BASE_URL}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => null);
      throw new Error(err?.message || 'Erro ao realizar cadastro');
    }

    const data: AuthResponse = await res.json();
    if (typeof window !== 'undefined' && data.token) {
      localStorage.setItem('agile_space_token', data.token);
      localStorage.setItem('agile_space_user', JSON.stringify(data));
    }
    return data;
  },

  /**
   * Obtém a sessão do usuário autenticado
   */
  async getMe(): Promise<UserSession | null> {
    const token = typeof window !== 'undefined' ? localStorage.getItem('agile_space_token') : null;
    if (!token) return null;

    try {
      const res = await fetch(`${API_BASE_URL}/auth/me`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!res.ok) {
        this.logout();
        return null;
      }

      const data: UserSession = await res.json();
      if (typeof window !== 'undefined') {
        localStorage.setItem('agile_space_user', JSON.stringify(data));
      }
      return data;
    } catch {
      return null;
    }
  },

  /**
   * Alterna o projeto ativo do usuário
   */
  async switchProject(userId: string, projectId: string): Promise<AuthResponse> {
    const token = typeof window !== 'undefined' ? localStorage.getItem('agile_space_token') : null;
    const res = await fetch(`${API_BASE_URL}/auth/switch-project?userId=${encodeURIComponent(userId)}&projectId=${encodeURIComponent(projectId)}`, {
      method: 'POST',
      headers: {
        ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
        'Content-Type': 'application/json',
      },
    });

    if (!res.ok) {
      throw new Error('Não foi possível alternar o projeto ativo');
    }

    const data: AuthResponse = await res.json();
    if (typeof window !== 'undefined' && data.token) {
      localStorage.setItem('agile_space_token', data.token);
      localStorage.setItem('agile_space_user', JSON.stringify(data));
    }
    return data;
  },

  /**
   * Encerra a sessão
   */
  logout() {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('agile_space_token');
      localStorage.removeItem('agile_space_user');
    }
  },

  /**
   * Retorna usuário do localStorage de forma síncrona
   */
  getLocalUser(): UserSession | null {
    if (typeof window === 'undefined') return null;
    const raw = localStorage.getItem('agile_space_user');
    if (!raw) return null;
    try {
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }
};
