"use client";

import type { RetroParticipant } from '@/lib/types';
import { TEAM_ROLE_DESCRIPTIONS } from '@/lib/types';
import { EliteParticipantList } from '../shared/EliteParticipantList';

interface RetroParticipantListProps {
  participants: RetroParticipant[];
  currentUserId: string;
  isCreator: boolean;
  onRemoveParticipant: (id: string) => void;
  onClaimCreator?: () => void;
}

export function RetroParticipantList({
  participants,
  currentUserId,
  isCreator,
  onRemoveParticipant,
  onClaimCreator,
}: RetroParticipantListProps) {
  return (
    <EliteParticipantList
      participants={participants.map(p => ({
        ...p,
        role: (p.role ? TEAM_ROLE_DESCRIPTIONS[p.role]?.name : undefined) || 'Participante',
        isFacilitator: p.isCreator
      }))}
      currentUserId={currentUserId}
      isFacilitator={isCreator}
      onRemoveParticipant={onRemoveParticipant}
      onClaimFacilitator={onClaimCreator}
      dict={{
        removeTitle: "Remover Participante?",
        removeDesc: "perderá o acesso a este quadro permanentemente.",
        claimTitle: "Assumir Controle do Quadro?",
        claimDesc: `Você está prestes a se tornar o <strong>Organizador Oficial</strong> deste quadro. <br /><br />
              Isso lhe dará permissão total para revelar cards, controlar o timer e gerenciar participantes. Use esta opção apenas se o organizador original estiver ausente ou desconectado.`
      }}
    />
  );
}
