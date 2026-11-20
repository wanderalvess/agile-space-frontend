import { describe, it, expect } from 'vitest';
import JSZip from 'jszip';
import { buildImportResult, cleanDocxHtml, extractDocx, MAX_IMPORT_TEXT_CHARS } from '../knowledge-import';

describe('buildImportResult', () => {
  it('devolve text limpo e, quando há, o html', () => {
    const r = buildImportResult('a\n\n\n\nb\n', '<h1>A</h1><p>b</p>');
    expect(r).toEqual({ ok: true, text: 'a\n\nb', html: '<h1>A</h1><p>b</p>' });
  });

  it('não inclui html para arquivos sem estrutura', () => {
    expect(buildImportResult('só texto')).toEqual({ ok: true, text: 'só texto' });
  });

  it('rejeita texto vazio com 422', () => {
    const r = buildImportResult('  \n ', '<p></p>');
    expect(r).toMatchObject({ ok: false, status: 422 });
  });

  it('rejeita texto acima do limite com 413', () => {
    const r = buildImportResult('x'.repeat(MAX_IMPORT_TEXT_CHARS + 1));
    expect(r).toMatchObject({ ok: false, status: 413 });
  });
});

describe('cleanDocxHtml', () => {
  it('remove imagens e parágrafos que ficaram vazios', () => {
    expect(cleanDocxHtml('<p>a</p><p><img src="" /></p><p> </p><p>b</p>')).toBe('<p>a</p><p>b</p>');
  });
});

async function makeDocx(): Promise<Buffer> {
  const zip = new JSZip();
  zip.file(
    '[Content_Types].xml',
    '<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
      '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
      '<Default Extension="xml" ContentType="application/xml"/>' +
      '<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>' +
      '</Types>'
  );
  zip.file(
    '_rels/.rels',
    '<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
      '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>' +
      '</Relationships>'
  );
  zip.file(
    'word/document.xml',
    '<?xml version="1.0" encoding="UTF-8"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>' +
      '<w:p><w:pPr><w:pStyle w:val="Heading1"/></w:pPr><w:r><w:t>Título</w:t></w:r></w:p>' +
      '<w:p><w:r><w:rPr><w:b/></w:rPr><w:t>negrito</w:t></w:r><w:r><w:t xml:space="preserve"> normal</w:t></w:r></w:p>' +
      '</w:body></w:document>'
  );
  return Buffer.from(await zip.generateAsync({ type: 'nodebuffer' }));
}

describe('extractDocx', () => {
  it('devolve texto puro e HTML com a estrutura do Word', async () => {
    const { text, html } = await extractDocx(await makeDocx());
    expect(text).toContain('Título');
    expect(text).toContain('negrito normal');
    expect(text).not.toContain('<');
    // Sem estilos mapeados no arquivo mínimo, o negrito (run) ainda vira <strong>
    expect(html).toContain('<strong>negrito</strong>');
  });
});
