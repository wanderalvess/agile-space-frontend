'use client';

import React, { useRef, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { FileText, Upload, Copy, Eraser, Download } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { MarkdownRenderer } from '@/components/shared/MarkdownRenderer';

const SAMPLE = `# Título de exemplo

Cole ou solte um arquivo \`.md\` aqui pra ver a formatação lado a lado.

- Suporta **negrito**, *itálico* e \`código\`
- Tabelas e checklists (GFM)
- [Links](https://example.com)

| Coluna A | Coluna B |
| --- | --- |
| 1 | 2 |
`;

export default function MarkdownViewerPage() {
  const { toast } = useToast();
  const [content, setContent] = useState(SAMPLE);
  const [fileName, setFileName] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFile = async (file: File) => {
    const text = await file.text();
    setContent(text);
    setFileName(file.name);
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
    e.target.value = '';
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file) handleFile(file);
  };

  const handleCopy = async () => {
    if (!content) return;
    await navigator.clipboard.writeText(content);
    toast({ title: 'Copiado!', description: 'Markdown cru copiado.' });
  };

  const handleDownload = () => {
    const blob = new Blob([content], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName || 'documento.md';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleClear = () => {
    setContent('');
    setFileName(null);
    toast({ title: 'Limpo!' });
  };

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <header className="flex items-center justify-between px-6 py-4 border-b bg-card shrink-0">
        <div className="flex items-center gap-3">
          <FileText className="h-5 w-5 text-primary" />
          <div className="flex flex-col">
            <h1 className="text-lg font-bold leading-none">Visualizador de Markdown</h1>
            <p className="text-[10px] text-muted-foreground font-medium mt-1 uppercase tracking-widest">
              {fileName || 'Leitura formatada de arquivos .md'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <input ref={fileInputRef} type="file" accept=".md,.markdown,text/markdown" className="hidden" onChange={handleFileInput} />
          <Button variant="outline" size="sm" className="gap-2" onClick={() => fileInputRef.current?.click()}>
            <Upload className="h-4 w-4" /> Abrir .md
          </Button>
          <Button variant="ghost" size="icon" onClick={handleCopy} title="Copiar cru" className="h-9 w-9 text-muted-foreground hover:text-primary">
            <Copy className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" onClick={handleDownload} title="Baixar .md" className="h-9 w-9 text-muted-foreground hover:text-primary">
            <Download className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" onClick={handleClear} title="Limpar" className="h-9 w-9 text-muted-foreground hover:text-primary">
            <Eraser className="h-4 w-4" />
          </Button>
        </div>
      </header>

      <div
        className="grid flex-1 grid-cols-1 lg:grid-cols-2 gap-4 p-4 overflow-hidden bg-muted/10"
        onDragOver={(e) => e.preventDefault()}
        onDrop={handleDrop}
      >
        <Card className="flex flex-col overflow-hidden">
          <div className="py-2 px-4 border-b bg-muted/30 shrink-0">
            <span className="text-[9px] font-black uppercase text-muted-foreground tracking-[0.2em]">Markdown (cru)</span>
          </div>
          <Textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Cole seu markdown aqui, ou arraste um arquivo .md..."
            className="flex-1 resize-none rounded-none border-none font-code text-[13px] leading-relaxed focus-visible:ring-0"
          />
        </Card>

        <Card className="flex flex-col overflow-hidden">
          <div className="py-2 px-4 border-b bg-muted/30 shrink-0">
            <span className="text-[9px] font-black uppercase text-muted-foreground tracking-[0.2em]">Pré-visualização</span>
          </div>
          <div className="flex-1 overflow-auto p-6">
            {content.trim() ? (
              <MarkdownRenderer content={content} />
            ) : (
              <p className="text-sm text-muted-foreground">Nada pra mostrar ainda.</p>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}
