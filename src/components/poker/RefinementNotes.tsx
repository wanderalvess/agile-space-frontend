'use client';

import { useState, useEffect, useRef } from 'react';
import { Textarea } from '@/components/ui/textarea';
import {
  Code,
  Bug,
  Sparkles
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

interface RefinementNotesProps {
  devNotes?: string;
  qaNotes?: string;
  onUpdateNotes?: (notes: { devNotes?: string; qaNotes?: string }) => void;
  isTheaterMode?: boolean;
  activeIssueId?: string | null;
  // Sem isso só o facilitador enxergava o painel inteiro — o resto da squad
  // não acompanhava as notas sendo escritas ao vivo durante o refinamento.
  // Em modo leitura o textarea vira só display: sem onUpdateNotes não tinha
  // pra onde salvar, e digitar ali era um "edit fantasma" que sumia no
  // próximo sync.
  readOnly?: boolean;
}

export function RefinementNotes({
  devNotes = "",
  qaNotes = "",
  onUpdateNotes,
  isTheaterMode,
  activeIssueId,
  readOnly = false
}: RefinementNotesProps) {
  const [localDevNotes, setLocalDevNotes] = useState(devNotes);
  const [localQaNotes, setLocalQaNotes] = useState(qaNotes);

  const devRef = useRef<HTMLTextAreaElement>(null);
  const qaRef = useRef<HTMLTextAreaElement>(null);

  // Sync with prop changes
  useEffect(() => {
    setLocalDevNotes(devNotes);
    setTimeout(() => adjustHeight(devRef), 10);
  }, [devNotes, activeIssueId]);

  useEffect(() => {
    setLocalQaNotes(qaNotes);
    setTimeout(() => adjustHeight(qaRef), 10);
  }, [qaNotes, activeIssueId]);

  const adjustHeight = (ref: React.RefObject<HTMLTextAreaElement | null>) => {
    if (ref.current) {
      ref.current.style.height = 'auto';
      ref.current.style.height = `${ref.current.scrollHeight}px`;
    }
  };

  // Debounced update
  useEffect(() => {
    if (!onUpdateNotes || !activeIssueId) return;

    const timer = setTimeout(() => {
      if (localDevNotes !== devNotes || localQaNotes !== qaNotes) {
        onUpdateNotes({ devNotes: localDevNotes, qaNotes: localQaNotes });
      }
    }, 1000);

    return () => clearTimeout(timer);
  }, [localDevNotes, localQaNotes, devNotes, qaNotes, onUpdateNotes, activeIssueId]);

  if (!activeIssueId) return null;

  return (
    <div className={cn(
      "w-full transition-all duration-700 animate-in fade-in slide-in-from-top-2",
      isTheaterMode ? "max-w-5xl mx-auto py-8" : "max-w-full"
    )}>
      <Tabs defaultValue="dev" className="w-full">
        <div className="flex items-center gap-6 mb-4 px-1">
          <TabsList className="bg-transparent p-0 h-auto gap-6">
            <TabsTrigger
              value="dev"
              className="px-0 py-2 border-b-2 border-transparent rounded-none bg-transparent text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground data-[state=active]:border-indigo-500 data-[state=active]:text-indigo-600 dark:data-[state=active]:text-indigo-400 data-[state=active]:bg-transparent transition-all"
            >
              <Code className="mr-2 h-3.5 w-3.5" />
              Dev Notes
            </TabsTrigger>
            <TabsTrigger
              value="qa"
              className="px-0 py-2 border-b-2 border-transparent rounded-none bg-transparent text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground data-[state=active]:border-pink-500 data-[state=active]:text-pink-600 dark:data-[state=active]:text-pink-400 data-[state=active]:bg-transparent transition-all"
            >
              <Bug className="mr-2 h-3.5 w-3.5" />
              QA Notes
            </TabsTrigger>
          </TabsList>

          <div className="flex-1 h-px bg-border/60" />

          <div className="hidden sm:flex items-center gap-2 opacity-40">
            <Sparkles className="h-3 w-3" />
            <span className="text-[8px] font-black uppercase tracking-widest">
              {readOnly ? 'Acompanhando o Refinamento' : 'Painel de Refinamento'}
            </span>
          </div>
        </div>

        <div className="relative">
          <TabsContent value="dev" className="mt-0 animate-in fade-in duration-500 outline-none">
            <Textarea
              ref={devRef}
              value={localDevNotes}
              readOnly={readOnly}
              onChange={(e) => {
                if (readOnly) return;
                setLocalDevNotes(e.target.value);
                adjustHeight(devRef);
              }}
              placeholder={readOnly ? "O facilitador ainda não escreveu notas técnicas." : "Descreva a solução técnica aqui..."}
              className={cn(
                "min-h-[40px] w-full p-0 py-2 rounded-none border-t-0 border-x-0 border-b border-border bg-transparent focus:ring-0 shadow-none transition-all resize-none text-sm font-bold text-foreground placeholder:text-muted-foreground/60 placeholder:font-medium overflow-hidden leading-relaxed",
                readOnly ? "cursor-default" : "hover:border-indigo-300 dark:hover:border-indigo-800 focus:border-indigo-500",
                isTheaterMode && "text-xl py-4"
              )}
            />
          </TabsContent>

          <TabsContent value="qa" className="mt-0 animate-in fade-in duration-500 outline-none">
            <Textarea
              ref={qaRef}
              value={localQaNotes}
              readOnly={readOnly}
              onChange={(e) => {
                if (readOnly) return;
                setLocalQaNotes(e.target.value);
                adjustHeight(qaRef);
              }}
              placeholder={readOnly ? "O facilitador ainda não escreveu cenários de teste." : "Quais os cenários de teste e riscos?"}
              className={cn(
                "min-h-[40px] w-full p-0 py-2 rounded-none border-t-0 border-x-0 border-b border-border bg-transparent focus:ring-0 shadow-none transition-all resize-none text-sm font-bold text-foreground placeholder:text-muted-foreground/60 placeholder:font-medium overflow-hidden leading-relaxed",
                readOnly ? "cursor-default" : "hover:border-pink-300 dark:hover:border-pink-800 focus:border-pink-500",
                isTheaterMode && "text-xl py-4"
              )}
            />
          </TabsContent>
        </div>
      </Tabs>
    </div>
  );
}
