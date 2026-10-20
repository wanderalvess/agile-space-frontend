/**
 * Lógica de exibição do Escopo (E3). A regra de verdade é do backend (horas do item, termômetro, divergência):
 * aqui só se escolhe o que mostrar e se faz uma ESTIMATIVA provisória enquanto a resposta do servidor não chega.
 * Quando o plano volta do servidor, os números dele substituem a estimativa.
 */

import type { BacklogParent, BacklogView, PlanItem, PlanView, SubtaskClass, Thermometer, UnclassifiedType } from './api';

export type Cls = 'DEV' | 'QA';
export const CLASSES: readonly Cls[] = ['DEV', 'QA'];

/** Horas que a tarefa pesa no total, na mesma regra do backend: sobra = restante; senão título; senão soma das subtarefas. */
export function parentHours(p: BacklogParent, cls: Cls): number {
  const sum = p.sumByClass?.[cls] ?? 0;
  if (p.carryOver) return sum;
  const t = p.titleHours ? (cls === 'DEV' ? p.titleHours.dev : p.titleHours.qa) : null;
  return t ?? sum;
}

/** Sem nenhuma hora (nem no título, nem nas subtarefas DEV/QA): precisa de estimativa. */
export function hasNoEstimate(p: BacklogParent): boolean {
  return parentHours(p, 'DEV') + parentHours(p, 'QA') <= 0;
}

/** Título sem "(DEV xh / QA yh)", mas com horas nas subtarefas. */
export function hasNoTitleHours(p: BacklogParent): boolean {
  return !p.carryOver && !p.titleHours && !hasNoEstimate(p);
}

export interface ScopeEntry {
  /** Id do item no plano; null enquanto a adição ainda não foi confirmada pelo servidor. */
  itemId: string | null;
  key: string;
  title: string | null;
  carryOver: boolean;
  dev: number;
  qa: number;
  pending: boolean;
  backlog: BacklogParent | null;
}

function itemHours(item: PlanItem, backlog: BacklogParent | undefined, cls: Cls): number {
  const direct = cls === 'DEV' ? item.devHours : item.qaHours;
  if (typeof direct === 'number') return direct;
  if (backlog) return parentHours(backlog, cls);
  return (cls === 'DEV' ? item.titleDevHours : item.titleQaHours) ?? 0;
}

/**
 * O escopo "como a tela mostra agora": itens do plano (menos os que estão sendo tirados) + os que estão sendo
 * adicionados (a partir do backlog), na ordem do plano.
 */
export function buildScope(
  items: readonly PlanItem[],
  backlog: readonly BacklogParent[],
  pendingAdd: ReadonlySet<string>,
  pendingRemove: ReadonlySet<string>,
): ScopeEntry[] {
  const byKey = new Map(backlog.map((b) => [b.key, b]));
  const out: ScopeEntry[] = [];
  const present = new Set<string>();
  for (const it of [...items].sort((a, b) => a.sortOrder - b.sortOrder)) {
    present.add(it.parentKey);
    if (pendingRemove.has(it.id)) continue;
    const b = byKey.get(it.parentKey);
    out.push({
      itemId: it.id, key: it.parentKey, title: it.title ?? b?.title ?? null, carryOver: it.carryOver || !!b?.carryOver,
      dev: itemHours(it, b, 'DEV'), qa: itemHours(it, b, 'QA'), pending: false, backlog: b ?? null,
    });
  }
  for (const key of pendingAdd) {
    const b = byKey.get(key);
    if (!b || present.has(key)) continue;
    out.push({ itemId: null, key, title: b.title, carryOver: b.carryOver, dev: parentHours(b, 'DEV'), qa: parentHours(b, 'QA'), pending: true, backlog: b });
  }
  return out;
}

export function scopeTotals(entries: readonly ScopeEntry[]): Record<Cls, number> {
  return {
    DEV: entries.reduce((s, e) => s + e.dev, 0),
    QA: entries.reduce((s, e) => s + e.qa, 0),
  };
}

/**
 * Termômetro provisório: mesmas faixas do backend (verde < 85%, amarelo até 95%, vermelho acima) e estado pela
 * reserva (até 100% + reserva = coberto; acima = acima da reserva). Só vale enquanto a resposta chega.
 */
export function estimateThermometer(base: Thermometer | undefined, allocatedHours: number): Thermometer {
  const cap = base?.capacityHours ?? 0;
  const reservePct = base?.reservePct ?? 0;
  const limit = cap * (1 + reservePct / 100);
  if (cap <= 0) {
    return { allocatedHours, capacityHours: 0, pct: null, zone: 'SEM_CAPACIDADE', state: 'SEM_CAPACIDADE', reservePct, reserveLimitHours: 0 };
  }
  const pct = (allocatedHours / cap) * 100;
  const zone = pct < 85 ? 'VERDE' : pct <= 95 ? 'AMARELO' : 'VERMELHO';
  const state = pct <= 100 ? 'DENTRO_DA_CAPACIDADE' : allocatedHours <= limit ? 'COBERTO_PELA_RESERVA' : 'ACIMA_DA_RESERVA';
  return { allocatedHours, capacityHours: cap, pct, zone, state, reservePct, reserveLimitHours: limit };
}

/** "18h" (sem espaço), usado nas frases de divergência e de resumo. */
export function hoursShort(h: number | null | undefined): string {
  const v = typeof h === 'number' && Number.isFinite(h) ? h : 0;
  return `${(Math.round(v * 10) / 10).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}h`;
}

function joinNames(names: string[]): string {
  if (names.length <= 1) return names[0] ?? '';
  return `${names.slice(0, -1).join(', ')} e ${names[names.length - 1]}`;
}

/**
 * Frases de divergência título x subtarefas, uma por classe divergente:
 * "Título diz DEV 18h, subtarefa Codificação tem 16h. Vale o título".
 */
export function divergenceMessages(p: BacklogParent): string[] {
  const out: string[] = [];
  for (const cls of CLASSES) {
    const flagged = cls === 'DEV' ? p.divergenceDev : p.divergenceQa;
    if (!flagged || !p.titleHours) continue;
    const title = cls === 'DEV' ? p.titleHours.dev : p.titleHours.qa;
    const subs = p.subtasks.filter((s) => s.subtaskClass === cls);
    const names = [...new Set(subs.map((s) => s.typeName ?? s.title ?? s.key))];
    const sum = p.sumByClass?.[cls] ?? 0;
    const who = subs.length === 0
      ? `não há subtarefa ${cls} (0h)`
      : subs.length === 1 ? `subtarefa ${names[0]} tem ${hoursShort(sum)}` : `subtarefas ${joinNames(names)} somam ${hoursShort(sum)}`;
    out.push(`Título diz ${cls} ${hoursShort(title)}, ${who}. Vale o título`);
  }
  return out;
}

/** Tempo Estimado e Tempo Restante (subtarefas DEV e QA) da sobra, para o destaque do carry-over. */
export function carryOverTimes(p: BacklogParent): { estimated: number; remaining: number } {
  const counted = p.subtasks.filter((s) => s.subtaskClass === 'DEV' || s.subtaskClass === 'QA');
  return {
    estimated: counted.reduce((s, x) => s + x.estimateH, 0),
    remaining: counted.reduce((s, x) => s + x.remainingH, 0),
  };
}

export function unclassifiedCount(p: BacklogParent): number {
  return p.subtasks.filter((s) => s.subtaskClass === ('SEM_CLASSIFICACAO' as SubtaskClass)).length;
}

export function unclassifiedSummary(types: readonly UnclassifiedType[]): { count: number; hours: number; names: string } | null {
  if (types.length === 0) return null;
  return {
    count: types.reduce((s, t) => s + t.count, 0),
    hours: types.reduce((s, t) => s + t.hours, 0),
    names: types.map((t) => `${t.typeName ?? 'Tipo sem nome'} (${t.count})`).join(', '),
  };
}

export type ScopeFilter = 'todas' | 'sobra' | 'divergentes' | 'sem-estimativa';

export const FILTER_LABEL: Record<ScopeFilter, string> = {
  todas: 'Todas',
  sobra: 'Sobra da anterior',
  divergentes: 'Com divergência',
  'sem-estimativa': 'Sem estimativa',
};

/** Refinadas que ainda não estão no escopo, filtradas pela busca, "só com horas" e o filtro escolhido. */
export function filterBacklog(
  backlog: BacklogView | null,
  inScope: ReadonlySet<string>,
  opts: { query: string; onlyWithHours: boolean; filter: ScopeFilter },
): BacklogParent[] {
  if (!backlog) return [];
  const q = opts.query.trim().toLowerCase();
  return backlog.items.filter((p) => {
    if (inScope.has(p.key)) return false;
    if (q && !(p.key.toLowerCase().includes(q) || (p.title ?? '').toLowerCase().includes(q))) return false;
    if (opts.onlyWithHours && hasNoEstimate(p)) return false;
    if (opts.filter === 'sobra') return p.carryOver;
    if (opts.filter === 'divergentes') return p.divergent;
    if (opts.filter === 'sem-estimativa') return hasNoEstimate(p);
    return true;
  });
}

/** "há 3 min", "agora há pouco", "há 2 h", "há 3 dias"; vazio quando nunca sincronizou. */
export function syncedAgo(syncedAt: string | null | undefined, now: number = Date.now()): string | null {
  if (!syncedAt) return null;
  const t = Date.parse(syncedAt);
  if (!Number.isFinite(t)) return null;
  const min = Math.max(0, Math.floor((now - t) / 60000));
  if (min < 1) return 'agora há pouco';
  if (min < 60) return `há ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `há ${h} h`;
  const d = Math.floor(h / 24);
  return d === 1 ? 'há 1 dia' : `há ${d} dias`;
}

/** Plano pode avançar da etapa Escopo? (o backend também exige: 422). */
export function canAdvanceFromScope(plan: Pick<PlanView, 'items'>): boolean {
  return plan.items.length >= 1;
}
