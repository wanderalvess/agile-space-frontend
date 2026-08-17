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
  HeartPulse, 
  Trophy, 
  BarChart3, 
  Smile, 
  Zap,
  Activity,
  ShieldCheck
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';

interface HealthGuideProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function HealthGuide({ open, onOpenChange }: HealthGuideProps) {
  const steps = [
    {
      title: "Auto-Avaliação Sincera",
      icon: Smile,
      color: "text-emerald-600",
      bg: "bg-emerald-50",
      description: "Cada membro avalia o estado da squad em diferentes dimensões. O anonimato garante que o time possa expressar sentimentos reais sem receio."
    },
    {
      title: "Dimensões da Agilidade",
      icon: Activity,
      color: "text-blue-600",
      bg: "bg-blue-50",
      description: "Avaliamos pilares como Qualidade Técnica, Valor de Negócio, Missão e Saúde do Time para identificar onde precisamos focar esforços."
    },
    {
      title: "Plano de Recuperação",
      icon: BarChart3,
      color: "text-indigo-600",
      bg: "bg-indigo-50",
      description: "Os resultados geram um radar visual. Use os 'pontos de dor' para criar ações específicas que melhorem a saúde da squad a longo prazo."
    }
  ];

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-xl overflow-hidden flex flex-col p-0 border-none shadow-3xl bg-[#fafafa]">
        {/* HEADER ELITE */}
        <SheetHeader className="shrink-0 p-8 bg-slate-900 text-white relative overflow-hidden">
          <div className="absolute top-0 right-0 p-8 opacity-10 rotate-12">
             <HeartPulse className="h-32 w-32" />
          </div>
          <div className="relative z-10">
            <div className="flex items-center gap-3 mb-4">
               <Badge variant="outline" className="border-emerald-500/50 text-emerald-400 bg-emerald-500/10 uppercase text-[9px] font-black tracking-widest px-3 py-1">
                  Saúde Organizacional
               </Badge>
            </div>
            <SheetTitle className="text-3xl font-black uppercase tracking-tighter italic text-white flex items-center gap-3">
               <HeartPulse className="h-6 w-6 text-emerald-400" />
               Guia do Radar de Saúde
            </SheetTitle>
            <SheetDescription className="text-slate-400 font-medium text-xs mt-2">
               Monitore os sinais vitais da sua squad e promova um ambiente sustentável.
            </SheetDescription>
          </div>
        </SheetHeader>

        <ScrollArea className="flex-1">
          <div className="p-8 space-y-10">
            <div className="space-y-6">
               <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400 border-b border-slate-100 pb-2">Diagnóstico de Squad</h3>
               <div className="grid grid-cols-1 gap-4">
                  {steps.map((step, idx) => (
                    <div key={idx} className="flex gap-5 p-5 bg-white rounded-2xl border border-slate-100 shadow-sm hover:shadow-xl hover:shadow-emerald-500/5 transition-all group">
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
               <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400 border-b border-slate-100 pb-2">Como Interpretar</h3>
               <div className="grid grid-cols-1 gap-3">
                  {[
                    { l: "🟢 Verde", d: "Tudo certo! Mantendo o padrão e compartilhando boas práticas." },
                    { l: "🟡 Amarelo", d: "Atenção necessária. Algo está impedindo o time de atingir o potencial." },
                    { l: "🔴 Vermelho", d: "Crítico. Requer intervenção imediata ou discussão profunda na retro." }
                  ].map((item, i) => (
                    <div key={i} className="p-4 bg-slate-50 rounded-2xl border border-slate-100 space-y-1">
                       <p className="text-[10px] font-black uppercase text-slate-900">{item.l}</p>
                       <p className="text-[10px] text-slate-500 font-medium leading-relaxed">{item.d}</p>
                    </div>
                  ))}
               </div>
            </div>

            {/* ALERT BOX */}
            <div className="p-6 bg-emerald-600 rounded-[2rem] text-white shadow-xl shadow-emerald-500/20 flex gap-4 items-center">
               <div className="w-12 h-12 bg-white/10 rounded-xl flex items-center justify-center shrink-0">
                  <ShieldCheck className="h-6 w-6 text-emerald-200" />
               </div>
               <div className="space-y-1">
                  <p className="text-[10px] font-black uppercase tracking-widest text-emerald-200">Segurança de Dados</p>
                  <p className="text-[10px] font-medium leading-relaxed opacity-90 italic">
                     "As avaliações individuais são 100% anônimas. O sistema exibe apenas a média consolidada para proteger a privacidade."
                  </p>
               </div>
            </div>

            <div className="pt-4 pb-12">
               <Button 
                 variant="outline" 
                 className="w-full h-14 rounded-2xl border-2 border-slate-200 text-slate-900 font-black uppercase text-[10px] tracking-widest hover:bg-slate-50 transition-all gap-3"
                 asChild
               >
                 <a href="/manual#health-check">
                   <Zap className="h-4 w-4 text-emerald-600" /> Acessar Manual Completo
                 </a>
               </Button>
            </div>
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}
