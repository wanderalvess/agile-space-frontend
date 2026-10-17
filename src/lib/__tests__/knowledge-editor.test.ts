import { describe, it, expect } from 'vitest';
import {
  EMPTY_DOC_HTML,
  addTags,
  buildCategoryOptions,
  buildSavePayload,
  byteSizeOf,
  countWords,
  formatKb,
  formatReadingTime,
  formatWords,
  htmlToText,
  isContentEmpty,
  isDirty,
  normalizeLinkHref,
  readingMinutes,
  saveIndicator,
  statusToSend,
  suggestFolders,
  toEditorStatus,
  validateArticle,
  type ArticleSnapshot,
} from '../knowledge-editor';

describe('texto e contagem', () => {
  it('extrai o texto visível e decodifica entidades comuns', () => {
    expect(htmlToText('<h2>Visão geral</h2><p>A &amp; B&nbsp;C</p>')).toBe('Visão geral A & B C');
  });

  it('conta palavras sem juntar blocos vizinhos', () => {
    expect(countWords('<p>um dois</p><p>três</p>')).toBe(3);
    expect(countWords('<ul><li>a</li><li>b</li></ul>')).toBe(2);
    expect(countWords(EMPTY_DOC_HTML)).toBe(0);
    expect(countWords(null)).toBe(0);
  });

  it('considera vazio o documento que só tem parágrafos vazios ou linha divisória', () => {
    expect(isContentEmpty('')).toBe(true);
    expect(isContentEmpty('<p></p><p>&nbsp;</p>')).toBe(true);
    expect(isContentEmpty('<hr>')).toBe(true);
    expect(isContentEmpty('<p>oi</p>')).toBe(false);
  });

  it('calcula o tempo de leitura (200 palavras por minuto, mínimo de 1 minuto)', () => {
    expect(readingMinutes(0)).toBe(0);
    expect(readingMinutes(1)).toBe(1);
    expect(readingMinutes(200)).toBe(1);
    expect(readingMinutes(201)).toBe(2);
    expect(formatReadingTime(187)).toBe('Leitura de 1 min');
    expect(formatReadingTime(0)).toBe('Sem texto ainda');
    expect(formatWords(1)).toBe('1 palavra');
    expect(formatWords(187)).toBe('187 palavras');
  });

  it('formata o tamanho em KB com vírgula e conta bytes UTF-8', () => {
    expect(formatKb(1434)).toBe('1,4 KB');
    expect(formatKb(0)).toBe('0,0 KB');
    expect(byteSizeOf('á')).toBe(2);
  });
});

describe('estado sujo', () => {
  const base: ArticleSnapshot = { title: 'API', category: 'Técnico', fullPath: 'Plataforma / APIs', status: 'published', tags: ['api'], content: '<p>texto</p>' };

  it('igual ao carregado não está sujo', () => {
    expect(isDirty(base, { ...base })).toBe(false);
  });

  it('qualquer campo alterado deixa sujo', () => {
    expect(isDirty(base, { ...base, title: 'API 2' })).toBe(true);
    expect(isDirty(base, { ...base, category: 'Suporte' })).toBe(true);
    expect(isDirty(base, { ...base, fullPath: '' })).toBe(true);
    expect(isDirty(base, { ...base, status: 'draft' })).toBe(true);
    expect(isDirty(base, { ...base, tags: ['api', 'pedidos'] })).toBe(true);
    expect(isDirty(base, { ...base, tags: ['outra'] })).toBe(true);
    expect(isDirty(base, { ...base, content: '<p>texto!</p>' })).toBe(true);
  });

  it('documento vazio ("" ou <p></p>) é o mesmo estado', () => {
    const empty: ArticleSnapshot = { ...base, title: '', content: EMPTY_DOC_HTML };
    expect(isDirty(empty, { ...empty, content: '' })).toBe(false);
  });
});

describe('indicador de salvamento', () => {
  it('cobre os quatro estados do desenho', () => {
    expect(saveIndicator({ isNew: true, dirty: false, saving: false, justSaved: false }).label).toBe('Ainda não salvo');
    expect(saveIndicator({ isNew: false, dirty: true, saving: false, justSaved: false }).label).toBe('Alterações não salvas');
    expect(saveIndicator({ isNew: false, dirty: true, saving: true, justSaved: false })).toEqual({ label: 'Salvando…', tone: 'busy' });
    expect(saveIndicator({ isNew: false, dirty: false, saving: false, justSaved: true })).toEqual({ label: 'Salvo agora', tone: 'ok' });
  });

  it('artigo novo com texto digitado continua "não salvo"; artigo carregado sem mudança está salvo', () => {
    expect(saveIndicator({ isNew: true, dirty: true, saving: false, justSaved: false }).label).toBe('Ainda não salvo');
    expect(saveIndicator({ isNew: false, dirty: false, saving: false, justSaved: false }).label).toBe('Tudo salvo');
  });

  it('mexer depois de salvar volta para "alterações não salvas"', () => {
    expect(saveIndicator({ isNew: false, dirty: true, saving: false, justSaved: true }).label).toBe('Alterações não salvas');
  });
});

describe('validação', () => {
  it('exige título e texto, com mensagens para mostrar na tela', () => {
    expect(validateArticle({ title: '  ', content: EMPTY_DOC_HTML })).toEqual({
      title: 'Dê um título ao artigo.',
      content: 'Escreva o conteúdo do artigo antes de salvar.',
    });
    expect(validateArticle({ title: 'Guia', content: '<p>oi</p>' })).toEqual({});
  });
});

describe('endereço do link', () => {
  it('aceita http, https e mailto; completa https:// quando falta', () => {
    expect(normalizeLinkHref('https://tdn.totvs.com/')).toBe('https://tdn.totvs.com/');
    expect(normalizeLinkHref('http://localhost:3000/x')).toBe('http://localhost:3000/x');
    expect(normalizeLinkHref(' tdn.totvs.com/pages ')).toBe('https://tdn.totvs.com/pages');
    expect(normalizeLinkHref('mailto:ana@totvs.com.br')).toBe('mailto:ana@totvs.com.br');
    expect(normalizeLinkHref('ana@totvs.com.br')).toBe('mailto:ana@totvs.com.br');
  });

  it('recusa esquemas perigosos e texto solto', () => {
    expect(normalizeLinkHref('javascript:alert(1)')).toBeNull();
    expect(normalizeLinkHref('JaVaScRiPt:alert(1)')).toBeNull();
    expect(normalizeLinkHref('data:text/html,<b>x</b>')).toBeNull();
    expect(normalizeLinkHref('ftp://servidor.com/a')).toBeNull();
    expect(normalizeLinkHref('mailto:sem-arroba')).toBeNull();
    expect(normalizeLinkHref('palavra')).toBeNull();
    expect(normalizeLinkHref('')).toBeNull();
    expect(normalizeLinkHref(null)).toBeNull();
  });
});

describe('categorias', () => {
  it('mantém as quatro de sempre', () => {
    expect(buildCategoryOptions()).toEqual(['Técnico', 'Processo', 'Negócio', 'Suporte']);
    expect(buildCategoryOptions('Processo')).toEqual(['Técnico', 'Processo', 'Negócio', 'Suporte']);
  });

  it('acrescenta a categoria do artigo carregado quando não é uma das quatro', () => {
    expect(buildCategoryOptions('Produto')).toEqual(['Técnico', 'Processo', 'Negócio', 'Suporte', 'Produto']);
    expect(buildCategoryOptions('  ')).toHaveLength(4);
  });
});

describe('pastas sugeridas', () => {
  const docs = [
    { fullPath: 'Plataforma / APIs / Pedidos' },
    { fullPath: 'Plataforma / APIs / Estoque' },
    { fullPath: 'Suporte / Runbooks / Plantão' },
    { fullPath: 'Sem pasta' },
    { fullPath: undefined },
    { fullPath: 'Negócio/Varejo/Lojas' },
  ];

  it('usa o caminho sem o último trecho, sem repetir e em ordem alfabética', () => {
    expect(suggestFolders(docs)).toEqual(['Negócio / Varejo', 'Plataforma / APIs', 'Suporte / Runbooks']);
  });

  it('limita a quantidade e aguenta lista vazia ou nula', () => {
    const many = Array.from({ length: 9 }, (_, i) => ({ fullPath: `Mod${i} / Pasta / Doc` }));
    expect(suggestFolders(many)).toHaveLength(5);
    expect(suggestFolders([])).toEqual([]);
    expect(suggestFolders(null)).toEqual([]);
  });
});

describe('etiquetas', () => {
  it('separa por vírgula, tira "#" e ignora repetidas (sem diferenciar maiúsculas)', () => {
    expect(addTags(['api'], 'Pedidos, #integração,API')).toEqual(['api', 'Pedidos', 'integração']);
    expect(addTags([], '   ')).toEqual([]);
  });

  it('respeita os limites do servidor', () => {
    expect(addTags([], 'x'.repeat(150))[0]).toHaveLength(100);
    const cheio = Array.from({ length: 50 }, (_, i) => `t${i}`);
    expect(addTags(cheio, 'nova')).toHaveLength(50);
  });
});

describe('status', () => {
  it('traduz o status do servidor para a tela', () => {
    expect(toEditorStatus('published')).toBe('published');
    expect(toEditorStatus('indexed')).toBe('published');
    expect(toEditorStatus('draft')).toBe('draft');
    expect(toEditorStatus('archived')).toBe('archived');
    expect(toEditorStatus(undefined)).toBe('published');
  });

  it('publicar um artigo "indexed" mantém "indexed", que o servidor aceita', () => {
    expect(statusToSend('published', 'indexed')).toBe('indexed');
    expect(statusToSend('published', 'published')).toBe('published');
    expect(statusToSend('draft', 'indexed')).toBe('draft');
  });
});

describe('payload de salvamento', () => {
  it('leva os mesmos campos de antes mais as etiquetas', () => {
    const payload = buildSavePayload({
      title: '  API de Pedidos ',
      category: 'Técnico',
      fullPath: ' Plataforma / APIs ',
      content: '<p>olá</p>',
      tags: ['api', 'pedidos'],
      status: 'published',
      userId: 'u1',
    });
    expect(payload).toEqual({
      title: 'API de Pedidos',
      category: 'Técnico',
      fullPath: 'Plataforma / APIs',
      content: '<p>olá</p>',
      status: 'published',
      tags: ['api', 'pedidos'],
      updatedBy: 'u1',
      authorId: 'u1',
      byteSize: byteSizeOf('<p>olá</p>'),
    });
  });

  it('mantém "indexed" ao publicar um artigo importado', () => {
    const payload = buildSavePayload({ title: 'T', category: 'Técnico', fullPath: '', content: '<p>x</p>', tags: [], status: 'published', originalStatus: 'indexed', userId: 'u1' });
    expect(payload.status).toBe('indexed');
  });
});
