'use client';

import * as React from 'react';
import { Download } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Modal, ModalButton } from './Modal';
import { FOCUS_RING } from './tokens';

export interface ExportFormatOption {
  id: string;
  name: string;
  desc: string;
  /** Sigla curta no canto (MD, CSV, PDF). */
  short: string;
}

export interface ExportDialogShellProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title?: string;
  /** Resumo em uma linha ("9 tópicos · 6 estimados"). */
  summary?: React.ReactNode;
  formats: ExportFormatOption[];
  selected: string;
  onSelect: (id: string) => void;
  onExport: () => void;
  exporting?: boolean;
  /** Verbo do botão: "Exportar Markdown". Padrão monta a partir do formato. */
  ctaLabel?: string;
  /** Opções extras da sala (conteúdo a incluir, por exemplo). */
  children?: React.ReactNode;
}

/**
 * Casca de exportação: escolha do formato em lista de opções e um botão que
 * diz o verbo. A sala fornece os formatos e a função que gera o arquivo.
 */
export function ExportDialogShell({
  open,
  onOpenChange,
  title = 'Exportar resultados',
  summary,
  formats,
  selected,
  onSelect,
  onExport,
  exporting = false,
  ctaLabel,
  children,
}: ExportDialogShellProps) {
  const current = formats.find((f) => f.id === selected);
  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      size="md"
      icon={Download}
      title={title}
      description={summary}
      preventClose={exporting}
      footer={
        <>
          <ModalButton onClick={() => onOpenChange(false)} disabled={exporting}>Cancelar</ModalButton>
          <ModalButton variant="primary" onClick={onExport} disabled={exporting || !current}>
            {exporting ? 'Gerando…' : (ctaLabel ?? `Exportar ${current?.name ?? ''}`.trim())}
          </ModalButton>
        </>
      }
    >
      <fieldset className="m-0 flex flex-col gap-2 border-0 p-0">
        <legend className="mb-2 p-0 text-[13px] font-semibold text-foreground">Formato</legend>
        {formats.map((f) => {
          const on = f.id === selected;
          return (
            <label
              key={f.id}
              className={cn(
                'flex cursor-pointer items-center gap-3 rounded-xl border p-3 transition-colors duration-base has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring',
                on ? 'border-primary/60 bg-primary/10 dark:bg-primary/15' : 'border-border hover:bg-accent/50'
              )}
            >
              <input
                type="radio"
                name="room-export-format"
                checked={on}
                onChange={() => onSelect(f.id)}
                className={cn('h-4 w-4 accent-[hsl(var(--primary))]', FOCUS_RING)}
              />
              <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span className="text-sm font-semibold text-foreground">{f.name}</span>
                <span className="text-xs text-muted-foreground">{f.desc}</span>
              </span>
              <span className="rounded border border-border px-1.5 py-0.5 text-[11px] font-bold tabular-nums text-muted-foreground">{f.short}</span>
            </label>
          );
        })}
      </fieldset>
      {children}
    </Modal>
  );
}
