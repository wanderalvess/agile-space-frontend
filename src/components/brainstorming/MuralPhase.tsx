'use client';

import React, { useState } from 'react';
import { 
  Plus, 
  Search, 
  MessageSquarePlus, 
  Filter,
  X,
  TrendingUp,
  AlertCircle,
  Clock
} from 'lucide-react';
import { toPng } from 'html-to-image';
import { Button } from '@/components/ui/button';
import { Flame } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { IdeaCard } from './IdeaCard';
import { BrainstormingIdea } from '@/lib/types';
import { cn } from '@/lib/utils';
import { AnimatePresence, motion } from 'framer-motion';

interface MuralPhaseProps {
  ideas: BrainstormingIdea[];
  currentUserId?: string;
  onAddIdea: (content: string) => void;
  onDeleteIdea: (id: string) => void;
  onUpdateIdea: (id: string, content: string) => void;
  onVoteIdea: (id: string) => void;
  onStartMerge: (id: string | null) => void;
  onExecuteMerge: (sourceId: string, targetId: string) => void;
  mergingSourceId: string | null;
  isAnonymous: boolean;
  isRevealed?: boolean;
  isPresentationMode?: boolean;
  isExporting?: boolean;
  onExportComplete?: () => void;
}

export function MuralPhase({
  ideas,
  currentUserId,
  onAddIdea,
  onDeleteIdea,
  onUpdateIdea,
  onVoteIdea,
  onStartMerge,
  onExecuteMerge,
  mergingSourceId,
  isAnonymous,
  isRevealed = true,
  isPresentationMode,
  isExporting,
  onExportComplete
}: MuralPhaseProps) {
  const muralRef = React.useRef<HTMLDivElement>(null);
  const [newIdea, setNewIdea] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState<'recent' | 'popular'>('recent');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (newIdea.trim()) {
      onAddIdea(newIdea.trim());
      setNewIdea("");
    }
  };

  const filteredIdeas = ideas.filter(idea => 
    idea.content.toLowerCase().includes(searchQuery.toLowerCase())
  ).sort((a, b) => {
    if (sortBy === 'popular') {
      const votesA = a.votes?.length || 0;
      const votesB = b.votes?.length || 0;
      if (votesB !== votesA) return votesB - votesA;
    }
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });
  
  React.useEffect(() => {
    if (isExporting && onExportComplete && muralRef.current) {
      toPng(muralRef.current, {
        backgroundColor: '#f8fafc',
        style: { borderRadius: '0' }
      }).then((dataUrl: string) => {
        const link = document.createElement('a');
        link.download = `brainstorming-mural.png`;
        link.href = dataUrl;
        link.click();
        onExportComplete();
      }).catch((err: any) => {
        console.error('Export failed', err);
        onExportComplete();
      });
    }
  }, [isExporting, onExportComplete]);

  return (
    <div className="flex h-full bg-slate-50/50" ref={muralRef}>
      <div className="flex-1 flex flex-col min-w-0 h-full">
        <div className="px-8 py-4 bg-white/50 backdrop-blur-sm border-b border-slate-200 flex items-center justify-between gap-4">
          <div className="relative flex-1 max-w-2xl">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Pesquisar ideias..." 
              className="pl-10 h-11 bg-white border-slate-200 rounded-xl focus-visible:ring-amber-500 font-medium"
            />
          </div>
          
          <div className="flex items-center gap-4">
            <div className="flex bg-slate-100 p-1 rounded-xl">
               <Button 
                variant={sortBy === 'recent' ? "secondary" : "ghost"} 
                size="sm" 
                onClick={() => setSortBy('recent')}
                className={cn(
                  "h-8 px-3 rounded-lg font-black text-[9px] uppercase tracking-widest",
                  sortBy === 'recent' ? "bg-white shadow-sm text-amber-600" : "text-slate-400"
                )}
               >
                  <Clock className="h-3 w-3 mr-1.5" /> Recentes
               </Button>
                <Button 
                 variant={sortBy === 'popular' ? "secondary" : "ghost"} 
                 size="sm" 
                 onClick={() => setSortBy('popular')}
                 className={cn(
                   "h-8 px-3 rounded-lg font-black text-[9px] uppercase tracking-widest",
                   sortBy === 'popular' ? "bg-white shadow-sm text-amber-600" : "text-slate-400"
                 )}
                >
                   <TrendingUp className="h-3 w-3 mr-1.5" /> Populares
                </Button>
             </div>

            <Separator orientation="vertical" className="h-8" />

            <div className="flex flex-col items-end min-w-[80px]">
               <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none">
                 {searchQuery ? 'Encontradas' : 'Total'}
               </span>
               <span className="text-xl font-black text-slate-800 leading-none mt-1">{filteredIdeas.length}</span>
            </div>
          </div>
        </div>

        {!isPresentationMode && (
          <div className="px-8 pt-6 pb-2 shrink-0">
            <form onSubmit={handleSubmit} className="relative group max-w-7xl mx-auto">
              <div className="absolute -inset-1 bg-gradient-to-r from-amber-500 to-orange-500 rounded-2xl blur opacity-10 group-focus-within:opacity-30 transition-opacity" />
              <div className="relative bg-white rounded-xl p-1.5 flex shadow-lg border border-slate-100">
                 <div className="w-10 h-10 rounded-lg bg-amber-50 flex items-center justify-center text-amber-500 shrink-0">
                    <MessageSquarePlus className="h-5 w-5" />
                 </div>
                 <Input 
                   value={newIdea}
                   onChange={(e) => setNewIdea(e.target.value)}
                   placeholder="O que você está pensando? Digite aqui..." 
                   className="flex-1 border-none shadow-none focus-visible:ring-0 h-10 text-sm font-bold text-slate-800 placeholder:text-slate-300 px-3"
                 />
                 <Button 
                   type="submit"
                   disabled={!newIdea.trim()}
                   className="h-10 px-6 rounded-lg bg-amber-500 hover:bg-amber-600 text-white font-black uppercase text-[9px] tracking-widest shadow-lg shadow-amber-200 transition-all active:scale-95"
                 >
                    Lançar
                    <Plus className="ml-2 h-3.5 w-3.5" />
                 </Button>
              </div>
            </form>
          </div>
        )}

        <ScrollArea className="flex-1 px-8 pb-12">
          {mergingSourceId && (
            <motion.div 
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              className="max-w-7xl mx-auto mb-8 p-4 bg-amber-50 border-2 border-amber-500/50 rounded-3xl flex items-center justify-between"
            >
               <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-amber-500 rounded-xl flex items-center justify-center text-white">
                     <TrendingUp className="h-5 w-5 rotate-90" />
                  </div>
                  <div>
                    <p className="text-xs font-black uppercase text-amber-700 tracking-wider">Modo de Fusão Ativo</p>
                    <p className="text-[10px] font-bold text-amber-600/80">Selecione o Card DESTINO para combinar os textos e votos.</p>
                  </div>
               </div>
               <Button 
                 variant="ghost" 
                 onClick={() => onStartMerge(null)}
                 className="h-10 px-4 rounded-xl text-amber-700 hover:bg-amber-100 font-black uppercase text-[10px] tracking-widest"
               >
                  Cancelar <X className="ml-2 h-4 w-4" />
               </Button>
            </motion.div>
          )}

          <div className={cn(
            "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 2xl:grid-cols-6 gap-6 py-4",
            ideas.length === 0 && "place-items-center h-full min-h-[400px]"
          )}>
            <AnimatePresence mode="popLayout">
              {filteredIdeas.length > 0 ? (
                filteredIdeas.map((idea) => (
                  <IdeaCard
                    key={idea.id}
                    idea={idea}
                    currentUserId={currentUserId}
                    isAnonymous={isAnonymous}
                    isRevealed={isRevealed}
                    onDelete={onDeleteIdea}
                    onUpdate={onUpdateIdea}
                    onVote={onVoteIdea}
                    onStartMerge={onStartMerge}
                    onMerge={(targetId) => {
                      if (mergingSourceId) onExecuteMerge(mergingSourceId, targetId);
                    }}
                    isMergingSource={idea.id === mergingSourceId}
                    canMerge={mergingSourceId !== null && idea.id !== mergingSourceId}
                    isHot={(idea.votes?.length || 0) >= 3}
                  />
                ))
              ) : (
                searchQuery ? (
                  <div className="col-span-full flex flex-col items-center justify-center py-20 text-slate-400">
                    <Search className="h-12 w-12 mb-4 opacity-10" />
                    <p className="font-bold text-sm uppercase tracking-widest">Nenhuma ideia corresponde à busca</p>
                  </div>
                ) : (
                  <div className="col-span-full flex flex-col items-center justify-center py-20 text-slate-300">
                    <div className="w-24 h-24 bg-slate-100 rounded-[2.5rem] flex items-center justify-center mb-6">
                       <Plus className="h-10 w-10 opacity-20" />
                    </div>
                    <p className="font-black text-lg uppercase tracking-tighter mb-2">O mural está vazio</p>
                    <p className="text-sm font-medium text-slate-400 max-w-xs text-center">
                      Comece a digitar no campo acima para lançar a primeira fagulha de criatividade!
                    </p>
                  </div>
                )
              )}
            </AnimatePresence>
          </div>
        </ScrollArea>
      </div>
    </div>
  );
}
