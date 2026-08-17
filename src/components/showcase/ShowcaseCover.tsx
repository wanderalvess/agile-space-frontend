'use client';

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Play } from 'lucide-react';
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

  return (
    <motion.div 
      initial={{ opacity: 0 }} 
      animate={{ opacity: 1 }} 
      className={cn("relative w-full h-full flex flex-col overflow-hidden", isLight ? "bg-[#fff]" : "bg-[#050510]")}
    >
      {/* BACKGROUND LAYER (Sempre Cinematográfico) */}
      <div className="absolute inset-0 z-0">
        {session.coverImage && bgLoaded ? (
          <>
            <img 
              src={getDirectImageUrl(session.coverImage)} 
              referrerPolicy="no-referrer"
              className="w-full h-full object-cover" 
              alt="Cover" 
              onError={() => setBgLoaded(false)}
            />
            {/* Gradientes Fortes para Garantir Leitura de Texto */}
            <div className={cn("absolute inset-0 bg-gradient-to-r to-transparent", isLight ? "from-white/95 via-white/80" : "from-slate-950/95 via-slate-950/80")} />
            <div className={cn("absolute inset-0 bg-gradient-to-t to-transparent via-transparent", isLight ? "from-white/90" : "from-slate-950/90")} />
          </>
        ) : (
          <div className={cn("w-full h-full relative overflow-hidden", isLight ? "bg-slate-100" : "bg-[#2e1065]")}>
             <div className={cn("absolute inset-0", isLight ? "bg-[radial-gradient(circle_at_0%_0%,rgba(0,0,0,0.05),transparent_50%)]" : "bg-[radial-gradient(circle_at_0%_0%,rgba(255,255,255,0.1),transparent_50%)]")} />
             <div className={cn("absolute inset-0 bg-gradient-to-br via-transparent to-transparent", isLight ? "from-slate-300/40" : "from-violet-900/40")} />
             <div className={cn("absolute bottom-0 right-0 w-[800px] h-[800px] blur-[120px] rounded-full translate-x-1/2 translate-y-1/2", isLight ? "bg-black/5" : "bg-white/5")} />
          </div>
        )}
      </div>

      {/* Close Button */}
      <div className="absolute top-8 right-8 z-50">
        <Button 
          variant="ghost" 
          size="icon" 
          onClick={onClose} 
          className={cn("h-12 w-12 rounded-2xl transition-all backdrop-blur-md border hover:bg-rose-500 hover:text-white", isLight ? "bg-black/5 text-black/40 border-black/5" : "bg-white/5 text-white/40 border-white/5")}
        >
          <Play className={cn("h-5 w-5 rotate-180", isLight ? "fill-slate-900" : "fill-white")} />
        </Button>
      </div>

      {/* Main Content */}
      <div className="relative z-10 flex-1 flex flex-col justify-center w-full">
         <div className="max-w-[1600px] mx-auto px-12 md:px-24 w-full grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
            {/* Left Column (White Text for High Contrast) */}
            <motion.div 
              initial={{ x: -50, opacity: 0 }} 
              animate={{ x: 0, opacity: 1 }}
              transition={{ delay: 0.2, duration: 0.8 }}
              className="space-y-10"
            >
               <div className="space-y-4">
                 {session.squadName && (
                   <div className="flex items-center gap-3 text-[#a78bfa] font-black text-sm md:text-xl uppercase tracking-[0.3em] drop-shadow-sm">
                      <div className="h-px w-8 bg-[#a78bfa]/50" />
                      {session.squadName}
                   </div>
                 )}
                  <h1
                    className={cn("font-black leading-[0.9] tracking-tighter drop-shadow-xl break-words", isLight ? "text-slate-900" : "text-white")}
                    style={{ fontSize: 'clamp(2.25rem, 5.5vw, 6rem)' }}
                  >
                    {session.name || 'Sprint Review'}
                  </h1>
                  <div className="w-24 h-2 bg-[#a78bfa] rounded-full mt-6" />
               </div>

               <div className="flex flex-col gap-2">
                  <span className={cn("text-[10px] font-black uppercase tracking-[0.4em]", isLight ? "text-slate-500" : "text-white/30")}>Período da Sessão</span>
                  <span className={cn("font-black text-2xl uppercase italic tracking-tight", isLight ? "text-slate-800" : "text-white")}>
                    {session.period || session.sprintName || 'Sprint Atual'}
                  </span>
               </div>

               <motion.div 
                 initial={{ opacity: 0 }} 
                 animate={{ opacity: 1 }}
                 transition={{ delay: 1 }}
                 className="pt-4"
               >
                 <Button 
                   onClick={onStart} 
                   className={cn("h-20 px-12 rounded-2xl font-black uppercase text-sm tracking-[0.3em] transition-all hover:scale-105 active:scale-95 group shadow-xl", 
                     isLight ? "bg-slate-900 text-white hover:bg-slate-800" : "bg-[#fff] text-[#050510] hover:bg-slate-100"
                   )}
                 >
                   Iniciar Apresentação
                   <Play className="h-5 w-5 ml-4 fill-current group-hover:translate-x-1 transition-transform" />
                 </Button>
               </motion.div>
            </motion.div>

            {/* Right Column (Glassmorphism Dark) */}
            <motion.div 
               initial={{ x: 50, opacity: 0 }} 
               animate={{ x: 0, opacity: 1 }}
               transition={{ delay: 0.4, duration: 0.8 }}
               className={cn("space-y-12 backdrop-blur-3xl p-12 rounded-[4rem] border shadow-2xl", isLight ? "bg-white/40 border-slate-200/50 shadow-slate-200/50" : "bg-black/40 border-white/5 shadow-black/40")}
            >
               {/* Objective */}
               <div className="space-y-4">
                  <div className="flex items-center gap-3">
                     <div className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                     <span className={cn("text-[10px] font-black uppercase tracking-[0.3em]", isLight ? "text-slate-500" : "text-white/40")}>Objetivo da Sessão</span>
                  </div>
                  <p className={cn("text-xl md:text-2xl font-medium leading-relaxed italic border-l-4 border-amber-500/50 pl-6 py-2", isLight ? "text-slate-700" : "text-white/90")}>
                    {session.description || "Demonstração técnica dos incrementos e entregas realizados durante o ciclo atual para validação dos stakeholders."}
                  </p>
               </div>
            </motion.div>
         </div>
      </div>
    </motion.div>
  );
}
