/**
 * greenhopperService.ts
 * Serviço de integração com o Jira Greenhopper / Jira Agile (RapidBoard).
 * Consome o endpoint /rest/greenhopper/1.0/xboard/work/allData.json
 */

import { authFetch } from '@/lib/auth-client';

export interface GreenhopperColumn {
  id: number | string;
  name: string;
  statusIds: (number | string)[];
  min?: number | null;
  max?: number | null;
  isMinQuery?: boolean;
  isMaxQuery?: boolean;
  color?: string;
}

export interface GreenhopperSwimlane {
  id: number | string;
  name: string;
  query?: string;
  isDefault?: boolean;
  description?: string;
  issueIds?: (number | string)[];
}

export interface GreenhopperQuickFilter {
  id: number | string;
  name: string;
  query?: string;
  description?: string;
}

export interface GreenhopperSprint {
  id: number | string;
  name: string;
  state: 'ACTIVE' | 'CLOSED' | 'FUTURE';
  daysRemaining?: number;
  startDate?: string;
  endDate?: string;
  completeDate?: string;
}

export interface GreenhopperIssueEstimate {
  statFieldId?: string;
  statFieldValue?: {
    value?: number;
    text?: string;
  };
}

export interface GreenhopperIssue {
  id: number | string;
  key: string;
  summary: string;
  typeName?: string;
  typeUrl?: string;
  priorityName?: string;
  priorityUrl?: string;
  statusId: number | string;
  statusName?: string;
  statusUrl?: string;
  statusCategory?: 'new' | 'indeterminate' | 'done' | 'unknown';
  assignee?: string;
  assigneeName?: string;
  avatarUrl?: string;
  color?: string;
  estimateStatistic?: GreenhopperIssueEstimate;
  trackingStatistic?: GreenhopperIssueEstimate;
  extraFields?: { id: string; label: string; value: string }[];
  tags?: string[];
  fixVersions?: { id: string; name: string }[];
  epic?: string;
  epicField?: { key?: string; summary?: string; text?: string; color?: string };
  isSubtask?: boolean;
  parentKey?: string;
  parentTitle?: string;
  subTasks?: { id: string | number; key: string; statusId: string | number; isDone: boolean }[];
  dueDate?: string;
  swimlaneId?: number | string;
}

export interface GreenhopperWorkData {
  rapidViewId: number | string;
  boardName?: string;
  selectedProjectKey?: string;
  columnsData: {
    columns: GreenhopperColumn[];
  };
  swimlanesData: {
    swimlanes: GreenhopperSwimlane[];
  };
  issuesData: {
    issues: GreenhopperIssue[];
  };
  quickFiltersData: {
    quickFilters: GreenhopperQuickFilter[];
  };
  sprintsData?: {
    sprints: GreenhopperSprint[];
  };
  canEdit?: boolean;
  /** true quando NÃO há quadro real do Jira (falta configuração ou o carregamento falhou); o quadro vem vazio. */
  isFallback?: boolean;
  /** Motivo legível do fallback, pra distinguir "não configurado" de "erro de conexão". */
  fallbackReason?: string;
}

/**
 * Quadro vazio usado enquanto não há dado real do Jira (nunca dados inventados). Quando o carregamento
 * falha ou falta configuração, o chamador recebe este quadro com `isFallback` e o motivo, e a tela mostra
 * um estado vazio explicando o que fazer.
 */
export const EMPTY_GREENHOPPER_DATA: GreenhopperWorkData = {
  rapidViewId: '',
  boardName: '',
  selectedProjectKey: '',
  columnsData: { columns: [] },
  swimlanesData: { swimlanes: [{ id: 1, name: 'Todo o Resto', isDefault: true }] },
  issuesData: { issues: [] },
  quickFiltersData: { quickFilters: [] },
};

/**
 * Consulta o Jira Greenhopper via proxy para obter a estrutura completa do RapidBoard (allData.json)
 */
export async function fetchGreenhopperWorkData(params: {
  domain: string;
  token: string;
  rapidViewId: number | string;
  selectedProjectKey?: string;
}): Promise<GreenhopperWorkData> {
  const { domain, token, rapidViewId, selectedProjectKey } = params;

  const fallback = (fallbackReason: string): GreenhopperWorkData => ({
    ...EMPTY_GREENHOPPER_DATA,
    rapidViewId: rapidViewId || '',
    selectedProjectKey: selectedProjectKey || '',
    isFallback: true,
    fallbackReason,
  });

  if (!domain || !token || !rapidViewId) {
    // Sem credencial/quadro configurado: quadro vazio com o motivo, nunca dados inventados
    return fallback('missing-config');
  }

  const numericRapidViewId = Number(rapidViewId);
  if (Number.isNaN(numericRapidViewId)) {
    console.warn(`[greenhopperService] rapidViewId inválido (não numérico): "${rapidViewId}". Usando fallback.`);
    return fallback('invalid-rapid-view-id');
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 25000);

  try {
    const res = await authFetch('/api/jira/greenhopper/work', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        domain: domain.trim(),
        token: token.trim(),
        rapidViewId: numericRapidViewId,
        selectedProjectKey: selectedProjectKey?.trim(),
      }),
      signal: controller.signal,
    });

    if (!res.ok) {
      console.warn(`[greenhopperService] API retornou status ${res.status}. Usando fallback inteligente.`);
      return fallback(res.status === 401 || res.status === 403 ? 'auth-error' : `http-${res.status}`);
    }

    const data = await res.json();

    // Valida se a resposta tem a estrutura esperada do Greenhopper
    if (data && (data.columnsData || data.issuesData)) {
      return {
        rapidViewId: data.rapidViewId || rapidViewId,
        boardName: data.boardName || `SCRUM ${selectedProjectKey || ''}`.trim(),
        selectedProjectKey: data.selectedProjectKey || selectedProjectKey,
        columnsData: data.columnsData || { columns: [] },
        swimlanesData: data.swimlanesData || { swimlanes: [{ id: 1, name: 'Todo o Resto', isDefault: true }] },
        issuesData: data.issuesData || { issues: [] },
        quickFiltersData: data.quickFiltersData || { quickFilters: [] },
        sprintsData: data.sprintsData,
        canEdit: data.canEdit,
      };
    }

    return fallback('empty-response');
  } catch (error: any) {
    console.warn('[greenhopperService] Falha na requisição Greenhopper, usando dados de amostra:', error?.message);
    return fallback(error?.name === 'AbortError' ? 'timeout' : 'network-error');
  } finally {
    clearTimeout(timeoutId);
  }
}
