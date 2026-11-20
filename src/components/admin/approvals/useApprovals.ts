'use client';

import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { adminApi, type PasswordResetRequest } from '@/app/admin/api';
import {
  approveLinkRequest,
  isLinkRequestsUnavailable,
  listLinkRequests,
  rejectLinkRequest,
  type LinkRequest,
} from '@/lib/admin-link-requests-api';
import { resetLinkFrom, type ResetLink } from './approvals-utils';

function messageOf(err: unknown, fallback: string): string {
  return err instanceof Error && err.message ? err.message : fallback;
}

/** Pedidos de redefinição de senha (dados reais do backend) e a ação "Aprovar & Gerar Link". */
export function useResetRequests(onLink: (link: ResetLink) => void) {
  const [requests, setRequests] = useState<PasswordResetRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [approvingId, setApprovingId] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      setRequests((await adminApi.getPasswordResets()) || []);
      setError(null);
    } catch (e) {
      setError(messageOf(e, 'Não foi possível carregar as solicitações.'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- carga inicial da aba
    void reload();
  }, [reload]);

  const approve = useCallback(
    async (req: PasswordResetRequest) => {
      setApprovingId(req.id);
      try {
        const updated = await adminApi.approvePasswordReset(req.id);
        toast('Link de redefinição gerado!', {
          description: `Repasse o link a ${req.userEmail}. A senha atual continua valendo até ele ser usado.`,
        });
        const link = resetLinkFrom(updated, req.userEmail, window.location.origin);
        if (link) onLink(link);
        void reload();
      } catch (e) {
        toast.error('Erro ao aprovar reset', { description: messageOf(e, 'Falha ao aprovar a solicitação.') });
      } finally {
        setApprovingId(null);
      }
    },
    [onLink, reload],
  );

  return { requests, loading, error, approvingId, reload, approve };
}

export type LinksState = 'loading' | 'ready' | 'unavailable' | 'error';

/** Pedidos de vínculo. Enquanto o backend não tiver o endpoint (404/405) o estado é "unavailable", sem erro. */
export function useLinkRequests() {
  const [items, setItems] = useState<LinkRequest[]>([]);
  const [state, setState] = useState<LinksState>('loading');
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setState((s) => (s === 'ready' ? s : 'loading'));
    try {
      setItems(await listLinkRequests());
      setError(null);
      setState('ready');
    } catch (e) {
      if (isLinkRequestsUnavailable(e)) {
        setItems([]);
        setState('unavailable');
      } else {
        setError(messageOf(e, 'Não foi possível carregar os pedidos de vínculo.'));
        setState('error');
      }
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- carga inicial da aba
    void reload();
  }, [reload]);

  const approve = useCallback(
    async (req: LinkRequest) => {
      setBusyId(req.id);
      try {
        await approveLinkRequest(req.id);
        toast('Vínculo aprovado', { description: `Vínculo de ${req.requester.name} com ${req.projectKey} aprovado.` });
        await reload();
      } catch (e) {
        toast.error('Não foi possível aprovar o vínculo', { description: messageOf(e, 'Tente novamente.') });
      } finally {
        setBusyId(null);
      }
    },
    [reload],
  );

  const reject = useCallback(
    async (req: LinkRequest, reason: string) => {
      setBusyId(req.id);
      try {
        await rejectLinkRequest(req.id, reason);
        toast('Pedido recusado', { description: `O pedido de ${req.requester.name} foi recusado.` });
        await reload();
      } catch (e) {
        toast.error('Não foi possível recusar o pedido', { description: messageOf(e, 'Tente novamente.') });
      } finally {
        setBusyId(null);
      }
    },
    [reload],
  );

  return { items, state, error, busyId, reload, approve, reject };
}
