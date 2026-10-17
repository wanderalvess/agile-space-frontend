'use client';

import React from 'react';
import { BookOpen, Copy, Download, Eye, EyeOff, Ghost, Link2, Monitor, SlidersHorizontal, Trash2, User, Volume2, VolumeX } from 'lucide-react';
import {
  ModalButton,
  RoomTopBar,
  type RoomTopBarAction,
  type RoomTopBarChip,
  type RoomTopBarMenuItem,
  type TopBarPerson,
} from '@/components/room-kit';
import { moduleIcon } from '@/lib/modules-registry';
import type { BrainstormingBoard } from '@/lib/types';
import { BRAIN_STAGES, connectionLabel, type RoomConnectionStatus } from './brainstorm-room-logic';

export interface BrainstormRoomBarProps {
  boardData: BrainstormingBoard;
  /** Nome da squad para o chip (o vínculo dá o nome; sem ele, a chave). */
  squadLabel: string;
  isFacilitator: boolean;
  people: TopBarPerson[];
  isParticipantsOpen: boolean;
  onToggleParticipants: () => void;
  connection: RoomConnectionStatus;
  /** Cronômetro (e o aviso de tempo esgotado), montado pela sala. */
  timer: React.ReactNode;
  onRename: (title: string) => void;
  onShare: () => void;
  onCopyLink: () => void;
  onExport: () => void;
  onOpenGuide: () => void;
  onOpenSettings: () => void;
  onToggleAnonymous: () => void;
  onToggleReveal: () => void;
  onTogglePresentation: () => void;
  isSoundEnabled: boolean;
  onToggleSound: () => void;
  onDeleteBoard: () => void;
  onOpenFeedback?: () => void;
}

/**
 * Cabeçalho único da sala do Brainstorming: monta o `RoomTopBar` do kit com o que é daqui (as cinco etapas, o
 * cronômetro, "Revelar ideias" para o facilitador, os atalhos de anônimo, ocultar e apresentação, e o "Mais").
 */
export function BrainstormRoomBar(p: BrainstormRoomBarProps) {
  const { settings } = p.boardData;
  const ideasHidden = settings.isRevealed === false;
  const anonymous = !!settings.isAnonymous;
  const presentation = !!settings.isPresentationMode;

  const chips: RoomTopBarChip[] = p.squadLabel ? [{ id: 'squad', label: p.squadLabel, secondary: true }] : [];

  const actions: RoomTopBarAction[] = [
    { id: 'share', label: 'Compartilhar', icon: Link2, onClick: p.onShare },
    { id: 'export', label: 'Exportar', icon: Download, onClick: p.onExport },
    ...(p.isFacilitator
      ? [
          { id: 'reveal', label: ideasHidden ? 'Revelar ideias' : 'Ocultar ideias', icon: ideasHidden ? EyeOff : Eye, pressed: ideasHidden, tier: 'mid' as const, onClick: p.onToggleReveal },
          { id: 'present', label: presentation ? 'Sair do modo apresentação' : 'Modo apresentação', icon: Monitor, pressed: presentation, tier: 'mid' as const, onClick: p.onTogglePresentation },
          { id: 'anonymous', label: anonymous ? 'Desativar autores anônimos' : 'Ativar autores anônimos', icon: anonymous ? Ghost : User, pressed: anonymous, tier: 'wide' as const, onClick: p.onToggleAnonymous },
        ]
      : []),
    { id: 'settings', label: 'Configurações da sessão', icon: SlidersHorizontal, tier: 'mid', onClick: p.onOpenSettings },
    { id: 'guide', label: 'Guia do brainstorming', icon: BookOpen, tier: 'mid', onClick: p.onOpenGuide },
  ];

  const menuItems: RoomTopBarMenuItem[] = [
    { id: 'copy', label: 'Copiar link', icon: Copy, onClick: p.onCopyLink },
    {
      id: 'sound',
      label: p.isSoundEnabled ? 'Desligar o som do cronômetro' : 'Ligar o som do cronômetro',
      icon: p.isSoundEnabled ? Volume2 : VolumeX,
      onClick: p.onToggleSound,
    },
    ...(p.isFacilitator ? [{ id: 'delete', label: 'Apagar este brainstorming', icon: Trash2, onClick: p.onDeleteBoard }] : []),
  ];

  return (
    <RoomTopBar
      toolName="Brainstorming"
      toolIcon={moduleIcon('brainstorming')}
      title={p.boardData.title || 'Brainstorming'}
      onTitleChange={p.isFacilitator ? p.onRename : undefined}
      homeHref="/brainstorming"
      homeLabel="Voltar para o Brainstorming"
      status={p.connection === 'live' ? 'live' : 'waiting'}
      statusLabel={p.connection === 'live' ? undefined : connectionLabel(p.connection)}
      chips={chips}
      phases={{ steps: BRAIN_STAGES, current: p.boardData.phase, label: 'Fases do brainstorming' }}
      timer={p.timer}
      primaryAction={
        p.isFacilitator && ideasHidden ? (
          <ModalButton variant="primary" className="gap-2" onClick={p.onToggleReveal}>
            <Eye className="h-4 w-4" strokeWidth={1.5} aria-hidden="true" /> Revelar ideias
          </ModalButton>
        ) : undefined
      }
      presence={{ people: p.people, open: p.isParticipantsOpen, onClick: p.onToggleParticipants, unknown: true }}
      actions={actions}
      menuItems={menuItems}
      onOpenFeedback={p.onOpenFeedback}
    />
  );
}
