/**
 * Lógica de exibição do Escopo (E3). A regra de verdade é do backend (horas do item, termômetro, divergência):
 * os itens já chegam com `devHours`/`qaHours` (o que conta), flags de divergência e totais. Aqui só se escolhe o que
 * mostrar e se faz uma ESTIMATIVA provisória (a partir do backlog) enquanto a resposta do servidor não chega; quando
 * ela chega, os números dele substituem a estimativa.
 */

import type { BacklogParent, BacklogView, PlanItem, PlanView, ScopeView, SubtaskClass, Thermometer, UnclassifiedType } from './api';

export type Cls = 'DEV' | 'QA';
export const CLASSES: readonly Cls[] = ['DEV', 'QA'];

/** Code Review DEV presumido quando a pai nova ainda não tem a subtarefa (a mesma constante do backend). */
export const DEFAULT_CODE_REVIEW_DEV_HOURS = 1;

/** Subtarefa de Code Review: pela flag do servidor ou, nos itens do plano, pelo id da semente / nome do tipo. */
export function isCodeReviewSubtask(s: { codeReview?: boolean; typeId?: string | null; typeName?: string | null }): boolean {
  if (typeof s.codeReview === 'boolean') return s.codeReview;
  return s.typeId === '12300' || (s.typeName ?? '').trim().toLowerCase() === 'code review';
}

/** Horas de Code Review que entram no item novo (com título): as das subtarefas; DEV sem subtarefa = hora padrão; QA só se existir. */
export function parentCodeReview(p: BacklogParent, cls: Cls): number {
  if (p.carryOver) return p.codeReviewByClass?.[cls] ?? 0;
  if (!p.titleHours || (p.titleHours.dev == null && p.titleHours.qa == null)) return p.codeReviewByClass?.[cls] ?? 0;
  const t = cls === 'DEV' ? p.titleHours.dev : p.titleHours.qa;
  if (t == null) return 0;
  if (cls === 'DEV' && !p.hasCodeReviewDev) return DEFAULT_CODE_REVIEW_DEV_HOURS;
  return p.codeReviewByClass?.[cls] ?? 0;
}

/**
 * Horas que a tarefa pesa no total, na mesma regra do backend: sobra = restante; com horas no título (do Poker, sem
 * Code Review) = título + Code Review da classe; senão soma das subtarefas.
 */
export function parentHours(p: BacklogParent, cls: Cls): number {
  const sum = p.sumByClass?.[cls] ?? 0;
  if (p.carryOver) return sum;
  const t = p.titleHours ? (cls === 'DEV' ? p.titleHours.dev : p.titleHours.qa) : null;
  if (!p.titleHours || (p.titleHours.dev == null && p.titleHours.qa == null)) return sum;
  return (t ?? 0) + parentCodeReview(p, cls);
}

/** Decomposição "DEV 6 h = título 5 h + Code Review 1 h" (null na sobra e quando não há Code Review a mostrar). */
export interface HoursBreakdown { cls: Cls; total: number; title: number; codeReview: number; assumed: boolean }

export function itemBreakdown(i: PlanItem): HoursBreakdown[] {
  if (i.carryOver) return [];
  const out: HoursBreakdown[] = [];
  const dev = { cls: 'DEV' as const, total: i.devHours ?? 0, cr: i.codeReviewDevH ?? 0, title: i.titleDevHours };
  const qa = { cls: 'QA' as const, total: i.qaHours ?? 0, cr: i.codeReviewQaH ?? 0, title: i.titleQaHours };
  for (const c of [dev, qa]) {
    if (c.title == null || c.cr <= 0) continue;
    out.push({ cls: c.cls, total: c.total, title: c.title, codeReview: c.cr, assumed: c.cls === 'DEV' && !!i.codeReviewDevAssumed });
  }
  return out;
}

export function backlogBreakdown(p: BacklogParent): HoursBreakdown[] {
  if (p.carryOver || !p.titleHours) return [];
  const out: HoursBreakdown[] = [];
  for (const cls of CLASSES) {
    const title = cls === 'DEV' ? p.titleHours.dev : p.titleHours.qa;
    const cr = parentCodeReview(p, cls);
    if (title == null || cr <= 0) continue;
    out.push({ cls, total: parentHours(p, cls), title, codeReview: cr, assumed: cls === 'DEV' && !p.hasCodeReviewDev });
  }
  return out;
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
  /** Horas que contam no total: `devHours`/`qaHours` do servidor; só na adição pendente vêm da estimativa local. */
  dev: number;
  qa: number;
  pending: boolean;
  /** Item do plano (servidor); null enquanto pendente. */
  item: PlanItem | null;
  backlog: BacklogParent | null;
}

/**
 * O escopo "como a tela mostra agora": itens do plano (menos os que estão sendo tirados) + os que estão sendo
 * adicionados (estimativa a partir do backlog), na ordem do plano.
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
      itemId: it.id, key: it.parentKey, title: it.title ?? b?.title ?? null, carryOver: it.carryOver,
      dev: it.devHours ?? 0, qa: it.qaHours ?? 0, pending: false, item: it, backlog: b ?? null,
    });
  }
  for (const key of pendingAdd) {
    const b = byKey.get(key);
    if (!b || present.has(key)) continue;
    out.push({ itemId: null, key, title: b.title, carryOver: b.carryOver, dev: parentHours(b, 'DEV'), qa: parentHours(b, 'QA'), pending: true, item: null, backlog: b });
  }
  return out;
}

/** Aplica a resposta de escopo do servidor (`ScopeView`) ao plano: versão (`planVersion`), itens, totais e termômetro. */
export function applyScope(plan: PlanView, scope: ScopeView): PlanView {
  return { ...plan, version: scope.planVersion, items: scope.items, scope: scope.totals, thermometer: scope.thermometer };
}

/** Ids dos itens na ordem em que a tela os mostra (sortOrder). */
export function orderedIds(items: readonly PlanItem[]): string[] {
  return [...items].sort((a, b) => a.sortOrder - b.sortOrder).map((i) => i.id);
}

/** Move o item uma posição para cima (-1) ou para baixo (+1); devolve a mesma lista quando não dá para mover. */
export function moveId(ids: readonly string[], id: string, dir: -1 | 1): string[] {
  const from = ids.indexOf(id);
  const to = from + dir;
  if (from < 0 || to < 0 || to >= ids.length) return [...ids];
  const out = [...ids];
  [out[from], out[to]] = [out[to], out[from]];
  return out;
}

/** Reaplica a ordem otimista aos itens (sortOrder = posição); ids fora da lista vão para o fim. */
export function applyOrder(items: readonly PlanItem[], ids: readonly string[]): PlanItem[] {
  const pos = new Map(ids.map((id, i) => [id, i + 1]));
  return items.map((it) => ({ ...it, sortOrder: pos.get(it.id) ?? ids.length + it.sortOrder }));
}

export function scopeTotals(entries: readonly ScopeEntry[]): Record<Cls, number> {
  return {
    DEV: entries.reduce((s, e) => s + e.dev, 0),
    QA: entries.reduce((s, e) => s + e.qa, 0),
  };
}

/** Número de tarefas e horas DEV/QA do escopo: os totais do servidor; a soma local só enquanto há mudança pendente. */
export function scopeSummary(plan: Pick<PlanView, 'scope' | 'thermometer'>, entries: readonly ScopeEntry[], estimated: boolean): { count: number; DEV: number; QA: number } {
  const local = scopeTotals(entries);
  if (estimated || !plan.scope) return { count: entries.length, ...local };
  const alloc = (c: Cls) => plan.scope.allocated?.[c] ?? plan.thermometer?.[c]?.allocatedHours ?? local[c];
  return { count: plan.scope.itemCount, DEV: alloc('DEV'), QA: alloc('QA') };
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

function divergencePhrase(cls: Cls, title: number | null, names: string[], count: number, sum: number): string {
  const who = count === 0
    ? `não há subtarefa ${cls} (0h)`
    : count === 1 ? `subtarefa ${names[0]} tem ${hoursShort(sum)}` : `subtarefas ${joinNames(names)} somam ${hoursShort(sum)}`;
  return `Título diz ${cls} ${hoursShort(title)}, ${who}. Vale o título`;
}

/**
 * Frases de divergência título x subtarefas, uma por classe divergente (backlog):
 * "Título diz DEV 18h, subtarefa Codificação tem 16h. Vale o título".
 */
export function divergenceMessages(p: BacklogParent): string[] {
  const out: string[] = [];
  for (const cls of CLASSES) {
    const flagged = cls === 'DEV' ? p.divergenceDev : p.divergenceQa;
    if (!flagged || !p.titleHours) continue;
    const title = cls === 'DEV' ? p.titleHours.dev : p.titleHours.qa;
    const subs = p.subtasks.filter((s) => s.subtaskClass === cls && !isCodeReviewSubtask(s));
    const names = [...new Set(subs.map((s) => s.typeName ?? s.title ?? s.key))];
    out.push(divergencePhrase(cls, title, names, subs.length, (p.sumByClass?.[cls] ?? 0) - (p.codeReviewByClass?.[cls] ?? 0)));
  }
  return out;
}

/** O mesmo, para um item do plano: a flag e as somas vêm do servidor (`divergenceDev/Qa`, `subtaskDevH/QaH`). */
export function itemDivergenceMessages(i: PlanItem): string[] {
  const out: string[] = [];
  for (const cls of CLASSES) {
    const flagged = cls === 'DEV' ? i.divergenceDev : i.divergenceQa;
    const title = cls === 'DEV' ? i.titleDevHours : i.titleQaHours;
    if (!flagged || title == null) continue;
    const subs = (i.subtasks ?? []).filter((s) => s.cls === cls && !isCodeReviewSubtask(s));
    const names = [...new Set(subs.map((s) => s.typeName ?? s.title ?? s.key))];
    out.push(divergencePhrase(cls, title, names, subs.length, (cls === 'DEV' ? i.subtaskDevH : i.subtaskQaH) ?? 0));
  }
  return out;
}

/** Os avisos de uma tarefa, no mesmo formato para a refinada (backlog) e para o item do plano (servidor). */
export interface TaskNoticeData {
  key: string;
  carryOver: boolean;
  /** Tempo Estimado / Restante das subtarefas DEV+QA (só mostrado na sobra). */
  estimated: number;
  remaining: number;
  noEstimate: boolean;
  noTitleHours: boolean;
  divergences: string[];
  unclassified: number;
  /** "DEV 6 h = título 5 h + Code Review 1 h" (vazio na sobra). */
  breakdown: HoursBreakdown[];
  /** A pai saiu do backlog refinado depois de entrar no plano (valem as horas gravadas na inclusão). */
  outOfBacklog: boolean;
}

export function noticesFromBacklog(p: BacklogParent): TaskNoticeData {
  const t = carryOverTimes(p);
  return {
    key: p.key, carryOver: p.carryOver, estimated: t.estimated, remaining: t.remaining, noEstimate: hasNoEstimate(p),
    noTitleHours: hasNoTitleHours(p), divergences: divergenceMessages(p), unclassified: unclassifiedCount(p), outOfBacklog: false, breakdown: backlogBreakdown(p),
  };
}

export function noticesFromItem(i: PlanItem): TaskNoticeData {
  return {
    key: i.parentKey, carryOver: i.carryOver,
    estimated: (i.subtaskDevEstimateH ?? 0) + (i.subtaskQaEstimateH ?? 0),
    remaining: (i.subtaskDevRemainingH ?? 0) + (i.subtaskQaRemainingH ?? 0),
    noEstimate: !!i.noEstimate,
    noTitleHours: !i.carryOver && !i.noEstimate && i.titleDevHours == null && i.titleQaHours == null,
    divergences: itemDivergenceMessages(i), unclassified: i.unclassifiedCount ?? 0, outOfBacklog: i.inBacklog === false, breakdown: itemBreakdown(i),
  };
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
  return (plan.items?.length ?? 0) >= 1;
}
