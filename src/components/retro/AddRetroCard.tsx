'use client';

import { useEffect, useRef, useState } from 'react';
import { Calendar, Plus, Send, UserPlus } from 'lucide-react';
import { Textarea } from '@/components/ui/textarea';
import { FIELD, FOCUS_RING } from '@/components/room-kit';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import type { RetroColumnKey, RetroParticipant } from '@/lib/types';

interface AddRetroCardProps {
  columnKey: RetroColumnKey;
  /** Coluna de plano de ação: o campo pede responsável e prazo. */
  isActionColumn: boolean;
  onAddCard: (content: string, columnKey: RetroColumnKey, assignee?: string, dueDate?: string) => Promise<boolean> | void;
  participants: RetroParticipant[];
  /**
   * `button`: botão tracejado ("Adicionar cartão") que abre o campo — visão em quadro.
   * `field`: campo sempre aberto no topo — visão em foco.
   */
  variant: 'button' | 'field';
  /** Campo aberto (só na variante `button`; controlado pela coluna, que também o abre pelo estado vazio). */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  addLabel?: string;
}

/** Campo de novo cartão (ou nova ação). O texto só some depois que o servidor aceitou: se falhar, ele continua ali. */
export function AddRetroCard({ columnKey, isActionColumn, onAddCard, participants, variant, open = false, onOpenChange, addLabel }: AddRetroCardProps) {
  const [content, setContent] = useState('');
  const [assignee, setAssignee] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const { toast } = useToast();
  const isOpen = variant === 'field' || open;
  const label = addLabel ?? (isActionColumn ? 'Nova ação' : 'Adicionar cartão');
  const placeholder = isActionColumn ? 'Nova ação para o time…' : 'Escreva seu feedback aqui…';

  useEffect(() => {
    if (variant === 'button' && open) textareaRef.current?.focus();
  }, [variant, open]);

  // Cresce com o texto, até um limite.
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
  }, [content, isOpen]);

  const submit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (submitting) return;
    const text = content.trim();
    if (!text) {
      toast({ title: 'Campo obrigatório', description: 'O cartão não pode estar vazio.', variant: 'destructive' });
      return;
    }
    setSubmitting(true);
    try {
      const ok = await onAddCard(text, columnKey, assignee.trim() || undefined, dueDate || undefined);
      if (ok !== false) {
        setContent('');
        setAssignee('');
        setDueDate('');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      void submit();
    } else if (e.key === 'Escape' && variant === 'button') {
      e.stopPropagation();
      onOpenChange?.(false);
    }
  };

  if (!isOpen) {
    return (
      <button
        type="button"
        onClick={() => onOpenChange?.(true)}
        className={cn(
          'flex h-10 items-center justify-center gap-1.5 rounded-[10px] border border-dashed border-border bg-transparent text-[13px] text-muted-foreground transition-colors duration-fast hover:border-primary/50 hover:bg-accent/40 hover:text-foreground',
          FOCUS_RING
        )}
      >
        <Plus className="h-3.5 w-3.5" strokeWidth={1.5} aria-hidden="true" />
        {label}
      </button>
    );
  }

  return (
    <form
      onSubmit={submit}
      className={cn(
        'flex flex-col overflow-hidden rounded-xl border bg-card transition-colors duration-fast',
        content.trim() ? 'border-primary/50' : 'border-border',
        variant === 'field' && 'rounded-[14px]'
      )}
    >
      <div className="relative">
        <Textarea
          ref={textareaRef}
          placeholder={placeholder}
          value={content}
          onChange={(e) => setContent(e.target.value)}
          onKeyDown={onKeyDown}
          maxLength={1000}
          rows={1}
          aria-label={isActionColumn ? 'Nova ação para o time' : 'Escreva seu feedback'}
          className={cn(
            'max-h-40 min-h-[44px] w-full resize-none border-0 bg-transparent py-3 pl-3.5 pr-12 text-sm shadow-none focus-visible:ring-0 focus-visible:ring-offset-0',
            variant === 'field' && 'min-h-[52px] text-[15px]'
          )}
        />
        <button
          type="submit"
          aria-label="Adicionar cartão"
          disabled={!content.trim() || submitting}
          className={cn(
            'absolute right-2 top-1/2 inline-flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-lg transition-[background-color,opacity] duration-fast',
            content.trim() ? 'bg-primary text-primary-foreground [.theme-totvs:not(.dark)_&]:text-foreground' : 'bg-transparent text-muted-foreground opacity-50',
            FOCUS_RING
          )}
        >
          <Send className="h-4 w-4" strokeWidth={1.5} aria-hidden="true" />
        </button>
      </div>

      {isActionColumn && content.trim() !== '' && (
        <div className="room-rise flex flex-wrap items-center gap-2 border-t border-border bg-muted/30 p-2.5">
          <label className="flex min-w-[9rem] flex-1 items-center gap-2">
            <UserPlus className="h-4 w-4 shrink-0 text-muted-foreground" strokeWidth={1.5} aria-hidden="true" />
            <span className="sr-only">Responsável</span>
            <input
              type="text"
              list={`retro-assignees-${columnKey}`}
              placeholder="Responsável"
              value={assignee}
              onChange={(e) => setAssignee(e.target.value)}
              className={cn(FIELD, 'h-9')}
            />
            <datalist id={`retro-assignees-${columnKey}`}>
              {participants.map((p) => <option key={p.id} value={p.nickname} />)}
            </datalist>
          </label>
          <label className="flex items-center gap-2">
            <Calendar className="h-4 w-4 shrink-0 text-muted-foreground" strokeWidth={1.5} aria-hidden="true" />
            <span className="sr-only">Prazo</span>
            <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className={cn(FIELD, 'h-9')} />
          </label>
        </div>
      )}
    </form>
  );
}
