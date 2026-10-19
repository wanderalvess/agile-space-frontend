"use client";

import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
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
      color: "text-primary [.theme-totvs:not(.dark)_&]:text-foreground",
      bg: "bg-primary/10 dark:bg-primary/15",
      description: "Acesse o repositório estruturado de conhecimentos da squad. Os documentos são organizados por categorias e tags para facilitar a localização de padrões de arquitetura e guias ágeis."
    },
    {
      title: "Assistente com Consulta Contextualizada",
      icon: Bot,
      color: "text-primary [.theme-totvs:not(.dark)_&]:text-foreground",
      bg: "bg-primary/10 dark:bg-primary/15",
      description: "Converse com a documentação usando o assistente integrado. O motor de busca contextualizada recupera as informações mais relevantes da base de conhecimento antes de responder."
    },
    {
      title: "Busca Semântica Global",
      icon: Search,
      color: "text-emerald-700 dark:text-emerald-400",
      bg: "bg-emerald-50 dark:bg-emerald-950/30",
      description: "Pressione CTRL+K em qualquer lugar do módulo para abrir a busca global. Ela indexa títulos, conteúdos e metadados para uma recuperação instantânea."
    },
    {
      title: "Modelo BYOK (API Key)",
      icon: Key,
      color: "text-amber-700 dark:text-amber-400",
      bg: "bg-amber-50 dark:bg-amber-950/30",
      description: "Sua privacidade é prioridade. Configure sua própria chave do Google Gemini nas configurações para habilitar o assistente com custo zero para a plataforma."
    }
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl p-0 overflow-hidden border-none bg-background rounded-2xl shadow-3xl">
        <div className="flex flex-col h-[80vh]">
          {/* HEADER PREMIUM */}
          <div className="p-10 bg-card dark:bg-background text-foreground relative overflow-hidden shrink-0">
            <div className="absolute top-0 right-0 p-10 opacity-10 rotate-12">
               <Sparkles className="h-48 w-48" />
            </div>
            
            <div className="relative z-10">
              <div className="flex items-center gap-3 mb-4">
                 <Badge variant="outline" className="border-primary/50 text-primary [.theme-totvs:not(.dark)_&]:text-foreground bg-primary/10 text-xs font-bold tracking-normal px-3 py-1">
                    Guia Tático
                 </Badge>
                 <span className="text-muted-foreground text-xs font-bold tracking-normal">Base de Conhecimento v3.8.0</span>
              </div>
              <h2 className="text-4xl md:text-5xl font-bold tracking-tighter font-headline leading-none">
                Como operar a <br />
                <span className="text-primary [.theme-totvs:not(.dark)_&]:text-foreground not-italic">Base de Conhecimento</span>
              </h2>
            </div>
          </div>

          {/* CONTENT AREA */}
          <ScrollArea className="flex-1 p-10">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-12">
               {steps.map((step, idx) => (
                 <div key={idx} className="group p-8 bg-card rounded-2xl border border-border shadow-sm hover:shadow-xl hover:shadow-primary/5 transition-all duration-500">
                    <div className={`w-14 h-14 ${step.bg} rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform`}>
                       <step.icon className={`h-7 w-7 ${step.color}`} />
                    </div>
                    <h3 className="text-lg font-bold tracking-tight text-foreground mb-3">{step.title}</h3>
                    <p className="text-sm text-muted-foreground font-medium leading-relaxed">
                       {step.description}
                    </p>
                 </div>
               ))}
            </div>

            <div className="space-y-8">
               <div className="flex items-center gap-4">
                  <div className="h-px bg-muted/60 dark:bg-muted flex-1" />
                  <span className="text-xs font-bold tracking-normal text-muted-foreground">Atalhos de Alta Performance</span>
                  <div className="h-px bg-muted/60 dark:bg-muted flex-1" />
               </div>

               <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="flex items-center justify-between p-5 bg-muted/50 dark:bg-card/40 border border-border rounded-2xl">
                     <span className="text-xs font-bold text-muted-foreground">Busca Rápida</span>
                     <div className="flex gap-1">
                        <kbd className="px-2 py-1 bg-card dark:bg-background border border-border rounded text-xs font-bold text-foreground shadow-sm">CTRL</kbd>
                        <kbd className="px-2 py-1 bg-card dark:bg-background border border-border rounded text-xs font-bold text-foreground shadow-sm">K</kbd>
                     </div>
                  </div>
                  <div className="flex items-center justify-between p-5 bg-muted/50 dark:bg-card/40 border border-border rounded-2xl">
                     <span className="text-xs font-bold text-muted-foreground">Novo Chat</span>
                     <Badge variant="outline" className="border-border text-foreground bg-card dark:bg-background text-xs font-bold">TAB + N</Badge>
                  </div>
                  <div className="flex items-center justify-between p-5 bg-muted/50 dark:bg-card/40 border border-border rounded-2xl">
                     <span className="text-xs font-bold text-muted-foreground">Voltar ao Hub</span>
                     <Badge variant="outline" className="border-border text-foreground bg-card dark:bg-background text-xs font-bold">ESC</Badge>
                  </div>
               </div>

               {/* ALERT BOX */}
               <div className="p-8 bg-primary rounded-2xl text-primary-foreground shadow-2xl shadow-primary/30 flex gap-6 items-center">
                  <div className="w-16 h-16 bg-card/10 rounded-2xl flex items-center justify-center shrink-0">
                     <ShieldCheck className="h-8 w-8 text-primary [.theme-totvs:not(.dark)_&]:text-foreground" />
                  </div>
                  <div className="space-y-1">
                     <p className="text-xs font-bold tracking-normal text-primary [.theme-totvs:not(.dark)_&]:text-foreground">Privacidade Radical</p>
                     <p className="text-sm font-medium leading-relaxed opacity-90">
                        O Portal Tech V&D processa todas as interações no cliente (Client-side) quando possível e utiliza Security Rules para garantir que apenas sua squad tenha acesso aos seus ativos técnicos.
                     </p>
                  </div>
               </div>
            </div>
          </ScrollArea>

          {/* FOOTER ACTION */}
          <div className="p-8 border-t border-border bg-card dark:bg-background flex justify-end shrink-0">
             <Button
                onClick={() => onOpenChange(false)}
                className="h-14 px-10 bg-primary text-primary-foreground hover:bg-primary/90 text-xs font-bold tracking-normal rounded-2xl shadow-xl active:scale-95"
             >
                Entendi, vamos começar
             </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
