/**
 * Tudo o que o Jolt guarda no navegador (localStorage): layouts salvos, rascunhos e a passagem Sandbox <-> Gerador.
 *
 * Regras: todo acesso passa por try/catch (modo privado, cota cheia, armazenamento bloqueado) e devolve um
 * resultado em vez de lançar; quem chama decide como avisar. Nada aqui vai ao servidor.
 */

export type StoreFailure = 'grande' | 'cheio' | 'indisponivel';
export type StoreResult = { ok: true } | { ok: false; reason: StoreFailure };

/** Um valor maior que isto nem é tentado: a cota do navegador (~5 MB) é dividida com tudo o mais do portal. */
export const MAX_VALUE_CHARS = 1_200_000;

/** Mensagem para a pessoa quando algo não coube ou não pôde ser guardado. */
export function storeFailureMessage(reason: StoreFailure, what = 'o rascunho'): string {
  if (reason === 'grande') return `${capitalize(what)} é grande demais para guardar neste navegador. Copie o conteúdo antes de fechar a página.`;
  if (reason === 'cheio') return `O armazenamento do navegador está cheio e não coube ${what}. Exclua layouts antigos ou copie o conteúdo antes de fechar a página.`;
  return `O navegador bloqueou o armazenamento, então ${what} não foi guardado. Copie o conteúdo antes de fechar a página.`;
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function store(): Storage | null {
  try {
    return typeof window === 'undefined' ? null : window.localStorage;
  } catch {
    return null;
  }
}

export function readText(key: string): string | null {
  try {
    return store()?.getItem(key) ?? null;
  } catch {
    return null;
  }
}

export function writeText(key: string, value: string, maxChars = MAX_VALUE_CHARS): StoreResult {
  const s = store();
  if (!s) return { ok: false, reason: 'indisponivel' };
  if (value.length > maxChars) return { ok: false, reason: 'grande' };
  try {
    s.setItem(key, value);
    return { ok: true };
  } catch (e) {
    const name = e instanceof DOMException ? e.name : '';
    const quota = name === 'QuotaExceededError' || name === 'NS_ERROR_DOM_QUOTA_REACHED' || /quota/i.test(String((e as Error)?.message));
    return { ok: false, reason: quota ? 'cheio' : 'indisponivel' };
  }
}

export function readJson<T>(key: string): T | null {
  const raw = readText(key);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export function writeJson(key: string, value: unknown, maxChars = MAX_VALUE_CHARS): StoreResult {
  return writeText(key, JSON.stringify(value), maxChars);
}

export function removeKey(key: string): void {
  try {
    store()?.removeItem(key);
  } catch {
    /* sem storage: nada a apagar */
  }
}

// ───────────────────────────────────────────────────────────────────────── identidade das chaves

/** Quem não está logado usa a chave "visitante"; ao entrar, o rascunho dele passa para a conta (ver adoptGuestDrafts). */
export const GUEST_KEY = 'visitante';

export const userKey = (userId: string | null | undefined): string => userId || GUEST_KEY;

export const layoutsKey = (userId: string | null | undefined): string => `agileSpace_jolt_layouts_${userKey(userId)}`;
const sandboxDraftKey = (userId: string | null | undefined): string => `agileSpace_jolt_rascunho_sandbox_${userKey(userId)}`;
const geradorDraftKey = (userId: string | null | undefined): string => `agileSpace_jolt_rascunho_gerador_${userKey(userId)}`;

/** Passagem entre as telas (lida e apagada pela tela que recebe). Nomes antigos: jolt_visual_* e jolt_generator_input. */
export const HANDOFF_GERADOR_PARA_SANDBOX = 'jolt_gerador_para_sandbox';
export const HANDOFF_SANDBOX_PARA_GERADOR = 'jolt_sandbox_para_gerador';
const LEGACY_SPEC = 'jolt_visual_generated_spec';
const LEGACY_INPUT = 'jolt_visual_input_json';
const LEGACY_MAINTENANCE = 'jolt_visual_from_maintenance';
const LEGACY_SANDBOX_INPUT = 'jolt_generator_input';

// ───────────────────────────────────────────────────────────────────────── layouts salvos

export interface SavedLayout {
  id: string;
  name: string;
  apiUrl: string;
  joltSpec: string;
  lastInput: string;
  updatedAt: string;
  toolType?: string;
  creatorId?: string;
  authorName?: string;
}

export function readLayouts(userId: string | null | undefined): SavedLayout[] {
  const parsed = readJson<unknown>(layoutsKey(userId));
  if (!Array.isArray(parsed)) return [];
  return parsed.filter((l): l is SavedLayout => !!l && typeof l === 'object' && typeof (l as SavedLayout).id === 'string');
}

/** Layouts podem somar vários MB; aqui o limite é o da própria cota do navegador, não o de rascunho. */
export function writeLayouts(userId: string | null | undefined, layouts: SavedLayout[]): StoreResult {
  return writeJson(layoutsKey(userId), layouts, 4_000_000);
}

/** Os mais recentes primeiro (data de gravação), no máximo `limit`. */
export function recentLayouts(layouts: SavedLayout[], limit = 4): SavedLayout[] {
  return [...layouts]
    .sort((a, b) => (Date.parse(b.updatedAt) || 0) - (Date.parse(a.updatedAt) || 0))
    .slice(0, limit);
}

const pad = (n: number) => String(n).padStart(2, '0');

/** "hoje, 09:12", "ontem, 17:40", "16/10, 11:05" (e com o ano quando não é o atual). */
export function formatRecent(iso: string, now: Date = new Date()): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const hm = `${pad(d.getHours())}:${pad(d.getMinutes())}`;
  const startOf = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const days = Math.round((startOf(now) - startOf(d)) / 86_400_000);
  if (days === 0) return `hoje, ${hm}`;
  if (days === 1) return `ontem, ${hm}`;
  const date = `${pad(d.getDate())}/${pad(d.getMonth() + 1)}`;
  return d.getFullYear() === now.getFullYear() ? `${date}, ${hm}` : `${date}/${d.getFullYear()}, ${hm}`;
}

// ───────────────────────────────────────────────────────────────────────── rascunho da Sandbox

export interface SandboxDraft {
  entrada: string;
  spec: string;
  /** Última saída executada (texto). */
  saida: string;
  nome: string;
  url: string;
  /** Layout completo do arquivo carregado (para "Layout completo"), quando coube. */
  documento?: unknown;
}

export function readSandboxDraft(userId: string | null | undefined): SandboxDraft | null {
  const d = readJson<Partial<SandboxDraft>>(sandboxDraftKey(userId));
  if (!d || typeof d !== 'object') return null;
  return {
    entrada: typeof d.entrada === 'string' ? d.entrada : '',
    spec: typeof d.spec === 'string' ? d.spec : '',
    saida: typeof d.saida === 'string' ? d.saida : '',
    nome: typeof d.nome === 'string' ? d.nome : '',
    url: typeof d.url === 'string' ? d.url : '',
    documento: d.documento,
  };
}

/**
 * Guarda o rascunho. Se não couber inteiro, abre mão primeiro do layout completo e depois da última saída
 * (a entrada e a spec são o que a pessoa não consegue reconstruir). Devolve a falha só se nem isso coube.
 */
export function writeSandboxDraft(userId: string | null | undefined, draft: SandboxDraft): StoreResult {
  const key = sandboxDraftKey(userId);
  const empty = !draft.entrada && !draft.spec && !draft.saida && !draft.nome && !draft.url;
  if (empty) {
    removeKey(key);
    return { ok: true };
  }
  const attempts: SandboxDraft[] = [draft, { ...draft, documento: undefined }, { ...draft, documento: undefined, saida: '' }];
  let last: StoreResult = { ok: true };
  for (const attempt of attempts) {
    last = writeJson(key, attempt);
    if (last.ok) return last;
    if (last.reason === 'indisponivel') return last;
  }
  return last;
}

export function clearSandboxDraft(userId: string | null | undefined): void {
  removeKey(sandboxDraftKey(userId));
}

// ───────────────────────────────────────────────────────────────────────── rascunho do Gerador

export interface GeradorDraft {
  entrada: string;
  saida: string;
}

export function readGeradorDraft(userId: string | null | undefined): GeradorDraft | null {
  const d = readJson<Partial<GeradorDraft>>(geradorDraftKey(userId));
  if (!d || typeof d !== 'object') return null;
  return { entrada: typeof d.entrada === 'string' ? d.entrada : '', saida: typeof d.saida === 'string' ? d.saida : '' };
}

export function writeGeradorDraft(userId: string | null | undefined, draft: GeradorDraft): StoreResult {
  const key = geradorDraftKey(userId);
  if (!draft.entrada && !draft.saida) {
    removeKey(key);
    return { ok: true };
  }
  return writeJson(key, draft);
}

/** Ao entrar, o rascunho de visitante vira da conta (se ela ainda não tem um) e a chave de visitante some. */
export function adoptGuestDrafts(userId: string): void {
  if (!userId) return;
  const guest = { sandbox: sandboxDraftKey(null), gerador: geradorDraftKey(null) };
  const mine = { sandbox: sandboxDraftKey(userId), gerador: geradorDraftKey(userId) };
  (['sandbox', 'gerador'] as const).forEach((kind) => {
    const raw = readText(guest[kind]);
    if (raw === null) return;
    if (readText(mine[kind]) === null) writeText(mine[kind], raw);
    removeKey(guest[kind]);
  });
}

// ───────────────────────────────────────────────────────────────────────── passagem entre as telas

export interface GeradorParaSandbox {
  spec: string;
  input: string;
  /** Veio do modo manutenção: a spec é um layout completo e o editor mostra só a transformação. */
  deManutencao: boolean;
}

export function sendToSandbox(payload: GeradorParaSandbox): StoreResult {
  return writeJson(HANDOFF_GERADOR_PARA_SANDBOX, payload, 4_000_000);
}

/** Lê e apaga o que o Gerador deixou (aceita também as chaves antigas jolt_visual_*). */
export function takeFromGerador(): GeradorParaSandbox | null {
  const next = readJson<Partial<GeradorParaSandbox>>(HANDOFF_GERADOR_PARA_SANDBOX);
  const legacySpec = readText(LEGACY_SPEC);
  const legacyInput = readText(LEGACY_INPUT);
  const legacyMaintenance = readText(LEGACY_MAINTENANCE);
  [HANDOFF_GERADOR_PARA_SANDBOX, LEGACY_SPEC, LEGACY_INPUT, LEGACY_MAINTENANCE].forEach(removeKey);
  if (next && typeof next.spec === 'string' && next.spec) {
    return { spec: next.spec, input: typeof next.input === 'string' ? next.input : '', deManutencao: next.deManutencao === true };
  }
  if (legacySpec) return { spec: legacySpec, input: legacyInput ?? '', deManutencao: legacyMaintenance === 'true' };
  return null;
}

export function sendToGerador(input: string): StoreResult {
  return writeText(HANDOFF_SANDBOX_PARA_GERADOR, input, 4_000_000);
}

/** Só lê (não apaga): o Gerador monta duas vezes enquanto a sessão carrega. Quem chama apaga com clearGeradorHandoff. */
export function peekFromSandbox(): string | null {
  return readText(HANDOFF_SANDBOX_PARA_GERADOR) ?? readText(LEGACY_SANDBOX_INPUT);
}

export function clearGeradorHandoff(): void {
  removeKey(HANDOFF_SANDBOX_PARA_GERADOR);
  removeKey(LEGACY_SANDBOX_INPUT);
}
