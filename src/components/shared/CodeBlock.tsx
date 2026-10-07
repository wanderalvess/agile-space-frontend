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
    <div className={cn('rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden bg-slate-950', className)}>
      <div className="flex items-center justify-between px-4 py-2 border-b border-slate-800 bg-slate-900">
        <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">
          {displayLabel}
        </span>
        <button
          type="button"
          onClick={handleCopy}
          aria-label={copied ? 'Copiado' : 'Copiar código'}
          className="flex items-center gap-1.5 text-[9px] font-black uppercase tracking-widest text-slate-400 hover:text-cyan-400 transition-colors"
        >
          {copied ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
          {copied ? 'Copiado' : 'Copiar'}
        </button>
      </div>
      <pre className="p-4 overflow-x-auto text-[11px] leading-relaxed font-code text-slate-200 whitespace-pre">
        {code}
      </pre>
    </div>
  );
}
