'use client';

import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Pin, 
  Trash2, 
  ArrowRight, 
  Plus, 
  Sparkles,
  LayoutGrid,
  Clock
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useDebounce } from '@/hooks/use-debounce';
import { cn } from '@/lib/utils';
import { StickyNote } from './types';

const NOTE_COLORS: { name: string; class: string; dot: string; glow?: string }[] = [
  { name: 'Amarelo', class: 'bg-amber-50 border-amber-200/60 text-amber-900', dot: 'bg-amber-400' },
  { name: 'Azul', class: 'bg-sky-50 border-sky-200/60 text-sky-900', dot: 'bg-sky-400' },
  { name: 'Verde', class: 'bg-emerald-50 border-emerald-200/60 text-emerald-900', dot: 'bg-emerald-400' },
  { name: 'Rosa', class: 'bg-rose-50 border-rose-200/60 text-rose-900', dot: 'bg-rose-400' },
  { name: 'Violeta', class: 'bg-violet-50 border-violet-200/60 text-violet-900', dot: 'bg-violet-400' },
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
    <div className="flex-1 flex flex-col min-h-0">
      <div className="flex items-center justify-between shrink-0 mb-6 px-2">
        <div className="space-y-1">
          <h3 className="text-2xl font-black font-headline uppercase tracking-tighter italic text-slate-900 leading-none">
            Sticky <span className="text-primary not-italic">Notes</span>
          </h3>
          <div className="flex items-center gap-2 text-[10px] text-slate-400 font-black uppercase tracking-widest">
            <Sparkles className="h-3 w-3 text-amber-500" />
            <span>Captura Rápida de Insights</span>
          </div>
        </div>
        <Button 
          onClick={onAdd} 
          className="h-12 px-8 bg-slate-900 hover:bg-black text-white text-[11px] font-black uppercase tracking-widest rounded-2xl shadow-xl shadow-slate-200 gap-3 transition-all active:scale-95 group"
        >
          <Plus className="h-4 w-4 text-primary group-hover:rotate-90 transition-transform" />
          Nova Nota
        </Button>
      </div>
      
      <ScrollArea className="flex-1 -mx-4 px-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 pb-12">
          <AnimatePresence mode="popLayout">
            {isLoading ? (
              Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="h-64 bg-slate-100/50 animate-pulse rounded-[2.5rem] border border-slate-100" />
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
              className="col-span-full flex flex-col items-center justify-center py-20 opacity-20 text-center space-y-4"
            >
              <LayoutGrid className="h-16 w-16" />
              <p className="text-sm font-black uppercase tracking-widest">Seu mural está vazio</p>
            </motion.div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}

function StickyNoteCard({ note, onUpdate, onDelete, onConvertToTask }: { note: StickyNote, onUpdate: any, onDelete: any, onConvertToTask: any }) {
  const [localContent, setLocalContent] = useState(note.content);
  const debouncedContent = useDebounce(localContent, 2000);
  // Guarda o conteúdo remoto mais recente sem virar dependência do efeito de
  // salvamento abaixo — senão uma edição remota (outra aba/dispositivo)
  // chegando via Firestore disparava o efeito e sobrescrevia o conteúdo novo
  // com o `debouncedContent` antigo desta aba, mesmo sem o usuário ter
  // digitado nada aqui.
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

  const colorConfig = NOTE_COLORS.find(c => note.color.includes(c.class.split(' ')[0])) || NOTE_COLORS[0];

  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.9, y: 20 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.8, transition: { duration: 0.2 } }}
      className={cn(
        "group relative flex flex-col p-7 rounded-[2.8rem] border-2 backdrop-blur-xl transition-all duration-500 hover:-translate-y-2", 
        note.color, 
        note.isPinned 
          ? `border-primary/40 ring-8 ring-primary/5 scale-[1.03] z-10 shadow-2xl ${colorConfig.glow}` 
          : "border-transparent hover:border-slate-200 shadow-xl shadow-slate-200/40"
      )}
    >
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-3">
          <div className={cn("w-3 h-3 rounded-full shadow-inner animate-pulse", colorConfig.dot)} />
          {note.isPinned && <span className="text-[9px] font-black uppercase tracking-widest text-primary">Destaque</span>}
        </div>
        <div className={cn("flex items-center gap-2 transition-all duration-300", note.isPinned ? "opacity-100" : "opacity-0 group-hover:opacity-100")}>
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={() => onUpdate(note.id, { isPinned: !note.isPinned })} 
            className={cn(
              "h-9 w-9 rounded-xl shadow-sm backdrop-blur-md transition-all hover:scale-110", 
              note.isPinned ? "text-primary bg-white/95" : "text-slate-500 bg-white/80 hover:bg-white/90"
            )}
          >
            <Pin className={cn("h-4 w-4", note.isPinned && "fill-current")} />
          </Button>
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={() => onConvertToTask(note)} 
            className="h-9 w-9 bg-white/80 backdrop-blur-md text-slate-500 hover:text-primary hover:bg-white/95 rounded-xl shadow-sm transition-all hover:scale-110"
            title="Promover para Kanban"
          >
            <ArrowRight className="h-4 w-4" />
          </Button>
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={() => onDelete(note.id)} 
            className="h-9 w-9 bg-white/80 backdrop-blur-md text-slate-500 hover:text-destructive hover:bg-white/95 rounded-xl shadow-sm transition-all hover:scale-110"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <textarea 
        value={localContent} 
        onChange={(e) => setLocalContent(e.target.value)} 
        placeholder="Rascunhe seus insights..." 
        className={cn(
          "flex-1 w-full bg-transparent border-none focus:ring-0 outline-none resize-none text-[16px] font-black leading-tight min-h-[160px] placeholder:text-slate-400/30 tracking-tight"
        )}
      />
      
      <div className="mt-6 pt-4 border-t border-black/5 flex items-center justify-between opacity-40 text-[8px] font-black uppercase tracking-widest">
        <div className="flex items-center gap-2">
           <Clock className="h-3 w-3" />
           <span suppressHydrationWarning>{new Date(note.updatedAt).toLocaleDateString('pt-BR')}</span>
        </div>
        <div className="flex gap-1.5">
          {NOTE_COLORS.map(c => (
            <button 
              key={c.name}
              onClick={() => onUpdate(note.id, { color: c.class })}
              className={cn("w-2.5 h-2.5 rounded-full border border-black/5 transition-all hover:scale-150 hover:shadow-lg", c.dot)}
            />
          ))}
        </div>
      </div>
    </motion.div>
  );
}
