"use client";

import { useMemo, useState } from 'react';
import { Crown, UserX } from 'lucide-react';
import type { Participant, Vote, Role } from '@/lib/types';
import { canParticipantVote, getParticipantCategory, observerHintOf } from '@/lib/poker-utils';
import { SEM_CARGO } from '@/lib/cargo';
import { ConfirmDialog, PresenceList, type PresenceItem, type PresenceStatus } from '@/components/room-kit';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

interface ParticipantListProps {
  participants: Participant[];
  votes: Vote[];
  currentUserId: string;
  isFacilitator: boolean;
  onRemoveParticipant: (id: string) => void;
  onUpdateParticipantRole: (id: string, newRole: Role) => void;
  onClaimFacilitator?: () => void;
  onlineIds?: Set<string>;
  /** Cargos que votam na sala. Quem não vota não fica "pensando": aparece como observando. */
  votingCargos?: readonly string[];
}

const GROUP_ORDER = [
  { id: 'Developer', label: 'DEV' },
  { id: 'QA', label: 'QA' },
  { id: 'UX', label: 'UX' },
  { id: 'Designer', label: 'Designer' },
  { id: 'Management', label: 'Gestão' },
] as const;

/** Texto ao lado do nome: o cargo por extenso (o da administração), ou "Sem cargo". */
const cargoLabelOf = (globalRole?: string | null): string => globalRole?.trim() || SEM_CARGO;

export function ParticipantList({
  participants,
  currentUserId,
  isFacilitator,
  onRemoveParticipant,
  onClaimFacilitator,
  votes,
  onlineIds,
  votingCargos,
}: ParticipantListProps) {
  const [toRemove, setToRemove] = useState<Participant | null>(null);
  const [claimOpen, setClaimOpen] = useState(false);
  // O servidor só deixa assumir quando o organizador está ausente (sem sinal recente); com ele online o botão nem aparece.
  const hostOnline = useMemo(
    () => participants.some((p) => p.isFacilitator && p.id !== currentUserId && (onlineIds ? onlineIds.has(p.id) : true)),
    [participants, currentUserId, onlineIds]
  );
  const votedIds = useMemo(() => new Set(votes.map((v) => v.participantId)), [votes]);

  const items = useMemo<PresenceItem[]>(() => {
    const live = participants.map((p): PresenceItem => {
      const category = getParticipantCategory(p);
      const online = onlineIds ? onlineIds.has(p.id) : true;
      let status: PresenceStatus = 'idle';
      let statusLabel: string | undefined;
      if (p.role === 'spectator') status = 'spectator';
      else if (!canParticipantVote(p, votingCargos)) { status = 'observer'; statusLabel = `Observando · ${observerHintOf(p)}`; }
      else if (votedIds.has(p.id)) status = 'voted';
      else status = online ? 'thinking' : 'away';
      return {
        id: p.id,
        name: p.nickname,
        roleLabel: cargoLabelOf(p.globalRole),
        category,
        online,
        status,
        statusLabel,
        isYou: p.id === currentUserId,
        isHost: !!p.isFacilitator,
      };
    });
    // Votos de quem saiu da sala continuam contando: aparecem esmaecidos.
    const ghosts = votes
      .filter((v) => !participants.some((p) => p.id === v.participantId))
      .map((v): PresenceItem => {
        const category = v.participantRole
          ? getParticipantCategory({ role: v.participantRole, globalRole: v.participantGlobalRole })
          : null;
        return {
          id: `ghost-${v.participantId}`,
          name: v.participantNickname || 'Participante',
          roleLabel: cargoLabelOf(v.participantGlobalRole),
          category,
          online: false,
          status: 'voted',
          ghost: true,
        };
      });
    return [...live, ...ghosts];
  }, [participants, votes, votedIds, onlineIds, currentUserId, votingCargos]);

  const renderActions = (item: PresenceItem) => {
    if (item.ghost) return null;
    const person = participants.find((p) => p.id === item.id);
    if (!person) return null;
    return (
      <TooltipProvider>
        {!isFacilitator && !hostOnline && item.isYou && onClaimFacilitator && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon" aria-label="Assumir o controle da sala" onClick={() => setClaimOpen(true)} className="h-7 w-7 shrink-0 text-amber-600 dark:text-amber-300">
                <Crown className="h-3.5 w-3.5" strokeWidth={1.5} />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Assumir controle</TooltipContent>
          </Tooltip>
        )}
        {isFacilitator && !item.isYou && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                aria-label={`Remover ${item.name} da sala`}
                onClick={() => setToRemove(person)}
                className="h-7 w-7 shrink-0 text-muted-foreground opacity-0 hover:text-red-600 focus-visible:opacity-100 group-hover:opacity-100 dark:hover:text-red-300"
              >
                <UserX className="h-3.5 w-3.5" strokeWidth={1.5} />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Remover da sala</TooltipContent>
          </Tooltip>
        )}
      </TooltipProvider>
    );
  };

  return (
    <>
      <PresenceList items={items} groupOrder={GROUP_ORDER} renderActions={renderActions} />

      <ConfirmDialog
        open={!!toRemove}
        onOpenChange={(open) => { if (!open) setToRemove(null); }}
        tone="danger"
        icon={UserX}
        title="Remover da sala?"
        description={<><strong className="text-foreground">{toRemove?.nickname}</strong> perde o acesso a esta sala na hora.</>}
        cancelLabel="Manter"
        confirmLabel="Remover"
        onConfirm={() => { if (toRemove) onRemoveParticipant(toRemove.id); setToRemove(null); }}
      />

      <ConfirmDialog
        open={claimOpen}
        onOpenChange={setClaimOpen}
        tone="warn"
        icon={Crown}
        title="Assumir o controle da sala?"
        description="Você vira o organizador desta sessão e os controles do atual deixam de valer. Use só se o organizador original estiver ausente ou desconectado."
        confirmLabel="Assumir controle"
        onConfirm={() => onClaimFacilitator?.()}
      />
    </>
  );
}
