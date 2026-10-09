/**
 * projectService.ts
 * Serviço de integração com o módulo de Projetos e Governança Profields.
 */

import { authFetch } from '@/lib/auth-client';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8002/api';

async function callProfieldsSync(path: string, domain?: string, jiraToken?: string): Promise<ProjectDetail> {
  const params = new URLSearchParams();
  if (domain) params.append('domain', domain);

  const headers: Record<string, string> = {};
  if (jiraToken) {
    headers['X-Jira-Token'] = jiraToken;
  }

  const res = await authFetch(`${API_BASE_URL}${path}?${params.toString()}`, {
    method: 'POST',
    headers,
  });

  if (!res.ok) {
    const errorText = await res.text().catch(() => '');
    let errorMsg = errorText;
    try {
      const json = JSON.parse(errorText);
      errorMsg = json.message || json.error || errorText;
    } catch {}
    throw new Error(errorMsg || `Erro ao sincronizar projeto Profields (${res.status})`);
  }

  return res.json();
}

export interface ProjectMemberRoleItem {
  id?: string;
  projectId: string;
  roleName: string; // Ex: "Agile Master", "Product Owner"
  roleKey: string;  // Ex: "AGILE_MASTER", "PRODUCT_OWNER"
  jiraAccountId?: string;
  displayName: string;
  email?: string;
  avatarUrl?: string;
  userId?: string;
  leadership: boolean;
}

export interface ProjectDetail {
  id: string; // Ex: "DDWMISSI"
  name: string;
  
  // 1. Informações Gerais
  segmentName: string; // Ex: "Canal Corporativo"
  tribeName: string;   // Ex: "Distribuição"
  locality: string;    // Ex: "Goiânia"
  vicePresident: string; // Ex: "Marcelo Eduardo Sant'anna Cosentino"
  vpArea: string;      // Ex: "Torres"

  // 2. Pessoas & Lideranças
  members: ProjectMemberRoleItem[];

  /** Só na prévia da importação: false = quem importa não é AM/PL e o backend vai recusar a gravação. */
  canImport?: boolean;

  // 3. Status e Números
  devTeamSize: number; // Ex: 12
  status: string;      // Ex: "EM ANDAMENTO"
  creationDate: string; // Ex: "19/06/24"

  // 4. Campos de Validações de Fluxo
  autoTdnDoc: boolean;
  disableAutoSubtasks: boolean;
  specificSubtasks?: string;
  saasExpedition: boolean;
  engineeringOnlyExpedition: boolean;
  optionalWorklog: boolean;

  createdAt?: string;
  updatedAt?: string;
}

/** Corpo da confirmação da importação: campos editados e pessoas escolhidas na prévia. */
export interface ProjectImportConfirmBody {
  /** Nome do time (a chave do Jira, ex.: DDWMISSI, é só a referência). */
  name: string;
  segmentName: string;
  tribeName: string;
  locality: string;
  vicePresident: string;
  vpArea: string;
  status: string;
  creationDate: string;
  members: {
    jiraAccountId?: string;
    email?: string;
    displayName: string;
    roleName: string;
    linkToMe: boolean;
  }[];
}

export interface TribeGroup {
  tribeName: string;
  projects: {
    id: string;
    name: string;
    status: string;
    devTeamSize: number;
    locality: string;
    totalLeaders: number;
  }[];
}

export interface SegmentHierarchy {
  segmentName: string;
  tribes: TribeGroup[];
}

export interface UserProjectAccess {
  userId: string;
  email: string;
  name: string;
  primaryProjectId?: string;
  isTransversalLeader: boolean;
  projects: {
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

export const projectService = {
  /**
   * Lista todos os projetos com detalhes
   */
  async getAllProjects(): Promise<ProjectDetail[]> {
    return req<ProjectDetail[]>('/projects');
  },

  /**
   * Obtém a árvore de hierarquia: Segmento -> Tribos -> Projetos
   */
  async getHierarchy(): Promise<SegmentHierarchy[]> {
    return req<SegmentHierarchy[]>('/projects/hierarchy');
  },

  /**
   * Obtém detalhes completos de um projeto pelo Project Key (ex: "DDWMISSI")
   */
  async getProjectByKey(projectKey: string): Promise<ProjectDetail> {
    return req<ProjectDetail>(`/projects/${encodeURIComponent(projectKey)}`);
  },

  /**
   * Sincroniza um projeto via API Profields do Jira TOTVS
   */
  async syncProjectProfields(projectKey: string, domain?: string, jiraToken?: string): Promise<ProjectDetail> {
    return callProfieldsSync(`/projects/sync/${encodeURIComponent(projectKey)}`, domain, jiraToken);
  },

  /** Dry-run do sync: devolve o que seria importado do Profields sem gravar nada. */
  async previewProjectProfields(projectKey: string, domain?: string, jiraToken?: string): Promise<ProjectDetail> {
    return callProfieldsSync(`/projects/sync/${encodeURIComponent(projectKey)}/preview`, domain, jiraToken);
  },

  /** Confirma a importação com o que o usuário editou e selecionou na prévia. */
  async confirmProjectProfields(projectKey: string, body: ProjectImportConfirmBody, domain?: string, jiraToken?: string): Promise<ProjectDetail> {
    const params = new URLSearchParams();
    if (domain) params.append('domain', domain);
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (jiraToken) headers['X-Jira-Token'] = jiraToken;
    const res = await authFetch(`${API_BASE_URL}/projects/sync/${encodeURIComponent(projectKey)}/confirm?${params.toString()}`, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const errorText = await res.text().catch(() => '');
      let msg = errorText;
      try { const j = JSON.parse(errorText); msg = j.message || j.error || errorText; } catch {}
      throw new Error(msg || `Erro ao confirmar a importação (${res.status})`);
    }
    return res.json();
  },

  /**
   * Retorna os projetos e cargos acessíveis de um usuário
   */
  async getUserProjectAccess(identifier: string): Promise<UserProjectAccess> {
    return req<UserProjectAccess>(`/projects/user/${encodeURIComponent(identifier)}`);
  }
};
