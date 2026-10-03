'use client';

import React, { useState } from 'react';
import { Check, Copy } from 'lucide-react';
import { cn } from '@/lib/utils';

const FENCE_RE = /```([\w+#.-]*)\n?([\s\S]*?)```/g;
const INLINE_RE = /(`[^`\n]+`|https?:\/\/[^\s<>"']+)/g;

type Segment = { type: 'text'; value: string } | { type: 'code'; value: string; lang: string };

export function splitFences(text: string): Segment[] {
  const segments: Segment[] = [];
  let last = 0;
  for (const match of text.matchAll(FENCE_RE)) {
    const start = match.index ?? 0;
    const before = text.slice(last, start).replace(/\n$/, '');
    if (before) segments.push({ type: 'text', value: before });
    segments.push({ type: 'code', lang: match[1] || '', value: match[2].replace(/\n$/, '') });
    last = start + match[0].length;
    if (text[last] === '\n') last += 1;
  }
  if (last < text.length) segments.push({ type: 'text', value: text.slice(last) });
  return segments;
}

function InlineText({ value, isOwn }: { value: string; isOwn: boolean }) {
  const parts = value.split(INLINE_RE);
  return (
    <>
      {parts.map((part, i) => {
        if (!part) return null;
        if (part.startsWith('`') && part.endsWith('`') && part.length > 2) {
          return (
            <code key={i} className={cn(
              'px-1 py-0.5 rounded font-mono text-[11px]',
              isOwn ? 'bg-white/20' : 'bg-slate-200 dark:bg-slate-700'
            )}>
              {part.slice(1, -1)}
            </code>
          );
        }
        if (/^https?:\/\//.test(part)) {
          return (
            <a key={i} href={part} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2 break-all">
              {part}
            </a>
          );
        }
        return <React.Fragment key={i}>{part}</React.Fragment>;
      })}
    </>
  );
}

export function CodeBlock({ code, lang }: { code: string; lang?: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      setCopied(false);
    }
  };

  return (
    <div className="my-1 rounded-xl overflow-hidden border border-slate-700 bg-slate-950 text-slate-100 max-w-full">
      <div className="flex items-center justify-between px-2.5 py-1 bg-slate-900 border-b border-slate-800">
        <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">{lang || 'código'}</span>
        <button
          type="button"
          onClick={handleCopy}
          className="flex items-center gap-1 text-[9px] font-black uppercase tracking-widest text-slate-400 hover:text-white transition-colors"
          aria-label="Copiar código"
        >
          {copied ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
          {copied ? 'Copiado' : 'Copiar'}
        </button>
      </div>
      <pre className="p-2.5 text-[11px] leading-relaxed font-mono overflow-x-auto whitespace-pre">
        <code>{code}</code>
      </pre>
    </div>
  );
}

export function ChatMessageContent({ text, kind, isOwn }: { text: string; kind: 'text' | 'code'; isOwn: boolean }) {
  if (kind === 'code') return <CodeBlock code={text} />;

  return (
    <>
      {splitFences(text).map((segment, i) =>
        segment.type === 'code'
          ? <CodeBlock key={i} code={segment.value} lang={segment.lang} />
          : (
            <span key={i} className="whitespace-pre-wrap break-words">
              <InlineText value={segment.value} isOwn={isOwn} />
            </span>
          )
      )}
    </>
  );
}
