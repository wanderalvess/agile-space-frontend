'use client';

import { useState } from 'react';
import { Eraser } from 'lucide-react';
import { DiffEditor, Editor } from '@monaco-editor/react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DevToolPage } from '@/components/devtools/DevToolPage';
import { useTheme } from '@/context/ThemeContext';

const LANGUAGES = [
  { value: 'json', label: 'JSON' },
  { value: 'xml', label: 'XML' },
  { value: 'plaintext', label: 'Texto puro' },
];

const EDITOR_OPTIONS = {
  minimap: { enabled: false },
  fontSize: 12,
  fontFamily: 'var(--font-jetbrains-mono), monospace',
  automaticLayout: true,
  padding: { top: 10, bottom: 10 },
  scrollBeyondLastLine: false,
} as const;

// Moldura de painel com título; o conteúdo (Monaco) preenche o resto.
function Frame({ title, accent, children, className }: { title: string; accent?: boolean; children: React.ReactNode; className?: string }) {
  return (
    <section className={`flex min-h-0 flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-sm ${className ?? ''}`}>
      <header className="flex shrink-0 items-center gap-2 border-b border-border/60 px-3 py-2">
        <span className={`h-2 w-2 rounded-full ${accent ? 'bg-primary' : 'bg-muted-foreground/50'}`} />
        <h2 className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">{title}</h2>
      </header>
      <div className="min-h-0 flex-1">{children}</div>
    </section>
  );
}

export default function DiffPage() {
  const { resolvedMode } = useTheme();
  const monacoTheme = resolvedMode === 'dark' ? 'vs-dark' : 'vs';
  const [language, setLanguage] = useState('json');
  const [original, setOriginal] = useState('');
  const [modified, setModified] = useState('');

  return (
    <DevToolPage
      toolId="diff"
      actions={
        <div className="flex items-center gap-2">
          <Select value={language} onValueChange={setLanguage}>
            <SelectTrigger className="h-8 w-[120px] rounded-xl text-[11px] font-bold" aria-label="Linguagem">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {LANGUAGES.map(l => (
                <SelectItem key={l.value} value={l.value} className="text-xs">{l.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            variant="outline"
            size="sm"
            onClick={() => { setOriginal(''); setModified(''); }}
            disabled={!original && !modified}
            className="h-8 gap-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider"
          >
            <Eraser className="h-3.5 w-3.5" /> <span className="hidden sm:inline">Limpar</span>
          </Button>
        </div>
      }
    >
      <div className="grid h-full grid-cols-1 grid-rows-[2fr_3fr] gap-3 md:gap-4">
        <div className="grid min-h-0 grid-cols-1 gap-3 md:grid-cols-2 md:gap-4">
          <Frame title="Original">
            <Editor height="100%" language={language} theme={monacoTheme} value={original} onChange={v => setOriginal(v ?? '')} options={EDITOR_OPTIONS} />
          </Frame>
          <Frame title="Modificado">
            <Editor height="100%" language={language} theme={monacoTheme} value={modified} onChange={v => setModified(v ?? '')} options={EDITOR_OPTIONS} />
          </Frame>
        </div>
        <Frame title="Diferenças" accent>
          {/* O DiffEditor é somente leitura: as edições acontecem nos painéis acima */}
          <DiffEditor
            height="100%"
            original={original}
            modified={modified}
            language={language}
            theme={monacoTheme}
            options={{ ...EDITOR_OPTIONS, renderSideBySide: true, readOnly: true }}
          />
        </Frame>
      </div>
    </DevToolPage>
  );
}
