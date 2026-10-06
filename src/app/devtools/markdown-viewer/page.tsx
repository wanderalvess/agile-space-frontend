'use client';

import { useRef, useState } from 'react';
import { Upload, Wand2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { DevToolPage } from '@/components/devtools/DevToolPage';
import { ToolPane } from '@/components/devtools/ToolPane';
import { MarkdownRenderer } from '@/components/shared/MarkdownRenderer';

const SAMPLE = `# Título de exemplo

Cole ou solte um arquivo \`.md\` aqui para ver a formatação lado a lado.

- Suporta **negrito**, *itálico* e \`código\`
- [ ] Checklists e tabelas (GFM)
- [Links](https://example.com)

| Coluna A | Coluna B |
| --- | --- |
| 1 | 2 |
`;

const btn = 'h-8 gap-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider';

export default function MarkdownViewerPage() {
  const [content, setContent] = useState('');
  const [fileName, setFileName] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const loadFile = async (file: File) => {
    setContent(await file.text());
    setFileName(file.name);
  };

  return (
    <DevToolPage
      toolId="markdown-viewer"
      actions={
        <>
          <input
            ref={fileRef}
            type="file"
            accept=".md,.markdown,text/markdown"
            className="hidden"
            onChange={e => {
              const f = e.target.files?.[0];
              if (f) void loadFile(f);
              e.target.value = '';
            }}
          />
          <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()} className={btn}>
            <Upload className="h-3.5 w-3.5" /> <span className="hidden sm:inline">Abrir .md</span>
          </Button>
          <Button variant="outline" size="sm" onClick={() => { setContent(SAMPLE); setFileName(null); }} className={btn}>
            <Wand2 className="h-3.5 w-3.5" /> <span className="hidden sm:inline">Exemplo</span>
          </Button>
        </>
      }
    >
      {/* soltar um .md em qualquer ponto do corpo carrega o arquivo */}
      <div
        className="grid h-full grid-cols-1 gap-3 md:grid-cols-2 md:gap-4"
        onDragOver={e => e.preventDefault()}
        onDrop={e => {
          e.preventDefault();
          const f = e.dataTransfer.files?.[0];
          if (f) void loadFile(f);
        }}
      >
        <ToolPane
          title={fileName ? `Markdown · ${fileName}` : 'Markdown'}
          value={content}
          onChange={v => { setContent(v); if (!v) setFileName(null); }}
          placeholder="Cole o Markdown aqui ou arraste um arquivo .md…"
          downloadName={fileName ?? 'documento.md'}
          footer={`${content.length} caracteres`}
        />
        <section className="flex min-h-0 flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
          <header className="shrink-0 border-b border-border/60 px-3 py-2">
            <h2 className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Pré-visualização</h2>
          </header>
          <div className="min-h-0 flex-1 overflow-auto p-4">
            {content.trim() ? <MarkdownRenderer content={content} /> : <p className="text-sm text-muted-foreground">A prévia aparece aqui.</p>}
          </div>
        </section>
      </div>
    </DevToolPage>
  );
}
