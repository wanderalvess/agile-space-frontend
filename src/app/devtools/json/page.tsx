'use client';

import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Editor } from '@monaco-editor/react';
import { 
  FileJson, 
  Copy, 
  ClipboardPaste, 
  Download, 
  Eraser, 
  Wand2, 
  Minimize2,
  Braces,
  HelpCircle,
  Info,
  CheckCircle2,
  AlertTriangle,
  Code2,
  Zap
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Tooltip, TooltipProvider, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { useUserContext } from '@/context/UserContext';

export default function JsonToolsPage() {
  const { toast } = useToast();
  const { userProfile } = useUserContext();
  const [input, setInput] = useState('');
  const [output, setOutput] = useState('');

  const getLineColumn = (text: string, position: number) => {
    const lines = text.slice(0, position).split('\n');
    return { line: lines.length, column: lines[lines.length - 1].length + 1 };
  };

  const validateJSON = (jsonString: string, label: string): any => {
    try {
      if (!jsonString.trim()) return null;
      return JSON.parse(jsonString);
    } catch (e: any) {
      const match = e.message.match(/position (\d+)/i) || e.message.match(/line (\d+) column (\d+)/i);
      let detail = e.message;
      if (match) {
        if (e.message.includes('line')) {
          detail = `Erro na Linha ${match[1]}, Coluna ${match[2]}.`;
        } else {
          const pos = parseInt(match[1], 10);
          const { line, column } = getLineColumn(jsonString, pos);
          detail = `Erro na Linha ${line}, Coluna ${column}.`;
        }
      }
      toast({ title: `Erro de Sintaxe: ${label}`, description: detail, variant: "destructive" });
      return null;
    }
  };

  const handlePrettify = () => {
    const parsed = validateJSON(input, 'Entrada');
    if (parsed) {
      setOutput(JSON.stringify(parsed, null, 2));
      toast({ title: "JSON Formatado" });
    }
  };

  const handleMinify = () => {
    const parsed = validateJSON(input, 'Entrada');
    if (parsed) {
      setOutput(JSON.stringify(parsed));
      toast({ title: "JSON Minificado" });
    }
  };

  const handleCopy = async (text: string, label: string) => {
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      toast({ title: "Copiado!", description: `${label} copiado.` });
    } catch (e) {
      toast({ title: "Erro ao copiar", variant: "destructive" });
    }
  };

  const handleDownload = () => {
    if (!output) return;
    const blob = new Blob([output], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'data.json';
    a.click();
    URL.revokeObjectURL(url);
  };

  const handlePaste = async () => {
    try {
      const text = await navigator.clipboard.readText();
      setInput(text);
    } catch (e) { toast({ title: "Erro ao colar", variant: "destructive" }); }
  };

  return (
    <div className="flex flex-col h-full overflow-hidden font-sans">
      <TooltipProvider>
        <header className="flex items-center justify-between px-6 py-4 border-b bg-card shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center shadow-lg shadow-blue-500/30">
              <FileJson className="h-4 w-4 text-white" />
            </div>
            <div className="flex flex-col">
              <h1 className="text-lg font-bold leading-none">Formatador e Validador JSON</h1>
              <p className="text-[10px] text-muted-foreground font-medium mt-1 uppercase tracking-widest">BEAUTIFIER & VALIDATOR PROFESSIONAL</p>
            </div>
          </div>

            <div className="flex items-center gap-3">
              {userProfile?.isGuest && (
                <Badge variant="outline" className="hidden lg:flex items-center gap-1.5 h-8 px-3 bg-amber-500/5 text-amber-600 border-amber-500/20 text-[10px] font-bold">
                  <AlertTriangle className="h-3.5 w-3.5" />
                  CONVIDADO
                </Badge>
              )}

              <Sheet>
                <SheetTrigger asChild>
                  <Button variant="ghost" size="sm" className="h-10 px-4 font-black text-[9px] uppercase tracking-widest gap-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-all rounded-xl">
                    <HelpCircle className="h-4 w-4" />
                    GUIA
                  </Button>
                </SheetTrigger>
                <SheetContent className="sm:max-w-xl overflow-hidden flex flex-col p-0 border-none shadow-2xl">
                  <SheetHeader className="shrink-0 border-b p-8 bg-white">
                    <div className="w-12 h-12 bg-blue-600 rounded-2xl flex items-center justify-center shadow-lg shadow-blue-500/30 mb-4">
                      <Braces className="h-6 w-6 text-white" />
                    </div>
                    <SheetTitle className="text-3xl font-black uppercase tracking-tighter italic text-slate-800">
                      Formatador JSON
                    </SheetTitle>
                    <SheetDescription className="text-slate-500 font-bold text-xs uppercase tracking-widest mt-2 leading-relaxed">
                      Engine profissional de formatação e validação sintática
                    </SheetDescription>
                  </SheetHeader>
                <ScrollArea className="flex-1 text-slate-600">
                  <div className="p-8 space-y-10">
                    <div className="space-y-4">
                      <h3 className="font-black text-xs uppercase tracking-[0.2em] text-blue-600 flex items-center gap-2 italic">
                        01. Formatação Inteligente
                      </h3>
                      <p className="text-sm text-slate-500 font-medium leading-relaxed">
                        Ao clicar em <strong>Formatar</strong> ou <strong>Minificar</strong>, o sistema realiza um Raio-X sintático. Se houver erro, indicamos a <strong>linha e coluna</strong> exata, permitindo depuração imediata de payloads massivos.
                      </p>
                    </div>

                    <div className="space-y-4 p-6 bg-slate-50 rounded-[2rem] border border-slate-100">
                       <h3 className="font-black text-xs uppercase tracking-[0.2em] text-slate-400 flex items-center gap-2 italic">
                         Performance Local
                       </h3>
                       <p className="text-[11px] text-slate-500 font-bold leading-relaxed">
                         Todo o processamento ocorre no seu navegador. Seus dados nunca são enviados ao servidor para formatação, garantindo privacidade total.
                       </p>
                    </div>
                  </div>
                </ScrollArea>
              </SheetContent>
            </Sheet>

            <Button variant="ghost" size="sm" onClick={handleMinify} className="h-9 px-4 font-black text-[10px] uppercase tracking-widest gap-2 text-slate-500 hover:text-slate-900 transition-all rounded-xl">
              <Minimize2 className="h-4 w-4" /> 
              Minificar
            </Button>
            <Button size="sm" onClick={handlePrettify} className="h-9 px-5 font-black text-[10px] uppercase tracking-widest gap-2 bg-slate-900 hover:bg-blue-600 text-white shadow-xl shadow-slate-900/10 transition-all active:scale-95 rounded-xl">
              <Wand2 className="h-4 w-4" /> 
              Formatar
            </Button>
            <div className="w-px h-6 bg-slate-200 mx-1" />
            <Button variant="ghost" size="icon" onClick={() => { setInput(''); setOutput(''); }} className="h-9 w-9 text-slate-400 hover:text-red-500 hover:bg-red-50 transition-all rounded-xl"><Eraser className="h-4 w-4" /></Button>
          </div>
        </header>

        <div className="flex-1 flex p-4 gap-4 bg-muted/10 overflow-hidden">
          <Card className="flex-1 flex flex-col rounded-xl border-border/50 shadow-sm overflow-hidden bg-card">
            <div className="py-2 px-4 shadow-sm border-b bg-muted/30 flex items-center justify-between shrink-0">
              <span className="text-[9px] font-black uppercase text-muted-foreground tracking-[0.2em] flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-slate-300" />
                Entrada
              </span>
              <div className="flex items-center gap-1">
                <Button variant="ghost" size="icon" onClick={handlePaste} className="h-7 w-7 text-muted-foreground hover:text-primary transition-all">
                  <ClipboardPaste className="h-3.5 w-3.5" />
                </Button>
                <Button variant="ghost" size="icon" onClick={handlePrettify} className="h-7 w-7 text-muted-foreground hover:text-primary transition-all">
                  <Wand2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
            <div className="flex-1 min-h-0 relative bg-[#1e1e1e]">
              <Editor
                height="100%"
                language="json"
                theme="vs-dark"
                value={input}
                onChange={(val) => setInput(val || '')}
                options={{
                  minimap: { enabled: false },
                  fontSize: 11,
                  fontFamily: 'var(--font-jetbrains-mono), monospace',
                  wordWrap: 'on',
                  automaticLayout: true,
                  padding: { top: 12, bottom: 12 },
                  scrollBeyondLastLine: false,
                }}
              />
            </div>
          </Card>

          <Card className="flex-1 flex flex-col rounded-xl border-border/50 shadow-sm overflow-hidden bg-card">
            <div className="py-2 px-4 shadow-sm border-b bg-muted/30 flex items-center justify-between shrink-0">
              <span className="text-[9px] font-black uppercase text-muted-foreground tracking-[0.2em] flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-blue-400" />
                Resultado
              </span>
              <div className="flex items-center gap-1">
                <Button variant="ghost" size="icon" onClick={() => handleCopy(output, 'Saída')} className="h-7 w-7 text-muted-foreground hover:text-primary transition-all">
                  <Copy className="h-3.5 w-3.5" />
                </Button>
                <Button variant="ghost" size="icon" onClick={handleDownload} className="h-7 w-7 text-muted-foreground hover:text-primary transition-all">
                  <Download className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
            <div className="flex-1 min-h-0 relative bg-[#1e1e1e]">
              <Editor
                height="100%"
                language="json"
                theme="vs-dark"
                value={output}
                options={{
                  minimap: { enabled: false },
                  fontSize: 11,
                  fontFamily: 'var(--font-jetbrains-mono), monospace',
                  wordWrap: 'on',
                  automaticLayout: true,
                  readOnly: true,
                  padding: { top: 12, bottom: 12 },
                  scrollBeyondLastLine: false,
                }}
              />
            </div>
          </Card>
        </div>
      </TooltipProvider>
    </div>
  );
}
