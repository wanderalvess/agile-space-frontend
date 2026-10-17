'use client';

import { useEffect, useMemo, useState } from 'react';
import { UserCheck } from 'lucide-react';
import { ConfirmDialog } from '@/components/room-kit/ConfirmDialog';
import { SelectField } from '@/components/room-kit/SelectField';
import { onboardingService, type OnboardingCandidate } from '@/services/onboardingService';
import type { SquadLinkRequest } from '@/lib/squad-link-requests-api';
import { approveEffect, needsRowPick, requesterName } from './squad-requests-utils';

/**
 * Linhas do roster em que dá para ligar a conta: sem conta ainda e, se a pessoa não aprova liderança,
 * sem as linhas de liderança (o servidor também recusaria com 403).
 */
export function pickableRows(rows: OnboardingCandidate[], canApproveLeadership: boolean): OnboardingCandidate[] {
  return rows.filter((m) => !m.claimed && (canApproveLeadership || !m.leadership));
}

type Loaded = { key: string; rows: OnboardingCandidate[] | null };

/** Roster da squad do pedido, lido só quando o pedido pede a escolha de uma linha. `rows: null` = falhou. */
function useRosterRows(projectKey: string | null) {
  const [loaded, setLoaded] = useState<Loaded | null>(null);

  useEffect(() => {
    if (!projectKey) return;
    let alive = true;
    onboardingService
      .roster(projectKey)
      .then((r) => alive && setLoaded({ key: projectKey, rows: r.members }))
      .catch(() => alive && setLoaded({ key: projectKey, rows: null }));
    return () => {
      alive = false;
    };
  }, [projectKey]);

  const current = projectKey && loaded?.key === projectKey ? loaded : null;
  return { loading: !!projectKey && !current, rows: current?.rows ?? null, failed: !!current && current.rows === null };
}

/**
 * Confirmação de "Aprovar". Pedido antigo, sem linha e sem papel, pede antes uma linha do time (“Ligar a qual
 * pessoa do time?”) e envia o `memberId` escolhido. Nos demais pedidos é só a confirmação.
 */
export function ApproveRequestDialog({
  request,
  canApproveLeadership,
  onCancel,
  onConfirm,
}: {
  request: SquadLinkRequest | null;
  canApproveLeadership: boolean;
  onCancel: () => void;
  onConfirm: (request: SquadLinkRequest, memberId?: string) => void;
}) {
  const pick = !!request && needsRowPick(request);
  const [chosen, setChosen] = useState<{ requestId: string; memberId: string } | null>(null);
  const { loading, rows, failed } = useRosterRows(pick ? request.projectKey : null);

  const options = useMemo(
    () =>
      pickableRows(rows ?? [], canApproveLeadership).map((m) => ({
        value: m.memberId,
        label: m.roleName ? `${m.displayName} · ${m.roleName}` : m.displayName,
      })),
    [rows, canApproveLeadership],
  );

  const memberId = request && chosen?.requestId === request.id ? chosen.memberId : '';
  const emptyText = loading
    ? 'Carregando o time…'
    : failed
      ? 'Não foi possível carregar o time. Feche e tente de novo.'
      : options.length === 0
        ? 'Todas as linhas do time já têm conta. Recuse o pedido ou peça um convite.'
        : null;

  return (
    <ConfirmDialog
      open={!!request}
      onOpenChange={(open) => {
        if (!open) onCancel();
      }}
      tone="brand"
      icon={UserCheck}
      title={`Aprovar o pedido de ${request ? requesterName(request) : ''}?`}
      description={request ? approveEffect(request) : undefined}
      confirmLabel="Aprovar pedido"
      confirmDisabled={pick && !memberId}
      onConfirm={() => {
        if (request) onConfirm(request, pick ? memberId : undefined);
      }}
    >
      {pick && request && (
        <div className="mt-1 flex flex-col gap-1.5">
          <label htmlFor="approve-member" className="text-[13px] font-semibold text-foreground">
            Ligar a qual pessoa do time?
          </label>
          {emptyText ? (
            <p role={failed ? 'alert' : 'status'} className="text-[13px] text-muted-foreground">
              {emptyText}
            </p>
          ) : (
            <SelectField
              id="approve-member"
              value={memberId}
              onChange={(value) => setChosen({ requestId: request.id, memberId: value })}
              options={options}
              placeholder="Escolha uma pessoa"
              className="h-10 text-sm"
            />
          )}
        </div>
      )}
    </ConfirmDialog>
  );
}
