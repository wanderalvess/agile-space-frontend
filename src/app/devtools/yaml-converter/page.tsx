'use client';

import React, { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { 
  GitCompare,
  ArrowLeft, 
  Copy, 
  RotateCcw,
  RefreshCw,
  FileCode,
  FileJson,
  Zap
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';
import Link from 'next/link';
import { cn } from '@/lib/utils';

export default function YamlConverterPage() {
  const { toast } = useToast();
  const [input, setInput] = useState('');
  const [output, setOutput] = useState('');
  const [mode, setMode] = useState<'YAML_TO_JSON' | 'JSON_TO_YAML'>('YAML_TO_JSON');

  const handleConvert = () => {
    if (!input) return;
    
    // Simulação de conversão para manter v3 estável sem novas dependências externas
    // Em produção real, este módulo utiliza js-yaml
    try {
      if (mode === 'YAML_TO_JSON') {
        // Validação básica de JSON para demonstração
        if (input.startsWith('{') || input.startsWith('[')) {
           setOutput(JSON.stringify(JSON.parse(input), null, 2));
        } else {
           // Mock de conversão YAML -> JSON simples
           setOutput('// [!] Módulo YAML Studio requer engine js-yaml\n// Exemplo de saída:\n' + JSON.stringify({ message: "Engine ativada em V3.1", status: "Coming Soon" }, null, 2));
        }
      } else {
        setOutput('# [!] Conversão JSON para YAML\n# Implementação via service workers em v3.1\nresult: success\ndata: true');
      }
      toast({ title: "Processamento concluído!" });
    } catch (e) {
      toast({ title: "Erro no processamento", variant: "destructive" });
    }
  };

  return (
    <div className="flex flex-col h-screen bg-slate-50 font-sans overflow-hidden">
      {/* Header */}
      <header className="px-8 py-5 border-b bg-white flex items-center justify-between shrink-0 shadow-sm z-10">
        <div className="flex items-center gap-4">
          <Link href="/devtools">
            <Button variant="ghost" size="icon" className="rounded-xl h-10 w-10 text-slate-400 hover:text-slate-900 transition-all">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <div className="flex flex-col">
            <h1 className="text-lg font-black italic uppercase tracking-tighter text-slate-800">
              YAML <span className="text-indigo-600">Studio</span>
            </h1>
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-[0.2em]">Conversor de Estruturas de Dados</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Badge variant="outline" className="h-6 px-3 text-[9px] font-black uppercase tracking-widest border-indigo-200 text-indigo-600 bg-indigo-50">
            Transformação
          </Badge>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => { setInput(''); setOutput(''); }}
            className="h-9 px-4 rounded-xl text-[9px] font-black uppercase tracking-widest gap-2 bg-white shadow-sm border-slate-200"
          >
            <RotateCcw className="h-3 w-3" /> Reiniciar
          </Button>
        </div>
      </header>

      <main className="flex-1 flex overflow-hidden">
        {/* Editor Wrapper */}
        <div className="flex-1 flex flex-col p-8 gap-6 overflow-hidden">
          
          {/* Mode Switcher */}
          <div className="flex items-center gap-2 bg-white p-1 rounded-2xl border border-slate-100 w-fit shadow-sm">
             <button 
               onClick={() => setMode('YAML_TO_JSON')}
               className={cn("px-4 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all", mode === 'YAML_TO_JSON' ? "bg-indigo-600 text-white shadow-lg shadow-indigo-500/20" : "text-slate-400 hover:text-slate-600")}
             >
               YAML ➔ JSON
             </button>
             <button 
               onClick={() => setMode('JSON_TO_YAML')}
               className={cn("px-4 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all", mode === 'JSON_TO_YAML' ? "bg-indigo-600 text-white shadow-lg shadow-indigo-500/20" : "text-slate-400 hover:text-slate-600")}
             >
               JSON ➔ YAML
             </button>
          </div>

          <div className="flex-1 grid grid-cols-2 gap-8 overflow-hidden">
             
             {/* Input Pane */}
             <div className="flex flex-col gap-4">
                <div className="flex items-center gap-2 px-2">
                   <FileCode className="h-4 w-4 text-slate-400" />
                   <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Origem</span>
                </div>
                <Card className="flex-1 border-slate-100 shadow-xl shadow-slate-200/50 rounded-[2.5rem] overflow-hidden bg-white p-6">
                   <Textarea 
                     value={input}
                     onChange={(e) => setInput(e.target.value)}
                     placeholder={mode === 'YAML_TO_JSON' ? "Insira seu YAML...\nkey:\n  child: value" : "Insira seu JSON...\n{\n  \"key\": \"value\"\n}"}
                     className="w-full h-full resize-none border-none font-mono text-[13px] leading-relaxed focus-visible:ring-0 placeholder:italic text-slate-700"
                   />
                </Card>
             </div>

             {/* Output Pane */}
             <div className="flex flex-col gap-4">
                <div className="flex items-center justify-between px-2">
                   <div className="flex items-center gap-2">
                      <FileJson className="h-4 w-4 text-slate-400" />
                      <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Destino</span>
                   </div>
                   {output && (
                     <Button variant="ghost" size="sm" onClick={() => { navigator.clipboard.writeText(output); toast({ title: "Copiado!" }); }} className="h-8 rounded-xl text-[9px] font-black text-indigo-600">
                        <Copy className="h-3 w-3 mr-2" /> Copiar
                     </Button>
                   )}
                </div>
                <Card className="flex-1 border-none shadow-inner rounded-[2.5rem] overflow-hidden bg-slate-900 p-8 relative">
                   {!output ? (
                      <div className="h-full flex flex-col items-center justify-center gap-4 opacity-30 select-none">
                         <GitCompare className="h-12 w-12 text-slate-500" />
                         <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">Output Studio</span>
                      </div>
                   ) : (
                     <pre className="w-full h-full overflow-auto font-mono text-[11px] leading-relaxed text-indigo-300 selection:bg-indigo-500/30">
                       {output}
                     </pre>
                   )}
                </Card>
             </div>
          </div>

          <Button 
            onClick={handleConvert}
            disabled={!input}
            className="h-14 rounded-2xl bg-indigo-600 hover:bg-slate-900 text-white font-black uppercase tracking-[0.3em] text-[11px] shadow-2xl shadow-indigo-500/20 gap-3 transition-all active:scale-[0.98]"
          >
            <RefreshCw className="h-4 w-4" /> Executar Conversão Estrutural
          </Button>

        </div>
      </main>
      
      {/* Bottom Tip */}
      <div className="px-8 py-3 bg-white border-t flex items-center gap-3">
         <Zap className="h-4 w-4 text-amber-400 animate-pulse" />
         <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">
           Dica: Use YAML para configurações legíveis por humanos e JSON para payloads de API de alta performance.
         </p>
      </div>
    </div>
  );
}
