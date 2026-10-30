'use client';

import Link from 'next/link';
import { X, type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { FOCUS_RING, IconTile, TINT_TEXT } from './home-ui';

export type NoticeVariant = 'info' | 'important' | 'maintenance';

const BOX: Record<NoticeVariant, string> = {
  info: 'border-border border-l-[3px] border-l-primary bg-card',
  important: 'border-amber-500/40 bg-amber-500/10',
  maintenance: 'border-dashed border-border bg-card',
};

const LABEL_COLOR: Record<NoticeVariant, string> = {
  info: TINT_TEXT,
  important: 'text-amber-700 dark:text-amber-400',
  maintenance: 'text-muted-foreground',
};

interface Props {
  variant?: NoticeVariant;
  icon: LucideIcon;
  /** Rótulo em caixa alta antes do título ("AVISO"). */
  label?: string;
  title: string;
  text?: string;
  meta?: string;
  action?: { label: string; href: string };
  onDismiss: () => void;
  dismissLabel?: string;
  /** Uma linha só: sem rótulo, texto de apoio nem meta. Usado nos avisos de boas-vindas. */
  compact?: boolean;
  className?: string;
}

/** Faixa de aviso da Home: informativo, importante ou manutenção. Sempre dispensável. */
export function Notice({
  variant = 'info',
  icon,
  label,
  title,
  text,
  meta,
  action,
  onDismiss,
  dismissLabel = 'Dispensar aviso',
  compact = false,
  className,
}: Props) {
  const external = action ? /^https?:\/\//i.test(action.href) : false;
  const actionClass = cn('shrink-0 whitespace-nowrap text-[13px] font-semibold hover:underline', TINT_TEXT, FOCUS_RING, 'rounded-sm');
  // Em tela estreita o link desce para baixo do texto (senão espreme o título); a partir de sm fica ao lado.
  const renderAction = (extra: string) =>
    action &&
    (external ? (
      <a href={action.href} target="_blank" rel="noopener noreferrer" className={cn(actionClass, extra)}>
        {action.label}
      </a>
    ) : (
      <Link href={action.href} className={cn(actionClass, extra)}>
        {action.label}
      </Link>
    ));

  return (
    <section role="status" className={cn('flex gap-3.5 rounded-2xl border p-3.5', compact ? 'items-center' : 'items-start', BOX[variant], className)}>
      <IconTile
        icon={icon}
        size={compact ? 'sm' : 'md'}
        muted={variant === 'maintenance'}
        className={variant === 'important' ? 'bg-amber-500/15 text-amber-700 dark:text-amber-400' : undefined}
      />
      <div className={cn('flex min-w-0 flex-1 flex-col', compact ? 'text-[13px]' : 'gap-0.5')}>
        {compact ? (
          <p className="truncate font-semibold sm:whitespace-normal">
            {title}
            {text ? <span className="font-normal text-muted-foreground"> {text}</span> : null}
          </p>
        ) : (
          <>
            <p className="flex flex-wrap items-center gap-x-2">
              {label && <span className={cn('text-xs font-bold uppercase tracking-wider', LABEL_COLOR[variant])}>{label}</span>}
              <span className="text-sm font-bold">{title}</span>
            </p>
            {text && <p className="text-[13px] leading-relaxed text-muted-foreground">{text}</p>}
            {meta && <p className="text-xs text-muted-foreground">{meta}</p>}
            {renderAction('mt-1 self-start sm:hidden')}
          </>
        )}
      </div>
      {renderAction(compact ? '' : 'hidden sm:inline-block')}
      <button
        type="button"
        onClick={onDismiss}
        aria-label={dismissLabel}
        className={cn(
          'flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors max-sm:h-11 max-sm:w-11 hover:bg-muted/60 hover:text-foreground',
          FOCUS_RING,
        )}
      >
        <X aria-hidden="true" className="h-4 w-4" strokeWidth={1.5} />
      </button>
    </section>
  );
}
