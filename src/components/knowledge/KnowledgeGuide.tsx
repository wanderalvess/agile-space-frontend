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
  BrainCircuit, 
  Trophy, 
  Search, 
  Zap, 
  Database,
  ShieldCheck,
  Cpu
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';

interface KnowledgeGuideProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function KnowledgeGuide({ open, onOpenChange }: KnowledgeGuideProps) {
  const steps = [
    {
      title: "Busca Inteligente",
      icon: Search,
      color: "text-blue-600 dark:text-blue-400",
      bg: "bg-blue-50 dark:bg-blue-950/30",
      description: "Encontre informações de forma simples e direta pelo significado. O sistema compreende o contexto da sua pergunta e vasculha toda a base de conhecimento."
    },
    {
      title: "Gestão de Ativos",
      icon: Database,
      color: "text-indigo-600 dark:text-indigo-400",
      bg: "bg-indigo-50 dark:bg-indigo-950/30",
      description: "Centralize manuais, documentos de processos e rotinas da squad. Transforme arquivos estáticos em uma base de consulta viva e interativa."
    },
    {
      title: "Assistente de Contexto",
      icon: Cpu,
      color: "text-emerald-600 dark:text-emerald-400",
      bg: "bg-emerald-50 dark:bg-emerald-950/30",
      description: "Use o assistente de texto para resumir documentos longos ou extrair pontos-chave. Ganhe tempo na integração de novos membros (onboarding) com respostas rápidas."
    }
  ];

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-xl overflow-hidden flex flex-col p-0 border-none shadow-3xl bg-[#fafafa] dark:bg-slate-950">
        {/* HEADER ELITE */}
        <SheetHeader className="shrink-0 p-8 bg-slate-900 dark:bg-slate-950 text-white relative overflow-hidden">
          <div className="absolute top-0 right-0 p-8 opacity-10 rotate-12">
             <BrainCircuit className="h-32 w-32" />
          </div>
          <div className="relative z-10">
            <div className="flex items-center gap-3 mb-4">
               <Badge variant="outline" className="border-blue-500/50 text-blue-400 bg-blue-500/10 uppercase text-[9px] font-black tracking-widest px-3 py-1">
                  Base de Conhecimento
               </Badge>
            </div>
            <SheetTitle className="text-3xl font-black uppercase tracking-tighter italic text-white flex items-center gap-3">
               <BrainCircuit className="h-6 w-6 text-blue-400" />
               Guia da Base de Conhecimento
            </SheetTitle>
            <SheetDescription className="text-slate-400 dark:text-slate-500 font-medium text-xs mt-2">
               Sua base de conhecimento coletiva e colaborativa.
            </SheetDescription>
          </div>
        </SheetHeader>

        <ScrollArea className="flex-1">
          <div className="p-8 space-y-10">
            <div className="space-y-6">
               <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400 dark:text-slate-500 border-b border-slate-100 dark:border-slate-800 pb-2">Funcionalidades</h3>
               <div className="grid grid-cols-1 gap-4">
                  {steps.map((step, idx) => (
                    <div key={idx} className="flex gap-5 p-5 bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm hover:shadow-xl hover:shadow-blue-500/5 transition-all group">
                       <div className={`w-12 h-12 ${step.bg} rounded-xl flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform`}>
                          <step.icon className={`h-6 w-6 ${step.color}`} />
                       </div>
                       <div className="space-y-1">
                          <p className="text-xs font-black uppercase tracking-tight text-slate-900 dark:text-slate-100">{step.title}</p>
                          <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed font-medium">{step.description}</p>
                       </div>
                    </div>
                  ))}
               </div>
            </div>

            <div className="space-y-6">
               <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400 dark:text-slate-500 border-b border-slate-100 dark:border-slate-800 pb-2">Como Começar</h3>
               <div className="grid grid-cols-1 gap-3">
                  {[
                    { l: "Indexação", d: "Adicione seus arquivos (PDF, TXT, DOCX). O sistema processará o conteúdo para torná-lo 'pesquisável' pelo assistente." },
                    { l: "Chat de Contexto", d: "Faça perguntas em linguagem natural. O assistente responderá com base exclusivamente nos seus documentos." },
                    { l: "Sua Chave", d: "Certifique-se de configurar sua chave de acesso para habilitar os recursos avançados de busca." }
                  ].map((item, i) => (
                    <div key={i} className="p-4 bg-slate-50 dark:bg-slate-900/50 rounded-2xl border border-slate-100 dark:border-slate-800 space-y-1">
                       <p className="text-[10px] font-black uppercase text-slate-900 dark:text-slate-100">{item.l}</p>
                       <p className="text-[10px] text-slate-500 dark:text-slate-400 font-medium leading-relaxed">{item.d}</p>
                    </div>
                  ))}
               </div>
            </div>

            {/* ALERT BOX */}
            <div className="p-6 bg-blue-600 rounded-[2rem] text-white shadow-xl shadow-blue-500/20 flex gap-4 items-center">
               <div className="w-12 h-12 bg-white/10 rounded-xl flex items-center justify-center shrink-0">
                  <ShieldCheck className="h-6 w-6 text-blue-200" />
               </div>
               <div className="space-y-1">
                  <p className="text-[10px] font-black uppercase tracking-widest text-blue-200">Privacidade Total</p>
                  <p className="text-[10px] font-medium leading-relaxed opacity-90 italic">
                     "Seus dados são processados de forma isolada. A Espaço Ágil não utiliza seu conhecimento para treinar modelos globais."
                  </p>
               </div>
            </div>

            <div className="pt-4 pb-12">
               <Button 
                 variant="outline" 
                 className="w-full h-14 rounded-2xl border-2 border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100 font-black uppercase text-[10px] tracking-widest hover:bg-slate-50 dark:hover:bg-slate-900 transition-all gap-3"
                 asChild
               >
                 <a href="/manual#knowledge">
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
