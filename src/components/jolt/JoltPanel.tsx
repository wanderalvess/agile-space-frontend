'use client';

import React, { useState, useEffect } from 'react';
import Editor from '@monaco-editor/react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';
import { ClipboardPaste, Wand2, Copy, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface JoltPanelProps {
  title: string;
  value: string;
  onChange?: (val: string) => void;
  onPaste: () => void;
  onFormat?: () => void;
  onCopy: () => void;
  onClear?: () => void;
  language?: string;
  readOnly?: boolean;
  onMount?: (editor: any, monaco: any) => void;
  actions?: React.ReactNode;
  dotColor?: string;
  pulse?: boolean;
  pasteTooltip?: string;
  formatTooltip?: string;
  copyTooltip?: string;
  clearTooltip?: string;
}

export function JoltPanel({
  title,
  value,
  onChange,
  onPaste,
  onFormat,
  onCopy,
  onClear,
  language = 'json',
  readOnly = false,
  onMount,
  actions,
  dotColor = 'bg-muted-foreground',
  pulse = false,
  pasteTooltip = 'Colar conteúdo',
  formatTooltip = 'Formatar / Identar',
  copyTooltip = 'Copiar conteúdo',
  clearTooltip = 'Limpar',
}: JoltPanelProps) {
  const [isDark, setIsDark] = useState(true);

  useEffect(() => {
    setIsDark(document.documentElement.classList.contains('dark'));
    const observer = new MutationObserver(() => {
      setIsDark(document.documentElement.classList.contains('dark'));
    });
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    return () => observer.disconnect();
  }, []);

  return (
    <Card className="flex-1 flex flex-col rounded-2xl border-border shadow-xl overflow-hidden bg-muted">
      <div className="py-2.5 px-4 bg-card border-b border-border flex items-center justify-between shrink-0">
        <span className="text-xs font-bold uppercase text-muted-foreground tracking-[0.2em] flex items-center gap-2">
          <div className={cn("w-2 h-2 rounded-full", dotColor, pulse && "animate-pulse")} />
          {title}
        </span>
        <div className="flex items-center gap-1">
          {actions}

          {onPaste && !readOnly && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button 
                  variant="ghost" 
                  size="icon" 
                  onClick={onPaste} 
                  className="h-7 w-7 text-muted-foreground hover:text-blue-500 dark:hover:text-blue-400 hover:bg-muted transition-all rounded-lg"
                >
                  <ClipboardPaste className="h-3.5 w-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent className="bg-card border-border text-xs text-foreground">
                {pasteTooltip}
              </TooltipContent>
            </Tooltip>
          )}

          {onFormat && !readOnly && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button 
                  variant="ghost" 
                  size="icon" 
                  onClick={onFormat} 
                  className="h-7 w-7 text-muted-foreground hover:text-blue-500 dark:hover:text-blue-400 hover:bg-muted transition-all rounded-lg"
                >
                  <Wand2 className="h-3.5 w-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent className="bg-card border-border text-xs text-foreground">
                {formatTooltip}
              </TooltipContent>
            </Tooltip>
          )}

          {onClear && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button 
                  variant="ghost" 
                  size="icon" 
                  onClick={onClear} 
                  className="h-7 w-7 text-muted-foreground hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition-all rounded-lg"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent className="bg-card border-border text-xs text-foreground">
                {clearTooltip}
              </TooltipContent>
            </Tooltip>
          )}

          {onCopy && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button 
                  variant="ghost" 
                  size="icon" 
                  onClick={onCopy} 
                  className={cn(
                    "h-7 w-7 text-muted-foreground transition-all rounded-lg",
                    readOnly ? "hover:text-emerald-500 dark:hover:text-emerald-400 hover:bg-muted" : "hover:text-blue-500 dark:hover:text-blue-400 hover:bg-muted"
                  )}
                >
                  <Copy className="h-3.5 w-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent className="bg-card border-border text-xs text-foreground">
                {copyTooltip}
              </TooltipContent>
            </Tooltip>
          )}
        </div>
      </div>
      <div className="flex-1 min-h-0 relative bg-muted dark:bg-[#1e1e1e]">
        <Editor
          height="100%"
          language={language}
          theme={isDark ? "vs-dark" : "vs"}
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
            readOnly: readOnly,
            scrollBeyondLastLine: false,
            lineNumbersMinChars: 3,
            padding: { top: 12, bottom: 12 },
            cursorBlinking: 'smooth',
            smoothScrolling: true,
            renderLineHighlight: readOnly ? 'none' : 'all',
          }}
        />
      </div>
    </Card>
  );
}
