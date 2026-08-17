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
  Terminal, 
  Trophy, 
  Code2, 
  Zap, 
  Cpu,
  Workflow,
  ShieldCheck
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';

interface JoltGuideProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function JoltGuide({ open, onOpenChange }: JoltGuideProps) {
  const steps = [
    {
      title: "Playground de Engenharia",
      icon: Terminal,
      color: "text-indigo-600",
      bg: "bg-indigo-50",
      description: "Experimente códigos, teste APIs e valide lógicas de negócio em um ambiente isolado e seguro. O Jolt é o laboratório de inovação da squad."
    },
    {
      title: "Prototipagem Rápida",
      icon: Cpu,
      color: "text-blue-600",
      bg: "bg-blue-50",
      description: "Crie provas de conceito (PoC) sem precisar configurar um ambiente local completo. Valide ideias e compartilhe snippets com o time instantaneamente."
    },
    {
      title: "Colaboração Técnica",
      icon: Workflow,
      color: "text-emerald-600",
      bg: "bg-emerald-50",
      description: "Trabalhe em conjunto em desafios técnicos. O ambiente compartilhado facilita o Pair Programming e o Code Review síncrono."
    }
  ];

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-xl overflow-hidden flex flex-col p-0 border-none shadow-3xl bg-[#fafafa]">
        {/* HEADER ELITE */}
        <SheetHeader className="shrink-0 p-8 bg-slate-900 text-white relative overflow-hidden">
          <div className="absolute top-0 right-0 p-8 opacity-10 rotate-12">
             <Terminal className="h-32 w-32" />
          </div>
          <div className="relative z-10">
            <div className="flex items-center gap-3 mb-4">
               <Badge variant="outline" className="border-indigo-500/50 text-indigo-400 bg-indigo-500/10 uppercase text-[9px] font-black tracking-widest px-3 py-1">
                  Elite Engineering
               </Badge>
            </div>
            <SheetTitle className="text-3xl font-black uppercase tracking-tighter italic text-white flex items-center gap-3">
               <Terminal className="h-6 w-6 text-indigo-400" />
               Guia do Jolt Sandbox
            </SheetTitle>
            <SheetDescription className="text-slate-400 font-medium text-xs mt-2">
               Onde o código ganha vida e a inovação acontece.
            </SheetDescription>
          </div>
        </SheetHeader>

        <ScrollArea className="flex-1">
          <div className="p-8 space-y-10">
            <div className="space-y-6">
               <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400 border-b border-slate-100 pb-2">Ambiente de Testes</h3>
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
               <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400 border-b border-slate-100 pb-2">Atalhos do Editor</h3>
               <div className="grid grid-cols-1 gap-2">
                  {[
                    { l: "Executar Código", k: "Ctrl + Enter" },
                    { l: "Salvar Snapshot", k: "Ctrl + S" },
                    { l: "Formatar Código", k: "Alt + Shift + F" }
                  ].map((item, i) => (
                    <div key={i} className="flex items-center justify-between p-4 bg-slate-100/50 rounded-xl">
                       <span className="text-[10px] font-black uppercase text-slate-500">{item.l}</span>
                       <kbd className="px-2 py-1 bg-white border border-slate-300 rounded text-[9px] font-black shadow-sm">{item.k}</kbd>
                    </div>
                  ))}
               </div>
            </div>

            {/* ALERT BOX */}
            <div className="p-6 bg-indigo-600 rounded-[2rem] text-white shadow-xl shadow-indigo-500/20 flex gap-4 items-center">
               <div className="w-12 h-12 bg-white/10 rounded-xl flex items-center justify-center shrink-0">
                  <ShieldCheck className="h-6 w-6 text-indigo-200" />
               </div>
               <div className="space-y-1">
                  <p className="text-[10px] font-black uppercase tracking-widest text-indigo-200">Ambiente Seguro</p>
                  <p className="text-[10px] font-medium leading-relaxed opacity-90 italic">
                     "O Jolt utiliza isolamento total. Seus testes não afetam os dados de produção do Espaço Ágil."
                  </p>
               </div>
            </div>

            <div className="pt-4 pb-12">
               <Button 
                 variant="outline" 
                 className="w-full h-14 rounded-2xl border-2 border-slate-200 text-slate-900 font-black uppercase text-[10px] tracking-widest hover:bg-slate-50 transition-all gap-3"
                 asChild
               >
                 <a href="/manual#jolt">
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
