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
      color: "text-primary [.theme-totvs:not(.dark)_&]:text-foreground",
      bg: "bg-primary/10 dark:bg-primary/15",
      description: "Encontre informações de forma simples e direta pelo significado. O sistema compreende o contexto da sua pergunta e vasculha toda a base de conhecimento."
    },
    {
      title: "Gestão de Ativos",
      icon: Database,
      color: "text-primary [.theme-totvs:not(.dark)_&]:text-foreground",
      bg: "bg-primary/10 dark:bg-primary/15",
      description: "Centralize manuais, documentos de processos e rotinas da squad. Transforme arquivos estáticos em uma base de consulta viva e interativa."
    },
    {
      title: "Assistente de Contexto",
      icon: Cpu,
      color: "text-emerald-700 dark:text-emerald-400",
      bg: "bg-emerald-50 dark:bg-emerald-950/30",
      description: "Use o assistente de texto para resumir documentos longos ou extrair pontos-chave. Ganhe tempo na integração de novos membros (onboarding) com respostas rápidas."
    }
  ];

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-xl overflow-hidden flex flex-col p-0 border-none shadow-3xl bg-background">
        {/* HEADER ELITE */}
        <SheetHeader className="shrink-0 p-8 bg-card dark:bg-background text-foreground relative overflow-hidden">
          <div className="absolute top-0 right-0 p-8 opacity-10 rotate-12">
             <BrainCircuit className="h-32 w-32" />
          </div>
          <div className="relative z-10">
            <div className="flex items-center gap-3 mb-4">
               <Badge variant="outline" className="border-primary/50 text-primary [.theme-totvs:not(.dark)_&]:text-foreground bg-primary/10 text-xs font-bold tracking-normal px-3 py-1">
                  Base de Conhecimento
               </Badge>
            </div>
            <SheetTitle className="text-3xl font-bold tracking-tighter text-foreground flex items-center gap-3">
               <BrainCircuit className="h-6 w-6 text-primary [.theme-totvs:not(.dark)_&]:text-foreground" />
               Guia da Base de Conhecimento
            </SheetTitle>
            <SheetDescription className="text-muted-foreground font-medium text-xs mt-2">
               Sua base de conhecimento coletiva e colaborativa.
            </SheetDescription>
          </div>
        </SheetHeader>

        <ScrollArea className="flex-1">
          <div className="p-8 space-y-10">
            <div className="space-y-6">
               <h3 className="text-xs font-bold tracking-normal text-muted-foreground border-b border-border pb-2">Funcionalidades</h3>
               <div className="grid grid-cols-1 gap-4">
                  {steps.map((step, idx) => (
                    <div key={idx} className="flex gap-5 p-5 bg-card rounded-2xl border border-border shadow-sm hover:shadow-xl hover:shadow-primary/5 transition-all group">
                       <div className={`w-12 h-12 ${step.bg} rounded-xl flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform`}>
                          <step.icon className={`h-6 w-6 ${step.color}`} />
                       </div>
                       <div className="space-y-1">
                          <p className="text-xs font-bold tracking-tight text-foreground">{step.title}</p>
                          <p className="text-xs text-muted-foreground leading-relaxed font-medium">{step.description}</p>
                       </div>
                    </div>
                  ))}
               </div>
            </div>

            <div className="space-y-6">
               <h3 className="text-xs font-bold tracking-normal text-muted-foreground border-b border-border pb-2">Como Começar</h3>
               <div className="grid grid-cols-1 gap-3">
                  {[
                    { l: "Indexação", d: "Adicione seus arquivos (PDF, TXT, DOCX). O sistema processará o conteúdo para torná-lo 'pesquisável' pelo assistente." },
                    { l: "Chat de Contexto", d: "Faça perguntas em linguagem natural. O assistente responderá com base exclusivamente nos seus documentos." },
                    { l: "Sua Chave", d: "Certifique-se de configurar sua chave de acesso para habilitar os recursos avançados de busca." }
                  ].map((item, i) => (
                    <div key={i} className="p-4 bg-muted/40 dark:bg-card/50 rounded-2xl border border-border space-y-1">
                       <p className="text-xs font-bold text-foreground">{item.l}</p>
                       <p className="text-xs text-muted-foreground font-medium leading-relaxed">{item.d}</p>
                    </div>
                  ))}
               </div>
            </div>

            {/* ALERT BOX */}
            <div className="p-6 bg-primary rounded-2xl text-primary-foreground shadow-xl shadow-primary/20 flex gap-4 items-center">
               <div className="w-12 h-12 bg-card/10 rounded-xl flex items-center justify-center shrink-0">
                  <ShieldCheck className="h-6 w-6 text-primary [.theme-totvs:not(.dark)_&]:text-foreground" />
               </div>
               <div className="space-y-1">
                  <p className="text-xs font-bold tracking-normal text-primary [.theme-totvs:not(.dark)_&]:text-foreground">Privacidade Total</p>
                  <p className="text-xs font-medium leading-relaxed opacity-90">
                     "Seus dados são processados de forma isolada. A Portal Tech V&D não utiliza seu conhecimento para treinar modelos globais."
                  </p>
               </div>
            </div>

            <div className="pt-4 pb-12">
               <Button 
                 variant="outline" 
                 className="w-full h-14 rounded-2xl border-2 border-border text-foreground font-bold text-xs tracking-normal hover:bg-muted/40 dark:hover:bg-card transition-all gap-3"
                 asChild
               >
                 <a href="/manual#knowledge">
                   <Zap className="h-4 w-4 text-primary [.theme-totvs:not(.dark)_&]:text-foreground" /> Acessar Manual Completo
                 </a>
               </Button>
            </div>
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}
