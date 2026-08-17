'use client';

import React, { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { 
  Fingerprint,
  ArrowLeft, 
  Copy, 
  Check,
  RefreshCw,
  Plus,
  Trash2,
  Hash
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';
import Link from 'next/link';
import { cn } from '@/lib/utils';

export default function UuidGeneratorPage() {
  const { toast } = useToast();
  const [ids, setIds] = useState<string[]>([]);
  const [count, setCount] = useState(5);

  const generateUuid = () => {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
      const r = Math.random() * 16 | 0, v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  };

  const handleGenerate = () => {
    const newIds = Array.from({ length: count }, () => generateUuid());
    setIds(newIds);
    toast({ title: `${count} UUIDs gerados!` });
  };

  const handleCopyAll = () => {
    if (ids.length === 0) return;
    navigator.clipboard.writeText(ids.join('\n'));
    toast({ title: "Todos os IDs copiados!" });
  };

  const handleCopySingle = (id: string) => {
    navigator.clipboard.writeText(id);
    toast({ title: "ID copiado!" });
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
              UUID <span className="text-rose-600">Generator</span>
            </h1>
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-[0.2em]">Gerador de Identificadores Únicos Universais</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Badge variant="outline" className="h-6 px-3 text-[9px] font-black uppercase tracking-widest border-rose-200 text-rose-600 bg-rose-50">
            Gerador
          </Badge>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => setIds([])}
            className="h-9 px-4 rounded-xl text-[9px] font-black uppercase tracking-widest gap-2 bg-white shadow-sm border-slate-200"
          >
            <Trash2 className="h-3.3" /> Limpar
          </Button>
        </div>
      </header>

      <main className="flex-1 flex flex-col p-8 gap-8 overflow-y-auto max-w-5xl mx-auto w-full">
        {/* Controls */}
        <section className="bg-white rounded-[2.5rem] p-8 border border-slate-100 shadow-xl shadow-slate-200/50 flex items-center justify-between gap-8">
           <div className="flex items-center gap-6">
              <div className="flex flex-col gap-1">
                 <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Quantidade</span>
                 <div className="flex items-center gap-3">
                    <button onClick={() => setCount(Math.max(1, count - 1))} className="h-8 w-8 rounded-lg bg-slate-100 flex items-center justify-center text-slate-500 hover:bg-slate-200 transition-all">-</button>
                    <span className="text-xl font-black italic text-slate-800 w-8 text-center">{count}</span>
                    <button onClick={() => setCount(Math.min(50, count + 1))} className="h-8 w-8 rounded-lg bg-slate-100 flex items-center justify-center text-slate-500 hover:bg-slate-200 transition-all">+</button>
                 </div>
              </div>
              <div className="h-10 w-px bg-slate-100" />
              <div className="flex flex-col gap-1">
                 <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Versão</span>
                 <Badge className="bg-slate-900 text-[9px] uppercase tracking-widest px-3 py-1">UUID v4 (Random)</Badge>
              </div>
           </div>

           <div className="flex items-center gap-3">
              {ids.length > 0 && (
                <Button variant="ghost" onClick={handleCopyAll} className="h-12 px-6 rounded-2xl text-[10px] font-black uppercase tracking-widest text-slate-500 hover:bg-slate-50">
                  <Copy className="h-4 w-4 mr-2" /> Copiar Todos
                </Button>
              )}
              <Button onClick={handleGenerate} className="h-12 px-8 rounded-2xl bg-rose-600 hover:bg-rose-700 text-white font-black uppercase tracking-[0.2em] text-[10px] shadow-lg shadow-rose-500/20 gap-2 transition-all active:scale-95">
                <RefreshCw className="h-4 w-4" /> Gerar IDs
              </Button>
           </div>
        </section>

        {/* List Section */}
        <section className="space-y-4">
           {!ids.length ? (
              <div className="py-32 flex flex-col items-center justify-center gap-4 opacity-20 select-none">
                 <Fingerprint className="h-16 w-16 text-slate-300" />
                 <span className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-400">Clique em "Gerar" para começar</span>
              </div>
           ) : (
             <div className="grid grid-cols-1 gap-3 animate-in fade-in slide-in-from-bottom-5 duration-500 pb-20">
                {ids.map((id, index) => (
                  <Card key={index} className="p-5 border-slate-100 hover:border-rose-200 hover:shadow-xl hover:shadow-rose-500/5 bg-white rounded-2xl group transition-all flex items-center justify-between">
                     <div className="flex items-center gap-5">
                        <div className="h-10 w-10 flex items-center justify-center rounded-xl bg-slate-50 text-slate-300 font-mono text-xs font-black group-hover:bg-rose-50 group-hover:text-rose-400 transition-colors">
                           #{index + 1}
                        </div>
                        <code className="text-sm font-mono font-bold text-slate-600 group-hover:text-slate-900 select-all tracking-tight">
                           {id}
                        </code>
                     </div>
                     <Button variant="ghost" size="icon" onClick={() => handleCopySingle(id)} className="rounded-xl h-10 w-10 text-slate-300 hover:text-rose-600 hover:bg-rose-50 opacity-0 group-hover:opacity-100 transition-all">
                        <Copy className="h-4 w-4" />
                     </Button>
                  </Card>
                ))}
             </div>
           )}
        </section>
      </main>
    </div>
  );
}
