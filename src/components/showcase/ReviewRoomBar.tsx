'use client';

import { BookOpen, FileText, Link2, Play, Printer, RotateCcw, SlidersHorizontal } from 'lucide-react';
import { ModalButton, RoomTopBar, type RoomTopBarAction, type RoomTopBarChip, type RoomTopBarMenuItem } from '@/components/room-kit';
import { moduleIcon } from '@/lib/modules-registry';
import type { ShowcaseSession } from './types';
import { REVIEW_PHASES, reviewPhase, topBarStatus, topBarStatusLabel, type ReviewStatus } from './review-room-logic';

export interface ReviewRoomBarProps {
  session: ShowcaseSession;
  status: ReviewStatus;
  /** Nome da squad para o chip (o vínculo dá o nome; sem ele, a chave). */
  squadLabel: string;
  presenting: boolean;
  onRename: (name: string) => void;
  onStartPresenting: () => void;
  onShare: () => void;
  onSettings: () => void;
  onGuide: () => void;
  onOpenRetro: () => void;
  onOpenSummary: () => void;
  onPrint: () => void;
  /** Só com a Review finalizada. */
  onReopen?: () => void;
  onOpenFeedback?: () => void;
}

/**
 * Cabeçalho único da sala da Review (kit): voltar à lista, nome editável, estado (Em preparação, Ao vivo,
 * Encerrada), squad e sprint, as três fases, Apresentar e os botões de Compartilhar, Configurar e Guia.
 * O que é menos frequente (Retro, Resumo, Imprimir, Reabrir) mora no "Mais".
 */
export function ReviewRoomBar(p: ReviewRoomBarProps) {
  const sprint = p.session.sprintName?.trim();
  const chips: RoomTopBarChip[] = [
    ...(p.squadLabel ? [{ id: 'squad', label: p.squadLabel, secondary: true }] : []),
    ...(sprint ? [{ id: 'sprint', label: sprint }] : []),
  ];

  const actions: RoomTopBarAction[] = [
    { id: 'guide', label: 'Guia da Review', icon: BookOpen, onClick: p.onGuide },
    { id: 'share', label: 'Compartilhar', icon: Link2, onClick: p.onShare },
    { id: 'settings', label: 'Configurações da Review', icon: SlidersHorizontal, onClick: p.onSettings },
  ];

  const RetroIcon = moduleIcon('retro');
  const menuItems: RoomTopBarMenuItem[] = [
    { id: 'retro', label: 'Retro desta sprint', icon: RetroIcon, onClick: p.onOpenRetro },
    { id: 'summary', label: 'Resumo e exportação', icon: FileText, onClick: p.onOpenSummary },
    { id: 'print', label: 'Imprimir slides', icon: Printer, onClick: p.onPrint },
    ...(p.onReopen ? [{ id: 'reopen', label: 'Reabrir a Review', icon: RotateCcw, onClick: p.onReopen }] : []),
  ];

  return (
    <RoomTopBar
      toolName="Review"
      toolIcon={moduleIcon('showcase')}
      title={p.session.name || 'Review'}
      onTitleChange={p.onRename}
      homeHref="/showcase"
      homeLabel="Voltar para a lista de Reviews"
      status={topBarStatus(p.status)}
      statusLabel={topBarStatusLabel(p.status)}
      chips={chips}
      phases={{ steps: REVIEW_PHASES, current: reviewPhase(p.status, p.presenting), label: 'Fases da Review' }}
      primaryAction={
        <ModalButton variant="primary" data-tour="start-teatro" className="gap-2" onClick={p.onStartPresenting}>
          <Play className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" /> Apresentar
        </ModalButton>
      }
      actions={actions}
      menuItems={menuItems}
      onOpenFeedback={p.onOpenFeedback}
    />
  );
}
