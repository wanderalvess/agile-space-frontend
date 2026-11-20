'use client';

import { useEffect, useRef, useState } from 'react';
import { Check, Copy } from 'lucide-react';
import { FOCUS_RING } from '@/components/room-kit/tokens';
import { cn } from '@/lib/utils';

interface ManualCodeProps {
  code: string;
  /** Rótulo curto no topo (curl, json, resposta). */
  lang?: string;
  className?: string;
}

/** Trecho de código do Manual: cores do tema, rolagem horizontal e botão de copiar que avisa quando copiou. */
export function ManualCode({ code, lang = 'exemplo', className }: ManualCodeProps) {
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => setCopied(false), 2000);
    } catch {
      // Área de transferência bloqueada (sem HTTPS ou sem permissão): o texto continua selecionável.
    }
  };

  return (
    <div className={cn('overflow-hidden rounded-xl border border-border bg-muted', className)}>
      <div className="flex items-center justify-between gap-3 border-b border-border px-3.5 py-1.5 text-xs text-muted-foreground">
        <span className="font-code">{lang}</span>
        <button
          type="button"
          onClick={copy}
          aria-label={copied ? 'Código copiado' : 'Copiar o código'}
          className={cn(
            'inline-flex h-8 items-center gap-1.5 rounded-lg border border-border bg-card px-3 text-xs font-semibold text-foreground hover:bg-accent max-sm:h-11',
            FOCUS_RING,
          )}
        >
          {copied ? <Check className="h-3.5 w-3.5" strokeWidth={1.5} aria-hidden="true" /> : <Copy className="h-3.5 w-3.5" strokeWidth={1.5} aria-hidden="true" />}
          {copied ? 'Copiado' : 'Copiar'}
        </button>
      </div>
      <pre tabIndex={0} aria-label={`Código ${lang}`} className={cn('overflow-x-auto px-4 py-3.5 font-code text-sm leading-relaxed text-foreground', FOCUS_RING)}>
        {code}
      </pre>
      <span role="status" className="sr-only">
        {copied ? 'Código copiado' : ''}
      </span>
    </div>
  );
}
