'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import {
  NO_APPROVAL_ACCESS,
  approveSquadLinkRequest,
  decisionErrorMessage,
  fetchApprovalAccess,
  isSquadRequestsUnavailable,
  listSquadLinkRequests,
  rejectSquadLinkRequest,
  type ApprovalAccess,
  type SquadLinkRequest,
  type SquadRequestStatus,
} from '@/lib/squad-link-requests-api';
import { requesterName } from './squad-requests-utils';

/** Quem aprova nesta squad. Falha de qualquer tipo = sem acesso (a aba some, a tela segue). */
export function useApprovalAccess(squadId: string | undefined) {
  const [result, setResult] = useState<{ squadId: string; access: ApprovalAccess } | null>(null);

  useEffect(() => {
    if (!squadId) return;
    let alive = true;
    void fetchApprovalAccess(squadId).then((access) => {
      if (alive) setResult({ squadId, access });
    });
    return () => {
      alive = false;
    };
  }, [squadId]);

  const loaded = !squadId || result?.squadId === squadId;
  return { loaded, access: squadId && result?.squadId === squadId ? result.access : NO_APPROVAL_ACCESS };
}

export type SquadRequestsState = 'idle' | 'loading' | 'ready' | 'error';

/**
 * Pedidos da squad. Os pendentes são carregados sempre (o contador da aba depende deles); Aprovados e Recusados
 * só quando a pessoa escolhe o filtro. Decidir um pedido relê as duas listas.
 */
export function useSquadLinkRequests(squadId: string | undefined, enabled: boolean) {
  const [filter, setFilter] = useState<SquadRequestStatus>('PENDING');
  const [pending, setPending] = useState<SquadLinkRequest[] | null>(null);
  const [others, setOthers] = useState<SquadLinkRequest[]>([]);
  const [state, setState] = useState<SquadRequestsState>('idle');
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const seq = useRef(0);

  const load = useCallback(async () => {
    if (!squadId || !enabled) return;
    const mine = ++seq.current;
    setState((s) => (s === 'ready' ? s : 'loading'));
    try {
      const [p, o] = await Promise.all([
        listSquadLinkRequests(squadId, 'PENDING'),
        filter === 'PENDING' ? Promise.resolve<SquadLinkRequest[]>([]) : listSquadLinkRequests(squadId, filter),
      ]);
      if (mine !== seq.current) return;
      setPending(p);
      setOthers(o);
      setError(null);
      setState('ready');
    } catch (e) {
      if (mine !== seq.current) return;
      setError(
        isSquadRequestsUnavailable(e)
          ? 'Pedidos por squad ainda não estão disponíveis neste ambiente.'
          : e instanceof Error && e.message
            ? e.message
            : 'Não foi possível carregar os pedidos.',
      );
      setState('error');
    }
  }, [squadId, enabled, filter]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- carga inicial e troca de filtro
    void load();
    return () => {
      seq.current++; // eslint-disable-line react-hooks/exhaustive-deps -- invalida a leitura em andamento
    };
  }, [load]);

  const approve = useCallback(
    async (req: SquadLinkRequest, memberId?: string) => {
      if (!squadId) return;
      setBusyId(req.id);
      try {
        await approveSquadLinkRequest(squadId, req.id, memberId);
        toast('Pedido aprovado', { description: `${requesterName(req)} agora tem acesso à squad.` });
      } catch (e) {
        toast.error('Não foi possível aprovar o pedido', { description: decisionErrorMessage(e) });
      } finally {
        // Mesmo na falha relê: um 409 quer dizer que o pedido já saiu de Pendentes.
        await load();
        setBusyId(null);
      }
    },
    [squadId, load],
  );

  const reject = useCallback(
    async (req: SquadLinkRequest, reason: string) => {
      if (!squadId) return;
      setBusyId(req.id);
      try {
        await rejectSquadLinkRequest(squadId, req.id, reason);
        toast('Pedido recusado', { description: `O pedido de ${requesterName(req)} foi recusado.` });
      } catch (e) {
        toast.error('Não foi possível recusar o pedido', { description: decisionErrorMessage(e) });
      } finally {
        await load();
        setBusyId(null);
      }
    },
    [squadId, load],
  );

  const items = filter === 'PENDING' ? (pending ?? []) : others;
  return { filter, setFilter, items, pendingCount: pending?.length ?? null, state, error, busyId, reload: load, approve, reject };
}
