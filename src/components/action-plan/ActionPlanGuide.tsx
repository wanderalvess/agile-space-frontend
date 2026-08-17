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
  Target, 
  ListChecks, 
  Clock, 
  User, 
  Zap,
  LayoutGrid
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';

interface ActionPlanGuideProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ActionPlanGuide({ open, onOpenChange }: ActionPlanGuideProps) {
  const steps = [
    {
      title: "O Quê e Por Quê (What/Why)",
      icon: Target,
      color: "text-fuchsia-600",
      bg: "bg-fuchsia-50",
      description: "Descreva a ação com clareza e justifique sua importância. Isso garante que todos entendam o propósito da execução."
    },
    {
      title: "Responsabilidade (Who/Where)",
      icon: User,
      color: "text-cyan-600",
      bg: "bg-cyan-50",
      description: "Defina claramente quem fará a tarefa e onde (ambiente/squad) ela será executada para evitar gargalos."
    },
    {
      title: "Prazo e Status (When/Status)",
      icon: Clock,
      color: "text-rose-600",
      bg: "bg-rose-50",
      description: "Estabeleça datas ou sprints. Atualize o status clicando sobre ele (A Fazer > Em Andamento > Concluído > Impedido)."
    }
  ];

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-xl overflow-hidden flex flex-col p-0 border-none shadow-3xl bg-[#fafafa]">
        {/* HEADER ELITE */}
        <SheetHeader className="shrink-0 p-8 bg-slate-900 text-white relative overflow-hidden">
          <div className="absolute top-0 right-0 p-8 opacity-10 rotate-12">
             <ListChecks className="h-32 w-32" />
          </div>
          <div className="relative z-10">
            <div className="flex items-center gap-3 mb-4">
               <Badge variant="outline" className="border-fuchsia-500/50 text-fuchsia-400 bg-fuchsia-500/10 uppercase text-[9px] font-black tracking-widest px-3 py-1">
                  5W2H Framework
               </Badge>
            </div>
            <SheetTitle className="text-3xl font-black uppercase tracking-tighter italic text-white flex items-center gap-3">
               <ListChecks className="h-6 w-6 text-fuchsia-400" />
               Guia do Plano de Ação
            </SheetTitle>
            <SheetDescription className="text-slate-400 font-medium text-xs mt-2">
               Transforme ideias em execução clara utilizando a matriz 5W2H interativa.
            </SheetDescription>
          </div>
        </SheetHeader>

        <ScrollArea className="flex-1">
          <div className="p-8 space-y-10">
            <div className="space-y-6">
               <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400 border-b border-slate-100 pb-2">Princípios de Execução</h3>
               <div className="grid grid-cols-1 gap-4">
                  {steps.map((step, idx) => (
                    <div key={idx} className="flex gap-5 p-5 bg-white rounded-2xl border border-slate-100 shadow-sm hover:shadow-xl hover:shadow-fuchsia-500/5 transition-all group">
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
               <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400 border-b border-slate-100 pb-2">Atalhos da Matriz</h3>
               <div className="grid grid-cols-1 gap-2">
                  {[
                    { l: "Editar Célula", k: "Clique" },
                    { l: "Salvar Edição", k: "Enter" },
                    { l: "Alterar Status", k: "Clique no Botão de Status" }
                  ].map((item, i) => (
                    <div key={i} className="flex items-center justify-between p-4 bg-slate-100/50 rounded-xl">
                       <span className="text-[10px] font-black uppercase text-slate-500">{item.l}</span>
                       <kbd className="px-2 py-1 bg-white border border-slate-300 rounded text-[9px] font-black shadow-sm">{item.k}</kbd>
                    </div>
                  ))}
               </div>
            </div>

            {/* ALERT BOX */}
            <div className="p-6 bg-fuchsia-600 rounded-[2rem] text-white shadow-xl shadow-fuchsia-500/20 flex gap-4 items-center">
               <div className="w-12 h-12 bg-white/10 rounded-xl flex items-center justify-center shrink-0">
                  <Zap className="h-6 w-6 text-fuchsia-200" />
               </div>
               <div className="space-y-1">
                  <p className="text-[10px] font-black uppercase tracking-widest text-fuchsia-200">Dica Ágil</p>
                  <p className="text-[10px] font-medium leading-relaxed opacity-90 italic">
                     "Mantenha a descrição (What) e a justificativa (Why) o mais curtas e diretas possível para manter a leitura dinâmica."
                  </p>
               </div>
            </div>

            <div className="pt-4 pb-12">
               <Button 
                 variant="outline" 
                 className="w-full h-14 rounded-2xl border-2 border-slate-200 text-slate-900 font-black uppercase text-[10px] tracking-widest hover:bg-slate-50 transition-all gap-3"
                 asChild
               >
                 <a href="/manual#action-plan">
                   <Zap className="h-4 w-4 text-fuchsia-600" /> Acessar Manual Completo
                 </a>
               </Button>
            </div>
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}
