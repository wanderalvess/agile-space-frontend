/**
 * Regras puras das telas de plataforma do admin (Versões, Sincronização Jira, Crescimento,
 * Motor AI, Cerimônias). Ficam fora dos componentes para serem testadas sem montar a tela.
 */
import type { ModuleKey } from '@/lib/modules-registry';

/* ------------------------------------------------------------------ Versões */

export type ReleaseType = 'patch' | 'minor' | 'major';

const MONTHS = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];

/** "16 de Outubro, 2026": o formato de texto livre que o Changelog já usa. */
export function getTodayFormatted(now: Date = new Date()): string {
  return `${now.getDate()} de ${MONTHS[now.getMonth()]}, ${now.getFullYear()}`;
}

/** Próxima tag SemVer a partir da mais recente. Sem tag anterior, começa do zero (v0.0.1, v0.1.0 ou v1.0.0). */
export function computeNextTag(currentTag: string | undefined, bumpType: ReleaseType): string {
  if (!currentTag) {
    if (bumpType === 'major') return 'v1.0.0';
    if (bumpType === 'minor') return 'v0.1.0';
    return 'v0.0.1';
  }
  const parts = currentTag.replace(/^v/, '').split('.').map((p) => parseInt(p, 10) || 0);
  while (parts.length < 3) parts.push(0);
  if (bumpType === 'major') {
    parts[0] += 1;
    parts[1] = 0;
    parts[2] = 0;
  } else if (bumpType === 'minor') {
    parts[1] += 1;
    parts[2] = 0;
  } else {
    parts[2] += 1;
  }
  return `v${parts.join('.')}`;
}

/** Itens colados em lote: separa por quebra de linha ou ";" e tira os marcadores "- * •". */
export function parseBulkChanges(text: string): string[] {
  return text
    .split(/[\n;]+/)
    .map((l) => l.trim().replace(/^[-*•]\s*/, ''))
    .filter((l) => l.length > 0);
}

export interface ReleaseIconOption {
  /** Chave gravada no dado (não mudar: o Changelog público lê esta chave). */
  name: string;
  /** Nome em português na tela. */
  label: string;
  /** Classe gravada junto do dado (o Changelog público a usa). */
  className: string;
  defaultFor?: ReleaseType;
}

export const RELEASE_ICONS: readonly ReleaseIconOption[] = [
  { name: 'Zap', label: 'Raio', className: 'h-5 w-5 text-indigo-500', defaultFor: 'patch' },
  { name: 'Sparkles', label: 'Brilho', className: 'h-5 w-5 text-emerald-500', defaultFor: 'minor' },
  { name: 'Flag', label: 'Bandeira', className: 'h-5 w-5 text-primary', defaultFor: 'major' },
  { name: 'ShieldCheck', label: 'Segurança', className: 'h-5 w-5 text-emerald-600' },
  { name: 'Layers', label: 'Módulos', className: 'h-5 w-5 text-blue-500' },
  { name: 'Code2', label: 'Código', className: 'h-5 w-5 text-amber-500' },
  { name: 'Database', label: 'Banco de dados', className: 'h-5 w-5 text-cyan-500' },
  { name: 'Cpu', label: 'Desempenho', className: 'h-5 w-5 text-rose-500' },
  { name: 'Globe', label: 'Integrações', className: 'h-5 w-5 text-teal-500' },
  { name: 'ListChecks', label: 'Qualidade', className: 'h-5 w-5 text-purple-500' },
];

/** Dados antigos guardam "Rocket"; a tela trata como "Flag" (bandeira). */
export function canonicalIconName(name?: string | null): string {
  return name === 'Rocket' ? 'Flag' : name || 'Sparkles';
}

export const RELEASE_FILTERS = [
  { id: 'all', label: 'Todas' },
  { id: 'patch', label: 'Patches' },
  { id: 'minor', label: 'Minors' },
  { id: 'major', label: 'Majors' },
  { id: 'draft', label: 'Rascunhos' },
] as const;

export interface ReleaseLike {
  tag: string;
  title: string;
  description?: string | null;
  changes?: string[] | null;
  type?: string | null;
  isPublished?: boolean;
}

export function filterReleases<T extends ReleaseLike>(releases: T[], search: string, typeFilter: string): T[] {
  const term = search.trim().toLowerCase();
  return releases.filter((r) => {
    const matchSearch =
      term === '' ||
      r.tag.toLowerCase().includes(term) ||
      r.title.toLowerCase().includes(term) ||
      (r.description || '').toLowerCase().includes(term) ||
      !!r.changes?.some((c) => c.toLowerCase().includes(term));
    const matchType =
      typeFilter === 'all' || (typeFilter === 'draft' && r.isPublished === false) || r.type?.toLowerCase() === typeFilter.toLowerCase();
    return matchSearch && matchType;
  });
}

export interface ReleaseStats {
  /** Tag da mais recente; `null` sem nenhuma versão (a tela mostra "—"). */
  latestTag: string | null;
  total: number;
  majors: number;
  patches: number;
}

export function releaseStats(releases: Array<Pick<ReleaseLike, 'tag' | 'type'>>): ReleaseStats {
  return {
    latestTag: releases[0]?.tag ?? null,
    total: releases.length,
    majors: releases.filter((r) => r.type === 'major').length,
    patches: releases.filter((r) => r.type === 'patch').length,
  };
}

/* ------------------------------------------------------------------ Sincronização Jira */

export const SQUAD_ROLES = [
  'Product Owner',
  'People Lead',
  'Agile Master',
  'Tech Lead',
  'Tribe Lead',
  'Agile Coach',
  'Developer',
  'QA',
  'UX/Designer',
  'SME',
  'Stakeholder / Observador',
] as const;

export interface JiraErrorInfo {
  title: string;
  hint?: string;
  /** Mensagem do servidor, quando ela acrescenta algo. */
  detail?: string;
}

/** Texto de erro da consulta ao Jira por causa, a partir do status HTTP (e só dele). */
export function jiraErrorInfo(status: number | null, serverMessage?: string | null, projectKey?: string): JiraErrorInfo {
  const detail = serverMessage && serverMessage.trim() && !/^(unauthorized|forbidden|not found|bad request)$/i.test(serverMessage.trim()) ? serverMessage.trim() : undefined;
  if (status == null) {
    return { title: 'Não foi possível falar com o servidor', hint: 'Confira a conexão e tente de novo.', detail };
  }
  if (status === 401) {
    return { title: 'O Jira recusou o token (erro 401)', hint: 'Gere um novo token pessoal no Jira e cole de novo.', detail };
  }
  if (status === 403) {
    return {
      title: 'O Jira negou o acesso (erro 403)',
      hint: projectKey ? `Confira se o seu usuário enxerga o projeto ${projectKey}.` : 'Confira se o seu usuário enxerga o projeto.',
      detail,
    };
  }
  if (status === 404) {
    return { title: 'Projeto ou endereço não encontrado (erro 404)', hint: 'Confira a chave do projeto e o domínio.', detail };
  }
  if (status >= 500) {
    return { title: `O Jira não respondeu (erro ${status})`, hint: 'Confira o domínio e tente de novo; se o Jira estiver fora do ar, aguarde.', detail };
  }
  return { title: `Não foi possível consultar o Jira (erro ${status})`, hint: 'Confira os dados e tente de novo.', detail };
}

/* ------------------------------------------------------------------ Crescimento */

export interface AdminStatsLike {
  totalUsers: number;
  totalShowcaseSessions?: number;
  totalFeedbacks: number;
  totalPokerRooms: number;
  totalRetroBoards: number;
  totalSprintPlannings: number;
  totalHealthCheckBoards: number;
  totalBrainstormingBoards: number;
  totalSessions: number;
  totalParticipations: number;
  avgSessionDurationMinutes: number | null;
  sessionDurationSampleSize: number;
}

export interface GrowthModule {
  key: string;
  label: string;
  module: ModuleKey;
  count: number;
}

export interface GrowthMetrics {
  users: number;
  feedbacks: number;
  sessions: number;
  participations: number;
  interactions: number;
  /** feedbacks ÷ usuários cadastrados, em %. */
  feedbackRate: number;
  /** interações ÷ usuários cadastrados. */
  perUser: number;
  /** Duração média (min); `null` quando ainda não há amostra. */
  avgDurationMinutes: number | null;
  durationSampleSize: number;
  modules: GrowthModule[];
  /** Nenhuma sessão em nenhum módulo. */
  noActivity: boolean;
}

const n = (v: number | null | undefined) => (typeof v === 'number' && Number.isFinite(v) ? v : 0);

export function computeGrowth(stats: AdminStatsLike): GrowthMetrics {
  const modules = ([
    { key: 'poker', label: 'Scrum Poker', module: 'poker', count: n(stats.totalPokerRooms) },
    { key: 'retro', label: 'Retrospectivas', module: 'retro', count: n(stats.totalRetroBoards) },
    { key: 'planner', label: 'Sprint Planner', module: 'sprint-planner', count: n(stats.totalSprintPlannings) },
    { key: 'brainstorming', label: 'Brainstorming', module: 'brainstorming', count: n(stats.totalBrainstormingBoards) },
    { key: 'health', label: 'Health Check', module: 'health', count: n(stats.totalHealthCheckBoards) },
    { key: 'showcase', label: 'Showcase', module: 'showcase', count: n(stats.totalShowcaseSessions) },
  ] as GrowthModule[]).sort((a, b) => b.count - a.count);
  const interactions = modules.reduce((acc, m) => acc + m.count, 0);
  const users = n(stats.totalUsers);
  const feedbacks = n(stats.totalFeedbacks);
  const hasDuration = n(stats.sessionDurationSampleSize) > 0 && stats.avgSessionDurationMinutes != null;
  return {
    users,
    feedbacks,
    sessions: n(stats.totalSessions),
    participations: n(stats.totalParticipations),
    interactions,
    feedbackRate: users > 0 ? (feedbacks / users) * 100 : 0,
    perUser: users > 0 ? interactions / users : 0,
    avgDurationMinutes: hasDuration ? (stats.avgSessionDurationMinutes as number) : null,
    durationSampleSize: hasDuration ? n(stats.sessionDurationSampleSize) : 0,
    modules,
    noActivity: interactions === 0,
  };
}

/** 1980 -> "1.980" (pt-BR). */
export function formatInt(value: number): string {
  return Math.round(value).toLocaleString('pt-BR');
}

/** 29.27 -> "29,3". */
export function formatDecimal(value: number, digits = 1): string {
  return value.toLocaleString('pt-BR', { minimumFractionDigits: digits, maximumFractionDigits: digits });
}

export function formatDuration(minutes: number): string {
  if (minutes < 60) return `${Math.round(minutes)} min`;
  const hours = Math.floor(minutes / 60);
  const rest = Math.round(minutes % 60);
  return rest > 0 ? `${hours}h${rest}` : `${hours}h`;
}

/** Largura da barra (0-100): proporcional ao maior; nunca NaN; mínimo de 3% quando há valor. */
export function barPercent(count: number, max: number): number {
  if (!(max > 0) || !(count > 0)) return 0;
  return Math.max(Math.round((count / max) * 100), 3);
}

/* ------------------------------------------------------------------ Cerimônias */

/** Say/Do: entregue ÷ comprometido, em %; `null` quando nada foi comprometido. */
export function computeSayDo(delivered: number, committed: number): number | null {
  if (!(committed > 0)) return null;
  return Math.round((delivered / committed) * 100);
}

export interface SprintStatsLike {
  velocityReal?: number | null;
  entregue?: number | null;
  previsto?: number | null;
  carryOvers?: number | null;
}

export function sprintNumbers(stats: SprintStatsLike) {
  const delivered = n(stats.velocityReal) || n(stats.entregue);
  const committed = n(stats.previsto);
  const carryOvers = n(stats.carryOvers);
  return { delivered, committed, carryOvers, sayDo: computeSayDo(delivered, committed) };
}

/** Sprint sem nada comprometido, entregue nem adiado: tratar como "sem dado". */
export function isEmptySprint(stats: SprintStatsLike | null | undefined): boolean {
  if (!stats) return true;
  const s = sprintNumbers(stats);
  return s.delivered === 0 && s.committed === 0 && s.carryOvers === 0;
}
