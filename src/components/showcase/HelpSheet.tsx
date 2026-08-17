'use client';

import React from 'react';
import { 
  HelpCircle, BrainCircuit, LayoutGrid, Sparkles, Trophy, Info, Eye, Tv, Star, Zap 
} from 'lucide-react';
import { 
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription 
} from '@/components/ui/sheet';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';

interface HelpSheetProps {
  open: boolean;
  onClose: () => void;
}

export function HelpSheet({ open, onClose }: HelpSheetProps) {
  const steps = [
    { title: 'Smart Scan & Automação', desc: 'O sistema lê o título (ex: 10h/8h) e a descrição do Jira para preencher horas e critérios de aceite automaticamente.', icon: BrainCircuit },
    { title: 'Refine as Evidências', desc: 'Ajuste os Critérios de Aceite, preencha Problema/Solução e cole os links do Loom ou Drive.', icon: LayoutGrid },
    { title: 'Apresentação Elite', desc: 'Ative o "Modo Teatro" e use tela cheia (F11) para uma imersão total dos stakeholders.', icon: Sparkles },
    { title: 'Governança & Logs', desc: 'O PO valida no rodapé. Finalize para gerar o relatório em Markdown (.md) para o Jira.', icon: Trophy },
  ];

  return (
    <Sheet open={open} onOpenChange={onClose}>
      <SheetContent className="sm:max-w-xl overflow-hidden flex flex-col p-0 border-l border-white/10">
        <SheetHeader className="shrink-0 p-8 bg-slate-900 text-white relative overflow-hidden">
          <div className="absolute top-0 right-0 p-8 opacity-10 rotate-12">
             <Tv className="h-32 w-32" />
          </div>
          <div className="relative z-10">
            <div className="flex items-center gap-3 mb-4">
               <Badge variant="outline" className="border-violet-500/50 text-violet-400 bg-violet-500/10 uppercase text-[9px] font-black tracking-widest px-3 py-1">
                  Sprint Review
               </Badge>
            </div>
            <SheetTitle className="text-3xl font-black uppercase tracking-tighter italic text-white flex items-center gap-3">
               <HelpCircle className="h-6 w-6 text-violet-400" />
               Guia do Sprint Showcase
            </SheetTitle>
            <SheetDescription className="text-slate-400 font-medium text-xs mt-2">
               Transforme sua Sprint Review em um evento focado e profissional com "Zero Slides".
            </SheetDescription>
          </div>
        </SheetHeader>

        <ScrollArea className="flex-1">
          <div className="p-8 space-y-10">
            <div className="space-y-4">
              <h3 className="font-black text-xs uppercase tracking-[0.2em] text-violet-600 flex items-center gap-2">
                <BrainCircuit className="h-4 w-4" /> 1. O Conceito Zero Slides
              </h3>
              <p className="text-[11px] text-slate-500 leading-relaxed font-medium">
                Elimine horas de preparação. Seus "slides" são os próprios cards das tarefas. Foque na <strong>demonstração real</strong> e na captura imediata de feedbacks do PO.
              </p>
            </div>

            <Separator className="bg-slate-100" />

            <div className="space-y-6">
              <h3 className="font-black text-xs uppercase tracking-[0.2em] text-violet-600 flex items-center gap-2">
                <LayoutGrid className="h-4 w-4" /> 2. Fluxo de Execução
              </h3>
              <div className="grid gap-3">
                {steps.map((step, idx) => (
                  <div key={idx} className="flex gap-4 p-4 bg-slate-50/50 rounded-2xl border border-slate-100/50 transition-all hover:border-violet-100 hover:bg-violet-50/10">
                    <div className="p-2.5 bg-white rounded-xl h-fit shrink-0 shadow-sm border border-slate-100">
                      <step.icon className="h-4 w-4 text-violet-600" />
                    </div>
                    <div>
                      <p className="text-[11px] font-black uppercase tracking-tight leading-none mb-1.5 text-slate-800">{step.title}</p>
                      <p className="text-[10px] text-slate-500 leading-relaxed font-medium">{step.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <Separator className="bg-slate-100" />

            <div className="space-y-4">
              <h3 className="font-black text-xs uppercase tracking-[0.2em] text-violet-600 flex items-center gap-2">
                <Sparkles className="h-4 w-4" /> 3. Dicas de Mestre (Atalhos)
              </h3>
              <div className="p-5 bg-violet-600 rounded-[2rem] text-white shadow-xl shadow-violet-600/20 space-y-4">
                <div className="flex gap-3">
                  <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center shrink-0">
                    <Info className="h-4 w-4" />
                  </div>
                  <p className="text-[10px] font-bold leading-relaxed">
                    No Modo Teatro, use as <strong>Setas (← →)</strong> para navegar entre tarefas. Isso mantém o ritmo da apresentação e impressiona os stakeholders.
                  </p>
                </div>
                <div className="flex gap-3">
                  <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center shrink-0">
                    <Eye className="h-4 w-4" />
                  </div>
                  <p className="text-[10px] font-bold leading-relaxed">
                    Pressione <strong>F11</strong> ou o botão de tela cheia para esconder elementos do sistema e focar 100% na evidência técnica.
                  </p>
                </div>
              </div>
            </div>

            <div className="p-6 bg-violet-600 rounded-[2rem] text-white shadow-xl shadow-violet-500/20 flex gap-4 items-center">
               <div className="w-12 h-12 bg-white/10 rounded-xl flex items-center justify-center shrink-0">
                  <Star className="h-6 w-6 text-violet-200" />
               </div>
               <div className="space-y-1">
                  <p className="text-[10px] font-black uppercase tracking-widest text-violet-200">Dica de Impacto</p>
                  <p className="text-[10px] font-medium leading-relaxed opacity-90 italic">
                     "Comece pelo 'Porquê'. Explicar o motivo da entrega cria muito mais engajamento do que apenas mostrar 'O Quê' foi feito."
                  </p>
               </div>
            </div>

            <div className="pt-4 pb-12">
               <Button 
                 variant="outline" 
                 className="w-full h-14 rounded-2xl border-2 border-slate-200 text-slate-900 font-black uppercase text-[10px] tracking-widest hover:bg-slate-50 transition-all gap-3"
                 asChild
               >
                 <a href="/manual#showcase">
                   <Zap className="h-4 w-4 text-violet-600" /> Acessar Manual Completo
                 </a>
               </Button>
            </div>
          </div>
        </ScrollArea>
        
        <div className="p-8 border-t bg-slate-50 shrink-0">
           <Button onClick={onClose} className="w-full h-12 bg-slate-900 text-white font-black uppercase tracking-widest text-[10px] rounded-xl hover:bg-slate-800 shadow-lg shadow-black/10 transition-all">
             Entendi, vamos começar!
           </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
