/**
 * Dados e texto do detalhe da tarefa (descrição e critérios) — o que o modal
 * "Ver detalhes" mostra, vindo da mesma Issue em qualquer lugar da sala
 * (mesa, fila, histórico).
 */
import type { Issue } from '@/lib/types';
import { sanitizeHtml } from '@/lib/sanitize-html';

export interface IssueDetailData {
  key: string;
  summary: string;
  description: string;
  type?: string;
  status?: string;
  priority?: string;
  assignee?: string;
  updated?: string;
  labels?: string[];
  points?: number;
  link?: string;
  acceptanceCriteria?: string;
}

/** Issue da fila -> dados do detalhe. */
export function issueToDetail(issue: Issue): IssueDetailData {
  return {
    key: issue.key || '',
    summary: issue.title,
    description: issue.description || '',
    type: issue.jiraType,
    status: issue.jiraStatus,
    priority: issue.jiraPriority,
    assignee: issue.jiraAssignee,
    updated: issue.jiraUpdated,
    labels: issue.jiraLabels,
    link: issue.jiraLink || undefined,
    acceptanceCriteria: issue.acceptanceCriteria,
  };
}

/** Texto que já é HTML (Jira renderizado) em vez de texto puro. `a < b` não conta. */
export function looksLikeHtml(value: string): boolean {
  return /<\/?[a-z][a-z0-9-]*(\s[^>]*)?\/?>/i.test(value);
}

const escapeHtml = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** Texto puro -> HTML: parágrafos pelas linhas em branco e quebra de linha simples preservada. */
export function plainTextToHtml(value: string): string {
  return value
    .replace(/\r\n?/g, '\n')
    .trim()
    .split(/\n{2,}/)
    .map((p) => `<p>${escapeHtml(p).replace(/\n/g, '<br>')}</p>`)
    .join('');
}

/** Origem (https://host) do link da issue, para completar endereços relativos do Jira. */
export function originOf(link?: string | null): string | undefined {
  if (!link) return undefined;
  try {
    const url = new URL(link);
    return /^https?:$/.test(url.protocol) ? url.origin : undefined;
  } catch {
    return undefined;
  }
}

/**
 * HTML seguro para exibir descrição/critérios: texto puro vira parágrafos,
 * HTML do Jira é saneado, links abrem em nova aba e endereços relativos
 * (`/secure/attachment/...`) ganham a origem do Jira da própria issue e imagens
 * do Jira viram link (não carregam como <img> fora do Jira).
 */
export function renderIssueRichText(value: string, baseUrl?: string): string {
  if (!value || !value.trim()) return '';
  const safe = sanitizeHtml(looksLikeHtml(value) ? value : plainTextToHtml(value));
  if (typeof DOMParser === 'undefined') return safe;

  const doc = new DOMParser().parseFromString(`<body>${safe}</body>`, 'text/html');
  const origin = originOf(baseUrl);
  doc.querySelectorAll('a[href]').forEach((a) => {
    const href = a.getAttribute('href') || '';
    if (origin && href.startsWith('/') && !href.startsWith('//')) a.setAttribute('href', origin + href);
    a.setAttribute('target', '_blank');
    a.setAttribute('rel', 'noopener noreferrer');
  });
  if (origin) {
    // Imagem hospedada no Jira exige a sessão do Jira e nunca carrega como <img> de outro site:
    // vira um link que abre a imagem numa nova aba.
    doc.querySelectorAll('img[src]').forEach((img) => {
      const src = img.getAttribute('src') || '';
      const abs = src.startsWith('/') && !src.startsWith('//') ? origin + src : src;
      if (!abs.startsWith(origin + '/')) return;
      const link = doc.createElement('a');
      link.setAttribute('href', abs);
      link.setAttribute('target', '_blank');
      link.setAttribute('rel', 'noopener noreferrer');
      link.textContent = img.getAttribute('alt') || 'Abrir imagem no Jira';
      img.replaceWith(link);
    });
  }
  return doc.body.innerHTML;
}
