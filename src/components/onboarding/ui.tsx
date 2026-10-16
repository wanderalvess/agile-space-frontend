'use client';

/**
 * Peças compartilhadas das telas do /onboarding. Só tokens semânticos (card, border, primary, muted...)
 * e o kit de sala, para valer nos 7 temas em claro e escuro. Texto nunca leva degradê; ícones são de linha 1.5.
 */

import { useEffect, useRef } from 'react';
import { ArrowLeft, Loader2, type LucideIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { BRAND_TEXT, CARD_SHADOW, FOCUS_RING, TONES, type Tone } from '@/components/room-kit/tokens';

/** Cartão de cada passo: surge com uma subida curta (parada com "reduzir movimento"). */
export function StepCard({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <section
      className={cn(
        'flex w-full flex-col gap-5 rounded-[20px] border border-border bg-card p-5 text-card-foreground sm:p-8',
        'motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-2 motion-safe:duration-200',
        CARD_SHADOW,
        className,
      )}
    >
      {children}
    </section>
  );
}

/** Título do passo. Recebe o foco ao aparecer, para quem usa leitor de tela ouvir em que passo está. */
export function StepHeading({ title, subtitle, pill }: { title: React.ReactNode; subtitle?: React.ReactNode; pill?: string }) {
  const ref = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    ref.current?.focus({ preventScroll: true });
  }, []);
  return (
    <div className="flex flex-col items-start gap-2">
      {!!pill && (
        <span className="inline-flex h-[22px] items-center rounded-full border border-border px-2.5 text-xs font-bold uppercase tracking-wider text-muted-foreground">
          {pill}
        </span>
      )}
      <h1 ref={ref} tabIndex={-1} className="text-[26px] font-bold leading-[1.15] tracking-tight outline-none sm:text-[28px]">
        {title}
      </h1>
      {!!subtitle && <p className="text-[15px] leading-relaxed text-muted-foreground">{subtitle}</p>}
    </div>
  );
}

/** Rótulo curto em caixa alta (campos, grupos). */
export function Caption({ children, className }: { children: React.ReactNode; className?: string }) {
  return <span className={cn('text-xs font-bold uppercase tracking-wider text-muted-foreground', className)}>{children}</span>;
}

export function Spinner({ className }: { className?: string }) {
  return <Loader2 aria-hidden="true" className={cn('h-4 w-4 animate-spin motion-reduce:animate-none', className)} strokeWidth={1.5} />;
}

/** Botão "Voltar" discreto, com seta. */
export function BackButton({ onClick, children = 'Voltar', disabled, className }: { onClick: () => void; children?: React.ReactNode; disabled?: boolean; className?: string }) {
  return (
    <Button type="button" variant="ghost" onClick={onClick} disabled={disabled} className={cn('-ml-2 h-9 gap-1.5 self-start px-2 text-sm text-muted-foreground hover:text-foreground', className)}>
      <ArrowLeft aria-hidden="true" className="h-3.5 w-3.5" strokeWidth={1.5} />
      {children}
    </Button>
  );
}

/** Ação principal em largura total (entrar, criar, enviar). */
export const WIDE_CTA = 'h-12 w-full gap-2 rounded-[10px] text-sm font-bold';

/** Aviso em linha dentro do cartão: ponto de tom, texto e, à direita, as ações. */
export function InlineNotice({
  tone = 'danger',
  role,
  icon: Icon,
  children,
  actions,
  className,
}: {
  tone?: Tone;
  role?: 'alert' | 'status';
  icon?: LucideIcon;
  children: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
}) {
  const border = tone === 'danger' ? 'border-red-500/40' : tone === 'warn' ? 'border-amber-500/40' : tone === 'success' ? 'border-emerald-500/40' : 'border-border';
  return (
    <div role={role} className={cn('flex flex-wrap items-center gap-x-3 gap-y-2 rounded-xl border bg-muted/40 px-3.5 py-3', border, className)}>
      {Icon ? (
        <Icon aria-hidden="true" className={cn('h-[18px] w-[18px] shrink-0', TONES[tone].text)} strokeWidth={1.5} />
      ) : (
        <span aria-hidden="true" className={cn('h-2 w-2 shrink-0 rounded-full bg-current', TONES[tone].text)} />
      )}
      <span className="min-w-0 flex-1 basis-56 text-sm leading-relaxed">{children}</span>
      {actions && <span className="flex flex-wrap items-center gap-2">{actions}</span>}
    </div>
  );
}

/** Botão pequeno de contorno para as ações de linha e de aviso. */
export function SmallButton({ className, ...props }: React.ComponentProps<typeof Button>) {
  return <Button type="button" variant="outline" className={cn('h-8 rounded-[10px] px-3 text-[13px] font-semibold', className)} {...props} />;
}

/** Texto de marca legível em todos os temas (no TOTVS claro vira o texto padrão). */
export const BRAND_LINK = cn('rounded-sm text-sm font-semibold hover:underline', BRAND_TEXT, FOCUS_RING);

/** Lista com borda, separadores e rolagem opcional. */
export function ListBox({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn('divide-y divide-border overflow-hidden rounded-2xl border border-border', className)}>{children}</div>;
}

/** Cartão de escolha (intenção, papel): ícone, título, descrição e dica. */
export function ChoiceCard({
  icon: Icon,
  title,
  description,
  hint,
  onClick,
  disabled,
  busy,
  emphasis,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  hint: string;
  onClick: () => void;
  disabled?: boolean;
  busy?: boolean;
  emphasis?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'flex flex-col items-start gap-2.5 rounded-2xl border p-5 text-left transition-[border-color,background-color,transform] duration-200',
        'motion-safe:hover:-translate-y-0.5 disabled:pointer-events-none disabled:opacity-60',
        FOCUS_RING,
        emphasis ? 'border-primary/40 bg-primary/5 hover:border-primary' : 'border-border bg-muted/30 hover:border-primary/50',
      )}
    >
      <span aria-hidden="true" className={cn('flex h-11 w-11 items-center justify-center rounded-xl', TONES.brand.tile)}>
        {busy ? <Spinner className="h-5 w-5" /> : <Icon className="h-[22px] w-[22px]" strokeWidth={1.5} />}
      </span>
      <span className="text-base font-bold">{title}</span>
      <span className="text-[13px] leading-relaxed text-muted-foreground">{description}</span>
      <span className="mt-auto pt-1 text-xs text-muted-foreground">{hint}</span>
    </button>
  );
}
