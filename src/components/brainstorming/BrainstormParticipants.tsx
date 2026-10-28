'use client';

import { canonicalCargo } from '@/lib/cargo';
import React, { useMemo } from 'react';
import { ArrowRightLeft, Hand, UserX } from 'lucide-react';
import { IconButton, ModalButton, PresenceList, type PresenceItem } from '@/components/room-kit';
import type { Participant } from '@/lib/types';
import { presenceOnlineOf } from '@/lib/room-presence';
import { participantName, type ClaimState } from './brainstorm-ceremony';
import { firstName } from './brainstorm-room-logic';

export function participantRoleLabel(p: Pick<Participant, 'globalRole' | 'role'>): string {
  return (canonicalCargo(p.globalRole) || p.role || 'Participante') as string;
}

/**
 * Quem entrou na sala, no formato da lista de presença do kit. `onlineIds` vem do servidor (quem tem a sala aberta);
 * sem ele (`null`, backend antigo) a lista fica sem ponto de online e sem "ausente".
 */
export function toPresenceItems(
  participants: readonly Participant[],
  facilitatorId: string,
  currentUserId: string,
  onlineIds: ReadonlySet<string> | null = null,
): PresenceItem[] {
  return participants.map((p) => {
    const host = p.id === facilitatorId;
    return {
      id: p.id,
      name: participantName(p),
      roleLabel: host ? `${participantRoleLabel(p)} · facilitador` : participantRoleLabel(p),
      category: (canonicalCargo(p.globalRole) || p.role) as string,
      online: presenceOnlineOf(onlineIds, p.id),
      isYou: p.id === currentUserId,
      isHost: host,
    };
  });
}

/** Lista do painel: o facilitador no topo e os demais abaixo; o facilitador remove pessoas (com confirmação da sala). */
export function BrainstormParticipants({
  participants,
  facilitatorId,
  facilitatorName = '',
  currentUserId,
  isFacilitator,
  onRequestRemove,
  onlineIds = null,
  claim,
  claiming = false,
  onClaim,
  canTransfer = false,
  onTransfer,
}: {
  participants: readonly Participant[];
  onlineIds?: ReadonlySet<string> | null;
  /** O facilitador atual (`facilitatorId`, ou o criador em mural antigo). */
  facilitatorId: string;
  /** Nome do facilitador (vazio quando nenhum é conhecido). */
  facilitatorName?: string;
  currentUserId: string;
  isFacilitator: boolean;
  onRequestRemove: (participant: Participant) => void;
  /** "Assumir a facilitação" (backend novo): visível/habilitado conforme `claimState`. */
  claim?: ClaimState;
  claiming?: boolean;
  onClaim?: () => void;
  canTransfer?: boolean;
  onTransfer?: () => void;
}) {
  const items = useMemo(() => toPresenceItems(participants, facilitatorId, currentUserId, onlineIds), [participants, facilitatorId, currentUserId, onlineIds]);
  const host = items.filter((i) => i.isHost);
  const others = items.filter((i) => !i.isHost);

  const byId = new Map(participants.map((p) => [p.id, p]));
  const actions = (item: PresenceItem) => {
    const person = byId.get(item.id);
    if (!isFacilitator || !person || item.isYou || item.isHost) return null;
    return (
      <IconButton
        size="sm"
        label={`Remover ${firstName(item.name) || item.name} da sessão`}
        icon={UserX}
        onClick={() => onRequestRemove(person)}
        className="border-transparent text-muted-foreground hover:text-red-700 dark:hover:text-red-300 max-sm:h-11 max-sm:w-11"
      />
    );
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto pb-3">
      {host.length > 0 && (
        <section aria-label="Facilitação" className="flex flex-col">
          <h3 className="m-0 px-4 pb-1 pt-1 text-xs font-semibold text-muted-foreground">
            Facilitação
            {facilitatorName && <span className="font-semibold text-foreground">: {facilitatorName}</span>}
          </h3>
          <PresenceList items={host} renderActions={actions} className="flex-none overflow-visible pb-1" />
        </section>
      )}
      {((claim?.visible && onClaim) || (canTransfer && onTransfer)) && (
        <div className="flex flex-col gap-2 px-4 pb-2">
          {claim?.visible && onClaim && (
            <ModalButton className="h-9 w-full gap-2" onClick={onClaim} disabled={!claim.enabled || claiming}>
              <Hand className="h-4 w-4" strokeWidth={1.5} aria-hidden="true" />
              Assumir a facilitação
              {!claim.enabled && claim.waitSeconds > 0 && <span className="text-xs font-normal text-muted-foreground">em {claim.waitSeconds} s</span>}
            </ModalButton>
          )}
          {canTransfer && onTransfer && (
            <ModalButton className="h-9 w-full gap-2" onClick={onTransfer}>
              <ArrowRightLeft className="h-4 w-4" strokeWidth={1.5} aria-hidden="true" />
              Passar a facilitação…
            </ModalButton>
          )}
        </div>
      )}
      <section aria-label="Participantes da sessão" className="flex flex-col">
        <h3 className="m-0 flex items-center gap-2 px-4 pb-1 pt-1 text-xs font-semibold text-muted-foreground">
          Participantes <span className="tabular-nums text-muted-foreground/70">{others.length}</span>
        </h3>
        <PresenceList items={others} renderActions={actions} emptyLabel="Mais ninguém entrou ainda" className="flex-none overflow-visible pb-1" />
      </section>
    </div>
  );
}
