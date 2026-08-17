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
  WalletCards, 
  BrainCircuit, 
  Trophy, 
  Eye, 
  ListPlus,
  Zap,
  Info,
  ShieldCheck
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';

interface PokerGuideProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function PokerGuide({ open, onOpenChange }: PokerGuideProps) {
  const steps = [
    {
      title: "Votos Sem Influência",
      icon: Eye,
      color: "text-blue-600",
      bg: "bg-blue-50",
      description: "Os votos ficam ocultos para que ninguém se sinta pressionado. Isso revela o que cada membro do time realmente pensa sobre o esforço técnico."
    },
    {
      title: "Debate de Divergências",
      icon: BrainCircuit,
      color: "text-indigo-600",
      bg: "bg-indigo-50",
      description: "Diferenças grandes de votos (ex: 3h vs 13h) são sinais de riscos ocultos. É o momento perfeito para o time alinhar a complexidade."
    },
    {
      title: "Consenso & Exportação",
      icon: ListPlus,
      color: "text-emerald-600",
      bg: "bg-emerald-50",
      description: "O facilitador salva o consenso e pronto. Os dados estarão disponíveis para importação automática no Sprint Planner depois."
    }
  ];

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-xl overflow-hidden flex flex-col p-0 border-none shadow-3xl bg-[#fafafa]">
        {/* HEADER ELITE */}
        <SheetHeader className="shrink-0 p-8 bg-slate-900 text-white relative overflow-hidden">
          <div className="absolute top-0 right-0 p-8 opacity-10 rotate-12">
             <WalletCards className="h-32 w-32" />
          </div>
          <div className="relative z-10">
            <div className="flex items-center gap-3 mb-4">
               <Badge variant="outline" className="border-blue-500/50 text-blue-400 bg-blue-500/10 uppercase text-[9px] font-black tracking-widest px-3 py-1">
                  Ritual de Refinamento
               </Badge>
            </div>
            <SheetTitle className="text-3xl font-black uppercase tracking-tighter italic text-white flex items-center gap-3">
               <WalletCards className="h-6 w-6 text-blue-400" />
               Guia do Scrum Poker
            </SheetTitle>
            <SheetDescription className="text-slate-400 font-medium text-xs mt-2">
               Estimativas precisas e sem viés para sua próxima sprint.
            </SheetDescription>
          </div>
        </SheetHeader>

        <ScrollArea className="flex-1">
          <div className="p-8 space-y-10">
            <div className="space-y-6">
               <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400 border-b border-slate-100 pb-2">Fundamentos da Estimativa</h3>
               <div className="grid grid-cols-1 gap-4">
                  {steps.map((step, idx) => (
                    <div key={idx} className="flex gap-5 p-5 bg-white rounded-2xl border border-slate-100 shadow-sm hover:shadow-xl hover:shadow-blue-500/5 transition-all group">
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
               <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400 border-b border-slate-100 pb-2">Decks Disponíveis</h3>
               <div className="grid grid-cols-2 gap-4">
                  <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 space-y-2">
                     <p className="text-[10px] font-black uppercase text-slate-900">Fibonacci</p>
                     <p className="text-[9px] text-slate-500 font-medium">Ideal para User Stories e complexidade relativa.</p>
                  </div>
                  <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 space-y-2">
                     <p className="text-[10px] font-black uppercase text-slate-900">Horas</p>
                     <p className="text-[9px] text-slate-500 font-medium">Ideal para sub-tarefas e esforço técnico direto.</p>
                  </div>
               </div>
            </div>

            {/* ALERT BOX */}
            <div className="p-6 bg-emerald-600 rounded-[2rem] text-white shadow-xl shadow-emerald-500/20 flex gap-4 items-center">
               <div className="w-12 h-12 bg-white/10 rounded-xl flex items-center justify-center shrink-0">
                  <Trophy className="h-6 w-6 text-emerald-200" />
               </div>
               <div className="space-y-1">
                  <p className="text-[10px] font-black uppercase tracking-widest text-emerald-200">Consenso Inteligente</p>
                  <p className="text-[10px] font-medium leading-relaxed opacity-90 italic">
                     "O sistema celebra quando papéis do mesmo tipo (ex: todos os Devs) entram em acordo unânime."
                  </p>
               </div>
            </div>

            <div className="pt-4 pb-12">
               <Button 
                 variant="outline" 
                 className="w-full h-14 rounded-2xl border-2 border-slate-200 text-slate-900 font-black uppercase text-[10px] tracking-widest hover:bg-slate-50 transition-all gap-3"
                 asChild
               >
                 <a href="/manual#poker">
                   <Zap className="h-4 w-4 text-blue-600" /> Acessar Manual Completo
                 </a>
               </Button>
            </div>
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}
