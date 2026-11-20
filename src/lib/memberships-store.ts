/**
 * Cache compartilhado dos vínculos (`GET /api/me/memberships`), fora do React para o AuthContext poder
 * invalidá-lo (trocar de squad, entrar, sair) sem importar hooks. O hook `useMyMemberships` assina isto.
 *
 * O cache é amarrado a uma "impressão" da sessão (conta + squad ativa + squads acessíveis): quando ela muda o
 * cache deixa de valer e é refeito; `invalidateMyMemberships()` força a releitura. Sem laço: cada impressão é
 * consultada uma vez, mesmo que a resposta seja um erro (aí `data` fica `null` e a sessão manda).
 */

import type { AuthResponse } from '@/lib/auth-client';
import { getMyMemberships, type MyMemberships } from '@/lib/memberships-api';

export interface MembershipsStoreState {
  /** Impressão para a qual `data` vale; `null` = nada conferido (ou invalidado). */
  key: string | null;
  /** Conta de `data`: nunca se mostra o cache de outra pessoa. */
  uid: string | null;
  data: MyMemberships | null;
  /** Há consulta em andamento. */
  loading: boolean;
}

export const EMPTY_MEMBERSHIPS_STATE: MembershipsStoreState = { key: null, uid: null, data: null, loading: false };

let state: MembershipsStoreState = EMPTY_MEMBERSHIPS_STATE;
let version = 0;
let inflight: string | null = null;
let controller: AbortController | null = null;
const listeners = new Set<() => void>();

function set(next: MembershipsStoreState) {
  state = next;
  listeners.forEach((l) => l());
}

export function subscribeMemberships(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export const getMembershipsState = () => state;

type KeySession = Pick<AuthResponse, 'id' | 'activeProjectId' | 'accessibleProjects' | 'legacyOnly'>;

/** Impressão da sessão: muda quando a conta, a squad ativa ou o conjunto de squads acessíveis muda. */
export function membershipsKey(session: KeySession | null | undefined): string | null {
  if (!session) return null;
  const squads = (session.accessibleProjects ?? []).map((p) => `${p.projectId}:${p.roleKey ?? p.roleName ?? ''}`).join(',');
  return `${session.id}|${session.activeProjectId ?? ''}|${squads}|${session.legacyOnly ? 'L' : ''}`;
}

/** Consulta os vínculos desta impressão, uma vez (chamadas repetidas enquanto a primeira voa não duplicam). */
export function loadMyMemberships(key: string, uid: string) {
  const full = `${key}#${version}`;
  if (inflight === full) return;
  controller?.abort();
  const mine = new AbortController();
  controller = mine;
  inflight = full;
  set({ ...state, loading: true });
  void getMyMemberships(mine.signal).then((data) => {
    if (mine.signal.aborted) return;
    inflight = null;
    set({ key, uid, data, loading: false });
  });
}

/** Esquece o cache e refaz a consulta na próxima renderização (trocar de squad, entrar, sair, aprovar vínculo). */
export function invalidateMyMemberships() {
  version += 1;
  controller?.abort();
  controller = null;
  inflight = null;
  // A resposta antiga continua em `data` (para não piscar), mas sem valer para nenhuma impressão.
  set({ ...state, key: null, loading: false });
}

/** Zera tudo (sair da conta ou trocar de conta). */
export function resetMyMemberships() {
  version += 1;
  controller?.abort();
  controller = null;
  inflight = null;
  set(EMPTY_MEMBERSHIPS_STATE);
}
