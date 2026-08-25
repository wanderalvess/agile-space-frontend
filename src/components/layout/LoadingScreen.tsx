
'use client';

import { Logo } from '@/components/Logo';
import { Loader2 } from 'lucide-react';

interface LoadingScreenProps {
  message?: string;
  submessage?: string;
}

export function LoadingScreen({ 
  message = "Carregando...", 
  submessage = "Preparando seu espaço de trabalho" 
}: LoadingScreenProps) {
  return (
    <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-[#fafafa] dark:bg-slate-950">
      {/* ELITE MESH BACKGROUND */}
      <div className="absolute inset-0 -z-10 overflow-hidden pointer-events-none">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-primary/10 rounded-full blur-[120px] animate-pulse" />
        <div className="absolute top-1/4 left-1/4 w-[300px] h-[300px] bg-blue-500/5 rounded-full blur-[80px] animate-pulse" style={{ animationDelay: '1s' }} />
        <div className="absolute bottom-1/4 right-1/4 w-[320px] h-[320px] bg-amber-500/5 rounded-full blur-[90px] animate-pulse" style={{ animationDelay: '2s' }} />
      </div>

      <div className="relative flex flex-col items-center gap-10">
        {/* Logo with pulsing effect */}
        <div className="relative group">
          <div className="absolute inset-0 bg-primary/30 blur-3xl rounded-full scale-150 animate-pulse transition-all duration-1000" />
          <div className="relative z-10 p-6 bg-white/40 dark:bg-slate-900/40 backdrop-blur-3xl rounded-[2.5rem] border border-white dark:border-slate-800 shadow-2xl shadow-primary/10">
            <Logo className="h-24 w-24 animate-[bounce_2s_infinite_ease-in-out]" />
          </div>
        </div>

        {/* Text and Spinner */}
        <div className="flex flex-col items-center gap-4 text-center px-4 relative z-10">
          <div className="flex items-center gap-4 py-2 px-6 bg-white/60 dark:bg-slate-900/60 backdrop-blur-xl border border-white dark:border-slate-800 rounded-2xl shadow-xl shadow-slate-200/50 dark:shadow-slate-900/50">
            <div className="relative">
              <Loader2 className="h-6 w-6 animate-spin text-primary relative z-10" />
              <div className="absolute inset-0 bg-primary/20 blur-md rounded-full animate-pulse" />
            </div>
            <h2 className="text-3xl font-black font-headline uppercase tracking-tighter text-slate-900 dark:text-slate-100 italic">
              {message}
            </h2>
          </div>
          
          <div className="flex flex-col items-center gap-2">
            <p className="text-slate-500 font-black animate-pulse text-[10px] uppercase tracking-[0.4em] ml-[0.4em]">
              {submessage}
            </p>
            
            {/* Elite Progress Indicator */}
            <div className="w-56 h-1.5 bg-slate-200/50 dark:bg-slate-800/50 rounded-full overflow-hidden relative mt-2 border border-white/50 dark:border-slate-700/50 shadow-inner">
               <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/40 dark:via-white/10 to-transparent animate-[shimmer_2s_infinite]" />
               <div className="h-full bg-gradient-to-r from-primary to-orange-400 rounded-full animate-[loading-bar_2s_infinite_ease-in-out] shadow-[0_0_10px_rgba(255,107,0,0.5)]" />
            </div>
          </div>
        </div>
      </div>
      
      <style jsx global>{`
        @keyframes loading-bar {
          0% { width: 0%; transform: translateX(-100%); }
          50% { width: 70%; transform: translateX(20%); }
          100% { width: 0%; transform: translateX(200%); }
        }
        @keyframes shimmer {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(100%); }
        }
      `}</style>
    </div>
  );
}
