'use client';

import React, { useCallback, useEffect, useRef } from 'react';
import Editor, { type Monaco, type OnMount } from '@monaco-editor/react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { MONACO_THEME_NAME, monacoThemeFromTokens, readDocumentToken } from '@/lib/jolt-editor-theme';

/** Define (ou redefine) o tema do Monaco com os tokens do tema ativo do portal. */
function applyPortalTheme(monaco: Monaco) {
  const dark = document.documentElement.classList.contains('dark');
  try {
    monaco.editor.defineTheme(MONACO_THEME_NAME, monacoThemeFromTokens(readDocumentToken, dark));
    monaco.editor.setTheme(MONACO_THEME_NAME);
  } catch {
    monaco.editor.setTheme(dark ? 'vs-dark' : 'vs');
  }
}

/** Botão de texto do cabeçalho do painel (Colar, Formatar, Copiar...). */
export function PaneButton({ className, ...props }: React.ComponentProps<typeof Button>) {
  return <Button type="button" variant="outline" size="xs" className={cn('h-8 rounded-lg px-2.5 text-[13px] font-semibold', className)} {...props} />;
}

export interface JsonEditorProps {
  title: string;
  subtitle?: string;
  /** Selo ao lado do título (ex.: tempo da execução). */
  titleExtra?: React.ReactNode;
  value: string;
  onChange?: (value: string) => void;
  readOnly?: boolean;
  /** Botões do cabeçalho (use PaneButton). */
  actions?: React.ReactNode;
  /** Faixa abaixo do editor: erro de sintaxe, "JSON válido"... */
  footer?: React.ReactNode;
  /** Cobre o editor (ainda não executou, executando, erro...). */
  overlay?: React.ReactNode;
  onMount?: OnMount;
  /** Ctrl+Enter e Ctrl+S com o cursor dentro do editor (o Monaco usaria Ctrl+Enter para quebrar linha). */
  onRun?: () => void;
  onSave?: () => void;
  className?: string;
  /** Altura do painel. */
  heightClassName?: string;
}

/**
 * Painel de JSON do Jolt: moldura (título, ações, rodapé) em volta do Monaco. O editor segue os tokens do tema,
 * usa fonte de 13 px e liga Ctrl+Enter / Ctrl+S como a página inteira.
 */
export function JsonEditor({
  title, subtitle, titleExtra, value, onChange, readOnly = false, actions, footer, overlay, onMount, onRun, onSave, className,
  heightClassName = 'h-[640px] max-h-[80vh]',
}: JsonEditorProps) {
  const monacoRef = useRef<Monaco | null>(null);
  const runRef = useRef(onRun);
  const saveRef = useRef(onSave);
  useEffect(() => {
    runRef.current = onRun;
    saveRef.current = onSave;
  });

  // Trocar o tema do portal (claro/escuro/variante) muda as classes do <html>: o editor reaplica as cores.
  useEffect(() => {
    const observer = new MutationObserver(() => {
      if (monacoRef.current) applyPortalTheme(monacoRef.current);
    });
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class', 'style'] });
    return () => observer.disconnect();
  }, []);

  const handleMount = useCallback<OnMount>(
    (editor, monaco, ...rest) => {
      monacoRef.current = monaco;
      editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter, () => runRef.current?.());
      editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => saveRef.current?.());
      onMount?.(editor, monaco, ...rest);
    },
    [onMount],
  );

  return (
    <section
      aria-label={title}
      className={cn('flex min-w-0 flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-sm', heightClassName, className)}
    >
      <header className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-b border-border px-4 py-2.5">
        <div className="flex min-w-0 flex-col">
          <span className="flex min-w-0 items-center gap-2">
            <h2 className="truncate text-[15px] font-bold leading-tight text-foreground">{title}</h2>
            {titleExtra}
          </span>
          {subtitle && <span className="truncate text-xs text-muted-foreground">{subtitle}</span>}
        </div>
        {actions && <div className="flex shrink-0 flex-wrap items-center gap-1.5">{actions}</div>}
      </header>

      <div className="relative min-h-0 flex-1 bg-background">
        <Editor
          height="100%"
          language="json"
          theme={MONACO_THEME_NAME}
          value={value}
          onChange={(next) => onChange?.(next ?? '')}
          beforeMount={(monaco) => {
            monacoRef.current = monaco;
            applyPortalTheme(monaco);
          }}
          onMount={handleMount}
          loading={<span className="text-sm text-muted-foreground">Carregando o editor…</span>}
          options={{
            ariaLabel: title,
            minimap: { enabled: false },
            fontSize: 13,
            lineHeight: 22,
            fontFamily: 'var(--font-jetbrains-mono), ui-monospace, Menlo, Consolas, monospace',
            fontLigatures: false,
            tabSize: 2,
            wordWrap: 'on',
            automaticLayout: true,
            readOnly,
            scrollBeyondLastLine: false,
            lineNumbersMinChars: 3,
            padding: { top: 10, bottom: 10 },
            renderLineHighlight: readOnly ? 'none' : 'line',
            smoothScrolling: true,
            cursorBlinking: 'smooth',
          }}
        />
        {overlay && <div className="absolute inset-0 z-10 flex flex-col bg-background">{overlay}</div>}
      </div>

      {footer}
    </section>
  );
}

/** Faixa de erro de sintaxe abaixo do editor (com o botão de corrigir quando há correção). */
export function SyntaxErrorStrip({ text, onFix }: { text: string; onFix?: () => void }) {
  return (
    <div
      role="alert"
      className="flex shrink-0 items-start gap-2.5 border-t border-red-500/40 bg-red-500/10 px-4 py-2.5 text-[13px] leading-snug text-red-800 dark:text-red-300"
    >
      <span className="flex-1">{text}</span>
      {onFix && (
        <PaneButton onClick={onFix} className="shrink-0">
          Corrigir
        </PaneButton>
      )}
    </div>
  );
}
