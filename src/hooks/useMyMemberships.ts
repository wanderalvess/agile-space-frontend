'use client';

import { useCallback, useEffect, useSyncExternalStore } from 'react';
import { useAuth } from '@/context/AuthContext';
import {
  EMPTY_MEMBERSHIPS_STATE,
  getMembershipsState,
  invalidateMyMemberships,
  loadMyMemberships,
  membershipsKey,
  resetMyMemberships,
  subscribeMemberships,
} from '@/lib/memberships-store';
import type { MyMemberships } from '@/lib/memberships-api';

export interface MyMembershipsResult {
  /**
   * Vínculos conferidos para a sessão atual; `null` quando o endpoint não existe/falhou ou a consulta ainda
   * não voltou para esta sessão (`settled` diferencia os dois casos).
   */
  memberships: MyMemberships | null;
  /** A consulta desta sessão terminou (com dados ou com `null` por falha/404). */
  settled: boolean;
  /** Última resposta da MESMA conta, mesmo de uma sessão anterior (não pisca a lista ao trocar de squad). */
  stale: MyMemberships | null;
  /** Força a releitura (ex.: depois de aprovar um pedido de vínculo). */
  refresh: () => void;
}

const getServerSnapshot = () => EMPTY_MEMBERSHIPS_STATE;

/** Vínculos da pessoa logada, com cache compartilhado. Tolera backend sem o endpoint (devolve `memberships: null`). */
export function useMyMemberships(): MyMembershipsResult {
  const { session } = useAuth();
  const snap = useSyncExternalStore(subscribeMemberships, getMembershipsState, getServerSnapshot);
  const key = membershipsKey(session);
  const uid = session?.id ?? null;

  useEffect(() => {
    if (!key || !uid) {
      if (getMembershipsState() !== EMPTY_MEMBERSHIPS_STATE) resetMyMemberships();
      return;
    }
    // Outra conta no mesmo navegador: nada da anterior sobrevive.
    const current = getMembershipsState();
    if (current.uid && current.uid !== uid) resetMyMemberships();
    if (getMembershipsState().key !== key) loadMyMemberships(key, uid);
  }, [key, uid, snap.key]);

  const refresh = useCallback(() => invalidateMyMemberships(), []);

  const settled = !!key && snap.key === key;
  const sameAccount = !!uid && snap.uid === uid;
  return { memberships: settled ? snap.data : null, settled, stale: sameAccount ? snap.data : null, refresh };
}
