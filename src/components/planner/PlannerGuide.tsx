"use client";

import React from 'react';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { 
  Sparkles, 
  CalendarDays, 
  Trophy, 
  ListChecks, 
  History, 
  Zap,
  Layout
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';

interface PlannerGuideProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function PlannerGuide({ open, onOpenChange }: PlannerGuideProps) {
  const steps = [
    {
      title: "Planejamento de Sprint",
      icon: ListChecks,
      color: "text-indigo-600",
      bg: "bg-indigo-50",
      description: "Defina o objetivo da sprint e selecione as tarefas priorizadas. O planner ajuda a equilibrar a carga de trabalho com a capacidade real do time."
    },
    {
      title: "Histórico & Velocidade",
      icon: History,
      color: "text-blue-600",
      bg: "bg-blue-50",
      description: "Analise o desempenho de sprints passadas para prever entregas futuras. Use métricas de velocidade para evitar sobrecarga e garantir previsibilidade."
    },
    {
      title: "Alinhamento de Squad",
      icon: Layout,
      color: "text-emerald-600",
      bg: "bg-emerald-50",
      description: "Mantenha todos na mesma página sobre as prioridades. O quadro visual facilita a visualização de dependências e do progresso geral do ciclo."
    }
  ];

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-xl overflow-hidden flex flex-col p-0 border-none shadow-3xl bg-[#fafafa]">
        {/* HEADER PREMIUM */}
        <SheetHeader className="shrink-0 p-8 bg-slate-900 text-white relative overflow-hidden">
          <div className="absolute top-0 right-0 p-8 opacity-10 rotate-12">
             <CalendarDays className="h-32 w-32" />
          </div>
          <div className="relative z-10">
            <div className="flex items-center gap-3 mb-4">
               <Badge variant="outline" className="border-indigo-500/50 text-indigo-400 bg-indigo-500/10 uppercase text-[9px] font-black tracking-widest px-3 py-1">
                  Ciclo de Entrega
               </Badge>
            </div>
            <SheetTitle className="text-3xl font-black uppercase tracking-tighter italic text-white flex items-center gap-3">
               <CalendarDays className="h-6 w-6 text-indigo-400" />
               Guia do Sprint Planner
            </SheetTitle>
            <SheetDescription className="text-slate-400 font-medium text-xs mt-2">
               Organize, priorize e execute com máxima eficiência tática.
            </SheetDescription>
          </div>
        </SheetHeader>

        <ScrollArea className="flex-1">
          <div className="p-8 space-y-10">
            <div className="space-y-6">
               <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400 border-b border-slate-100 pb-2">Gestão de Ciclo</h3>
               <div className="grid grid-cols-1 gap-4">
                  {steps.map((step, idx) => (
                    <div key={idx} className="flex gap-5 p-5 bg-white rounded-2xl border border-slate-100 shadow-sm hover:shadow-xl hover:shadow-indigo-500/5 transition-all group">
                       <div className={`w-12 h-12 ${step.bg} rounded-xl flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform`}>
                          <step.icon className={`h-6 w-6 ${step.color}`} />
                       </div>
                       <div className="space-y-1">
                          <p className="text-xs font-black uppercase tracking-tight text-slate-900">{step.title}</p>
                          <p className="text-[11px] text-slate-500 leading-relaxed font-medium">{step.description}</p>
                       </div>
                    </div>
                  ))}
               </div>
            </div>

            <div className="space-y-6">
               <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400 border-b border-slate-100 pb-2">Dicas de Sucesso</h3>
               <div className="grid grid-cols-1 gap-3">
                  {[
                    { l: "Objetivo Claro", d: "Uma sprint sem objetivo é apenas uma lista de tarefas. Defina o que define o sucesso do ciclo." },
                    { l: "Capacidade Real", d: "Considere feriados, férias e reuniões ao definir quanto trabalho o time pode absorver." }
                  ].map((item, i) => (
                    <div key={i} className="p-4 bg-slate-50 rounded-2xl border border-slate-100 space-y-1">
                       <p className="text-[10px] font-black uppercase text-slate-900">{item.l}</p>
                       <p className="text-[10px] text-slate-500 font-medium leading-relaxed">{item.d}</p>
                    </div>
                  ))}
               </div>
            </div>

            {/* ALERT BOX */}
            <div className="p-6 bg-indigo-600 rounded-[2rem] text-white shadow-xl shadow-indigo-500/20 flex gap-4 items-center">
               <div className="w-12 h-12 bg-white/10 rounded-xl flex items-center justify-center shrink-0">
                  <Trophy className="h-6 w-6 text-indigo-200" />
               </div>
               <div className="space-y-1">
                  <p className="text-[10px] font-black uppercase tracking-widest text-indigo-200">Foco no Valor</p>
                  <p className="text-[10px] font-medium leading-relaxed opacity-90 italic">
                     "Priorize tarefas que entregam o maior valor de negócio primeiro. O Planner ajuda a manter o foco no que importa."
                  </p>
               </div>
            </div>

            <div className="pt-4 pb-12">
               <Button 
                 variant="outline" 
                 className="w-full h-14 rounded-2xl border-2 border-slate-200 text-slate-900 font-black uppercase text-[10px] tracking-widest hover:bg-slate-50 transition-all gap-3"
                 asChild
               >
                 <a href="/manual#planner">
                   <Zap className="h-4 w-4 text-indigo-600" /> Acessar Manual Completo
                 </a>
               </Button>
            </div>
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}
