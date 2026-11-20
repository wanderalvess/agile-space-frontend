'use client';

import { useCallback, useEffect, useSyncExternalStore } from 'react';
import { compareTagsDesc } from '@/app/changelog/merge';
import { changelogApi } from '@/services/changelogApi';
import { getAuthToken, tokenUserId } from '@/lib/auth-client';
import packageInfo from '../../package.json';

/**
 * Aviso de nova versão. A última versão que a pessoa viu fica no navegador, por usuário (`changelog_seen_{userId}`).
 * A versão mais recente é a maior entre a do próprio build (package.json) e a que o servidor publicou
 * (`GET /api/changelog/latest`), consultada no máximo uma vez por sessão do navegador.
 * Nada aqui pode quebrar a página: localStorage/sessionStorage podem falhar (modo privado, cota, bloqueio).
 */

export const seenKey = (userId: string) => `changelog_seen_${userId}`;
export const seenAtKey = (userId: string) => `changelog_seen_at_${userId}`;
export const noticeKey = (userId: string) => `changelog_notice_${userId}`;
export const LATEST_CHECK_KEY = 'changelog_latest_checked';

/** Tag do build que está rodando, com o "v" ("v4.24.0"). */
export const RUNNING_TAG = `v${packageInfo.version}`;

function safeGet(store: 'local' | 'session', key: string): string | null {
  try {
    const s = store === 'local' ? window.localStorage : window.sessionStorage;
    return s.getItem(key);
  } catch {
    return null;
  }
}

function safeSet(store: 'local' | 'session', key: string, value: string): boolean {
  try {
    const s = store === 'local' ? window.localStorage : window.sessionStorage;
    s.setItem(key, value);
    return true;
  } catch {
    return false;
  }
}

/** Id da conta lido do token do navegador; sem sessão (ou sem acesso ao armazenamento) devolve null. */
function currentUserId(): string | null {
  try {
    return tokenUserId(getAuthToken());
  } catch {
    return null;
  }
}

function safeRemove(key: string) {
  try {
    window.localStorage.removeItem(key);
  } catch {
    /* sem armazenamento: nada a apagar */
  }
}

export interface VersionDecision {
  /** Há versão nova que a pessoa ainda não viu. */
  unread: boolean;
  /** Deve aparecer o aviso curto (uma vez por versão). */
  showNotice: boolean;
  /** Primeira visita deste usuário neste navegador: só registra a versão atual, sem avisar. */
  firstVisit: boolean;
}

/**
 * Regra do aviso:
 *  - sem versão conhecida: nada;
 *  - nunca viu nada (primeira visita): registra a atual, não avisa;
 *  - a mais recente é igual (ou mais velha) que a vista: em dia;
 *  - a mais recente é maior que a vista: ponto no rodapé e, se ainda não avisamos dessa versão, o aviso.
 */
export function decideNewVersion(input: { latest: string | null; seen: string | null; noticed: string | null }): VersionDecision {
  const { latest, seen, noticed } = input;
  if (!latest) return { unread: false, showNotice: false, firstVisit: false };
  if (!seen) return { unread: false, showNotice: false, firstVisit: true };
  const newer = compareTagsDesc(latest, seen) < 0;
  return { unread: newer, showNotice: newer && noticed !== latest, firstVisit: false };
}

/** A maior das duas tags ("v4.25.0" vence "v4.24.0"); tag fora do padrão perde. */
export function maxTag(a: string | null, b: string | null): string | null {
  if (!a) return b;
  if (!b) return a;
  return compareTagsDesc(a, b) <= 0 ? a : b;
}

const normalizeTag = (tag: string) => (tag.trim().startsWith('v') ? tag.trim() : `v${tag.trim()}`);

export interface NewVersionSnapshot {
  userId: string | null;
  /** Versão mais recente conhecida (build ou servidor). */
  latest: string | null;
  /** Última versão vista por esta pessoa. */
  seen: string | null;
  /** Quando ela viu (ISO), para "Você esteve aqui em ...". */
  seenAt: string | null;
  unread: boolean;
  showNotice: boolean;
  /** Versão do servidor, se for mais nova que a do build: pede para recarregar. */
  serverAhead: string | null;
}

const EMPTY: NewVersionSnapshot = { userId: null, latest: null, seen: null, seenAt: null, unread: false, showNotice: false, serverAhead: null };

let snapshot: NewVersionSnapshot = EMPTY;
const listeners = new Set<() => void>();
/** Versões já avisadas nesta aba (vale mesmo se o localStorage não gravar). */
const noticedInMemory = new Map<string, string>();
let serverLatest: string | null = null;
let checking: Promise<void> | null = null;

function publish(next: NewVersionSnapshot) {
  snapshot = next;
  listeners.forEach((l) => l());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function compute(userId: string): NewVersionSnapshot {
  const latest = maxTag(RUNNING_TAG, serverLatest);
  const seen = safeGet('local', seenKey(userId));
  const noticed = noticedInMemory.get(userId) ?? safeGet('local', noticeKey(userId));
  const decision = decideNewVersion({ latest, seen, noticed });
  if (decision.firstVisit && latest) {
    // Primeira visita: o que existe hoje conta como visto, para só avisar das próximas.
    safeSet('local', seenKey(userId), latest);
    safeSet('local', seenAtKey(userId), new Date().toISOString());
    return { userId, latest, seen: latest, seenAt: new Date().toISOString(), unread: false, showNotice: false, serverAhead: serverAheadOf() };
  }
  return { userId, latest, seen, seenAt: safeGet('local', seenAtKey(userId)), unread: decision.unread, showNotice: decision.showNotice, serverAhead: serverAheadOf() };
}

/** Versão publicada no servidor que o build em uso ainda não tem: a página pede para recarregar. */
function serverAheadOf(): string | null {
  return serverLatest && compareTagsDesc(serverLatest, RUNNING_TAG) < 0 ? serverLatest : null;
}

/** Consulta o servidor no máximo uma vez por sessão do navegador (a resposta fica em sessionStorage). */
async function fetchServerLatest(): Promise<string | null> {
  const cached = safeGet('session', LATEST_CHECK_KEY);
  if (cached !== null) return cached === '' ? null : cached;
  let tag: string | null = null;
  try {
    const latest = await changelogApi.getLatestRelease();
    tag = latest?.tag ? normalizeTag(latest.tag) : null;
  } catch {
    tag = null;
  }
  safeSet('session', LATEST_CHECK_KEY, tag ?? '');
  return tag;
}

/** Lê a sessão do navegador e atualiza o estado. Visitante sem sessão: tudo apagado, nada de consulta. */
export function refreshNewVersion(): Promise<void> {
  if (typeof window === 'undefined') return Promise.resolve();
  const userId = currentUserId();
  if (!userId) {
    if (snapshot !== EMPTY) publish(EMPTY);
    return Promise.resolve();
  }
  // Resposta já guardada nesta sessão do navegador: usa sem nova consulta.
  const cached = safeGet('session', LATEST_CHECK_KEY);
  if (cached !== null) {
    serverLatest = cached === '' ? null : cached;
    publish(compute(userId));
    return Promise.resolve();
  }
  // Ainda sem resposta: espera o servidor antes de decidir (senão a primeira visita registraria só a versão do
  // build e o aviso saltaria logo em seguida).
  if (!checking) {
    checking = fetchServerLatest()
      .then((tag) => {
        serverLatest = tag;
        const id = currentUserId();
        publish(id ? compute(id) : EMPTY);
      })
      .finally(() => {
        checking = null;
      });
  }
  return checking;
}

/** Marca como lido até `tag` (padrão: a mais recente). Devolve o valor anterior, para o "Desfazer". */
export function markVersionsRead(tag?: string | null): { seen: string | null; seenAt: string | null } | null {
  const userId = snapshot.userId ?? currentUserId();
  if (!userId) return null;
  const target = tag ?? snapshot.latest ?? RUNNING_TAG;
  const previous = { seen: safeGet('local', seenKey(userId)), seenAt: safeGet('local', seenAtKey(userId)) };
  safeSet('local', seenKey(userId), target);
  safeSet('local', seenAtKey(userId), new Date().toISOString());
  noticedInMemory.set(userId, target);
  safeSet('local', noticeKey(userId), target);
  publish({ ...compute(userId), seen: target, seenAt: new Date().toISOString(), unread: false, showNotice: false });
  return previous;
}

/** Desfaz um "Marcar tudo como lido": volta ao que estava gravado antes. */
export function restoreVersionsSeen(previous: { seen: string | null; seenAt: string | null }) {
  const userId = snapshot.userId ?? currentUserId();
  if (!userId) return;
  if (previous.seen) safeSet('local', seenKey(userId), previous.seen);
  else safeRemove(seenKey(userId));
  if (previous.seenAt) safeSet('local', seenAtKey(userId), previous.seenAt);
  else safeRemove(seenAtKey(userId));
  noticedInMemory.delete(userId);
  safeRemove(noticeKey(userId));
  publish(compute(userId));
}

/** "Agora não": some o aviso desta versão; o ponto no rodapé continua até a pessoa ler. */
export function dismissVersionNotice() {
  const userId = snapshot.userId;
  const latest = snapshot.latest;
  if (!userId || !latest) return;
  noticedInMemory.set(userId, latest);
  safeSet('local', noticeKey(userId), latest);
  publish({ ...snapshot, showNotice: false });
}

/** Só para testes: volta o módulo ao estado inicial. */
export function resetNewVersionForTests() {
  snapshot = EMPTY;
  serverLatest = null;
  checking = null;
  noticedInMemory.clear();
  listeners.clear();
}

/** Estado compartilhado (rodapé, aviso e página Versões usam o mesmo). Dispara a checagem uma vez por montagem. */
export function useNewVersion() {
  const snap = useSyncExternalStore(subscribe, () => snapshot, () => EMPTY);
  useEffect(() => {
    void refreshNewVersion();
  }, []);
  const markRead = useCallback((tag?: string | null) => markVersionsRead(tag), []);
  const dismiss = useCallback(() => dismissVersionNotice(), []);
  return { ...snap, markRead, dismiss };
}
