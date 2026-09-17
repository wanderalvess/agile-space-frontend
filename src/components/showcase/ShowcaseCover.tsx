'use client';

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { X, Target, Layers, ArrowRight, TrendingUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ShowcaseSession } from './types';
import { getDirectImageUrl } from './utils';
import { cn } from '@/lib/utils';

interface ShowcaseCoverProps {
  session: ShowcaseSession;
  onStart: () => void;
  onClose: () => void;
  isLight?: boolean;
}

export function ShowcaseCover({ session, onStart, onClose, isLight }: ShowcaseCoverProps) {
  const [bgLoaded, setBgLoaded] = useState(true);

  const totalTasks = session.tasks?.length || 0;
  const metricsCards = session.tasks?.filter(t => t.cardKind === 'metrics').length || 0;
  const storiesCount = session.tasks?.filter(t => {
    const tp = (t.type || '').toLowerCase();
    return tp.includes('história') || tp.includes('historia') || tp.includes('story') || tp.includes('recurso');
  }).length || 0;

  return (
    <motion.div 
      initial={{ opacity: 0 }} 
      animate={{ opacity: 1 }} 
      className={cn("relative w-full h-full flex flex-col overflow-hidden", isLight ? "bg-white" : "bg-[#050510]")}
    >
      {/* BACKGROUND LAYER */}
      <div className="absolute inset-0 z-0 pointer-events-none">
        {session.coverImage && bgLoaded ? (
          <>
            <img 
              src={getDirectImageUrl(session.coverImage)} 
              referrerPolicy="no-referrer"
              className="w-full h-full object-cover" 
              alt="Cover" 
              onError={() => setBgLoaded(false)}
            />
            {/* Gradientes para garantir contraste e leitura impecável */}
            <div className={cn("absolute inset-0 bg-gradient-to-r to-transparent", isLight ? "from-white/95 via-white/80" : "from-slate-950/95 via-slate-950/80")} />
            <div className={cn("absolute inset-0 bg-gradient-to-t to-transparent via-transparent", isLight ? "from-white/90" : "from-slate-950/90")} />
          </>
        ) : (
          <div
            className={cn("w-full h-full relative overflow-hidden", isLight ? "bg-slate-50" : "bg-[#050510]")}
            style={session.presentationBackground ? {
              background: session.presentationBackground.startsWith('http')
                ? `linear-gradient(rgba(5, 5, 16, 0.9), rgba(5, 5, 16, 0.95)), url(${session.presentationBackground})`
                : session.presentationBackground,
              backgroundSize: 'cover',
              backgroundPosition: 'center'
            } : undefined}
          >
             <div className={cn("absolute inset-0", isLight ? "bg-[radial-gradient(circle_at_0%_0%,rgba(0,0,0,0.03),transparent_60%)]" : "bg-[radial-gradient(circle_at_0%_0%,rgba(255,255,255,0.08),transparent_60%)]")} />
             <div className={cn("absolute bottom-0 right-0 w-[800px] h-[800px] blur-[120px] rounded-full translate-x-1/2 translate-y-1/2", isLight ? "bg-violet-500/5" : "bg-violet-500/10")} />
          </div>
        )}
      </div>

      {/* Botão de Fechar / Sair do Modo Apresentação */}
      <div className="absolute top-8 right-8 z-50">
        <Button 
          variant="ghost" 
          size="icon" 
          onClick={onClose} 
          title="Sair do Modo Teatro"
          aria-label="Sair do Modo Teatro"
          className={cn(
            "h-12 w-12 rounded-2xl transition-all backdrop-blur-md border",
            isLight 
              ? "bg-white/80 text-slate-700 border-slate-200/90 hover:bg-rose-500 hover:text-white hover:border-rose-500 shadow-sm" 
              : "bg-white/5 text-white/60 border-white/10 hover:bg-rose-500 hover:text-white hover:border-rose-500"
          )}
        >
          <X className="h-5 w-5" />
        </Button>
      </div>

      {/* Conteúdo Principal */}
      <div className="relative z-10 flex-1 flex flex-col justify-center w-full">
         <div className="max-w-[1600px] mx-auto px-10 md:px-20 w-full grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-16 items-center">
            {/* Coluna Esquerda: Título da Sessão e Ação Principal */}
            <motion.div 
              initial={{ x: -40, opacity: 0 }} 
              animate={{ x: 0, opacity: 1 }}
              transition={{ delay: 0.15, duration: 0.7, ease: [0.23, 1, 0.32, 1] }}
              className="lg:col-span-7 space-y-8"
            >
               <div className="space-y-3">
                 {session.squadName && (
                   <div className={cn(
                     "inline-flex items-center gap-2.5 px-3.5 py-1.5 rounded-full text-xs font-black uppercase tracking-[0.25em] border backdrop-blur-md",
                     isLight 
                       ? "bg-violet-50 border-violet-200 text-violet-700 shadow-sm" 
                       : "bg-violet-500/10 border-violet-500/20 text-violet-300"
                   )}>
                      <span className="w-2 h-2 rounded-full bg-violet-600 animate-pulse" />
                      {session.squadName}
                   </div>
                 )}
                  <h1
                    className={cn("font-black leading-[0.92] tracking-tighter drop-shadow-xl break-words", isLight ? "text-slate-950" : "text-white")}
                    style={{ fontSize: 'clamp(2.5rem, 5.5vw, 5.5rem)' }}
                  >
                    {session.name || 'Sprint Review'}
                  </h1>
                  <div className={cn("w-20 h-1.5 rounded-full mt-4", isLight ? "bg-violet-600" : "bg-violet-400")} />
               </div>

               <div className="flex items-center gap-6">
                  <div className="flex flex-col">
                    <span className={cn("text-[9.5px] font-black uppercase tracking-[0.3em]", isLight ? "text-slate-400" : "text-white/40")}>
                      Ciclo / Período
                    </span>
                    <span className={cn("font-black text-xl uppercase tracking-tight mt-0.5", isLight ? "text-slate-900" : "text-white")}>
                      {session.period || session.sprintName || 'Sprint Atual'}
                    </span>
                  </div>
                  {totalTasks > 0 && (
                    <>
                      <div className={cn("h-8 w-px", isLight ? "bg-slate-200" : "bg-white/10")} />
                      <div className="flex flex-col">
                        <span className={cn("text-[9.5px] font-black uppercase tracking-[0.3em]", isLight ? "text-slate-400" : "text-white/40")}>
                          Entregas Prontas
                        </span>
                        <span className={cn("font-black text-xl font-code mt-0.5", isLight ? "text-violet-700" : "text-violet-400")}>
                          {totalTasks} {totalTasks === 1 ? 'item' : 'itens'}
                        </span>
                      </div>
                    </>
                  )}
               </div>

               <motion.div 
                 initial={{ opacity: 0, y: 15 }} 
                 animate={{ opacity: 1, y: 0 }}
                 transition={{ delay: 0.4 }}
                 className="pt-2"
               >
                 <Button 
                   onClick={onStart} 
                   className={cn(
                     "h-16 px-10 rounded-2xl font-black uppercase text-xs tracking-[0.25em] transition-all hover:scale-[1.02] active:scale-[0.98] group shadow-2xl flex items-center gap-3", 
                     isLight 
                       ? "bg-violet-600 text-white hover:bg-violet-700 shadow-violet-600/30" 
                       : "bg-white text-slate-950 hover:bg-slate-100 shadow-white/10"
                   )}
                 >
                   <span>Iniciar Apresentação</span>
                   <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                 </Button>
               </motion.div>
            </motion.div>

            {/* Coluna Direita: Briefing Executivo da Sessão */}
            <motion.div 
               initial={{ x: 40, opacity: 0 }} 
               animate={{ x: 0, opacity: 1 }}
               transition={{ delay: 0.3, duration: 0.7, ease: [0.23, 1, 0.32, 1] }}
               className={cn(
                 "lg:col-span-5 space-y-6 backdrop-blur-3xl p-8 md:p-10 rounded-[3rem] border shadow-2xl transition-all", 
                 isLight 
                   ? "bg-white/90 border-slate-200/90 shadow-slate-200/60" 
                   : "bg-[#080814]/80 border-white/10 shadow-black/60"
               )}
            >
               {/* Objetivos */}
               <div className="space-y-3">
                  <div className="flex items-center gap-2.5">
                     <Target className="h-4 w-4 text-violet-500 shrink-0" />
                     <span className={cn("text-[9.5px] font-black uppercase tracking-[0.25em]", isLight ? "text-slate-400" : "text-white/40")}>
                       Objetivo da Sprint
                     </span>
                  </div>
                  <p className={cn("text-base md:text-lg font-medium leading-relaxed border-l-2 border-violet-500/60 pl-4 py-1", isLight ? "text-slate-800" : "text-white/90")}>
                    {session.description || "Demonstração técnica dos incrementos e entregas realizados durante o ciclo para validação dos stakeholders."}
                  </p>
               </div>

               {/* Mini Painel de Entregas */}
               {totalTasks > 0 && (
                 <div className="grid grid-cols-2 gap-3 pt-4 border-t border-slate-100 dark:border-white/5">
                   <div className={cn("p-3.5 rounded-2xl border", isLight ? "bg-slate-50/80 border-slate-200/60" : "bg-white/[0.03] border-white/5")}>
                     <div className="flex items-center gap-1.5 mb-1">
                       <Layers className="h-3 w-3 text-violet-500" />
                       <span className={cn("text-[8.5px] font-black uppercase tracking-wider", isLight ? "text-slate-500" : "text-white/50")}>
                         Pauta da Cerimônia
                       </span>
                     </div>
                     <p className={cn("text-xl font-black font-code", isLight ? "text-slate-900" : "text-white")}>
                       {totalTasks} <span className="text-xs font-normal text-slate-400">cards</span>
                     </p>
                   </div>

                   <div className={cn("p-3.5 rounded-2xl border", isLight ? "bg-slate-50/80 border-slate-200/60" : "bg-white/[0.03] border-white/5")}>
                     <div className="flex items-center gap-1.5 mb-1">
                       <TrendingUp className="h-3 w-3 text-emerald-500" />
                       <span className={cn("text-[8.5px] font-black uppercase tracking-wider", isLight ? "text-slate-500" : "text-white/50")}>
                         Tipo Dominante
                       </span>
                     </div>
                     <p className={cn("text-sm font-black truncate mt-1", isLight ? "text-emerald-700" : "text-emerald-400")}>
                       {storiesCount > 0 ? `${storiesCount} Histórias` : metricsCards > 0 ? `${metricsCards} Métricas` : 'Funcionalidades'}
                     </p>
                   </div>
                 </div>
               )}
            </motion.div>
         </div>
      </div>
    </motion.div>
  );
}

