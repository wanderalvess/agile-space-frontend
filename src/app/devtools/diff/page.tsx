'use client';

import React, { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { 
  GitCompare, 
  Eraser, 
  Copy,
  Code2,
  HelpCircle,
  Info,
  Scale,
  Settings2,
  AlertTriangle
} from 'lucide-react';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select';
import { Editor, DiffEditor } from '@monaco-editor/react';
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

export default function DiffViewerPage() {
  const { toast } = useToast();
  const { userProfile } = useUserContext();
  const [language, setLanguage] = useState('json');
  const [original, setOriginal] = useState('');
  const [modified, setModified] = useState('');

  const editorOriginalRef = React.useRef<any>(null);
  const editorModifiedRef = React.useRef<any>(null);
  const diffEditorRef = React.useRef<any>(null);

  useEffect(() => {
    return () => {
      if (editorOriginalRef.current) editorOriginalRef.current.dispose();
      if (editorModifiedRef.current) editorModifiedRef.current.dispose();
      if (diffEditorRef.current) diffEditorRef.current.dispose();
    };
  }, []);

  const handleCopy = async (text: string, label: string) => {
    if (!text) return;
    await navigator.clipboard.writeText(text);
    toast({ title: "Copiado!", description: `${label} copiado.` });
  };

  const handleClear = () => {
    setOriginal('');
    setModified('');
    toast({ title: "Limpo!" });
  };

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <TooltipProvider>
        <header className="flex items-center justify-between px-6 py-4 border-b bg-card shrink-0">
          <div className="flex items-center gap-3">
            <GitCompare className="h-5 w-5 text-primary" />
            <div className="flex flex-col">
              <h1 className="text-lg font-bold leading-none">Comparador de Código</h1>
              <p className="text-[10px] text-muted-foreground font-medium mt-1 uppercase tracking-widest">DIFERENÇA E REGRESSÃO SIDE-BY-SIDE</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {userProfile?.isGuest && (
              <Badge variant="outline" className="hidden lg:flex items-center gap-1.5 h-8 px-3 bg-amber-500/5 text-amber-600 border-amber-500/20 text-[10px] font-bold">
                <AlertTriangle className="h-3.5 w-3.5" />
                Modo Convidado
              </Badge>
            )}
            <div className="flex items-center gap-2 px-3 py-1.5 bg-muted/50 rounded-lg border">
              <span className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mr-2">Linguagem:</span>
              <Select value={language} onValueChange={setLanguage}>
                <SelectTrigger className="w-[120px] h-7 text-[10px] font-bold border-none bg-transparent shadow-none focus:ring-0">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="json" className="text-xs">JSON</SelectItem>
                  <SelectItem value="xml" className="text-xs">XML</SelectItem>
                  <SelectItem value="plaintext" className="text-xs">Texto Puro</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
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
                    <GitCompare className="h-6 w-6 text-white" />
                  </div>
                  <SheetTitle className="text-3xl font-black uppercase tracking-tighter italic text-slate-800">
                    Comparador de Código
                  </SheetTitle>
                  <SheetDescription className="text-slate-500 font-bold text-xs uppercase tracking-widest mt-2 leading-relaxed">
                    Identificação de diferenças e regressões em payloads e arquivos
                  </SheetDescription>
                </SheetHeader>
                <ScrollArea className="flex-1 text-slate-600">
                  <div className="p-8 space-y-10">
                    <div className="space-y-4">
                      <h3 className="font-black text-xs uppercase tracking-[0.2em] text-blue-600 flex items-center gap-2 italic">
                        01. Por que comparar?
                      </h3>
                      <p className="text-sm text-slate-500 font-medium leading-relaxed">
                        Detectar pequenas mudanças em payloads JSON extensos ou arquivos de configuração pode ser impossível a olho nu. O Diff Viewer destaca exatamente o que foi adicionado, removido ou alterado.
                      </p>
                    </div>

                    <div className="space-y-4">
                      <h3 className="font-black text-xs uppercase tracking-[0.2em] text-blue-600 flex items-center gap-2 italic">
                        02. Interpretação Visual
                      </h3>
                      <div className="space-y-3">
                        <div className="flex gap-4 items-center p-3 bg-red-50 rounded-xl border border-red-100">
                          <div className="w-2 h-2 rounded-full bg-red-500 shrink-0" />
                          <p className="text-xs font-bold text-red-700">Linhas em Vermelho: Conteúdo que existia na versão original mas foi removido.</p>
                        </div>
                        <div className="flex gap-4 items-center p-3 bg-emerald-50 rounded-xl border border-emerald-100">
                          <div className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
                          <p className="text-xs font-bold text-emerald-700">Linhas em Verde: Conteúdo novo que não existia na versão anterior.</p>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-4">
                      <h3 className="font-black text-xs uppercase tracking-[0.2em] text-blue-600 flex items-center gap-2 italic">
                        03. Fluxo de Trabalho
                      </h3>
                      <div className="space-y-3 font-medium text-sm text-slate-500">
                        <p>1. Selecione a linguagem no cabeçalho (JSON, XML ou Texto).</p>
                        <p>2. Insira o código base no painel <strong>ORIGINAL</strong>.</p>
                        <p>3. Insira a nova versão no painel <strong>MODIFICADO</strong>.</p>
                        <p>4. Inspecione o painel inferior para ver a comparação consolidada.</p>
                      </div>
                    </div>

                    <div className="space-y-4 p-6 bg-blue-50/50 rounded-[2rem] border border-blue-100">
                      <h3 className="font-black text-xs uppercase tracking-[0.2em] text-blue-600 flex items-center gap-2 italic">
                        Dica de Debug
                      </h3>
                      <p className="text-[11px] text-blue-800/80 font-bold leading-relaxed">
                        Se os arquivos estiverem minificados (em uma única linha), o Diff não funcionará bem. Formate ambos com a ferramenta <strong>Formatador JSON</strong> antes de comparar.
                      </p>
                    </div>
                  </div>
                </ScrollArea>
              </SheetContent>
            </Sheet>
            
            <div className="w-px h-6 bg-border mx-1" />
            <Button variant="ghost" size="icon" onClick={handleClear} className="h-9 w-9 text-muted-foreground hover:text-primary"><Eraser className="h-4 w-4" /></Button>
          </div>
        </header>

        <div className="flex flex-1 flex-col p-4 gap-4 overflow-hidden bg-muted/10">
          <div className="grid grid-cols-2 gap-4 h-[40%] min-h-[250px]">
            <Card className="flex flex-col shadow-sm border border-border/50 rounded-xl overflow-hidden bg-card">
              <div className="py-2 px-4 shadow-sm border-b bg-muted/30 flex items-center justify-between shrink-0">
                <span className="text-[9px] font-black uppercase text-muted-foreground tracking-[0.2em] flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-slate-300" />
                  Original
                </span>
                <Button variant="ghost" size="icon" onClick={() => handleCopy(original, 'Original')} className="h-7 w-7 text-muted-foreground hover:text-primary transition-all">
                  <Copy className="h-3.5 w-3.5" />
                </Button>
              </div>
              <div className="flex-1 relative bg-[#1e1e1e]">
                <Editor
                  height="100%"
                  language={language}
                  theme="vs-dark"
                  value={original}
                  onChange={(val) => setOriginal(val || '')}
                  onMount={(editor) => { editorOriginalRef.current = editor; }}
                  options={{
                    minimap: { enabled: false },
                    fontSize: 11,
                    fontFamily: 'var(--font-jetbrains-mono), monospace',
                    automaticLayout: true,
                    padding: { top: 12, bottom: 12 },
                    scrollBeyondLastLine: false,
                  }}
                />
              </div>
            </Card>

            <Card className="flex flex-col shadow-sm border border-border/50 rounded-xl overflow-hidden bg-card">
              <div className="py-2 px-4 shadow-sm border-b bg-muted/30 flex items-center justify-between shrink-0">
                <span className="text-[9px] font-black uppercase text-muted-foreground tracking-[0.2em] flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-blue-400" />
                  Modificado
                </span>
                <Button variant="ghost" size="icon" onClick={() => handleCopy(modified, 'Modificado')} className="h-7 w-7 text-muted-foreground hover:text-primary transition-all">
                  <Copy className="h-3.5 w-3.5" />
                </Button>
              </div>
              <div className="flex-1 relative bg-[#1e1e1e]">
                <Editor
                  height="100%"
                  language={language}
                  theme="vs-dark"
                  value={modified}
                  onChange={(val) => setModified(val || '')}
                  onMount={(editor) => { editorModifiedRef.current = editor; }}
                  options={{
                    minimap: { enabled: false },
                    fontSize: 11,
                    fontFamily: 'var(--font-jetbrains-mono), monospace',
                    automaticLayout: true,
                    padding: { top: 12, bottom: 12 },
                    scrollBeyondLastLine: false,
                  }}
                />
              </div>
            </Card>
          </div>

          <Card className="flex-1 flex flex-col shadow-sm border border-primary/10 rounded-xl overflow-hidden bg-card">
            <div className="py-2 px-4 shadow-sm border-b bg-primary/5 flex items-center justify-between shrink-0">
              <span className="text-[9px] font-black uppercase text-primary tracking-[0.2em] flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-primary" />
                Comparação de Diferenças
              </span>
            </div>
            <div className="flex-1 relative bg-[#1e1e1e]">
              <DiffEditor
                height="100%"
                original={original}
                modified={modified}
                language={language}
                theme="vs-dark"
                onMount={(editor) => { diffEditorRef.current = editor; }}
                options={{
                  renderSideBySide: true,
                  readOnly: true,
                  minimap: { enabled: false },
                  fontSize: 11,
                  fontFamily: 'var(--font-jetbrains-mono), monospace',
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
