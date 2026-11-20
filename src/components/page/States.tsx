import { AlertCircle, Inbox, Loader2, RefreshCw, type LucideIcon } from 'lucide-react';
import { IconTile, ModalButton, type Tone } from '@/components/room-kit';
import { cn } from '@/lib/utils';
import { ICON_STROKE, PAGE_CARD } from './styles';

interface StateBoxProps {
  icon: LucideIcon;
  tone: Tone;
  title: string;
  description?: React.ReactNode;
  children?: React.ReactNode;
  /** Sem borda tracejada: para dentro de um cartão ou tabela. */
  embedded?: boolean;
  role?: 'alert' | 'status';
  className?: string;
}

function StateBox({ icon, tone, title, description, children, embedded, role, className }: StateBoxProps) {
  return (
    <section
      role={role}
      className={cn(
        'flex flex-col items-center gap-3.5 px-8 py-11 text-center',
        !embedded && 'rounded-[18px] border border-dashed border-border',
        className,
      )}
    >
      <IconTile icon={icon} tone={tone} size="lg" />
      <h2 className="text-[22px] font-bold text-foreground">{title}</h2>
      {description && <p className="max-w-md text-sm text-muted-foreground">{description}</p>}
      {children && <div className="flex flex-wrap justify-center gap-2">{children}</div>}
    </section>
  );
}

export interface EmptyStateProps {
  title: string;
  description?: React.ReactNode;
  /** Ícone do módulo ou do assunto. Padrão: caixa de entrada. */
  icon?: LucideIcon;
  /** Botões (ModalButton). */
  actions?: React.ReactNode;
  embedded?: boolean;
  className?: string;
}

/** Nada para mostrar ainda: diz o que é e o que fazer a seguir. */
export function EmptyState({ title, description, icon = Inbox, actions, embedded, className }: EmptyStateProps) {
  return (
    <StateBox icon={icon} tone="brand" title={title} description={description} embedded={embedded} className={className}>
      {actions}
    </StateBox>
  );
}

export interface ErrorStateProps {
  title?: string;
  description?: React.ReactNode;
  onRetry?: () => void;
  retryLabel?: string;
  embedded?: boolean;
  className?: string;
}

/** Falha ao carregar: leitor de tela anuncia, com "Tentar de novo". Nunca deixe a tela parecer vazia. */
export function ErrorState({
  title = 'Não foi possível carregar',
  description = 'Confira a conexão e tente de novo.',
  onRetry,
  retryLabel = 'Tentar de novo',
  embedded,
  className,
}: ErrorStateProps) {
  return (
    <StateBox icon={AlertCircle} tone="danger" title={title} description={description} embedded={embedded} role="alert" className={className}>
      {onRetry && (
        <ModalButton variant="primary" onClick={onRetry}>
          <RefreshCw className="h-4 w-4" strokeWidth={ICON_STROKE} aria-hidden="true" /> {retryLabel}
        </ModalButton>
      )}
    </StateBox>
  );
}

const SK = 'rounded-md bg-muted motion-safe:animate-pulse';

export interface LoadingSkeletonProps {
  /** `kpis`: a faixa de números; `table`: lista de linhas; `cards`: grade de cartões; `page`: kpis + tabela. */
  variant?: 'kpis' | 'table' | 'cards' | 'page';
  rows?: number;
  /** Texto para leitor de tela. Ex.: "Carregando o time da squad". */
  label?: string;
  className?: string;
}

function KpiSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className={cn(PAGE_CARD, 'h-[104px] rounded-[14px] motion-safe:animate-pulse')} />
      ))}
    </div>
  );
}

function TableSkeleton({ rows }: { rows: number }) {
  return (
    <section className={cn(PAGE_CARD, 'overflow-clip')}>
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="flex items-center gap-3 border-t border-border px-5 py-3.5 first:border-t-0">
          <span className={cn(SK, 'h-8 w-8 rounded-full')} />
          <span className={cn(SK, 'h-3 w-40 sm:w-56')} />
          <span className="flex-1" />
          <span className={cn(SK, 'h-3 w-20 sm:w-32')} />
        </div>
      ))}
    </section>
  );
}

function CardsSkeleton({ count }: { count: number }) {
  return (
    <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 xl:grid-cols-3">
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className={cn(PAGE_CARD, 'h-[148px] motion-safe:animate-pulse')} />
      ))}
    </div>
  );
}

/** Esqueleto no lugar do conteúdo: mesma altura aproximada, sem pular o layout. */
export function LoadingSkeleton({ variant = 'page', rows = 6, label = 'Carregando', className }: LoadingSkeletonProps) {
  return (
    <div className={cn('flex flex-col gap-5', className)} aria-busy="true">
      <div role="status" className="flex items-center gap-3 text-sm text-muted-foreground">
        <Loader2 className="h-[18px] w-[18px] animate-spin motion-reduce:animate-none" strokeWidth={ICON_STROKE} aria-hidden="true" />
        {label}
      </div>
      {(variant === 'kpis' || variant === 'page') && <KpiSkeleton />}
      {(variant === 'table' || variant === 'page') && <TableSkeleton rows={rows} />}
      {variant === 'cards' && <CardsSkeleton count={rows} />}
    </div>
  );
}
