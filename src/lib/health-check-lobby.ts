/**
 * Regras do lobby do Radar de clima (/health-check), sem React e sem rede: entrar por ID ou link, linhas da
 * lista da squad, filtros, última pesquisa e a série de "Evolução do clima".
 */
import type { HealthCheckBoard, HealthCheckScaleType } from './types';
import { summarizeResults, type HealthSummary } from './health-check-rules';

// ───────────────────────── Entrar por ID ou link ─────────────────────────

export interface JoinTarget {
  id: string;
  /** O ID foi tirado de um link colado (a tela mostra "ID reconhecido no link"). */
  fromLink: boolean;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * O ID do radar é um UUID gravado em minúsculas. Quem digita ou cola em maiúsculas (a caixa antiga forçava
 * maiúsculas) volta para minúsculas; qualquer outro formato (radares antigos, migrados) é mantido como veio,
 * porque o servidor compara o ID com diferença entre maiúsculas e minúsculas.
 */
export function normalizeBoardId(id: string): string {
  const trimmed = id.trim();
  return UUID.test(trimmed) ? trimmed.toLowerCase() : trimmed;
}

/**
 * Texto do campo "ID ou link" -> sala. Aceita o ID puro ou o endereço inteiro (`.../health-check/<id>?x=1`).
 * Um texto que parece endereço mas não é de um radar (outra ferramenta) não vira rota quebrada: devolve `null`.
 */
export function parseJoinInput(raw: string): JoinTarget | null {
  const typed = raw.trim();
  if (!typed) return null;
  const fromLink = typed.match(/health-check\/([^/?#\s]+)/i);
  if (fromLink) {
    let id = fromLink[1];
    try { id = decodeURIComponent(id); } catch { /* mantém como veio */ }
    id = normalizeBoardId(id);
    return id ? { id, fromLink: true } : null;
  }
  if (/[/\\\s]/.test(typed)) return null;
  return { id: normalizeBoardId(typed), fromLink: false };
}

// ───────────────────────── Linhas da lista ─────────────────────────

export type HealthStatus = 'collecting' | 'finished';

export interface HealthRow {
  id: string;
  title: string;
  team: string;
  createdAt: string;
  status: HealthStatus | null;
  scale?: HealthCheckScaleType;
  dimensionCount?: number;
  /** Nota de clima (0 a 10) de radar encerrado. */
  score: number | null;
  /** Quantas respostas o servidor já contou (histórico da Home); `null` quando não veio. */
  answers: number | null;
  board?: HealthCheckBoard;
}

interface LocalRoomMeta {
  roomId: string;
  title: string;
  team: string;
  createdAt: string;
}

/** Resumo calculado com a regra única; `null` se o radar ainda coleta ou não tem resumo. */
export function summaryOfBoard(board: Pick<HealthCheckBoard, 'status' | 'dimensions' | 'summary' | 'scaleType'>): HealthSummary | null {
  if (board.status !== 'finished' || !board.summary) return null;
  return summarizeResults(board.dimensions ?? [], board.summary.results, board.scaleType);
}

export function rowFromBoard(board: HealthCheckBoard, answers: number | null = null): HealthRow {
  return {
    id: board.id,
    title: board.sprintName?.trim() || 'Radar sem título',
    team: board.team || '',
    createdAt: board.createdAt,
    status: board.status === 'finished' ? 'finished' : 'collecting',
    scale: board.scaleType,
    dimensionCount: board.dimensions?.length ?? 0,
    score: summaryOfBoard(board)?.climate ?? null,
    answers,
    board,
  };
}

/** "9 respostas" do histórico da Home -> 9. Sem o texto, `null` (não inventa contagem). */
export function answersFromSummary(summary: string | null | undefined): number | null {
  const m = (summary ?? '').match(/^(\d+)\s+resposta/i);
  return m ? Number(m[1]) : null;
}

/**
 * Lista do lobby: os radares que o servidor devolve para a squad, mais os abertos neste navegador que ele não
 * listou (entrou por link, outra squad). Sem repetição, do mais novo para o mais antigo.
 */
export function mergeHealthRows(remote: readonly HealthCheckBoard[], local: readonly LocalRoomMeta[], answersById: ReadonlyMap<string, number> = new Map()): HealthRow[] {
  const rows = new Map<string, HealthRow>();
  for (const b of remote) rows.set(b.id, rowFromBoard(b, answersById.get(b.id) ?? null));
  for (const l of local) {
    if (!rows.has(l.roomId)) {
      rows.set(l.roomId, { id: l.roomId, title: l.title || 'Radar sem título', team: l.team || '', createdAt: l.createdAt, status: null, score: null, answers: answersById.get(l.roomId) ?? null });
    }
  }
  return [...rows.values()].sort((a, b) => (Date.parse(b.createdAt) || 0) - (Date.parse(a.createdAt) || 0));
}

export type HealthLobbyFilter = 'all' | 'collecting' | 'finished';

export const HEALTH_LOBBY_FILTERS: readonly { id: HealthLobbyFilter; label: string }[] = [
  { id: 'all', label: 'Todas' },
  { id: 'collecting', label: 'Coletando' },
  { id: 'finished', label: 'Encerradas' },
];

export const HEALTH_STATUS_LABELS: Record<HealthStatus, string> = {
  collecting: 'Coletando respostas',
  finished: 'Encerrada',
};

const fold = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

export function filterHealthRows(rows: readonly HealthRow[], filter: HealthLobbyFilter, query: string): HealthRow[] {
  const q = fold(query.trim());
  return rows.filter((r) => {
    if (filter !== 'all' && r.status !== filter) return false;
    return !q || fold(r.title).includes(q);
  });
}

// ───────────────────────── Evolução do clima ─────────────────────────

export interface EvolutionPoint {
  id: string;
  title: string;
  createdAt: string;
  score: number;
}

/** Quantos pontos a série mostra (os mais recentes). */
export const EVOLUTION_LIMIT = 8;

/** Nota dos radares encerrados da squad, do mais antigo para o mais novo. */
export function evolutionPoints(boards: readonly HealthCheckBoard[], limit = EVOLUTION_LIMIT): EvolutionPoint[] {
  const points: EvolutionPoint[] = [];
  for (const b of boards) {
    const climate = summaryOfBoard(b)?.climate;
    if (climate === null || climate === undefined) continue;
    points.push({ id: b.id, title: b.sprintName?.trim() || 'Radar sem título', createdAt: b.createdAt, score: climate });
  }
  points.sort((a, b) => (Date.parse(a.createdAt) || 0) - (Date.parse(b.createdAt) || 0));
  return points.slice(-limit);
}

/** Variação da última nota sobre a anterior (`null` com menos de dois pontos). */
export function evolutionDelta(points: readonly EvolutionPoint[]): number | null {
  if (points.length < 2) return null;
  return points[points.length - 1].score - points[points.length - 2].score;
}

/** "+0,6" / "−0,3" / "0,0". */
export function formatDelta(delta: number): string {
  const rounded = Math.round(delta * 10) / 10;
  const text = Math.abs(rounded).toFixed(1).replace('.', ',');
  if (rounded > 0) return `+${text}`;
  if (rounded < 0) return `−${text}`;
  return text;
}

// ───────────────────────── Radar anterior (comparar) ─────────────────────────

/** Mesma pergunta: mesma chave e mesmo título (sem diferença de maiúsculas e espaços). */
export function sameQuestion(a: { key: string; title: string }, b: { key: string; title: string }): boolean {
  return a.key === b.key && fold(a.title.trim()) === fold(b.title.trim());
}

/**
 * O radar encerrado imediatamente anterior ao atual, na mesma squad, com resumo. Só serve se tiver ao menos uma
 * pergunta em comum (senão não há o que comparar).
 */
export function previousBoard(current: Pick<HealthCheckBoard, 'id' | 'createdAt' | 'dimensions'>, boards: readonly HealthCheckBoard[]): HealthCheckBoard | null {
  const now = Date.parse(current.createdAt) || 0;
  const candidates = boards
    .filter((b) => b.id !== current.id && b.status === 'finished' && !!b.summary && (Date.parse(b.createdAt) || 0) < now)
    .filter((b) => (b.dimensions ?? []).some((d) => current.dimensions.some((c) => sameQuestion(c, d))))
    .sort((a, b) => (Date.parse(b.createdAt) || 0) - (Date.parse(a.createdAt) || 0));
  return candidates[0] ?? null;
}

export interface DimensionDiff {
  key: string;
  title: string;
  before: number;
  after: number;
  delta: number;
}

/** Diferença de nota por dimensão com a mesma pergunta nos dois radares (ignora quem não tem respostas em algum). */
export function compareBoards(current: HealthSummary, currentDims: readonly { key: string; title: string }[], previous: HealthSummary, previousDims: readonly { key: string; title: string }[]): DimensionDiff[] {
  const diffs: DimensionDiff[] = [];
  for (const cd of currentDims) {
    const pd = previousDims.find((p) => sameQuestion(cd, p));
    if (!pd) continue;
    const after = current.stats.find((s) => s.key === cd.key)?.score;
    const before = previous.stats.find((s) => s.key === pd.key)?.score;
    if (after === null || after === undefined || before === null || before === undefined) continue;
    diffs.push({ key: cd.key, title: cd.title, before, after, delta: after - before });
  }
  return diffs;
}

// ───────────────────────── Squads para escolher ─────────────────────────

export interface SquadChoice {
  value: string;
  label: string;
}

/**
 * Squads que a pessoa pode escolher para a pesquisa: as do vínculo (nunca texto livre: a lista da squad filtra
 * pela chave, então um nome digitado fazia a pesquisa sumir). Sem vínculos, só a ativa; sem nenhuma, vazio.
 */
export function squadChoices(
  memberships: readonly { projectId: string; projectName?: string }[] | null | undefined,
  active: { squadId?: string; squadName?: string },
): SquadChoice[] {
  const byKey = new Map<string, SquadChoice>();
  const add = (value?: string, label?: string) => {
    const v = (value ?? '').trim();
    if (!v) return;
    const key = v.toLowerCase();
    if (!byKey.has(key)) byKey.set(key, { value: v, label: (label ?? '').trim() || v });
  };
  for (const m of memberships ?? []) add(m.projectId, m.projectName);
  if (!memberships || memberships.length === 0) add(active.squadId, active.squadName);
  return [...byKey.values()].sort((a, b) => a.label.localeCompare(b.label, 'pt-BR'));
}

/** Nome para mostrar de uma squad guardada no radar (a chave), usando o vínculo quando houver. */
export function squadDisplayName(value: string | undefined, choices: readonly SquadChoice[]): string {
  const v = (value ?? '').trim();
  if (!v) return '';
  return choices.find((c) => c.value.toLowerCase() === v.toLowerCase())?.label ?? v;
}

// ───────────────────────── Atalho local de salas ─────────────────────────

const ROOMS_META_KEY = 'agileSpace_rooms_meta';

/** Tira uma sala do atalho local deste navegador (ao apagar o radar). Falha de armazenamento é ignorada. */
export function removeLocalRoomMeta(roomId: string, storage: Pick<Storage, 'getItem' | 'setItem'> | undefined): void {
  if (!storage) return;
  try {
    const raw = storage.getItem(ROOMS_META_KEY);
    if (!raw) return;
    const rooms = JSON.parse(raw) as { roomId?: string }[];
    if (!Array.isArray(rooms)) return;
    storage.setItem(ROOMS_META_KEY, JSON.stringify(rooms.filter((r) => r.roomId !== roomId)));
  } catch {
    // dado quebrado: o atalho some sozinho quando for regravado
  }
}
