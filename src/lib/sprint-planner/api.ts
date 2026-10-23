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
 * `subtaskDevH`/`subtaskQaH` são a soma das subtarefas da classe SEM Code Review, só para alerta de divergência.
 * `codeReviewDevH`/`codeReviewQaH` são as horas de Code Review já incluídas em devHours/qaHours (título + Code Review);
 * `codeReviewDevAssumed` = não há subtarefa de Code Review DEV e entrou a hora padrão.
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
  codeReviewDevH: number;
  codeReviewQaH: number;
  codeReviewDevAssumed: boolean;
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
  /** Versão do plano depois da escrita (POST/PUT de itens): quem chamou usa para o próximo PATCH/status sem recarregar. */
  planVersion: number;
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
  /** Meta que está hoje no Sprint goal do Jira (null = sem meta lá ou sem leitura). */
  jiraGoal: string | null;
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
  /** Só na resposta do POST /status ao sair da Distribuição: avisos que não bloqueiam. Ausente/null nas demais. */
  warnings?: DistributionWarning[] | null;
}

/** `GET /sprint-plans/next-sprint`: a próxima sprint futura do quadro no Jira (`found=false` = não há). */
export interface NextSprintView {
  found: boolean;
  jiraSprintId: string | null;
  name: string | null;
  startDate: string | null;
  endDate: string | null;
  goal: string | null;
  state: string | null;
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
  /** Subtarefa do tipo Code Review (fica fora da comparação com o título). */
  codeReview: boolean;
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
  /** Soma por classe COM Code Review (o que conta quando não há horas no título). */
  sumByClass: Partial<Record<SubtaskClass, number>>;
  /** Horas de subtarefas de Code Review por classe (já dentro de sumByClass). */
  codeReviewByClass: Partial<Record<SubtaskClass, number>>;
  /** Há subtarefa de Code Review de classe DEV (senão entra a hora padrão no item novo). */
  hasCodeReviewDev: boolean;
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
  return (
    !!x && typeof x === 'object' && Array.isArray(x.items) && !!x.totals && typeof x.thermometer === 'object' && 'planId' in x &&
    typeof x.planVersion === 'number'
  );
}

/** Valida a forma do `NextSprintView`; outra coisa (vazio, PlanView) vira erro. */
export function parseNextSprintView(data: unknown, fallback = 'Resposta inesperada do servidor.'): NextSprintView {
  const x = data as NextSprintView | null;
  if (!x || typeof x !== 'object' || typeof x.found !== 'boolean') throw new CeremonyApiError(fallback, 502);
  return x;
}

function isPlanView(v: unknown): v is PlanView {
  const x = v as PlanView | null;
  return !!x && typeof x === 'object' && typeof x.id === 'string' && typeof x.version === 'number' && !!x.capacity && !!x.permissions && !!x.sprint;
}

/** Valida a forma do `PlanView` (resposta do copy-from-previous). */
export function parsePlanView(data: unknown, fallback = 'Resposta inesperada do servidor.'): PlanView {
  if (!isPlanView(data)) throw new CeremonyApiError(fallback, 502);
  return data;
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

  /** Só liderança e só em RASCUNHO. 404 = "Nenhum planejamento anterior". Copia reserva, foco e inclusão/foco por pessoa. */
  async copyFromPrevious(squadId: string, planId: string, sourcePlanId?: string): Promise<PlanView> {
    const res = await authFetch(`${base(squadId)}/${enc(planId)}/copy-from-previous`, {
      method: 'POST',
      body: JSON.stringify(sourcePlanId ? { sourcePlanId } : {}),
    });
    await ensureOk(res, 'Não foi possível copiar da sprint anterior.');
    return parsePlanView(await res.json().catch(() => null), 'Não foi possível copiar da sprint anterior.');
  },

  /** 400 = sem token ou quadro do Jira; 429 = "Tente de novo em N s"; 502 = Jira fora do ar. Mensagem do servidor. */
  async nextSprint(squadId: string): Promise<NextSprintView> {
    const res = await authFetch(`${base(squadId)}/next-sprint`);
    await ensureOk(res, 'Não foi possível buscar a próxima sprint no Jira.');
    return parseNextSprintView(await res.json().catch(() => null), 'Não foi possível buscar a próxima sprint no Jira.');
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

// ---- Distribuição (E4: `GET/POST/DELETE/PUT .../sprint-plans/{id}/distribution`) ----

export interface DistributionSubtask {
  key: string;
  title: string | null;
  typeId: string | null;
  typeName: string | null;
  /** DEV e QA são distribuíveis; FORA ("Fora da conta") e SEM ("Sem classificação") vêm com canClaim=false. */
  cls: 'DEV' | 'QA' | 'FORA' | 'SEM';
  /** Subtarefa do tipo Code Review (etapa do meio da cadeia Codificação, Code Review, QA). */
  codeReview: boolean;
  estimateH: number;
  remainingH: number;
  countedH: number;
  assigneeId: string | null;
  assigneeName: string | null;
  /** yyyy-MM-dd; null = ainda sem data. */
  startDate: string | null;
  endDate: string | null;
  /** Chave da subtarefa que precisa terminar antes desta começar (cadeia); null = sem antecessora. */
  startsAfterKey: string | null;
  /** Primeiro dia permitido para o início (fim da antecessora); null = sem restrição além da sprint. */
  minStartDate: string | null;
  canClaim: boolean;
  canEditDates: boolean;
  status: string | null;
}

export interface DistributionTask {
  itemId: string;
  parentKey: string;
  title: string | null;
  devHours: number;
  qaHours: number;
  subtasks: DistributionSubtask[];
}

/** Ausência da pessoa no período da sprint, como a Distribuição recebe (`hours` null = dia inteiro). */
export interface PersonAbsence { startDate: string; endDate: string; hours: number | null; reason: string | null }

export interface DistributionPerson {
  accountId: string;
  name: string;
  role: string;
  capacityHours: number;
  allocatedHours: number;
  freeHours: number;
  pct: number | null;
  zone: ThermoZone;
  state: ThermoState;
  absences: PersonAbsence[];
}

export interface DistributionWarning {
  code: string;
  message: string;
  subtaskKey: string | null;
  accountId: string | null;
}

export interface DistributionView {
  planId: string;
  status: PlanStatus;
  syncedAt: string | null;
  canEditPlan: boolean;
  myAccountId: string | null;
  sprint: { startDate: string; endDate: string; holidays: Array<Holiday | string> };
  tasks: DistributionTask[];
  people: DistributionPerson[];
  warnings: DistributionWarning[];
}

function isDistributionView(v: unknown): v is DistributionView {
  const x = v as DistributionView | null;
  return (
    !!x && typeof x === 'object' && 'planId' in x && Array.isArray(x.tasks) && Array.isArray(x.people) && Array.isArray(x.warnings) &&
    !!x.sprint && typeof x.sprint === 'object' && Array.isArray(x.sprint.holidays) && typeof x.sprint.startDate === 'string' &&
    x.people.every((p) => !!p && Array.isArray(p.absences))
  );
}

/** Valida a forma do `DistributionView`; qualquer outra coisa (corpo vazio, PlanView/ScopeView) vira erro em vez de tela errada. */
export function parseDistributionView(data: unknown, fallback = 'Resposta inesperada do servidor.'): DistributionView {
  if (!isDistributionView(data)) throw new CeremonyApiError(fallback, 502);
  return data;
}

/** Erro de uma chamada da distribuição; o 422 de data pode trazer `minStartDate` (primeiro início possível). */
export class DistributionApiError extends CeremonyApiError {
  minStartDate: string | null;
  constructor(message: string, status: number, minStartDate: string | null = null) {
    super(message, status);
    this.name = 'DistributionApiError';
    this.minStartDate = minStartDate;
  }
}

export function minStartDateOf(err: unknown): string | null {
  return err instanceof DistributionApiError ? err.minStartDate : null;
}

async function distributionView(res: Response, fallback: string): Promise<DistributionView> {
  if (!res.ok) {
    let message = fallback;
    let min: string | null = null;
    if (res.status >= 400 && res.status < 500) {
      try {
        const body = JSON.parse(await res.text());
        if (typeof body?.message === 'string' && body.message.trim()) message = body.message;
        if (typeof body?.minStartDate === 'string') min = body.minStartDate.slice(0, 10);
      } catch { /* corpo ilegível: fica o texto padrão */ }
    }
    throw new DistributionApiError(message, res.status, min);
  }
  return parseDistributionView(await res.json().catch(() => null), fallback);
}

export const distributionApi = {
  async get(squadId: string, planId: string): Promise<DistributionView> {
    const res = await authFetch(`${base(squadId)}/${enc(planId)}/distribution`);
    return distributionView(res, 'Não foi possível carregar a distribuição.');
  },

  /** Pega a subtarefa para mim (sem `accountId`) ou, pela liderança, para outra pessoa. 403/409/422 trazem a mensagem do servidor. */
  async claim(squadId: string, planId: string, subtaskKey: string, accountId?: string): Promise<DistributionView> {
    const body = accountId ? { subtaskKey, accountId } : { subtaskKey };
    const res = await authFetch(`${base(squadId)}/${enc(planId)}/distribution/claim`, { method: 'POST', body: JSON.stringify(body) });
    return distributionView(res, 'Não foi possível pegar a subtarefa.');
  },

  async release(squadId: string, planId: string, subtaskKey: string): Promise<DistributionView> {
    const res = await authFetch(`${base(squadId)}/${enc(planId)}/distribution/claim/${enc(subtaskKey)}`, { method: 'DELETE' });
    return distributionView(res, 'Não foi possível soltar a subtarefa.');
  },

  /** Devolve a distribuição COM a cascata aplicada (o QA acompanha o DEV nos dois sentidos). */
  async setDates(squadId: string, planId: string, subtaskKey: string, startDate: string, endDate: string): Promise<DistributionView> {
    const res = await authFetch(`${base(squadId)}/${enc(planId)}/distribution/dates/${enc(subtaskKey)}`, {
      method: 'PUT',
      body: JSON.stringify({ startDate, endDate }),
    });
    return distributionView(res, 'Não foi possível salvar as datas.');
  },
};

// ---- Revisão e prévia (E5: `GET .../sprint-plans/{id}/review`, `POST .../send-to-jira`) ----

export type PendingSeverity = 'BLOCKING' | 'WARNING';
export type PreviewKind = 'SET' | 'CHANGE' | 'UNCHANGED';
export type PreviewField = 'assignee' | 'sprint' | 'plannedStart' | 'plannedEnd';

export interface ReviewPerson extends Omit<DistributionPerson, 'absences'> {
  subtaskCount: number;
  datedSubtaskCount: number;
}

export interface ReviewSubtask {
  key: string;
  title: string | null;
  typeName: string | null;
  /** O backend só manda subtarefas distribuíveis: DEV ou QA (FORA/SEM ficam de fora da revisão). */
  cls: 'DEV' | 'QA';
  assigneeId: string | null;
  assigneeName: string | null;
  startDate: string | null;
  endDate: string | null;
  estimateH: number;
}

export interface ReviewTask {
  itemId: string;
  parentKey: string;
  title: string | null;
  devHours: number;
  qaHours: number;
  subtasks: ReviewSubtask[];
}

export interface ReviewPending {
  code: string;
  severity: PendingSeverity;
  message: string;
  subtaskKey: string | null;
  accountId: string | null;
  itemId: string | null;
}

export interface JiraChange {
  issueKey: string;
  summary: string | null;
  field: PreviewField;
  /** Nome do campo de data no Jira, ou "campo a definir" (texto do servidor) enquanto a regra não o escolhe; null em assignee e sprint. */
  jiraFieldName: string | null;
  from: string | null;
  to: string | null;
  kind: PreviewKind;
}

export interface JiraPreview {
  rulesNote: string | null;
  sprintGoal: { from: string | null; to: string | null; kind: PreviewKind } | null;
  changes: JiraChange[];
  counts: { set: number; change: number; unchanged: number; issues: number };
}

export interface ReviewView {
  planId: string;
  status: PlanStatus;
  syncedAt: string | null;
  canEditPlan: boolean;
  sprint: { name: string; startDate: string; endDate: string };
  goal: string | null;
  goalSavedInJira: boolean;
  people: ReviewPerson[];
  tasks: ReviewTask[];
  pendings: ReviewPending[];
  blockingCount: number;
  warningCount: number;
  canSend: boolean;
  writeRulesDefined: boolean;
  jiraPreview: JiraPreview;
  jiraSprintUrl: string | null;
}

function isReviewView(v: unknown): v is ReviewView {
  const x = v as ReviewView | null;
  return (
    !!x && typeof x === 'object' && typeof x.planId === 'string' && typeof x.canEditPlan === 'boolean' &&
    Array.isArray(x.people) && Array.isArray(x.tasks) && Array.isArray(x.pendings) &&
    typeof x.blockingCount === 'number' && typeof x.warningCount === 'number' &&
    typeof x.canSend === 'boolean' && typeof x.writeRulesDefined === 'boolean' &&
    typeof x.status === 'string' && typeof x.goalSavedInJira === 'boolean' &&
    !!x.sprint && typeof x.sprint === 'object' && typeof x.sprint.name === 'string' && typeof x.sprint.startDate === 'string' && typeof x.sprint.endDate === 'string' &&
    x.pendings.every((p) => !!p && typeof p.code === 'string' && (p.severity === 'BLOCKING' || p.severity === 'WARNING') && typeof p.message === 'string') &&
    x.tasks.every((t) => !!t && typeof t.itemId === 'string' && Array.isArray(t.subtasks)) &&
    !!x.jiraPreview && typeof x.jiraPreview === 'object' && Array.isArray(x.jiraPreview.changes) &&
    !!x.jiraPreview.counts && typeof x.jiraPreview.counts === 'object' && typeof x.jiraPreview.counts.issues === 'number'
  );
}

/** Valida a forma do `ReviewView`; outra coisa (vazio, DistributionView, PlanView) vira erro em vez de tela errada. */
export function parseReviewView(data: unknown, fallback = 'Resposta inesperada do servidor.'): ReviewView {
  if (!isReviewView(data)) throw new CeremonyApiError(fallback, 502);
  return data;
}

export const SEND_NOT_AVAILABLE = 'O envio ao Jira ainda não está liberado: regras de escrita em definição.';

export const reviewApi = {
  async get(squadId: string, planId: string): Promise<ReviewView> {
    const res = await authFetch(`${base(squadId)}/${enc(planId)}/review`);
    if (!res.ok) await ensureOk(res, 'Não foi possível carregar a revisão.');
    return parseReviewView(await res.json().catch(() => null), 'Não foi possível carregar a revisão.');
  },

  /** Hoje o servidor responde 501; a tela mostra `SEND_NOT_AVAILABLE`. Outros erros trazem a mensagem do servidor. */
  async sendToJira(squadId: string, planId: string): Promise<void> {
    const res = await authFetch(`${base(squadId)}/${enc(planId)}/send-to-jira`, { method: 'POST' });
    if (res.status === 501) throw new CeremonyApiError(SEND_NOT_AVAILABLE, 501);
    await ensureOk(res, 'Não foi possível enviar ao Jira.');
  },
};
