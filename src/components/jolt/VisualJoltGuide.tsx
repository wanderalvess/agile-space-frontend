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
  Zap, 
  Cpu,
  Workflow,
  ShieldCheck,
  MousePointer,
  HelpCircle,
  Code
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';

interface VisualJoltGuideProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function VisualJoltGuide({ open, onOpenChange }: VisualJoltGuideProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-xl overflow-hidden flex flex-col p-0 border-none shadow-3xl bg-[#fafafa]">
        {/* HEADER ELITE */}
        <SheetHeader className="shrink-0 p-8 bg-slate-900 text-white relative overflow-hidden">
          <div className="absolute top-0 right-0 p-8 opacity-10 rotate-12">
             <Workflow className="h-32 w-32" />
          </div>
          <div className="relative z-10">
            <div className="flex items-center gap-3 mb-4">
               <Badge variant="outline" className="border-indigo-500/50 text-indigo-400 bg-indigo-500/10 uppercase text-[9px] font-black tracking-widest px-3 py-1">
                  Elite Engineering
               </Badge>
            </div>
            <SheetTitle className="text-3xl font-black uppercase tracking-tighter italic text-white flex items-center gap-3">
               <Workflow className="h-6 w-6 text-indigo-400" />
               Guia do Jolt Visual
            </SheetTitle>
            <SheetDescription className="text-slate-400 font-medium text-xs mt-2">
               Desenhe conexões e gere especificações profissionais visualmente.
            </SheetDescription>
          </div>
        </SheetHeader>

        <ScrollArea className="flex-1">
          <div className="p-8 space-y-8 text-slate-700">
            
            {/* Seção 1: Passo a passo basico */}
            <div className="space-y-4">
              <h3 className="text-xs font-black uppercase tracking-[0.2em] text-slate-400 border-b border-slate-100 pb-2 flex items-center gap-2">
                <MousePointer className="h-4 w-4 text-blue-500" />
                1. Fluxo de Trabalho Básico
              </h3>
              <ol className="list-decimal pl-5 space-y-2 text-xs font-medium text-slate-600 leading-relaxed">
                <li>Insira ou cole o <strong>JSON de Origem (Entrada)</strong> no primeiro editor à esquerda.</li>
                <li>Insira ou cole o <strong>JSON de Destino Mock (Contrato)</strong> no editor abaixo.</li>
                <li>Clique em <strong>"Analisar JSON"</strong> no canto superior direito para desenhar os nós correspondentes na tela.</li>
                <li>Arraste uma conexão a partir do nó azul de origem (Esquerda) até o nó verde correspondente de destino (Direita).</li>
                <li>Para remover qualquer conexão feita por engano, dê <strong>dois cliques rápidos (Double Click)</strong> diretamente na linha azul.</li>
                <li>Após ligar os campos necessários, clique em <strong>"Gerar Jolt Spec"</strong> no canto do canvas para copiar o spec resultante.</li>
              </ol>
            </div>

            {/* Seção 2: Pipeline Cloud Sync */}
            <div className="space-y-4 bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
              <h3 className="text-xs font-black uppercase tracking-[0.2em] text-indigo-600 flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-indigo-500 animate-pulse" />
                2. Gerador Inteligente Cloud Sync
              </h3>
              <p className="text-[11px] text-slate-500 leading-relaxed font-medium">
                Se a origem contiver uma coleção (marcada por <code>items[*]</code>), a ferramenta ativa automaticamente a estrutura de <strong>9 etapas do Smart Hub da TOTVS</strong>:
              </p>
              
              <div className="grid grid-cols-1 gap-3 mt-2">
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 space-y-1">
                  <span className="font-black uppercase text-[8px] text-slate-400 tracking-wider">Metadados & IDs</span>
                  <p className="text-[10px] text-slate-600 font-medium leading-relaxed">
                    Identificadores globais como <code>idExterno</code>, <code>idInterno</code> e <code>tipoIdInterno</code> são inicializados de forma concatenada no primeiro passo e mapeados para as chaves principais ao final.
                  </p>
                </div>
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 space-y-1">
                  <span className="font-black uppercase text-[8px] text-slate-400 tracking-wider">Regra de Proprietário / Filial 99</span>
                  <p className="text-[10px] text-slate-600 font-medium leading-relaxed">
                    Ao ligar <code>codigoFilial</code> a <code>idProprietario</code>, a filial matriz <code>"99"</code> é convertida condicionalmente em <code>"#{"{"}{"{"}MASTER_ID_PROPRIETARIO{"}"}{"}"}"</code>, mantendo as demais filiais inalteradas.
                  </p>
                </div>
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 space-y-1">
                  <span className="font-black uppercase text-[8px] text-slate-400 tracking-wider">Tradutor de Situação</span>
                  <p className="text-[10px] text-slate-600 font-medium leading-relaxed">
                    Ao ligar <code>ativo</code> (ou chaves booleanas similares) a <code>situacao</code>, o sistema traduz <code>true</code> para <code>1</code> e <code>false</code> para <code>0</code>.
                  </p>
                </div>
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 space-y-1">
                  <span className="font-black uppercase text-[8px] text-slate-400 tracking-wider">Cálculo de Tamanhos de Arrays</span>
                  <p className="text-[10px] text-slate-600 font-medium leading-relaxed">
                    Mapear uma lista (como <code>prazos</code>) para <code>numeroMaximoParcelas</code> cria a instrução nativa <code>"=size(@(1, prazos))"</code>.
                  </p>
                </div>
              </div>
            </div>

            {/* Seção 3: Tratamento de Restrições */}
            <div className="space-y-4">
              <h3 className="text-xs font-black uppercase tracking-[0.2em] text-slate-400 border-b border-slate-100 pb-2 flex items-center gap-2">
                <Cpu className="h-4 w-4 text-emerald-500" />
                3. Sub-coleções & Restrições
              </h3>
              <p className="text-xs text-slate-600 leading-relaxed font-medium">
                Caso conecte campos de restrições (como <code>restricoes</code>), o gerador de layouts cria automaticamente múltiplos passos intermediários do pipeline para separar as chaves por siglas (<code>CA</code>, <code>CL</code>, <code>DP</code>, etc.) e formatar as restrições aninhadas como <code>idRetaguardaCategoria</code>, <code>idRetaguardaCliente</code> e <code>idRetaguardaSecao</code>.
              </p>
            </div>

            {/* ALERT BOX */}
            <div className="p-6 bg-indigo-600 rounded-[2rem] text-white shadow-xl shadow-indigo-500/20 flex gap-4 items-center">
               <div className="w-12 h-12 bg-white/10 rounded-xl flex items-center justify-center shrink-0">
                  <ShieldCheck className="h-6 w-6 text-indigo-200" />
               </div>
               <div className="space-y-1">
                  <p className="text-[10px] font-black uppercase tracking-widest text-indigo-200">Integração Validada</p>
                  <p className="text-[10px] font-medium leading-relaxed opacity-90 italic">
                     "As regras geradas geram specs 100% aderentes ao interpretador de rotas e ao padrão TOTVS/Cloud Sync."
                  </p>
               </div>
            </div>

            <div className="pt-4 pb-12">
               <Button 
                 variant="outline" 
                 className="w-full h-14 rounded-2xl border-2 border-slate-200 text-slate-900 font-black uppercase text-[10px] tracking-widest hover:bg-slate-50 transition-all gap-3"
                 asChild
               >
                 <a href="/manual#visual-jolt">
                   <Zap className="h-4 w-4 text-indigo-600" /> Acessar Manual Completo
                 </a>
               </Button>
            </div>
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}
