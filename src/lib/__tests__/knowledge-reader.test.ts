import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  slugify,
  uniqueId,
  buildToc,
  htmlWordCount,
  estimateReadingMinutes,
  formatSizeKb,
  buildTdnLink,
  formatUpdatedAgo,
  findActiveHeadingIndex,
  enhanceArticleDom,
} from '../knowledge-reader';

afterEach(() => vi.useRealTimers());

describe('slugify', () => {
  it('tira acentos, pontuação e usa hífen', () => {
    expect(slugify('Visão geral')).toBe('visao-geral');
    expect(slugify('  Erros & Códigos (HTTP)! ')).toBe('erros-codigos-http');
  });
  it('texto vazio ou só símbolos vira "secao"', () => {
    expect(slugify('')).toBe('secao');
    expect(slugify('???')).toBe('secao');
  });
});

describe('uniqueId', () => {
  it('numera repetições sem colidir com ids já existentes', () => {
    const used = new Set<string>();
    expect(uniqueId('a', used)).toBe('a');
    expect(uniqueId('a', used)).toBe('a-1');
    expect(uniqueId('a-1', used)).toBe('a-1-1');
    expect(uniqueId('a', used)).toBe('a-2');
  });
});

describe('buildToc', () => {
  it('extrai H1-H3 com nível e coloca ids únicos no HTML', () => {
    const { items, html } = buildToc('<h1>Início</h1><p>x</p><h2>Visão geral</h2><h3>Detalhe</h3><h2>Visão geral</h2><h4>Ignorado</h4>');
    expect(items.map((i) => [i.text, i.level])).toEqual([
      ['Início', 1],
      ['Visão geral', 2],
      ['Detalhe', 3],
      ['Visão geral', 2],
    ]);
    const ids = items.map((i) => i.id);
    expect(new Set(ids).size).toBe(4);
    expect(ids[1]).toBe('kb-visao-geral');
    expect(ids[3]).toBe('kb-visao-geral-1');
    expect(html).toContain('<h2 id="kb-visao-geral">');
    expect(html).not.toContain('id="kb-ignorado"');
  });
  it('ignora heading vazio e não quebra sem conteúdo', () => {
    expect(buildToc('<h2>  </h2><p>oi</p>').items).toEqual([]);
    expect(buildToc('')).toEqual({ items: [], html: '' });
  });
  it('substitui ids antigos do heading', () => {
    expect(buildToc('<h2 id="velho">Novo</h2>').html).toContain('id="kb-novo"');
  });
});

describe('tempo de leitura', () => {
  it('conta palavras ignorando tags, scripts e entidades', () => {
    expect(htmlWordCount('<p>um dois</p><td>tres</td><td>quatro</td>&nbsp;<script>var a = 1 2 3</script>')).toBe(4);
  });
  it('200 palavras por minuto, mínimo de 1', () => {
    expect(estimateReadingMinutes('')).toBe(1);
    expect(estimateReadingMinutes('<p>' + 'palavra '.repeat(200) + '</p>')).toBe(1);
    expect(estimateReadingMinutes('<p>' + 'palavra '.repeat(201) + '</p>')).toBe(2);
    expect(estimateReadingMinutes('<p>' + 'palavra '.repeat(1000) + '</p>')).toBe(5);
  });
});

describe('formatSizeKb', () => {
  it('usa vírgula decimal', () => {
    expect(formatSizeKb(14541)).toBe('14,2 KB');
    expect(formatSizeKb(1024)).toBe('1,0 KB');
  });
  it('sem tamanho conhecido devolve null', () => {
    expect(formatSizeKb(0)).toBeNull();
    expect(formatSizeKb(undefined)).toBeNull();
    expect(formatSizeKb(NaN)).toBeNull();
  });
});

describe('buildTdnLink', () => {
  it('monta o link como o sincronizador faz', () => {
    expect(buildTdnLink('tdn.totvs.com', '12345')).toBe('https://tdn.totvs.com/pages/viewpage.action?pageId=12345');
  });
  it('aceita URL base com protocolo e barra no fim', () => {
    expect(buildTdnLink('https://tdn.totvs.com/', '9')).toBe('https://tdn.totvs.com/pages/viewpage.action?pageId=9');
  });
  it('não inventa link sem URL base ou sem id', () => {
    expect(buildTdnLink('', '1')).toBeNull();
    expect(buildTdnLink(undefined, '1')).toBeNull();
    expect(buildTdnLink('tdn.totvs.com', '')).toBeNull();
    expect(buildTdnLink('tdn.totvs.com', undefined)).toBeNull();
  });
});

describe('formatUpdatedAgo', () => {
  it('descreve a data em português', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-17T12:00:00Z'));
    expect(formatUpdatedAgo('2026-10-14T12:00:00Z')).toBe('há 3 dias');
  });
  it('data inválida ou ausente devolve null', () => {
    expect(formatUpdatedAgo('nada')).toBeNull();
    expect(formatUpdatedAgo(undefined)).toBeNull();
  });
});

describe('findActiveHeadingIndex', () => {
  it('escolhe o último heading que já passou da linha', () => {
    expect(findActiveHeadingIndex([], 10)).toBe(-1);
    expect(findActiveHeadingIndex([100, 400, 900], 10)).toBe(0);
    expect(findActiveHeadingIndex([-50, 80, 900], 100)).toBe(1);
    expect(findActiveHeadingIndex([-500, -300, -10], 100)).toBe(2);
  });
});

describe('enhanceArticleDom', () => {
  const mount = (html: string) => {
    const root = document.createElement('div');
    root.innerHTML = html;
    document.body.appendChild(root);
    return root;
  };

  it('embrulha o código com barra e botão Copiar, uma vez só', () => {
    const root = mount('<pre class="wiki-code-block"><code class="language-json">{"a":1}</code></pre>');
    enhanceArticleDom(root);
    enhanceArticleDom(root);
    expect(root.querySelectorAll('.kb-code')).toHaveLength(1);
    expect(root.querySelectorAll('button[data-kb-copy]')).toHaveLength(1);
    expect(root.querySelector('.kb-code-bar span')?.textContent).toBe('json');
    expect(root.querySelector('.kb-code > pre')).not.toBeNull();
  });

  it('bloco sem linguagem fica com o rótulo "código"', () => {
    const root = mount('<pre>x = 1</pre>');
    enhanceArticleDom(root);
    expect(root.querySelector('.kb-code-bar span')?.textContent).toBe('código');
  });

  it('tabela ganha invólucro de rolagem; links externos abrem em nova aba; imagem carrega sob demanda', () => {
    const root = mount('<table><tr><td>a</td></tr></table><a href="https://x.com">x</a><a href="#kb-a">a</a><img src="a.png">');
    enhanceArticleDom(root);
    expect(root.querySelector('.kb-table-wrap > table')).not.toBeNull();
    const [ext, internal] = Array.from(root.querySelectorAll('a'));
    expect(ext.getAttribute('target')).toBe('_blank');
    expect(ext.getAttribute('rel')).toBe('noopener noreferrer');
    expect(internal.getAttribute('target')).toBeNull();
    expect(root.querySelector('img')?.getAttribute('loading')).toBe('lazy');
  });
});
