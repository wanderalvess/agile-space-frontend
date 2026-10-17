/**
 * Regras puras das telas de operação do admin (Sessões, Feedbacks, Auditoria, Anúncios, API Keys).
 * Ficam aqui, fora dos componentes, para serem testadas sem montar a tela.
 */
import type { ModuleKey } from '@/lib/modules-registry';

/* ------------------------------------------------------------------ CSV */

/** Campo de CSV: entre aspas quando tem vírgula, aspas ou quebra de linha (ou quando `force`). */
export function csvField(value: unknown, force = false): string {
  const text = value == null ? '' : String(value);
  if (force || /[",\r\n]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
  return text;
}

/** Monta o texto do CSV: cabeçalho + linhas, separador vírgula, quebra de linha \n. */
export function buildCsv(headers: string[], rows: unknown[][], quotedColumns: number[] = []): string {
  const lines = rows.map((row) => row.map((cell, i) => csvField(cell, quotedColumns.includes(i))).join(','));
  return [headers.join(','), ...lines].join('\n');
}

/** Baixa um CSV no navegador (UTF-8, sem BOM, como as telas já faziam). */
export function downloadCsv(filename: string, content: string): void {
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/* ------------------------------------------------------------------ Nomes no lugar de ID */

export interface NameIndex {
  byId: Map<string, string>;
  byEmail: Map<string, string>;
}

/** Índice id/e-mail -> nome a partir da lista de usuários do admin (vazio quando a lista não veio). */
export function buildNameIndex(users: Array<{ id?: string | null; email?: string | null; name?: string | null }>): NameIndex {
  const byId = new Map<string, string>();
  const byEmail = new Map<string, string>();
  for (const u of users || []) {
    const name = (u.name || '').trim();
    if (!name) continue;
    if (u.id) byId.set(String(u.id), name);
    if (u.email) byEmail.set(String(u.email).toLowerCase(), name);
  }
  return { byId, byEmail };
}

/** Nome da pessoa para um id ou e-mail; `null` quando a lista não conhece. */
export function resolveName(index: NameIndex | null | undefined, key?: string | null): string | null {
  if (!index || !key) return null;
  return index.byId.get(key) ?? index.byEmail.get(key.toLowerCase()) ?? null;
}

/* ------------------------------------------------------------------ Sessões */

export interface AdminSession {
  id: string;
  type: string;
  title?: string | null;
  createdAt?: string | null;
  creatorId?: string | null;
  participantCount?: number | null;
}

export interface SessionTool {
  label: string;
  module: ModuleKey;
  /** Caminho da sala (`null` quando a ferramenta ainda não tem tela de sala). */
  basePath: string | null;
}

export const SESSION_TOOLS: Record<string, SessionTool> = {
  poker: { label: 'Scrum Poker', module: 'poker', basePath: '/room' },
  retro: { label: 'Retrospectiva', module: 'retro', basePath: '/retro' },
  health: { label: 'Health Check', module: 'health', basePath: '/health-check' },
  brainstorm: { label: 'Brainstorm', module: 'brainstorming', basePath: '/brainstorming' },
  sprint_planning: { label: 'Planning', module: 'sprint-planner', basePath: null },
};

export const SESSION_TYPE_FILTERS = [
  { id: 'all', label: 'Todas' },
  { id: 'poker', label: 'Poker' },
  { id: 'retro', label: 'Retro' },
  { id: 'health', label: 'Health' },
  { id: 'brainstorm', label: 'Brainstorm' },
  { id: 'sprint_planning', label: 'Planning' },
] as const;

export const SESSION_PERIOD_OPTIONS = [
  { value: 'all', label: 'Todo o período' },
  { value: '7d', label: 'Últimos 7 dias' },
  { value: '30d', label: 'Últimos 30 dias' },
] as const;

/** Rota da sala da sessão (`null` quando não há tela: Planning). */
export function sessionOpenPath(type: string, id: string): string | null {
  const tool = SESSION_TOOLS[type];
  if (!tool || !tool.basePath) return null;
  return `${tool.basePath}/${encodeURIComponent(id)}`;
}

export interface SessionFilters {
  search: string;
  type: string;
  range: string;
}

export function filterSessions(sessions: AdminSession[], filters: SessionFilters, now: Date = new Date()): AdminSession[] {
  const term = filters.search.trim().toLowerCase();
  const limitDays = filters.range === '7d' ? 7 : filters.range === '30d' ? 30 : null;
  return sessions.filter((s) => {
    const matchSearch = !term || (s.title || '').toLowerCase().includes(term) || (s.id || '').toLowerCase().includes(term);
    const matchType = filters.type === 'all' || s.type === filters.type;
    let matchDate = true;
    if (limitDays != null) {
      const created = s.createdAt ? new Date(s.createdAt).getTime() : NaN;
      // Sessão sem data (histórico antigo) não entra num recorte de período.
      matchDate = Number.isFinite(created) && Math.ceil(Math.abs(now.getTime() - created) / 86_400_000) <= limitDays;
    }
    return matchSearch && matchType && matchDate;
  });
}

export type SessionSortKey = 'type' | 'title' | 'createdAt' | 'participantCount';
export interface SessionSort {
  key: SessionSortKey;
  direction: 'asc' | 'desc';
}

export function sortSessions(sessions: AdminSession[], sort: SessionSort | null): AdminSession[] {
  const list = [...sessions];
  if (!sort) return list;
  const value = (s: AdminSession): number | string => {
    if (sort.key === 'createdAt') return s.createdAt ? new Date(s.createdAt).getTime() || 0 : 0;
    if (sort.key === 'participantCount') return s.participantCount ?? 0;
    return String(s[sort.key] ?? '').toLowerCase();
  };
  return list.sort((a, b) => {
    const va = value(a);
    const vb = value(b);
    if (va < vb) return sort.direction === 'asc' ? -1 : 1;
    if (va > vb) return sort.direction === 'asc' ? 1 : -1;
    return 0;
  });
}

/** Retro não registra participantes (o servidor devolve 0): mostrar traço, não zero. */
export function sessionParticipants(s: Pick<AdminSession, 'type' | 'participantCount'>): { value: string; note: string } {
  if (s.type === 'retro') return { value: '—', note: 'não registra' };
  return { value: String(s.participantCount ?? 0), note: '' };
}

/** Texto do aviso final da exclusão em massa. */
export function bulkDeleteSummary(removed: number, failed: number): { title: string; description: string; failedAny: boolean } {
  const plural = (n: number, one: string, many: string) => (n === 1 ? one : many);
  if (failed > 0) {
    return {
      title: 'Exclusão em massa concluída com falhas',
      description: `${removed} ${plural(removed, 'removida', 'removidas')}, ${failed} ${plural(failed, 'não foi removida', 'não foram removidas')}.`,
      failedAny: true,
    };
  }
  return {
    title: 'Exclusão em massa concluída',
    description: `${removed} ${plural(removed, 'sessão removida', 'sessões removidas')}.`,
    failedAny: false,
  };
}

/** "Selecionar as 100 do filtro" aparece quando a página inteira está marcada e o filtro tem mais do que ela. */
export function canSelectWholeFilter(pageIds: string[], selectedIds: string[], filteredCount: number): boolean {
  if (pageIds.length === 0 || filteredCount <= pageIds.length) return false;
  return pageIds.every((id) => selectedIds.includes(id)) && selectedIds.length < filteredCount;
}

/* ------------------------------------------------------------------ Feedbacks */

export type ScoreTab = 'all' | 'promoters' | 'neutrals' | 'detractors' | 'suggestions';

export function matchesScoreTab(score: number, tab: ScoreTab): boolean {
  switch (tab) {
    case 'promoters':
      return score >= 9;
    case 'neutrals':
      return score >= 7 && score <= 8;
    case 'detractors':
      return score >= 0 && score <= 6;
    case 'suggestions':
      return score === -1;
    default:
      return true;
  }
}

export interface NpsResult {
  /** -100 a 100, arredondado; `null` quando não há notas (sugestões não contam). */
  nps: number | null;
  promoters: number;
  passives: number;
  detractors: number;
  total: number;
}

/** NPS geral: % de promotores (9-10) menos % de detratores (0-6) entre as notas; sugestões (-1) ficam de fora. */
export function computeNps(scores: number[]): NpsResult {
  const rated = scores.filter((s) => Number.isFinite(s) && s >= 0);
  const promoters = rated.filter((s) => s >= 9).length;
  const detractors = rated.filter((s) => s <= 6).length;
  const total = rated.length;
  return {
    nps: total === 0 ? null : Math.round(((promoters - detractors) / total) * 100),
    promoters,
    passives: total - promoters - detractors,
    detractors,
    total,
  };
}

export function formatNps(nps: number | null): string {
  if (nps == null) return '—';
  return nps > 0 ? `+${nps}` : String(nps);
}

export function npsSubtitle(r: NpsResult): string {
  if (r.total === 0) return 'Sem notas ainda';
  const p = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;
  return `${p(r.promoters, 'promotor', 'promotores')} e ${p(r.detractors, 'detrator', 'detratores')}, em ${p(r.total, 'nota', 'notas')}`;
}

export interface FeedbackLike {
  toolName: string;
  score: number;
  comment?: string | null;
  userId?: string | null;
  status: string;
}

export interface FeedbackFilters {
  search: string;
  status: string;
  tool: string;
  tab: ScoreTab;
}

/** Busca no comentário, no ID e (quando conhecido) no nome da pessoa. */
export function filterFeedbacks<T extends FeedbackLike>(items: T[], f: FeedbackFilters, names?: NameIndex | null): T[] {
  const term = f.search.trim().toLowerCase();
  return items.filter((it) => {
    const person = (resolveName(names, it.userId) || '').toLowerCase();
    const matchSearch =
      !term || (it.comment || '').toLowerCase().includes(term) || (it.userId || '').toLowerCase().includes(term) || person.includes(term);
    return (
      matchSearch &&
      (f.status === 'all' || it.status === f.status) &&
      (f.tool === 'all' || it.toolName === f.tool) &&
      matchesScoreTab(it.score, f.tab)
    );
  });
}

/* ------------------------------------------------------------------ Auditoria */

export interface AuditLike {
  action: string;
  performedBy: string;
  details?: string | null;
  createdAt?: string | null;
}

export const AUDIT_PERIOD_OPTIONS = [
  { value: 'all', label: 'Qualquer período' },
  { value: '24h', label: 'Últimas 24 horas' },
  { value: '7d', label: 'Últimos 7 dias' },
  { value: '30d', label: 'Últimos 30 dias' },
] as const;

const PERIOD_MS: Record<string, number> = { '24h': 86_400_000, '7d': 7 * 86_400_000, '30d': 30 * 86_400_000 };

export interface AuditFilters {
  search: string;
  period: string;
  action: string;
  operator: string;
}

export function filterAuditLogs<T extends AuditLike>(events: T[], f: AuditFilters, now: Date = new Date(), names?: NameIndex | null): T[] {
  const term = f.search.trim().toLowerCase();
  const span = PERIOD_MS[f.period];
  return events.filter((e) => {
    const operatorName = (resolveName(names, e.performedBy) || '').toLowerCase();
    const matchSearch =
      !term ||
      (e.action || '').toLowerCase().includes(term) ||
      (e.performedBy || '').toLowerCase().includes(term) ||
      operatorName.includes(term) ||
      (e.details || '').toLowerCase().includes(term);
    const matchAction = f.action === 'all' || e.action === f.action;
    const matchOperator = f.operator === 'all' || e.performedBy === f.operator;
    let matchPeriod = true;
    if (span) {
      const at = e.createdAt ? new Date(e.createdAt).getTime() : NaN;
      // Registro sem data não entra num recorte de período.
      matchPeriod = Number.isFinite(at) && now.getTime() - at <= span;
    }
    return matchSearch && matchAction && matchOperator && matchPeriod;
  });
}

/** Valores distintos e ordenados (opções dos filtros de ação e operador). */
export function distinctSorted(values: Array<string | null | undefined>): string[] {
  return Array.from(new Set(values.filter((v): v is string => !!v && v.trim() !== ''))).sort((a, b) => a.localeCompare(b, 'pt-BR'));
}

/* ------------------------------------------------------------------ Paginação "Exibir mais" */

export const PAGE_STEP = 20;

/** Quantos itens a próxima página soma (para o rótulo do botão). */
export function nextChunk(total: number, shown: number, step = PAGE_STEP): number {
  return Math.max(0, Math.min(step, total - shown));
}

/* ------------------------------------------------------------------ API Keys */

export const RENEW_TERMS = [
  { value: '30', label: '30 dias', hint: '' },
  { value: '90', label: '90 dias', hint: 'padrão' },
  { value: '180', label: '180 dias', hint: '' },
  { value: 'never', label: 'Sem expiração', hint: 'não recomendado' },
] as const;

/** "Nome (ana@…)" quando o dono é conhecido; o ID cru só como último recurso. */
export function ownerLabel(index: NameIndex | null | undefined, ownerUserId?: string | null): string | null {
  if (!ownerUserId) return null;
  return resolveName(index, ownerUserId) ?? null;
}

/** Texto do aviso depois de renovar. */
export function renewMessage(name: string, term: string): string {
  const span = term === 'never' ? 'sem expiração' : `por mais ${term} dias`;
  return `"${name}" vale ${span}. O papel e os escopos foram reavaliados com o papel atual do dono.`;
}
