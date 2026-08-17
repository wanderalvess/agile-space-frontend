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
  Lightbulb, 
  Trophy, 
  MousePointer2, 
  Layers, 
  Zap,
  Layout
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';

interface BrainstormingGuideProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function BrainstormingGuide({ open, onOpenChange }: BrainstormingGuideProps) {
  const steps = [
    {
      title: "Ideação Livre",
      icon: Lightbulb,
      color: "text-amber-600",
      bg: "bg-amber-50",
      description: "Dê vazão à criatividade sem julgamentos. Use post-its coloridos para capturar ideias rápidas e insights do time em tempo real."
    },
    {
      title: "Colaboração Síncrona",
      icon: MousePointer2,
      color: "text-blue-600",
      bg: "bg-blue-50",
      description: "Veja os cursores dos colegas e interaja no canvas. O agrupamento de ideias ajuda a identificar padrões e temas emergentes."
    },
    {
      title: "Convergência",
      icon: Layout,
      color: "text-emerald-600",
      bg: "bg-emerald-50",
      description: "Transforme o caos em estrutura. Organize as melhores ideias em um plano acionável ou exporte para outros módulos da plataforma."
    }
  ];

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-xl overflow-hidden flex flex-col p-0 border-none shadow-3xl bg-[#fafafa]">
        {/* HEADER ELITE */}
        <SheetHeader className="shrink-0 p-8 bg-slate-900 text-white relative overflow-hidden">
          <div className="absolute top-0 right-0 p-8 opacity-10 rotate-12">
             <Lightbulb className="h-32 w-32" />
          </div>
          <div className="relative z-10">
            <div className="flex items-center gap-3 mb-4">
               <Badge variant="outline" className="border-amber-500/50 text-amber-400 bg-amber-500/10 uppercase text-[9px] font-black tracking-widest px-3 py-1">
                  Design Thinking
               </Badge>
            </div>
            <SheetTitle className="text-3xl font-black uppercase tracking-tighter italic text-white flex items-center gap-3">
               <Lightbulb className="h-6 w-6 text-amber-400" />
               Guia do Brainstorming
            </SheetTitle>
            <SheetDescription className="text-slate-400 font-medium text-xs mt-2">
               Explore o potencial criativo da sua squad em um canvas infinito.
            </SheetDescription>
          </div>
        </SheetHeader>

        <ScrollArea className="flex-1">
          <div className="p-8 space-y-10">
            <div className="space-y-6">
               <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400 border-b border-slate-100 pb-2">Princípios Criativos</h3>
               <div className="grid grid-cols-1 gap-4">
                  {steps.map((step, idx) => (
                    <div key={idx} className="flex gap-5 p-5 bg-white rounded-2xl border border-slate-100 shadow-sm hover:shadow-xl hover:shadow-amber-500/5 transition-all group">
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
               <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400 border-b border-slate-100 pb-2">Atalhos do Canvas</h3>
               <div className="grid grid-cols-1 gap-2">
                  {[
                    { l: "Novo Post-it", k: "Duplo Clique" },
                    { l: "Mover Canvas", k: "Espaço + Arrastar" },
                    { l: "Zoom", k: "Scroll ou +/-" }
                  ].map((item, i) => (
                    <div key={i} className="flex items-center justify-between p-4 bg-slate-100/50 rounded-xl">
                       <span className="text-[10px] font-black uppercase text-slate-500">{item.l}</span>
                       <kbd className="px-2 py-1 bg-white border border-slate-300 rounded text-[9px] font-black shadow-sm">{item.k}</kbd>
                    </div>
                  ))}
               </div>
            </div>

            {/* ALERT BOX */}
            <div className="p-6 bg-amber-600 rounded-[2rem] text-white shadow-xl shadow-amber-500/20 flex gap-4 items-center">
               <div className="w-12 h-12 bg-white/10 rounded-xl flex items-center justify-center shrink-0">
                  <Zap className="h-6 w-6 text-amber-200" />
               </div>
               <div className="space-y-1">
                  <p className="text-[10px] font-black uppercase tracking-widest text-amber-200">Dica de Facilitação</p>
                  <p className="text-[10px] font-medium leading-relaxed opacity-90 italic">
                     "Use o temporizador para criar sessões de ideação rápidas e focadas (time-boxing). Isso evita o cansaço criativo."
                  </p>
               </div>
            </div>

            <div className="pt-4 pb-12">
               <Button 
                 variant="outline" 
                 className="w-full h-14 rounded-2xl border-2 border-slate-200 text-slate-900 font-black uppercase text-[10px] tracking-widest hover:bg-slate-50 transition-all gap-3"
                 asChild
               >
                 <a href="/manual#brainstorming">
                   <Zap className="h-4 w-4 text-amber-600" /> Acessar Manual Completo
                 </a>
               </Button>
            </div>
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}
