'use client';

import React from 'react';
import { Check, ClipboardPaste, Copy, Download, Eraser } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

interface ToolPaneProps {
  title: string;
  value: string;
  onChange?: (value: string) => void;
  readOnly?: boolean;
  placeholder?: string;
  /** Ações extras no topo do painel (ex.: seletor de modo). */
  toolbar?: React.ReactNode;
  /** Nome do arquivo ao baixar; sem isso o botão de download some. */
  downloadName?: string;
  /** Mostra colar/limpar (entrada). Saídas só têm copiar/baixar. */
  editable?: boolean;
  /** Mensagem de erro exibida no rodapé do painel. */
  error?: string | null;
  /** Info curta no rodapé (ex.: "128 caracteres"). */
  footer?: React.ReactNode;
  className?: string;
}

// Painel padrão de entrada/saída das ferramentas: cabeçalho com ações, área monoespaçada
// que rola sozinha e rodapé de erro/estatística.
export function ToolPane({
  title, value, onChange, readOnly, placeholder, toolbar, downloadName, editable = !readOnly, error, footer, className,
}: ToolPaneProps) {
  const { toast } = useToast();
  const [copied, setCopied] = React.useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1400);
    } catch {
      toast({ title: 'Não foi possível copiar', description: 'O navegador bloqueou o acesso à área de transferência.', variant: 'destructive' });
    }
  };

  const paste = async () => {
    try {
      onChange?.(await navigator.clipboard.readText());
    } catch {
      toast({ title: 'Não foi possível colar', description: 'Permita o acesso à área de transferência ou cole com Ctrl+V.', variant: 'destructive' });
    }
  };

  const download = () => {
    const url = URL.createObjectURL(new Blob([value], { type: 'text/plain;charset=utf-8' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = downloadName ?? 'resultado.txt';
    a.click();
    URL.revokeObjectURL(url);
  };

  const iconBtn = 'h-7 w-7 rounded-lg text-muted-foreground hover:text-foreground';

  return (
    <section className={cn('flex min-h-0 flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-sm', className)}>
      <header className="flex shrink-0 items-center justify-between gap-2 border-b border-border/60 px-3 py-2">
        <h2 className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">{title}</h2>
        <div className="flex items-center gap-1">
          {toolbar}
          {editable && (
            <>
              <Button type="button" variant="ghost" size="icon" className={iconBtn} onClick={paste} title="Colar" aria-label="Colar">
                <ClipboardPaste className="h-3.5 w-3.5" />
              </Button>
              <Button type="button" variant="ghost" size="icon" className={iconBtn} onClick={() => onChange?.('')} disabled={!value} title="Limpar" aria-label="Limpar">
                <Eraser className="h-3.5 w-3.5" />
              </Button>
            </>
          )}
          {downloadName && (
            <Button type="button" variant="ghost" size="icon" className={iconBtn} onClick={download} disabled={!value} title="Baixar" aria-label="Baixar">
              <Download className="h-3.5 w-3.5" />
            </Button>
          )}
          <Button type="button" variant="ghost" size="icon" className={iconBtn} onClick={copy} disabled={!value} title="Copiar" aria-label="Copiar">
            {copied ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
          </Button>
        </div>
      </header>

      <Textarea
        value={value}
        onChange={e => onChange?.(e.target.value)}
        readOnly={readOnly}
        placeholder={placeholder}
        spellCheck={false}
        aria-label={title}
        className="min-h-0 flex-1 resize-none rounded-none border-0 bg-transparent p-3 font-code text-[13px] leading-relaxed shadow-none focus-visible:ring-0"
      />

      {(error || footer) && (
        <footer className={cn('shrink-0 border-t px-3 py-1.5 text-[11px] font-semibold', error ? 'border-destructive/30 bg-destructive/5 text-destructive' : 'border-border/60 text-muted-foreground')}>
          {error ?? footer}
        </footer>
      )}
    </section>
  );
}
