"use client";

import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { 
  Sparkles, 
  Search, 
  BookOpen, 
  Bot, 
  Database, 
  ShieldCheck, 
  Zap,
  Cpu,
  Globe,
  PlusCircle,
  Key,
  Command
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';

interface KnowledgeHowToUseProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function KnowledgeHowToUse({ open, onOpenChange }: KnowledgeHowToUseProps) {
  const steps = [
    {
      title: "Wiki Hub: Navegação Técnica",
      icon: BookOpen,
      color: "text-cyan-600 dark:text-cyan-400",
      bg: "bg-cyan-50 dark:bg-cyan-950/30",
      description: "Acesse o repositório estruturado de conhecimentos da squad. Os documentos são organizados por categorias e tags para facilitar a localização de padrões de arquitetura e guias ágeis."
    },
    {
      title: "Assistente com Consulta Contextualizada",
      icon: Bot,
      color: "text-indigo-600 dark:text-indigo-400",
      bg: "bg-indigo-50 dark:bg-indigo-950/30",
      description: "Converse com a documentação usando o assistente integrado. O motor de busca contextualizada recupera as informações mais relevantes da base de conhecimento antes de responder."
    },
    {
      title: "Busca Semântica Global",
      icon: Search,
      color: "text-emerald-600 dark:text-emerald-400",
      bg: "bg-emerald-50 dark:bg-emerald-950/30",
      description: "Pressione CTRL+K em qualquer lugar do módulo para abrir a busca global. Ela indexa títulos, conteúdos e metadados para uma recuperação instantânea."
    },
    {
      title: "Modelo BYOK (API Key)",
      icon: Key,
      color: "text-amber-600 dark:text-amber-400",
      bg: "bg-amber-50 dark:bg-amber-950/30",
      description: "Sua privacidade é prioridade. Configure sua própria chave do Google Gemini nas configurações para habilitar o assistente com custo zero para a plataforma."
    }
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl p-0 overflow-hidden border-none bg-[#fafafa] dark:bg-slate-950 rounded-[2.5rem] shadow-3xl">
        <div className="flex flex-col h-[80vh]">
          {/* HEADER PREMIUM */}
          <div className="p-10 bg-slate-900 dark:bg-slate-950 text-white relative overflow-hidden shrink-0">
            <div className="absolute top-0 right-0 p-10 opacity-10 rotate-12">
               <Sparkles className="h-48 w-48" />
            </div>
            
            <div className="relative z-10">
              <div className="flex items-center gap-3 mb-4">
                 <Badge variant="outline" className="border-cyan-500/50 text-cyan-400 bg-cyan-500/10 uppercase text-[10px] font-black tracking-widest px-3 py-1">
                    Guia Tático
                 </Badge>
                 <span className="text-slate-400 dark:text-slate-500 text-[10px] font-bold uppercase tracking-widest">Base de Conhecimento v3.8.0</span>
              </div>
              <h2 className="text-4xl md:text-5xl font-black uppercase tracking-tighter italic font-headline leading-none">
                Como operar a <br />
                <span className="text-cyan-500 not-italic">Base de Conhecimento</span>
              </h2>
            </div>
          </div>

          {/* CONTENT AREA */}
          <ScrollArea className="flex-1 p-10">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-12">
               {steps.map((step, idx) => (
                 <div key={idx} className="group p-8 bg-white dark:bg-slate-900 rounded-[2rem] border border-slate-100 dark:border-slate-800 shadow-sm hover:shadow-xl hover:shadow-cyan-500/5 transition-all duration-500">
                    <div className={`w-14 h-14 ${step.bg} rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform`}>
                       <step.icon className={`h-7 w-7 ${step.color}`} />
                    </div>
                    <h3 className="text-lg font-black uppercase tracking-tight text-slate-900 dark:text-slate-100 mb-3">{step.title}</h3>
                    <p className="text-sm text-slate-500 dark:text-slate-400 font-medium leading-relaxed">
                       {step.description}
                    </p>
                 </div>
               ))}
            </div>

            <div className="space-y-8">
               <div className="flex items-center gap-4">
                  <div className="h-px bg-slate-200 dark:bg-slate-800 flex-1" />
                  <span className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400 dark:text-slate-500">Atalhos de Alta Performance</span>
                  <div className="h-px bg-slate-200 dark:bg-slate-800 flex-1" />
               </div>

               <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="flex items-center justify-between p-5 bg-slate-100/50 dark:bg-slate-900/40 border border-slate-200 dark:border-slate-850 rounded-2xl">
                     <span className="text-[10px] font-black uppercase text-slate-500 dark:text-slate-400">Busca Rápida</span>
                     <div className="flex gap-1">
                        <kbd className="px-2 py-1 bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded text-[10px] font-black text-slate-900 dark:text-slate-100 shadow-sm">CTRL</kbd>
                        <kbd className="px-2 py-1 bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded text-[10px] font-black text-slate-900 dark:text-slate-100 shadow-sm">K</kbd>
                     </div>
                  </div>
                  <div className="flex items-center justify-between p-5 bg-slate-100/50 dark:bg-slate-900/40 border border-slate-200 dark:border-slate-850 rounded-2xl">
                     <span className="text-[10px] font-black uppercase text-slate-500 dark:text-slate-400">Novo Chat</span>
                     <Badge variant="outline" className="border-slate-350 dark:border-slate-850 text-slate-900 dark:text-slate-200 bg-white dark:bg-slate-950 text-[10px] font-black">TAB + N</Badge>
                  </div>
                  <div className="flex items-center justify-between p-5 bg-slate-100/50 dark:bg-slate-900/40 border border-slate-200 dark:border-slate-850 rounded-2xl">
                     <span className="text-[10px] font-black uppercase text-slate-500 dark:text-slate-400">Voltar ao Hub</span>
                     <Badge variant="outline" className="border-slate-350 dark:border-slate-850 text-slate-900 dark:text-slate-200 bg-white dark:bg-slate-950 text-[10px] font-black">ESC</Badge>
                  </div>
               </div>

               {/* ALERT BOX */}
               <div className="p-8 bg-cyan-600 rounded-[2.5rem] text-white shadow-2xl shadow-cyan-500/30 flex gap-6 items-center">
                  <div className="w-16 h-16 bg-white/10 rounded-2xl flex items-center justify-center shrink-0">
                     <ShieldCheck className="h-8 w-8 text-cyan-200" />
                  </div>
                  <div className="space-y-1">
                     <p className="text-[11px] font-black uppercase tracking-widest text-cyan-200">Privacidade Radical</p>
                     <p className="text-sm font-medium leading-relaxed opacity-90">
                        O Espaço Ágil processa todas as interações no cliente (Client-side) quando possível e utiliza Security Rules para garantir que apenas sua squad tenha acesso aos seus ativos técnicos.
                     </p>
                  </div>
               </div>
            </div>
          </ScrollArea>

          {/* FOOTER ACTION */}
          <div className="p-8 border-t border-slate-100 dark:border-slate-850 bg-white dark:bg-slate-950 flex justify-end shrink-0">
             <button 
                onClick={() => onOpenChange(false)}
                className="h-14 px-10 bg-slate-900 dark:bg-slate-100 hover:bg-black dark:hover:bg-slate-200 text-white dark:text-slate-900 text-[11px] font-black uppercase tracking-widest rounded-2xl shadow-xl transition-all active:scale-95"
             >
                Entendi, vamos começar
             </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
