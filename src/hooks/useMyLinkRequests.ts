'use client';

import { useCallback, useEffect, useState } from 'react';
import { listMyLinkRequests, type LinkRequest } from '@/lib/link-requests-api';

/**
 * Pedidos de vínculo da própria pessoa. Falha de rede ou servidor sem o recurso não incomodam:
 * a lista só fica vazia e o cartão "Meus pedidos" não aparece.
 */
export function useMyLinkRequests() {
  const [requests, setRequests] = useState<LinkRequest[]>([]);

  const reload = useCallback(async () => {
    try {
      setRequests(await listMyLinkRequests());
    } catch {
      setRequests([]);
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  return { requests, reload };
}
