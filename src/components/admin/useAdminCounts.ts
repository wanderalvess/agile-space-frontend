'use client';

import { useCallback, useEffect, useState } from 'react';
import { adminApi } from '@/app/admin/api';
import { supportApi } from '@/app/support/api';
import { listLinkRequests, isLinkRequestsUnavailable } from '@/lib/admin-link-requests-api';
import { EMPTY_COUNTS, type AdminCounts } from './admin-counts';

/**
 * Contadores da barra lateral (Aprovações, Chamados abertos). Recarrega quando `refreshKey` muda (a aba
 * aberta) e quando a aba Chamados avisa o número novo. Falha de um contador não derruba os outros.
 */
export function useAdminCounts(refreshKey: string, enabled = true) {
  const [counts, setCounts] = useState<AdminCounts>(EMPTY_COUNTS);

  const reload = useCallback(async () => {
    const [resets, links, tickets] = await Promise.allSettled([
      adminApi.getPasswordResets(),
      listLinkRequests('PENDING'),
      supportApi.listAll('OPEN'),
    ]);
    setCounts({
      resets: resets.status === 'fulfilled' ? (resets.value || []).filter((r) => r.status === 'PENDING').length : null,
      links:
        links.status === 'fulfilled'
          ? links.value.length
          : isLinkRequestsUnavailable(links.reason)
            ? 0
            : null,
      ticketsOpen: tickets.status === 'fulfilled' ? tickets.value.length : null,
    });
  }, []);

  useEffect(() => {
    if (!enabled) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- carga dos contadores a cada troca de aba
    void reload();
  }, [enabled, refreshKey, reload]);

  const setTicketsOpen = useCallback((n: number) => setCounts((c) => ({ ...c, ticketsOpen: n })), []);

  return { counts, reload, setTicketsOpen };
}
