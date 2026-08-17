"use client";

import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { Crown, UserX } from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { useState } from 'react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { MemberCard } from '../common/MemberCard';

export interface EliteParticipant {
  id: string;
  nickname: string;
  role?: string;
  globalRole?: string;
  isFacilitator?: boolean;
  isCreator?: boolean; // Suporte legado para Retro
  isOnline?: boolean;
}

export interface EliteParticipantListProps {
  participants: EliteParticipant[];
  currentUserId: string;
  isFacilitator: boolean;
  onRemoveParticipant: (id: string) => void;
  onClaimFacilitator?: () => void;
  renderIndicator?: (participantId: string) => React.ReactNode;
  ghostParticipants?: Array<{
    id: string;
    nickname: string;
    role: string;
    indicator: React.ReactNode;
  }>;
  dict?: {
    removeTitle?: string;
    removeDesc?: string;
    claimTitle?: string;
    claimDesc?: string;
  }
}

export function EliteParticipantList({
  participants,
  currentUserId,
  isFacilitator,
  onRemoveParticipant,
  onClaimFacilitator,
  renderIndicator,
  ghostParticipants = [],
  dict = {
    removeTitle: "Remover Participante?",
    removeDesc: "perderá o acesso a esta sala imediatamente.",
    claimTitle: "Assumir Controle da Sala?",
    claimDesc: "Você está prestes a se tornar o Organizador Oficial desta sessão. Isso desativará os controles do host atual e lhe dará acesso total às configurações. Use esta opção apenas se o organizador original estiver ausente ou desconectado."
  }
}: EliteParticipantListProps) {
  const [participantToRemove, setParticipantToRemove] = useState<EliteParticipant | null>(null);
  const [isClaimDialogOpen, setIsClaimDialogOpen] = useState(false);

  const handleClaimConfirm = () => {
    onClaimFacilitator?.();
    setIsClaimDialogOpen(false);
  };

  const handleRemoveConfirm = () => {
    if (participantToRemove) {
      onRemoveParticipant(participantToRemove.id);
    }
    setParticipantToRemove(null);
  };

  return (
    <>
      <ScrollArea className="flex-1 min-h-0 scrollbar-thin overflow-x-hidden">
        <div className="p-3 pr-2 space-y-1.5 pb-12 overflow-x-hidden">
          {participants.map((p) => {
            const isHost = p.isFacilitator || p.isCreator;
            return (
              <MemberCard
                key={p.id}
                nickname={p.nickname}
                role={p.globalRole || p.role || 'Participante'}
                isYou={p.id === currentUserId}
                isFacilitator={isHost}
                status={p.isOnline === false ? "offline" : "online"}
                indicator={renderIndicator?.(p.id)}
                actions={
                  <div className="flex items-center gap-1">
                    {!isFacilitator && p.id === currentUserId && onClaimFacilitator && (
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => setIsClaimDialogOpen(true)}
                              className="h-7 w-7 text-amber-500 hover:text-amber-600 hover:bg-amber-50 rounded-full shrink-0"
                            >
                              <Crown className="h-3.5 w-3.5" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>Assumir Controle</p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    )}
                    {isFacilitator && p.id !== currentUserId && (
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => setParticipantToRemove(p)}
                              className="h-7 w-7 text-red-500 hover:text-red-600 hover:bg-red-50 rounded-full opacity-40 hover:opacity-100 transition-opacity shrink-0"
                            >
                              <UserX className="h-3.5 w-3.5" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>Remover da Sala</p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    )}
                  </div>
                }
              />
            );
          })}

          {/* Ghost Participants */}
          {ghostParticipants.map((v) => (
            <MemberCard
              key={`ghost-${v.id}`}
              nickname={v.nickname}
              role={v.role}
              status="offline"
              indicator={v.indicator}
            />
          ))}
        </div>
      </ScrollArea>
      <AlertDialog open={!!participantToRemove} onOpenChange={() => setParticipantToRemove(null)}>
        <AlertDialogContent className="shadow-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-xl font-black uppercase tracking-tight">{dict.removeTitle}</AlertDialogTitle>
            <AlertDialogDescription>
              <span className="font-bold text-foreground">{participantToRemove?.nickname}</span> {dict.removeDesc}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="font-bold h-10 px-6 rounded-xl">Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleRemoveConfirm} className="bg-destructive text-destructive-foreground hover:bg-destructive/90 font-black h-10 px-6 rounded-xl shadow-lg shadow-destructive/20 transition-all uppercase tracking-widest text-[11px]">Confirmar Remoção</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={isClaimDialogOpen} onOpenChange={setIsClaimDialogOpen}>
        <AlertDialogContent className="rounded-[2rem] border-white/20 bg-card/60 backdrop-blur-3xl shadow-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-2xl font-black uppercase tracking-tighter italic text-amber-500">{dict.claimTitle}</AlertDialogTitle>
            <AlertDialogDescription className="text-sm font-medium" dangerouslySetInnerHTML={{ __html: dict.claimDesc || '' }} />
          </AlertDialogHeader>
          <AlertDialogFooter className="mt-4">
            <AlertDialogCancel className="rounded-xl font-bold uppercase tracking-widest text-[10px]">Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleClaimConfirm} className="bg-amber-500 hover:bg-amber-600 text-white font-black uppercase tracking-widest text-[10px] rounded-xl shadow-lg shadow-amber-500/20">Confirmar e Assumir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
