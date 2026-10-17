/**
 * Regras do Plano de ação (5W2H) que não dependem de tela: status, resumo, busca e filtros, links e IDs,
 * exportação (Markdown e CSV), texto do convite e linhas do lobby. Testadas em `lib/__tests__/action-plan.test.ts`.
 *
 * O servidor guarda o status cru em inglês (`todo`, `doing`, `done`, `blocked`); a tela e as exportações falam
 * português. O valor cru continua sendo o que vai e volta da API.
 */

import type { ActionPlanBoard, ActionPlanTask, ActionPlanTaskStatus } from '@/lib/types';

// ---------------------------------------------------------------------------------------------------------------
// Status
// ---------------------------------------------------------------------------------------------------------------

/** Ordem em que o clique no status avança (e volta ao primeiro depois do último). */
export const TASK_STATUSES: readonly ActionPlanTaskStatus[] = ['todo', 'doing', 'done', 'blocked'];

export const STATUS_LABEL: Record<ActionPlanTaskStatus, string> = {
  todo: 'A fazer',
  doing: 'Em andamento',
  done: 'Concluído',
  blocked: 'Impedido',
};

/** Status desconhecido (dado antigo, nulo ou em outra caixa) não derruba a tabela: vale "A fazer". */
export function normalizeStatus(value: unknown): ActionPlanTaskStatus {
  const key = typeof value === 'string' ? value.trim().toLowerCase() : '';
  return (TASK_STATUSES as readonly string[]).includes(key) ? (key as ActionPlanTaskStatus) : 'todo';
}

export function statusLabel(value: unknown): string {
  return STATUS_LABEL[normalizeStatus(value)];
}

/** Próximo status do ciclo A fazer, Em andamento, Concluído, Impedido (e volta). */
export function nextStatus(value: unknown): ActionPlanTaskStatus {
  const i = TASK_STATUSES.indexOf(normalizeStatus(value));
  return TASK_STATUSES[(i + 1) % TASK_STATUSES.length];
}

// ---------------------------------------------------------------------------------------------------------------
// Resumo
// ---------------------------------------------------------------------------------------------------------------

export interface TaskSummary {
  total: number;
  todo: number;
  doing: number;
  done: number;
  blocked: number;
  /** Concluídas sobre o total, em %, arredondado (0 quando não há ações). */
  donePct: number;
}

export function summarizeTasks(tasks: readonly Pick<ActionPlanTask, 'status'>[]): TaskSummary {
  const summary: TaskSummary = { total: tasks.length, todo: 0, doing: 0, done: 0, blocked: 0, donePct: 0 };
  for (const t of tasks) summary[normalizeStatus(t.status)] += 1;
  summary.donePct = summary.total === 0 ? 0 : Math.round((summary.done / summary.total) * 100);
  return summary;
}

// ---------------------------------------------------------------------------------------------------------------
// Busca e filtros (só na tela)
// ---------------------------------------------------------------------------------------------------------------

export const FILTER_ALL = 'all';
/** Valor do filtro de responsável para "Sem responsável". */
export const FILTER_UNASSIGNED = '__sem_responsavel__';

export interface TaskFilters {
  query: string;
  status: ActionPlanTaskStatus | typeof FILTER_ALL;
  who: string;
}

export const NO_FILTERS: TaskFilters = { query: '', status: FILTER_ALL, who: FILTER_ALL };

/** Minúsculas e sem acento: "acao" acha "Ação". */
export function foldText(value: unknown): string {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/\p{M}+/gu, '')
    .toLowerCase()
    .trim();
}

export function hasActiveFilters(f: TaskFilters): boolean {
  return f.query.trim() !== '' || f.status !== FILTER_ALL || f.who !== FILTER_ALL;
}

export function filterTasks<T extends ActionPlanTask>(tasks: readonly T[], f: TaskFilters): T[] {
  const q = foldText(f.query);
  return tasks.filter((t) => {
    if (f.status !== FILTER_ALL && normalizeStatus(t.status) !== f.status) return false;
    const who = (t.who ?? '').trim();
    if (f.who === FILTER_UNASSIGNED) {
      if (who) return false;
    } else if (f.who !== FILTER_ALL && foldText(who) !== foldText(f.who)) {
      return false;
    }
    if (!q) return true;
    return [t.what, t.why, t.how, t.where, t.when, t.who, t.howMuch].some((v) => foldText(v).includes(q));
  });
}

/** Responsáveis que aparecem nas ações (sem repetir, em ordem alfabética) e se há ação sem responsável. */
export function responsibleOptions(tasks: readonly Pick<ActionPlanTask, 'who'>[]): { names: string[]; hasUnassigned: boolean } {
  const byKey = new Map<string, string>();
  let hasUnassigned = false;
  for (const t of tasks) {
    const who = (t.who ?? '').trim();
    if (!who) hasUnassigned = true;
    else if (!byKey.has(foldText(who))) byKey.set(foldText(who), who);
  }
  return { names: [...byKey.values()].sort((a, b) => a.localeCompare(b, 'pt-BR')), hasUnassigned };
}

/** Número de cada ação pela posição no plano (não muda quando um filtro esconde linhas). */
export function numberTasks(tasks: readonly Pick<ActionPlanTask, 'id'>[]): Map<string, number> {
  return new Map(tasks.map((t, i) => [t.id, i + 1]));
}

// ---------------------------------------------------------------------------------------------------------------
// Formulário da ação
// ---------------------------------------------------------------------------------------------------------------

export interface TaskForm {
  what: string;
  why: string;
  where: string;
  when: string;
  who: string;
  how: string;
  howMuch: string;
  status: ActionPlanTaskStatus;
}

export const EMPTY_TASK_FORM: TaskForm = { what: '', why: '', where: '', when: '', who: '', how: '', howMuch: '', status: 'todo' };

export function taskToForm(task: ActionPlanTask | null | undefined): TaskForm {
  if (!task) return { ...EMPTY_TASK_FORM };
  return {
    what: task.what ?? '',
    why: task.why ?? '',
    where: task.where ?? '',
    when: task.when ?? '',
    who: task.who ?? '',
    how: task.how ?? '',
    howMuch: task.howMuch || '',
    status: normalizeStatus(task.status),
  };
}

export type TaskFormErrors = Partial<Record<'what' | 'who', string>>;

/** Na tela "O quê" e "Quem" são obrigatórios; o servidor só exige o "O quê". */
export function validateTaskForm(form: Pick<TaskForm, 'what' | 'who'>): TaskFormErrors {
  const errors: TaskFormErrors = {};
  if (!form.what.trim()) errors.what = 'Escreva o que será feito.';
  if (!form.who.trim()) errors.who = 'Diga quem responde por esta ação.';
  return errors;
}

// ---------------------------------------------------------------------------------------------------------------
// Datas e textos curtos
// ---------------------------------------------------------------------------------------------------------------

const pad = (n: number) => String(n).padStart(2, '0');

/** "16/10"; vazio quando a data não existe ou não é válida. */
export function formatShortDate(iso?: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '' : `${pad(d.getDate())}/${pad(d.getMonth() + 1)}`;
}

/** Texto que o calendário escreve no campo "Quando": "25/10/2026". */
export function dateToText(d: Date): string {
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
}

/** Valor de um `<input type="date">` ("2026-10-25") para o texto do campo; vazio se não for uma data. */
export function dateInputToText(value: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!m) return '';
  return `${m[3]}/${m[2]}/${m[1]}`;
}

/** "agora", "há 8 s", "há 3 min", "há 2 h" a partir de uma diferença em milissegundos. */
export function formatAgo(diffMs: number): string {
  const s = Math.max(0, Math.floor(diffMs / 1000));
  if (s < 5) return 'agora';
  if (s < 60) return `há ${s} s`;
  const min = Math.floor(s / 60);
  if (min < 60) return `há ${min} min`;
  return `há ${Math.floor(min / 60)} h`;
}

/** Hora local "14:02". */
export function formatClock(ms: number): string {
  const d = new Date(ms);
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

// ---------------------------------------------------------------------------------------------------------------
// Plano: visibilidade, link, convite
// ---------------------------------------------------------------------------------------------------------------

/** O servidor devolve `isPublic`; o tipo antigo do front falava em `settings.isPublic`. Sem nenhum dos dois, é público. */
export function boardIsPublic(board: Pick<ActionPlanBoard, 'isPublic' | 'settings'> | null | undefined): boolean {
  if (!board) return true;
  if (typeof board.isPublic === 'boolean') return board.isPublic;
  if (typeof board.settings?.isPublic === 'boolean') return board.settings.isPublic;
  return true;
}

export function visibilityLabel(isPublic: boolean): string {
  return isPublic ? 'Pública' : 'Só convidados';
}

const UUID_RE = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;

/**
 * "Entrar com o ID ou link": aceita o endereço inteiro (`https://.../action-plan/<id>?x`) ou só o ID.
 * O servidor lê o UUID sem diferenciar maiúsculas; aqui sai em minúsculas. Texto que não parece UUID segue como
 * foi digitado (o servidor responde "não encontrado").
 */
export function extractPlanId(input: string): { id: string; fromLink: boolean } {
  const text = input.trim();
  if (!text) return { id: '', fromLink: false };
  const uuid = UUID_RE.exec(text);
  if (uuid) return { id: uuid[0].toLowerCase(), fromLink: uuid[0].length !== text.length };
  const path = /\/action-plan\/([^/?#\s]+)/i.exec(text);
  if (path) return { id: decodeURIComponent(path[1]), fromLink: true };
  return { id: text.replace(/[?#].*$/, ''), fromLink: false };
}

export function planPath(id: string): string {
  return `/action-plan/${encodeURIComponent(id)}`;
}

export function planUrl(origin: string, id: string): string {
  return `${origin.replace(/\/$/, '')}${planPath(id)}`;
}

/** Convite em texto para colar no chat da squad. */
export function inviteText(opts: { title: string; squadName?: string; total: number; url: string }): string {
  const plan = opts.title.trim() || 'Plano de ação';
  const from = opts.squadName ? ` da squad ${opts.squadName}` : '';
  const count =
    opts.total === 0
      ? 'ainda sem ações'
      : `${opts.total} ${opts.total === 1 ? 'ação' : 'ações'} com responsável e prazo`;
  return `Plano de ação "${plan}"${from}: ${count}. Confira a sua e atualize o status. Link: ${opts.url}`;
}

// ---------------------------------------------------------------------------------------------------------------
// Exportação
// ---------------------------------------------------------------------------------------------------------------

/** Markdown do plano: uma seção por ação, com os sete campos e o status em português. */
export function planMarkdown(board: Pick<ActionPlanBoard, 'title'>, tasks: readonly ActionPlanTask[], date: string): string {
  let md = `# Plano de ação - ${board.title || 'Sem título'} (${date})\n\n`;
  tasks.forEach((task, index) => {
    md += `### ${index + 1}. ${task.what ?? ''}\n`;
    md += `- **Por que:** ${task.why ?? ''}\n`;
    md += `- **Como:** ${task.how ?? ''}\n`;
    if (task.howMuch) md += `- **Custo/Esforço:** ${task.howMuch}\n`;
    md += `- **Onde:** ${task.where ?? ''}\n`;
    md += `- **Quando:** ${task.when ?? ''}\n`;
    md += `- **Quem:** ${task.who ?? ''}\n`;
    md += `- **Status:** ${statusLabel(task.status)}\n\n`;
  });
  return md.trim();
}

export const CSV_HEADER = [
  'ID',
  'O Quê (What)',
  'Por Que (Why)',
  'Como (How)',
  'Custo/Esforço (How Much)',
  'Onde (Where)',
  'Quando (When)',
  'Quem (Who)',
  'Status',
] as const;

/**
 * Célula de CSV entre aspas. Texto que começa com `=`, `+`, `@` (ou tabulação/retorno) vira fórmula na planilha;
 * leva um apóstrofo na frente para abrir como texto.
 */
export function csvCell(value: unknown): string {
  let text = String(value ?? '');
  if (/^[=+@\t\r]/.test(text)) text = `'${text}`;
  return `"${text.replace(/"/g, '""')}"`;
}

/** CSV do plano, com os sete campos e o status em português (o valor cru `todo` não sai mais). */
export function planCsv(tasks: readonly ActionPlanTask[]): string {
  const rows: string[][] = [CSV_HEADER.map(csvCell)];
  tasks.forEach((t, i) => {
    rows.push(
      [String(i + 1), t.what, t.why, t.how, t.howMuch || '', t.where, t.when, t.who, statusLabel(t.status)].map(csvCell),
    );
  });
  return rows.map((r) => r.join(',')).join('\n');
}

export function planCsvFileName(title: string): string {
  const base = (title || 'plano').trim().replace(/\s+/g, '_').replace(/[\\/:*?"<>|]/g, '');
  return `Plano_Acao_${base || 'plano'}.csv`;
}

// ---------------------------------------------------------------------------------------------------------------
// Lobby: linhas da lista de planos
// ---------------------------------------------------------------------------------------------------------------

export interface PlanLobbyRow {
  id: string;
  title: string;
  createdAt: string;
  /** `null` quando só se sabe pelo histórico deste navegador (o servidor não devolveu o plano). */
  isPublic: boolean | null;
  /** Veio só do histórico local deste navegador. */
  local: boolean;
}

const time = (iso: string) => {
  const t = new Date(iso).getTime();
  return Number.isNaN(t) ? 0 : t;
};

export interface LocalPlanMeta {
  roomId: string;
  title: string;
  createdAt: string;
}

/**
 * Planos da squad (servidor) e os abertos neste navegador, sem repetir, do mais novo para o mais antigo.
 * O histórico local entra como atalho: planos antigos sem squad não aparecem na lista do servidor.
 */
export function mergePlanRows(server: readonly ActionPlanBoard[], local: readonly LocalPlanMeta[], localLimit = 5): PlanLobbyRow[] {
  const rows: PlanLobbyRow[] = server.map((b) => ({
    id: b.id,
    title: b.title,
    createdAt: b.createdAt,
    isPublic: boardIsPublic(b),
    local: false,
  }));
  const seen = new Set(rows.map((r) => r.id.toLowerCase()));
  const extra = [...local]
    .sort((a, b) => time(b.createdAt) - time(a.createdAt))
    .filter((m) => !seen.has(m.roomId.toLowerCase()))
    .slice(0, localLimit)
    .map<PlanLobbyRow>((m) => ({ id: m.roomId, title: m.title, createdAt: m.createdAt, isPublic: null, local: true }));
  return [...rows, ...extra].sort((a, b) => time(b.createdAt) - time(a.createdAt));
}

export function filterPlanRows(rows: readonly PlanLobbyRow[], query: string): PlanLobbyRow[] {
  const q = foldText(query);
  return q ? rows.filter((r) => foldText(r.title).includes(q)) : [...rows];
}

// ---------------------------------------------------------------------------------------------------------------
// Pessoas da squad (campo "Quem" e convites)
// ---------------------------------------------------------------------------------------------------------------

export interface PlanPerson {
  /** Nome que vai para o campo "Quem" (o servidor procura a conta pelo nome, e-mail ou usuário). */
  name: string;
  email?: string;
  /** ID da conta no portal, quando a pessoa já assumiu o cadastro da squad: é o que o convite precisa. */
  userId?: string;
}

interface MemberLike {
  displayName?: string;
  email?: string;
  claimedByUid?: string;
}

export function toPlanPeople(members: readonly MemberLike[] | null | undefined): PlanPerson[] {
  const seen = new Set<string>();
  const people: PlanPerson[] = [];
  for (const m of members ?? []) {
    const name = (m.displayName ?? '').trim() || (m.email ?? '').trim();
    if (!name) continue;
    const key = (m.claimedByUid || m.email || name).toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    people.push({ name, email: m.email || undefined, userId: m.claimedByUid || undefined });
  }
  return people.sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
}

/** Sugestões para o campo "Quem": quem tem o texto digitado no nome ou no e-mail (todos, se estiver vazio). */
export function suggestPeople(people: readonly PlanPerson[], typed: string, limit = 8): PlanPerson[] {
  const q = foldText(typed);
  const list = q ? people.filter((p) => foldText(p.name).includes(q) || foldText(p.email).includes(q)) : [...people];
  return list.slice(0, limit);
}

/** O texto digitado é exatamente o nome de alguém da squad? */
export function findPersonByName(people: readonly PlanPerson[], typed: string): PlanPerson | undefined {
  const q = foldText(typed);
  return q ? people.find((p) => foldText(p.name) === q) : undefined;
}
