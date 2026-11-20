/**
 * Conversor pequeno de Markdown para HTML, usado ao importar arquivos .md no editor da Base de
 * Conhecimento. Escolhido no lugar de react-markdown/react-dom/server (que é feito para renderizar
 * React, não para devolver uma string) e de uma dependência nova como `marked`.
 *
 * Cobre: títulos, negrito/itálico/tachado/código em linha, listas (com aninhamento), citações,
 * blocos de código, linha horizontal, links, imagens e parágrafos. Todo texto é escapado. O
 * resultado ainda passa por `sanitizeHtml` + schema do TipTap antes de entrar no documento.
 * Fora do escopo: tabelas (o editor não tem esse nó) e HTML cru dentro do Markdown (vira texto).
 */

function escapeHtml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/** Só aceita URLs http(s), mailto, âncoras e caminhos relativos. */
function safeUrl(url: string): string | null {
  const trimmed = url.trim();
  if (/^(https?:|mailto:|#|\/|\.{1,2}\/)/i.test(trimmed)) return trimmed.replace(/"/g, '%22');
  if (/^[a-z][a-z0-9+.-]*:/i.test(trimmed)) return null;
  return trimmed.replace(/"/g, '%22');
}

function convertInline(source: string): string {
  const stash: string[] = [];
  const hold = (html: string) => `\u0000${stash.push(html) - 1}\u0000`;

  // 1) Código em linha: o conteúdo não recebe nenhuma outra formatação.
  let text = source.replace(/(`+)([\s\S]*?[^`])\1(?!`)/g, (_m, _ticks, code: string) =>
    hold(`<code>${escapeHtml(code.trim())}</code>`)
  );

  text = escapeHtml(text);

  // 2) Imagens e links: a tag de abertura vai para o estoque para que "_" ou "*" na URL não virem itálico.
  text = text.replace(/!\[([^\]]*)\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g, (m, alt: string, url: string) => {
    const href = safeUrl(url.replace(/&amp;/g, '&'));
    return href ? hold(`<img src="${href.replace(/&/g, '&amp;')}" alt="${alt.replace(/"/g, '&quot;')}">`) : m;
  });
  text = text.replace(/\[([^\]]+)\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g, (m, label: string, url: string) => {
    const href = safeUrl(url.replace(/&amp;/g, '&'));
    if (!href) return label;
    return `${hold(`<a href="${href.replace(/&/g, '&amp;')}">`)}${label}${hold('</a>')}`;
  });

  // 3) Ênfase.
  text = text
    .replace(/\*\*(?=\S)([\s\S]*?\S)\*\*/g, '<strong>$1</strong>')
    .replace(/(?<![\w_])__(?=\S)([\s\S]*?\S)__(?![\w_])/g, '<strong>$1</strong>')
    .replace(/~~(?=\S)([\s\S]*?\S)~~/g, '<s>$1</s>')
    .replace(/(?<![*\w])\*(?=[^\s*])([\s\S]*?[^\s*])\*(?![*\w])/g, '<em>$1</em>')
    .replace(/(?<![\w_])_(?=[^\s_])([\s\S]*?[^\s_])_(?![\w_])/g, '<em>$1</em>');

  return text.replace(/\u0000(\d+)\u0000/g, (_m, i) => stash[Number(i)] ?? '');
}

const FENCE = /^\s{0,3}(`{3,}|~{3,})\s*([\w+#.-]*)[^\n]*$/;
const HEADING = /^\s{0,3}(#{1,6})\s+(.*?)(?:\s+#+)?\s*$/;
const HRULE = /^\s{0,3}([-*_])(?:\s*\1){2,}\s*$/;
const LIST_ITEM = /^(\s*)([-*+]|\d{1,9}[.)])\s+(.*)$/;
const QUOTE = /^\s{0,3}>\s?(.*)$/;

function isBlockStart(line: string): boolean {
  return FENCE.test(line) || HEADING.test(line) || HRULE.test(line) || QUOTE.test(line) || LIST_ITEM.test(line);
}

function indentOf(line: string): number {
  return line.match(/^\s*/)![0].replace(/\t/g, '    ').length;
}

function convertList(lines: string[], start: number): { html: string; next: number } {
  const first = lines[start].match(LIST_ITEM)!;
  const baseIndent = indentOf(lines[start]);
  const ordered = /\d/.test(first[2]);
  const items: { lines: string[]; offset: number }[] = [];
  let i = start;

  const sameLevelItem = (line: string): RegExpMatchArray | null => {
    const m = line.match(LIST_ITEM);
    if (!m || indentOf(line) > baseIndent + 1) return null;
    return m;
  };

  while (i < lines.length) {
    const line = lines[i];
    if (line.trim() === '') {
      // Linha em branco só continua a lista se o próximo conteúdo ainda pertence a ela.
      let j = i + 1;
      while (j < lines.length && lines[j].trim() === '') j++;
      if (j >= lines.length) break;
      const next = sameLevelItem(lines[j]);
      const continues = indentOf(lines[j]) > baseIndent + 1;
      const sibling = next !== null && indentOf(lines[j]) >= baseIndent && /\d/.test(next[2]) === ordered;
      if (!continues && !sibling) break;
      items[items.length - 1]?.lines.push('');
      i = j;
      continue;
    }
    const m = sameLevelItem(line);
    if (m) {
      if (indentOf(line) < baseIndent || /\d/.test(m[2]) !== ordered) break;
      items.push({ lines: [m[3]], offset: m[1].replace(/	/g, '    ').length + m[2].length + 1 });
      i++;
      continue;
    }
    if (!items.length) break;
    const current = items[items.length - 1];
    if (indentOf(line) > baseIndent + 1 || !isBlockStart(line)) {
      // Continuação ou sub-bloco: tira a indentação do conteúdo do item antes de reprocessar.
      current.lines.push(line.replace(/	/g, '    ').replace(new RegExp(`^ {1,${current.offset}}`), ''));
      i++;
      continue;
    }
    break;
  }

  const tag = ordered ? 'ol' : 'ul';
  const body = items
    .map(item => {
      // Item simples: o primeiro parágrafo vira o próprio texto do <li>, sem <p> em volta.
      const html = convertBlocks(item.lines).replace(/^<p>([\s\S]*?)<\/p>/, '$1');
      return `<li>${html}</li>`;
    })
    .join('');
  return { html: `<${tag}>${body}</${tag}>`, next: i };
}

function convertBlocks(lines: string[]): string {
  const out: string[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    if (line.trim() === '') {
      i++;
      continue;
    }

    const fence = line.match(FENCE);
    if (fence) {
      const marker = fence[1];
      const lang = fence[2];
      const code: string[] = [];
      i++;
      while (i < lines.length && !new RegExp(`^\\s{0,3}${marker[0]}{${marker.length},}\\s*$`).test(lines[i])) {
        code.push(lines[i]);
        i++;
      }
      i++; // fecha o bloco (ou termina o arquivo, se não havia fechamento)
      const cls = lang ? ` class="language-${lang.replace(/[^\w+#.-]/g, '')}"` : '';
      out.push(`<pre><code${cls}>${escapeHtml(code.join('\n'))}</code></pre>`);
      continue;
    }

    const heading = line.match(HEADING);
    if (heading) {
      const level = heading[1].length;
      out.push(`<h${level}>${convertInline(heading[2])}</h${level}>`);
      i++;
      continue;
    }

    if (HRULE.test(line)) {
      out.push('<hr>');
      i++;
      continue;
    }

    if (QUOTE.test(line)) {
      const quoted: string[] = [];
      while (i < lines.length && QUOTE.test(lines[i])) {
        quoted.push(lines[i].match(QUOTE)![1]);
        i++;
      }
      out.push(`<blockquote>${convertBlocks(quoted)}</blockquote>`);
      continue;
    }

    if (LIST_ITEM.test(line)) {
      const list = convertList(lines, i);
      out.push(list.html);
      i = list.next;
      continue;
    }

    // Parágrafo: linhas seguidas até uma linha em branco ou outro bloco.
    const para: string[] = [];
    while (i < lines.length && lines[i].trim() !== '' && (para.length === 0 || !isBlockStart(lines[i]))) {
      para.push(lines[i]);
      i++;
    }
    const html = para
      .map((l, idx) => {
        const hardBreak = idx < para.length - 1 && (/ {2,}$/.test(l) || /\\$/.test(l));
        return convertInline(l.replace(/\\$/, '').trim()) + (hardBreak ? '<br>' : idx < para.length - 1 ? ' ' : '');
      })
      .join('');
    out.push(`<p>${html}</p>`);
  }

  return out.join('');
}

/** Converte Markdown em HTML (string). Entrada vazia devolve string vazia. */
export function markdownToHtml(markdown: string): string {
  const normalized = markdown.replace(/\r\n?/g, '\n').replace(/^﻿/, '');
  if (!normalized.trim()) return '';
  return convertBlocks(normalized.split('\n'));
}
