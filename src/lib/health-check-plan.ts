/**
 * Plano de ação a partir do resultado do Radar de clima, sem React: a criação (com o resultado de cada item),
 * a origem enviada ao servidor e a trava "plano já criado" guardada neste navegador.
 *
 * A trava de verdade está no servidor (V78): o plano guarda `HEALTH_CHECK` + o id do radar, e um segundo plano da
 * mesma origem na mesma squad volta 409 (`conflict` no resultado). A trava local (`PlanRecord`) fica só de reserva
 * para o backend antigo, que não guarda a origem: nele outra pessoa, outro navegador ou outro aparelho podem criar de novo.
 */

import { conflictOf, type KnownPlan, type OriginCheck } from '@/lib/action-plan-origin';
import type { ActionPlanBoard, PlanSourceType } from '@/lib/types';

export type PlanDestination = 'squad' | 'kanban';

export interface PlanRecord {
  boardId: string;
  destination: PlanDestination;
  /** Plano da squad criado (para "Abrir plano"). */
  planId?: string;
  planTitle?: string;
  /** O que foi criado, por dimensão. */
  items: { key: string; what: string }[];
  createdAt: string;
}

const STORAGE_KEY = 'healthCheck.plans.v1';

type PlanStore = Record<string, PlanRecord>;

function readStore(storage: Pick<Storage, 'getItem'> | undefined): PlanStore {
  try {
    const raw = storage?.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? (parsed as PlanStore) : {};
  } catch {
    return {};
  }
}

function browserStorage(): Storage | undefined {
  try {
    return typeof window === 'undefined' ? undefined : window.localStorage;
  } catch {
    return undefined;
  }
}

export function readPlanRecord(boardId: string, storage: Pick<Storage, 'getItem'> | undefined = browserStorage()): PlanRecord | null {
  const record = readStore(storage)[boardId];
  return record && record.boardId === boardId && Array.isArray(record.items) ? record : null;
}

export function writePlanRecord(record: PlanRecord, storage: Pick<Storage, 'getItem' | 'setItem'> | undefined = browserStorage()): void {
  if (!storage) return;
  try {
    const store = readStore(storage);
    store[record.boardId] = record;
    storage.setItem(STORAGE_KEY, JSON.stringify(store));
  } catch {
    // armazenamento cheio ou bloqueado: a trava some, o resto segue
  }
}

/** A trava local como "plano conhecido": só o registro do plano da squad serve de aviso (o Kanban pessoal não tem plano). */
export function recordToLock(record: PlanRecord | null): KnownPlan | null {
  return record && record.destination === 'squad' && record.planId ? { id: record.planId, title: record.planTitle || 'Plano de ação' } : null;
}

/**
 * Este radar já tem plano? Vale o servidor; sem ele, vale o registro deste navegador. Registro de plano da squad que
 * o servidor diz estar velho (o plano foi apagado) não conta.
 */
export function planAlreadyCreated(record: PlanRecord | null, check: OriginCheck | null): boolean {
  if (check?.kind === 'server') return true;
  if (!record) return false;
  return !(record.destination === 'squad' && check?.kind === 'none' && check.stale);
}

// ───────────────────────── Criação ─────────────────────────

export interface PlanItemInput {
  key: string;
  /** Nome da dimensão do radar (vai como `sourceLabel` da ação). */
  label?: string;
  what: string;
  why: string;
  who: string;
  priority: 'critica' | 'media';
}

export type ItemOutcome = 'ok' | 'error';

export interface PlanDeps {
  /** Cria o plano da squad (5W2H). */
  createBoard: (board: { title: string; team: string; sourceType: PlanSourceType; sourceId: string; sourceTitle: string }) => Promise<{ id: string; sourceType?: PlanSourceType }>;
  createTask: (boardId: string, task: { what: string; why: string; where: string; when: string; who: string; how: string; howMuch: string; status: 'todo'; order: number; sourceItemId?: string; sourceLabel?: string }) => Promise<unknown>;
  /** Planos que já saíram desta sessão (`?squadId=&sourceType=&sourceId=`). Sem isto a tela só usa a trava local. */
  listBySource?: (q: { squadId?: string; sourceType: PlanSourceType; sourceId: string }) => Promise<readonly ActionPlanBoard[]>;
  getBoard?: (id: string) => Promise<ActionPlanBoard>;
  /** Cria um cartão no Kanban pessoal. */
  saveKanbanCard: (card: { title: string; description: string; status: 'todo'; priority: 'critica' | 'media'; tag: string; originLink: string; exportedAt: string }) => Promise<unknown>;
}

export interface PlanRunInput {
  destination: PlanDestination;
  items: readonly PlanItemInput[];
  radarId: string;
  radarTitle: string;
  team: string;
  /** Plano da squad já criado numa tentativa anterior (só as ações que faltam são criadas). */
  existingPlanId?: string;
  /** Itens já criados antes (não são repetidos). */
  alreadyDone?: ReadonlySet<string>;
  deps: PlanDeps;
  now?: Date;
}

export interface PlanRunResult {
  planId?: string;
  planTitle?: string;
  /** O plano da squad não pôde ser criado: nenhuma ação foi tentada. */
  planFailed: boolean;
  /** O servidor recusou (409): esta sessão já tem plano. `existingPlanId` falta se o plano for privado. Nenhuma ação foi tentada. */
  conflict?: { existingPlanId?: string };
  /** O servidor guardou a origem do plano (backend com V78): a trava dele vale. */
  guarded?: boolean;
  outcomes: Record<string, ItemOutcome>;
}

export const PLAN_TAG = 'Radar de clima';
export const PLAN_SOURCE_TYPE: PlanSourceType = 'HEALTH_CHECK';

/** Cria os itens um a um e devolve o que deu certo e o que falhou (a tela mostra os dois, sem esconder falha parcial). */
export async function runPlan(input: PlanRunInput): Promise<PlanRunResult> {
  const { destination, items, radarId, radarTitle, team, deps, alreadyDone = new Set<string>(), now = new Date() } = input;
  const outcomes: Record<string, ItemOutcome> = {};
  for (const key of alreadyDone) outcomes[key] = 'ok';
  const todo = items.filter((i) => !alreadyDone.has(i.key));

  if (destination === 'kanban') {
    for (const item of todo) {
      try {
        await deps.saveKanbanCard({
          title: item.what,
          description: item.why,
          status: 'todo',
          priority: item.priority,
          tag: PLAN_TAG,
          originLink: `/health-check/${radarId}`,
          exportedAt: now.toISOString(),
        });
        outcomes[item.key] = 'ok';
      } catch {
        outcomes[item.key] = 'error';
      }
    }
    return { planFailed: false, outcomes };
  }

  const planTitle = `Plano de ação: ${radarTitle}`;
  let planId = input.existingPlanId;
  let guarded = false;
  if (!planId) {
    try {
      const created = await deps.createBoard({ title: planTitle, team, sourceType: PLAN_SOURCE_TYPE, sourceId: radarId, sourceTitle: radarTitle });
      planId = created.id;
      guarded = created.sourceType !== undefined;
    } catch (e) {
      const conflict = conflictOf(e);
      for (const item of todo) outcomes[item.key] = 'error';
      if (conflict) return { planFailed: false, conflict: { existingPlanId: conflict.existingPlanId }, planTitle, outcomes: {} };
      return { planFailed: true, planTitle, outcomes };
    }
  }
  const baseOrder = alreadyDone.size;
  let order = baseOrder;
  for (const item of todo) {
    try {
      await deps.createTask(planId, {
        what: item.what,
        why: item.why,
        where: `${PLAN_TAG}: ${radarTitle}`,
        when: '',
        who: item.who,
        how: '',
        howMuch: '',
        status: 'todo',
        order: order++,
        sourceItemId: item.key,
        sourceLabel: item.label || item.what,
      });
      outcomes[item.key] = 'ok';
    } catch {
      outcomes[item.key] = 'error';
    }
  }
  return { planId, planTitle, planFailed: false, guarded, outcomes };
}
