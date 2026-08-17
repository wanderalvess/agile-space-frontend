'use client';

import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Editor } from '@monaco-editor/react';
import { 
  ScanSearch, 
  Copy, 
  ClipboardPaste, 
  Download, 
  Eraser, 
  Binary,
  FileJson2,
  FileSearch,
  HelpCircle,
  Info,
  Layers,
  Code2,
  AlertTriangle
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

export default function DeepJsonDecoderPage() {
  const { toast } = useToast();
  const { userProfile } = useUserContext();
  const [input, setInput] = useState('');
  const [output, setOutput] = useState('');

  const deepDecode = (obj: any): any => {
    if (Array.isArray(obj)) return obj.map(deepDecode);
    if (obj !== null && typeof obj === 'object') {
      const newObj: any = {};
      for (const key in obj) { newObj[key] = deepDecode(obj[key]); }
      return newObj;
    }
    if (typeof obj === 'string' && obj.length > 20) {
      const trimmed = obj.trim();
      const base64Regex = /^[A-Za-z0-9+/]+={0,2}$/;
      if (base64Regex.test(trimmed)) {
        try {
          const decoded = atob(trimmed);
          if (decoded.startsWith('{') || decoded.startsWith('[')) {
            try { return deepDecode(JSON.parse(decoded)); } catch { }
          }
          if (decoded.trim().startsWith('<')) return decoded.trim();
          if (/^[\x20-\x7E\s\r\n\tÀ-ÿ]+$/.test(decoded)) return decoded;
        } catch (e) { }
      }
    }
    return obj;
  };

  const handleDecode = () => {
    try {
      if (!input.trim()) return;
      let parsedInput;
      try { parsedInput = JSON.parse(input); } catch (e) {
        toast({ title: "JSON Inválido", variant: "destructive" });
        return;
      }
      const decodedResult = deepDecode(parsedInput);
      setOutput(JSON.stringify(decodedResult, null, 2));
      toast({ title: "Decodificação concluída!" });
    } catch (e: any) {
      toast({ title: "Erro no processamento", description: e.message, variant: "destructive" });
    }
  };

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

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <TooltipProvider>
        <header className="flex items-center justify-between px-6 py-4 border-b bg-card shrink-0">
          <div className="flex items-center gap-3">
            <ScanSearch className="h-5 w-5 text-primary" />
            <div className="flex flex-col">
              <h1 className="text-lg font-bold leading-none">Decodificador de Base64 em JSON/XML</h1>
              <p className="text-[10px] text-muted-foreground font-medium mt-1 uppercase tracking-widest">EXTRAÇÃO RECURSIVA DE HASHES EM PAYLOADS</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {userProfile?.isGuest && (
              <Badge variant="outline" className="hidden lg:flex items-center gap-1.5 h-8 px-3 bg-amber-500/5 text-amber-600 border-amber-500/20 text-[10px] font-bold">
                <AlertTriangle className="h-3.5 w-3.5" />
                Modo Convidado
              </Badge>
            )}
            <Button onClick={handleDecode} className="font-bold gap-2 shadow-sm h-9 px-4 text-xs">
              <Binary className="h-4 w-4" />
              DECODIFICAR TUDO
            </Button>
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
                    <ScanSearch className="h-6 w-6 text-white" />
                  </div>
                  <SheetTitle className="text-3xl font-black uppercase tracking-tighter italic text-slate-800">
                    Decodificador de Base64 em JSON/XML
                  </SheetTitle>
                  <SheetDescription className="text-slate-500 font-bold text-xs uppercase tracking-widest mt-2 leading-relaxed">
                    Extração e decodificação automática de Base64 dentro de strings em JSON e XML
                  </SheetDescription>
                </SheetHeader>
                <ScrollArea className="flex-1 text-slate-600">
                  <div className="p-8 space-y-10">
                    <div className="space-y-4">
                      <h3 className="font-black text-xs uppercase tracking-[0.2em] text-blue-600 flex items-center gap-2 italic">
                        01. O que é o Deep Decoder?
                      </h3>
                      <p className="text-sm text-slate-500 font-medium leading-relaxed">
                        É um motor de varredura recursiva para JSON. Ele identifica strings que "parecem" Base64 dentro de objetos e tenta decodificá-las automaticamente. Se o resultado da decodificação for outro JSON, ele continua o processo até o nível mais profundo.
                      </p>
                    </div>

                    <div className="space-y-4">
                      <h3 className="font-black text-xs uppercase tracking-[0.2em] text-blue-600 flex items-center gap-2 italic">
                        02. Quando usar?
                      </h3>
                      <p className="text-sm text-slate-500 font-medium leading-relaxed">
                        Ideal para debugar logs de sistemas que encapsulam payloads em strings Base64 por segurança ou limitação de transporte, como filas (SQS/RabbitMQ) ou eventos de eventos.
                      </p>
                    </div>

                    <div className="space-y-4">
                      <h3 className="font-black text-xs uppercase tracking-[0.2em] text-blue-600 flex items-center gap-2 italic">
                        03. Passo a Passo
                      </h3>
                      <div className="space-y-3">
                        <div className="flex gap-4 items-start">
                          <div className="w-6 h-6 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-[10px] font-black shrink-0">1</div>
                          <p className="text-xs font-bold text-slate-500 mt-1">Cole o JSON contendo strings Base64 no painel à esquerda.</p>
                        </div>
                        <div className="flex gap-4 items-start">
                          <div className="w-6 h-6 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-[10px] font-black shrink-0">2</div>
                          <p className="text-xs font-bold text-slate-500 mt-1">Clique em <strong>DECODIFICAR TUDO</strong>.</p>
                        </div>
                        <div className="flex gap-4 items-start">
                          <div className="w-6 h-6 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-[10px] font-black shrink-0">3</div>
                          <p className="text-xs font-bold text-slate-500 mt-1">Veja o resultado expandido e formatado no painel à direita.</p>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-4 p-6 bg-blue-50/50 rounded-[2rem] border border-blue-100">
                      <h3 className="font-black text-xs uppercase tracking-[0.2em] text-blue-600 flex items-center gap-2 italic">
                        Segurança em Primeiro Lugar
                      </h3>
                      <p className="text-[11px] text-blue-800/80 font-bold leading-relaxed">
                        Toda a decodificação ocorre localmente no seu navegador. Seus dados sensíveis (tokens, payloads de clientes) nunca saem da sua máquina.
                      </p>
                    </div>
                  </div>
                </ScrollArea>
              </SheetContent>
            </Sheet>
            <div className="w-px h-6 bg-border mx-1" />
            <Button variant="ghost" size="icon" onClick={() => { setInput(''); setOutput(''); }} className="h-9 w-9 text-muted-foreground hover:text-primary"><Eraser className="h-4 w-4" /></Button>
          </div>
        </header>

        <div className="flex flex-1 p-4 gap-4 overflow-hidden bg-muted/10">
          <Card className="flex-1 flex flex-col shadow-sm border border-border/50 rounded-xl overflow-hidden bg-card">
            <div className="py-2 px-4 shadow-sm border-b bg-muted/30 flex items-center justify-between shrink-0">
              <span className="text-[9px] font-black uppercase text-muted-foreground tracking-[0.2em] flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-slate-300" />
                Entrada (Misto)
              </span>
              <Button variant="ghost" size="icon" onClick={handlePaste} className="text-muted-foreground hover:text-primary">
                <ClipboardPaste className="h-3.5 w-3.5" />
              </Button>
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
              <span className="text-[9px] font-black uppercase text-muted-foreground tracking-[0.2em] flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-blue-400" />
                Resultado
              </span>
              <Button variant="ghost" size="icon" onClick={() => handleCopy(output, 'Saída')} className="text-muted-foreground hover:text-primary">
                <Copy className="h-3.5 w-3.5" />
              </Button>
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
