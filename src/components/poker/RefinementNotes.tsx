'use client';

import { useState, useEffect, useRef } from 'react';
import { Textarea } from '@/components/ui/textarea';
import {
  Code,
  Bug,
  ChevronDown,
  ChevronUp,
  Users,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

interface RefinementNotesProps {
  devNotes?: string;
  qaNotes?: string;
  // Recebe só o campo que mudou: o backend mescla por campo, então quem edita Dev
  // não apaga o que outra pessoa escreveu em QA ao mesmo tempo.
  onUpdateNotes?: (notes: { devNotes?: string; qaNotes?: string }) => void;
  isTheaterMode?: boolean;
  activeIssueId?: string | null;
  // Somente leitura (sem como salvar). Na sala, todos os presentes podem escrever.
  readOnly?: boolean;
}

const SAVE_DELAY_MS = 800;
const same = (a: string, b?: string | null) => a.trim() === (b ?? '').trim();

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

  // Sempre começa minimizado (a mesa é do baralho); abre quando a pessoa pedir.
  // Troca de tarefa recolhe de novo. O indicador "com notas" avisa que há conteúdo.
  const [isOpen, setIsOpen] = useState(false);
  useEffect(() => {
    setIsOpen(false);
  }, [activeIssueId]);

  const devRef = useRef<HTMLTextAreaElement>(null);
  const qaRef = useRef<HTMLTextAreaElement>(null);

  const adjustHeight = (ref: React.RefObject<HTMLTextAreaElement | null>) => {
    if (ref.current) {
      ref.current.style.height = 'auto';
      ref.current.style.height = `${ref.current.scrollHeight}px`;
    }
  };

  // Atualizações de outras pessoas entram no campo — menos o que está sendo digitado agora
  // (foco): sobrescrever no meio da frase faria o texto de quem digita pular.
  useEffect(() => {
    if (document.activeElement !== devRef.current) setLocalDevNotes(devNotes);
    setTimeout(() => adjustHeight(devRef), 10);
  }, [devNotes, activeIssueId, isOpen]);

  useEffect(() => {
    if (document.activeElement !== qaRef.current) setLocalQaNotes(qaNotes);
    setTimeout(() => adjustHeight(qaRef), 10);
  }, [qaNotes, activeIssueId, isOpen]);

  // Salva por campo, com debounce, só quando difere do que o servidor já tem.
  useEffect(() => {
    if (!onUpdateNotes || readOnly || !activeIssueId || same(localDevNotes, devNotes)) return;
    const timer = setTimeout(() => onUpdateNotes({ devNotes: localDevNotes }), SAVE_DELAY_MS);
    return () => clearTimeout(timer);
  }, [localDevNotes, devNotes, onUpdateNotes, readOnly, activeIssueId]);

  useEffect(() => {
    if (!onUpdateNotes || readOnly || !activeIssueId || same(localQaNotes, qaNotes)) return;
    const timer = setTimeout(() => onUpdateNotes({ qaNotes: localQaNotes }), SAVE_DELAY_MS);
    return () => clearTimeout(timer);
  }, [localQaNotes, qaNotes, onUpdateNotes, readOnly, activeIssueId]);

  if (!activeIssueId) return null;

  const hasDev = !!devNotes.trim();
  const hasQa = !!qaNotes.trim();

  if (!isOpen) {
    return (
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="group flex w-full items-center gap-2 px-1 py-0.5 text-left"
        aria-expanded={false}
        aria-label="Abrir notas de refinamento"
      >
        <Code className={cn('h-3.5 w-3.5', hasDev ? 'text-indigo-500' : 'text-indigo-500/40')} />
        <Bug className={cn('h-3.5 w-3.5', hasQa ? 'text-pink-500' : 'text-pink-500/40')} />
        <span className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground transition-colors group-hover:text-foreground">
          Notas de refinamento
        </span>
        {hasDev || hasQa ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[9px] font-black uppercase tracking-widest text-emerald-600 dark:text-emerald-400">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
            {hasDev && hasQa ? 'Dev + QA' : hasDev ? 'Dev' : 'QA'}
          </span>
        ) : (
          <span className="text-[10px] font-medium text-muted-foreground/70">· solução técnica e cenários de QA — todo o time pode escrever</span>
        )}
        <ChevronDown className="ml-auto h-3.5 w-3.5 text-muted-foreground transition-colors group-hover:text-foreground" />
      </button>
    );
  }

  return (
    <div className={cn(
      "w-full transition-all duration-700 animate-in fade-in slide-in-from-top-2",
      isTheaterMode ? "mx-auto max-w-5xl py-8" : "max-w-full"
    )}>
      <Tabs defaultValue="dev" className="w-full">
        <div className="mb-4 flex items-center gap-6 px-1">
          <TabsList className="h-auto gap-6 bg-transparent p-0">
            <TabsTrigger
              value="dev"
              className="rounded-none border-b-2 border-transparent bg-transparent px-0 py-2 text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground transition-all data-[state=active]:border-indigo-500 data-[state=active]:bg-transparent data-[state=active]:text-indigo-600 dark:data-[state=active]:text-indigo-400"
            >
              <Code className="mr-2 h-3.5 w-3.5" />
              Dev Notes
              {hasDev && <span className="ml-1.5 h-1.5 w-1.5 rounded-full bg-indigo-500" />}
            </TabsTrigger>
            <TabsTrigger
              value="qa"
              className="rounded-none border-b-2 border-transparent bg-transparent px-0 py-2 text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground transition-all data-[state=active]:border-pink-500 data-[state=active]:bg-transparent data-[state=active]:text-pink-600 dark:data-[state=active]:text-pink-400"
            >
              <Bug className="mr-2 h-3.5 w-3.5" />
              QA Notes
              {hasQa && <span className="ml-1.5 h-1.5 w-1.5 rounded-full bg-pink-500" />}
            </TabsTrigger>
          </TabsList>

          <div className="h-px flex-1 bg-border/60" />

          <div className="hidden items-center gap-1.5 text-muted-foreground/70 sm:flex">
            <Users className="h-3 w-3" />
            <span className="text-[9px] font-black uppercase tracking-widest">
              {readOnly ? 'Somente leitura' : 'Todo o time pode editar'}
            </span>
          </div>

          <button
            type="button"
            onClick={() => setIsOpen(false)}
            className="flex items-center gap-1 rounded-lg px-2 py-1 text-[9px] font-black uppercase tracking-widest text-muted-foreground transition-colors hover:bg-slate-100 hover:text-foreground dark:hover:bg-slate-800"
            aria-expanded
            aria-label="Minimizar notas de refinamento"
            title="Minimizar"
          >
            <ChevronUp className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Minimizar</span>
          </button>
        </div>

        <div className="relative">
          <TabsContent value="dev" className="mt-0 outline-none animate-in fade-in duration-500">
            <Textarea
              ref={devRef}
              value={localDevNotes}
              readOnly={readOnly}
              onChange={(e) => {
                if (readOnly) return;
                setLocalDevNotes(e.target.value);
                adjustHeight(devRef);
              }}
              placeholder={readOnly ? "Ainda não há notas técnicas." : "Descreva a solução técnica aqui..."}
              className={cn(
                "min-h-[40px] w-full resize-none overflow-hidden rounded-none border-x-0 border-b border-t-0 border-border bg-transparent p-0 py-2 text-sm font-bold leading-relaxed text-foreground shadow-none transition-all placeholder:font-medium placeholder:text-muted-foreground/60 focus:ring-0",
                readOnly ? "cursor-default" : "hover:border-indigo-300 focus:border-indigo-500 dark:hover:border-indigo-800",
                isTheaterMode && "py-4 text-xl"
              )}
            />
          </TabsContent>

          <TabsContent value="qa" className="mt-0 outline-none animate-in fade-in duration-500">
            <Textarea
              ref={qaRef}
              value={localQaNotes}
              readOnly={readOnly}
              onChange={(e) => {
                if (readOnly) return;
                setLocalQaNotes(e.target.value);
                adjustHeight(qaRef);
              }}
              placeholder={readOnly ? "Ainda não há cenários de teste." : "Quais os cenários de teste e riscos?"}
              className={cn(
                "min-h-[40px] w-full resize-none overflow-hidden rounded-none border-x-0 border-b border-t-0 border-border bg-transparent p-0 py-2 text-sm font-bold leading-relaxed text-foreground shadow-none transition-all placeholder:font-medium placeholder:text-muted-foreground/60 focus:ring-0",
                readOnly ? "cursor-default" : "hover:border-pink-300 focus:border-pink-500 dark:hover:border-pink-800",
                isTheaterMode && "py-4 text-xl"
              )}
            />
          </TabsContent>
        </div>
      </Tabs>
    </div>
  );
}
