import { describe, it, expect } from 'vitest';
import { parseConfluenceMacros } from '../tdnService';

const jsonCode = '{\n  "nome": "Agile",\n  "itens": [\n    1,\n    2\n  ]\n}'; // 7 linhas, com indentação

function codeMacro(body: string, lang = 'json') {
  return (
    '<ac:structured-macro ac:name="code" ac:schema-version="1">' +
    `<ac:parameter ac:name="language">${lang}</ac:parameter>` +
    `<ac:plain-text-body><![CDATA[${body}]]></ac:plain-text-body>` +
    '</ac:structured-macro>'
  );
}

describe('parseConfluenceMacros', () => {
  it('preserva quebras de linha e indentação dentro de <pre><code>', () => {
    const out = parseConfluenceMacros(`<p>Exemplo</p>\n\n   ${codeMacro(jsonCode)}\n\n<p>Fim</p>`);
    const code = out.match(/<code[^>]*>([\s\S]*?)<\/code>/)![1];
    expect(code).toBe(jsonCode);
    expect(code.split('\n')).toHaveLength(7);
    expect(code).toContain('\n  "nome"');
    expect(code).toContain('\n    1,');
    // fora do <pre> os espaços continuam normalizados
    expect(out).toContain('<p>Exemplo</p> <pre');
    expect(out.endsWith('<p>Fim</p>')).toBe(true);
  });

  it('escapa HTML do código e preserva também <pre> escrito direto no HTML', () => {
    const out = parseConfluenceMacros(`${codeMacro('if (a < b) {\n  x();\n}', 'js')}<pre>linha 1\n  linha 2</pre>`);
    expect(out).toContain('if (a &lt; b) {\n  x();\n}');
    expect(out).toContain('<pre>linha 1\n  linha 2</pre>');
  });

  it('mantém dois blocos de código independentes', () => {
    const out = parseConfluenceMacros(codeMacro('a\n b') + '<p>meio</p>' + codeMacro('c\n  d', 'txt'));
    expect(out).toContain('a\n b</code></pre>');
    expect(out).toContain('c\n  d</code></pre>');
  });

  it('troca imagem anexada por um marcador legível', () => {
    const out = parseConfluenceMacros(
      '<p>Fluxo:</p><ac:image ac:width="400"><ri:attachment ri:filename="fluxo.png" /></ac:image>'
    );
    expect(out).toContain('<p class="wiki-image-missing">Imagem do TDN: fluxo.png</p>');
    expect(out).not.toMatch(/ac:|ri:/);
  });

  it('escapa o nome do arquivo do anexo', () => {
    const out = parseConfluenceMacros('<ac:image><ri:attachment ri:filename="a&lt;b.png"/></ac:image>');
    expect(out).toContain('Imagem do TDN: a&amp;lt;b.png');
  });

  it('gera <img> para imagem por URL', () => {
    const out = parseConfluenceMacros(
      '<ac:image ac:alt="Diagrama"><ri:url ri:value="https://tdn.exemplo.com/img.png?a=1&amp;b=2"/></ac:image>'
    );
    expect(out).toBe('<img src="https://tdn.exemplo.com/img.png?a=1&amp;b=2" alt="Diagrama">');
  });

  it('gera <img> sem alt quando não há texto alternativo', () => {
    const out = parseConfluenceMacros('<ac:image><ri:url ri:value="https://x.com/a.png"/></ac:image>');
    expect(out).toBe('<img src="https://x.com/a.png" alt="">');
  });

  it('converte painel info com título', () => {
    const out = parseConfluenceMacros(
      '<ac:structured-macro ac:name="info">' +
        '<ac:parameter ac:name="title">Atenção</ac:parameter>' +
        '<ac:rich-text-body><p>Leia antes.</p></ac:rich-text-body>' +
        '</ac:structured-macro>'
    );
    expect(out).toContain('wiki-panel wiki-panel-info');
    expect(out).toContain('<div class="wiki-panel-title">Atenção</div>');
    expect(out).toContain('<p>Leia antes.</p>');
    expect(out).not.toMatch(/ac:/);
  });

  it('converte note em painel info, warning e tip', () => {
    const mk = (n: string) =>
      `<ac:structured-macro ac:name="${n}"><ac:rich-text-body><p>x</p></ac:rich-text-body></ac:structured-macro>`;
    expect(parseConfluenceMacros(mk('note'))).toContain('wiki-panel-info');
    expect(parseConfluenceMacros(mk('warning'))).toContain('wiki-panel-warning');
    expect(parseConfluenceMacros(mk('tip'))).toContain('wiki-panel-tip');
  });

  it('converte deck/card em seções', () => {
    const out = parseConfluenceMacros(
      '<ac:structured-macro ac:name="deck"><ac:rich-text-body>' +
        '<ac:structured-macro ac:name="card"><ac:parameter ac:name="label">Passo 1</ac:parameter>' +
        '<ac:rich-text-body><p>Faça isto</p></ac:rich-text-body></ac:structured-macro>' +
        '</ac:rich-text-body></ac:structured-macro>'
    );
    expect(out).toContain('wiki-tabs-container');
    expect(out).toContain('<h3 class="wiki-tab-title">Passo 1</h3>');
    expect(out).toContain('Faça isto');
  });

  it('normaliza espaços fora de blocos de código e devolve vazio para entrada vazia', () => {
    expect(parseConfluenceMacros('<p>a</p>\n\n   <p>b&nbsp;c</p>')).toBe('<p>a</p> <p>b c</p>');
    expect(parseConfluenceMacros('')).toBe('');
  });
});
