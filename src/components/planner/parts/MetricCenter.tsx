'use client';

import React from 'react';
import { Target } from 'lucide-react';
import { CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';

interface MetricCenterProps {
  devCapacityHours: number;
  qaCapacityHours: number;
  totalDevScope: number;
  totalQaScope: number;
  devLoadPercentage: number;
  qaLoadPercentage: number;
  isDevOverloaded: boolean;
  isQaOverloaded: boolean;
}

export function MetricCenter({
  devCapacityHours,
  qaCapacityHours,
  totalDevScope,
  totalQaScope,
  devLoadPercentage,
  qaLoadPercentage,
  isDevOverloaded,
  isQaOverloaded,
}: MetricCenterProps) {
  return (
    <>
      <CardHeader className="pt-6 pb-4 px-8 flex-row justify-between items-center space-y-0 text-slate-900 border-b border-white/40 glass-surface mt-2 mx-2 rounded-t-[2rem]">
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-2xl bg-slate-900 text-white shadow-xl shadow-slate-900/20 rotate-3 group-hover:rotate-0 transition-transform">
            <Target className="h-5 w-5" />
          </div>
          <div>
            <CardTitle className="text-lg font-black uppercase tracking-tighter text-slate-800">Escopo da Sprint</CardTitle>
            <CardDescription className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-none mt-1">Status da Carga Atual</CardDescription>
          </div>
        </div>
        {(isDevOverloaded || isQaOverloaded) && (
          <Badge className="bg-red-500 text-white border-none h-7 px-3 rounded-xl animate-pulse text-[9px] font-black uppercase tracking-widest">
             SOBRECARGA DETECTADA
          </Badge>
        )}
      </CardHeader>
      
      <div className="px-8 py-6 bg-slate-50/50 border-b border-slate-100 grid grid-cols-1 md:grid-cols-2 gap-8 shrink-0">
        <div className="space-y-3">
          <div className="flex justify-between items-end mb-1">
            <div className="flex flex-col">
              <span className="text-[9px] font-black uppercase tracking-widest text-violet-600 leading-none mb-1">DEV LOAD</span>
              <span className="text-[10px] font-bold text-slate-500">{totalDevScope}h / {devCapacityHours}h</span>
            </div>
            <span className={cn("text-lg font-black italic tracking-tighter", isDevOverloaded ? "text-red-500" : "text-slate-900")}>
              {devLoadPercentage.toFixed(0)}%
            </span>
          </div>
          <Progress 
            value={Math.min(devLoadPercentage, 100)} 
            className="h-3 bg-slate-200 rounded-full" 
          />
        </div>
        
        <div className="space-y-3">
          <div className="flex justify-between items-end mb-1">
            <div className="flex flex-col">
              <span className="text-[9px] font-black uppercase tracking-widest text-fuchsia-600 leading-none mb-1">QA LOAD</span>
              <span className="text-[10px] font-bold text-slate-500">{totalQaScope}h / {qaCapacityHours}h</span>
            </div>
            <span className={cn("text-lg font-black italic tracking-tighter", isQaOverloaded ? "text-red-500" : "text-slate-900")}>
              {qaLoadPercentage.toFixed(0)}%
            </span>
          </div>
          <Progress 
            value={Math.min(qaLoadPercentage, 100)} 
            className="h-3 bg-slate-200 rounded-full" 
          />
        </div>
      </div>
    </>
  );
}
