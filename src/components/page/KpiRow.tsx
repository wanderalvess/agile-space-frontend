import type { LucideIcon } from 'lucide-react';
import { IconTile, type Tone } from '@/components/room-kit';
import { cn } from '@/lib/utils';
import { PAGE_CARD } from './styles';

export interface KpiCardProps {
  label: string;
  /** O número ou texto grande. */
  value: React.ReactNode;
  /** Linha pequena abaixo do valor (unidade, regra, comparação). */
  hint?: React.ReactNode;
  icon?: LucideIcon;
  tone?: Tone;
  className?: string;
}

/** Um número do topo da página: rótulo, valor grande, dica e ícone. */
export function KpiCard({ label, value, hint, icon, tone = 'brand', className }: KpiCardProps) {
  return (
    <div className={cn(PAGE_CARD, 'flex items-start justify-between gap-2.5 rounded-[14px] px-[18px] py-4', className)}>
      <div className="flex min-w-0 flex-col gap-0.5">
        <span className="text-[13px] font-semibold text-muted-foreground">{label}</span>
        <span className="text-[28px] font-bold leading-tight tabular-nums text-foreground">{value}</span>
        {hint && <span className="text-xs text-muted-foreground">{hint}</span>}
      </div>
      {icon && <IconTile icon={icon} tone={tone} size="md" />}
    </div>
  );
}

const COLUMNS = {
  2: 'sm:grid-cols-2',
  3: 'sm:grid-cols-2 xl:grid-cols-3',
  4: 'sm:grid-cols-2 xl:grid-cols-4',
} as const;

/** Faixa de KpiCards: uma coluna no celular, duas em tablet e até quatro no desktop. */
export function KpiRow({ children, columns = 4, className }: { children: React.ReactNode; columns?: keyof typeof COLUMNS; className?: string }) {
  return <div className={cn('grid grid-cols-1 gap-3', COLUMNS[columns], className)}>{children}</div>;
}
