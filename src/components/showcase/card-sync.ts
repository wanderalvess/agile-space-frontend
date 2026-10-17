/**
 * Edição por card sem sobrescrever (backend com a V81, docs/ceremony-review-api.md): o que mudou num card vira uma lista
 * de alterações por campo (`FieldChange`), que a sala manda como `PATCH` com a versão lida. Tudo puro, sem rede nem
 * React: a fila de gravação e o tempo real estão em `useShowcaseRoom`.
 *
 * Por que "por campo" e com a base: duas pessoas mexendo em campos diferentes do mesmo card não se atrapalham (o 409 se
 * resolve sozinho); só quando a MESMA informação mudou dos dois lados é que a pessoa decide (reaplicar ou descartar).
 */
import { normalizeTask } from './session-model';
import type { ShowcaseSession, ShowcaseTask } from './types';

/** Campos de conteúdo que o PATCH aceita. `evidence` entra por subcampo (`evidence.solution`) e `metrics` por inteiro. */
export const PATCHABLE_FIELDS = [
  'key', 'title', 'description', 'acceptanceCriteria', 'type', 'status', 'priority', 'points',
  'cardKind', 'chartType', 'chartTitle', 'chartDisplay', 'assignee', 'url',
  'decision', 'preparationStatus', 'feedback', 'project',
  'versionSuporte', 'versionMaster', 'versionRelease', 'versionDevelop', 'metrics',
] as const;

const EVIDENCE_PREFIX = 'evidence.';

/** A trava PO/SME do servidor vale para estes dois campos. */
export const DECISION_PATHS: readonly string[] = ['decision', 'feedback'];

/** Campos de autoria da decisão: o servidor carimba, o cliente só os mostra. */
const DECISION_AUTHORSHIP = ['decidedBy', 'decidedByName', 'decidedAt', 'approvedAt'] as const;

/** Uma alteração local ainda não gravada: o valor novo e o valor que o campo tinha quando a pessoa começou a mexer. */
export interface FieldChange {
  /** `title`, `metrics`... ou `evidence.problem`. */
  path: string;
  value: unknown;
  /** Valor antes da primeira alteração local ainda não gravada deste campo. */
  base: unknown;
}

export function deepEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (a == null || b == null || typeof a !== 'object' || typeof b !== 'object') return false;
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  const ka = Object.keys(a as object);
  const kb = Object.keys(b as object);
  if (ka.length !== kb.length) return false;
  return ka.every((k) => deepEqual((a as Record<string, unknown>)[k], (b as Record<string, unknown>)[k]));
}

export function isEvidencePath(path: string): boolean {
  return path.startsWith(EVIDENCE_PREFIX);
}

export function getPath(card: ShowcaseTask, path: string): unknown {
  if (isEvidencePath(path)) return (card.evidence as unknown as Record<string, unknown> | undefined)?.[path.slice(EVIDENCE_PREFIX.length)];
  return (card as unknown as Record<string, unknown>)[path];
}

/** O card suporta edição por PATCH (o servidor devolveu `version`). */
export function supportsPatch(card: ShowcaseTask | undefined | null): card is ShowcaseTask & { version: number } {
  return !!card && typeof card.version === 'number' && Number.isFinite(card.version);
}

/** O que mudou entre dois estados do mesmo card, só nos campos que o PATCH aceita. */
export function diffCard(prev: ShowcaseTask, next: ShowcaseTask): FieldChange[] {
  const changes: FieldChange[] = [];
  for (const field of PATCHABLE_FIELDS) {
    const a = (prev as unknown as Record<string, unknown>)[field];
    const b = (next as unknown as Record<string, unknown>)[field];
    if (!deepEqual(a, b)) changes.push({ path: field, value: b, base: a });
  }
  const pe = (prev.evidence ?? {}) as unknown as Record<string, unknown>;
  const ne = (next.evidence ?? {}) as unknown as Record<string, unknown>;
  for (const key of new Set([...Object.keys(pe), ...Object.keys(ne)])) {
    if (!deepEqual(pe[key], ne[key])) changes.push({ path: `${EVIDENCE_PREFIX}${key}`, value: ne[key], base: pe[key] });
  }
  return changes;
}

/** Aplica as alterações sobre um card (sem mexer no original). */
export function applyChanges(card: ShowcaseTask, changes: readonly FieldChange[]): ShowcaseTask {
  let next = card;
  for (const c of changes) {
    next = isEvidencePath(c.path)
      ? { ...next, evidence: { ...next.evidence, [c.path.slice(EVIDENCE_PREFIX.length)]: c.value } }
      : ({ ...next, [c.path]: c.value } as ShowcaseTask);
  }
  return next;
}

/** Junta alterações pendentes do mesmo card: o valor vale o mais novo; a base, a da primeira vez que o campo foi mexido. */
export function mergeChanges(existing: readonly FieldChange[], incoming: readonly FieldChange[]): FieldChange[] {
  const merged = existing.map((c) => ({ ...c }));
  for (const c of incoming) {
    const at = merged.findIndex((m) => m.path === c.path);
    if (at >= 0) merged[at] = { path: c.path, value: c.value, base: merged[at].base };
    else merged.push({ ...c });
  }
  return merged;
}

/** Corpo do `PATCH`: a versão lida e só os campos mudados (evidência por subcampo, métricas por inteiro). */
export function toPatchBody(version: number, changes: readonly FieldChange[]): Record<string, unknown> {
  const body: Record<string, unknown> = { version };
  const evidence: Record<string, unknown> = {};
  for (const c of changes) {
    const value = c.value === undefined ? null : c.value;
    if (isEvidencePath(c.path)) evidence[c.path.slice(EVIDENCE_PREFIX.length)] = value;
    else body[c.path] = value;
  }
  if (Object.keys(evidence).length > 0) body.evidence = evidence;
  return body;
}

/**
 * Campos que mudaram dos dois lados: o servidor tem um valor diferente do que a pessoa viu (base) e diferente do que
 * ela quer gravar. Os outros campos se aplicam sem perguntar nada.
 */
export function findCollisions(current: ShowcaseTask, changes: readonly FieldChange[]): FieldChange[] {
  return changes.filter((c) => {
    const server = getPath(current, c.path);
    return !deepEqual(server, c.base) && !deepEqual(server, c.value);
  });
}

export const isDecisionPath = (path: string) => DECISION_PATHS.includes(path);

/** Tira da lista o que a trava de decisão do servidor rejeita (veredito e feedback). */
export function withoutDecisionChanges(changes: readonly FieldChange[]): FieldChange[] {
  return changes.filter((c) => !isDecisionPath(c.path));
}

const FIELD_LABELS: Record<string, string> = {
  key: 'chave', title: 'título', description: 'descrição', acceptanceCriteria: 'critérios de aceite', type: 'tipo',
  status: 'status', priority: 'prioridade', points: 'pontos', cardKind: 'tipo de card', chartType: 'gráfico',
  chartTitle: 'título do gráfico', chartDisplay: 'exibição do gráfico', assignee: 'responsável', url: 'link',
  decision: 'decisão', preparationStatus: 'preparação', feedback: 'feedback', project: 'projeto',
  versionSuporte: 'versão de suporte', versionMaster: 'versão master', versionRelease: 'versão release',
  versionDevelop: 'versão develop', metrics: 'métricas',
  'evidence.problem': 'problema', 'evidence.solution': 'solução', 'evidence.dev': 'desenvolvedor', 'evidence.qa': 'QA',
  'evidence.screenshot': 'print', 'evidence.video': 'vídeo', 'evidence.techDocUrl': 'doc. técnico', 'evidence.tdnUrl': 'TDN',
  'evidence.timeSpent': 'horas gastas', 'evidence.timeEstimate': 'horas estimadas', 'evidence.evidencePreference': 'evidência principal',
  'evidence.planned': 'horas planejadas',
};

export const fieldLabel = (path: string): string => FIELD_LABELS[path] ?? path.replace(EVIDENCE_PREFIX, '');

/** Trecho curto do valor para mostrar no aviso de conflito ("o que você digitou"). */
export function previewValue(value: unknown, max = 140): string {
  let text: string;
  if (value == null || value === '') text = '(vazio)';
  else if (typeof value === 'string') text = value;
  else if (Array.isArray(value)) text = value.map((v) => (v && typeof v === 'object' && 'field' in v ? `${(v as { field: string }).field}: ${(v as { value: unknown }).value}` : String(v))).join('; ') || '(vazio)';
  else text = String(value);
  text = text.replace(/\s+/g, ' ').trim();
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

/**
 * Traz um card vindo do servidor (resposta do PATCH, 409 ou evento) para a sessão, mantendo por cima dele o que a pessoa
 * ainda não gravou. Devolve a MESMA sessão quando o card local já é igual ou mais novo (evento atrasado) e `null` quando
 * o card não existe aqui (outra pessoa o criou: a sala deve recarregar).
 */
export function applyServerCard(
  session: ShowcaseSession,
  raw: unknown,
  pending: readonly FieldChange[] = [],
  opts: { ignoreOlder?: boolean } = {},
): ShowcaseSession | null {
  if (!raw || typeof raw !== 'object') return session;
  const card = normalizeTask(raw);
  const at = session.tasks.findIndex((t) => t.id === card.id);
  if (at < 0) return null;
  const local = session.tasks[at];
  if (opts.ignoreOlder && supportsPatch(local) && typeof card.version === 'number' && card.version <= local.version) return session;
  // Anexos não vêm no card do PATCH/evento de forma confiável: mantém os que a tela já tem se o servidor não os trouxe.
  const hasAttachments = Array.isArray((raw as { attachments?: unknown }).attachments);
  const merged = applyChanges({ ...card, attachments: hasAttachments ? card.attachments : local.attachments }, pending);
  const tasks = session.tasks.slice();
  tasks[at] = merged;
  return { ...session, tasks };
}

/** Troca o veredito e o feedback dos cards em `cardIds` pelos do servidor (a trava recusou a mudança). */
export function revertDecisions(next: ShowcaseSession, latest: ShowcaseSession, cardIds: readonly string[]): ShowcaseSession {
  const ids = new Set(cardIds);
  const tasks = next.tasks.map((t) => {
    if (!ids.has(t.id)) return t;
    const server = latest.tasks.find((s) => s.id === t.id);
    const reverted: ShowcaseTask = { ...t, decision: server?.decision ?? 'open', feedback: server?.feedback ?? '' };
    for (const key of DECISION_AUTHORSHIP) (reverted as unknown as Record<string, unknown>)[key] = server?.[key];
    return reverted;
  });
  return { ...next, tasks };
}

// ───────────────────────── Erros do servidor ─────────────────────────

type ApiErrorLike = { status?: number; code?: string; body?: Record<string, unknown> | null };

/** 403 `DECISION_RESTRICTED`: quem não pode decidir tentou mudar veredito ou feedback. `cardIds` = cards recusados. */
export function parseDecisionRestricted(error: unknown): { cardIds: string[] } | null {
  const e = error as ApiErrorLike | null | undefined;
  if (!e || e.status !== 403 || e.code !== 'DECISION_RESTRICTED') return null;
  const ids = e.body?.cardIds;
  return { cardIds: Array.isArray(ids) ? ids.filter((x): x is string => typeof x === 'string') : [] };
}

/** 409 `CARD_VERSION_CONFLICT`: o card atual do servidor, já normalizado. */
export function parseCardConflict(error: unknown): ShowcaseTask | null {
  const e = error as ApiErrorLike | null | undefined;
  if (!e || e.status !== 409 || e.code !== 'CARD_VERSION_CONFLICT') return null;
  const card = e.body?.card;
  return card && typeof card === 'object' ? normalizeTask(card) : null;
}

export const DECISION_RESTRICTED_TITLE = 'Você não pode registrar a decisão desta Review';
export const DECISION_RESTRICTED_HELP = 'Só o PO, o SME, a liderança da squad ou um administrador registra veredito e feedback. O card voltou ao que está gravado.';

/** "1 card foi mantido como estava no servidor" / "3 cards foram mantidos como estavam no servidor". */
export function staleCardsMessage(count: number): string {
  return count === 1 ? '1 card foi mantido como estava no servidor' : `${count} cards foram mantidos como estavam no servidor`;
}

export const STALE_CARDS_HELP = 'Outra pessoa alterou antes de você. A tela já mostra a versão do servidor; refaça o que faltar.';

/** Aviso de conflito: "Outra pessoa alterou PTV-12 ao mesmo tempo: título e solução." */
export function conflictSummary(taskKey: string, changes: readonly FieldChange[]): string {
  const fields = Array.from(new Set(changes.map((c) => fieldLabel(c.path)))).join(', ');
  return `Outra pessoa alterou ${taskKey || 'o card'} ao mesmo tempo${fields ? `: ${fields}` : ''}. Sua versão não foi gravada.`;
}
