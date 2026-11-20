'use client';

import * as React from 'react';
import { sanitizeHtml } from '@/lib/sanitize-html';
import { isContentEmpty } from '@/lib/knowledge-editor';
import { ARTICLE_PROSE } from './article-prose';
import { StatusChip } from '@/components/room-kit';

export interface ArticlePreviewProps {
  title: string;
  category: string;
  folder: string;
  html: string;
}

/** Modo "Ler": o artigo como o leitor vai ver (HTML sanitizado, mesmas classes de prosa do editor). */
export function ArticlePreview({ title, category, folder, html }: ArticlePreviewProps) {
  const safe = React.useMemo(() => sanitizeHtml(html), [html]);
  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-[2.375rem] font-bold leading-[1.15] tracking-tight text-foreground">{title.trim() || 'Sem título'}</h1>
      <div className="flex flex-wrap items-center gap-2 text-[13px] text-muted-foreground">
        <StatusChip tone="brand">{category}</StatusChip>
        {folder.trim() && <span>{folder.trim()}</span>}
        <span>· prévia, do jeito que o leitor vai ver</span>
      </div>
      {isContentEmpty(html) ? (
        <p className="text-muted-foreground">Nada escrito ainda. Volte para Escrever para começar.</p>
      ) : (
        <div className={ARTICLE_PROSE} dangerouslySetInnerHTML={{ __html: safe }} />
      )}
    </div>
  );
}
