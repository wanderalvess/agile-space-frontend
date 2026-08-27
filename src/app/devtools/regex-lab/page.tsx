'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { 
  Regex, 
  Search, 
  CheckCircle2, 
  AlertCircle, 
  ArrowLeft, 
  Copy, 
  List, 
  Code2,
  Settings2,
  Info,
  Flag
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import Link from 'next/link';
import { cn } from '@/lib/utils';

interface RegexMatch {
  index: number;
  content: string;
  groups: (string | undefined)[];
}

export default function RegexLabPage() {
  const { toast } = useToast();
  const [pattern, setPattern] = useState('[a-zA-Z0-9]+');
  const [flags, setFlags] = useState('g');
  const [testString, setTestString] = useState('Exemplo de Regex 123!');
  const [matches, setMatches] = useState<RegexMatch[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    try {
      if (!pattern) {
        setMatches([]);
        setError(null);
        return;
      }

      const regex = new RegExp(pattern, flags);
      const results: RegexMatch[] = [];
      
      if (flags.includes('g')) {
        let match;
        while ((match = regex.exec(testString)) !== null) {
          results.push({
            index: match.index,
            content: match[0],
            groups: match.slice(1)
          });
          // Prevent infinite loop with empty matches
          if (match.index === regex.lastIndex) regex.lastIndex++;
        }
      } else {
        const match = testString.match(regex);
        if (match) {
          results.push({
            index: match.index || 0,
            content: match[0],
            groups: match.slice(1)
          });
        }
      }

      setMatches(results);
      setError(null);
    } catch (e: any) {
      setError(e.message);
      setMatches([]);
    }
  }, [pattern, flags, testString]);

  const handleCopyPattern = () => {
    navigator.clipboard.writeText(`/${pattern}/${flags}`);
    toast({ title: "Expressão copiada!" });
  };

  const highlightMatches = () => {
    if (!testString || matches.length === 0) return testString;

    let result = [];
    let lastIndex = 0;

    // To handle overlapping or out-of-order matches if any, though regex exec is sequential
    matches.forEach((match, i) => {
      // Add plain text before match
      result.push(testString.substring(lastIndex, match.index));
      // Add highlighted match
      result.push(
        <span key={i} className="bg-blue-500/20 text-blue-700 border-b-2 border-blue-500 font-bold px-0.5 rounded-sm">
          {match.content}
        </span>
      );
      lastIndex = match.index + match.content.length;
    });

    // Add remaining text
    result.push(testString.substring(lastIndex));
    return result;
  };

  return (
    <div className="flex flex-col h-screen bg-background font-sans overflow-hidden">
      {/* Header */}
      <header className="px-8 py-5 border-b bg-white/60 backdrop-blur-xl flex items-center justify-between shrink-0 shadow-sm z-10">
        <div className="flex items-center gap-4">
          <Link href="/devtools">
            <Button variant="ghost" size="icon" className="rounded-xl h-10 w-10 text-slate-400 hover:text-slate-900 transition-all">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <div className="flex flex-col">
            <h1 className="text-lg font-black italic uppercase tracking-tighter text-slate-800">
              Regex <span className="text-blue-600">Lab</span>
            </h1>
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-[0.2em]">Depurador de Expressões Regulares</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Badge variant="outline" className="h-6 px-3 text-[9px] font-black uppercase tracking-widest border-blue-200 text-blue-600 bg-blue-50">
            Developer Essential
          </Badge>
          <Button variant="outline" size="sm" onClick={handleCopyPattern} className="h-9 px-4 rounded-xl text-[9px] font-black uppercase tracking-widest gap-2 bg-white shadow-sm hover:bg-slate-50 border-slate-200">
            <Copy className="h-3.5 w-3.5" /> Copiar /Regex/
          </Button>
        </div>
      </header>

      <main className="flex-1 flex overflow-hidden">
        {/* Controls Sidebar */}
        <aside className="w-[380px] border-r bg-white p-6 space-y-8 overflow-y-auto shrink-0">
          <section className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 flex items-center gap-2">
                <Settings2 className="h-3 w-3" /> Expressão
              </h2>
              {error ? (
                <Badge variant="destructive" className="text-[8px] animate-pulse">Inválida</Badge>
              ) : (
                <Badge className="bg-emerald-500 text-[8px]">Válida</Badge>
              )}
            </div>
            
            <div className="space-y-3">
              <div className="relative group">
                <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-blue-500 transition-colors">
                  <span className="font-mono font-bold">/</span>
                </div>
                <Input 
                  value={pattern}
                  onChange={(e) => setPattern(e.target.value)}
                  placeholder="Seu padrão regex..."
                  className={cn(
                    "pl-8 pr-12 font-mono h-14 rounded-2xl border-2 transition-all text-sm",
                    error ? "border-red-100 bg-red-50/30 text-red-600" : "border-slate-100 bg-slate-50 focus:border-blue-500 focus:bg-white"
                  )}
                />
                <div className="absolute right-4 top-1/2 -translate-y-1/2 flex items-center gap-1">
                  <span className="text-slate-300 font-mono font-bold">/</span>
                  <input 
                    value={flags}
                    onChange={(e) => setFlags(e.target.value)}
                    className="w-10 bg-transparent font-mono text-blue-600 font-bold outline-none"
                    title="Flags (g, i, m, s, u, y)"
                  />
                </div>
              </div>

              {error && (
                <div className="p-3 bg-red-50 rounded-xl border border-red-100 flex gap-2 items-start">
                  <AlertCircle className="h-4 w-4 text-red-500 shrink-0 mt-0.5" />
                  <p className="text-[10px] text-red-600 font-bold leading-tight uppercase">{error}</p>
                </div>
              )}
            </div>
          </section>

          <section className="space-y-4">
            <h2 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 flex items-center gap-2">
              <Flag className="h-3 w-3" /> Flags Sugeridas
            </h2>
            <div className="flex flex-wrap gap-2">
              <FlagToggle label="Global (g)" active={flags.includes('g')} onClick={() => setFlags(f => f.includes('g') ? f.replace('g', '') : f + 'g')} />
              <FlagToggle label="Case Insensitive (i)" active={flags.includes('i')} onClick={() => setFlags(f => f.includes('i') ? f.replace('i', '') : f + 'i')} />
              <FlagToggle label="Multiline (m)" active={flags.includes('m')} onClick={() => setFlags(f => f.includes('m') ? f.replace('m', '') : f + 'm')} />
            </div >
          </section>

          <section className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 flex items-center gap-2">
                <List className="h-3 w-3" /> Matches ({matches.length})
              </h2>
            </div>
            <ScrollArea className="h-[300px] border-2 border-slate-50 rounded-[2rem] bg-slate-50/30 p-2">
              <div className="space-y-2">
                {matches.length > 0 ? matches.map((m, i) => (
                  <div key={i} className="p-3 bg-white rounded-xl shadow-sm border border-slate-100 space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Match #{i+1}</span>
                      <span className="text-[8px] font-black text-blue-500 bg-blue-50 px-1.5 py-0.5 rounded">Index: {m.index}</span>
                    </div>
                    <p className="font-mono text-xs font-bold text-slate-700 bg-slate-50 p-1.5 rounded">{m.content}</p>
                    {m.groups.length > 0 && (
                      <div className="pt-1.5 space-y-1">
                        <span className="text-[7px] font-black text-slate-300 uppercase tracking-widest">Capturing Groups</span>
                        <div className="flex flex-wrap gap-1">
                          {m.groups.map((g, gi) => (
                            <Badge key={gi} variant="outline" className="text-[8px] font-mono py-0 h-4 border-slate-100 bg-white">
                              ${gi+1}: {g || 'null'}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )) : (
                  <div className="h-40 flex flex-col items-center justify-center text-slate-300 gap-2">
                    <Search className="h-8 w-8 opacity-20" />
                    <span className="text-[9px] font-black uppercase tracking-widest">Nenhum resultado</span>
                  </div>
                )}
              </div>
            </ScrollArea>
          </section>

          <section className="p-5 bg-blue-50 rounded-[2rem] border border-blue-100 space-y-3">
            <div className="flex items-center gap-2 text-blue-600">
               <Info className="h-4 w-4" />
               <span className="text-[10px] font-black uppercase tracking-widest">Regex Cheat Sheet</span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <CheatItem code="\d" desc="Dígitos" />
              <CheatItem code="\w" desc="Alfanum" />
              <CheatItem code="+" desc="1 ou mais" />
              <CheatItem code="*" desc="0 ou mais" />
              <CheatItem code="^" desc="Início" />
              <CheatItem code="$" desc="Fim" />
            </div>
          </section>
        </aside>

        {/* Editor Main Area */}
        <section className="flex-1 p-8 flex flex-col gap-8 overflow-hidden bg-slate-50/20">
          {/* Test String Input */}
          <div className="flex-1 flex flex-col gap-4 min-h-0">
            <div className="flex items-center justify-between px-2">
              <h2 className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-400 flex items-center gap-2">
                <Code2 className="h-4 w-4" /> Test String
              </h2>
            </div>
            <Card className="flex-1 border-none shadow-2xl shadow-slate-200/50 rounded-[3rem] overflow-hidden bg-white flex flex-col">
              <Textarea 
                value={testString}
                onChange={(e) => setTestString(e.target.value)}
                placeholder="Insira o texto para testar o seu regex aqui..."
                className="flex-1 resize-none border-none p-10 font-mono text-sm leading-relaxed focus-visible:ring-0 selection:bg-blue-100"
              />
            </Card>
          </div>

          {/* Visualization / Result area */}
          <div className="h-[240px] flex flex-col gap-4">
             <div className="flex items-center justify-between px-2">
                <h2 className="text-[11px] font-black uppercase tracking-[0.2em] text-blue-600 flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4" /> Visualização de Captura
                </h2>
             </div>
             <Card className="flex-1 border-none shadow-xl shadow-slate-200/40 rounded-[2.5rem] bg-white/80 backdrop-blur-md p-10 overflow-auto font-mono text-sm leading-relaxed whitespace-pre-wrap">
                {highlightMatches()}
             </Card>
          </div>
        </section>
      </main>
    </div>
  );
}

function FlagToggle({ label, active, onClick }: { label: string, active: boolean, onClick: () => void }) {
  return (
    <button 
      onClick={onClick}
      className={cn(
        "px-3 py-1.5 rounded-full text-[9px] font-black uppercase tracking-widest border transition-all active:scale-95",
        active 
          ? "bg-blue-600 border-blue-600 text-white shadow-lg shadow-blue-500/20" 
          : "bg-white border-slate-100 text-slate-400 hover:border-slate-200"
      )}
    >
      {label}
    </button>
  );
}

function CheatItem({ code, desc }: { code: string, desc: string }) {
  return (
    <div className="flex items-center gap-2">
      <code className="text-[10px] font-black font-mono text-blue-600 bg-white px-1.5 py-0.5 rounded border border-blue-100">{code}</code>
      <span className="text-[8px] font-black text-slate-500 uppercase tracking-tight">{desc}</span>
    </div>
  );
}
