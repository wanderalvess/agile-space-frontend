'use client';

import React from 'react';
import { AlertCircle, Loader2, SearchX, Trash2 } from 'lucide-react';
import { IconTile, ModalButton } from '@/components/room-kit';

export type BrainstormRoomStateKind = 'loading' | 'notfound' | 'error' | 'deleted';

const COPY: Record<BrainstormRoomStateKind, { title: string; text: string }> = {
  loading: { title: 'Carregando o brainstorming…', text: 'Reunindo as ideias, os grupos e quem está na sala.' },
  notfound: { title: 'Brainstorming não encontrado', text: 'O link pode estar incompleto ou o facilitador apagou a sessão. Confira o endereço ou volte para o Brainstorming.' },
  error: { title: 'Não foi possível carregar o brainstorming', text: 'Houve um problema de conexão com o servidor. As ideias já lançadas estão salvas. Tente de novo em instantes.' },
  deleted: { title: 'Esta sessão foi encerrada', text: 'O facilitador apagou o mural. Você volta para o Brainstorming em instantes.' },
};

/**
 * Tela cheia dos estados em que a sala não abre: carregando, não encontrado, falha de conexão (com "Tentar de novo",
 * para uma falha de rede não parecer "não encontrado") e sessão apagada pelo facilitador.
 */
export function BrainstormRoomState({
  kind,
  onRetry,
  onBack,
}: {
  kind: BrainstormRoomStateKind;
  onRetry?: () => void;
  onBack?: () => void;
}) {
  const { title, text } = COPY[kind];
  const Icon = kind === 'loading' ? Loader2 : kind === 'notfound' ? SearchX : kind === 'deleted' ? Trash2 : AlertCircle;
  return (
    <div
      role={kind === 'loading' ? 'status' : 'alert'}
      aria-busy={kind === 'loading'}
      className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-background p-6 text-center text-foreground"
    >
      <IconTile icon={Icon} size="lg" tone={kind === 'error' ? 'danger' : kind === 'loading' ? 'brand' : 'neutral'} className={kind === 'loading' ? '[&_svg]:motion-safe:animate-spin' : undefined} />
      <h1 className="m-0 text-xl font-bold">{title}</h1>
      <p className="m-0 max-w-sm text-sm text-muted-foreground">{text}</p>
      {kind !== 'loading' && (
        <div className="flex flex-wrap justify-center gap-2">
          {kind === 'error' && onRetry && <ModalButton variant="primary" onClick={onRetry}>Tentar de novo</ModalButton>}
          {onBack && (
            <ModalButton variant={kind === 'error' ? 'secondary' : 'primary'} onClick={onBack}>
              {kind === 'deleted' ? 'Ir agora para o Brainstorming' : 'Voltar para o Brainstorming'}
            </ModalButton>
          )}
        </div>
      )}
    </div>
  );
}
