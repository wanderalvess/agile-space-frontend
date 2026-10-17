/**
 * Regras puras da Review (hub e sala): fases, status, filtros e chips, prontidão, números do hub,
 * histórico, entrada por ID/link, permissão do PO/SME e predefinições de JQL. Ficam fora dos
 * componentes para serem testadas sem DOM e para o hub e a sala contarem do mesmo jeito.
 */
import type { PhaseStep } from '@/components/room-kit';
import type { GlobalRole } from '@/lib/types';
import type { MyMemberships } from '@/lib/memberships-api';
import { findMembership, hasMemberships } from '@/lib/memberships';
import type { ShowcaseSession, ShowcaseTask } from './types';
import { compareText, isTaskContentComplete, formatTime } from './utils';

// ───────────────────────── Status e fases ─────────────────────────

/** Estados que o servidor entende: `planning`, `active` (Ao vivo) e `finished`. */
export type ReviewStatus = 'planning' | 'active' | 'finished';

/** Mesma janela do servidor (SessionStatusResolver): `active` sem atividade há mais de 12 h é abandono. */
export const REVIEW_STALE_MS = 12 * 60 * 60 * 1000;

/**
 * Status gravado → status conhecido. Valor desconhecido (ou o antigo "presenting", que nada gravava)
 * cai em `planning`, igual ao servidor. `active` abandonado (sem atividade há mais de 12 h) volta a
 * `planning`: a Review continua aberta para apresentar de novo, mas não finge estar ao vivo.
 */
export function normalizeReviewStatus(raw?: string | null, updatedAt?: string | null, now: number = Date.now()): ReviewStatus {
  const value = (raw ?? '').trim().toLowerCase();
  if (value === 'finished') return 'finished';
  if (value === 'active') {
    const t = updatedAt ? Date.parse(updatedAt) : NaN;
    if (Number.isFinite(t) && now - t > REVIEW_STALE_MS) return 'planning';
    return 'active';
  }
  return 'planning';
}

export function reviewStatusLabel(status: ReviewStatus): string {
  return status === 'active' ? 'Ao vivo' : status === 'finished' ? 'Finalizada' : 'Em preparação';
}

/** Estado do selo do cabeçalho da sala (kit): Ao vivo, Em preparação (waiting) ou Encerrada (done). */
export function topBarStatus(status: ReviewStatus): 'live' | 'waiting' | 'done' {
  return status === 'active' ? 'live' : status === 'finished' ? 'done' : 'waiting';
}

/** Texto do selo na sala. "Em preparação" no lugar do "Aguardando" padrão do kit. */
export function topBarStatusLabel(status: ReviewStatus): string {
  return status === 'active' ? 'Ao vivo' : status === 'finished' ? 'Encerrada' : 'Em preparação';
}

export type ReviewPhase = 'prepare' | 'present' | 'summary';

export const REVIEW_PHASES: readonly PhaseStep[] = [
  { id: 'prepare', label: 'Preparar' },
  { id: 'present', label: 'Apresentar' },
  { id: 'summary', label: 'Resumo' },
];

/** Fase em destaque: Resumo depois de finalizada; Apresentar enquanto ao vivo ou com o Teatro aberto; senão Preparar. */
export function reviewPhase(status: ReviewStatus, presenting: boolean): ReviewPhase {
  if (presenting) return 'present';
  if (status === 'finished') return 'summary';
  if (status === 'active') return 'present';
  return 'prepare';
}

// ───────────────────────── Permissão do PO/SME ─────────────────────────

/**
 * Cargo global do perfil (o mesmo que o Squad Pulse usa) que o cliente aceitava antes dos vínculos. Inclui a variante em
 * português dos perfis antigos. Hoje só vale como último recurso, quando o servidor não informa os vínculos da pessoa.
 */
export const CAN_DECIDE_ROLES: readonly GlobalRole[] = ['Product Owner', 'Product Owner (PO)', 'SME'];

/** Papéis do VÍNCULO que registram decisão: mesma lista do servidor (`ShowcaseAccessPolicy`). */
const DECIDER_ROLE_KEYS = ['PRODUCT_OWNER', 'SME'];
const DECIDER_ROLE_NAMES = ['product owner', 'product owner (po)', 'sme'];

export interface DecideContext {
  /** Cargo global do perfil: vale só quando não há dados de vínculos (backend antigo). */
  role?: string | null;
  /** Administrador do sistema. */
  isAdmin?: boolean;
  /** Vínculos da pessoa (`/api/me/memberships`); `null`/vazio = o servidor não informa. */
  memberships?: MyMemberships | null;
  /** Squad da Review (a chave guardada em `squadName`). Vazia = Review sem squad. */
  squadId?: string | null;
  /** A pessoa criou a Review. */
  isCreator?: boolean;
}

const isDeciderRole = (roleKey?: string | null, roleName?: string | null) =>
  DECIDER_ROLE_KEYS.includes((roleKey ?? '').trim().toUpperCase()) || DECIDER_ROLE_NAMES.includes((roleName ?? '').trim().toLowerCase());

/**
 * Quem registra aceite, ajuste ou rejeição (veredito e feedback). Mesma regra do servidor, que recusa o resto com 403:
 * administrador; liderança da squad da Review por vínculo (qualquer papel com poder de liderança); ou vínculo na squad
 * com o papel PO ou SME. Review sem squad: só administrador e criador.
 *
 * Sem dados de vínculos (backend antigo ou conta só com rastro legado) o comportamento é o de antes: cargo global do
 * perfil (PO ou SME), mais o administrador. Texto, número ou `null` chamam essa regra antiga, como `canDecide(role)`.
 */
export function canDecide(input?: string | null | DecideContext): boolean {
  const ctx: DecideContext = typeof input === 'object' && input !== null ? input : { role: input };
  if (ctx.isAdmin) return true;
  if (!hasMemberships(ctx.memberships)) return !!ctx.role && (CAN_DECIDE_ROLES as readonly string[]).includes(ctx.role);
  const squad = (ctx.squadId ?? '').trim();
  if (!squad) return !!ctx.isCreator;
  const membership = findMembership(ctx.memberships, squad);
  if (!membership) return false;
  if (membership.leadership || membership.roles.some((r) => r.leadership)) return true;
  return isDeciderRole(membership.roleKey, membership.roleName) || membership.roles.some((r) => isDeciderRole(r.roleKey, r.roleName));
}

/** Por que o veredito está travado, para o aviso ao lado dos botões. */
export const DECISION_LOCK_HINT = 'Só o PO, o SME, a liderança da squad ou um administrador registra decisão.';

// ───────────────────────── Ordem, busca e filtros ─────────────────────────

export type ReviewSort = 'key' | 'type' | 'dev' | 'qa';
export const ALL = 'all';

export const SORT_LABELS: Record<ReviewSort, string> = {
  key: 'Chave do Jira',
  type: 'Tipo de issue',
  dev: 'Desenvolvedor',
  qa: 'Validador / QA',
};

export function isReviewSort(value: unknown): value is ReviewSort {
  return value === 'key' || value === 'type' || value === 'dev' || value === 'qa';
}

export interface ReviewFilters {
  search: string;
  dev: string;
  qa: string;
  type: string;
}

export const EMPTY_FILTERS: ReviewFilters = { search: '', dev: ALL, qa: ALL, type: ALL };

/** Ordem da lista e da apresentação; chave em ordem natural (PTV-2 antes de PTV-10) e desempate pela chave. */
export function sortTasks(tasks: readonly ShowcaseTask[], sortBy: ReviewSort): ShowcaseTask[] {
  const byKey = (a: ShowcaseTask, b: ShowcaseTask) => compareText(a.key, b.key);
  return [...tasks].sort((a, b) => {
    if (sortBy === 'type') return compareText(a.type, b.type) || byKey(a, b);
    if (sortBy === 'dev') return compareText(a.evidence.dev, b.evidence.dev) || byKey(a, b);
    if (sortBy === 'qa') return compareText(a.evidence.qa, b.evidence.qa) || byKey(a, b);
    return byKey(a, b);
  });
}

/** Busca por chave, título, dev ou QA, mais os filtros de dev, QA e tipo. Filtro `all` não filtra. */
export function filterTasks(tasks: readonly ShowcaseTask[], f: ReviewFilters): ShowcaseTask[] {
  let result = [...tasks];
  const q = f.search.trim().toLowerCase();
  if (q) {
    result = result.filter(
      (t) =>
        (t.key || '').toLowerCase().includes(q) ||
        (t.title || '').toLowerCase().includes(q) ||
        (t.evidence.dev || '').toLowerCase().includes(q) ||
        (t.evidence.qa || '').toLowerCase().includes(q)
    );
  }
  if (f.dev !== ALL) result = result.filter((t) => t.evidence.dev === f.dev);
  if (f.qa !== ALL) result = result.filter((t) => t.evidence.qa === f.qa);
  if (f.type !== ALL) result = result.filter((t) => t.type === f.type);
  return result;
}

/** Listas dos filtros, tiradas dos próprios cards (sem repetir, em ordem alfabética). */
export function filterOptions(tasks: readonly ShowcaseTask[]): { devs: string[]; qas: string[]; types: string[] } {
  const uniq = (values: (string | undefined)[]) => Array.from(new Set(values.filter((v): v is string => !!v))).sort((a, b) => compareText(a, b));
  return {
    devs: uniq(tasks.map((t) => t.evidence.dev)),
    qas: uniq(tasks.map((t) => t.evidence.qa)),
    types: uniq(tasks.map((t) => t.type)),
  };
}

export interface FilterChip {
  id: 'search' | 'dev' | 'qa' | 'type' | 'sort';
  label: string;
}

/**
 * Um chip por filtro ativo: busca, dev, QA, tipo e a ordem (só quando difere da ordem da Review).
 * O defeito antigo mostrava só busca, dev e tipo, chamava a ordem por QA de "Tipo" e o "limpar" deixava QA e ordem.
 */
export function activeFilterChips(f: ReviewFilters, sortBy: ReviewSort, baseSort: ReviewSort = 'key'): FilterChip[] {
  const chips: FilterChip[] = [];
  if (f.search.trim()) chips.push({ id: 'search', label: `Busca: ${f.search.trim()}` });
  if (f.dev !== ALL) chips.push({ id: 'dev', label: `Dev: ${f.dev}` });
  if (f.qa !== ALL) chips.push({ id: 'qa', label: `QA: ${f.qa}` });
  if (f.type !== ALL) chips.push({ id: 'type', label: `Tipo: ${f.type}` });
  if (sortBy !== baseSort) chips.push({ id: 'sort', label: `Ordem: ${SORT_LABELS[sortBy]}` });
  return chips;
}

/** Remove o filtro de um chip. A ordem volta para a ordem da Review. */
export function clearFilterChip(f: ReviewFilters, sortBy: ReviewSort, chip: FilterChip['id'], baseSort: ReviewSort = 'key'): { filters: ReviewFilters; sortBy: ReviewSort } {
  switch (chip) {
    case 'search': return { filters: { ...f, search: '' }, sortBy };
    case 'dev': return { filters: { ...f, dev: ALL }, sortBy };
    case 'qa': return { filters: { ...f, qa: ALL }, sortBy };
    case 'type': return { filters: { ...f, type: ALL }, sortBy };
    case 'sort': return { filters: f, sortBy: baseSort };
  }
}

/** "Limpar tudo": busca, dev, QA, tipo e ordem de volta ao estado inicial da Review. */
export function clearAllFilters(baseSort: ReviewSort = 'key'): { filters: ReviewFilters; sortBy: ReviewSort } {
  return { filters: { ...EMPTY_FILTERS }, sortBy: baseSort };
}

// ───────────────────────── Prontidão e esforço ─────────────────────────

export interface ReadinessRow {
  task: ShowcaseTask;
  /** Conteúdo completo: problema, solução e alguma evidência (ou métrica preenchida). */
  contentComplete: boolean;
  /** O status manual ("Pronta") discorda do conteúdo real. */
  mismatch: boolean;
}

export interface Readiness {
  rows: ReadinessRow[];
  readyCount: number;
  mismatchCount: number;
  total: number;
  /** 0 a 100. */
  percent: number;
}

/** Prontidão real (conteúdo preenchido) contra o status manual de cada card; mesma conta do contorno verde do card. */
export function readinessOf(tasks: readonly ShowcaseTask[]): Readiness {
  const rows = tasks.map((task) => {
    const contentComplete = isTaskContentComplete(task);
    return { task, contentComplete, mismatch: (task.preparationStatus === 'done') !== contentComplete };
  });
  const readyCount = rows.filter((r) => r.contentComplete).length;
  return {
    rows,
    readyCount,
    mismatchCount: rows.filter((r) => r.mismatch).length,
    total: rows.length,
    percent: rows.length ? Math.round((readyCount / rows.length) * 100) : 0,
  };
}

/** Horas gastas e estimadas somadas (segundos), já formatadas. */
export function effortTotals(tasks: readonly ShowcaseTask[]) {
  const spent = tasks.reduce((acc, t) => acc + (t.evidence.timeSpent || 0), 0);
  const estimate = tasks.reduce((acc, t) => acc + (t.evidence.timeEstimate || 0), 0);
  return { spent, estimate, spentLabel: formatTime(spent) || '0h', estimateLabel: formatTime(estimate) || '0h' };
}

/** Cards sem decisão do PO. */
export function openDecisionCount(tasks: readonly ShowcaseTask[]): number {
  return tasks.filter((t) => !t.decision || t.decision === 'open').length;
}

// ───────────────────────── Números do hub ─────────────────────────

export interface DecisionCounts {
  total: number;
  approved: number;
  adjustment: number;
  rejected: number;
  pending: number;
  /** Aprovadas + ajuste + rejeitadas. */
  evaluated: number;
}

export function decisionCounts(tasks: readonly ShowcaseTask[]): DecisionCounts {
  let approved = 0;
  let adjustment = 0;
  let rejected = 0;
  let pending = 0;
  for (const t of tasks) {
    if (t.decision === 'approved') approved++;
    else if (t.decision === 'needs_adjustment') adjustment++;
    else if (t.decision === 'rejected') rejected++;
    else pending++;
  }
  return { total: tasks.length, approved, adjustment, rejected, pending, evaluated: approved + adjustment + rejected };
}

export interface HubTotals extends DecisionCounts {
  /** Quantas Reviews entraram na conta. */
  sessions: number;
  /** Cards com a preparação "Pronta". */
  ready: number;
  /** Aprovadas ÷ avaliadas (0 a 100); card sem decisão não puxa a taxa para baixo. */
  acceptanceRate: number;
  /** Cards prontos ÷ cards (0 a 100). */
  readyRate: number;
}

/** Números do cartão "Métricas de aceite": todas as Reviews carregadas. */
export function hubTotals(sessions: readonly ShowcaseSession[]): HubTotals {
  const all = sessions.flatMap((s) => s.tasks || []);
  const counts = decisionCounts(all);
  const ready = all.filter((t) => t.preparationStatus === 'done').length;
  return {
    ...counts,
    sessions: sessions.length,
    ready,
    acceptanceRate: counts.evaluated > 0 ? Math.round((counts.approved / counts.evaluated) * 100) : 0,
    readyRate: counts.total > 0 ? Math.round((ready / counts.total) * 100) : 0,
  };
}

/** "44 cards, 30 avaliados pelo PO." (o antigo "Total de N tarefas avaliadas" contava todas). */
export function hubTotalsText(t: Pick<HubTotals, 'total' | 'evaluated'>): string {
  const cards = `${t.total} ${t.total === 1 ? 'card' : 'cards'}`;
  const evaluated = `${t.evaluated} ${t.evaluated === 1 ? 'avaliado' : 'avaliados'}`;
  return `${cards}, ${evaluated} pelo PO.`;
}

/** Taxa de aprovação de uma Review (aprovadas ÷ cards), para a linha do histórico; `null` sem cards. */
export function sessionApprovalRate(tasks: readonly ShowcaseTask[]): number | null {
  if (tasks.length === 0) return null;
  return Math.round((tasks.filter((t) => t.decision === 'approved').length / tasks.length) * 100);
}

/** Legenda da Review: a sprint (o campo é da sprint), nunca "Sem squad atribuído". */
export function sprintCaption(session: Pick<ShowcaseSession, 'sprintName'>): string {
  return session.sprintName?.trim() || 'Sem sprint informada';
}

// ───────────────────────── Histórico do hub ─────────────────────────

export type HistoryStatusFilter = 'all' | 'planning' | 'finished';

export const HISTORY_FILTERS: readonly { id: HistoryStatusFilter; label: string }[] = [
  { id: 'all', label: 'Todas' },
  { id: 'planning', label: 'Em preparação' },
  { id: 'finished', label: 'Finalizadas' },
];

/**
 * Busca por nome ou sprint e filtro por status. "Em preparação" inclui as que estão ao vivo (ainda não
 * foram finalizadas); "Finalizadas" só as finalizadas.
 */
export function filterHistory(sessions: readonly ShowcaseSession[], filter: HistoryStatusFilter, query: string, now: number = Date.now()): ShowcaseSession[] {
  const q = query.trim().toLowerCase();
  return sessions.filter((s) => {
    const status = normalizeReviewStatus(s.status, s.updatedAt, now);
    if (filter === 'finished' && status !== 'finished') return false;
    if (filter === 'planning' && status === 'finished') return false;
    if (!q) return true;
    return (s.name || '').toLowerCase().includes(q) || (s.sprintName || '').toLowerCase().includes(q);
  });
}

/** Rótulo do botão da linha: Retomar (em preparação), Entrar (ao vivo) ou Ver resumo (finalizada). */
export function sessionActionLabel(status: ReviewStatus): string {
  return status === 'finished' ? 'Ver resumo' : status === 'active' ? 'Entrar' : 'Retomar';
}

/** Endereço da sala; a Review finalizada abre direto no resumo. */
export function sessionHref(id: string, status: ReviewStatus): string {
  return status === 'finished' ? `/showcase/${id}?resumo=1` : `/showcase/${id}`;
}

// ───────────────────────── Entrar por ID ou link ─────────────────────────

export interface JoinTarget {
  id: string;
  /** O texto era um link colado (o ID foi reconhecido nele). */
  fromLink: boolean;
}

/** Aceita o ID puro ou o link inteiro colado; o ID diferencia maiúsculas de minúsculas. `null` se vazio. */
export function parseJoinInput(raw: string): JoinTarget | null {
  const typed = raw.trim();
  if (!typed) return null;
  const fromLink = typed.match(/showcase\/([^/?#\s]+)/i);
  const id = (fromLink ? fromLink[1] : typed).trim();
  return id ? { id, fromLink: !!fromLink } : null;
}

// ───────────────────────── Checklist do hub ─────────────────────────

export const HUB_CHECKLIST: readonly string[] = [
  'Importar as tarefas do Jira (XML ou API)',
  'Configurar vídeos e imagens de evidência',
  'Enviar o link da sala para o PO e os stakeholders',
  'Marcar aceites ao vivo durante a apresentação',
];

/** Lista de 4 marcas vinda do servidor (qualquer tamanho) para sempre ter uma posição por passo. */
export function normalizeChecklist(saved?: readonly boolean[] | null, length: number = HUB_CHECKLIST.length): boolean[] {
  return Array.from({ length }, (_, i) => !!saved?.[i]);
}

// ───────────────────────── Consultas JQL ─────────────────────────

export interface JqlPreset {
  id: string;
  label: string;
  jql: string;
}

export interface JqlPresetContext {
  /** Chave da squad (projeto Jira), para o refinamento da própria squad. */
  squadKey?: string;
  /** Sprint ativa da squad (id do Jira). Sem ela, vale "as sprints abertas". */
  sprintId?: string;
}

const REVIEW_ISSUE_FILTER =
  'status = Concluído AND (issuetype in (Legislação, História, Story, Participativo, Spike) OR (issuetype = Manutenção AND priority = Crítica))';

/**
 * Predefinições do Importar do Jira. A "Review da sprint atual" usa a sprint ativa da squad: nada de
 * número de sprint fixo no código nem texto para trocar à mão (antes eram "Review DDPDV" com a 52188 e
 * "Review Geral" com NumeroDaSprint).
 */
export function jqlPresets(ctx: JqlPresetContext = {}): JqlPreset[] {
  const sprintClause = ctx.sprintId?.trim() ? `sprint = ${ctx.sprintId.trim()}` : 'sprint in openSprints()';
  const squad = ctx.squadKey?.trim();
  const presets: JqlPreset[] = [
    { id: 'review-sprint', label: 'Review da sprint atual', jql: `${sprintClause} AND ${REVIEW_ISSUE_FILTER}` },
    { id: 'mine', label: 'Minhas issues', jql: 'assignee = currentUser() AND status != Done' },
    { id: 'sprint', label: 'Sprint atual', jql: 'sprint in openSprints()' },
    { id: 'backlog', label: 'Backlog', jql: 'status = "To Do" ORDER BY rank DESC' },
  ];
  if (squad) {
    presets.push({
      id: 'refinement',
      label: 'Refinamento da squad',
      jql: `project = "${squad}" and issuetype != Gestão and issueFunction in linkedIssuesOf("issuetype = Gestão AND summary ~ Refinamento and resolution = unresolved and project= '${squad}'")`,
    });
  }
  presets.push(
    { id: 'done-week', label: 'Concluídas na semana', jql: 'assignee = currentUser() AND resolutiondate >= -1w AND status = Done' },
    { id: 'blocked', label: 'Bloqueadas', jql: 'assignee = currentUser() AND status = Blocked' }
  );
  return presets;
}

/** Texto honesto da visibilidade da consulta: nenhuma é compartilhada de verdade, ficam no navegador. */
export const JQL_VISIBILITY_HELP = {
  private: 'Só você vê, neste navegador.',
  public: 'Aparece para quem usa este navegador. Não é compartilhada com a squad.',
} as const;

// ───────────────────────── Convite e compartilhar ─────────────────────────

/** Convite em texto: nome da Review, squad, número de cards e o link. */
export function buildInviteText(opts: { name: string; squadName?: string; cardCount: number; url: string; greeting?: string }): string {
  const lines: string[] = [];
  const greeting = opts.greeting?.trim();
  if (greeting) lines.push(greeting, '');
  const squad = opts.squadName?.trim();
  lines.push(`${opts.name.trim() || 'Review'}${squad ? `, squad ${squad}` : ''}.`);
  if (opts.cardCount > 0) lines.push(`Pauta: ${opts.cardCount} ${opts.cardCount === 1 ? 'card' : 'cards'}. Preparem as evidências dos seus cards antes da apresentação.`);
  else lines.push('Preparem as evidências dos seus cards antes da apresentação.');
  lines.push(`Link: ${opts.url}`);
  return lines.join('\n');
}

/** Endereço da Review sem parâmetros (?setup=1, ?resumo=1) para copiar e compartilhar. */
export function cleanRoomUrl(href: string): string {
  try {
    const u = new URL(href);
    return `${u.origin}${u.pathname}`;
  } catch {
    return href.split(/[?#]/)[0];
  }
}

// ───────────────────────── Squads ─────────────────────────

export interface SquadOption {
  /** Chave da squad: é o que a lista de Reviews usa para achar a Review. */
  value: string;
  label: string;
}

/**
 * Squads que a pessoa pode escolher para a Review: as do vínculo (as mesmas do cabeçalho), em ordem alfabética.
 * Sem vínculos devolve só a squad ativa; `current` (a squad que a Review já tem) entra se não estiver na lista,
 * para abrir as configurações de uma Review antiga sem trocar a squad dela sem querer.
 */
export function squadOptions(
  memberships: readonly { projectId: string; projectName?: string }[] | null | undefined,
  active: { squadId?: string; squadName?: string },
  current?: string
): SquadOption[] {
  const byKey = new Map<string, SquadOption>();
  const add = (value?: string, label?: string) => {
    const v = (value ?? '').trim();
    if (!v) return;
    const key = v.toLowerCase();
    if (!byKey.has(key)) byKey.set(key, { value: v, label: (label ?? '').trim() || v });
  };
  for (const m of memberships ?? []) add(m.projectId, m.projectName);
  if (!memberships || memberships.length === 0) add(active.squadId, active.squadName);
  add(current);
  return Array.from(byKey.values()).sort((a, b) => compareText(a.label, b.label));
}

/** Nome para mostrar de uma squad guardada na Review (a chave), usando o vínculo quando houver. */
export function squadLabel(value: string | undefined, options: readonly SquadOption[]): string {
  const v = (value ?? '').trim();
  if (!v) return '';
  return options.find((o) => o.value.toLowerCase() === v.toLowerCase())?.label ?? v;
}

// ───────────────────────── Capas e fundos ─────────────────────────

/** Imagem de capa/fundo é um arquivo do próprio app (nada de terceiros). */
export function isLocalImage(url?: string | null): boolean {
  return !!url && url.startsWith('/') && !url.startsWith('//');
}

// ───────────────────────── Selo "Apresentando" etc. ─────────────────────────

/** Status gravado ao apresentar. O servidor trata `active` como "Ao vivo". */
export const PRESENTING_STATUS: ReviewStatus = 'active';
export const FINISHED_STATUS: ReviewStatus = 'finished';
export const REOPENED_STATUS: ReviewStatus = 'planning';
