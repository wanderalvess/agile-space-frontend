'use client';

import React from 'react';
import { CircleAlert, ClipboardPaste, Copy, Check, Download, Eraser, FileText } from 'lucide-react';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { parseErrorPosition } from '@/lib/devtools/format-data';
import { cn } from '@/lib/utils';
import { FOCUS_RING } from '@/components/room-kit/tokens';

/** Altura de uma linha do editor (px): o número da margem e a faixa do erro seguem a mesma medida. */
const LINE_H = 22;
const PAD_TOP = 12;

interface ToolPaneProps {
  title: string;
  /** Linha de apoio ao lado do título (formato, recuo...). */
  sub?: string;
  value: string;
  onChange?: (value: string) => void;
  readOnly?: boolean;
  placeholder?: string;
  /** Controles extras na barra do painel (ex.: seletor de modo). */
  toolbar?: React.ReactNode;
  /** Nome do arquivo ao baixar; sem isso o botão de baixar some. */
  downloadName?: string;
  /** Mostra colar e limpar (entrada). Saídas só têm copiar e baixar. */
  editable?: boolean;
  /** Preenche a entrada com um exemplo; sem isso o botão some. */
  onExample?: () => void;
  /** Mensagem de erro no rodapé do painel. Com "linha N, coluna M" a linha é marcada no editor. */
  error?: string | null;
  /** Info curta no rodapé (ex.: "128 caracteres"). */
  footer?: React.ReactNode;
  /** Erro da ferramenta a marcar na entrada (faixa na linha e margem em vermelho), sem repetir a mensagem no rodapé: a mensagem fica no painel de saída. */
  markError?: string | null;
  /** Margem com o número das linhas. Padrão: ligada. */
  lineNumbers?: boolean;
  className?: string;
}

/** Foca o campo e leva o cursor à linha e coluna (1-based). */
export function focusTextareaAt(el: HTMLTextAreaElement | null, line?: number, col?: number) {
  if (!el) return;
  el.focus();
  if (!line) return;
  const rows = el.value.split('\n');
  const l = Math.min(Math.max(line, 1), rows.length);
  let pos = 0;
  for (let i = 0; i < l - 1; i++) pos += rows[i].length + 1;
  pos += Math.min(Math.max((col ?? 1) - 1, 0), rows[l - 1].length);
  try {
    el.setSelectionRange(pos, pos);
    el.scrollTop = Math.max((l - 3) * LINE_H, 0);
  } catch {
    /* campo sem seleção (tipo incompatível): o foco já basta */
  }
}

const barBtn =
  'inline-flex h-8 items-center gap-1.5 rounded-lg border border-border bg-transparent px-2.5 text-[13px] font-semibold text-foreground transition-colors duration-fast hover:bg-accent hover:text-accent-foreground disabled:pointer-events-none disabled:opacity-50 ' +
  FOCUS_RING;

// Painel padrão de entrada/saída das ferramentas: barra com título e ações, editor monoespaçado com
// margem de linhas (rola sozinho) e rodapé com o erro ou uma informação curta.
export function ToolPane({
  title, sub, value, onChange, readOnly, placeholder, toolbar, downloadName, editable = !readOnly, onExample,
  error, markError, footer, lineNumbers = true, className,
}: ToolPaneProps) {
  const { toast } = useToast();
  const [copied, setCopied] = React.useState(false);
  const [scrollTop, setScrollTop] = React.useState(0);
  const areaRef = React.useRef<HTMLTextAreaElement>(null);
  const gutterRef = React.useRef<HTMLDivElement>(null);
  const copiedTimer = React.useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  React.useEffect(() => () => clearTimeout(copiedTimer.current), []);

  const errPos = parseErrorPosition(error ?? markError);
  // A faixa vermelha só vale no painel onde se digita; na saída o erro aparece apenas no rodapé.
  const markPos = editable ? errPos : null;
  const count = Math.max(value.split('\n').length, 14);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      clearTimeout(copiedTimer.current);
      copiedTimer.current = setTimeout(() => setCopied(false), 1400);
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

  // O erro costuma aparecer no painel de saída, mas o ponto a corrigir está na entrada da mesma ferramenta.
  const goToError = (e: React.MouseEvent<HTMLButtonElement>) => {
    const own = editable ? areaRef.current : null;
    const root = e.currentTarget.closest('[data-tool-body]') ?? document;
    const target = own ?? root.querySelector<HTMLTextAreaElement>('textarea[data-tool-input="true"]');
    focusTextareaAt(target, errPos?.line, errPos?.col);
  };

  const showBand = lineNumbers && !!markPos;

  return (
    <section className={cn('flex min-h-0 min-w-0 flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-sm', className)}>
      <header className="flex shrink-0 flex-wrap items-center gap-2 border-b border-border px-4 py-2">
        <h2 className="text-[15px] font-bold text-foreground">{title}</h2>
        {sub && <span className="text-xs text-muted-foreground">{sub}</span>}
        <span className="flex-1" />
        {toolbar}
        {editable && (
          <>
            <button type="button" className={barBtn} onClick={paste} aria-label="Colar"><ClipboardPaste className="h-3.5 w-3.5" strokeWidth={1.5} aria-hidden="true" />Colar</button>
            <button type="button" className={barBtn} onClick={() => onChange?.('')} disabled={!value} aria-label="Limpar"><Eraser className="h-3.5 w-3.5" strokeWidth={1.5} aria-hidden="true" />Limpar</button>
          </>
        )}
        {onExample && (
          <button type="button" className={barBtn} onClick={onExample} aria-label="Exemplo"><FileText className="h-3.5 w-3.5" strokeWidth={1.5} aria-hidden="true" />Exemplo</button>
        )}
        {downloadName && (
          <button type="button" className={barBtn} onClick={download} disabled={!value} aria-label="Baixar"><Download className="h-3.5 w-3.5" strokeWidth={1.5} aria-hidden="true" />Baixar</button>
        )}
        <button type="button" className={barBtn} onClick={copy} disabled={!value} aria-label="Copiar">
          {copied ? <Check className="h-3.5 w-3.5 text-emerald-700 dark:text-emerald-300" strokeWidth={1.5} aria-hidden="true" /> : <Copy className="h-3.5 w-3.5" strokeWidth={1.5} aria-hidden="true" />}
          {copied ? 'Copiado' : 'Copiar'}
        </button>
      </header>

      <div className="relative flex min-h-[140px] min-w-0 flex-1 overflow-hidden bg-background">
        {lineNumbers && (
          <div
            ref={gutterRef}
            aria-hidden="true"
            className="w-12 shrink-0 select-none overflow-hidden border-r border-border py-3 text-right font-code text-xs text-muted-foreground"
          >
            {Array.from({ length: count }, (_, i) => {
              const hit = markPos?.line === i + 1;
              return (
                <div key={i} className={cn('pr-2.5', hit && 'font-bold text-red-700 dark:text-red-300')} style={{ height: LINE_H, lineHeight: `${LINE_H}px` }}>
                  {i + 1}
                </div>
              );
            })}
          </div>
        )}
        {showBand && markPos && (
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-x-0 border-l-[3px] border-red-700 bg-red-500/10 dark:border-red-300"
            style={{ top: PAD_TOP + (markPos.line - 1) * LINE_H - scrollTop, height: LINE_H }}
          />
        )}
        <Textarea
          ref={areaRef}
          value={value}
          onChange={(e) => onChange?.(e.target.value)}
          onScroll={(e) => {
            const top = e.currentTarget.scrollTop;
            if (gutterRef.current) gutterRef.current.scrollTop = top;
            if (showBand) setScrollTop(top);
          }}
          readOnly={readOnly}
          placeholder={placeholder}
          spellCheck={false}
          wrap="off"
          aria-label={title}
          aria-invalid={error || markError ? true : undefined}
          data-tool-input={editable ? 'true' : undefined}
          className="relative min-h-0 min-w-0 flex-1 resize-none overflow-auto whitespace-pre rounded-none border-0 bg-transparent px-3.5 py-3 font-code text-[13px] shadow-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
          style={{ lineHeight: `${LINE_H}px` }}
        />
      </div>

      {(error || footer) && (
        <footer
          role={error ? 'alert' : undefined}
          className={cn(
            'flex shrink-0 flex-wrap items-center gap-x-3 gap-y-1 border-t px-4 py-2 text-[13px]',
            error ? 'border-red-500/30 bg-red-500/10 font-semibold text-red-700 dark:text-red-300' : 'border-border text-muted-foreground',
          )}
        >
          {error ? (
            <>
              <CircleAlert className="h-4 w-4 shrink-0" strokeWidth={1.5} aria-hidden="true" />
              <span className="min-w-0 flex-1 break-words">{error}</span>
              <button
                type="button"
                onClick={goToError}
                className={cn('h-7 shrink-0 rounded-lg border border-red-700 px-2.5 text-xs font-semibold hover:bg-red-500/10 dark:border-red-300', FOCUS_RING)}
              >
                Ir para o erro
              </button>
            </>
          ) : (
            footer
          )}
        </footer>
      )}
    </section>
  );
}
