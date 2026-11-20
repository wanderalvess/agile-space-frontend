'use client';

import { useMemo, useState } from 'react';
import { PAGE_CARD } from '@/components/page';
import { MarkdownRenderer } from '@/components/shared/MarkdownRenderer';
import { cn } from '@/lib/utils';
import { getTypeMeta } from '@/app/prompt-hub/constants';
import { splitFrontmatter } from '@/app/prompt-hub/skillFrontmatter';
import { fillVariables, splitFilled } from '@/app/prompt-hub/variables';
import type { PromptItem } from '@/app/prompt-hub/types';

type ViewMode = 'formatted' | 'raw';

/** Conteúdo do item. Skill e recurso podem ser vistos formatados ou crus; os outros tipos aparecem como texto. */
export function ItemContent({ item, values, content }: { item: PromptItem; values: Record<string, string>; content: string }) {
  const [mode, setMode] = useState<ViewMode>('formatted');
  const meta = getTypeMeta(item.type);
  const hasMarkdown = item.type === 'skill' || item.type === 'resource';
  const hasFields = /\{\{/.test(content);

  const filledText = useMemo(() => fillVariables(content, values), [content, values]);
  const parts = useMemo(() => splitFilled(content, values), [content, values]);
  const front = useMemo(() => (item.type === 'skill' ? splitFrontmatter(filledText) : null), [item.type, filledText]);

  const title = hasFields ? 'Texto final' : item.type === 'skill' ? 'SKILL.md' : 'Conteúdo';
  const showFormatted = hasMarkdown && mode === 'formatted';

  return (
    <section aria-label="Conteúdo" className={cn(PAGE_CARD, 'overflow-hidden')}>
      <div className="flex flex-wrap items-center gap-2.5 border-b border-border px-3.5 py-2.5">
        <h2 className="text-base font-bold text-foreground" title={meta.contentLabel}>
          {title}
        </h2>
        {hasMarkdown && (
          <div role="group" aria-label="Forma de exibir" className="flex rounded-[10px] border border-border bg-muted/40 p-0.5">
            {(['formatted', 'raw'] as const).map(value => (
              <button
                key={value}
                type="button"
                aria-pressed={mode === value}
                onClick={() => setMode(value)}
                className={cn(
                  'h-7 rounded-[7px] px-3 text-[13px] font-semibold transition-colors duration-fast',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                  mode === value ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
                )}
              >
                {value === 'formatted' ? 'Formatado' : 'Cru'}
              </button>
            ))}
          </div>
        )}
        <span className="flex-1" />
        <span className="text-[13px] tabular-nums text-muted-foreground">
          {filledText.length.toLocaleString('pt-BR')} caracteres · {filledText.split('\n').length.toLocaleString('pt-BR')} linhas
        </span>
      </div>

      {showFormatted ? (
        <div className="flex max-h-[640px] flex-col gap-3 overflow-auto px-6 py-5">
          {front?.hasFrontmatter && (
            <dl className="grid grid-cols-[100px_1fr] gap-x-3 gap-y-1 rounded-[10px] border border-border bg-muted/40 px-3.5 py-3 text-sm">
              <dt className="text-muted-foreground">Nome</dt>
              <dd className="font-mono text-foreground">{front.name || '—'}</dd>
              <dt className="text-muted-foreground">Descrição</dt>
              <dd className="text-foreground">{front.description || '—'}</dd>
            </dl>
          )}
          <MarkdownRenderer content={front?.hasFrontmatter ? front.body : filledText} />
        </div>
      ) : (
        <pre
          className={cn(
            'max-h-[640px] overflow-auto whitespace-pre-wrap break-words px-6 py-5 text-foreground',
            meta.mono ? 'font-mono text-[13px] leading-[1.7]' : 'text-[15px] leading-[1.7]'
          )}
        >
          {parts.map((part, index) =>
            part.kind === 'text' ? (
              <span key={index}>{part.text}</span>
            ) : (
              <span
                key={index}
                className={cn(
                  'rounded px-0.5 font-bold',
                  part.kind === 'filled'
                    ? 'bg-primary/15 text-foreground'
                    : 'bg-amber-500/15 text-amber-800 dark:text-amber-300'
                )}
              >
                {part.text}
              </span>
            )
          )}
        </pre>
      )}
    </section>
  );
}
