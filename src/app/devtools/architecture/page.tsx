'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Network,
  Download,
  Code2,
  Image as ImageIcon,
  Loader2,
  ZoomIn,
  ZoomOut,
  Maximize,
  AlertTriangle,
  Cloud,
  Copy,
  HelpCircle,
  FileCode,
  Layers
} from 'lucide-react';
import { Editor } from '@monaco-editor/react';
import { useToast } from '@/hooks/use-toast';
import { TooltipProvider } from '@/components/ui/tooltip';
import { Badge } from '@/components/ui/badge';
import mermaid from 'mermaid';
import { TransformWrapper, TransformComponent } from "react-zoom-pan-pinch";
import { useUserContext } from '@/context/UserContext';
import { LoadingScreen } from '@/components/layout/LoadingScreen';
import { cn } from '@/lib/utils';
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
import dynamic from 'next/dynamic';

import { AgileSpinner } from '@/components/ui/AgileSpinner';

const ExcalidrawRoom = dynamic(
  () => import('@/components/architecture/ExcalidrawRoom'),
  { ssr: false, loading: () => (
    <div className="w-full h-full flex flex-col items-center justify-center bg-card rounded-xl border border-border/50 shadow-sm text-muted-foreground gap-4">
      <AgileSpinner size="lg" />
      <span className="text-[10px] font-black uppercase tracking-[0.2em] animate-pulse">Carregando Whiteboard...</span>
    </div>
  )}
);

const DEFAULT_DIAGRAM = `sequenceDiagram
    participant Front as Espaço Ágil
    participant API as TOTVS/Winthor
    participant DB as Banco de Dados
    
    Front->>API: GET /vendas/tipos-cobrancas
    API->>DB: SELECT * FROM cobrancas
    DB-->>API: Result Set
    API-->>Front: JSON Response (Status 200)`;

export default function ArchitectureBoardPage() {
  const { toast } = useToast();
  const { userProfile, isInitializing: isUserInitializing } = useUserContext();
  const [code, setCode] = useState(DEFAULT_DIAGRAM);
  const [svg, setSvg] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isRendering, setIsRendering] = useState(false);
  const [isHydrated, setIsHydrated] = useState(false);
  const [activeMode, setActiveMode] = useState<'code' | 'visual'>('visual');
  const [exportVisual, setExportVisual] = useState<{ fn: () => void } | null>(null);
  const editorRef = React.useRef<any>(null);

  useEffect(() => {
    return () => {
      if (editorRef.current) {
        editorRef.current.dispose();
      }
    };
  }, []);

  useEffect(() => {
    setIsHydrated(true);
  }, []);


  const handleSave = (newCode: string) => {
    setCode(newCode);
    // Cloud Sync disabled
  };

  useEffect(() => {
    mermaid.initialize({
      startOnLoad: false,
      theme: 'base',
      themeVariables: {
        primaryColor: '#3b82f6',
        primaryTextColor: '#ffffff',
        primaryBorderColor: '#2563eb',
        lineColor: '#64748b',
        textColor: '#0f172a',
        edgeLabelBackground: '#ffffff',
        tertiaryColor: '#f1f5f9',
        fontFamily: 'inherit',
      }
    });
  }, []);

  useEffect(() => {
    const renderDiagram = async () => {
      if (!code.trim()) { setSvg(''); setError(null); return; }
      setIsRendering(true);
      try {
        const id = `mermaid-preview-${Math.random().toString(36).substr(2, 9)}`;
        const { svg: generatedSvg } = await mermaid.render(id, code);
        setSvg(generatedSvg);
        setError(null);
      } catch (e: any) {
        setError("Sintaxe de diagrama inválida.");
      } finally {
        setIsRendering(false);
      }
    };
    const timer = setTimeout(renderDiagram, 500);
    return () => clearTimeout(timer);
  }, [code]);

  const handleCopyCode = async (text: string) => {
    await navigator.clipboard.writeText(text);
    toast({ title: "Código copiado!" });
  };

  const handleSetExportVisual = useCallback((fn: () => void) => {
    setExportVisual({ fn });
  }, []);

  const handleDownloadSVG = () => {
    if (activeMode === 'visual' && exportVisual) {
       exportVisual.fn();
       return;
    }

    if (!svg) return;
    const blob = new Blob([svg], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'architecture_diagram.svg';
    a.click();
    URL.revokeObjectURL(url);
  };

  if (!isHydrated) {
    return <LoadingScreen message="Architecture Board" />;
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <TooltipProvider>
        <header className="flex items-center justify-between px-6 py-4 border-b bg-card shrink-0">
          <div className="flex items-center gap-3">
            <Network className="h-5 w-5 text-primary" />
            <div className="flex flex-col">
              <h1 className="text-lg font-bold leading-none">Quadro de Design e Arquitetura</h1>
              <p className="text-[10px] text-muted-foreground font-medium mt-1 uppercase tracking-widest">MODELAGEM TÉCNICA DECLARATIVA</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
             <div className="hidden sm:flex bg-muted/30 p-1 rounded-full border border-border/50">
               <Button 
                variant={activeMode === 'visual' ? 'default' : 'ghost'} 
                size="sm" 
                onClick={() => setActiveMode('visual')}
                className={cn("h-7 px-4 rounded-full text-[10px] font-black tracking-widest uppercase transition-all", activeMode === 'visual' ? 'shadow-sm' : 'text-muted-foreground')}
               >
                 VISUAL
               </Button>
               <Button 
                variant={activeMode === 'code' ? 'default' : 'ghost'} 
                size="sm" 
                onClick={() => setActiveMode('code')}
                className={cn("h-7 px-4 rounded-full text-[10px] font-black tracking-widest uppercase transition-all", activeMode === 'code' ? 'shadow-sm' : 'text-muted-foreground')}
               >
                 CÓDIGO
               </Button>
             </div>

            {/* Cloud Sync indicator removed */}            <Sheet>
              <SheetTrigger asChild>
                <Button variant="ghost" size="sm" className="h-10 px-4 font-black text-[9px] uppercase tracking-widest gap-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-all rounded-xl">
                  <HelpCircle className="h-4 w-4" />
                  GUIA
                </Button>
              </SheetTrigger>
              <SheetContent className="sm:max-w-2xl overflow-hidden flex flex-col p-0 border-none shadow-2xl">
                <SheetHeader className="shrink-0 border-b p-8 bg-white">
                  <div className="w-12 h-12 bg-blue-600 rounded-2xl flex items-center justify-center shadow-lg shadow-blue-500/30 mb-4">
                    <Network className="h-6 w-6 text-white" />
                  </div>
                  <SheetTitle className="text-3xl font-black uppercase tracking-tighter italic text-slate-800">
                    Design e Arquitetura
                  </SheetTitle>
                  <SheetDescription className="text-slate-500 font-bold text-xs uppercase tracking-widest mt-2 leading-relaxed">
                    Modelagem técnica declarativa e canvas de desenho livre
                  </SheetDescription>
                </SheetHeader>
                <ScrollArea className="flex-1 text-slate-600">
                  <div className="p-8 space-y-10">
                    <div className="space-y-4">
                      <h3 className="font-black text-xs uppercase tracking-[0.2em] text-blue-600 flex items-center gap-2 italic">
                        01. Dois Mundos, Uma Ferramenta
                      </h3>
                      <p className="text-sm text-slate-500 font-medium leading-relaxed">
                        O Architecture Board oferece flexibilidade total: use o modo <strong>VISUAL</strong> para rascunhos rápidos e desenhos livres (estilo whiteboard) ou o modo <strong>CÓDIGO</strong> para diagramas estruturados e versionáveis usando a sintaxe Mermaid.js.
                      </p>
                    </div>

                    <div className="space-y-4">
                      <h3 className="font-black text-xs uppercase tracking-[0.2em] text-blue-600 flex items-center gap-2 italic">
                        02. Exemplos Mermaid (Modo Código)
                      </h3>
                      <p className="text-xs text-slate-400 font-bold mb-4">Copie e cole os blocos abaixo para começar seu diagrama:</p>
                      
                      <div className="space-y-6">
                        <div className="space-y-2">
                          <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Fluxograma de Decisão</p>
                          <div className="bg-slate-900 p-4 rounded-xl font-mono text-[11px] text-blue-400 shadow-inner">
                            {`graph TD\n  A[Start] --> B{Is Valid?}\n  B -- Yes --> C[Process]\n  B -- No --> D[Error]`}
                          </div>
                        </div>

                        <div className="space-y-2">
                          <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Sequência de API</p>
                          <div className="bg-slate-900 p-4 rounded-xl font-mono text-[11px] text-emerald-400 shadow-inner">
                            {`sequenceDiagram\n  Client->>Server: Request\n  Server-->>DB: Query\n  DB-->>Server: Result\n  Server-->>Client: 200 OK`}
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-4">
                      <h3 className="font-black text-xs uppercase tracking-[0.2em] text-blue-600 flex items-center gap-2 italic">
                        03. Exportação e Qualidade
                      </h3>
                      <p className="text-sm text-slate-500 font-medium leading-relaxed">
                        Sempre exporte seus desenhos em formato <strong>SVG</strong>. Por ser um formato vetorial, você pode redimensionar a imagem infinitamente em suas apresentações ou documentações (Confluence/Notion) sem perder a nitidez.
                      </p>
                    </div>

                    <div className="space-y-4 p-6 bg-blue-50/50 rounded-[2rem] border border-blue-100">
                      <h3 className="font-black text-xs uppercase tracking-[0.2em] text-blue-600 flex items-center gap-2 italic">
                        Salvamento Automático Local
                      </h3>
                      <p className="text-[11px] text-blue-800/80 font-bold leading-relaxed">
                        No modo **VISUAL** (Excalidraw), seus desenhos são salvos automaticamente neste navegador e podem ser exportados em alta definição. O estilo "sketch" facilita a prototipagem rápida de ideias sem a rigidez de ferramentas tradicionais.
                      </p>
                    </div>
                  </div>
                </ScrollArea>
              </SheetContent>
            </Sheet>

            {userProfile && (
              <div className="flex items-center gap-2 bg-primary/5 px-3 py-1 rounded-full border border-primary/10">
                <span className="text-[10px] font-bold text-foreground">{userProfile.name}</span>
                <Badge variant="secondary" className="h-5 px-1.5 text-[8px] font-black uppercase bg-primary/10 text-primary border-none">
                  {userProfile.role}
                </Badge>
              </div>
            )}
            <div className="w-px h-6 bg-border mx-1" />
            <Button onClick={handleDownloadSVG} disabled={activeMode === 'code' && !svg} className="font-bold gap-2 h-9 px-4 text-xs">
              <Download className="h-4 w-4" />
              EXPORTAR SVG
            </Button>
          </div>
        </header>

        {activeMode === 'code' ? (
          <div className="flex flex-1 p-4 gap-4 overflow-hidden bg-muted/10 w-full">
            <Card className="flex-1 flex flex-col shadow-sm border border-border/50 rounded-xl overflow-hidden bg-card">
              <div className="py-2 px-4 border-b bg-muted/30 flex items-center justify-between shrink-0">
                <h3 className="text-[10px] font-black uppercase text-muted-foreground flex items-center gap-2 tracking-widest">
                  <Code2 className="h-3.5 w-3.5" />
                  Mermaid Code
                </h3>
                <Button variant="ghost" size="icon" onClick={() => handleCopyCode(code)} className="h-7 w-7 text-muted-foreground hover:text-primary">
                  <Copy className="h-3.5 w-3.5" />
                </Button>
              </div>
              <div className="flex-1 relative">
                <Editor
                  height="100%"
                  language="markdown"
                  theme="vs-dark"
                  value={code}
                  onMount={(editor) => { editorRef.current = editor; }}
                  onChange={(val) => handleSave(val || '')}
                  options={{ minimap: { enabled: false }, fontSize: 13, wordWrap: 'on', automaticLayout: true }}
                />
              </div>
            </Card>

            <Card className="flex-1 flex flex-col shadow-sm border border-border/50 rounded-xl overflow-hidden bg-card">
              <div className="py-2 px-4 border-b bg-muted/30 flex items-center justify-between shrink-0">
                <h3 className="text-[10px] font-black uppercase text-muted-foreground flex items-center gap-2 tracking-widest">
                  <ImageIcon className="h-3.5 w-3.5" />
                  Visualização
                </h3>
                {error && <Badge variant="destructive" className="h-5 px-2 text-[9px] font-black uppercase">{error}</Badge>}
              </div>
              <div className="flex-1 relative bg-white overflow-hidden group">
                {svg ? (
                  <TransformWrapper initialScale={1} minScale={0.1} maxScale={5} centerOnInit={true}>
                    {({ zoomIn, zoomOut, resetTransform }) => (
                      <>
                        <div className="absolute bottom-4 right-4 z-10 flex gap-1 bg-background/80 backdrop-blur-sm p-1 rounded-lg border border-border shadow-md opacity-0 group-hover:opacity-100 transition-opacity">
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => zoomOut()}><ZoomOut className="h-4 w-4" /></Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => resetTransform()}><Maximize className="h-4 w-4" /></Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => zoomIn()}><ZoomIn className="h-4 w-4" /></Button>
                        </div>
                        <TransformComponent wrapperClass="!w-full !h-full" contentClass="w-full h-full flex items-center justify-center p-8">
                          <div dangerouslySetInnerHTML={{ __html: svg }} />
                        </TransformComponent>
                      </>
                    )}
                  </TransformWrapper>
                ) : (
                  <div className="flex-1 flex items-center justify-center h-full opacity-20"><Network className="h-16 w-16" /></div>
                )}
              </div>
            </Card>
          </div>
        ) : (
          <div className="flex-1 p-3 overflow-hidden bg-muted/10 w-full flex flex-col min-h-0">
            <div className="flex-1 w-full h-full min-h-[500px] relative">
              <ExcalidrawRoom onExportReady={handleSetExportVisual} />
            </div>
          </div>
        )}
      </TooltipProvider>
    </div>
  );
}