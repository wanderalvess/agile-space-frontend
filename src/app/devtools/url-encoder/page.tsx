'use client';

import React, { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { 
  Link as LinkIcon,
  ArrowLeft, 
  Copy, 
  RotateCcw,
  ArrowRightLeft,
  Search,
  Globe,
  Settings
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';
import Link from 'next/link';
import { cn } from '@/lib/utils';

export default function UrlEncoderPage() {
  const { toast } = useToast();
  const [input, setInput] = useState('');
  const [output, setOutput] = useState('');

  const handleEncode = () => {
    if (!input) return;
    try {
      setOutput(encodeURIComponent(input));
      toast({ title: "URL Codificada com sucesso!" });
    } catch (e) {
      toast({ title: "Erro na codificação", variant: "destructive" });
    }
  };

  const handleDecode = () => {
    if (!input) return;
    try {
      setOutput(decodeURIComponent(input));
      toast({ title: "URL Decodificada com sucesso!" });
    } catch (e) {
      toast({ title: "Erro na decodificação", variant: "destructive" });
    }
  };

  const handleCopy = () => {
    if (!output) return;
    navigator.clipboard.writeText(output);
    toast({ title: "Copiado para a área de transferência!" });
  };

  return (
    <div className="flex flex-col h-screen bg-background font-sans overflow-hidden">
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
              URL <span className="text-orange-600">Encoder</span>
            </h1>
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-[0.2em]">Tratamento de Percent-Encoding para Requisições</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Badge variant="outline" className="h-6 px-3 text-[9px] font-black uppercase tracking-widest border-orange-200 text-orange-600 bg-orange-50">
            Utilidades
          </Badge>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => { setInput(''); setOutput(''); }}
            className="h-9 px-4 rounded-xl text-[9px] font-black uppercase tracking-widest gap-2 bg-white shadow-sm border-slate-200"
          >
            <RotateCcw className="h-3 w-3" /> Limpar
          </Button>
        </div>
      </header>

      <main className="flex-1 flex overflow-hidden">
        {/* Editor Section */}
        <section className="flex-1 flex flex-col border-r bg-slate-50/10 p-8 gap-6 overflow-hidden">
           <div className="flex items-center justify-between">
              <h2 className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-400 flex items-center gap-2">
                <Globe className="h-4 w-4" /> Input String
              </h2>
           </div>
           
           <Card className="flex-1 border-slate-100 shadow-xl shadow-slate-200/50 rounded-[2.5rem] overflow-hidden bg-white p-6">
              <Textarea 
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Insira o texto ou URL para converter..."
                className="w-full h-full resize-none border-none font-mono text-[13px] leading-relaxed focus-visible:ring-0 placeholder:italic text-slate-700"
              />
           </Card>

           <div className="grid grid-cols-2 gap-4">
              <Button 
                onClick={handleEncode}
                disabled={!input}
                className="h-12 rounded-2xl bg-slate-900 hover:bg-black text-white font-black uppercase tracking-[0.2em] text-[10px] shadow-lg transition-all active:scale-95"
              >
                Encode URL
              </Button>
              <Button 
                onClick={handleDecode}
                disabled={!input}
                variant="outline"
                className="h-12 rounded-2xl border-slate-200 bg-white text-slate-900 font-black uppercase tracking-[0.2em] text-[10px] shadow-sm transition-all active:scale-95"
              >
                Decode URL
              </Button>
           </div>
        </section>

        {/* Output Section */}
        <section className="flex-1 flex flex-col bg-white p-8 gap-6 overflow-hidden">
           <div className="flex items-center justify-between">
              <h2 className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-400 flex items-center gap-2">
                <ArrowRightLeft className="h-4 w-4" /> Processed Result
              </h2>
              {output && (
                <Button variant="ghost" size="sm" onClick={handleCopy} className="h-8 rounded-xl text-[9px] font-black uppercase tracking-widest text-orange-600 hover:bg-orange-50 px-3">
                  <Copy className="h-3 w-3 mr-2" /> Copiar Resultado
                </Button>
              )}
           </div>
           
           <Card className="flex-1 border-dashed border-2 border-slate-100 shadow-inner rounded-[2.5rem] overflow-hidden bg-slate-50/30 p-8 relative">
              {!output ? (
                 <div className="h-full flex flex-col items-center justify-center gap-4 opacity-20 select-none">
                    <LinkIcon className="h-12 w-12 text-slate-300" />
                    <span className="text-[10px] font-black uppercase tracking-widest">Aguardando conversão</span>
                 </div>
              ) : (
                <pre className="w-full h-full overflow-auto font-mono text-[13px] leading-relaxed text-orange-900 break-all animate-in zoom-in duration-300 whitespace-pre-wrap">
                  {output}
                </pre>
              )}
           </Card>

           <div className="p-6 bg-slate-50 border border-slate-100 rounded-[2rem] space-y-3">
              <div className="flex items-center gap-2 text-slate-500">
                 <Settings className="h-3.5 w-3.5" />
                 <span className="text-[9px] font-black uppercase tracking-widest">Dica Técnica</span>
              </div>
              <p className="text-[10px] text-slate-400 font-bold leading-relaxed uppercase tracking-tight">
                Utiliza encodeURIComponent para garantir que todos os caracteres especiais (como ?, &, #, /) sejam devidamente tratados para protocolos HTTP.
              </p>
           </div>
        </section>
      </main>
    </div>
  );
}
