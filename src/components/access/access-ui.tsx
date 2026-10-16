'use client';

import * as React from 'react';
import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { CARD_SHADOW, TONES, type Tone } from '@/components/room-kit/tokens';
import { ModalButton } from '@/components/room-kit/Modal';

/**
 * Peças das telas de acesso (aceitar convite, redefinir a senha): cartão central, placa do ícone e botões de 44 px.
 * Só tokens do tema, então valem nos 7 temas x claro/escuro.
 */

/** Área da página: centraliza o cartão debaixo do cabeçalho do app. */
export function AccessPage({ children }: { children: React.ReactNode }) {
  return <div className="flex flex-1 items-center justify-center bg-background px-4 py-8 sm:px-6">{children}</div>;
}

const CARD_WIDTH = { sm: 'max-w-[440px]', md: 'max-w-[480px]' } as const;

export function AccessCard({
  width = 'md',
  className,
  children,
  ...rest
}: { width?: keyof typeof CARD_WIDTH } & React.HTMLAttributes<HTMLElement>) {
  return (
    <section
      {...rest}
      className={cn(
        'flex w-full flex-col gap-5 rounded-[20px] border border-border bg-card p-6 text-card-foreground sm:p-8',
        CARD_SHADOW,
        CARD_WIDTH[width],
        className,
      )}
    >
      {children}
    </section>
  );
}

/** Placa de 52 px do topo do cartão. */
export function StateTile({ icon: Icon, tone = 'brand', spin = false }: { icon: LucideIcon; tone?: Tone; spin?: boolean }) {
  return (
    <span aria-hidden="true" className={cn('flex h-[52px] w-[52px] shrink-0 items-center justify-center rounded-2xl', TONES[tone].tile)}>
      <Icon className={cn('h-[26px] w-[26px]', spin && 'animate-spin motion-reduce:animate-none')} strokeWidth={1.5} />
    </span>
  );
}

/** Título + frase de apoio, centralizados (estados de convite). */
export function CenteredHeading({ title, text, children }: { title: React.ReactNode; text?: React.ReactNode; children?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-1.5 text-center">
      <h1 className="text-[26px] font-bold leading-tight tracking-tight text-foreground max-sm:text-2xl">{title}</h1>
      {text && <p className="text-[15px] leading-relaxed text-muted-foreground">{text}</p>}
      {children}
    </div>
  );
}

const BIG = 'h-11 w-full text-[15px] sm:w-auto';

export function AccessButton({ className, ...props }: React.ComponentProps<typeof ModalButton>) {
  return <ModalButton {...props} className={cn(BIG, className)} />;
}

/** Campo de senha do cartão: 46 px, mesma borda e foco do kit. */
export const ACCESS_INPUT =
  'h-[46px] w-full rounded-[10px] border border-border bg-muted/40 px-3.5 text-[15px] text-foreground placeholder:text-muted-foreground ' +
  'transition-colors duration-fast focus-visible:border-primary/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50';
