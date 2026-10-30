'use client';

import { Ban, ChevronDown, Flag, SkipForward } from 'lucide-react';
import { ModalButton } from '@/components/room-kit';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';

interface TaskActionsBarProps {
  /** Tirar da mesa só existe antes de revelar. */
  canTakeOffTable: boolean;
  /** "Tirar da mesa" (pular ou adiar) ou só "Pular tarefa" quando adiar está desligado. */
  canPark: boolean;
  onTakeOffTable: () => void;
  canCancel: boolean;
  onCancel: () => void;
  canFinish: boolean;
  onFinish: () => void;
  className?: string;
}

/**
 * Ações do facilitador sobre a tarefa da mesa, na barra do topo ao lado da ação principal:
 * "Pular" fica à vista (é a mais usada); cancelar a tarefa e encerrar a sessão moram no menu
 * "Rodada", longe de um clique sem querer. Nenhuma é o botão primário da fase.
 */
export function TaskActionsBar(p: TaskActionsBarProps) {
  if (!p.canTakeOffTable && !p.canCancel && !p.canFinish) return null;
  const btn = 'h-9 gap-2 whitespace-nowrap px-3 text-sm max-sm:h-11';
  const hasMenu = p.canCancel || p.canFinish;

  return (
    <section aria-label="Ações do facilitador" className={cn('flex flex-wrap items-center gap-2', p.className)}>
      {p.canTakeOffTable && (
        <ModalButton
          onClick={p.onTakeOffTable}
          title={p.canPark ? 'Tirar da mesa: pular de vez ou adiar para o fim da fila' : 'Pular tarefa: sai da estimativa desta sessão'}
          className={btn}
        >
          <SkipForward className="h-4 w-4" strokeWidth={1.5} aria-hidden="true" />
          Pular
        </ModalButton>
      )}
      {hasMenu && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <ModalButton aria-label="Rodada: cancelar a tarefa ou encerrar a sessão" className={btn}>
              Rodada
              <ChevronDown className="h-4 w-4" strokeWidth={1.5} aria-hidden="true" />
            </ModalButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-64">
            {p.canCancel && (
              <DropdownMenuItem onClick={p.onCancel} className="gap-2">
                <Ban className="h-4 w-4" strokeWidth={1.5} aria-hidden="true" />
                <span className="flex flex-col">
                  <span>Cancelar tarefa</span>
                  <span className="text-xs text-muted-foreground">Descartada no refinamento</span>
                </span>
              </DropdownMenuItem>
            )}
            {p.canCancel && p.canFinish && <DropdownMenuSeparator />}
            {p.canFinish && (
              <DropdownMenuItem onClick={p.onFinish} className="gap-2 text-red-700 focus:text-red-700 dark:text-red-300 dark:focus:text-red-300">
                <Flag className="h-4 w-4" strokeWidth={1.5} aria-hidden="true" />
                <span className="flex flex-col">
                  <span>Encerrar sessão</span>
                  <span className="text-xs text-muted-foreground">Gera o relatório</span>
                </span>
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </section>
  );
}
