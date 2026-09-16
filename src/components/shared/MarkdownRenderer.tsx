'use client';

import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { cn } from '@/lib/utils';

/** Renderiza markdown (GFM: tabelas, tachado, checklists) formatado, com o
 *  mesmo estilo de prose usado no leitor da Base de Conhecimento. */
export function MarkdownRenderer({ content, className }: { content: string; className?: string }) {
  return (
    <div className={cn('prose prose-sm prose-slate dark:prose-invert max-w-none', className)}>
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
    </div>
  );
}
