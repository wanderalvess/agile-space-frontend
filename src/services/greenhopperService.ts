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
  /** true quando os dados vieram do fixture de demonstração, não do Jira ao vivo. */
  isFallback?: boolean;
  /** Motivo legível do fallback, pra distinguir "não configurado" de "erro de conexão". */
  fallbackReason?: string;
}

/**
 * Dados de exemplo (fixture sintética) para fallback imediato e demonstração offline.
 */
export const SAMPLE_GREENHOPPER_DATA: GreenhopperWorkData = {
  rapidViewId: 11360,
  boardName: 'SCRUM Demo',
  selectedProjectKey: 'SCRUMDEMO',
  columnsData: {
    columns: [
      {
        id: 1,
        name: 'A Fazer',
        statusIds: [10001, 10002, 10003, 10004, 10005, 10006],
        min: null,
        max: null,
      },
      {
        id: 2,
        name: 'Em Desenvolvimento',
        statusIds: [10007, 10008, 10009, 10010],
        min: null,
        max: 11,
      },
      {
        id: 3,
        name: 'Para Revisar',
        statusIds: [10011, 10012],
        min: null,
        max: 2,
      },
      {
        id: 4,
        name: 'Em Revisão',
        statusIds: [10013],
        min: null,
        max: null,
      },
      {
        id: 5,
        name: 'Para Testar',
        statusIds: [10014, 10015],
        min: null,
        max: 8,
      },
      {
        id: 6,
        name: 'Em Teste',
        statusIds: [10016],
        min: null,
        max: 6,
      },
      {
        id: 7,
        name: 'Aguardando Expedição',
        statusIds: [10017, 10018],
        min: null,
        max: null,
      },
      {
        id: 8,
        name: 'Finalizado',
        statusIds: [10019, 10020, 10021, 10022, 10023, 10024],
        min: null,
        max: null,
      },
    ],
  },
  swimlanesData: {
    swimlanes: [
      {
        id: 101,
        name: 'Prioridades ( WarRoom)',
        query: 'priority in ( Crítica, Alta) OR labels in (prioridade)',
        description: 'Itens de prioridade Crítica ou Alta, ou com a label prioridade',
        isDefault: false,
      },
      {
        id: 102,
        name: 'Reforma Tributária',
        query: 'labels in (Entrega_Cadastros, Entrega_HomologSEFAZ, Entrega_ProdSEFAZ)',
        description: 'Itens relacionados à Reforma Tributária e entregas SEFAZ',
        isDefault: false,
      },
      {
        id: 103,
        name: 'Pausada',
        query: 'labels in (Pausada,pausada)',
        description: 'Tarefas e histórias temporariamente pausadas',
        isDefault: false,
      },
      {
        id: 104,
        name: 'Todo o Resto',
        query: '',
        description: 'Demais tarefas e itens ativos da sprint',
        isDefault: true,
      },
    ],
  },
  quickFiltersData: {
    quickFilters: [
      {
        id: 1,
        name: 'Sprint Goal',
        query: 'labels = Sprint_goal',
        description: 'Filtra itens marcados com a meta da sprint',
      },
      {
        id: 2,
        name: 'Beatriz',
        query: 'assignee = beatriz.lima or issuetype IN ("Defeito (Sub-tarefa)") and creator = beatriz.lima',
        description: 'Tarefas e defeitos de Beatriz',
      },
      {
        id: 3,
        name: 'Diego',
        query: 'assignee = diego.rocha or issuetype IN ("Defeito (Sub-tarefa)") and creator = diego.rocha',
        description: 'Tarefas e defeitos de Diego',
      },
      {
        id: 4,
        name: 'Felipe',
        query: 'assignee = felipe.martins or issuetype IN ("Defeito (Sub-tarefa)") and creator = felipe.martins',
        description: 'Tarefas e defeitos de Felipe',
      },
      {
        id: 5,
        name: 'Gustavo',
        query: 'assignee = gustavo.pinto or issuetype IN ("Defeito (Sub-tarefa)") and creator = gustavo.pinto',
        description: 'Tarefas e defeitos de Gustavo',
      },
      {
        id: 6,
        name: 'Alice',
        query: 'assignee = alice.souza OR (Desenvolvedor = alice.souza OR "Responsável (Codificação)" =alice.souza)',
        description: 'Tarefas e desenvolvimento de Alice',
      },
      {
        id: 7,
        name: 'Henrique Dias',
        query: 'assignee = henrique.dias OR (Desenvolvedor = henrique.dias OR "Responsável (Codificação)" =henrique.dias)',
        description: 'Tarefas e desenvolvimento de Henrique',
      },
      {
        id: 8,
        name: 'Carlos',
        query: 'assignee = carlos.mendes OR (Desenvolvedor = carlos.mendes OR "Responsável (Codificação)" =carlos.mendes)',
        description: 'Tarefas e desenvolvimento de Carlos',
      },
      {
        id: 9,
        name: 'Eduardo Nunes',
        query: 'assignee = eduardo.nunes OR (Desenvolvedor = eduardo.nunes OR "Responsável (Codificação)" =eduardo.nunes )',
        description: 'Tarefas e desenvolvimento de Eduardo Nunes',
      },
      {
        id: 10,
        name: 'Data Acordo',
        query: '( "Data Acordo Entrega" >= startOfWeek() AND "Data Acordo Entrega" <= endOfWeek() ) OR ( "Data Interna Acordada" >= startOfWeek() AND "Data Interna Acordada" <= endOfWeek() ) AND statusCategory != Done',
        description: 'Itens com data de acordo na semana atual e pendentes',
      },
      {
        id: 11,
        name: 'CausaOC',
        query: 'issuetype in (Manutenção,"Rejeição - Manutenção") and priority = Crítica',
        description: 'Manutenção crítica e causa OC',
      },
      {
        id: 12,
        name: 'Abertas',
        query: 'status not in (Cancelado, Closed, Concluído, Recusada)',
        description: 'Itens com status aberto ou em andamento',
      },
    ],
  },
  sprintsData: {
    sprints: [
      {
        id: 7890,
        name: 'SCRUMDEMO - 2026.08/2',
        state: 'ACTIVE',
        daysRemaining: 1,
        startDate: '2026-08-15',
        endDate: '2026-08-28',
      },
    ],
  },
  issuesData: {
    issues: [
      // --- Swimlane 1: Prioridades (WarRoom) ---
      {
        id: 5335,
        key: 'SCRUMDEMO-5335',
        summary: '[Regressivo Sprint 2026.08/02] - Planejamento e Execução',
        statusId: 10001,
        statusName: 'COMPROMETIDO',
        statusCategory: 'new',
        priorityName: 'Major',
        typeName: 'Story',
        assignee: 'alice.souza',
        assigneeName: 'Alice Souza',
        avatarUrl: '',
        color: '#f97316',
        swimlaneId: 101,
        tags: ['Regressivo', 'WarRoom'],
        fixVersions: [{ id: '1', name: '2026.08/2' }],
        extraFields: [{ id: '1', label: 'Estimativa', value: 'Nenhuma' }],
        subTasks: [
          { id: 1, key: 'SCRUMDEMO-5335-1', statusId: 10019, isDone: true },
          { id: 2, key: 'SCRUMDEMO-5335-2', statusId: 10001, isDone: false },
        ],
      },
      {
        id: 4880,
        key: 'SCRUMDEMO-4880',
        summary: 'Enviar status para remover cadastros da fila do sync (DEV 17h / QA 10h)',
        statusId: 10014,
        statusName: 'CODE REVIEW CONCLUÍDO',
        statusCategory: 'indeterminate',
        priorityName: 'Critical',
        typeName: 'Task',
        assignee: 'beatriz.lima',
        assigneeName: 'Beatriz Lima',
        avatarUrl: '',
        color: '#0ea5e9',
        swimlaneId: 101,
        tags: ['DEV 17h', 'QA 10h'],
        extraFields: [{ id: '1', label: 'Estimativa', value: 'Nenhuma' }],
      },
      {
        id: 5192,
        key: 'SCRUMDEMO-5192',
        summary: '[INTEGRACAO MATCON] - Erro de requisição ao processar',
        statusId: 10019,
        statusName: 'RESOLVIDO',
        statusCategory: 'done',
        priorityName: 'Blocker',
        typeName: 'Bug',
        assignee: 'carlos.mendes',
        assigneeName: 'Carlos Mendes',
        avatarUrl: '',
        color: '#ef4444',
        swimlaneId: 101,
        tags: ['MATCON', 'API Online Consult...'],
        extraFields: [{ id: '1', label: 'Estimativa', value: 'Nenhuma' }],
      },

      // --- Swimlane 2: Todo o Resto ---
      {
        id: 5361,
        key: 'SCRUMDEMO-5361',
        summary: 'Refinamento SCRUMDEMO S3 Agosto',
        statusId: 10001,
        statusName: 'COMPROMETIDO',
        statusCategory: 'new',
        priorityName: 'Normal',
        typeName: 'Story',
        assignee: 'diego.rocha',
        assigneeName: 'Diego Rocha',
        avatarUrl: '',
        swimlaneId: 102,
        tags: ['Refinamento'],
      },
      {
        id: 5238,
        key: 'SCRUMDEMO-5238',
        summary: '[INOVAÇÃO] Horas de gestão - 08.2026',
        statusId: 10002,
        statusName: 'ABERTO',
        statusCategory: 'new',
        priorityName: 'Minor',
        typeName: 'Task',
        assignee: 'eduardo.nunes',
        assigneeName: 'Eduardo Nunes',
        avatarUrl: '',
        swimlaneId: 103,
        tags: ['Inovação', 'Pausada'],
      },
      {
        id: 5239,
        key: 'SCRUMDEMO-5239',
        summary: 'Ajuste na fila de eventos Kafka',
        statusId: 10001,
        statusName: 'COMPROMETIDO',
        statusCategory: 'new',
        priorityName: 'Normal',
        typeName: 'Task',
        assignee: 'felipe.martins',
        assigneeName: 'Felipe Martins',
        avatarUrl: '',
        swimlaneId: 104,
        tags: ['Kafka'],
      },
      {
        id: 5167,
        key: 'SCRUMDEMO-5167',
        summary: 'Onboarding - Gustavo Pinto',
        statusId: 10007,
        statusName: 'EM CODIFICAÇÃO',
        statusCategory: 'indeterminate',
        priorityName: 'Normal',
        typeName: 'Task',
        assignee: 'gustavo.pinto',
        assigneeName: 'Gustavo Pinto',
        avatarUrl: '',
        color: '#facc15',
        swimlaneId: 104,
        tags: ['Onboarding'],
      },
      {
        id: 5336,
        key: 'SCRUMDEMO-5336',
        summary: 'Implementar client do oracle e no projeto TAUT-GERAL(Aut 12h)',
        statusId: 10007,
        statusName: 'EM DESENVOLVIMENTO',
        statusCategory: 'indeterminate',
        priorityName: 'Major',
        typeName: 'Story',
        assignee: 'henrique.dias',
        assigneeName: 'Henrique Dias',
        avatarUrl: '',
        color: '#f97316',
        swimlaneId: 104,
        tags: ['[TALIT-GERAL] Migraç...'],
      },
      {
        id: 2306,
        key: 'SCRUMDEMO-2306',
        summary: 'Adapter para nova api - Buscar Estoque lotes disponíveis no Winthor',
        statusId: 10014,
        statusName: 'CODE REVIEW CONCLUÍDO',
        statusCategory: 'indeterminate',
        priorityName: 'Major',
        typeName: 'Story',
        assignee: 'carlos.mendes',
        assigneeName: 'Carlos Mendes',
        avatarUrl: '',
        color: '#10b981',
        swimlaneId: 102,
        tags: ['Lote disponível', 'Entrega_ProdSEFAZ'],
      },
      {
        id: 5101,
        key: 'SCRUMDEMO-5101',
        summary: '[Melhoria] - API Produtos - Envio de dados de ANP (DEV 8h / QA 8h)',
        statusId: 10016,
        statusName: 'EM TESTE DE ACEITAÇÃO',
        statusCategory: 'indeterminate',
        priorityName: 'Major',
        typeName: 'Story',
        assignee: 'gustavo.pinto',
        assigneeName: 'Gustavo Pinto',
        avatarUrl: '',
        color: '#3b82f6',
        swimlaneId: 102,
        tags: ['Produtos ANP', 'Entrega_HomologSEFAZ'],
        dueDate: '31/08/26',
      },
      {
        id: 2305,
        key: 'SCRUMDEMO-2305',
        summary: 'Nova api - Buscar Estoque por lotes disponíveis no Winthor (DEV 12H / QA 6H)',
        statusId: 10016,
        statusName: 'EM TESTE DE ACEITAÇÃO',
        statusCategory: 'indeterminate',
        priorityName: 'Major',
        typeName: 'Story',
        assignee: 'henrique.dias',
        assigneeName: 'Henrique Dias',
        avatarUrl: '',
        color: '#10b981',
        swimlaneId: 102,
        tags: ['Lote disponível - Tratar...'],
      },
      {
        id: 5193,
        key: 'SCRUMDEMO-5193',
        summary: 'Erro ao gravar um parâmetro geral da 132 com o tamanho superior a 100',
        statusId: 10016,
        statusName: 'EM TESTE DE ACEITAÇÃO',
        statusCategory: 'indeterminate',
        priorityName: 'Critical',
        typeName: 'Bug',
        assignee: 'beatriz.lima',
        assigneeName: 'Beatriz Lima',
        avatarUrl: '',
        color: '#ef4444',
        swimlaneId: 102,
        tags: ['Bug Produção'],
        dueDate: '31/08/26',
      },
      {
        id: 4069,
        key: 'SCRUMDEMO-4069',
        summary: 'Validação Cliente Excluído e Consumidor final 1, 2, 3 (DEV 9h / QA 6h)',
        statusId: 10017,
        statusName: 'TESTE DE ACEITAÇÃO CONCLUÍDO',
        statusCategory: 'indeterminate',
        priorityName: 'Major',
        typeName: 'Story',
        assignee: 'alice.souza',
        assigneeName: 'Alice Souza',
        avatarUrl: '',
        color: '#8b5cf6',
        swimlaneId: 102,
        tags: ['Validações'],
      },
      {
        id: 5426,
        key: 'SCRUMDEMO-5426',
        summary: '"situacaoPreVenda": "FATURAMENTO", ajustar retorno para status final',
        statusId: 10019,
        statusName: 'RESOLVIDO',
        statusCategory: 'done',
        priorityName: 'Normal',
        typeName: 'Bug',
        assignee: 'alice.souza',
        assigneeName: 'Alice Souza',
        avatarUrl: '',
        color: '#10b981',
        swimlaneId: 102,
        tags: ['Faturamento'],
      },
    ],
  },
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
    ...SAMPLE_GREENHOPPER_DATA,
    isFallback: true,
    fallbackReason,
  });

  if (!domain || !token || !rapidViewId) {
    // Retorna os dados de demonstração da sprint quando não houver credencial configurada
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
