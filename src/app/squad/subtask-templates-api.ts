import { authFetch } from '@/lib/auth-client';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8002/api';

export type SubtaskRole = 'DEV' | 'QA' | 'NONE';

/** Sub-tarefa que a squad cria no Jira para cada issue refinada (compartilhada por Poker e Planejador). */
export interface SubtaskTemplate {
  id?: string;
  squadId?: string;
  /** Tipo da issue pai a que se aplica; vazio = qualquer tipo. */
  parentIssueType?: string | null;
  /** Nome exato do tipo de sub-tarefa no Jira do projeto. */
  jiraIssueTypeName: string;
  role: SubtaskRole;
  titleTemplate: string;
  commentTemplate?: string | null;
  position?: number;
  active?: boolean;
}

export interface JiraIssueTypeOption {
  id: string | null;
  name: string | null;
  subtask: boolean;
}

/** Papel que o Sprint Planner dá a um tipo de sub-tarefa (mapeamento mais recente da squad). */
export interface SuggestedRole {
  typeId: string;
  typeName: string | null;
  subtaskClass: 'DEV' | 'QA' | 'FORA_DA_CONTA' | 'SEM_CLASSIFICACAO';
  /** Nulo quando o Planner não classificou o tipo: não há o que sugerir. */
  role: SubtaskRole | null;
  origin: 'PADRAO' | 'HERDADO' | 'MANUAL';
  /** Sprint de onde veio o mapeamento; nulo quando é só a semente. */
  sprintKey: string | null;
  /** O tipo é DEV mas vira QA quando o título cita QA (Code Review): o papel depende do título. */
  varyByTitle: boolean;
}

export class SubtaskTemplatesError extends Error {
  constructor(public readonly status: number, message: string) {
    super(message);
    this.name = 'SubtaskTemplatesError';
  }
}

async function readError(res: Response, fallback: string): Promise<SubtaskTemplatesError> {
  let detail = '';
  try {
    const text = (await res.text()).trim();
    if (text) {
      try {
        const body = JSON.parse(text);
        detail = body.message || body.reason || body.error || '';
      } catch {
        detail = text;
      }
    }
  } catch {
    // corpo ilegível
  }
  return new SubtaskTemplatesError(res.status, detail ? detail.slice(0, 400) : `${fallback} (HTTP ${res.status})`);
}

export const subtaskTemplatesApi = {
  async list(squadId: string): Promise<SubtaskTemplate[]> {
    const res = await authFetch(`${API_BASE_URL}/squads/${encodeURIComponent(squadId)}/subtask-templates`);
    if (!res.ok) throw await readError(res, 'Falha ao carregar as sub-tarefas do time');
    return res.json();
  },

  async replaceAll(squadId: string, templates: SubtaskTemplate[]): Promise<SubtaskTemplate[]> {
    const res = await authFetch(`${API_BASE_URL}/squads/${encodeURIComponent(squadId)}/subtask-templates`, {
      method: 'PUT',
      body: JSON.stringify(templates),
    });
    if (!res.ok) throw await readError(res, 'Falha ao salvar as sub-tarefas do time');
    return res.json();
  },

  async jiraIssueTypes(squadId: string): Promise<JiraIssueTypeOption[]> {
    const res = await authFetch(`${API_BASE_URL}/squads/${encodeURIComponent(squadId)}/subtask-templates/jira-issue-types`);
    if (!res.ok) throw await readError(res, 'Falha ao consultar os tipos de issue no Jira');
    return res.json();
  },

  async suggestedRoles(squadId: string): Promise<SuggestedRole[]> {
    const res = await authFetch(`${API_BASE_URL}/squads/${encodeURIComponent(squadId)}/subtask-templates/suggested-roles`);
    if (!res.ok) throw await readError(res, 'Falha ao consultar o mapeamento do Planejador');
    return res.json();
  },
};

/** Nome do tipo sem acento, caixa nem espaços repetidos: o Planner e o Jira nem sempre escrevem igual. */
export function normalizeTypeName(name: string | null | undefined): string {
  return (name ?? '').normalize('NFD').replace(/\p{M}/gu, '').trim().replace(/\s+/g, ' ').toLowerCase();
}

/** Sugestão do Planner para o tipo, só quando ele classificou o tipo. */
export function suggestionFor(suggestions: SuggestedRole[] | null, typeName: string): SuggestedRole | null {
  const wanted = normalizeTypeName(typeName);
  if (!suggestions || !wanted) return null;
  const found = suggestions.find(s => normalizeTypeName(s.typeName) === wanted);
  return found && found.role ? found : null;
}

/** O papel configurado diverge do que o Planner usa? Tipos que variam pelo título (Code Review) não são comparáveis. */
export function roleDivergence(suggestion: SuggestedRole | null, role: SubtaskRole): SuggestedRole | null {
  if (!suggestion || !suggestion.role || suggestion.varyByTitle) return null;
  return suggestion.role === role ? null : suggestion;
}

/** Variáveis aceitas nos padrões de título e comentário, com o que cada uma vira. */
export const TEMPLATE_VARIABLES: ReadonlyArray<{ token: string; meaning: string }> = [
  { token: '{pai}', meaning: 'chave da issue pai (DDWMISSI-100)' },
  { token: '{resumo}', meaning: 'título da pai, sem a estimativa entre parênteses' },
  { token: '{tipo}', meaning: 'nome do tipo da sub-tarefa' },
  { token: '{horas}', meaning: 'horas refinadas do papel (10h); vazio sem papel' },
  { token: '{papel}', meaning: 'DEV, QA ou vazio' },
  { token: '{notas}', meaning: 'notas de refinamento do papel (só no comentário)' },
];

/** Mesma substituição que o backend faz, para a prévia local da tela de configuração. */
export function renderTemplate(template: string, vars: Record<string, string>): string {
  let out = template ?? '';
  for (const [k, v] of Object.entries(vars)) out = out.split(`{${k}}`).join(v);
  return out;
}
