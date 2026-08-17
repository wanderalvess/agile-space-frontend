'use client';

import React from 'react';
import { 
  Zap, 
  Target, 
  TrendingUp,
  AlertTriangle,
  CheckCircle2
} from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';

interface MetricsHUDProps {
  devCapacityHours: number;
  qaCapacityHours: number;
  totalDevScope: number;
  totalQaScope: number;
  devLoadPercentage: number;
  qaLoadPercentage: number;
  isDevOverloaded: boolean;
  isQaOverloaded: boolean;
}

export function MetricsHUD({
  devCapacityHours,
  qaCapacityHours,
  totalDevScope,
  totalQaScope,
  devLoadPercentage,
  qaLoadPercentage,
  isDevOverloaded,
  isQaOverloaded,
}: MetricsHUDProps) {
  const isHealthy = !isDevOverloaded && !isQaOverloaded && (devLoadPercentage > 40 || qaLoadPercentage > 40);
  const isDanger = isDevOverloaded || isQaOverloaded;

  return (
    <div className="w-full px-6 py-3 bg-white/40 backdrop-blur-2xl border-b border-white/60 shadow-2xl shadow-slate-500/5 shrink-0 animate-in fade-in slide-in-from-top-4 duration-700 relative z-20">
      <div className="max-w-[1600px] mx-auto flex flex-col md:flex-row items-center gap-8 md:gap-12">
        {/* Status Badge */}
        <div className="flex items-center gap-4 shrink-0">
          <div className={cn(
            "h-12 w-12 rounded-[1.2rem] flex items-center justify-center shadow-xl transition-all duration-500 animate-pulse",
            isDanger ? "bg-red-500 text-white shadow-red-500/20" : 
            isHealthy ? "bg-emerald-500 text-white shadow-emerald-500/20" : 
            "bg-violet-600 text-white shadow-violet-500/20"
          )}>
            {isDanger ? <AlertTriangle className="h-6 w-6" /> : 
             isHealthy ? <CheckCircle2 className="h-6 w-6" /> : 
             <Target className="h-6 w-6" />}
          </div>
          <div className="flex flex-col">
             <span className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400 leading-none mb-1">Status Global</span>
             <span className={cn(
               "text-sm font-black uppercase tracking-tighter transition-colors",
               isDanger ? "text-red-600" : isHealthy ? "text-emerald-600" : "text-violet-600"
             )}>
                {isDanger ? "Sobrecarga Detectada" : isHealthy ? "Sprint Saudável" : "Plano em Aberto"}
             </span>
          </div>
        </div>

        {/* HUD Gauges */}
        <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-8 w-full">
           {/* Dev Gauge */}
           <div className="group relative">
              <div className="flex justify-between items-end mb-2 px-1">
                 <div className="flex items-center gap-2">
                    <Zap className={cn("h-3.5 w-3.5", isDevOverloaded ? "text-red-500" : "text-violet-600")} />
                    <span className="text-[9px] font-black uppercase tracking-widest text-slate-500">Capacidade DEV</span>
                 </div>
                 <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">{totalDevScope}h / {devCapacityHours}h</span>
                    <span className={cn(
                      "text-xl font-black italic tracking-tighter",
                      isDevOverloaded ? "text-red-600" : "text-slate-900"
                    )}>
                      {devLoadPercentage.toFixed(0)}%
                    </span>
                 </div>
              </div>
              <div className="relative h-3 w-full bg-slate-100 rounded-full overflow-hidden border border-slate-200/50">
                 <div 
                   className={cn(
                     "h-full transition-all duration-1000 ease-out rounded-full",
                     isDevOverloaded ? "bg-gradient-to-r from-red-500 to-rose-600 shadow-[0_0_15px_rgba(239,68,68,0.4)]" : "bg-gradient-to-r from-violet-500 to-indigo-600 shadow-[0_0_15px_rgba(139,92,246,0.2)]"
                   )}
                   style={{ width: `${Math.min(devLoadPercentage, 100)}%` }}
                 />
              </div>
           </div>

           {/* QA Gauge */}
           <div className="group relative">
              <div className="flex justify-between items-end mb-2 px-1">
                 <div className="flex items-center gap-2">
                    <TrendingUp className={cn("h-3.5 w-3.5", isQaOverloaded ? "text-red-500" : "text-fuchsia-600")} />
                    <span className="text-[9px] font-black uppercase tracking-widest text-slate-500">Capacidade QA</span>
                 </div>
                 <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">{totalQaScope}h / {qaCapacityHours}h</span>
                    <span className={cn(
                      "text-xl font-black italic tracking-tighter",
                      isQaOverloaded ? "text-red-600" : "text-slate-900"
                    )}>
                      {qaLoadPercentage.toFixed(0)}%
                    </span>
                 </div>
              </div>
              <div className="relative h-3 w-full bg-slate-100 rounded-full overflow-hidden border border-slate-200/50">
                 <div 
                   className={cn(
                     "h-full transition-all duration-1000 ease-out rounded-full",
                     isQaOverloaded ? "bg-gradient-to-r from-red-500 to-rose-600 shadow-[0_0_15px_rgba(239,68,68,0.4)]" : "bg-gradient-to-r from-fuchsia-500 to-pink-600 shadow-[0_0_15px_rgba(192,38,211,0.2)]"
                   )}
                   style={{ width: `${Math.min(qaLoadPercentage, 100)}%` }}
                 />
              </div>
           </div>
        </div>

        {/* Quick Summary Badge */}
        <div className="hidden lg:flex items-center gap-6 px-6 border-l border-slate-200 shrink-0">
           <div className="flex flex-col items-end">
              <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest leading-none">Total Scope</span>
              <span className="text-lg font-black text-slate-800 tracking-tighter">{totalDevScope + totalQaScope}h</span>
           </div>
           <div className="flex flex-col items-end">
              <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest leading-none">Net Change</span>
              <span className="text-lg font-black text-emerald-500 tracking-tighter">+{Math.round(totalDevScope * 1.5)}%</span>
           </div>
        </div>
      </div>
    </div>
  );
}
