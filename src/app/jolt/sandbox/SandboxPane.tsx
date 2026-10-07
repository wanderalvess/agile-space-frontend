'use client';

import React, { useEffect, useState } from 'react';
import Editor from '@monaco-editor/react';
import { ClipboardPaste, Copy, Trash2, Wand2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface SandboxPaneProps {
  title: string;
  value: string;
  onChange?: (val: string) => void;
  onPaste?: () => void;
  onFormat?: () => void;
  onCopy: () => void;
  onClear?: () => void;
  readOnly?: boolean;
  onMount?: (editor: any, monaco: any) => void;
  /** Ações extras no cabeçalho do painel (snippets, estatísticas de execução). */
  toolbar?: React.ReactNode;
  /** Info curta no rodapé. */
  footer?: React.ReactNode;
  /** Mensagem de erro no rodapé. */
  error?: string | null;
  /** Cor do indicador ao lado do título (classe bg-*). */
  dotClass?: string;
  className?: string;
}

// Moldura no padrão ToolPane (borda, cabeçalho com ações, rodapé), mantendo o Monaco como editor.
export function SandboxPane({
  title, value, onChange, onPaste, onFormat, onCopy, onClear, readOnly = false, onMount,
  toolbar, footer, error, dotClass = 'bg-muted-foreground', className,
}: SandboxPaneProps) {
  const [isDark, setIsDark] = useState(true);

  useEffect(() => {
    setIsDark(document.documentElement.classList.contains('dark'));
    const observer = new MutationObserver(() => {
      setIsDark(document.documentElement.classList.contains('dark'));
    });
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    return () => observer.disconnect();
  }, []);

  const iconBtn = 'h-7 w-7 rounded-lg text-muted-foreground hover:text-foreground';

  return (
    <section className={cn('flex min-h-[260px] min-w-0 flex-1 flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-sm lg:min-h-0', className)}>
      <header className="flex shrink-0 items-center justify-between gap-2 border-b border-border/60 px-3 py-2">
        <h2 className="flex min-w-0 items-center gap-2 text-[10px] font-black uppercase tracking-widest text-muted-foreground">
          <span className={cn('h-2 w-2 shrink-0 rounded-full', dotClass)} aria-hidden />
          <span className="truncate">{title}</span>
        </h2>
        <div className="flex shrink-0 items-center gap-1">
          {toolbar}
          {onPaste && !readOnly && (
            <Button type="button" variant="ghost" size="icon" className={iconBtn} onClick={onPaste} title="Colar" aria-label={`Colar em ${title}`}>
              <ClipboardPaste className="h-3.5 w-3.5" />
            </Button>
          )}
          {onFormat && !readOnly && (
            <Button type="button" variant="ghost" size="icon" className={iconBtn} onClick={onFormat} title="Formatar / identar" aria-label={`Formatar ${title}`}>
              <Wand2 className="h-3.5 w-3.5" />
            </Button>
          )}
          {onClear && (
            <Button type="button" variant="ghost" size="icon" className={iconBtn} onClick={onClear} disabled={!value} title="Limpar" aria-label={`Limpar ${title}`}>
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          )}
          <Button type="button" variant="ghost" size="icon" className={iconBtn} onClick={onCopy} disabled={!value} title="Copiar" aria-label={`Copiar ${title}`}>
            <Copy className="h-3.5 w-3.5" />
          </Button>
        </div>
      </header>

      <div className="relative min-h-0 flex-1 bg-background">
        <Editor
          height="100%"
          language="json"
          theme={isDark ? 'vs-dark' : 'vs'}
          value={value}
          onChange={(val) => onChange && onChange(val || '')}
          onMount={onMount}
          options={{
            minimap: { enabled: false },
            fontSize: 11,
            fontFamily: 'var(--font-jetbrains-mono), monospace',
            fontLigatures: false,
            wordWrap: 'on',
            automaticLayout: true,
            readOnly,
            scrollBeyondLastLine: false,
            lineNumbersMinChars: 3,
            padding: { top: 12, bottom: 12 },
            cursorBlinking: 'smooth',
            smoothScrolling: true,
            renderLineHighlight: readOnly ? 'none' : 'all',
          }}
        />
      </div>

      {(error || footer) && (
        <footer className={cn('shrink-0 border-t px-3 py-1.5 text-[11px] font-semibold', error ? 'border-destructive/30 bg-destructive/5 text-destructive' : 'border-border/60 text-muted-foreground')}>
          {error ?? footer}
        </footer>
      )}
    </section>
  );
}
