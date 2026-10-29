'use client';

import * as React from 'react';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { X, type LucideIcon } from 'lucide-react';
import { Dialog, DialogOverlay, DialogPortal } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { IconTile } from './primitives';
import { DANGER_BUTTON, FOCUS_RING, PRIMARY_BUTTON, TONES, type Tone } from './tokens';

/** Larguras do design: P 420 (avisos), M 560 (formulários curtos), G 800 (configurações, detalhes). */
export type ModalSize = 'sm' | 'md' | 'lg';

const SIZE_CLASS: Record<ModalSize, string> = {
  sm: 'sm:max-w-[420px]',
  md: 'sm:max-w-[560px]',
  lg: 'sm:max-w-[800px]',
};

/** Casca visual compartilhada por Modal e ConfirmDialog. */
export const MODAL_SURFACE =
  'fixed left-1/2 top-1/2 z-50 flex max-h-[88vh] w-[calc(100vw-1.5rem)] -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden ' +
  'rounded-2xl border border-border bg-card text-card-foreground ' +
  'shadow-[0_30px_80px_rgba(15,23,42,0.18)] dark:shadow-[0_30px_80px_rgba(0,0,0,0.6)] ' +
  'duration-slow data-[state=open]:animate-in data-[state=closed]:animate-out ' +
  'data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 ' +
  'data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 ' +
  'motion-reduce:duration-instant';

/* Intencional: bg-black é o véu (scrim) do modal; tem de escurecer em qualquer tema. */
export const MODAL_OVERLAY = 'bg-black/55 backdrop-blur-sm motion-reduce:duration-instant';

export interface ModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  size?: ModalSize;
  /** Cor da placa do ícone e do filete: marca, alerta, perigo... */
  tone?: Tone;
  /** Cor só da placa, quando difere do filete (ex.: placa neutra com filete de alerta). */
  iconTone?: Tone;
  icon?: LucideIcon;
  title: React.ReactNode;
  /** Uma frase de apoio, opcional. */
  description?: React.ReactNode;
  /** Mostra o X no canto (padrão). Avisos e confirmações destrutivas não têm X. */
  dismissible?: boolean;
  /** Conteúdo logo abaixo do cabeçalho, fora da área rolável (abas, busca). */
  headerExtra?: React.ReactNode;
  children?: React.ReactNode;
  /** Ação terciária à esquerda do rodapé (restaurar padrão, voltar etapa). */
  footerStart?: React.ReactNode;
  /** Ações à direita: secundária com contorno e a principal cheia por último. */
  footer?: React.ReactNode;
  className?: string;
  bodyClassName?: string;
  /** Classes extras no botão X (ex.: alvo de toque de 44 px no celular). */
  closeClassName?: string;
  /** Chamado quando o modal fecha e o Radix devolveria o foco (sem DialogTrigger ele o perde). `preventDefault()` assume o foco. */
  onCloseAutoFocus?: (event: Event) => void;
  /** Impede fechar por clique fora/Esc (ex.: enquanto grava). */
  preventClose?: boolean;
}

/**
 * Modal do kit: filete de 2 px no topo, cabeçalho com placa de ícone, corpo
 * rolável e rodapé com a ação principal à direita. Embrulha o Dialog do shadcn
 * (foco preso, Esc, retorno de foco e aria-modal vêm do Radix).
 */
export function Modal({
  open,
  onOpenChange,
  size = 'md',
  tone = 'brand',
  iconTone,
  icon,
  title,
  description,
  dismissible = true,
  headerExtra,
  children,
  footerStart,
  footer,
  className,
  bodyClassName,
  closeClassName,
  onCloseAutoFocus,
  preventClose = false,
}: ModalProps) {
  const contentRef = React.useRef<HTMLDivElement>(null);
  return (
    <Dialog open={open} onOpenChange={(next) => { if (!next && preventClose) return; onOpenChange(next); }}>
      <DialogPortal>
        <DialogOverlay className={MODAL_OVERLAY} />
        <DialogPrimitive.Content
          ref={contentRef}
          className={cn(MODAL_SURFACE, SIZE_CLASS[size], className)}
          onCloseAutoFocus={onCloseAutoFocus}
          // Foco no próprio modal (não no X): o anel de foco só aparece quando a pessoa usa Tab.
          onOpenAutoFocus={(e) => { e.preventDefault(); contentRef.current?.focus(); }}
        >
          <div aria-hidden="true" className={cn('h-0.5 shrink-0', TONES[tone].hairline)} />
          <header className="flex shrink-0 items-start gap-3.5 px-6 pb-4 pt-5">
            {icon && <IconTile icon={icon} tone={iconTone ?? tone} />}
            <div className="flex min-w-0 flex-1 flex-col gap-1">
              <DialogPrimitive.Title className="text-xl font-bold leading-tight tracking-tight text-foreground">
                {title}
              </DialogPrimitive.Title>
              {description ? (
                <DialogPrimitive.Description className="text-sm text-muted-foreground">
                  {description}
                </DialogPrimitive.Description>
              ) : (
                <DialogPrimitive.Description className="sr-only">{typeof title === 'string' ? title : 'Janela'}</DialogPrimitive.Description>
              )}
            </div>
            {dismissible && (
              <DialogPrimitive.Close
                aria-label="Fechar"
                className={cn(
                  '-mr-1.5 -mt-1 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors duration-fast hover:bg-accent hover:text-accent-foreground',
                  FOCUS_RING,
                  closeClassName
                )}
              >
                <X className="h-4 w-4" strokeWidth={1.5} />
              </DialogPrimitive.Close>
            )}
          </header>
          {headerExtra}
          <div className={cn('scrollbar-thin min-h-0 flex-1 overflow-y-auto px-6 pb-6 pt-1', bodyClassName)}>{children}</div>
          {(footer || footerStart) && (
            // No celular o texto de apoio ocupa a linha de cima e os botões ficam à direita embaixo: sem isso, o botão principal passa da borda.
            <footer className="flex shrink-0 flex-wrap items-center gap-x-2 gap-y-2.5 border-t border-border bg-muted/40 px-6 py-3.5">
              {footerStart && <div className="flex min-w-0 items-center gap-2 max-sm:basis-full">{footerStart}</div>}
              <span className="flex-1 max-sm:hidden" />
              {footer && <div className="flex min-w-0 flex-wrap items-center justify-end gap-2 max-sm:ml-auto">{footer}</div>}
            </footer>
          )}
        </DialogPrimitive.Content>
      </DialogPortal>
    </Dialog>
  );
}

/** Botões prontos para o rodapé: secundário, principal e perigo, com o mesmo tamanho. */
export function ModalButton({
  variant = 'secondary',
  className,
  ...props
}: Omit<React.ComponentProps<typeof Button>, 'variant'> & { variant?: 'secondary' | 'primary' | 'danger' | 'ghost' }) {
  const styles =
    variant === 'primary'
      ? PRIMARY_BUTTON
      : variant === 'danger'
        ? DANGER_BUTTON
        : variant === 'ghost'
          ? 'bg-transparent text-muted-foreground hover:bg-accent hover:text-accent-foreground'
          : 'border border-border bg-transparent text-foreground hover:bg-accent';
  return (
    <Button
      type="button"
      variant="ghost"
      className={cn('h-10 rounded-[10px] px-4 text-sm', variant === 'primary' || variant === 'danger' ? 'font-semibold' : 'font-medium', styles, className)}
      {...props}
    />
  );
}
