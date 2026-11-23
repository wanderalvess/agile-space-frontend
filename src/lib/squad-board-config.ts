/**
 * Personalização do quadro Scrum da squad (filtros rápidos, raias, estratégia de raias e limites de WIP).
 *
 * A fonte da verdade é o servidor (`/squads/{id}/board-config`), compartilhada por todos que abrem o quadro; só a
 * liderança grava. Antes isto ficava no localStorage de quem editou e a tela dizia "atualizados no quadro".
 * As chaves antigas do localStorage continuam sendo LIDAS enquanto a squad não tem configuração no servidor
 * (para ninguém perder o que já tinha), e são apagadas quando a liderança grava a parte correspondente.
 */
import { authFetch } from '@/lib/auth-client';
import type { GreenhopperQuickFilter, GreenhopperSwimlane, GreenhopperWorkData } from '@/services/greenhopperService';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8002/api';

export type SwimlaneStrategy = 'queries' | 'parents' | 'assignees' | 'epics' | 'none';
export const SWIMLANE_STRATEGIES: readonly SwimlaneStrategy[] = ['queries', 'parents', 'assignees', 'epics', 'none'];

export interface ColumnWipOverride {
  id: string | number;
  min: number | null;
  max: number | null;
}

/** Cada parte nula/ausente = sem personalização: vale o que o Jira trouxe. */
export interface BoardConfig {
  quickFilters?: GreenhopperQuickFilter[] | null;
  swimlanes?: GreenhopperSwimlane[] | null;
  swimlaneStrategy?: SwimlaneStrategy | null;
  columns?: ColumnWipOverride[] | null;
}

export type BoardConfigPatch = BoardConfig;

export class BoardConfigError extends Error {
  constructor(public readonly status: number, message: string) {
    super(message);
    this.name = 'BoardConfigError';
  }
}

async function readError(res: Response, fallback: string): Promise<BoardConfigError> {
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
  return new BoardConfigError(res.status, detail ? detail.slice(0, 400) : `${fallback} (HTTP ${res.status})`);
}

const url = (squadId: string) => `${API_BASE_URL}/squads/${encodeURIComponent(squadId)}/board-config`;

const asList = <T,>(v: unknown): T[] | null => (Array.isArray(v) && v.length > 0 ? (v as T[]) : null);

/** Normaliza o que o servidor devolveu (linha nova traz tudo nulo). */
export function normalizeBoardConfig(raw: unknown): BoardConfig {
  const r = (raw ?? {}) as Record<string, unknown>;
  const strategy = SWIMLANE_STRATEGIES.includes(r.swimlaneStrategy as SwimlaneStrategy)
    ? (r.swimlaneStrategy as SwimlaneStrategy)
    : null;
  return {
    quickFilters: asList<GreenhopperQuickFilter>(r.quickFilters),
    swimlanes: asList<GreenhopperSwimlane>(r.swimlanes),
    swimlaneStrategy: strategy,
    columns: asList<ColumnWipOverride>(r.columns),
  };
}

export const boardConfigApi = {
  /** `null` = servidor sem o recurso (404/405, versão antiga) ou sem rede: a tela segue com o que tem. */
  async get(squadId: string): Promise<BoardConfig | null> {
    try {
      const res = await authFetch(url(squadId));
      if (res.status === 404 || res.status === 405) return null;
      if (!res.ok) throw await readError(res, 'Falha ao carregar a configuração do quadro');
      return normalizeBoardConfig(await res.json());
    } catch {
      return null;
    }
  },

  /** Grava só as partes presentes em `patch`; `null` numa parte apaga a personalização dela. Só a liderança. */
  async save(squadId: string, patch: BoardConfigPatch): Promise<BoardConfig> {
    const res = await authFetch(url(squadId), {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    });
    if (!res.ok) throw await readError(res, 'Falha ao salvar a configuração do quadro');
    return normalizeBoardConfig(await res.json());
  },
};

// ---------------------------------------------------------------- chaves antigas do localStorage

const LEGACY_KEYS = {
  quickFilters: (id: string) => `agile_quick_filters_${id}`,
  swimlanes: (id: string) => `agile_swimlanes_${id}`,
  swimlaneStrategy: (id: string) => `agile_swimlane_strategy_${id}`,
  columns: (id: string) => `agile_columns_${id}`,
} as const;

function readJson<T>(key: string): T[] | null {
  try {
    const raw = localStorage.getItem(key);
    return raw ? asList<T>(JSON.parse(raw)) : null;
  } catch {
    return null;
  }
}

/** O que este navegador guardou antes de a configuração ir para o servidor. */
export function readLegacyBoardConfig(squadId: string): BoardConfig {
  if (typeof window === 'undefined' || !squadId) return {};
  let strategy: SwimlaneStrategy | null = null;
  try {
    const saved = localStorage.getItem(LEGACY_KEYS.swimlaneStrategy(squadId));
    if (SWIMLANE_STRATEGIES.includes(saved as SwimlaneStrategy)) strategy = saved as SwimlaneStrategy;
  } catch {
    // armazenamento bloqueado
  }
  return {
    quickFilters: readJson<GreenhopperQuickFilter>(LEGACY_KEYS.quickFilters(squadId)),
    swimlanes: readJson<GreenhopperSwimlane>(LEGACY_KEYS.swimlanes(squadId)),
    swimlaneStrategy: strategy,
    columns: readJson<ColumnWipOverride>(LEGACY_KEYS.columns(squadId)),
  };
}

/** Servidor sem o recurso (versão antiga): guarda só neste navegador, como antes. */
export function saveLegacyBoardConfig(squadId: string, patch: BoardConfigPatch): void {
  if (typeof window === 'undefined' || !squadId) return;
  for (const part of Object.keys(patch) as (keyof BoardConfig)[]) {
    const value = patch[part];
    try {
      if (value == null) localStorage.removeItem(LEGACY_KEYS[part](squadId));
      else localStorage.setItem(LEGACY_KEYS[part](squadId), typeof value === 'string' ? value : JSON.stringify(value));
    } catch {
      // armazenamento bloqueado
    }
  }
}

/** Apaga as chaves antigas das partes que acabaram de ir para o servidor. */
export function clearLegacyBoardConfig(squadId: string, parts: (keyof BoardConfig)[]): void {
  if (typeof window === 'undefined' || !squadId) return;
  for (const part of parts) {
    try {
      localStorage.removeItem(LEGACY_KEYS[part](squadId));
    } catch {
      // armazenamento bloqueado
    }
  }
}

/** Servidor primeiro; o que o servidor não tem, cai no que este navegador guardou. */
export function effectiveBoardConfig(shared: BoardConfig | null, squadId: string): BoardConfig {
  const legacy = readLegacyBoardConfig(squadId);
  return {
    quickFilters: shared?.quickFilters ?? legacy.quickFilters ?? null,
    swimlanes: shared?.swimlanes ?? legacy.swimlanes ?? null,
    swimlaneStrategy: shared?.swimlaneStrategy ?? legacy.swimlaneStrategy ?? null,
    columns: shared?.columns ?? legacy.columns ?? null,
  };
}

/** Aplica a personalização por cima dos dados do quadro vindos do Jira. Pura. */
export function applyBoardConfig(data: GreenhopperWorkData, config: BoardConfig): GreenhopperWorkData {
  let next = data;
  if (config.quickFilters && config.quickFilters.length > 0) {
    next = { ...next, quickFiltersData: { quickFilters: config.quickFilters } };
  }
  if (config.swimlanes && config.swimlanes.length > 0) {
    next = { ...next, swimlanesData: { swimlanes: config.swimlanes } };
  }
  if (config.columns && config.columns.length > 0) {
    const byId = new Map(config.columns.map(o => [String(o.id), o]));
    next = {
      ...next,
      columnsData: {
        columns: next.columnsData.columns.map(c => {
          const ov = byId.get(String(c.id));
          return ov ? { ...c, min: ov.min, max: ov.max } : c;
        }),
      },
    };
  }
  return next;
}
