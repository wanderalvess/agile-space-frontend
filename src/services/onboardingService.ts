/**
 * onboardingService.ts
 *
 * Superfície do onboarding "reconhecer antes de perguntar" (backend:
 * OnboardingController). Diferente de projectService.getAllProjects, o roster
 * aqui vem sem e-mail completo — só nome, papel e e-mail mascarado.
 */

import { authFetch } from '@/lib/auth-client';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8002/api';

export interface OnboardingCandidate {
  memberId: string;
  displayName: string;
  roleName: string;
  roleKey: string;
  avatarUrl?: string;
  /** Papel de liderança: entra por convite ou sync do Jira, nunca por autovínculo. */
  leadership: boolean;
  /** Já existe conta ligada a essa pessoa. */
  claimed: boolean;
  /** A conta ligada é a sua. */
  claimedByMe: boolean;
  /** Dá pra clicar em "sou eu". */
  claimable: boolean;
  /** Ex: "w*******n@totvs.com.br" — ajuda a desempatar homônimos sem expor contato. */
  emailHint?: string;
}

export interface OnboardingRoster {
  projectId: string;
  projectName: string;
  segmentName?: string;
  tribeName?: string;
  memberCount: number;
  members: OnboardingCandidate[];
}

async function req<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await authFetch(`${API_BASE_URL}${url}`, options);
  if (!res.ok) {
    const errorText = await res.text().catch(() => '');
    let errorMsg = errorText;
    try {
      const json = JSON.parse(errorText);
      errorMsg = json.message || json.error || errorText;
    } catch {}
    throw new Error(errorMsg || `Erro na requisição (${res.status})`);
  }
  if (res.status === 204) return undefined as T;
  return res.json();
}

export const onboardingService = {
  /** Linhas do roster com o seu nome, ainda sem conta vinculada. */
  async suggestions(): Promise<OnboardingRoster[]> {
    return req<OnboardingRoster[]>('/onboarding/suggestions');
  },

  /** Busca por time (chave/nome) ou por pessoa. */
  async search(query: string): Promise<OnboardingRoster[]> {
    return req<OnboardingRoster[]>(`/onboarding/search?q=${encodeURIComponent(query)}`);
  },

  /** Roster completo de um projeto. */
  async roster(projectKey: string): Promise<OnboardingRoster> {
    return req<OnboardingRoster>(`/onboarding/roster/${encodeURIComponent(projectKey)}`);
  },
};
