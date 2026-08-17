'use client';

import React, { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { 
  Database,
  ArrowLeft, 
  Copy, 
  Check,
  RotateCcw,
  AlignLeft,
  Layout
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';
import Link from 'next/link';
import { cn } from '@/lib/utils';

export default function SqlFormatterPage() {
  const { toast } = useToast();
  const [sql, setSql] = useState('');
  const [formattedSql, setFormattedSql] = useState('');
  const [isCopied, setIsCopied] = useState(false);

  const handleFormat = () => {
    if (!sql) return;
    
    // Formatação básica via regex para evitar dependências pesadas no momento
    let formatted = sql
      .replace(/\s+/g, ' ')
      .replace(/\b(SELECT|FROM|WHERE|LEFT JOIN|RIGHT JOIN|INNER JOIN|JOIN|GROUP BY|ORDER BY|HAVING|LIMIT|INSERT INTO|UPDATE|DELETE|SET|VALUES|AND|OR|ON)\b/gi, '\n$1')
      .replace(/,/g, ',\n    ')
      .trim();
      
    setFormattedSql(formatted);
    toast({ title: "SQL Formatado!" });
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(formattedSql || sql);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
    toast({ title: "Copiado para a área de transferência!" });
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
              SQL <span className="text-blue-600">Formatter</span>
            </h1>
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-[0.2em]">Beautifier Técnico de Queries</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Badge variant="outline" className="h-6 px-3 text-[9px] font-black uppercase tracking-widest border-blue-200 text-blue-600 bg-blue-50">
            Dados
          </Badge>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => { setSql(''); setFormattedSql(''); }}
            className="h-9 px-4 rounded-xl text-[9px] font-black uppercase tracking-widest gap-2 bg-white shadow-sm border-slate-200"
          >
            <RotateCcw className="h-3 w-3" /> Limpar
          </Button>
        </div>
      </header>

      <main className="flex-1 flex overflow-hidden">
        {/* Editor Section */}
        <section className="flex-1 flex flex-col border-r bg-white p-6 gap-4 overflow-hidden">
           <div className="flex items-center justify-between px-2">
              <h2 className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-400 flex items-center gap-2">
                <AlignLeft className="h-4 w-4" /> Raw Query
              </h2>
           </div>
           <Card className="flex-1 border-slate-100 shadow-inner rounded-[2rem] overflow-hidden bg-slate-50/50 p-6">
              <Textarea 
                value={sql}
                onChange={(e) => setSql(e.target.value)}
                placeholder="Insira sua query SQL bagunçada aqui..."
                className="w-full h-full resize-none border-none bg-transparent font-mono text-[13px] leading-relaxed focus-visible:ring-0 placeholder:italic text-slate-700"
              />
           </Card>
           <Button 
             onClick={handleFormat}
             disabled={!sql}
             className="h-12 rounded-2xl bg-slate-900 hover:bg-black text-white font-black uppercase tracking-[0.2em] text-[10px] shadow-xl"
           >
             Formatar SQL
           </Button>
        </section>

        {/* Output Section */}
        <section className="flex-1 flex flex-col bg-slate-100/30 p-6 gap-4 overflow-hidden">
           <div className="flex items-center justify-between px-2">
              <h2 className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-400 flex items-center gap-2">
                <Layout className="h-4 w-4" /> Formatted Result
              </h2>
              {formattedSql && (
                <Button variant="ghost" size="sm" onClick={handleCopy} className="h-8 rounded-xl text-[9px] font-black uppercase tracking-widest text-slate-500 hover:bg-white animate-in fade-in zoom-in">
                  {isCopied ? <Check className="h-3 w-3 mr-2 text-emerald-500" /> : <Copy className="h-3 w-3 mr-2" />}
                  {isCopied ? 'Copiado' : 'Copiar Resultado'}
                </Button>
              )}
           </div>
           
           <Card className="flex-1 border-slate-100 shadow-xl rounded-[2rem] overflow-hidden bg-white p-8 relative group">
              {!formattedSql ? (
                 <div className="h-full flex flex-col items-center justify-center gap-4 opacity-20 select-none">
                    <Database className="h-12 w-12 text-slate-300" />
                    <span className="text-[10px] font-black uppercase tracking-widest">Resultado aparecerá aqui</span>
                 </div>
              ) : (
                <pre className="w-full h-full overflow-auto font-mono text-[13px] leading-relaxed text-blue-900 animate-in fade-in slide-in-from-right-4 duration-500 selection:bg-blue-100">
                  {formattedSql}
                </pre>
              )}
           </Card>
        </section>
      </main>
    </div>
  );
}
