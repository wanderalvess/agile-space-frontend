'use client';

import { Ban, Flag, SkipForward } from 'lucide-react';
import { ModalButton } from '@/components/room-kit';
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
 * Ações do facilitador sobre a tarefa da mesa, sempre à vista e com texto:
 * pular/tirar da mesa e cancelar no refinamento à esquerda; "Encerrar sessão"
 * à direita, em grupo próprio e com tom de atenção, para não ser clicado sem querer.
 * Nenhuma é o botão primário da fase (esse é o "Revelar votos" da barra do topo).
 */
export function TaskActionsBar(p: TaskActionsBarProps) {
  if (!p.canTakeOffTable && !p.canCancel && !p.canFinish) return null;
  const hasLeft = p.canTakeOffTable || p.canCancel;
  const btn = 'gap-2 whitespace-nowrap max-sm:h-11';

  return (
    <section aria-label="Ações do facilitador" className={cn('flex flex-wrap items-center gap-2', p.className)}>
      {hasLeft && (
        <div className="flex flex-wrap items-center gap-2">
          {p.canTakeOffTable && (
            <ModalButton
              onClick={p.onTakeOffTable}
              title={p.canPark ? 'Pular de vez ou adiar para o fim da fila' : 'Sai da estimativa desta sessão'}
              className={btn}
            >
              <SkipForward className="h-4 w-4" strokeWidth={1.5} aria-hidden="true" />
              {p.canPark ? 'Tirar da mesa' : 'Pular tarefa'}
            </ModalButton>
          )}
          {p.canCancel && (
            <ModalButton onClick={p.onCancel} title="Descartada no refinamento, sai da estimativa desta sessão" className={btn}>
              <Ban className="h-4 w-4" strokeWidth={1.5} aria-hidden="true" />
              Cancelar tarefa
            </ModalButton>
          )}
        </div>
      )}
      {p.canFinish && (
        <div className={cn('flex items-center', hasLeft && 'ml-auto')}>
          <ModalButton
            onClick={p.onFinish}
            title="Gera o relatório; o que sobrar entra como não abordado"
            className={cn(btn, 'border border-red-600/50 bg-transparent text-red-700 hover:bg-red-500/10 dark:text-red-300')}
          >
            <Flag className="h-4 w-4" strokeWidth={1.5} aria-hidden="true" />
            Encerrar sessão
          </ModalButton>
        </div>
      )}
    </section>
  );
}
