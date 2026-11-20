/**
 * Regras puras da importação do Jira no Scrum Poker: consultas prontas,
 * filtro dos resultados e tom do status. Sem React.
 */

export interface JqlPreset {
  id: string;
  label: string;
  jql: string;
}

/** Consultas prontas (as mesmas do diálogo antigo, sem emoji no rótulo). */
export const JQL_PRESETS: readonly JqlPreset[] = [
  { id: 'mine', label: 'Minhas issues', jql: 'assignee = currentUser() AND status != Done' },
  { id: 'sprint', label: 'Sprint atual', jql: 'sprint in openSprints()' },
  { id: 'backlog', label: 'Backlog', jql: 'status = "To Do" ORDER BY rank DESC' },
  { id: 'review-ddpdv', label: 'Review DDPDV', jql: 'project = "Varejo Front"  AND sprint = 52188 AND (issuetype in (História, "Débito Técnico", Legislação, Story) OR issuetype in (Manutencao, Manutenção, "Rejeição - Manutenção") AND priority = Crítica OR labels in (ApresentarReview)) AND sprint not in (futureSprints(), openSprints() )' },
  { id: 'review-geral', label: 'Review geral', jql: 'sprint = NumeroDaSprint AND status = Concluído AND (issuetype in (Legislação, História, Story, Participativo, Spike) OR (issuetype = Manutenção AND priority = Crítica))' },
  { id: 'refinamento-ddwmissi', label: 'Refinamento DDWMISSI', jql: 'project = "DDWMISSI" and issuetype != Gestão and issueFunction in linkedIssuesOf("issuetype = Gestão AND summary ~ Refinamento and resolution = unresolved and project= \'DDWMISSI\'")' },
  { id: 'done-week', label: 'Concluídas na semana', jql: 'assignee = currentUser() AND resolutiondate >= -1w AND status = Done' },
  { id: 'blocked', label: 'Bloqueadas', jql: 'assignee = currentUser() AND status = Blocked' },
];

export interface JiraResultLike {
  key: string;
  title: string;
  description: string;
  type: string;
  status: string;
}

export interface JiraResultFilter {
  text: string;
  types: ReadonlySet<string>;
  statuses: ReadonlySet<string>;
}

export const EMPTY_FILTER: JiraResultFilter = { text: '', types: new Set(), statuses: new Set() };

const norm = (s?: string) => (s || '').toLowerCase();

/** Remove tags do HTML do Jira para mostrar um trecho em texto puro (tags de bloco viram espaço; as de linha somem). */
export function stripHtml(s?: string): string {
  return (s || '')
    .replace(/<\/?(p|div|br|li|ul|ol|h[1-6]|tr|td|th|table|pre|blockquote)(\s[^>]*)?\/?>/gi, ' ')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Busca por texto (chave, título, descrição) + tipo + status. Filtro vazio = tudo. */
export function filterJiraResults<T extends JiraResultLike>(results: readonly T[], filter: JiraResultFilter): T[] {
  const q = norm(filter.text.trim());
  return results.filter((r) => {
    if (filter.types.size && !filter.types.has(r.type)) return false;
    if (filter.statuses.size && !filter.statuses.has(r.status)) return false;
    if (q && !norm(r.key).includes(q) && !norm(r.title).includes(q) && !norm(stripHtml(r.description)).includes(q)) return false;
    return true;
  });
}

/** Valores distintos (e quantas issues cada um tem), na ordem em que aparecem. */
export function countDistinct<T>(items: readonly T[], pick: (item: T) => string | undefined): Array<[string, number]> {
  const counts = new Map<string, number>();
  for (const item of items) {
    const v = pick(item);
    if (v) counts.set(v, (counts.get(v) || 0) + 1);
  }
  return [...counts.entries()];
}

/** Uma issue por chave (a última vence), mantendo a ordem da primeira aparição. */
export function dedupeByKey<T extends { key: string }>(items: readonly T[]): T[] {
  return Array.from(new Map(items.map((i) => [i.key, i])).values());
}

export type StatusTone = 'success' | 'brand' | 'danger' | 'warn' | 'neutral';

/** Tom do status por heurística de texto (o Jira varia o nome do status). */
export function jiraStatusTone(status?: string): StatusTone {
  const t = norm(status);
  if (/(done|conclu|fech|resolv|encerr)/.test(t)) return 'success';
  if (/(progress|andamento|doing|desenvolv|execu)/.test(t)) return 'brand';
  if (/(block|imped|bloque)/.test(t)) return 'danger';
  if (/(review|revis|test|qa|homolog)/.test(t)) return 'warn';
  return 'neutral';
}

/** Domínio digitado -> sem protocolo e sem barra final (mesma limpeza do salvar). */
export function cleanJiraDomain(domain: string): string {
  return domain.trim().replace(/^https?:\/\//i, '').replace(/\/+$/, '');
}
