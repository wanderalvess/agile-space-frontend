'use client';

import { BarChart3, BookOpen, Download, ImageIcon, Link2, LogOut, MessagesSquare, SlidersHorizontal, Trash2, Volume2, VolumeX } from 'lucide-react';
import {
  RoomTopBar,
  type RoomTopBarAction,
  type RoomTopBarChip,
  type RoomTopBarMenuItem,
  type TopBarPerson,
} from '@/components/room-kit';
import { moduleIcon } from '@/lib/modules-registry';
import { retroFormatName } from '@/lib/retro-formats';
import type { RetroBoard } from '@/lib/types';
import { RETRO_PHASES, retroPhase } from './retro-room-logic';

export interface RetroRoomBarProps {
  boardData: RetroBoard;
  isFacilitator: boolean;
  people: TopBarPerson[];
  isParticipantsOpen: boolean;
  onToggleParticipants: () => void;
  isChatOpen: boolean;
  chatUnread: number;
  onToggleChat: () => void;
  onShare: () => void;
  onExport: () => void;
  onOpenGuide: () => void;
  onOpenSettings: () => void;
  onOpenStats?: () => void;
  isSoundEnabled: boolean;
  onToggleSound: () => void;
  onLeave: () => void;
  /** Apagar a retro (só criador/ADMIN: a tela só passa quando a pessoa pode). */
  onDelete?: () => void;
  /** Abre a preferência pessoal "Cenário da retro" (só existe quando o formato tem cenário). */
  onOpenScene?: () => void;
  /** Modo escolhido, por extenso ("Suave"), que acompanha o item do menu. */
  sceneLabel?: string;
  onOpenFeedback?: () => void;
  /** Retro encerrada pelo facilitador (backend novo): o selo da barra vira "Encerrada". */
  isFinished?: boolean;
}

/**
 * Cabeçalho único da sala da Retro: monta o `RoomTopBar` do kit com o que é da Retro (as quatro fases,
 * squad e formato, painéis de chat e participantes, exportar, guia, configurações do facilitador).
 */
export function RetroRoomBar(p: RetroRoomBarProps) {
  const format = retroFormatName(p.boardData.templateKey);
  const chips: RoomTopBarChip[] = [
    ...(p.boardData.team ? [{ id: 'team', label: p.boardData.team, secondary: true }] : []),
    ...(format ? [{ id: 'format', label: format, tone: 'brand' as const }] : []),
  ];

  const actions: RoomTopBarAction[] = [
    { id: 'chat', label: 'Chat da retro', icon: MessagesSquare, pressed: p.isChatOpen, badge: p.isChatOpen ? 0 : p.chatUnread, onClick: p.onToggleChat },
    { id: 'share', label: 'Copiar link da retro', icon: Link2, onClick: p.onShare },
    { id: 'export', label: 'Exportar retrospectiva', icon: Download, tier: 'mid', onClick: p.onExport },
    ...(p.onOpenStats ? [{ id: 'stats', label: 'Números da sprint', icon: BarChart3, tier: 'mid' as const, onClick: p.onOpenStats }] : []),
    ...(p.isFacilitator ? [{ id: 'settings', label: 'Configurações da retro', icon: SlidersHorizontal, tier: 'mid' as const, onClick: p.onOpenSettings }] : []),
    { id: 'guide', label: 'Guia da retro', icon: BookOpen, tier: 'wide', onClick: p.onOpenGuide },
  ];

  const menuItems: RoomTopBarMenuItem[] = [
    {
      id: 'sound',
      label: p.isSoundEnabled ? 'Desligar o som do timer' : 'Ligar o som do timer',
      icon: p.isSoundEnabled ? Volume2 : VolumeX,
      onClick: p.onToggleSound,
    },
    ...(p.onOpenScene ? [{ id: 'scene', label: `Cenário da retro${p.sceneLabel ? `: ${p.sceneLabel}` : ''}`, icon: ImageIcon, onClick: p.onOpenScene }] : []),
    { id: 'leave', label: 'Sair da retro', icon: LogOut, onClick: p.onLeave },
    ...(p.onDelete ? [{ id: 'delete', label: 'Apagar esta retro', icon: Trash2, onClick: p.onDelete }] : []),
  ];

  return (
    <RoomTopBar
      toolName="Retrospectiva"
      toolIcon={moduleIcon('retro')}
      title={p.boardData.title || 'Retrospectiva'}
      status={p.isFinished ? 'done' : 'live'}
      statusLabel={p.isFinished ? 'Encerrada' : undefined}
      chips={chips}
      phases={{ steps: RETRO_PHASES, current: retroPhase(p.boardData), label: 'Fases da retro' }}
      presence={{ people: p.people, open: p.isParticipantsOpen, onClick: p.onToggleParticipants }}
      actions={actions}
      menuItems={menuItems}
      onOpenFeedback={p.onOpenFeedback}
    />
  );
}
