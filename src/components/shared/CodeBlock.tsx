'use client';

import { useState } from 'react';
import { Check, Copy } from 'lucide-react';
import { cn } from '@/lib/utils';

interface CodeBlockProps {
  code: string;
  /** Rótulo curto no topo do bloco (ex: "curl", "Resposta", "claude_desktop_config.json"). */
  label?: string;
  /** Linguagem ou identificador de formato (ex: "bash", "json"). Usado como fallback quando `label` não for definido. */
  language?: string;
  className?: string;
}

/**
 * Bloco de código somente-leitura com botão de copiar — usado na documentação
 * de integração (/manual#integracoes e o dialog por módulo). Sem realce de
 * sintaxe de propósito: os trechos são curtos e o app não carrega highlighter.
 */
export function CodeBlock({ code, label, language, className }: CodeBlockProps) {
  const [copied, setCopied] = useState(false);
  const displayLabel = label || language || 'Exemplo';

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard bloqueado (http sem TLS, permissão negada): o texto continua
      // selecionável, então não vale interromper o usuário com um toast de erro.
    }
  };

  return (
    <div className={cn('rounded-xl border border-border overflow-hidden bg-card', className)}>
      <div className="flex items-center justify-between px-4 py-2 border-b border-border bg-muted">
        <span className="text-xs font-semibold text-muted-foreground">
          {displayLabel}
        </span>
        <button
          type="button"
          onClick={handleCopy}
          aria-label={copied ? 'Copiado' : 'Copiar código'}
          className="-my-1 -mr-2 flex min-h-6 items-center gap-1.5 rounded-md px-2 text-xs font-semibold text-muted-foreground transition-colors hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {copied ? <Check className="h-3 w-3 text-emerald-600 dark:text-emerald-400" /> : <Copy className="h-3 w-3" />}
          {copied ? 'Copiado' : 'Copiar'}
        </button>
      </div>
      <pre className="p-4 overflow-x-auto text-xs leading-relaxed font-code text-foreground whitespace-pre">
        {code}
      </pre>
    </div>
  );
}
