'use client';

import { Ban, Flag, MoreHorizontal, SkipForward } from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { IconButton, IconTile } from '@/components/room-kit';
import { cn } from '@/lib/utils';

interface TaskActionsMenuProps {
  /** Tirar da mesa só existe antes de revelar. */
  canTakeOffTable: boolean;
  /** "Tirar da mesa" (pular ou adiar) ou só "Pular tarefa" quando adiar está desligado. */
  canPark: boolean;
  onTakeOffTable: () => void;
  canCancel: boolean;
  onCancel: () => void;
  canFinish: boolean;
  onFinish: () => void;
}

/** Menu "mais ações da tarefa": tirar da mesa, cancelar no refinamento, encerrar a sessão. */
export function TaskActionsMenu(p: TaskActionsMenuProps) {
  if (!p.canTakeOffTable && !p.canCancel && !p.canFinish) return null;

  const item = (opts: { icon: typeof Ban; tone: 'warn' | 'neutral' | 'danger'; title: string; desc: string; onClick: () => void }) => (
    <DropdownMenuItem key={opts.title} onClick={opts.onClick} className="items-start gap-3 rounded-[10px] px-3 py-2.5">
      <IconTile icon={opts.icon} tone={opts.tone} size="sm" className="mt-0.5 h-[30px] w-[30px] rounded-lg" />
      <span className="flex flex-col gap-0.5">
        <span className={cn('text-sm font-semibold', opts.tone === 'warn' && 'text-amber-700 dark:text-amber-300', opts.tone === 'danger' && 'text-red-700 dark:text-red-300')}>{opts.title}</span>
        <span className="text-xs leading-snug text-muted-foreground">{opts.desc}</span>
      </span>
    </DropdownMenuItem>
  );

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <IconButton label="Mais ações da tarefa" icon={MoreHorizontal} className="h-[38px] w-[38px] rounded-[10px]" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80 rounded-[14px] p-1.5">
        {p.canTakeOffTable && item({
          icon: SkipForward,
          tone: 'warn',
          title: p.canPark ? 'Tirar da mesa' : 'Pular tarefa',
          desc: p.canPark ? 'Pular de vez ou adiar para o fim da fila' : 'Sai da estimativa desta sessão',
          onClick: p.onTakeOffTable,
        })}
        {p.canCancel && item({ icon: Ban, tone: 'neutral', title: 'Cancelar tarefa', desc: 'Descartada no refinamento, sai da estimativa desta sessão', onClick: p.onCancel })}
        {p.canFinish && item({ icon: Flag, tone: 'danger', title: 'Encerrar sessão', desc: 'Gera o relatório; o que sobrar entra como não abordado', onClick: p.onFinish })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
