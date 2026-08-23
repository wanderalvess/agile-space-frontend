"use client";

import React, { useState, useEffect } from 'react';
import {
  Search,
  FileText,
  BookMarked,
  ExternalLink,
  ChevronRight,
  Clock,
  Sparkles,
  Command as CommandIcon,
  Cpu,
  Zap,
  ArrowRight,
  Database,
  SearchIcon,
  ShieldCheck
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useAuth } from '@/context/AuthContext';
import { knowledgeApi } from '@/app/knowledge/api';
import type { KnowledgeDocument } from '@/lib/knowledge-types';
import { useRouter } from 'next/navigation';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { EliteSpinner } from '@/components/ui/EliteSpinner';

const SEARCH_DEBOUNCE_MS = 300;

export function GlobalSearch({ open, onOpenChange }: { open: boolean, onOpenChange: (open: boolean) => void }) {
  const router = useRouter();
  const { session } = useAuth();
  const [search, setSearch] = useState("");
  const [documents, setDocuments] = useState<KnowledgeDocument[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // Busca via API REST (Spring Boot / PostgreSQL) em vez de assinatura realtime
  // do Firestore. Sem termo, traz os documentos mais recentes; com termo,
  // dispara a busca no backend após um pequeno debounce (evita 1 request por tecla).
  useEffect(() => {
    if (!open || !session) return;

    let cancelled = false;
    setIsLoading(true);

    const trimmed = search.trim();
    const handle = setTimeout(async () => {
      try {
        const response = await knowledgeApi.listDocuments(trimmed || undefined, undefined, 0, 100);
        if (!cancelled) setDocuments(response.content);
      } catch (error) {
        console.error('Erro ao buscar na base de conhecimento:', error);
        if (!cancelled) setDocuments([]);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }, trimmed === "" ? 0 : SEARCH_DEBOUNCE_MS);

    return () => {
      cancelled = true;
      clearTimeout(handle);
    };
  }, [open, session, search]);

  const filteredResults = React.useMemo(() => {
    return search.trim() === "" ? documents.slice(0, 5) : documents;
  }, [documents, search]);

  const handleSelect = (doc: KnowledgeDocument) => {
    onOpenChange(false);
    router.push(`/knowledge/kb?id=${doc.id}`);
  };

  const formatDocDate = (updatedAt: any) => {
    if (!updatedAt) return '---';
    try {
      const date = new Date(updatedAt);
      if (isNaN(date.getTime())) return '---';
      return formatDistanceToNow(date, { locale: ptBR, addSuffix: true });
    } catch (e) {
      return '---';
    }
  };

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        onOpenChange(true);
      }
    };
    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, [onOpenChange]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl p-0 overflow-hidden border border-white/20 dark:border-slate-800/80 bg-white/60 dark:bg-slate-950/60 backdrop-blur-3xl shadow-[0_40px_120px_rgba(0,0,0,0.15)] rounded-[3.5rem] animate-in zoom-in-95 duration-300">
        <div className="flex flex-col h-[650px] relative">

          {/* MESH GRADIENT INSIDE DIALOG */}
          <div className="absolute top-[-10%] right-[-10%] w-64 h-64 bg-indigo-500/10 rounded-full blur-[80px] pointer-events-none" />

          {/* COMMAND INPUT HEADER */}
          <div className="p-10 border-b border-slate-100 dark:border-slate-800 flex items-center gap-8 bg-white/40 dark:bg-slate-900/10 relative z-10">
            <div className="w-16 h-16 bg-slate-950 rounded-[1.5rem] flex items-center justify-center text-cyan-400 shadow-2xl shadow-indigo-500/20 relative group overflow-hidden shrink-0">
              <div className="absolute inset-0 bg-gradient-to-br from-cyan-400/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
              <SearchIcon className="h-7 w-7 relative z-10" />
            </div>
            <div className="flex-1 flex flex-col">
               <span className="text-[10px] font-black uppercase tracking-[0.4em] text-indigo-600 dark:text-indigo-400 mb-1">Interface de Busca de Conhecimento</span>
               <input
                 value={search}
                 onChange={(e) => setSearch(e.target.value)}
                 placeholder="O QUE VOCÊ DESEJA LOCALIZAR?"
                 className="bg-transparent text-3xl font-black placeholder:text-slate-200 dark:placeholder:text-slate-700 focus:outline-none h-14 uppercase tracking-tighter italic text-slate-955 dark:text-slate-100 transition-all"
                 autoFocus
               />
            </div>
            <div className="hidden sm:flex items-center gap-3 px-5 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm ring-8 ring-slate-50/50 dark:ring-slate-950/30">
               <kbd className="text-[12px] font-black text-slate-900 dark:text-slate-100 font-sans tracking-tight">ESC</kbd>
               <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">Close</span>
            </div>
          </div>

          <ScrollArea className="flex-1 p-8 relative z-10">
            {isLoading ? (
               <div className="py-32 flex flex-col items-center justify-center gap-8">
                  <EliteSpinner variant="indigo" size="lg" />
                  <p className="text-[11px] font-black uppercase tracking-[0.4em] text-slate-400 dark:text-slate-500 italic animate-pulse">Consultando Base de Conhecimento...</p>
               </div>
            ) : filteredResults.length > 0 ? (
               <div className="space-y-4">
                <div className="px-6 flex items-center justify-between pb-4">
                   <div className="flex items-center gap-3">
                      <div className="w-1.5 h-4 bg-indigo-600 rounded-full" />
                      <p className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-955 dark:text-slate-100 italic">
                        {search.trim() === "" ? "Sugestões do Sistema" : `Resultados Encontrados (${filteredResults.length})`}
                      </p>
                   </div>
                   {search.trim() !== "" && (
                     <span className="text-[9px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500 px-3 py-1 bg-slate-50 dark:bg-slate-900 rounded-lg">Filtro Ativo: "{search}"</span>
                   )}
                </div>

                {filteredResults.map((doc) => (
                   <button
                    key={doc.id}
                    onClick={() => handleSelect(doc)}
                    className="w-full text-left p-8 rounded-[2.5rem] bg-transparent hover:bg-slate-950 dark:hover:bg-white transition-all duration-500 group flex items-center justify-between border border-transparent hover:shadow-2xl hover:shadow-indigo-500/10 active:scale-[0.99]"
                   >
                     <div className="flex gap-8 items-center min-w-0">
                        <div className="w-20 h-20 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-[1.5rem] flex items-center justify-center text-slate-700 dark:text-slate-300 group-hover:bg-indigo-600 group-hover:text-white group-hover:border-transparent transition-all shadow-xl group-hover:shadow-indigo-500/20 group-hover:scale-110 shrink-0">
                          <FileText className="h-9 w-9" />
                        </div>
                        <div className="space-y-3 min-w-0">
                           <div className="flex items-center gap-4 flex-wrap">
                             <h4 className="text-2xl font-black text-slate-955 dark:text-slate-100 group-hover:text-white dark:group-hover:text-slate-950 uppercase italic tracking-tighter transition-colors leading-none truncate max-w-[400px]">{doc.title}</h4>
                             <span className="px-4 py-1.5 bg-slate-100 dark:bg-slate-850 text-slate-955 dark:text-slate-300 text-[10px] font-black rounded-xl uppercase tracking-widest border border-slate-200 dark:border-slate-800 group-hover:bg-white/10 group-hover:text-cyan-400 group-hover:border-transparent transition-all italic">
                               {doc.category}
                             </span>
                           </div>
                           <p className="text-[12px] text-slate-500 dark:text-slate-400 group-hover:text-slate-400 dark:group-hover:text-slate-500 line-clamp-1 font-bold uppercase tracking-tight transition-colors leading-none">
                             {doc.fullPath || 'Namespace: Geral'}
                           </p>
                           <div className="flex items-center gap-6 pt-1">
                              <div className="flex items-center gap-2 text-[10px] font-black text-indigo-600 dark:text-indigo-400 group-hover:text-indigo-400 dark:group-hover:text-indigo-650 uppercase tracking-widest transition-colors italic">
                                <Zap className="h-3.5 w-3.5" /> Contextualizado
                              </div>
                              <div className="flex items-center gap-2 text-[10px] font-black text-slate-400 dark:text-slate-500 group-hover:text-slate-500 dark:group-hover:text-slate-400 uppercase tracking-widest tabular-nums transition-colors">
                                <Clock className="h-3.5 w-3.5" /> {formatDocDate(doc.updatedAt)}
                              </div>
                           </div>
                        </div>
                     </div>
                     <div className="h-14 w-14 rounded-2xl border-2 border-slate-100 dark:border-slate-800 flex items-center justify-center group-hover:bg-white/10 group-hover:border-transparent transition-all group-hover:translate-x-2 shrink-0">
                       <ArrowRight className="h-7 w-7 text-slate-300 dark:text-slate-500 group-hover:text-white dark:group-hover:text-slate-950 transition-all" />
                     </div>
                   </button>
                ))}
              </div>
            ) : (
              <div className="py-32 flex flex-col items-center justify-center text-center gap-10 animate-in fade-in zoom-in duration-700">
                 <div className="w-32 h-32 bg-white/60 dark:bg-slate-900/60 backdrop-blur-3xl rounded-[3rem] flex items-center justify-center text-slate-200 dark:text-slate-700 border border-white dark:border-slate-800 shadow-2xl relative group">
                    <div className="absolute inset-0 bg-rose-500/5 rounded-[3rem] animate-pulse" />
                    <Sparkles className="h-16 w-16 text-slate-200 dark:text-slate-700 group-hover:text-rose-400 transition-colors" />
                 </div>
                 <div className="space-y-4">
                    <h5 className="text-3xl font-black text-slate-955 dark:text-slate-100 uppercase italic tracking-tighter">Vácuo de Detecção</h5>
                    <p className="text-[12px] text-slate-400 dark:text-slate-550 font-black uppercase tracking-[0.2em] max-w-sm mx-auto leading-relaxed">Nenhum ativo correlacionado a <span className="text-slate-955 dark:text-slate-100">"{search}"</span> foi identificado na base de conhecimento.</p>
                 </div>
                 <Button
                   onClick={() => setSearch("")}
                   variant="outline"
                   className="h-14 px-8 rounded-2xl border-slate-200 dark:border-slate-800 text-[10px] font-black uppercase tracking-widest hover:bg-slate-950 dark:hover:bg-slate-100 hover:text-white dark:hover:text-slate-900 hover:border-slate-950 dark:hover:border-slate-100 transition-all shadow-sm"
                 >
                   Resetar Parâmetros
                 </Button>
              </div>
            )}
          </ScrollArea>

          {/* SYSTEM TELEMETRY FOOTER */}
          <div className="p-10 bg-slate-950/5 dark:bg-slate-950/40 border-t border-slate-100 dark:border-slate-800/80 flex flex-col sm:flex-row items-center justify-between gap-6 relative z-10">
             <div className="flex items-center gap-8">
                <div className="flex items-center gap-4 text-[10px] font-black text-slate-950 dark:text-slate-200 uppercase tracking-[0.2em] italic">
                   <div className="px-3 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm text-slate-400 dark:text-slate-550 font-sans tracking-tight">↑↓</div> Navegar
                </div>
                <div className="flex items-center gap-4 text-[10px] font-black text-slate-950 dark:text-slate-200 uppercase tracking-[0.2em] italic">
                   <div className="px-3 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm text-slate-400 dark:text-slate-550 font-sans tracking-tight">↵</div> Selecionar
                </div>
             </div>
             <div className="flex items-center gap-4">
                <div className="flex flex-col items-end">
                   <div className="flex items-center gap-2.5 text-[11px] font-black text-indigo-600 dark:text-indigo-400 uppercase tracking-[0.3em] italic">
                      <ShieldCheck className="h-4 w-4" /> Conexão Segura
                   </div>
                   <span className="text-[8px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mt-1">Espaço Ágil v3.0 // Unified Search</span>
                </div>
             </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
