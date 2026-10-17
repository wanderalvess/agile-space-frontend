/**
 * Plano de ação a partir do resultado do Radar de clima, sem React: a criação (com o resultado de cada item),
 * e a trava "plano já criado" guardada neste navegador.
 *
 * A trava é só local: o servidor ainda não guarda de qual radar o plano saiu (falta o campo de origem no plano
 * e na ação), então outra pessoa, outro navegador ou outro aparelho podem criar de novo. Quando o backend
 * gravar a origem, a trava passa a vir de lá e esta fica só como atalho.
 */

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

// ───────────────────────── Criação ─────────────────────────

export interface PlanItemInput {
  key: string;
  what: string;
  why: string;
  who: string;
  priority: 'critica' | 'media';
}

export type ItemOutcome = 'ok' | 'error';

export interface PlanDeps {
  /** Cria o plano da squad (5W2H). */
  createBoard: (board: { title: string; team: string }) => Promise<{ id: string }>;
  createTask: (boardId: string, task: { what: string; why: string; where: string; when: string; who: string; how: string; howMuch: string; status: 'todo'; order: number }) => Promise<unknown>;
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
  outcomes: Record<string, ItemOutcome>;
}

export const PLAN_TAG = 'Radar de clima';

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
  if (!planId) {
    try {
      planId = (await deps.createBoard({ title: planTitle, team })).id;
    } catch {
      for (const item of todo) outcomes[item.key] = 'error';
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
      });
      outcomes[item.key] = 'ok';
    } catch {
      outcomes[item.key] = 'error';
    }
  }
  return { planId, planTitle, planFailed: false, outcomes };
}
