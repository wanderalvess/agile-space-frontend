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
import { AgileSpinner } from '@/components/ui/AgileSpinner';

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
      <DialogContent className="max-w-4xl p-0 overflow-hidden border border-border/20 dark:border-border/80 bg-card/60 dark:bg-background/60 backdrop-blur-3xl shadow-[0_40px_120px_rgba(0,0,0,0.15)] rounded-2xl animate-in zoom-in-95 duration-300">
        <div className="flex flex-col h-[650px] relative">

          {/* MESH GRADIENT INSIDE DIALOG */}
          <div className="absolute top-[-10%] right-[-10%] w-64 h-64 bg-primary/10 rounded-full blur-[80px] pointer-events-none" />

          {/* COMMAND INPUT HEADER */}
          <div className="p-10 border-b border-border flex items-center gap-8 bg-card/40 dark:bg-card/10 relative z-10">
            <div className="w-16 h-16 bg-background rounded-xl flex items-center justify-center text-primary [.theme-totvs:not(.dark)_&]:text-foreground shadow-2xl shadow-primary/20 relative group overflow-hidden shrink-0">
              <div className="absolute inset-0 bg-gradient-to-br from-primary/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
              <SearchIcon className="h-7 w-7 relative z-10" />
            </div>
            <div className="flex-1 flex flex-col">
               <span className="text-xs font-bold tracking-normal text-primary [.theme-totvs:not(.dark)_&]:text-foreground mb-1">Interface de Busca de Conhecimento</span>
               <input
                 value={search}
                 onChange={(e) => setSearch(e.target.value)}
                 placeholder="O QUE VOCÊ DESEJA LOCALIZAR?"
                 className="bg-transparent text-3xl font-bold placeholder:text-foreground focus:outline-none h-14 tracking-tighter text-foreground transition-all"
                 autoFocus
               />
            </div>
            <div className="hidden sm:flex items-center gap-3 px-5 py-2.5 bg-muted/40 dark:bg-card border border-border rounded-2xl shadow-sm ring-8 ring-border/50 dark:ring-border/30">
               <kbd className="text-[12px] font-bold text-foreground font-sans tracking-tight">ESC</kbd>
               <span className="text-xs font-bold text-muted-foreground tracking-normal">Fechar</span>
            </div>
          </div>

          <ScrollArea className="flex-1 p-8 relative z-10">
            {isLoading ? (
               <div className="py-32 flex flex-col items-center justify-center gap-8">
                  <AgileSpinner variant="indigo" size="lg" />
                  <p className="text-xs font-bold tracking-normal text-muted-foreground animate-pulse">Consultando Base de Conhecimento...</p>
               </div>
            ) : filteredResults.length > 0 ? (
               <div className="space-y-4">
                <div className="px-6 flex items-center justify-between pb-4">
                   <div className="flex items-center gap-3">
                      <div className="w-1.5 h-4 bg-primary rounded-full" />
                      <p className="text-xs font-bold tracking-normal text-foreground">
                        {search.trim() === "" ? "Sugestões do Sistema" : `Resultados Encontrados (${filteredResults.length})`}
                      </p>
                   </div>
                   {search.trim() !== "" && (
                     <span className="text-xs font-bold tracking-normal text-muted-foreground px-3 py-1 bg-muted/40 dark:bg-card rounded-lg">Filtro Ativo: "{search}"</span>
                   )}
                </div>

                {filteredResults.map((doc) => (
                   <button
                    key={doc.id}
                    onClick={() => handleSelect(doc)}
                    className="w-full text-left p-8 rounded-2xl bg-transparent hover:bg-muted/60 transition-all duration-500 group flex items-center justify-between border border-transparent hover:shadow-2xl hover:shadow-primary/10 active:scale-[0.99]"
                   >
                     <div className="flex gap-8 items-center min-w-0">
                        <div className="w-20 h-20 bg-card border border-border rounded-xl flex items-center justify-center text-foreground dark:text-muted-foreground group-hover:bg-primary group-hover:text-primary-foreground group-hover:border-transparent transition-all shadow-xl group-hover:shadow-primary/20 group-hover:scale-110 shrink-0">
                          <FileText className="h-9 w-9" />
                        </div>
                        <div className="space-y-3 min-w-0">
                           <div className="flex items-center gap-4 flex-wrap">
                             <h4 className="text-2xl font-bold text-foreground group-hover:text-foreground tracking-tighter transition-colors leading-none truncate max-w-[400px]">{doc.title}</h4>
                             <span className="px-4 py-1.5 bg-muted/60 dark:bg-muted text-foreground dark:text-muted-foreground text-xs font-bold rounded-xl tracking-normal border border-border group-hover:bg-primary/10 group-hover:text-primary group-hover:border-transparent transition-all">
                               {doc.category}
                             </span>
                           </div>
                           <p className="text-[12px] text-muted-foreground group-hover:text-muted-foreground line-clamp-1 font-bold tracking-tight transition-colors leading-none">
                             {doc.fullPath || 'Namespace: Geral'}
                           </p>
                           <div className="flex items-center gap-6 pt-1">
                              <div className="flex items-center gap-2 text-xs font-bold text-primary [.theme-totvs:not(.dark)_&]:text-foreground group-hover:text-primary tracking-normal transition-colors">
                                <Zap className="h-3.5 w-3.5" /> Contextualizado
                              </div>
                              <div className="flex items-center gap-2 text-xs font-bold text-muted-foreground group-hover:text-muted-foreground tracking-normal tabular-nums transition-colors">
                                <Clock className="h-3.5 w-3.5" /> {formatDocDate(doc.updatedAt)}
                              </div>
                           </div>
                        </div>
                     </div>
                     <div className="h-14 w-14 rounded-2xl border-2 border-border flex items-center justify-center group-hover:bg-muted group-hover:border-transparent transition-all group-hover:translate-x-2 shrink-0">
                       <ArrowRight className="h-7 w-7 text-muted-foreground group-hover:text-foreground transition-all" />
                     </div>
                   </button>
                ))}
              </div>
            ) : (
              <div className="py-32 flex flex-col items-center justify-center text-center gap-10">
                 <div className="w-32 h-32 bg-card/60 backdrop-blur-3xl rounded-2xl flex items-center justify-center text-foreground border border-border shadow-2xl relative group">
                    <div className="absolute inset-0 bg-primary/5 rounded-2xl animate-pulse" />
                    <Sparkles className="h-16 w-16 text-foreground group-hover:text-primary transition-colors" />
                 </div>
                 <div className="space-y-4">
                    <h5 className="text-3xl font-bold text-foreground tracking-tighter">Nada encontrado</h5>
                    <p className="text-[12px] text-muted-foreground font-bold tracking-normal max-w-sm mx-auto leading-relaxed">Nenhum ativo correlacionado a <span className="text-foreground">"{search}"</span> foi identificado na base de conhecimento.</p>
                 </div>
                 <Button
                   onClick={() => setSearch("")}
                   variant="outline"
                   className="h-14 px-8 rounded-2xl border-border text-xs font-bold tracking-normal hover:bg-background dark:hover:bg-muted/60 hover:text-foreground hover:border-border transition-all shadow-sm"
                 >
                   Resetar Parâmetros
                 </Button>
              </div>
            )}
          </ScrollArea>

          {/* SYSTEM TELEMETRY FOOTER */}
          <div className="p-10 bg-background/5 dark:bg-background/40 border-t border-border dark:border-border/80 flex flex-col sm:flex-row items-center justify-between gap-6 relative z-10">
             <div className="flex items-center gap-8">
                <div className="flex items-center gap-4 text-xs font-bold text-foreground tracking-normal">
                   <div className="px-3 py-1.5 bg-card border border-border rounded-xl shadow-sm text-muted-foreground font-sans tracking-tight">↑↓</div> Navegar
                </div>
                <div className="flex items-center gap-4 text-xs font-bold text-foreground tracking-normal">
                   <div className="px-3 py-1.5 bg-card border border-border rounded-xl shadow-sm text-muted-foreground font-sans tracking-tight">↵</div> Selecionar
                </div>
             </div>
             <div className="flex items-center gap-4">
                <div className="flex flex-col items-end">
                   <div className="flex items-center gap-2.5 text-xs font-bold text-primary [.theme-totvs:not(.dark)_&]:text-foreground tracking-normal">
                      <ShieldCheck className="h-4 w-4" /> Conexão Segura
                   </div>
                   <span className="text-xs font-bold text-muted-foreground tracking-normal mt-1">Portal Tech V&D · Busca unificada</span>
                </div>
             </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
