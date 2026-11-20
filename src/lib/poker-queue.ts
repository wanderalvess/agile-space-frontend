/**
 * Regras puras da fila de tarefas do Scrum Poker: estado de cada tarefa,
 * contagens, filtro/ordem, leitura do lote (texto ou CSV) e conversão de
 * issues do Jira em itens da fila. Sem React — testável isoladamente.
 */
import type { Issue } from '@/lib/types';
import { isValidJiraKey } from '@/lib/utils';
import { mapJiraTypeToIssueType } from '@/lib/poker-utils';

/** Estado de uma tarefa na fila, do ponto de vista de quem olha a lista. */
export type QueueStatus = 'voting' | 'pending' | 'parked' | 'estimated' | 'skipped' | 'cancelled';

export function queueStatus(issue: Issue, activeIssueId: string | null): QueueStatus {
  if (issue.status === 'completed') {
    if (issue.cancelled) return 'cancelled';
    if (issue.skipped) return 'skipped';
    return 'estimated';
  }
  if (issue.id === activeIssueId) return 'voting';
  if (issue.parked) return 'parked';
  return 'pending';
}

/** Filtro por situação da fila: tudo, o que falta, o que já tem estimativa, o que ficou de fora. */
export type QueueFilter = 'all' | 'pending' | 'estimated' | 'out';

export function matchesQueueFilter(status: QueueStatus, filter: QueueFilter): boolean {
  switch (filter) {
    case 'pending':
      return status === 'voting' || status === 'pending' || status === 'parked';
    case 'estimated':
      return status === 'estimated';
    case 'out':
      return status === 'skipped' || status === 'cancelled';
    default:
      return true;
  }
}

export interface QueueStats {
  total: number;
  /** Na mesa agora ou esperando a vez (inclui adiadas). */
  pending: number;
  estimated: number;
  /** Puladas + canceladas: fora da estimativa desta sessão. */
  out: number;
  skipped: number;
  cancelled: number;
  parked: number;
  voting: number;
  /** 0–100: estimadas sobre o que ainda conta (tudo menos puladas e canceladas). */
  progress: number;
}

export function queueStats(issues: Issue[], activeIssueId: string | null): QueueStats {
  const stats: QueueStats = { total: issues.length, pending: 0, estimated: 0, out: 0, skipped: 0, cancelled: 0, parked: 0, voting: 0, progress: 0 };
  for (const issue of issues) {
    const status = queueStatus(issue, activeIssueId);
    if (status === 'estimated') stats.estimated += 1;
    else if (status === 'skipped') { stats.skipped += 1; stats.out += 1; }
    else if (status === 'cancelled') { stats.cancelled += 1; stats.out += 1; }
    else {
      stats.pending += 1;
      if (status === 'voting') stats.voting += 1;
      if (status === 'parked') stats.parked += 1;
    }
  }
  const counted = stats.estimated + stats.pending;
  stats.progress = counted > 0 ? Math.round((stats.estimated / counted) * 100) : 0;
  return stats;
}

export type QueueSort = 'none' | 'num-asc' | 'num-desc';

/** Próxima ordenação ao clicar no botão: nenhuma, menor→maior, maior→menor, nenhuma. */
export function nextQueueSort(sort: QueueSort): QueueSort {
  return sort === 'none' ? 'num-asc' : sort === 'num-asc' ? 'num-desc' : 'none';
}

/** Número da tarefa (parte numérica da chave ou do título); null se não houver. */
export function taskNumber(issue: Pick<Issue, 'key' | 'title'>): number | null {
  const fromKey = issue.key?.match(/\d+/);
  if (fromKey) return parseInt(fromKey[0], 10);
  const fromTitle = issue.title.match(/\d+/);
  if (fromTitle) return parseInt(fromTitle[0], 10);
  return null;
}

export function filterQueue(
  issues: Issue[],
  opts: { query: string; filter: QueueFilter; sort: QueueSort },
  activeIssueId: string | null
): Issue[] {
  const q = opts.query.trim().toLowerCase();
  let result = issues.filter((issue) => {
    if (!matchesQueueFilter(queueStatus(issue, activeIssueId), opts.filter)) return false;
    if (!q) return true;
    return issue.title.toLowerCase().includes(q) || !!(issue.key && issue.key.toLowerCase().includes(q));
  });
  if (opts.sort !== 'none') {
    result = [...result].sort((a, b) => {
      const na = taskNumber(a);
      const nb = taskNumber(b);
      if (na === null && nb === null) return 0;
      if (na === null) return 1;
      if (nb === null) return -1;
      return opts.sort === 'num-asc' ? na - nb : nb - na;
    });
  }
  return result;
}

/** Tarefa que já está na fila com a mesma chave (ou o mesmo título, sem chave). */
export function findQueueDuplicate(issues: Issue[], title: string): Issue | undefined {
  const raw = title.trim();
  if (!raw) return undefined;
  if (isValidJiraKey(raw)) {
    const key = raw.toUpperCase();
    return issues.find((i) => (i.key || '').toUpperCase() === key);
  }
  const lower = raw.toLowerCase();
  return issues.find((i) => i.title.trim().toLowerCase() === lower);
}

// --- Importação em lote ---

export interface BulkRow {
  key: string;
  title: string;
  link: string;
}

export interface BulkPreviewItem extends BulkRow {
  id: string;
  type: NonNullable<Issue['type']>;
  duplicate: boolean;
}

/** Detecta o tipo pelo texto (título/chave), para o preview já vir classificado. Padrão: dev. */
export function detectBulkType(text: string): NonNullable<Issue['type']> {
  const t = text.toLowerCase();
  if (/\b(bug|defeito|defect|erro|hotfix|qa|teste|test)\b/.test(t)) return 'qa';
  if (/\b(design|ux|ui|prot[oó]tipo|figma|layout|wireframe)\b/.test(t)) return 'design';
  if (/\b(doc|documenta|spike|infra|deploy)\b/.test(t)) return 'other';
  return 'dev';
}

/** Uma linha do texto livre: `CHAVE | Título | Link`; chave e link são opcionais. */
export function parseBulkLine(line: string): BulkRow {
  const parts = line.split('|').map((p) => p.trim());
  let key = '';
  let title = '';
  let link = '';
  if (parts.length === 1) {
    if (isValidJiraKey(parts[0])) {
      key = parts[0];
      title = parts[0];
    } else {
      title = parts[0];
    }
  } else if (parts.length === 2) {
    key = parts[0];
    title = parts[1];
  } else {
    key = parts[0];
    title = parts[1];
    link = parts[2];
  }
  return { key: isValidJiraKey(key) ? key : '', title, link };
}

export function parseBulkText(text: string): BulkRow[] {
  return text.split('\n').filter((l) => l.trim()).map(parseBulkLine);
}

/** CSV simples: separador `;` ou `,`, colunas chave, título, link. */
export function parseBulkCsv(text: string): BulkRow[] {
  return text
    .split(/\r?\n/)
    .filter((l) => l.trim())
    .map((line) => {
      const delimiter = line.includes(';') ? ';' : ',';
      const cols = line.split(delimiter).map((c) => c.trim().replace(/^["']|["']$/g, ''));
      const key = isValidJiraKey(cols[0]) ? cols[0] : '';
      return { key, title: cols[1] || cols[0] || 'Sem Título', link: cols[2] || '' };
    });
}

/**
 * Marca duplicatas (contra a fila e dentro do próprio lote) e classifica o tipo.
 * Duplicatas continuam visíveis e selecionáveis; só entram desmarcadas.
 */
export function decorateBulkPreview(raw: BulkRow[], issues: Issue[]): BulkPreviewItem[] {
  const existingKeys = new Set(issues.map((i) => (i.key || '').toUpperCase()).filter(Boolean));
  const existingTitles = new Set(issues.map((i) => i.title.trim().toLowerCase()));
  const seenKeys = new Set<string>();
  const seenTitles = new Set<string>();
  return raw.map((it, idx) => {
    const keyU = it.key.toUpperCase();
    const titleN = it.title.trim().toLowerCase();
    const dupExisting = (!!keyU && existingKeys.has(keyU)) || (!!titleN && existingTitles.has(titleN));
    const dupBatch = (!!keyU && seenKeys.has(keyU)) || (!!titleN && seenTitles.has(titleN));
    if (keyU) seenKeys.add(keyU);
    if (titleN) seenTitles.add(titleN);
    return {
      ...it,
      id: `${it.key || 'row'}-${idx}`,
      type: detectBulkType(`${it.key} ${it.title}`),
      duplicate: dupExisting || dupBatch,
    };
  });
}

// --- Importação do Jira ---

/** Subconjunto do JiraIssue usado na conversão (evita acoplar a lib ao serviço). */
export interface JiraIssueLike {
  key: string;
  title: string;
  url?: string;
  description?: string;
  type?: string;
  status?: string;
  priority?: string;
  assignee?: string;
  updated?: string;
  labels?: string[];
  acceptanceCriteria?: string;
  points?: number | string;
}

/** Issue do Jira -> item da fila (mesmo formato que o lote e o form manual entregam à sala). */
export function jiraIssueToQueueItem(r: JiraIssueLike): Partial<Issue> {
  // Se o resumo já contiver a chave (ou vier vazio), não repete a chave no título.
  const title = !r.title || r.title === r.key || r.title.includes(r.key) ? r.title || r.key : `${r.key} - ${r.title}`;
  return {
    title,
    key: r.key,
    jiraLink: r.url,
    description: r.description || '',
    jiraType: r.type || '',
    jiraStatus: r.status || '',
    jiraPriority: r.priority || '',
    jiraAssignee: r.assignee || '',
    jiraUpdated: r.updated || '',
    jiraLabels: r.labels || [],
    acceptanceCriteria: r.acceptanceCriteria || '',
    jiraPoints: r.points ? String(r.points) : '',
    type: mapJiraTypeToIssueType(r.type),
  };
}

/** Texto do aviso depois de importar: conta só o que entrou de fato. */
export function importSummary(total: number, added: number | void, noun: { one: string; many: string }) {
  const count = typeof added === 'number' ? added : total;
  const skipped = total - count;
  return { count, skipped, noun: count === 1 ? noun.one : noun.many };
}
