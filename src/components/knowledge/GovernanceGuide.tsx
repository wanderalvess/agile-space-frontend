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
  ShieldCheck, 
  Lock, 
  Database, 
  FileCheck, 
  Server, 
  ShieldAlert,
  Zap,
  Globe
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';

interface GovernanceGuideProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function GovernanceGuide({ open, onOpenChange }: GovernanceGuideProps) {
  const pillars = [
    {
      title: "Infraestrutura Técnica",
      icon: Server,
      color: "text-emerald-700 dark:text-emerald-400",
      bg: "bg-emerald-50 dark:bg-emerald-950/40",
      description: "Detalhes sobre a hospedagem, redundância de dados e disponibilidade do sistema."
    },
    {
      title: "Segurança de Dados",
      icon: Lock,
      color: "text-primary [.theme-totvs:not(.dark)_&]:text-foreground",
      bg: "bg-primary/10 dark:bg-primary/15",
      description: "Como protegemos os dados da sua squad com criptografia em repouso e em trânsito (TLS 1.3)."
    },
    {
      title: "Conformidade LGPD",
      icon: FileCheck,
      color: "text-primary [.theme-totvs:not(.dark)_&]:text-foreground",
      bg: "bg-primary/10 dark:bg-primary/15",
      description: "Nossa política de privacidade e os controles de retenção de dados alinhados à legislação brasileira."
    },
    {
      title: "Privacidade de Dados do Motor",
      icon: ShieldAlert,
      color: "text-amber-700 dark:text-amber-400",
      bg: "bg-amber-50 dark:bg-amber-950/40",
      description: "Explicação sobre o uso de dados para processamento: Seus dados técnicos NUNCA são compartilhados ou utilizados para treinamento de modelos públicos."
    }
  ];

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-xl overflow-hidden flex flex-col p-0 border-none shadow-3xl bg-background text-foreground">
        {/* HEADER ELITE */}
        <SheetHeader className="shrink-0 p-8 bg-card text-foreground relative overflow-hidden">
          <div className="absolute top-0 right-0 p-8 opacity-10 rotate-12">
             <ShieldCheck className="h-32 w-32" />
          </div>
          <div className="relative z-10">
            <div className="flex items-center gap-3 mb-4">
               <Badge variant="outline" className="border-emerald-500/50 text-emerald-700 dark:text-emerald-300 bg-emerald-500/10 text-xs font-bold tracking-normal px-3 py-1">
                  Conformidade & Segurança
               </Badge>
            </div>
            <SheetTitle className="text-3xl font-bold tracking-tighter text-foreground flex items-center gap-3">
               <ShieldCheck className="h-6 w-6 text-emerald-700 dark:text-emerald-300" />
               Guia de Governança
            </SheetTitle>
            <SheetDescription className="text-muted-foreground font-medium text-xs mt-2">
               Protocolos de segurança e conformidade para uso corporativo.
            </SheetDescription>
          </div>
        </SheetHeader>

        <ScrollArea className="flex-1">
          <div className="p-8 space-y-10">
            <div className="space-y-6">
               <h3 className="text-xs font-bold tracking-normal text-muted-foreground border-b border-border pb-2">Pilares de Confiança</h3>
               <div className="grid grid-cols-1 gap-4">
                  {pillars.map((pillar, idx) => (
                    <div key={idx} className="flex gap-5 p-5 bg-card dark:bg-muted/60 rounded-2xl border border-border dark:border-border/60 shadow-sm hover:shadow-xl hover:shadow-emerald-500/5 transition-all group">
                       <div className={`w-12 h-12 ${pillar.bg} rounded-xl flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform`}>
                          <pillar.icon className={`h-6 w-6 ${pillar.color}`} />
                       </div>
                       <div className="space-y-1">
                          <p className="text-xs font-bold tracking-tight text-foreground">{pillar.title}</p>
                          <p className="text-xs text-muted-foreground leading-relaxed font-medium">{pillar.description}</p>
                       </div>
                    </div>
                  ))}
               </div>
            </div>

            <div className="space-y-6">
               <h3 className="text-xs font-bold tracking-normal text-muted-foreground border-b border-border pb-2">Status do Sistema</h3>
               <div className="grid grid-cols-1 gap-2">
                  {[
                    { l: "Disponibilidade Operacional", v: "99.99%" },
                    { l: "Criptografia em Repouso", v: "AES-256" },
                    { l: "Região de Dados", v: "Cloud Brasil / US" }
                  ].map((item, i) => (
                    <div key={i} className="flex items-center justify-between p-4 bg-muted/60 rounded-xl">
                       <span className="text-xs font-bold text-muted-foreground">{item.l}</span>
                       <Badge variant="outline" className="border-border text-foreground text-xs font-bold">{item.v}</Badge>
                    </div>
                  ))}
               </div>
            </div>

            <div className="pt-4 pb-12">
               <Button 
                 variant="outline" 
                 className="w-full h-14 rounded-2xl border-2 border-border text-foreground font-bold text-xs tracking-normal hover:bg-muted/40 dark:hover:bg-muted transition-all gap-3"
                 asChild
               >
                 <a href="/manual/governance">
                   <Zap className="h-4 w-4 text-emerald-700 dark:text-emerald-400" /> Consultar Manual Técnico
                 </a>
               </Button>
            </div>
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}
