"use client";

import type { Participant, Vote, Role } from '@/lib/types';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Crown, UserX, Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useMemo } from 'react';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Badge } from '../ui/badge';
import { EliteParticipantList } from '../shared/EliteParticipantList';

interface ParticipantListProps {
  participants: Participant[];
  votes: Vote[];
  currentUserId: string;
  isFacilitator: boolean;
  onRemoveParticipant: (id: string) => void;
  onUpdateParticipantRole: (id: string, newRole: Role) => void;
  onClaimFacilitator?: () => void;
  onlineIds?: Set<string>;
}

const ROLE_LABELS: Record<Role, string> = {
  dev: 'Desenvolvedor',
  qa: 'QA',
  organizador: 'Organizador',
  spectator: 'Espectador',
};

export function ParticipantList({
  participants,
  currentUserId,
  isFacilitator,
  onRemoveParticipant,
  onUpdateParticipantRole,
  onClaimFacilitator,
  votes,
  onlineIds
}: ParticipantListProps) {
  const votedParticipantIds = useMemo(() => new Set(votes.map(v => v.participantId)), [votes]);

  const renderIndicator = (id: string) => {
    return (
      <TooltipProvider>
        {votedParticipantIds.has(id) ? (
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="flex items-center justify-center h-7 w-7 bg-emerald-500 rounded-xl shadow-[0_0_15px_rgba(16,185,129,0.3)] ring-2 ring-white animate-in zoom-in-50 duration-300">
                <Check className="h-4 w-4 text-white" strokeWidth={3} />
              </div>
            </TooltipTrigger>
            <TooltipContent className="bg-slate-900 border-none rounded-lg p-2 text-[10px] font-black uppercase tracking-widest text-emerald-400"><p>Voto Registrado</p></TooltipContent>
          </Tooltip>
        ) : (
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="flex items-center justify-center h-7 w-7 bg-indigo-50 rounded-xl border border-indigo-100 transition-all">
                 <div className="flex gap-1 items-center">
                   <div className="w-1 h-1 bg-indigo-400 rounded-full animate-pulse [animation-delay:-0.3s]" />
                   <div className="w-1 h-1 bg-indigo-300 rounded-full animate-pulse [animation-delay:-0.15s]" />
                   <div className="w-1 h-1 bg-indigo-200 rounded-full animate-pulse" />
                 </div>
              </div>
            </TooltipTrigger>
            <TooltipContent className="bg-slate-900 border-none rounded-lg p-2 text-[10px] font-black uppercase tracking-widest text-indigo-300"><p>Pensando...</p></TooltipContent>
          </Tooltip>
        )}
      </TooltipProvider>
    );
  };
  const ghostParticipants = votes
    .filter(v => !participants.some(p => p.id === v.participantId))
    .map(v => ({
      id: v.participantId,
      nickname: v.participantNickname || 'Participante',
      role: v.participantGlobalRole || (v.participantRole ? ROLE_LABELS[v.participantRole] : 'Ausente'),
      indicator: (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="flex items-center justify-center h-7 w-7 bg-slate-200 rounded-xl opacity-60">
                <Check className="h-4 w-4 text-slate-500" strokeWidth={3} />
              </div>
            </TooltipTrigger>
            <TooltipContent className="bg-slate-900 border-none rounded-lg p-2 text-[10px] font-black uppercase tracking-widest text-slate-400">
              <p>Voto de Participante Ausente</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      )
    }));

  return (
    <EliteParticipantList
      participants={participants.map(p => ({
        ...p,
        role: ROLE_LABELS[p.role] || p.role,
        isOnline: onlineIds ? onlineIds.has(p.id) : true
      }))}
      currentUserId={currentUserId}
      isFacilitator={isFacilitator}
      onRemoveParticipant={onRemoveParticipant}
      onClaimFacilitator={onClaimFacilitator}
      renderIndicator={renderIndicator}
      ghostParticipants={ghostParticipants}
    />
  );
}
