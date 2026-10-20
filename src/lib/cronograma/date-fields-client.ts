/**
 * Cliente dos "Campos de data do Jira" da squad: de qual campo do Jira o portal lê o início e o fim planejados
 * de cada subtarefa. O servidor lê os campos pelo nome; aqui só se consulta e se escolhe outro quando há mais
 * de um com o mesmo nome. Rotas: GET/PUT /api/squads/{squadId}/jira-date-fields.
 *
 * 404 e falha de rede não quebram a tela: viram `{ available: false }` ("recurso ainda não disponível").
 */
import { authFetch } from '@/lib/auth-client';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8002/api';

export interface JiraFieldOption {
  id: string;
  name: string;
}

export interface JiraDateFields {
  startFieldId: string | null;
  endFieldId: string | null;
  startFieldName: string | null;
  endFieldName: string | null;
  /** true = o servidor achou os campos pelo nome; false = a escolha foi manual. */
  autoDetected: boolean;
  candidates: { start: JiraFieldOption[]; end: JiraFieldOption[] };
  /** Amostra da última sincronização: em quantas subtarefas cada campo veio preenchido. */
  sample: { total: number; startFilled: number; endFilled: number };
  warning?: string | null;
}

export type JiraDateFieldsResult =
  | { available: true; data: JiraDateFields }
  | { available: false; reason: 'not-found' | 'network' };

export class JiraDateFieldsError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.name = 'JiraDateFieldsError';
    this.status = status;
  }
}

const url = (squadId: string) => `${API_BASE_URL}/squads/${encodeURIComponent(squadId)}/jira-date-fields`;

async function readMessage(res: Response): Promise<string> {
  try {
    const body = await res.json();
    if (typeof body?.message === 'string' && body.message) return body.message;
  } catch {
    // corpo vazio ou que não é JSON
  }
  if (res.status === 403) return 'Você não tem permissão para configurar esta squad.';
  return `Não foi possível salvar (erro ${res.status}).`;
}

function normalize(raw: Partial<JiraDateFields> | null | undefined): JiraDateFields {
  const r = raw ?? {};
  return {
    startFieldId: r.startFieldId ?? null,
    endFieldId: r.endFieldId ?? null,
    startFieldName: r.startFieldName ?? null,
    endFieldName: r.endFieldName ?? null,
    autoDetected: !!r.autoDetected,
    candidates: { start: r.candidates?.start ?? [], end: r.candidates?.end ?? [] },
    sample: { total: r.sample?.total ?? 0, startFilled: r.sample?.startFilled ?? 0, endFilled: r.sample?.endFilled ?? 0 },
    warning: r.warning ?? null,
  };
}

export async function getJiraDateFields(squadId: string): Promise<JiraDateFieldsResult> {
  let res: Response;
  try {
    res = await authFetch(url(squadId));
  } catch {
    return { available: false, reason: 'network' };
  }
  if (res.status === 404 || res.status === 501) return { available: false, reason: 'not-found' };
  if (!res.ok) throw new JiraDateFieldsError(res.status, await readMessage(res));
  return { available: true, data: normalize(await res.json()) };
}

export async function saveJiraDateFields(
  squadId: string,
  fields: { startFieldId: string | null; endFieldId: string | null },
): Promise<JiraDateFields | null> {
  const res = await authFetch(url(squadId), {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ startFieldId: fields.startFieldId, endFieldId: fields.endFieldId }),
  });
  if (!res.ok) throw new JiraDateFieldsError(res.status, await readMessage(res));
  if (res.status === 204) return null;
  try {
    return normalize(await res.json());
  } catch {
    return null;
  }
}
