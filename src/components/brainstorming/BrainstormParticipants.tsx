'use client';

import React, { useMemo } from 'react';
import { UserX } from 'lucide-react';
import { IconButton, PresenceList, type PresenceItem } from '@/components/room-kit';
import type { Participant } from '@/lib/types';
import { presenceOnlineOf } from '@/lib/room-presence';
import { firstName } from './brainstorm-room-logic';

export function participantRoleLabel(p: Pick<Participant, 'globalRole' | 'role'>): string {
  return (p.globalRole || p.role || 'Participante') as string;
}

/**
 * Quem entrou na sala, no formato da lista de presença do kit. `onlineIds` vem do servidor (quem tem a sala aberta);
 * sem ele (`null`, backend antigo) a lista fica sem ponto de online e sem "ausente".
 */
export function toPresenceItems(
  participants: readonly Participant[],
  creatorId: string,
  currentUserId: string,
  onlineIds: ReadonlySet<string> | null = null,
): PresenceItem[] {
  return participants.map((p) => {
    const host = p.id === creatorId;
    return {
      id: p.id,
      name: p.nickname || 'Participante',
      roleLabel: host ? `${participantRoleLabel(p)} · facilitador` : participantRoleLabel(p),
      category: (p.globalRole || p.role) as string,
      online: presenceOnlineOf(onlineIds, p.id),
      isYou: p.id === currentUserId,
      isHost: host,
    };
  });
}

/** Lista do painel: o facilitador no topo e os demais abaixo; o facilitador remove pessoas (com confirmação da sala). */
export function BrainstormParticipants({
  participants,
  creatorId,
  currentUserId,
  isFacilitator,
  onRequestRemove,
  onlineIds = null,
}: {
  participants: readonly Participant[];
  onlineIds?: ReadonlySet<string> | null;
  creatorId: string;
  currentUserId: string;
  isFacilitator: boolean;
  onRequestRemove: (participant: Participant) => void;
}) {
  const items = useMemo(() => toPresenceItems(participants, creatorId, currentUserId, onlineIds), [participants, creatorId, currentUserId, onlineIds]);
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
          <h3 className="m-0 px-4 pb-1 pt-1 text-xs font-semibold text-muted-foreground">Facilitação</h3>
          <PresenceList items={host} renderActions={actions} className="flex-none overflow-visible pb-1" />
        </section>
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
