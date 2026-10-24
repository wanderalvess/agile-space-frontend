'use client';

import * as React from 'react';
import { X, type LucideIcon } from 'lucide-react';
import { Sheet, SheetContent, SheetDescription, SheetTitle } from '@/components/ui/sheet';
import { cn } from '@/lib/utils';
import { FOCUS_RING } from './tokens';
import { useBelowBreakpoint } from './useBelowBreakpoint';

export interface SidePanelProps {
  title: React.ReactNode;
  icon?: LucideIcon;
  /** Contagem ao lado do título (itens da fila, pessoas na sala). */
  count?: React.ReactNode;
  /** Botões extras no cabeçalho (filtro, adicionar...). */
  actions?: React.ReactNode;
  onClose?: () => void;
  /** Rodapé fixo (importar do Jira, convidar...). */
  footer?: React.ReactNode;
  /** Conteúdo logo abaixo do cabeçalho (abas, busca, barra de progresso). */
  subheader?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  bodyClassName?: string;
  /** Tira o padding do corpo quando o filho já cuida do próprio espaçamento. */
  flush?: boolean;
  /** Tira o título/cabeçalho visível quando o filho traz o próprio (chat com abas). */
  headless?: boolean;
}

/**
 * Contêiner padrão dos painéis laterais: título, ações, corpo rolável e rodapé.
 * Fila, participantes, histórico, chat, base de conhecimento e notas usam este
 * mesmo esqueleto.
 */
export function SidePanel({
  title,
  icon: Icon,
  count,
  actions,
  onClose,
  footer,
  subheader,
  children,
  className,
  bodyClassName,
  flush = true,
  headless = false,
}: SidePanelProps) {
  return (
    <section aria-label={typeof title === 'string' ? title : undefined} className={cn('flex h-full min-h-0 flex-col bg-card text-card-foreground', className)}>
      {!headless && (
        <header className="flex shrink-0 items-center gap-2 px-4 pb-3 pt-4">
          {Icon && <Icon aria-hidden="true" className="h-4 w-4 text-muted-foreground" strokeWidth={1.5} />}
          <h2 className="text-[15px] font-semibold leading-none text-foreground">{title}</h2>
          {count !== undefined && count !== null && (
            <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-semibold tabular-nums text-primary [.theme-totvs:not(.dark)_&]:text-foreground">
              {count}
            </span>
          )}
          <span className="flex-1" />
          {actions}
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              aria-label="Fechar painel"
              className={cn('inline-flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition-colors duration-fast hover:bg-accent hover:text-accent-foreground', FOCUS_RING)}
            >
              <X className="h-4 w-4" strokeWidth={1.5} />
            </button>
          )}
        </header>
      )}
      {subheader}
      <div className={cn('flex min-h-0 flex-1 flex-col', !flush && 'p-4', bodyClassName)}>{children}</div>
      {footer && <footer className="shrink-0 border-t border-border px-4 py-3">{footer}</footer>}
    </section>
  );
}

export interface ResponsivePanelProps extends Omit<SidePanelProps, 'onClose'> {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  side: 'left' | 'right';
  /** Abaixo desta largura (px) o painel vira folha lateral. Padrão 1024. */
  sheetBelow?: number;
  /** Largura do painel fixo, em classes Tailwind (ex.: "w-80"). Padrão w-80. */
  widthClass?: string;
  /** Esconde o painel fixo (modo apresentação). */
  hidden?: boolean;
  /** Nome para leitores de tela quando o título é um nó. */
  srLabel?: string;
}

/**
 * Painel que é coluna fixa no desktop (abre/fecha animando a largura) e folha
 * lateral (Sheet) no tablet/celular. Só um painel lateral por vez fica aberto —
 * quem usa decide (ver PokerRoom).
 */
export function ResponsivePanel({
  open,
  onOpenChange,
  side,
  sheetBelow = 1024,
  widthClass = 'w-80',
  hidden = false,
  srLabel,
  ...panel
}: ResponsivePanelProps) {
  const isSheet = useBelowBreakpoint(sheetBelow);
  const close = () => onOpenChange(false);

  if (isSheet) {
    return (
      <Sheet open={open && !hidden} onOpenChange={onOpenChange}>
        <SheetContent side={side} className="flex w-[88vw] max-w-sm flex-col gap-0 p-0 [&>button]:hidden">
          <SheetTitle className="sr-only">{srLabel ?? (typeof panel.title === 'string' ? panel.title : 'Painel')}</SheetTitle>
          <SheetDescription className="sr-only">Painel lateral da sala</SheetDescription>
          <SidePanel {...panel} onClose={close} />
        </SheetContent>
      </Sheet>
    );
  }

  return (
    <aside
      aria-hidden={!open || hidden}
      className={cn(
        'relative shrink-0 overflow-hidden bg-card transition-[width,opacity] duration-slow ease-room motion-reduce:transition-none',
        side === 'left' ? 'border-r' : 'border-l',
        open && !hidden ? cn(widthClass, 'border-border opacity-100') : 'w-0 border-transparent opacity-0'
      )}
    >
      <div className={cn('flex h-full flex-col', widthClass)} {...(!open || hidden ? { inert: true } : {})}>
        <SidePanel {...panel} onClose={close} />
      </div>
    </aside>
  );
}
