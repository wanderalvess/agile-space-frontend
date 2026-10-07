'use client';

import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Pin, 
  Trash2, 
  ArrowRight, 
  Plus,
  LayoutGrid,
  Clock
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useDebounce } from '@/hooks/use-debounce';
import { cn } from '@/lib/utils';
import { StickyNote } from './types';
import { WorkspaceSectionHeader } from './WorkspaceSectionHeader';

const NOTE_COLORS: { name: string; class: string; dot: string; glow?: string }[] = [
  { 
    name: 'Amarelo', 
    class: 'bg-amber-50/90 dark:bg-amber-950/40 border-amber-200/70 dark:border-amber-800/40 text-amber-950 dark:text-amber-100', 
    dot: 'bg-amber-400' 
  },
  { 
    name: 'Azul', 
    class: 'bg-sky-50/90 dark:bg-sky-950/40 border-sky-200/70 dark:border-sky-800/40 text-sky-950 dark:text-sky-100', 
    dot: 'bg-sky-400' 
  },
  { 
    name: 'Verde', 
    class: 'bg-emerald-50/90 dark:bg-emerald-950/40 border-emerald-200/70 dark:border-emerald-800/40 text-emerald-950 dark:text-emerald-100', 
    dot: 'bg-emerald-400' 
  },
  { 
    name: 'Rosa', 
    class: 'bg-rose-50/90 dark:bg-rose-950/40 border-rose-200/70 dark:border-rose-800/40 text-rose-950 dark:text-rose-100', 
    dot: 'bg-rose-400' 
  },
  { 
    name: 'Violeta', 
    class: 'bg-violet-50/90 dark:bg-violet-950/40 border-violet-200/70 dark:border-violet-800/40 text-violet-950 dark:text-violet-100', 
    dot: 'bg-violet-400' 
  },
];

interface StickyNotesProps {
  notes: StickyNote[];
  isLoading: boolean;
  onAdd: () => void;
  onUpdate: (id: string, updates: Partial<StickyNote>) => void;
  onDelete: (id: string) => void;
  onConvertToTask: (note: StickyNote) => void;
}

export function StickyNotes({ notes, isLoading, onAdd, onUpdate, onDelete, onConvertToTask }: StickyNotesProps) {
  const sortedNotes = [...notes].sort((a, b) => {
    if (a.isPinned && !b.isPinned) return -1;
    if (!a.isPinned && b.isPinned) return 1;
    return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
  });

  return (
    <div className="w-full space-y-6">
      <WorkspaceSectionHeader
        kicker="Notas"
        accent="amber"
        title="Mural de"
        titleAccent="Notas"
        subtitle="Ideias e anotações rápidas sincronizadas"
        action={
          <Button
            onClick={onAdd}
            className="h-10 px-6 bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-bold uppercase tracking-wider rounded-xl shadow-md shadow-primary/20 gap-2 transition-all active:scale-95 group"
          >
            <Plus className="h-4 w-4 group-hover:rotate-90 transition-transform" />
            Nova Nota
          </Button>
        }
      />
      
      <div className="grid grid-cols-[repeat(auto-fill,minmax(260px,1fr))] gap-5 pb-8">
        <AnimatePresence mode="popLayout">
          {isLoading ? (
            Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-56 bg-muted/40 animate-pulse rounded-3xl border border-border/70" />
            ))
          ) : (
            sortedNotes.map(note => (
              <StickyNoteCard 
                key={note.id} 
                note={note} 
                onUpdate={onUpdate} 
                onDelete={onDelete} 
                onConvertToTask={onConvertToTask} 
              />
            ))
          )}
        </AnimatePresence>

        {!isLoading && notes.length === 0 && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="col-span-full flex flex-col items-center justify-center py-20 rounded-3xl border border-dashed border-border/80 bg-muted/20 text-center space-y-3"
          >
            <LayoutGrid className="h-12 w-12 text-muted-foreground/40" />
            <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Seu mural está vazio</p>
            <Button onClick={onAdd} variant="outline" className="text-xs font-bold rounded-xl mt-2">
              <Plus className="h-4 w-4 mr-1 text-primary" /> Criar Primeira Nota
            </Button>
          </motion.div>
        )}
      </div>
    </div>
  );
}

function StickyNoteCard({ note, onUpdate, onDelete, onConvertToTask }: { note: StickyNote, onUpdate: any, onDelete: any, onConvertToTask: any }) {
  const [localContent, setLocalContent] = useState(note.content);
  const debouncedContent = useDebounce(localContent, 2000);
  const remoteContentRef = useRef(note.content);

  useEffect(() => {
    setLocalContent(note.content);
  }, [note.id]);

  useEffect(() => {
    remoteContentRef.current = note.content;
  }, [note.content]);

  useEffect(() => {
    if (debouncedContent !== remoteContentRef.current) {
      onUpdate(note.id, { content: debouncedContent });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedContent, note.id, onUpdate]);

  // Se a nota salva tiver a classe antiga (sem dark:), migramos dinamicamente
  const matchedColor = NOTE_COLORS.find(c => {
    const rawPrefix = c.name.toLowerCase().slice(0, 3);
    return note.color.includes(c.class.split(' ')[0]) || 
           (c.name === 'Amarelo' && note.color.includes('amber')) ||
           (c.name === 'Azul' && note.color.includes('sky')) ||
           (c.name === 'Verde' && note.color.includes('emerald')) ||
           (c.name === 'Rosa' && note.color.includes('rose')) ||
           (c.name === 'Violeta' && note.color.includes('violet'));
  }) || NOTE_COLORS[0];

  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.9, y: 16 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.8, transition: { duration: 0.2 } }}
      className={cn(
        "group relative flex flex-col p-5 rounded-3xl border backdrop-blur-xl transition-all duration-300 hover:-translate-y-1 shadow-xs", 
        matchedColor.class, 
        note.isPinned 
          ? "ring-2 ring-primary/40 scale-[1.02] z-10 shadow-md border-primary/40" 
          : "hover:border-border/80"
      )}
    >
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className={cn("w-2 h-2 rounded-full shadow-xs animate-pulse", matchedColor.dot)} />
          {note.isPinned && <span className="text-[9px] font-black uppercase tracking-widest text-primary">Destaque</span>}
        </div>
        <div className={cn("flex items-center gap-1 transition-all duration-200", note.isPinned ? "opacity-100" : "opacity-0 group-hover:opacity-100")}>
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={() => onUpdate(note.id, { isPinned: !note.isPinned })} 
            className={cn(
              "h-7 w-7 rounded-lg shadow-xs backdrop-blur-md transition-all", 
              note.isPinned ? "text-primary bg-background/90" : "text-muted-foreground bg-background/70 hover:bg-background"
            )}
            title={note.isPinned ? "Desafixar" : "Fixar no topo"}
          >
            <Pin className={cn("h-3.5 w-3.5", note.isPinned && "fill-current")} />
          </Button>
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={() => onConvertToTask(note)} 
            className="h-7 w-7 bg-background/70 hover:bg-background backdrop-blur-md text-muted-foreground hover:text-primary rounded-lg shadow-xs transition-all"
            title="Promover para Kanban"
          >
            <ArrowRight className="h-3.5 w-3.5" />
          </Button>
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={() => onDelete(note.id)} 
            className="h-7 w-7 bg-background/70 hover:bg-background backdrop-blur-md text-muted-foreground hover:text-destructive rounded-lg shadow-xs transition-all"
            title="Excluir nota"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      <textarea 
        value={localContent} 
        onChange={(e) => setLocalContent(e.target.value)} 
        placeholder="Rascunhe seus insights..." 
        className={cn(
          "flex-1 w-full bg-transparent border-none focus:ring-0 outline-none resize-none text-xs font-semibold leading-relaxed min-h-[140px] placeholder:text-muted-foreground/50 text-inherit"
        )}
      />
      
      <div className="mt-4 pt-3 border-t border-border/40 flex items-center justify-between opacity-60 text-[9px] font-bold uppercase tracking-wider">
        <div className="flex items-center gap-1.5">
           <Clock className="h-3 w-3" />
           <span suppressHydrationWarning>{new Date(note.updatedAt).toLocaleDateString('pt-BR')}</span>
        </div>
        <div className="flex gap-1.5">
          {NOTE_COLORS.map(c => (
            <button 
              key={c.name}
              title={c.name}
              onClick={() => onUpdate(note.id, { color: c.class })}
              className={cn("w-2.5 h-2.5 rounded-full border border-black/10 dark:border-white/20 transition-all hover:scale-150", c.dot)}
            />
          ))}
        </div>
      </div>
    </motion.div>
  );
}
