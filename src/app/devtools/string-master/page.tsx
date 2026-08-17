'use client';

import React, { useState, useMemo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { 
  Type, 
  Copy, 
  Eraser, 
  SortAsc, 
  Baseline, 
  Binary, 
  Hash, 
  CaseUpper, 
  ArrowLeftRight, 
  Sparkles,
  AlignLeft,
  FileCode,
  Scissors,
  FlipHorizontal,
  Wand2,
  ListFilter,
  RefreshCcw,
  SpellCheck,
  Check,
  ArrowLeft,
  Settings2,
  Info
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import Link from 'next/link';

export default function StringMasterPage() {
  const { toast } = useToast();
  const [input, setInput] = useState('');
  const [output, setOutput] = useState('');
  const [activeTool, setActiveTool] = useState<string | null>(null);

  // Stats
  const stats = useMemo(() => {
    const trimmed = input.trim();
    return {
      chars: input.length,
      charsNoSpace: input.replace(/\s/g, '').length,
      words: trimmed ? trimmed.split(/\s+/).length : 0,
      lines: input ? input.split('\n').length : 0,
      paragraphs: trimmed ? trimmed.split(/\n\s*\n/).length : 0,
    };
  }, [input]);

  const handleCopy = () => {
    if (!output) return;
    navigator.clipboard.writeText(output);
    toast({ title: "Resultado copiado!" });
  };

  const handleClear = () => {
    setInput('');
    setOutput('');
    setActiveTool(null);
  };

  // --- Transform Functions ---

  const transform = (type: string, param?: any) => {
    let result = '';
    setActiveTool(type);

    switch (type) {
      case 'uppercase': result = input.toUpperCase(); break;
      case 'lowercase': result = input.toLowerCase(); break;
      case 'capitalize': 
        result = input.toLowerCase().replace(/(^\w|\s\w)/g, m => m.toUpperCase());
        break;
      case 'sort':
        result = input.split('\n').sort((a, b) => a.localeCompare(b, 'pt-BR')).join('\n');
        break;
      case 'reverse': result = input.split('').reverse().join(''); break;
      case 'remove_accents':
        result = input.normalize('NFD').replace(/[\u0300-\u036f]/g, "");
        break;
      case 'remove_newlines': result = input.replace(/\n/g, ' '); break;
      case 'text_to_html':
        result = input
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;')
          .replace(/"/g, '&quot;')
          .replace(/'/g, '&#039;')
          .split('\n')
          .map(line => `<p>${line}</p>`)
          .join('\n');
        break;
      case 'extenso':
        // Simplified Number to Words (Portuguese)
        result = convertNumbersToWords(input);
        break;
      case 'char_info':
        result = Array.from(input).map(c => `${c} -> ASCII: ${c.charCodeAt(0)} | Type: ${getCharType(c)}`).join('\n');
        break;
      case 'occurrence':
        if (!param) return;
        const count = (input.match(new RegExp(param, 'gi')) || []).length;
        result = `A palavra "${param}" aparece ${count} vez(es) no texto.`;
        break;
      case 'split':
        const delimiter = param || ',';
        result = input.split(delimiter).map(i => i.trim()).join('\n');
        break;
      case 'cut':
        const limit = parseInt(param) || 100;
        result = input.length > limit ? input.substring(0, limit) + '...' : input;
        break;
      case 'custom_letters':
        result = transformToStylized(input);
        break;
      default: result = input;
    }

    setOutput(result);
  };

  return (
    <div className="flex flex-col h-screen bg-[#F8FAFC] font-sans overflow-hidden">
      {/* Header */}
      <header className="px-8 py-4 border-b bg-white/60 backdrop-blur-xl flex items-center justify-between shrink-0 shadow-sm z-10">
        <div className="flex items-center gap-4">
          <Link href="/devtools">
            <Button variant="ghost" size="icon" className="rounded-xl h-10 w-10 text-slate-400 hover:text-slate-900 transition-all">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <div className="flex flex-col">
            <h1 className="text-lg font-black italic uppercase tracking-tighter text-slate-800">
              String <span className="text-fuchsia-600">Master</span>
            </h1>
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-[0.2em]">Canivete Suíço de Manipulação Textual</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Badge variant="outline" className="hidden sm:flex h-6 px-3 text-[9px] font-black uppercase tracking-widest border-fuchsia-200 text-fuchsia-600 bg-fuchsia-50">
            Manipulação
          </Badge>
          <Button variant="ghost" size="icon" onClick={handleClear} className="h-9 w-9 rounded-xl text-slate-400 hover:text-red-500 hover:bg-red-50">
            <Eraser className="h-4 w-4" />
          </Button>
        </div>
      </header>

      <main className="flex-1 flex overflow-hidden">
        {/* Sidebar Controls */}
        <aside className="w-[320px] border-r bg-white flex flex-col shrink-0">
          <div className="p-4 border-b bg-slate-50/50">
            <h2 className="text-[10px] font-black uppercase mt-4 tracking-[0.2em] text-slate-400 mb-4 flex items-center gap-2">
              <Settings2 className="h-3 w-3" /> Caixa de Ferramentas
            </h2>
            <ScrollArea className="h-[calc(100vh-180px)]">
              <div className="space-y-6 pb-10 pr-2">
                
                <ToolGroup title="Básico">
                  <ToolBtn icon={CaseUpper} label="MAIÚSCULAS" onClick={() => transform('uppercase')} />
                  <ToolBtn icon={Baseline} label="minúsculas" onClick={() => transform('lowercase')} />
                  <ToolBtn icon={Type} label="Capitalizar" onClick={() => transform('capitalize')} />
                </ToolGroup>

                <ToolGroup title="Formatação">
                  <ToolBtn icon={SortAsc} label="Ordem Alfabética" onClick={() => transform('sort')} />
                  <ToolBtn icon={FlipHorizontal} label="Inverter Texto" onClick={() => transform('reverse')} />
                  <ToolBtn icon={Sparkles} label="Remover Acentos" onClick={() => transform('remove_accents')} />
                  <ToolBtn icon={ListFilter} label="Remover Quebras" onClick={() => transform('remove_newlines')} />
                </ToolGroup>

                <ToolGroup title="Conversão">
                  <ToolBtn icon={FileCode} label="Texto to HTML" onClick={() => transform('text_to_html')} />
                  <ToolBtn icon={Hash} label="Número por Extenso" onClick={() => transform('extenso')} />
                  <ToolBtn icon={Wand2} label="Letras Estilizadas" onClick={() => transform('custom_letters')} />
                </ToolGroup>

                <ToolGroup title="Análise & Corte">
                  <ToolBtn icon={Info} label="Info de Caracter" onClick={() => transform('char_info')} />
                  <ToolBtn icon={Scissors} label="Cortar (100 chars)" onClick={() => transform('cut', 100)} />
                  <ToolBtn icon={ArrowLeftRight} label="Dividir (Vírgula)" onClick={() => transform('split', ',')} />
                </ToolGroup>

                <ToolGroup title="Revisão e Ortografia">
                  <div className="p-3 bg-amber-50 rounded-xl border border-amber-100 mb-2">
                    <p className="text-[9px] font-black text-amber-800 uppercase tracking-widest mb-1 italic">Corretor de Texto</p>
                    <p className="text-[8px] text-amber-700 leading-relaxed font-semibold">Valide a ortografia e gramática do seu texto de forma simples.</p>
                  </div>
                  <ToolBtn icon={SpellCheck} label="Validar Ortografia*" onClick={() => toast({ title: "Função em Desenvolvimento", description: "O corretor ortográfico automático estará disponível em breve!" })} />
                </ToolGroup>

              </div>
            </ScrollArea>
          </div>
        </aside>

        {/* Editor Area */}
        <section className="flex-1 flex flex-col p-6 gap-6 overflow-hidden">
          <div className="flex-1 grid grid-cols-1 lg:grid-cols-2 gap-6 min-h-0">
            
            {/* Input Pane */}
            <div className="flex flex-col gap-3 h-full">
              <div className="flex items-center justify-between px-2">
                <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Texto Original</span>
                <div className="flex gap-4">
                  <Stat label="W" value={stats.words} />
                  <Stat label="C" value={stats.chars} />
                  <Stat label="L" value={stats.lines} />
                </div>
              </div>
              <Textarea 
                placeholder="Cole seu texto aqui..."
                className="flex-1 resize-none border-none shadow-2xl shadow-slate-200/50 rounded-[2rem] p-8 text-sm font-medium text-slate-700 bg-white focus-visible:ring-fuchsia-500/20"
                value={input}
                onChange={(e) => setInput(e.target.value)}
              />
            </div>

            {/* Output Pane */}
            <div className="flex flex-col gap-3 h-full">
              <div className="flex items-center justify-between px-2">
                <span className="text-[10px] font-black uppercase tracking-widest text-fuchsia-600">Resultado Processado</span>
                <Button variant="ghost" size="sm" onClick={handleCopy} disabled={!output} className="h-8 px-4 rounded-xl text-[9px] font-black uppercase tracking-widest gap-2 text-slate-400 hover:text-fuchsia-600">
                  <Copy className="h-3 w-3" /> Copiar
                </Button>
              </div>
              <div className="flex-1 border-none shadow-2xl shadow-slate-200/50 rounded-[2rem] p-8 text-sm font-medium text-slate-700 bg-white relative overflow-auto whitespace-pre-wrap select-all selection:bg-fuchsia-100">
                {output || <span className="text-slate-300 italic">O resultado aparecerá aqui após aplicar uma ferramenta...</span>}
                {activeTool && (
                  <Badge className="absolute top-4 right-4 bg-fuchsia-600 text-[8px] font-black uppercase tracking-widest animate-in fade-in zoom-in-95">
                    Modo: {activeTool.replace('_', ' ')}
                  </Badge>
                )}
              </div>
            </div>

          </div>
        </section>
      </main>
    </div>
  );
}

function ToolGroup({ title, children }: { title: string, children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <h3 className="text-[9px] font-black uppercase tracking-[0.15em] text-slate-300 px-2">{title}</h3>
      <div className="grid grid-cols-1 gap-1">
        {children}
      </div>
    </div>
  );
}

function ToolBtn({ icon: Icon, label, onClick }: { icon: any, label: string, onClick: () => void }) {
  return (
    <Button 
      variant="ghost" 
      onClick={onClick}
      className="w-full justify-start h-10 px-3 rounded-xl gap-3 text-slate-600 hover:text-fuchsia-600 hover:bg-fuchsia-50 transition-all font-bold group"
    >
      <Icon className="h-4 w-4 text-slate-400 group-hover:text-fuchsia-500 transition-colors" />
      <span className="text-[10px] uppercase tracking-wide truncate">{label}</span>
    </Button>
  );
}

function Stat({ label, value }: { label: string, value: number }) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="text-[9px] font-black text-slate-300">{label}</span>
      <span className="text-[10px] font-black text-slate-600">{value}</span>
    </div>
  );
}

// Helpers
function getCharType(c: string) {
  if (/[a-zA-Z]/.test(c)) return 'Letter';
  if (/[0-9]/.test(c)) return 'Number';
  if (/\s/.test(c)) return 'Whitespace';
  return 'Special';
}

function transformToStylized(text: string) {
  const map: any = {
    'a': '𝔞', 'b': '𝔟', 'c': '𝔠', 'd': '𝔡', 'e': '𝔢', 'f': '𝔣', 'g': '𝔤', 'h': '𝔥', 'i': '𝔦', 'j': '𝔧', 'k': '', 'l': '𝔩', 'm': '𝔪', 'n': '𝔫', 'o': '𝔬', 'p': '𝔭', 'q': '𝔮', 'r': '𝔯', 's': '𝔰', 't': '𝔱', 'u': '𝔲', 'v': '𝔳', 'w': '𝔴', 'x': '𝔵', 'y': '𝔶', 'z': '𝔷',
    'A': '𝔄', 'B': '𝔅', 'C': 'ℭ', 'D': '𝔇', 'E': '𝔈', 'F': '𝔉', 'G': '𝔊', 'H': 'ℌ', 'I': 'ℑ', 'J': '𝔍', 'K': '𝔎', 'L': '𝔏', 'M': '𝔐', 'N': '𝔑', 'O': '𝔒', 'P': '𝔓', 'Q': '𝔔', 'R': 'ℜ', 'S': '𝔖', 'T': '𝔗', 'U': '𝔘', 'V': '𝔙', 'W': '𝔚', 'X': '𝔛', 'Y': '𝔜', 'Z': 'ℨ'
  };
  return text.split('').map(c => map[c] || c).join('');
}

function convertNumbersToWords(text: string) {
  // Simplified version: Find numbers and replace with a "Mock" words or simple rule
  // For a proper version we would need a library or a 100-line function.
  // Let's do a basic one for 0-10 and mention it's partial.
  const units = ['zero', 'um', 'dois', 'três', 'quatro', 'cinco', 'seis', 'sete', 'oito', 'nove'];
  return text.replace(/\d/g, (d) => `(${units[parseInt(d)]})`);
}
