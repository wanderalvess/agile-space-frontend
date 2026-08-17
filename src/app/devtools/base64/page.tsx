'use client';

import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Editor } from '@monaco-editor/react';
import { Badge } from '@/components/ui/badge';
import { 
  Zap, 
  Copy, 
  ClipboardPaste, 
  Download, 
  Eraser, 
  Binary,
  FileText,
  HelpCircle,
  Info,
  Terminal,
  Braces,
  AlertTriangle,
  Wand2
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
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
import { useUserContext } from '@/context/UserContext';

export default function Base64Page() {
  const { toast } = useToast();
  const { userProfile } = useUserContext();
  const [mode, setMode] = useState<'encode' | 'decode'>('decode');
  const [input, setInput] = useState('');
  const [output, setOutput] = useState('');
  const [isJson, setIsJson] = useState(false);
  const [isXml, setIsXml] = useState(false);

  const encodeBase64 = (str: string): string => {
    try {
      const bytes = new TextEncoder().encode(str);
      const binString = Array.from(bytes, (byte) => String.fromCodePoint(byte)).join("");
      return btoa(binString);
    } catch (e) { return ''; }
  };

  const decodeBase64 = (str: string): string => {
    try {
      const binString = atob(str.trim());
      const bytes = Uint8Array.from(binString, (m) => m.codePointAt(0)!);
      return new TextDecoder().decode(bytes);
    } catch (e) { return 'Erro: Formato Base64 inválido.'; }
  };

  useEffect(() => {
    if (!input.trim()) { setOutput(''); setIsJson(false); setIsXml(false); return; }
    if (mode === 'encode') {
      setOutput(encodeBase64(input));
      setIsJson(false);
      setIsXml(false);
    } else {
      const decoded = decodeBase64(input);
      try {
        const parsed = JSON.parse(decoded);
        setOutput(JSON.stringify(parsed, null, 2));
        setIsJson(true);
        setIsXml(false);
      } catch (e) {
        setOutput(decoded);
        setIsJson(false);
        setIsXml(/^\s*<[\s\S]*>\s*$/.test(decoded));
      }
    }
  }, [input, mode]);

  const handleCopy = async (text: string, label: string) => {
    if (!text) return;
    await navigator.clipboard.writeText(text);
    toast({ title: "Copiado!", description: `${label} copiado.` });
  };

  const handlePaste = async () => {
    try {
      const text = await navigator.clipboard.readText();
      setInput(text);
    } catch (e) { toast({ title: "Erro ao colar", variant: "destructive" }); }
  };

  const handleDownload = () => {
    if (!output) return;
    const blob = new Blob([output], { type: isJson ? 'application/json' : 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = isJson ? 'result.json' : 'result.txt';
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleFormatResult = () => {
    if (!output) return;
    
    if (mode === 'decode') {
      try {
        const parsed = JSON.parse(output);
        setOutput(JSON.stringify(parsed, null, 2));
        setIsJson(true);
        setIsXml(false);
        toast({ title: "Formatado!", description: "Conteúdo estruturado como JSON." });
      } catch (e) {
        if (/^\s*<[\s\S]*>\s*$/.test(output)) {
          let formatted = '';
          let indent = '';
          const tab = '  ';
          output.trim().split(/>\s*</).forEach((node) => {
            if (node.match(/^\/\w/)) indent = indent.substring(tab.length);
            formatted += indent + '<' + node + '>\n';
            if (node.match(/^<?\w[^>]*[^\/]$/) && !node.startsWith('?')) indent += tab;
          });
          setOutput(formatted.substring(1, formatted.length - 2).trim());
          setIsXml(true);
          setIsJson(false);
          toast({ title: "Formatado!", description: "Conteúdo estruturado como XML." });
        } else {
          toast({ title: "Aviso", description: "O texto não é um JSON ou XML válido para formatar.", variant: "destructive" });
        }
      }
    } else {
      if (output.includes('\n')) {
        setOutput(output.replace(/\n/g, ''));
        toast({ title: "Compactado!", description: "Quebras de linha removidas." });
      } else {
        const formatted = output.replace(/(.{76})/g, '$1\n').trim();
        setOutput(formatted);
        toast({ title: "Formatado!", description: "Base64 dividido em múltiplas linhas." });
      }
    }
  };

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <TooltipProvider>
        <header className="flex items-center justify-between px-6 py-4 border-b bg-card shrink-0">
          <div className="flex items-center gap-3">
            <Zap className="h-5 w-5 text-primary" />
            <div className="flex flex-col">
              <h1 className="text-lg font-bold leading-none">Codificador Base64</h1>
              <p className="text-[10px] text-muted-foreground font-medium mt-1 uppercase tracking-widest">TRATAMENTO RESILIENTE DE TEXTO E HASH</p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            {userProfile?.isGuest && (
              <Badge variant="outline" className="hidden lg:flex items-center gap-1.5 h-8 px-3 bg-amber-500/5 text-amber-600 border-amber-500/20 text-[10px] font-bold">
                <AlertTriangle className="h-3.5 w-3.5" />
                Modo Convidado
              </Badge>
            )}
            <Tabs value={mode} onValueChange={(v: any) => setMode(v)} className="w-[200px]">
              <TabsList className="grid w-full grid-cols-2 h-8">
                <TabsTrigger value="decode" className="text-[10px] font-bold">DECODE</TabsTrigger>
                <TabsTrigger value="encode" className="text-[10px] font-bold">ENCODE</TabsTrigger>
              </TabsList>
            </Tabs>
            
            <div className="w-px h-6 bg-border mx-1" />

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
                    <Binary className="h-6 w-6 text-white" />
                  </div>
                  <SheetTitle className="text-3xl font-black uppercase tracking-tighter italic text-slate-800">
                    Base64 Engine
                  </SheetTitle>
                  <SheetDescription className="text-slate-500 font-bold text-xs uppercase tracking-widest mt-2 leading-relaxed">
                    Codificação e decodificação resiliente com suporte UTF-8
                  </SheetDescription>
                </SheetHeader>
                <ScrollArea className="flex-1 text-slate-600">
                  <div className="p-8 space-y-10">
                    <div className="space-y-4">
                      <h3 className="font-black text-xs uppercase tracking-[0.2em] text-blue-600 flex items-center gap-2 italic">
                        01. O que é Base64?
                      </h3>
                      <p className="text-sm text-slate-500 font-medium leading-relaxed">
                        É um esquema de codificação que converte dados binários em um formato de texto ASCII. É amplamente utilizado para transmitir dados que podem ser corrompidos durante a transferência, como imagens em CSS ou credenciais em headers HTTP.
                      </p>
                    </div>

                    <div className="space-y-4">
                      <h3 className="font-black text-xs uppercase tracking-[0.2em] text-blue-600 flex items-center gap-2 italic">
                        02. Como usar o Engine?
                      </h3>
                      <div className="space-y-3">
                        <div className="flex gap-4 items-start">
                          <div className="w-6 h-6 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-[10px] font-black shrink-0">1</div>
                          <p className="text-xs font-bold text-slate-500 mt-1">Selecione o modo: <strong>ENCODE</strong> para cifrar ou <strong>DECODE</strong> para traduzir.</p>
                        </div>
                        <div className="flex gap-4 items-start">
                          <div className="w-6 h-6 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-[10px] font-black shrink-0">2</div>
                          <p className="text-xs font-bold text-slate-500 mt-1">Cole seu texto ou hash no painel da esquerda.</p>
                        </div>
                        <div className="flex gap-4 items-start">
                          <div className="w-6 h-6 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-[10px] font-black shrink-0">3</div>
                          <p className="text-xs font-bold text-slate-500 mt-1">O resultado aparece instantaneamente à direita. Use as ferramentas extras para formatar JSON/XML se detectados.</p>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-4 p-6 bg-blue-50/50 rounded-[2rem] border border-blue-100">
                      <h3 className="font-black text-xs uppercase tracking-[0.2em] text-blue-600 flex items-center gap-2 italic">
                        Dica de Desenvolvedor
                      </h3>
                      <p className="text-[11px] text-blue-800/80 font-bold leading-relaxed">
                        Use o modo <strong>DECODE</strong> para inspecionar tokens JWT (apenas o payload) ou headers de autorização Basic rapidamente.
                      </p>
                    </div>
                  </div>
                </ScrollArea>
              </SheetContent>
            </Sheet>

            <div className="w-px h-6 bg-border mx-1" />
            
            <Button variant="ghost" size="icon" onClick={() => setInput('')} className="h-9 w-9 text-muted-foreground hover:text-primary">
              <Eraser className="h-4 w-4" />
            </Button>
            <Button onClick={() => handleCopy(output, 'Resultado')} disabled={!output} className="font-bold h-9 px-4 text-xs">
              <Copy className="mr-2 h-4 w-4" />
              COPIAR
            </Button>
          </div>
        </header>

        <div className="flex flex-1 p-4 gap-4 overflow-hidden bg-muted/10">
          <Card className="flex-1 flex flex-col shadow-sm border border-border/50 rounded-xl overflow-hidden bg-card">
            <div className="py-2 px-4 shadow-sm border-b bg-muted/30 flex items-center justify-between shrink-0">
              <span className="text-[9px] font-black uppercase text-muted-foreground tracking-[0.2em] flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-slate-300" />
                {mode === 'encode' ? 'Entrada' : 'Hash Base64'}
              </span>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="icon" onClick={handlePaste} className="h-7 w-7 text-muted-foreground hover:text-primary transition-all">
                    <ClipboardPaste className="h-3.5 w-3.5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Colar</TooltipContent>
              </Tooltip>
            </div>
            <div className="flex-1 min-h-0 relative bg-[#1e1e1e]">
              <Editor
                height="100%"
                language="text"
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

          <Card className="flex-1 flex flex-col shadow-sm border border-border/50 rounded-xl overflow-hidden bg-card">
            <div className="py-2 px-4 shadow-sm border-b bg-muted/30 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2">
                <span className="text-[9px] font-black uppercase text-muted-foreground tracking-[0.2em] flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-blue-400" />
                  Resultado
                </span>
                {isJson && <Badge variant="outline" className="h-4 px-1.5 text-[7px] font-black bg-primary/10 text-primary border-primary/20">JSON</Badge>}
                {isXml && <Badge variant="outline" className="h-4 px-1.5 text-[7px] font-black bg-blue-500/10 text-blue-500 border-blue-500/20">XML</Badge>}
              </div>
              <div className="flex items-center gap-1">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="ghost" size="icon" onClick={handleFormatResult} className="h-7 w-7 text-muted-foreground hover:text-primary transition-all">
                      <Wand2 className="h-3.5 w-3.5" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>{mode === 'encode' ? 'Alternar Quebra de Linhas' : 'Formatar JSON/XML'}</TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="ghost" size="icon" onClick={() => handleCopy(output, 'Saída')} className="h-7 w-7 text-muted-foreground hover:text-primary transition-all"><Copy className="h-3.5 w-3.5" /></Button>
                  </TooltipTrigger>
                  <TooltipContent>Copiar</TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="ghost" size="icon" onClick={handleDownload} className="h-7 w-7 text-muted-foreground hover:text-primary transition-all"><Download className="h-3.5 w-3.5" /></Button>
                  </TooltipTrigger>
                  <TooltipContent>Baixar</TooltipContent>
                </Tooltip>
              </div>
            </div>
            <div className="flex-1 min-h-0 relative bg-[#1e1e1e]">
              <Editor
                height="100%"
                language={isJson ? "json" : (isXml ? "xml" : "text")}
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
