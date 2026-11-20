import { describe, it, expect } from 'vitest';
import { markdownToHtml } from '../markdown-to-html';

describe('markdownToHtml', () => {
  it('converte títulos de 1 a 6', () => {
    expect(markdownToHtml('# A\n\n## B\n###### F')).toBe('<h1>A</h1><h2>B</h2><h6>F</h6>');
  });

  it('converte negrito, itálico, tachado e código em linha', () => {
    expect(markdownToHtml('um **forte**, _ital_, *ital2*, ~~velho~~ e `code`')).toBe(
      '<p>um <strong>forte</strong>, <em>ital</em>, <em>ital2</em>, <s>velho</s> e <code>code</code></p>'
    );
  });

  it('não aplica ênfase dentro de código em linha nem em snake_case', () => {
    expect(markdownToHtml('`a_b_c **x**` e nome_da_variavel')).toBe(
      '<p><code>a_b_c **x**</code> e nome_da_variavel</p>'
    );
  });

  it('converte listas com marcadores e numeradas', () => {
    expect(markdownToHtml('- a\n- b\n\n1. um\n2. dois')).toBe(
      '<ul><li>a</li><li>b</li></ul><ol><li>um</li><li>dois</li></ol>'
    );
  });

  it('converte listas aninhadas', () => {
    expect(markdownToHtml('- pai\n  - filho\n  - filho 2\n- outro')).toBe(
      '<ul><li>pai<ul><li>filho</li><li>filho 2</li></ul></li><li>outro</li></ul>'
    );
  });

  it('converte citações', () => {
    expect(markdownToHtml('> linha 1\n> **dois**')).toBe(
      '<blockquote><p>linha 1 <strong>dois</strong></p></blockquote>'
    );
  });

  it('preserva quebras e indentação em blocos de código e escapa HTML', () => {
    const md = '```json\n{\n  "a": [\n    1\n  ],\n  "t": "<b>"\n}\n```\n\ndepois';
    const out = markdownToHtml(md);
    expect(out).toContain('<pre><code class="language-json">{\n  "a": [\n    1\n  ],\n  "t": "&lt;b&gt;"\n}</code></pre>');
    expect(out.endsWith('<p>depois</p>')).toBe(true);
  });

  it('não interpreta Markdown dentro de bloco de código e aceita cerca sem fechamento', () => {
    expect(markdownToHtml('```\n# não é título\n**x**')).toBe('<pre><code># não é título\n**x**</code></pre>');
  });

  it('converte linha horizontal', () => {
    expect(markdownToHtml('a\n\n---\n\nb')).toBe('<p>a</p><hr><p>b</p>');
  });

  it('converte links e mantém "_" e "*" da URL', () => {
    expect(markdownToHtml('veja [o **doc**](https://x.com/a_b_c?q=1&z=2)')).toBe(
      '<p>veja <a href="https://x.com/a_b_c?q=1&amp;z=2">o <strong>doc</strong></a></p>'
    );
  });

  it('descarta URLs perigosas, mantendo só o texto', () => {
    expect(markdownToHtml('[clique](javascript:alert(1))')).not.toContain('javascript');
    expect(markdownToHtml('[clique](data:text/html,x)')).toBe('<p>clique</p>');
  });

  it('escapa HTML cru', () => {
    expect(markdownToHtml('<script>alert(1)</script> & <b>')).toBe(
      '<p>&lt;script&gt;alert(1)&lt;/script&gt; &amp; &lt;b&gt;</p>'
    );
  });

  it('separa parágrafos, junta linhas seguidas e respeita quebra forçada', () => {
    expect(markdownToHtml('linha 1\nlinha 2\n\nnovo  \nbr')).toBe('<p>linha 1 linha 2</p><p>novo<br>br</p>');
  });

  it('aceita CRLF, BOM e entrada vazia', () => {
    expect(markdownToHtml('﻿# T\r\n\r\ntexto')).toBe('<h1>T</h1><p>texto</p>');
    expect(markdownToHtml('  \n ')).toBe('');
  });
});
