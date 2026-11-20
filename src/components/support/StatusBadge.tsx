import { StatusChip } from '@/components/room-kit';
import { statusMeta } from '@/components/admin/tickets/ticket-utils';
import { cn } from '@/lib/utils';

const DOT: Record<string, string> = {
  danger: 'bg-red-500',
  warn: 'bg-amber-500',
  success: 'bg-emerald-500',
  neutral: 'bg-muted-foreground',
};

/** Status do chamado com os mesmos rótulos e cores da tela de Chamados do admin. */
export function StatusBadge({ status, className }: { status: string; className?: string }) {
  const meta = statusMeta(status);
  return (
    <StatusChip tone={meta.tone} className={cn('h-6 px-2.5', className)}>
      <span aria-hidden="true" className={cn('h-1.5 w-1.5 rounded-full', DOT[meta.tone])} />
      {meta.label}
    </StatusChip>
  );
}
