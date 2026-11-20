'use client';

import * as React from 'react';
import { ChevronLeft, FileUp, Loader2, PanelRight } from 'lucide-react';
import { FOCUS_RING, ModalButton, StatusChip, type Tone } from '@/components/room-kit';
import { cn } from '@/lib/utils';
import type { SaveTone } from '@/lib/knowledge-editor';

export type EditorMode = 'write' | 'read';

export interface ArticleTopBarProps {
  crumb: string;
  statusLabel: string;
  statusTone: Tone;
  saveLabel: string;
  saveTone: SaveTone;
  mode: EditorMode;
  onModeChange: (mode: EditorMode) => void;
  saving: boolean;
  onBack: () => void;
  onOpenDetails: () => void;
  onImport: () => void;
  /** Ausente quando o servidor ainda não aceita rascunho. */
  onSaveDraft?: () => void;
  onPrimary: () => void;
  primaryLabel: string;
}

const DOT: Record<SaveTone, string> = {
  ok: 'bg-emerald-600 dark:bg-emerald-400',
  busy: 'bg-primary motion-safe:animate-pulse',
  pending: 'bg-amber-600 dark:bg-amber-400',
};

/** Barra do topo do editor: voltar, caminho, situação, salvamento, Escrever/Ler e as ações principais. */
export function ArticleTopBar({
  crumb,
  statusLabel,
  statusTone,
  saveLabel,
  saveTone,
  mode,
  onModeChange,
  saving,
  onBack,
  onOpenDetails,
  onImport,
  onSaveDraft,
  onPrimary,
  primaryLabel,
}: ArticleTopBarProps) {
  return (
    <div className="flex flex-wrap items-center gap-x-3.5 gap-y-2">
      <button
        type="button"
        onClick={onBack}
        aria-label="Voltar para a base"
        className={cn(
          'inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] border border-border text-foreground transition-colors duration-fast hover:bg-accent',
          FOCUS_RING,
        )}
      >
        <ChevronLeft className="h-4 w-4" strokeWidth={1.5} aria-hidden="true" />
      </button>

      <nav aria-label="Caminho" className="hidden min-w-0 items-center gap-2 text-[13px] text-muted-foreground md:flex">
        <span>Conhecimento</span>
        <span aria-hidden="true">/</span>
        <span>Base</span>
        <span aria-hidden="true">/</span>
        <strong aria-current="page" className="max-w-[28ch] truncate font-semibold text-foreground">
          {crumb}
        </strong>
      </nav>

      <StatusChip tone={statusTone}>{statusLabel}</StatusChip>

      <span role="status" className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
        <span aria-hidden="true" className={cn('h-[7px] w-[7px] rounded-full', DOT[saveTone])} />
        {saveLabel}
      </span>

      <span className="flex-1" />

      <div role="group" aria-label="Modo" className="flex rounded-[10px] border border-border bg-muted/50 p-[3px]">
        {(
          [
            ['write', 'Escrever'],
            ['read', 'Ler'],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            aria-pressed={mode === id}
            onClick={() => onModeChange(id)}
            className={cn(
              'h-[30px] rounded-[7px] px-3.5 text-[13px] font-semibold transition-colors duration-fast',
              mode === id ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground',
              FOCUS_RING,
            )}
          >
            {label}
          </button>
        ))}
      </div>

      <ModalButton variant="secondary" onClick={onOpenDetails} className="h-9 gap-1.5 xl:hidden">
        <PanelRight className="h-4 w-4" strokeWidth={1.5} aria-hidden="true" />
        Detalhes
      </ModalButton>
      <ModalButton variant="secondary" onClick={onImport} disabled={saving} className="h-9 gap-1.5">
        <FileUp className="h-4 w-4" strokeWidth={1.5} aria-hidden="true" />
        Importar arquivo
      </ModalButton>
      {onSaveDraft && (
        <ModalButton variant="secondary" onClick={onSaveDraft} disabled={saving} className="h-9">
          Salvar rascunho
        </ModalButton>
      )}
      <ModalButton variant="primary" onClick={onPrimary} disabled={saving} className="h-9 gap-1.5">
        {saving && <Loader2 className="h-4 w-4 motion-safe:animate-spin" strokeWidth={1.5} aria-hidden="true" />}
        {primaryLabel}
      </ModalButton>
    </div>
  );
}
