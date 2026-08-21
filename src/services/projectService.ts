/**
 * projectService.ts
 * Serviço de integração com o módulo de Projetos e Governança Profields.
 */

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8002/api';

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
  segmentName: string; // Ex: "Distribuição TOTVS Goiânia"
  tribeName: string;   // Ex: "Distribuição"
  locality: string;    // Ex: "Goiânia"
  vicePresident: string; // Ex: "Marcelo Eduardo Sant'anna Cosentino"
  vpArea: string;      // Ex: "Torres"

  // 2. Pessoas & Lideranças
  members: ProjectMemberRoleItem[];

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
  const token = typeof window !== 'undefined' ? localStorage.getItem('agile_space_token') : null;
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(token ? { 'Authorization': `Bearer ${token}` } : {})
  };

  const res = await fetch(`${API_BASE_URL}${url}`, {
    headers,
    ...options,
  });

  if (!res.ok) {
    const errorText = await res.text().catch(() => '');
    throw new Error(errorText || `Erro na requisição (${res.status})`);
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
    const params = new URLSearchParams();
    if (domain) params.append('domain', domain);

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (jiraToken) {
      headers['X-Jira-Token'] = jiraToken;
    }

    const res = await fetch(`${API_BASE_URL}/projects/sync/${encodeURIComponent(projectKey)}?${params.toString()}`, {
      method: 'POST',
      headers,
    });

    if (!res.ok) {
      const errorText = await res.text().catch(() => '');
      throw new Error(errorText || `Erro ao sincronizar projeto Profields (${res.status})`);
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
