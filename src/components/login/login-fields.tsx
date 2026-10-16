'use client';

import React, { forwardRef } from 'react';
import { AlertCircle, ArrowRight, Eye, EyeOff, Loader2, TriangleAlert, type LucideIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { passwordStrength, type StrengthTone } from './login-utils';

/**
 * Peças dos formulários do login. Só tokens semânticos, para valer nos 7 temas em claro e escuro.
 * Em tela baixa (notebook 1366x768) os campos encolhem para o cartão caber sem rolagem.
 */

/** Texto na cor de destaque. No TOTVS claro (ciano) não tem contraste: cai para o texto padrão. */
export const TINT_TEXT = 'text-primary [.theme-totvs:not(.dark)_&]:text-foreground';

export const FOCUS_RING =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background';

const LABEL = 'text-[13px] font-semibold text-foreground';
const INPUT =
  'h-11 [@media(max-height:760px)]:h-10 rounded-xl border-input bg-background/60 text-[15px] md:text-[15px] text-foreground placeholder:text-muted-foreground/70 pl-10 transition-colors';
const INPUT_ERROR = 'border-destructive focus-visible:ring-destructive';

export function FieldError({ id, message }: { id: string; message?: string }) {
  if (!message) return null;
  return (
    <p id={id} role="alert" className="flex items-center gap-1.5 text-xs font-medium text-destructive dark:text-red-300">
      <AlertCircle aria-hidden="true" strokeWidth={1.5} className="h-3.5 w-3.5 shrink-0" /> {message}
    </p>
  );
}

export function CapsLockNote() {
  return (
    <p className="flex items-center gap-1.5 text-xs font-medium text-amber-700 dark:text-amber-400">
      <TriangleAlert aria-hidden="true" strokeWidth={1.5} className="h-3.5 w-3.5 shrink-0" /> Caps Lock ativado
    </p>
  );
}

interface TextFieldProps extends Omit<React.ComponentProps<'input'>, 'className'> {
  id: string;
  label: string;
  icon: LucideIcon;
  error?: string;
  /** Conteúdo à direita do rótulo (ex.: "Esqueceu a senha?"). */
  aside?: React.ReactNode;
  /** Botão dentro do campo, à direita (ex.: mostrar senha). */
  trailing?: React.ReactNode;
  /** Informações abaixo do campo (aviso de Caps Lock, força da senha). */
  children?: React.ReactNode;
}

/** Campo com rótulo visível, ícone de linha, mensagem de erro ligada por aria-describedby. */
export const TextField = forwardRef<HTMLInputElement, TextFieldProps>(function TextField(
  { id, label, icon: Icon, error, aside, trailing, children, 'aria-describedby': describedBy, ...input },
  ref,
) {
  const errorId = `${id}-err`;
  return (
    <div className="space-y-1.5">
      <div className="flex items-baseline justify-between gap-2">
        <label htmlFor={id} className={LABEL}>
          {label}
        </label>
        {aside}
      </div>
      <div className="relative">
        <Icon
          aria-hidden="true"
          strokeWidth={1.5}
          className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
        />
        <Input
          id={id}
          ref={ref}
          aria-invalid={!!error}
          aria-describedby={[error ? errorId : null, describedBy].filter(Boolean).join(' ') || undefined}
          className={cn(INPUT, trailing && 'pr-11', error && INPUT_ERROR)}
          {...input}
        />
        {trailing}
      </div>
      <FieldError id={errorId} message={error} />
      {children}
    </div>
  );
});

/** Olho que mostra ou oculta a senha. */
export function PasswordToggle({ shown, onToggle, disabled }: { shown: boolean; onToggle: () => void; disabled?: boolean }) {
  const Icon = shown ? EyeOff : Eye;
  return (
    <button
      type="button"
      onClick={onToggle}
      disabled={disabled}
      aria-label={shown ? 'Ocultar senha' : 'Mostrar senha'}
      aria-pressed={shown}
      className={cn(
        'absolute right-1.5 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:text-foreground',
        FOCUS_RING,
      )}
    >
      <Icon aria-hidden="true" strokeWidth={1.5} className="h-[18px] w-[18px]" />
    </button>
  );
}

const TONE_BAR: Record<StrengthTone, string> = {
  weak: 'bg-destructive',
  fair: 'bg-amber-500',
  good: 'bg-emerald-500',
};

/** Medidor de força da senha (4 trechos). Só aparece depois de digitar. */
export function StrengthMeter({ id, password }: { id: string; password: string }) {
  if (!password) return null;
  const { score, label, tone } = passwordStrength(password);
  return (
    <div id={id} aria-live="polite" className="flex items-center gap-3">
      <div className="grid flex-1 grid-cols-4 gap-1" aria-hidden="true">
        {[1, 2, 3, 4].map((n) => (
          <span key={n} className={cn('h-1.5 rounded-full transition-colors', n <= score ? TONE_BAR[tone] : 'bg-border')} />
        ))}
      </div>
      <span className="min-w-[72px] text-right text-xs font-semibold text-foreground">{label}</span>
    </div>
  );
}

const BUTTON_BASE =
  'group h-11 [@media(max-height:760px)]:h-10 w-full rounded-xl text-[15px] font-bold shadow-sm transition-colors';

/** Botão principal do formulário: ícone de seta, ou o giro de carregamento com o rótulo de andamento. */
export function SubmitButton({ loading, idle, busy }: { loading: boolean; idle: string; busy: string }) {
  return (
    <Button type="submit" disabled={loading} className={cn(BUTTON_BASE, 'bg-primary text-primary-foreground hover:bg-primary/90')}>
      {loading ? (
        <>
          <Loader2 aria-hidden="true" className="animate-spin" /> {busy}
        </>
      ) : (
        <>
          {idle}
          <ArrowRight aria-hidden="true" strokeWidth={1.75} className="motion-safe:transition-transform motion-safe:group-hover:translate-x-0.5" />
        </>
      )}
    </Button>
  );
}

export function SecondaryButton({ children, ...props }: React.ComponentProps<typeof Button>) {
  return (
    <Button
      type="button"
      variant="outline"
      {...props}
      className={cn(BUTTON_BASE, 'border-border bg-transparent font-semibold text-foreground hover:bg-accent')}
    >
      {children}
    </Button>
  );
}

export function GhostButton({ children, ...props }: React.ComponentProps<typeof Button>) {
  return (
    <Button
      type="button"
      variant="ghost"
      {...props}
      className={cn(BUTTON_BASE, 'font-semibold text-muted-foreground shadow-none hover:bg-accent hover:text-foreground')}
    >
      {children}
    </Button>
  );
}
