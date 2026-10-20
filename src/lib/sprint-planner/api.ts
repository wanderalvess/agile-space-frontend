/**
 * Cliente REST do Sprint Planner (`/api/squads/{squadId}/sprint-plans`, backend E1a) e dos tipos de subtarefa
 * (`/api/squads/{squadId}/subtask-types`, backend E1b). Os tipos espelham `dto/SprintPlanDtos.java` e
 * `SubtaskTypeMappingService.ResolvedType`. A regra de cálculo é do backend: a tela só mostra o que vem aqui.
 *
 * Erros: `CeremonyApiError` com o status HTTP (409 = versão do plano mudou ou transição inválida, 422 = validação,
 * 501 = ainda não disponível). A mensagem de 4xx é a do servidor, já em português.
 */

import { authFetch } from '@/lib/auth-client';
import { CeremonyApiError, ensureOk } from '@/lib/ceremony-api';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || process.env.NEXT_PUBLIC_SPRING_API_URL || 'http://localhost:8002/api';

export type PlanStatus = 'RASCUNHO' | 'ESCOPO' | 'DISTRIBUICAO' | 'REVISAO' | 'ENVIADO';
export type ReserveMode = 'HORAS' | 'FOCO';
export type Papel = 'DEV' | 'QA';
export type ThermoZone = 'VERDE' | 'AMARELO' | 'VERMELHO' | 'SEM_CAPACIDADE';
export type ThermoState = 'DENTRO_DA_CAPACIDADE' | 'COBERTO_PELA_RESERVA' | 'ACIMA_DA_RESERVA' | 'SEM_CAPACIDADE';

export interface PlanTotals { capDev: number; capQa: number; planDev: number; planQa: number }

export interface PlanSummary {
  id: string;
  jiraSprintId: string | null;
  sprintName: string;
  startDate: string;
  endDate: string;
  status: PlanStatus;
  totals: PlanTotals;
  updatedAt: string | null;
}

export interface CapacityRow {
  accountId: string;
  name: string;
  papel: string;
  diasCod: number;
  diasReg: number;
  horasProdutivas: number;
  papelInherited: boolean;
  diasCodInherited: boolean;
  diasRegInherited: boolean;
  horasProdutivasInherited: boolean;
  papelSource: string | null;
  diasCodSource: string | null;
  diasRegSource: string | null;
  horasProdutivasSource: string | null;
  included: boolean;
  /** Foco gravado na pessoa (sobrepõe o do time). */
  personFocusPct: number | null;
  /** Foco efetivo (só no modo FOCO; null no modo HORAS). */
  focusPct: number | null;
  baseHours: number;
  holidaysHours: number;
  absencesHours: number;
  capacityHours: number;
}

export interface CapacityView {
  byClass: Record<string, number>;
  people: CapacityRow[];
  workingDays: number;
}

export interface AbsenceView {
  id: string;
  accountId: string;
  startDate: string;
  endDate: string;
  /** null = dia inteiro. */
  hoursPerDay: number | null;
  reason: string | null;
}

export interface Holiday { day: string; label: string | null }

export interface ReserveTypeView { id: string; label: string; hoursPerDay: number | null }

export interface ReserveView { mode: ReserveMode; pct: number | null; focusPct: number | null; types: ReserveTypeView[] }

export interface SprintView { jiraSprintId: string | null; name: string; startDate: string; endDate: string; sprintKey: string }

export interface Thermometer {
  allocatedHours: number;
  capacityHours: number;
  pct: number | null;
  zone: ThermoZone;
  state: ThermoState;
  reservePct: number;
  reserveLimitHours: number;
}

export interface Permissions { canEditPlan: boolean; canEditTypes: boolean; myAccountId: string | null }

/** Subtarefa da pai como entra na conta (`SprintPlanDtos.ScopeSubtaskView`): classe pelo tipo do Jira; só DEV/QA somam. */
export interface ScopeSubtask {
  key: string;
  title: string | null;
  typeId: string | null;
  typeName: string | null;
  cls: SubtaskClass;
  estimateH: number;
  remainingH: number;
  /** Horas que a subtarefa conta (restante na sobra, estimado nos demais). */
  countedH: number;
  defaultHoursApplied: boolean;
  assigneeId: string | null;
  assigneeName: string | null;
}

/**
 * Item do escopo (`SprintPlanDtos.ItemView`). `devHours`/`qaHours` são o que CONTA no total (regra do backend);
 * `subtaskDevH`/`subtaskQaH` são a soma das subtarefas da classe, só para alerta de divergência.
 */
export interface PlanItem {
  id: string;
  parentKey: string;
  title: string | null;
  titleDevHours: number | null;
  titleQaHours: number | null;
  sortOrder: number;
  carryOver: boolean;
  devHours: number;
  qaHours: number;
  subtaskDevH: number;
  subtaskQaH: number;
  subtaskDevEstimateH: number;
  subtaskDevRemainingH: number;
  subtaskQaEstimateH: number;
  subtaskQaRemainingH: number;
  divergenceDev: boolean;
  divergenceQa: boolean;
  divergent: boolean;
  noEstimate: boolean;
  /** false quando a pai saiu do backlog refinado depois de entrar no plano. */
  inBacklog: boolean;
  unclassifiedCount: number;
  unclassifiedHours: number;
  subtasks: ScopeSubtask[];
}

export interface ScopeUnclassifiedType { typeId: string | null; typeName: string | null; count: number; hours: number }

/** `SprintPlanDtos.ScopeTotals`. */
export interface ScopeTotals {
  itemCount: number;
  allocated: Record<string, number>;
  carryOverCount: number;
  carryOverDevHours: number;
  carryOverQaHours: number;
  divergentCount: number;
  noEstimateCount: number;
  unclassifiedCount: number;
  unclassifiedHours: number;
  unclassifiedTypes: ScopeUnclassifiedType[];
}

/** Resposta de `GET/POST /items` e `PUT /items/order` (`SprintPlanDtos.ScopeView`). */
export interface ScopeView {
  planId: string;
  status: PlanStatus;
  syncedAt: string | null;
  items: PlanItem[];
  totals: ScopeTotals;
  thermometer: Record<string, Thermometer>;
  canEditPlan: boolean;
}

export interface PlanView {
  id: string;
  squadId: string;
  version: number;
  status: PlanStatus;
  sprint: SprintView;
  goal: string | null;
  reserve: ReserveView;
  syncedAt: string | null;
  capacity: CapacityView;
  absences: AbsenceView[];
  holidays: Holiday[];
  items: PlanItem[];
  scope: ScopeTotals;
  assignments: unknown[];
  thermometer: Record<string, Thermometer>;
  permissions: Permissions;
  /** A meta já foi gravada no Sprint goal do Jira. */
  goalSavedInJira: boolean;
  updatedAt: string | null;
}

export interface CreatePlanRequest { jiraSprintId?: string | null; sprintName: string; startDate: string; endDate: string; goal?: string | null }

export interface PatchPlanRequest {
  version: number;
  sprintName?: string;
  startDate?: string;
  endDate?: string;
  goal?: string;
  reserveMode?: ReserveMode;
  reservePct?: number;
  focusFactorPct?: number;
}

export interface CapacityUpdateRequest {
  papel?: Papel;
  diasCod?: number;
  diasReg?: number;
  horasProdutivas?: number;
  included?: boolean;
  focusPct?: number;
  clearFocus?: boolean;
}

export interface AbsenceRequest { accountId: string; startDate: string; endDate: string; hoursPerDay?: number | null; reason?: string | null }

// ---- Tipos de subtarefa (E1b) ----

export type SubtaskClass = 'DEV' | 'QA' | 'FORA_DA_CONTA' | 'SEM_CLASSIFICACAO';
export type SubtaskOrigin = 'PADRAO' | 'HERDADO' | 'MANUAL';

export interface SubtaskType {
  typeId: string;
  typeName: string;
  subtaskClass: SubtaskClass;
  origin: SubtaskOrigin;
  qaByTitleException: boolean;
  defaultHours: number | null;
  inheritedFromSprint: string | null;
  updatedBy: string | null;
  updatedAt: string | null;
}

export interface SubtaskTypesView { sprintKey: string; canEdit: boolean; types: SubtaskType[] }

export interface SubtaskTypeUpdate {
  typeId: string;
  typeName: string;
  subtaskClass: SubtaskClass;
  defaultHours?: number | null;
  qaByTitleException?: boolean;
}

// ---- Backlog refinado do Jira (E1b: `PlannerBacklogService.BacklogView`) ----

export interface BacklogSubtask {
  key: string;
  title: string | null;
  typeId: string | null;
  typeName: string | null;
  subtaskClass: SubtaskClass;
  estimateH: number;
  remainingH: number;
  /** Horas que entram na conta (restante na sobra, estimado nos demais). */
  countedH: number;
  defaultHoursApplied: boolean;
  status: string | null;
  statusCategory: string | null;
  assigneeId: string | null;
  assigneeName: string | null;
}

export interface BacklogParent {
  key: string;
  title: string | null;
  status: string | null;
  /** Sobra da sprint anterior: conta o Tempo Restante. */
  carryOver: boolean;
  /** Horas do título "(DEV 10h / QA 4h)"; null quando o título não traz. */
  titleHours: { dev: number | null; qa: number | null } | null;
  subtasks: BacklogSubtask[];
  sumByClass: Partial<Record<SubtaskClass, number>>;
  divergenceDev: boolean;
  divergenceQa: boolean;
  divergent: boolean;
}

export interface UnclassifiedType { typeId: string | null; typeName: string | null; count: number; hours: number }

export interface BacklogView {
  syncedAt: string | null;
  sprintKey: string;
  items: BacklogParent[];
  unclassifiedTypes: UnclassifiedType[];
}

export interface BacklogSyncResult { syncedAt: string | null; parents: number; carryOver: number; subtasks: number; truncated: boolean }

export type BacklogResult = { status: 'ok'; data: BacklogView } | { status: 'unavailable' };

const enc = encodeURIComponent;
const base = (squadId: string) => `${API_BASE_URL}/squads/${enc(squadId)}/sprint-plans`;

async function json<T>(res: Response, fallback: string): Promise<T> {
  await ensureOk(res, fallback);
  return res.json() as Promise<T>;
}

function isScopeView(v: unknown): v is ScopeView {
  const x = v as ScopeView | null;
  return !!x && typeof x === 'object' && Array.isArray(x.items) && !!x.totals && typeof x.thermometer === 'object' && 'planId' in x;
}

/** Valida a forma do `ScopeView`; qualquer outra coisa (corpo vazio, PlanView) vira erro em vez de dado errado na tela. */
export function parseScopeView(data: unknown, fallback = 'Resposta inesperada do servidor.'): ScopeView {
  if (!isScopeView(data)) throw new CeremonyApiError(fallback, 502);
  return data;
}

async function scopeView(res: Response, fallback: string): Promise<ScopeView> {
  await ensureOk(res, fallback);
  return parseScopeView(await res.json().catch(() => null), fallback);
}

export const sprintPlanApi = {
  async list(squadId: string): Promise<PlanSummary[]> {
    const res = await authFetch(base(squadId));
    const data = await json<PlanSummary[]>(res, 'Não foi possível carregar os planejamentos.');
    return Array.isArray(data) ? data : [];
  },

  async create(squadId: string, body: CreatePlanRequest): Promise<PlanView> {
    const res = await authFetch(base(squadId), { method: 'POST', body: JSON.stringify(body) });
    return json(res, 'Não foi possível criar o planejamento.');
  },

  async get(squadId: string, planId: string): Promise<PlanView> {
    const res = await authFetch(`${base(squadId)}/${enc(planId)}`);
    return json(res, 'Não foi possível carregar o planejamento.');
  },

  async patch(squadId: string, planId: string, body: PatchPlanRequest): Promise<PlanView> {
    const res = await authFetch(`${base(squadId)}/${enc(planId)}`, { method: 'PATCH', body: JSON.stringify(body) });
    return json(res, 'Não foi possível salvar o planejamento.');
  },

  async changeStatus(squadId: string, planId: string, version: number, to: PlanStatus): Promise<PlanView> {
    const res = await authFetch(`${base(squadId)}/${enc(planId)}/status`, { method: 'POST', body: JSON.stringify({ version, to }) });
    return json(res, 'Não foi possível mudar a etapa.');
  },

  async remove(squadId: string, planId: string): Promise<void> {
    const res = await authFetch(`${base(squadId)}/${enc(planId)}`, { method: 'DELETE' });
    await ensureOk(res, 'Não foi possível excluir o planejamento.');
  },

  async updatePerson(squadId: string, planId: string, accountId: string, body: CapacityUpdateRequest): Promise<CapacityRow> {
    const res = await authFetch(`${base(squadId)}/${enc(planId)}/capacity/${enc(accountId)}`, { method: 'PUT', body: JSON.stringify(body) });
    return json(res, 'Não foi possível salvar a capacidade.');
  },

  async addAbsence(squadId: string, planId: string, body: AbsenceRequest): Promise<AbsenceView> {
    const res = await authFetch(`${base(squadId)}/${enc(planId)}/absences`, { method: 'POST', body: JSON.stringify(body) });
    return json(res, 'Não foi possível lançar a ausência.');
  },

  async deleteAbsence(squadId: string, planId: string, absenceId: string): Promise<void> {
    const res = await authFetch(`${base(squadId)}/${enc(planId)}/absences/${enc(absenceId)}`, { method: 'DELETE' });
    await ensureOk(res, 'Não foi possível remover a ausência.');
  },

  /** Escopo (E3): GET devolve o `ScopeView` (itens, totais, termômetro e `canEditPlan`). */
  async getScope(squadId: string, planId: string): Promise<ScopeView> {
    const res = await authFetch(`${base(squadId)}/${enc(planId)}/items`);
    return scopeView(res, 'Não foi possível carregar o escopo.');
  },

  /** POST `{ parentKeys }` -> 201 com o `ScopeView` atualizado. 409 = pai já no plano; 422 = fora do backlog refinado ou da etapa. */
  async addItems(squadId: string, planId: string, parentKeys: string[]): Promise<ScopeView> {
    const res = await authFetch(`${base(squadId)}/${enc(planId)}/items`, { method: 'POST', body: JSON.stringify({ parentKeys }) });
    return scopeView(res, 'Não foi possível adicionar ao escopo.');
  },

  /** DELETE -> 204 sem corpo: quem chamou recarrega o escopo (`getScope`). */
  async removeItem(squadId: string, planId: string, itemId: string): Promise<void> {
    const res = await authFetch(`${base(squadId)}/${enc(planId)}/items/${enc(itemId)}`, { method: 'DELETE' });
    await ensureOk(res, 'Não foi possível tirar do escopo.');
  },

  /** PUT `{ orderedItemIds }` -> 200 com o `ScopeView`. */
  async reorderItems(squadId: string, planId: string, orderedItemIds: string[]): Promise<ScopeView> {
    const res = await authFetch(`${base(squadId)}/${enc(planId)}/items/order`, { method: 'PUT', body: JSON.stringify({ orderedItemIds }) });
    return scopeView(res, 'Não foi possível reordenar o escopo.');
  },

  async replaceHolidays(squadId: string, planId: string, holidays: Holiday[]): Promise<Holiday[]> {
    const res = await authFetch(`${base(squadId)}/${enc(planId)}/holidays`, { method: 'PUT', body: JSON.stringify(holidays) });
    return json(res, 'Não foi possível salvar os feriados.');
  },
};

/**
 * Tipos de subtarefa da squad (E1b). Resultado `unavailable` quando o backend ainda não tem a rota (404/405):
 * a tela mostra o aviso em vez de erro.
 */
export type TypesResult = { status: 'ok'; data: SubtaskTypesView } | { status: 'unavailable' };

export const subtaskTypesApi = {
  async get(squadId: string, sprintKey?: string): Promise<TypesResult> {
    const q = sprintKey ? `?sprintKey=${enc(sprintKey)}` : '';
    const res = await authFetch(`${API_BASE_URL}/squads/${enc(squadId)}/subtask-types${q}`);
    if (res.status === 404 || res.status === 405) return { status: 'unavailable' };
    const data = await json<SubtaskTypesView>(res, 'Não foi possível carregar os tipos de subtarefa.');
    return { status: 'ok', data: { ...data, types: Array.isArray(data?.types) ? data.types : [] } };
  },

  async update(squadId: string, sprintKey: string, types: SubtaskTypeUpdate[]): Promise<SubtaskTypesView> {
    const res = await authFetch(`${API_BASE_URL}/squads/${enc(squadId)}/subtask-types`, {
      method: 'PUT',
      body: JSON.stringify({ sprintKey, types }),
    });
    const data = await json<SubtaskTypesView>(res, 'Não foi possível salvar o tipo de subtarefa.');
    return { ...data, types: Array.isArray(data?.types) ? data.types : [] };
  },
};

/** Backlog refinado da squad (leitura do snapshot) e sincronização com o Jira (só liderança). */
export const backlogApi = {
  async get(squadId: string, sprintKey?: string): Promise<BacklogResult> {
    const q = sprintKey ? `?sprintKey=${enc(sprintKey)}` : '';
    const res = await authFetch(`${base(squadId)}/backlog${q}`);
    if (res.status === 404 || res.status === 405) return { status: 'unavailable' };
    const data = await json<BacklogView>(res, 'Não foi possível carregar o backlog refinado.');
    return {
      status: 'ok',
      data: {
        ...data,
        items: Array.isArray(data?.items) ? data.items : [],
        unclassifiedTypes: Array.isArray(data?.unclassifiedTypes) ? data.unclassifiedTypes : [],
      },
    };
  },

  /** 429 = pediu cedo demais (use `retryAfterSec`); 409 = já há uma sincronização em andamento. */
  async sync(squadId: string): Promise<BacklogSyncResult> {
    const res = await authFetch(`${base(squadId)}/backlog/sync`, { method: 'POST' });
    return json(res, 'Não foi possível sincronizar o backlog com o Jira.');
  },
};

/** Segundos de espera de um 429 do sync ("Tente de novo em 240 s"); null se a mensagem não trouxer. */
export function retryAfterSec(err: unknown): number | null {
  if (!(err instanceof CeremonyApiError) || err.status !== 429) return null;
  const m = /em\s+(\d+)\s*s/i.exec(err.message);
  return m ? Number(m[1]) : null;
}

export function isConflict(err: unknown): boolean {
  return err instanceof CeremonyApiError && err.status === 409;
}

export function statusOf(err: unknown): number | undefined {
  return err instanceof CeremonyApiError ? err.status : undefined;
}
