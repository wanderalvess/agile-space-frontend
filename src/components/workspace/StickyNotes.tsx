'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowRight, Clock, Pin, Plus, Search, StickyNote as StickyNoteIcon, Trash2 } from 'lucide-react';
import { IconButton, ModalButton, FIELD } from '@/components/room-kit';
import { EmptyState, ErrorState } from '@/components/page';
import { useDebounce } from '@/hooks/use-debounce';
import { cn } from '@/lib/utils';
import type { StickyNote } from './types';
import { NOTE_COLORS, matchNoteColor } from './note-colors';
import { WorkspaceSectionHeader } from './workspace-ui';

interface StickyNotesProps {
  notes: StickyNote[];
  isLoading: boolean;
  loadError?: boolean;
  onRetry?: () => void;
  onAdd: () => void;
  onUpdate: (id: string, updates: Partial<StickyNote>) => void;
  onDelete: (id: string) => void;
  onConvertToTask: (note: StickyNote) => void;
  /** Pedido de foco na busca (vindo da paleta de comandos). */
  focusSearch?: boolean;
  onFocusHandled?: () => void;
}

function normalize(text: string): string {
  return text.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

/** Notas cujo texto contém a busca (sem acento nem caixa). Busca vazia devolve todas. */
export function filterNotes(notes: StickyNote[], query: string): StickyNote[] {
  const q = normalize(query.trim());
  return q ? notes.filter((n) => normalize(n.content || '').includes(q)) : notes;
}

export function StickyNotes({ notes, isLoading, loadError, onRetry, onAdd, onUpdate, onDelete, onConvertToTask, focusSearch, onFocusHandled }: StickyNotesProps) {
  const [query, setQuery] = useState('');
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!focusSearch) return;
    searchRef.current?.focus();
    onFocusHandled?.();
  }, [focusSearch, onFocusHandled]);

  const sortedNotes = useMemo(
    () =>
      [...filterNotes(notes, query)].sort((a, b) => {
        if (a.isPinned && !b.isPinned) return -1;
        if (!a.isPinned && b.isPinned) return 1;
        return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
      }),
    [notes, query],
  );

  const searching = query.trim().length > 0;

  return (
    <div className="flex w-full flex-col gap-4">
      <WorkspaceSectionHeader
        title="Mural de notas"
        subtitle="Ideias e anotações rápidas, salvas na hora"
        action={
          <>
            <div className="relative w-full sm:w-[280px]">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-[15px] w-[15px] -translate-y-1/2 text-muted-foreground" strokeWidth={1.5} aria-hidden="true" />
              <input
                ref={searchRef}
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Buscar nas notas"
                aria-label="Buscar nas notas"
                className={cn(FIELD, 'h-[42px] pl-9 text-sm')}
              />
            </div>
            <ModalButton variant="primary" onClick={onAdd}>
              <Plus className="h-4 w-4" strokeWidth={1.5} aria-hidden="true" /> Nova nota
            </ModalButton>
          </>
        }
      />

      {loadError ? (
        <ErrorState title="Não foi possível carregar as notas" description="Verifique a conexão e tente de novo." onRetry={onRetry} />
      ) : isLoading ? (
        <div role="status" aria-label="Carregando as notas" className="grid grid-cols-[repeat(auto-fill,minmax(260px,1fr))] gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-56 rounded-2xl border border-border bg-muted/40 motion-safe:animate-pulse" />
          ))}
        </div>
      ) : notes.length === 0 ? (
        <EmptyState
          icon={StickyNoteIcon}
          title="Seu mural está vazio"
          description="Anote uma ideia; ela fica salva e dá para virar tarefa depois."
          actions={
            <ModalButton variant="primary" onClick={onAdd}>
              <Plus className="h-4 w-4" strokeWidth={1.5} aria-hidden="true" /> Criar primeira nota
            </ModalButton>
          }
        />
      ) : sortedNotes.length === 0 && searching ? (
        <EmptyState icon={Search} title="Nenhuma nota encontrada" description={`Nenhuma nota tem "${query.trim()}".`} actions={<ModalButton onClick={() => setQuery('')}>Limpar busca</ModalButton>} />
      ) : (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(260px,1fr))] gap-4 pb-6">
          {sortedNotes.map((note) => (
            <StickyNoteCard key={note.id} note={note} onUpdate={onUpdate} onDelete={onDelete} onConvertToTask={onConvertToTask} />
          ))}
        </div>
      )}
    </div>
  );
}

function StickyNoteCard({
  note,
  onUpdate,
  onDelete,
  onConvertToTask,
}: {
  note: StickyNote;
  onUpdate: (id: string, updates: Partial<StickyNote>) => void;
  onDelete: (id: string) => void;
  onConvertToTask: (note: StickyNote) => void;
}) {
  const [localContent, setLocalContent] = useState(note.content);
  const debouncedContent = useDebounce(localContent, 2000);
  const remoteContentRef = useRef(note.content);

  useEffect(() => {
    setLocalContent(note.content);
  }, [note.id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    remoteContentRef.current = note.content;
  }, [note.content]);

  const onUpdateRef = useRef(onUpdate);
  useEffect(() => {
    onUpdateRef.current = onUpdate;
  }, [onUpdate]);

  useEffect(() => {
    if (debouncedContent !== remoteContentRef.current) {
      onUpdateRef.current(note.id, { content: debouncedContent });
    }
  }, [debouncedContent, note.id]);

  // Trocar de aba ou sair da página antes dos 2 s do debounce perdia o que foi digitado: grava ao desmontar.
  const discardedRef = useRef(false); // nota excluída/promovida: não regravar o texto
  const latestContentRef = useRef(localContent);
  useEffect(() => {
    latestContentRef.current = localContent;
  }, [localContent]);
  useEffect(() => {
    const id = note.id;
    return () => {
      if (!discardedRef.current && latestContentRef.current !== remoteContentRef.current) {
        onUpdateRef.current(id, { content: latestContentRef.current });
      }
    };
  }, [note.id]);

  // Nota salva com a classe antiga (sem dark:) é reconhecida pela cor.
  const color = matchNoteColor(note.color);
  const pinLabel = note.isPinned ? 'Desafixar nota' : 'Fixar nota no topo';

  return (
    <article className={cn('group relative flex flex-col rounded-2xl border p-4 shadow-xs transition-shadow duration-fast hover:shadow-md', color.class, note.isPinned && 'ring-2 ring-primary/40')}>
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="text-xs font-bold uppercase tracking-wide opacity-80">{note.isPinned ? 'Fixada' : ' '}</span>
        <div className="flex items-center gap-1">
          <IconButton size="sm" icon={Pin} label={pinLabel} pressed={!!note.isPinned} onClick={() => onUpdate(note.id, { isPinned: !note.isPinned })} className="bg-background/60" />
          <IconButton
            size="sm"
            icon={ArrowRight}
            label="Promover nota para o Kanban"
            onClick={() => {
              discardedRef.current = true;
              onConvertToTask(note);
            }}
            className="bg-background/60"
          />
          <IconButton
            size="sm"
            icon={Trash2}
            label="Excluir nota"
            onClick={() => {
              discardedRef.current = true;
              onDelete(note.id);
            }}
            className="bg-background/60"
          />
        </div>
      </div>

      <textarea
        value={localContent}
        onChange={(e) => setLocalContent(e.target.value)}
        aria-label="Texto da nota"
        maxLength={20000}
        placeholder="Rascunhe seus insights..."
        className="min-h-[140px] w-full flex-1 resize-none border-none bg-transparent text-sm leading-relaxed text-inherit outline-none placeholder:text-current placeholder:opacity-50 focus-visible:ring-0"
      />

      <div className="mt-3 flex items-center justify-between border-t border-current/15 pt-2.5 text-xs">
        <span className="inline-flex items-center gap-1.5 opacity-80" suppressHydrationWarning>
          <Clock className="h-3 w-3" strokeWidth={1.5} aria-hidden="true" />
          {new Date(note.updatedAt).toLocaleDateString('pt-BR')}
        </span>
        <div className="flex items-center" role="group" aria-label="Cor da nota">
          {NOTE_COLORS.map((c) => (
            <button
              key={c.name}
              type="button"
              title={c.name}
              aria-label={`Cor ${c.name}`}
              aria-pressed={color.name === c.name}
              onClick={() => onUpdate(note.id, { color: c.class })}
              className="inline-flex h-6 w-6 items-center justify-center rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring max-sm:h-8 max-sm:w-8"
            >
              <span className={cn('h-3 w-3 rounded-full border border-foreground/20 transition-transform hover:scale-125', c.dot, color.name === c.name && 'ring-2 ring-current ring-offset-1 ring-offset-transparent')} />
            </button>
          ))}
        </div>
      </div>
    </article>
  );
}
