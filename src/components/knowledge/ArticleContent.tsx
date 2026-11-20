'use client';

import React, { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef } from 'react';
import { cn } from '@/lib/utils';
import { sanitizeHtml } from '@/lib/sanitize-html';
import { copyToClipboard } from '@/lib/copy-to-clipboard';
import { enhanceArticleDom } from '@/lib/knowledge-reader';

interface ArticleContentProps {
  /** HTML do artigo. É sempre sanitizado aqui antes de renderizar. */
  html: string;
  /** Texto mostrado quando o artigo está vazio. */
  emptyText?: string;
  className?: string;
}

/**
 * Corpo do artigo: HTML sanitizado com a tipografia do leitor (classe `kb-article`),
 * blocos de código com botão "Copiar" e tabelas com rolagem horizontal.
 * O pós-processamento só cria elementos pelo DOM (sem HTML em string) depois da sanitização.
 */
export const ArticleContent = forwardRef<HTMLDivElement, ArticleContentProps>(function ArticleContent(
  { html, emptyText = 'Este artigo ainda não tem conteúdo.', className },
  ref,
) {
  const rootRef = useRef<HTMLDivElement>(null);
  useImperativeHandle(ref, () => rootRef.current as HTMLDivElement);

  const safeHtml = useMemo(() => sanitizeHtml(html), [html]);
  // Objeto estável: o React reescreve o innerHTML quando a identidade muda, e isso apagaria os botões de copiar já injetados.
  const innerHtml = useMemo(() => ({ __html: safeHtml }), [safeHtml]);

  useEffect(() => {
    if (rootRef.current) enhanceArticleDom(rootRef.current);
  }, [safeHtml]);

  const onClick = useCallback(async (e: React.MouseEvent<HTMLDivElement>) => {
    const button = (e.target as HTMLElement).closest<HTMLButtonElement>('button[data-kb-copy]');
    if (!button) return;
    const pre = button.closest('.kb-code')?.querySelector('pre');
    if (!pre) return;
    const ok = await copyToClipboard(pre.textContent || '');
    button.textContent = ok ? 'Copiado' : 'Não copiou';
    window.setTimeout(() => {
      if (button.isConnected) button.textContent = 'Copiar';
    }, 1800);
  }, []);

  if (!safeHtml.trim()) {
    return <p className="text-muted-foreground">{emptyText}</p>;
  }

  return (
    <div
      ref={rootRef}
      className={cn('prose max-w-none kb-article', className)}
      onClick={onClick}
      dangerouslySetInnerHTML={innerHtml}
    />
  );
});
