import { authFetch } from '@/lib/auth-client';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8002/api';

export type JiraPublishStepKind = 'RENAME_PARENT' | 'CREATE_SUBTASK' | 'ADD_COMMENT';
export type JiraPublishStepStatus = 'PENDING' | 'DONE' | 'ERROR' | 'SKIPPED';
export type JiraPublishJobStatus = 'PENDING' | 'RUNNING' | 'DONE' | 'ERROR';

/** Um passo da publicação, como o backend devolve na prévia e na fila. */
export interface JiraPublishStep {
  index: number;
  kind: JiraPublishStepKind;
  targetKey?: string | null;
  dependsOnIndex?: number | null;
  summary?: string | null;
  issueType?: string | null;
  estimateHours?: number | null;
  role?: string | null;
  templateId?: string | null;
  comment?: string | null;
  status?: JiraPublishStepStatus | null;
  resultKey?: string | null;
  errorMessage?: string | null;
  attempts?: number | null;
}

export interface JiraPublishPreview {
  roomId: string;
  issueId: string;
  squadId: string;
  projectKey: string;
  parentKey: string;
  parentIssueType?: string | null;
  currentSummary?: string | null;
  hoursDeck: boolean;
  devHours?: number | null;
  qaHours?: number | null;
  steps: JiraPublishStep[];
  warnings: string[];
}

export interface JiraPublishJob {
  id: string;
  squadId: string;
  roomId: string;
  issueId: string;
  parentKey: string;
  parentSummary?: string | null;
  requestedBy: string;
  status: JiraPublishJobStatus;
  errorMessage?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
  finishedAt?: string | null;
  steps: JiraPublishStep[];
}

/** Evento de janela disparado pela página da sala quando o WebSocket avisa que um envio mudou. */
export const JIRA_PUBLISH_EVENT = 'poker-jira-publish-updated';

export class JiraPublishError extends Error {
  constructor(public readonly status: number, message: string) {
    super(message);
    this.name = 'JiraPublishError';
  }
}

async function readError(res: Response, fallback: string): Promise<JiraPublishError> {
  let detail = '';
  try {
    const text = (await res.text()).trim();
    if (text) {
      try {
        const body = JSON.parse(text);
        detail = body.error || body.message || body.reason || '';
      } catch {
        detail = text;
      }
    }
  } catch {
    // corpo ilegível: segue só com o status
  }
  return new JiraPublishError(res.status, detail ? detail.slice(0, 400) : `${fallback} (HTTP ${res.status})`);
}

export const jiraPublishApi = {
  async preview(roomId: string, issueId: string): Promise<JiraPublishPreview> {
    const res = await authFetch(`${API_BASE_URL}/poker/${encodeURIComponent(roomId)}/jira-publish/preview?issueId=${encodeURIComponent(issueId)}`);
    if (!res.ok) throw await readError(res, 'Falha ao montar a prévia do envio');
    return res.json();
  },

  async submit(roomId: string, issueId: string, steps: JiraPublishStep[]): Promise<JiraPublishJob> {
    const res = await authFetch(`${API_BASE_URL}/poker/${encodeURIComponent(roomId)}/jira-publish`, {
      method: 'POST',
      body: JSON.stringify({ issueId, steps }),
    });
    if (!res.ok) throw await readError(res, 'Falha ao enviar para o Jira');
    return res.json();
  },

  async list(roomId: string): Promise<JiraPublishJob[]> {
    const res = await authFetch(`${API_BASE_URL}/poker/${encodeURIComponent(roomId)}/jira-publish`);
    if (!res.ok) throw await readError(res, 'Falha ao carregar a fila do Jira');
    return res.json();
  },

  async retry(roomId: string, jobId: string): Promise<JiraPublishJob> {
    const res = await authFetch(`${API_BASE_URL}/poker/${encodeURIComponent(roomId)}/jira-publish/${encodeURIComponent(jobId)}/retry`, {
      method: 'POST',
    });
    if (!res.ok) throw await readError(res, 'Falha ao tentar novamente');
    return res.json();
  },
};

/** Rótulo curto de um passo para listas e prévias. */
export function describeStep(step: JiraPublishStep): string {
  switch (step.kind) {
    case 'RENAME_PARENT':
      return `Renomear ${step.targetKey ?? 'a issue pai'}`;
    case 'CREATE_SUBTASK':
      return `Criar sub-tarefa ${step.issueType ?? ''}`.trim();
    case 'ADD_COMMENT':
      return `Comentar em ${step.resultKey && step.kind !== 'ADD_COMMENT' ? step.resultKey : step.targetKey ?? 'sub-tarefa'}`;
    default:
      return step.kind;
  }
}
