'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import Link from 'next/link';
import { Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { ErrorState, PAGE_CARD } from '@/components/page';
import { ConfirmDialog, FIELD, ModalButton, StatusChip } from '@/components/room-kit';
import { InitialsAvatar } from '@/components/common/InitialsAvatar';
import { useAuth } from '@/context/AuthContext';
import { cn } from '@/lib/utils';
import { promptApi } from '@/app/prompt-hub/api';
import type { PromptComment, PromptItem } from '@/app/prompt-hub/types';

export const COMMENT_LIMIT = 4000;

const whenLabel = (iso?: string) => {
  const date = iso ? new Date(iso) : null;
  if (!date || Number.isNaN(date.getTime())) return '';
  return formatDistanceToNow(date, { addSuffix: true, locale: ptBR });
};

interface DiscussionProps {
  item: Pick<PromptItem, 'id' | 'authorId'>;
  /** Pode remover o comentário de qualquer pessoa: dona do item ou administradora. */
  canModerate: boolean;
  authorSnapshot: () => { authorName: string; authorRole: string; authorSquad: string; authorAvatar: string };
  className?: string;
}

/** Conversa do item: comentários com até 4000 caracteres. Remove quem escreveu, a dona do item e a administradora. */
export function Discussion({ item, canModerate, authorSnapshot, className }: DiscussionProps) {
  const { session } = useAuth();
  const [comments, setComments] = useState<PromptComment[]>([]);
  const [state, setState] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle');
  const [draft, setDraft] = useState('');
  const [posting, setPosting] = useState(false);
  const [toRemove, setToRemove] = useState<PromptComment | null>(null);
  const [removing, setRemoving] = useState(false);
  // A resposta de um item aberto antes não pode sobrescrever a conversa do item atual.
  const activeId = useRef(item.id);
  useEffect(() => {
    activeId.current = item.id;
  }, [item.id]);

  const load = useCallback(async () => {
    if (!session) {
      setComments([]);
      setState('idle');
      return;
    }
    const requested = item.id;
    setState(prev => (prev === 'ready' ? prev : 'loading'));
    try {
      const data = await promptApi.getComments(requested);
      if (activeId.current !== requested) return;
      setComments(data);
      setState('ready');
    } catch (err) {
      console.warn('[prompt-hub] discussão indisponível', err);
      if (activeId.current !== requested) return;
      setState('error');
    }
  }, [item.id, session]);

  useEffect(() => {
    setDraft('');
    setComments([]);
    setState(session ? 'loading' : 'idle');
    void load();
  }, [load, session]);

  const post = async (event: React.FormEvent) => {
    event.preventDefault();
    const content = draft.trim();
    if (!session || !content || content.length > COMMENT_LIMIT || posting) return;
    setPosting(true);
    try {
      await promptApi.addComment(item.id, { authorId: session.id, ...authorSnapshot(), content });
      setDraft('');
      toast.success('Comentário publicado');
      await load();
    } catch (err) {
      toast.error('Erro ao comentar', { description: err instanceof Error ? err.message : undefined });
    } finally {
      setPosting(false);
    }
  };

  const remove = async () => {
    if (!toRemove) return;
    setRemoving(true);
    try {
      await promptApi.deleteComment(item.id, toRemove.id);
      setComments(prev => prev.filter(c => c.id !== toRemove.id));
      toast.success('Comentário removido');
      setToRemove(null);
    } catch (err) {
      toast.error('Erro ao remover o comentário', { description: err instanceof Error ? err.message : undefined });
    } finally {
      setRemoving(false);
    }
  };

  const length = draft.length;
  const tooLong = length > COMMENT_LIMIT;
  const removingOthers = !!toRemove && toRemove.authorId !== session?.id;

  return (
    <section aria-label="Discussão" className={cn(PAGE_CARD, 'flex flex-col gap-3.5 p-5', className)}>
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-base font-bold text-foreground">Discussão</h2>
        {state === 'ready' && (
          <span className="text-[13px] text-muted-foreground">
            {comments.length === 1 ? '1 comentário' : `${comments.length} comentários`}
          </span>
        )}
      </div>

      {session ? (
        <form onSubmit={post} className="flex flex-col gap-2">
          <label htmlFor={`comentario-${item.id}`} className="sr-only">
            Escreva um comentário
          </label>
          <textarea
            id={`comentario-${item.id}`}
            rows={3}
            value={draft}
            onChange={event => setDraft(event.target.value)}
            placeholder="Conte como usou, o que ajustou ou o que faltou"
            className={cn(FIELD, 'resize-y py-3 leading-normal')}
          />
          <div className="flex items-center justify-between gap-3">
            <span className={cn('text-xs tabular-nums', tooLong ? 'text-red-700 dark:text-red-300' : 'text-muted-foreground')} aria-live="polite">
              {length.toLocaleString('pt-BR')} de {COMMENT_LIMIT.toLocaleString('pt-BR')} caracteres
            </span>
            <ModalButton type="submit" variant="primary" disabled={posting || !draft.trim() || tooLong}>
              {posting ? 'Enviando…' : 'Comentar'}
            </ModalButton>
          </div>
        </form>
      ) : (
        <p className="text-sm text-muted-foreground">
          <Link href="/login" className="font-semibold text-foreground underline underline-offset-4">
            Entre
          </Link>{' '}
          para participar da conversa.
        </p>
      )}

      {session && state === 'loading' && <p className="text-sm text-muted-foreground">Carregando os comentários…</p>}
      {session && state === 'error' && (
        <ErrorState embedded title="Não foi possível carregar os comentários." description="Confira a conexão e tente de novo." onRetry={() => void load()} className="py-6" />
      )}
      {session && state === 'ready' && comments.length === 0 && (
        <p className="py-2 text-sm text-muted-foreground">Ninguém comentou ainda. Seja a primeira pessoa.</p>
      )}

      {comments.length > 0 && (
        <ul className="flex flex-col">
          {comments.map(comment => {
            const mine = comment.authorId === session?.id;
            const canRemove = !!session && (mine || canModerate);
            const isItemOwner = comment.authorId === item.authorId;
            return (
              <li key={comment.id} className="flex gap-3 border-t border-border pt-3.5 first:mt-0 [&:not(:first-child)]:mt-3.5">
                <InitialsAvatar name={comment.authorName} className="h-8 w-8 text-xs" />
                <div className="flex min-w-0 flex-1 flex-col gap-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <strong className="text-sm text-foreground">{mine ? 'Você' : comment.authorName || 'Membro'}</strong>
                    {isItemOwner && <StatusChip tone="brand" className="h-5">Autor do item</StatusChip>}
                    {comment.authorRole && <span className="text-[13px] text-muted-foreground">{comment.authorRole}</span>}
                    <span className="text-[13px] text-muted-foreground">{whenLabel(comment.createdAt)}</span>
                    <span className="flex-1" />
                    {canRemove && (
                      <button
                        type="button"
                        onClick={() => setToRemove(comment)}
                        aria-label={`Remover comentário de ${comment.authorName || 'Membro'}`}
                        className="inline-flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-[13px] font-semibold text-red-700 transition-colors duration-fast hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring dark:text-red-300"
                      >
                        <Trash2 className="h-3.5 w-3.5" strokeWidth={1.5} aria-hidden="true" />
                        Remover
                      </button>
                    )}
                  </div>
                  <p className="whitespace-pre-wrap break-words text-sm leading-normal text-foreground">{comment.content}</p>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <ConfirmDialog
        open={!!toRemove}
        onOpenChange={open => {
          if (!open) setToRemove(null);
        }}
        tone="danger"
        icon={Trash2}
        title="Remover este comentário?"
        description={toRemove ? `"${toRemove.content.length > 90 ? `${toRemove.content.slice(0, 90)}…` : toRemove.content}"` : undefined}
        confirmLabel="Remover comentário"
        loading={removing}
        loadingLabel="Removendo…"
        keepOpenOnConfirm
        onConfirm={remove}
      >
        {removingOthers && (
          <p className="rounded-[10px] border border-amber-500/35 bg-amber-500/10 px-3 py-2.5 text-[13px] text-foreground">
            Você está removendo o comentário de outra pessoa, como moderação do item.
          </p>
        )}
      </ConfirmDialog>
    </section>
  );
}
