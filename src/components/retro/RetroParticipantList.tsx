'use client';

import { useMemo, useState } from 'react';
import { Crown, UserX } from 'lucide-react';
import { ConfirmDialog, PresenceList, type PresenceItem } from '@/components/room-kit';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { TEAM_ROLE_DESCRIPTIONS, type RetroParticipant } from '@/lib/types';
import { presenceOnlineOf } from '@/lib/room-presence';
import { presenceCategoryOf } from './retro-room-logic';

interface RetroParticipantListProps {
  participants: RetroParticipant[];
  /** Contas com a sala aberta agora; `null`/ausente = sem dado (sem ponto de online). */
  onlineIds?: ReadonlySet<string> | null;
  currentUserId: string;
  isCreator: boolean;
  onRemoveParticipant: (id: string) => void;
  onClaimCreator?: () => void;
}

const GROUP_ORDER = [
  { id: 'Developer', label: 'DEV' },
  { id: 'QA', label: 'QA' },
  { id: 'UX', label: 'UX' },
  { id: 'Designer', label: 'Designer' },
  { id: 'Management', label: 'Gestão' },
] as const;

/** Quem está na retro, por papel. O facilitador remove pessoas; quem não é facilitador pode assumir o controle (com confirmação). */
export function RetroParticipantList({ participants, onlineIds, currentUserId, isCreator, onRemoveParticipant, onClaimCreator }: RetroParticipantListProps) {
  const [toRemove, setToRemove] = useState<RetroParticipant | null>(null);
  const [claimOpen, setClaimOpen] = useState(false);

  const items = useMemo<PresenceItem[]>(
    () =>
      participants.map((p) => ({
        id: p.id,
        name: p.nickname,
        roleLabel: p.globalRole || (p.role ? TEAM_ROLE_DESCRIPTIONS[p.role]?.name : undefined) || 'Participante',
        category: presenceCategoryOf(p.role),
        // Sem dado do servidor (`onlineIds` nulo) fica sem ponto: quem está na lista entrou na retro, não necessariamente está aqui.
        online: presenceOnlineOf(onlineIds, p.id),
        status: 'idle',
        isYou: p.id === currentUserId,
        isHost: p.isCreator,
      })),
    [participants, currentUserId, onlineIds]
  );

  const renderActions = (item: PresenceItem) => {
    const person = participants.find((p) => p.id === item.id);
    if (!person) return null;
    return (
      <TooltipProvider>
        {!isCreator && item.isYou && onClaimCreator && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon" aria-label="Assumir o controle da retro" onClick={() => setClaimOpen(true)} className="h-7 w-7 shrink-0 text-amber-600 dark:text-amber-300">
                <Crown className="h-3.5 w-3.5" strokeWidth={1.5} />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Assumir controle</TooltipContent>
          </Tooltip>
        )}
        {isCreator && !item.isYou && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                aria-label={`Remover ${item.name} da retro`}
                onClick={() => setToRemove(person)}
                className="h-7 w-7 shrink-0 text-muted-foreground opacity-0 hover:text-red-600 focus-visible:opacity-100 group-hover:opacity-100 dark:hover:text-red-300 [@media(hover:none)]:opacity-100"
              >
                <UserX className="h-3.5 w-3.5" strokeWidth={1.5} />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Remover da retro</TooltipContent>
          </Tooltip>
        )}
      </TooltipProvider>
    );
  };

  return (
    <>
      <PresenceList items={items} groupOrder={GROUP_ORDER} renderActions={renderActions} emptyLabel="Ninguém na retro ainda" />

      <ConfirmDialog
        open={!!toRemove}
        onOpenChange={(open) => { if (!open) setToRemove(null); }}
        tone="danger"
        icon={UserX}
        title="Remover da retro?"
        description={<><strong className="text-foreground">{toRemove?.nickname}</strong> perde o acesso a este quadro na hora.</>}
        cancelLabel="Manter"
        confirmLabel="Remover"
        onConfirm={() => { if (toRemove) onRemoveParticipant(toRemove.id); setToRemove(null); }}
      />

      <ConfirmDialog
        open={claimOpen}
        onOpenChange={setClaimOpen}
        tone="warn"
        icon={Crown}
        title="Assumir o controle da retro?"
        description="Você vira o facilitador: revela os cartões, conduz a votação, controla o timer e gerencia as pessoas. Use só se o facilitador original estiver ausente ou desconectado."
        confirmLabel="Assumir controle"
        onConfirm={() => onClaimCreator?.()}
      />
    </>
  );
}
