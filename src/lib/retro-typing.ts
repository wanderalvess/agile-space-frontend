/**
 * "Escrevendo…" da Retro: lógica pura. O servidor repassa `TYPING` (efêmero, só em memória) a quem abriu o socket
 * com `typing=1`; o cliente mostra por até 5 s e some sozinho (não existe evento de "parou"). Sem backend novo
 * nada chega e nada aparece. Contrato: docs/redesign/ceremony-radar-retro.md.
 */

export const TYPING_SEND_INTERVAL_MS = 2000;
export const TYPING_DISPLAY_MS = 5000;

export type TypingScope = 'card' | 'chat';

/** Mensagem que o cliente envia (o `userId` nunca vai no corpo: o servidor usa o do login). */
export type TypingMessage =
  | { type: 'TYPING'; scope: 'card'; columnKey?: string }
  | { type: 'TYPING'; scope: 'chat'; channelId: string };

/** Alvo do "escrevendo…": uma coluna (cartão) ou um canal (chat). */
export type TypingTarget = { scope: 'card'; columnKey: string } | { scope: 'chat'; channelId: string };

export function typingMessage(target: TypingTarget): TypingMessage {
  return target.scope === 'chat'
    ? { type: 'TYPING', scope: 'chat', channelId: target.channelId }
    : { type: 'TYPING', scope: 'card', columnKey: target.columnKey };
}

/**
 * Limita o envio a um evento a cada `intervalMs` por sessão (o servidor descarta o excedente em silêncio, então
 * mandar mais só gasta rede). Ponta inicial: o primeiro toque na tecla envia na hora. `send` devolve `false` quando
 * não há conexão aberta: nesse caso o envio não conta e o próximo toque tenta de novo.
 */
export function createTypingThrottle(send: (message: TypingMessage) => boolean, options: { intervalMs?: number; now?: () => number } = {}) {
  const intervalMs = options.intervalMs ?? TYPING_SEND_INTERVAL_MS;
  const now = options.now ?? (() => Date.now());
  let last = Number.NEGATIVE_INFINITY;
  return {
    notify(target: TypingTarget): boolean {
      const t = now();
      if (t - last < intervalMs) return false;
      const sent = send(typingMessage(target));
      if (sent) last = t;
      return sent;
    },
    reset() {
      last = Number.NEGATIVE_INFINITY;
    },
  };
}

// ───────────────────────── Receber ─────────────────────────

export interface TypingEntry {
  /** Chave única: escopo, alvo e pessoa (ou "anon"). */
  key: string;
  scope: TypingScope;
  /** `columnKey` (cartão) ou `channelId` (chat). */
  target: string;
  /** `null` = autoria oculta ("Alguém"). */
  userId: string | null;
  expiresAt: number;
}

interface TypingPayload {
  userId?: string | null;
  anonymous?: boolean;
  scope?: string;
  columnKey?: string | null;
  channelId?: string | null;
  expiresInMs?: number;
}

/** Chave do alvo para casar evento e tela (uma coluna e um canal nunca colidem). */
export function targetKey(scope: TypingScope, target: string): string {
  return `${scope}:${target}`;
}

/**
 * Aplica um `TYPING` recebido. Ignora o que for malformado, de escopo desconhecido e o do próprio usuário (o servidor
 * já exclui o remetente; é só cinto de segurança). A validade conta do relógio local (`expiresInMs`, no máximo 5 s):
 * não depende do relógio do servidor.
 */
export function applyTyping(entries: readonly TypingEntry[], payload: unknown, now: number, selfId?: string): TypingEntry[] {
  const p = payload as TypingPayload | null | undefined;
  if (!p || typeof p !== 'object') return pruneTyping(entries, now);
  const scope: TypingScope | null = p.scope === 'chat' ? 'chat' : p.scope === 'card' || p.scope === undefined ? 'card' : null;
  if (!scope) return pruneTyping(entries, now);
  const target = scope === 'chat' ? p.channelId : p.columnKey ?? '';
  if (typeof target !== 'string' || (scope === 'chat' && !target)) return pruneTyping(entries, now);
  const userId = p.anonymous === true || typeof p.userId !== 'string' || !p.userId ? null : p.userId;
  if (userId && selfId && userId === selfId) return pruneTyping(entries, now);
  const ttl = typeof p.expiresInMs === 'number' && p.expiresInMs > 0 ? Math.min(p.expiresInMs, TYPING_DISPLAY_MS) : TYPING_DISPLAY_MS;
  const key = `${targetKey(scope, target)}|${userId ?? 'anon'}`;
  const next: TypingEntry = { key, scope, target, userId, expiresAt: now + ttl };
  return [...pruneTyping(entries, now).filter((e) => e.key !== key), next];
}

/** Tira o que já venceu. */
export function pruneTyping(entries: readonly TypingEntry[], now: number): TypingEntry[] {
  return entries.filter((e) => e.expiresAt > now);
}

/** Quando o próximo item vence (para agendar a limpeza); `null` sem itens. */
export function nextTypingExpiry(entries: readonly TypingEntry[]): number | null {
  return entries.length === 0 ? null : Math.min(...entries.map((e) => e.expiresAt));
}

export interface Typers {
  /** Nomes de quem está escrevendo (autoria revelada). */
  names: string[];
  /** Há alguém com a autoria oculta. */
  anonymous: boolean;
}

/**
 * Quem está escrevendo neste alvo agora. Com a autoria oculta (`authorsRevealed` falso) nenhum nome sai, mesmo que
 * o evento traga um id: o "escrevendo…" não pode revelar de quem são os cartões que depois aparecem.
 */
export function typersAt(
  entries: readonly TypingEntry[],
  scope: TypingScope,
  target: string,
  now: number,
  nameOf: (userId: string) => string | undefined,
  options: { authorsRevealed?: boolean } = {}
): Typers {
  const revealNames = scope === 'chat' || options.authorsRevealed === true;
  const names: string[] = [];
  let anonymous = false;
  for (const e of entries) {
    if (e.scope !== scope || e.target !== target || e.expiresAt <= now) continue;
    const name = e.userId && revealNames ? nameOf(e.userId) : undefined;
    if (name) {
      if (!names.includes(name)) names.push(name);
    } else {
      anonymous = true;
    }
  }
  return { names: names.sort((a, b) => a.localeCompare(b, 'pt-BR')), anonymous };
}

/** "Fulana está escrevendo…", "Fulana e Beltrano estão escrevendo…", "Alguém está escrevendo…". `null` sem ninguém. */
export function typingLabel({ names, anonymous }: Typers): string | null {
  if (names.length === 0) return anonymous ? 'Alguém está escrevendo…' : null;
  if (names.length === 1) return `${names[0]} está escrevendo…`;
  if (names.length === 2) return `${names[0]} e ${names[1]} estão escrevendo…`;
  return `${names[0]}, ${names[1]} e mais ${names.length - 2} estão escrevendo…`;
}
