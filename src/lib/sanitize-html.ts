'use client';

import DOMPurify from 'dompurify';

/**
 * Sanitiza HTML antes de renderizar via dangerouslySetInnerHTML. Usar sempre
 * que o conteúdo vier de fonte externa/outro usuário (import do TDN/Confluence,
 * descrição de issue do Jira, conteúdo da Base de Conhecimento etc.) — sem
 * isso, um payload como <img onerror="..."> ou <script> fica armazenado e
 * executa no navegador de quem visualizar o documento (XSS armazenado).
 */
export function sanitizeHtml(html: string | null | undefined): string {
  if (!html) return '';
  return DOMPurify.sanitize(html, {
    FORBID_TAGS: ['script', 'style', 'iframe', 'object', 'embed', 'form'],
    FORBID_ATTR: ['onerror', 'onload', 'onclick', 'onmouseover', 'onfocus', 'onblur'],
  });
}
