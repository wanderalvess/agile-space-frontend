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
      title: "Laboratório da Squad",
      icon: Terminal,
      color: "text-indigo-700 dark:text-indigo-300",
      bg: "bg-indigo-500/10",
      description: "Experimente códigos, teste APIs e valide lógicas de negócio em um ambiente isolado e seguro. O Jolt é o laboratório de inovação da squad."
    },
    {
      title: "Prototipagem Rápida",
      icon: Cpu,
      color: "text-blue-700 dark:text-blue-300",
      bg: "bg-blue-500/10",
      description: "Crie provas de conceito (PoC) sem precisar configurar um ambiente local completo. Valide ideias e compartilhe snippets com o time instantaneamente."
    },
    {
      title: "Colaboração Técnica",
      icon: Workflow,
      color: "text-emerald-700 dark:text-emerald-300",
      bg: "bg-emerald-500/10",
      description: "Trabalhe em conjunto em desafios técnicos. O ambiente compartilhado facilita o Pair Programming e o Code Review síncrono."
    }
  ];

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-xl overflow-hidden flex flex-col p-0 border-none shadow-3xl bg-background">
        {/* Cabeçalho */}
        <SheetHeader className="shrink-0 p-8 bg-card text-foreground border-b border-border relative overflow-hidden">
          <div className="absolute top-0 right-0 p-8 opacity-10 rotate-12">
             <Terminal className="h-32 w-32" />
          </div>
          <div className="relative z-10">
            <div className="flex items-center gap-3 mb-4">
               <Badge variant="outline" className="border-primary/40 text-primary bg-primary/10 text-xs font-bold px-3 py-1 [.theme-totvs:not(.dark)_&]:text-foreground">
                  Laboratório da squad
               </Badge>
            </div>
            <SheetTitle className="text-3xl font-bold tracking-tight text-foreground flex items-center gap-3">
               <Terminal className="h-6 w-6 text-primary [.theme-totvs:not(.dark)_&]:text-foreground" />
               Guia do Jolt Sandbox
            </SheetTitle>
            <SheetDescription className="text-muted-foreground font-medium text-xs mt-2">
               Onde o código ganha vida e a inovação acontece.
            </SheetDescription>
          </div>
        </SheetHeader>

        <ScrollArea className="flex-1">
          <div className="p-8 space-y-10">
            <div className="space-y-6">
               <h3 className="text-xs font-bold uppercase tracking-[0.3em] text-muted-foreground border-b border-border pb-2">Ambiente de Testes</h3>
               <div className="grid grid-cols-1 gap-4">
                  {steps.map((step, idx) => (
                    <div key={idx} className="flex gap-5 p-5 bg-card rounded-2xl border border-border shadow-sm transition-all group">
                       <div className={`w-12 h-12 ${step.bg} rounded-xl flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform`}>
                          <step.icon className={`h-6 w-6 ${step.color}`} />
                       </div>
                       <div className="space-y-1">
                          <p className="text-xs font-bold uppercase tracking-tight text-foreground">{step.title}</p>
                          <p className="text-xs text-muted-foreground leading-relaxed font-medium">{step.description}</p>
                       </div>
                    </div>
                  ))}
               </div>
            </div>

            <div className="space-y-6">
               <h3 className="text-xs font-bold uppercase tracking-[0.3em] text-muted-foreground border-b border-border pb-2">Atalhos do Editor</h3>
               <div className="grid grid-cols-1 gap-2">
                  {[
                    { l: "Executar Código", k: "Ctrl + Enter" },
                    { l: "Salvar Snapshot", k: "Ctrl + S" },
                    { l: "Formatar Código", k: "Alt + Shift + F" }
                  ].map((item, i) => (
                    <div key={i} className="flex items-center justify-between p-4 bg-muted/50 rounded-xl">
                       <span className="text-xs font-bold uppercase text-muted-foreground">{item.l}</span>
                       <kbd className="px-2 py-1 bg-card border border-border rounded text-xs font-bold shadow-sm">{item.k}</kbd>
                    </div>
                  ))}
               </div>
            </div>

            {/* ALERT BOX */}
            <div className="p-6 bg-primary/10 border border-primary/30 rounded-2xl text-foreground flex gap-4 items-center">
               <div className="w-12 h-12 bg-foreground/10 rounded-xl flex items-center justify-center shrink-0">
                  <ShieldCheck className="h-6 w-6 text-primary [.theme-totvs:not(.dark)_&]:text-foreground" />
               </div>
               <div className="space-y-1">
                  <p className="text-xs font-bold tracking-wide text-primary [.theme-totvs:not(.dark)_&]:text-foreground">Ambiente seguro</p>
                  <p className="text-xs font-medium leading-relaxed text-muted-foreground">
                     "O Jolt utiliza isolamento total. Seus testes não afetam os dados de produção do Portal Tech V&D."
                  </p>
               </div>
            </div>

            <div className="pt-4 pb-12">
               <Button 
                 variant="outline" 
                 className="w-full h-14 rounded-2xl border-2 border-border text-foreground font-semibold text-xs hover:bg-muted transition-all gap-3"
                 asChild
               >
                 <a href="/manual#jolt">
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
