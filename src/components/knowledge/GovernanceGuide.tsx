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
      color: "text-emerald-600",
      bg: "bg-emerald-50",
      description: "Detalhes sobre a hospedagem, redundância de dados e disponibilidade do sistema."
    },
    {
      title: "Segurança de Dados",
      icon: Lock,
      color: "text-indigo-600",
      bg: "bg-indigo-50",
      description: "Como protegemos os dados da sua squad com criptografia em repouso e em trânsito (TLS 1.3)."
    },
    {
      title: "Conformidade LGPD",
      icon: FileCheck,
      color: "text-cyan-600",
      bg: "bg-cyan-50",
      description: "Nossa política de privacidade e os controles de retenção de dados alinhados à legislação brasileira."
    },
    {
      title: "Privacidade de Dados do Motor",
      icon: ShieldAlert,
      color: "text-amber-600",
      bg: "bg-amber-50",
      description: "Explicação sobre o uso de dados para processamento: Seus dados técnicos NUNCA são compartilhados ou utilizados para treinamento de modelos públicos."
    }
  ];

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-xl overflow-hidden flex flex-col p-0 border-none shadow-3xl bg-[#fafafa]">
        {/* HEADER ELITE */}
        <SheetHeader className="shrink-0 p-8 bg-slate-900 text-white relative overflow-hidden">
          <div className="absolute top-0 right-0 p-8 opacity-10 rotate-12">
             <ShieldCheck className="h-32 w-32" />
          </div>
          <div className="relative z-10">
            <div className="flex items-center gap-3 mb-4">
               <Badge variant="outline" className="border-emerald-500/50 text-emerald-400 bg-emerald-500/10 uppercase text-[9px] font-black tracking-widest px-3 py-1">
                  Compliance & Security
               </Badge>
            </div>
            <SheetTitle className="text-3xl font-black uppercase tracking-tighter italic text-white flex items-center gap-3">
               <ShieldCheck className="h-6 w-6 text-emerald-400" />
               Guia de Governança
            </SheetTitle>
            <SheetDescription className="text-slate-400 font-medium text-xs mt-2">
               Protocolos de segurança e conformidade para uso corporativo.
            </SheetDescription>
          </div>
        </SheetHeader>

        <ScrollArea className="flex-1">
          <div className="p-8 space-y-10">
            <div className="space-y-6">
               <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400 border-b border-slate-100 pb-2">Pilares de Confiança</h3>
               <div className="grid grid-cols-1 gap-4">
                  {pillars.map((pillar, idx) => (
                    <div key={idx} className="flex gap-5 p-5 bg-white rounded-2xl border border-slate-100 shadow-sm hover:shadow-xl hover:shadow-emerald-500/5 transition-all group">
                       <div className={`w-12 h-12 ${pillar.bg} rounded-xl flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform`}>
                          <pillar.icon className={`h-6 w-6 ${pillar.color}`} />
                       </div>
                       <div className="space-y-1">
                          <p className="text-xs font-black uppercase tracking-tight text-slate-900">{pillar.title}</p>
                          <p className="text-[11px] text-slate-500 leading-relaxed font-medium">{pillar.description}</p>
                       </div>
                    </div>
                  ))}
               </div>
            </div>

            <div className="space-y-6">
               <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400 border-b border-slate-100 pb-2">Status do Sistema</h3>
               <div className="grid grid-cols-1 gap-2">
                  {[
                    { l: "Uptime (Google Cloud)", v: "99.99%" },
                    { l: "Criptografia", v: "AES-256" },
                    { l: "Região de Dados", v: "us-central1" }
                  ].map((item, i) => (
                    <div key={i} className="flex items-center justify-between p-4 bg-slate-100/50 rounded-xl">
                       <span className="text-[10px] font-black uppercase text-slate-500">{item.l}</span>
                       <Badge variant="outline" className="border-slate-300 text-[9px] font-black uppercase">{item.v}</Badge>
                    </div>
                  ))}
               </div>
            </div>

            <div className="pt-4 pb-12">
               <Button 
                 variant="outline" 
                 className="w-full h-14 rounded-2xl border-2 border-slate-200 text-slate-900 font-black uppercase text-[10px] tracking-widest hover:bg-slate-50 transition-all gap-3"
                 asChild
               >
                 <a href="/manual#governance">
                   <Zap className="h-4 w-4 text-emerald-600" /> Consultar Manual Técnico
                 </a>
               </Button>
            </div>
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}
