'use client';
import { useToast } from "@/hooks/use-toast";
import { useState, useRef, useEffect } from "react";
import { Textarea } from "@/components/ui/textarea";
import type { RetroColumnKey, RetroParticipant } from "@/lib/types";
import { Plus, UserPlus, Calendar, Send } from "lucide-react";
import { cn } from "@/lib/utils";

interface AddRetroCardProps {
  columnKey: RetroColumnKey;
  theme?: RetroColumnTheme;
  onAddCard: (content: string, columnKey: RetroColumnKey, assignee?: string, dueDate?: string) => void;
  participants: RetroParticipant[];
}

import type { RetroColumnTheme } from "@/lib/types";

export function AddRetroCard({ columnKey, theme, onAddCard, participants }: AddRetroCardProps) {
  const [content, setContent] = useState('');
  const [assignee, setAssignee] = useState('');
  const [dueDate, setDueDate] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const { toast } = useToast();

  const handleAdd = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (content.trim()) {
      onAddCard(content.trim(), columnKey, assignee.trim() || undefined, dueDate || undefined);
      setContent('');
      setAssignee('');
      setDueDate('');
    } else {
      toast({
        title: "Campo Obrigatório",
        description: "O card não pode estar vazio.",
        variant: "destructive"
      });
    }
  };
  
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleAdd();
    }
  };

  useEffect(() => {
    if (textareaRef.current) {
      // Forçamos a altura inicial para calcular o scrollHeight real
      textareaRef.current.style.height = '40px';
      const scrollHeight = textareaRef.current.scrollHeight;
      // Só expandimos se houver conteúdo ou se o scroll for maior que a base
      if (content.trim()) {
        textareaRef.current.style.height = `${scrollHeight}px`;
      }
    }
  }, [content]);

  const isActionItem = theme === 'action' || columnKey === 'actionItems';

  return (
    <form 
      onSubmit={handleAdd}
      className={cn(
        "relative flex flex-col transition-all duration-300 rounded-[1.2rem] border border-slate-100 shadow-sm overflow-hidden",
        content.trim() ? "bg-white shadow-xl shadow-emerald-500/5 ring-4 ring-emerald-500/5 border-emerald-200" : "bg-white/60 hover:bg-white"
      )}
    >
      <div className="relative">
        <Textarea
          ref={textareaRef}
          placeholder={isActionItem ? "Nova ação para o time..." : "Escreva seu feedback aqui..."}
          value={content}
          onChange={(e) => setContent(e.target.value)}
          onKeyDown={handleKeyDown}
          maxLength={1000}
          className="!min-h-[40px] max-h-[160px] w-full py-2.5 pl-4 pr-12 text-[12px] font-medium bg-transparent border-none focus-visible:ring-0 resize-none overflow-hidden scrollbar-none placeholder:text-slate-400 text-slate-700"
          rows={1}
        />
        <button 
          type="submit"
          disabled={!content.trim()}
          className={cn(
            "absolute right-2.5 top-2.5 h-9 w-9 flex items-center justify-center rounded-xl transition-all",
            content.trim() 
              ? "bg-emerald-600 text-white shadow-lg shadow-emerald-500/20 scale-100" 
              : "text-slate-300 scale-90 opacity-0 group-hover:opacity-100"
          )}
        >
          <Send className="h-4 w-4" />
        </button>
      </div>

      {isActionItem && content.trim() !== '' && (
        <div className="flex flex-wrap gap-3 px-4 pb-4 items-center animate-in slide-in-from-top-2 duration-300">
          <div className="flex items-center gap-2.5 bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-100 flex-1">
             <UserPlus className="h-3.5 w-3.5 text-emerald-600" />
             <input 
              type="text" 
              list="participants-list"
              placeholder="Responsável..." 
              value={assignee}
              onChange={(e) => setAssignee(e.target.value)}
              className="bg-transparent border-none text-[10px] font-black uppercase tracking-widest w-full focus:ring-0 p-0 placeholder:text-slate-400 text-slate-700"
             />
             <datalist id="participants-list">
               {participants.map(p => (
                 <option key={p.id} value={p.nickname} />
               ))}
             </datalist>
          </div>
          <div className="flex items-center gap-2.5 bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-100">
             <Calendar className="h-3.5 w-3.5 text-emerald-600" />
             <input 
              type="date" 
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className="bg-transparent border-none text-[10px] font-black tracking-widest focus:ring-0 p-0 placeholder:text-slate-400 text-slate-700 [color-scheme:light]"
             />
          </div>
        </div>
      )}
    </form>
  );
}
