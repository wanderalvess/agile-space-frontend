import { describe, expect, it } from 'vitest';
import {
  convertData,
  parseErrorPosition,
  processJson,
  processXml,
  processYaml,
  SAMPLE_JSON,
  SAMPLE_XML,
  SAMPLE_YAML,
} from '../format-data';
import { formatSql, SQL_SAMPLE } from '../sql-format';
import { inferSchema, validate } from '../json-schema';
import { compareJson, generateAssertions } from '../api-contract';
import { decodeBase64, deepDecode, encodeBase64, processUrl, runBase64 } from '../encoding';
import { XLSX_MAX_BYTES, xlsxSizeError } from '../limits';

describe('Estúdio de Dados: formatar', () => {
  it('JSON: formata com 2 e 4 espaços e tabulação, e minifica', () => {
    expect(processJson('{"a":[1,2]}', 'format', 2).output).toBe('{\n  "a": [\n    1,\n    2\n  ]\n}');
    expect(processJson('{"a":1}', 'format', 4).output).toBe('{\n    "a": 1\n}');
    expect(processJson('{"a":1}', 'format', '\t').output).toBe('{\n\t"a": 1\n}');
    expect(processJson('{\n "a": 1\n}', 'minify', 2).output).toBe('{"a":1}');
    expect(processJson('   ', 'format', 2)).toEqual({ output: '', error: null });
  });

  it('JSON: o erro traz linha e coluna, que o painel usa para "Ir para o erro"', () => {
    const r = processJson('{\n  "a": 1,\n  b: 2\n}', 'format', 2);
    expect(r.output).toBe('');
    expect(r.error).toMatch(/linha \d+, coluna \d+/);
    expect(parseErrorPosition(r.error)).toMatchObject({ line: expect.any(Number), col: expect.any(Number) });
    expect(parseErrorPosition('sem posição')).toBeNull();
    expect(parseErrorPosition(null)).toBeNull();
  });

  it('XML: formata, minifica e aponta linha e coluna do erro', () => {
    expect(processXml('<a><b>1</b></a>', 'format').output).toBe('<a>\n  <b>\n    1\n  </b>\n</a>');
    expect(processXml('<a>\n  <b>1</b>\n</a>', 'minify').output).toBe('<a><b>1</b></a>');
    const bad = processXml('<a>\n<b>1</a>', 'format');
    expect(bad.output).toBe('');
    expect(parseErrorPosition(bad.error)).not.toBeNull();
  });

  it('YAML: relê e reescreve; erro com linha e coluna', () => {
    expect(processYaml('a:    1\nb:\n  - x', 2).output).toBe('a: 1\nb:\n  - x\n');
    expect(parseErrorPosition(processYaml('a: [1, 2\nb: 3', 2).error)).not.toBeNull();
  });

  it('SQL: palavras-chave em maiúsculas ou como vieram', () => {
    const up = formatSql(SQL_SAMPLE, true);
    expect(up).toContain('SELECT');
    expect(up).toContain('\nFROM');
    expect(up).toContain('GROUP BY');
    expect(formatSql('select a from b', false)).toContain('select');
  });
});

describe('Estúdio de Dados: converter', () => {
  it('os quatro pares que existiam dão a saída de antes', () => {
    expect(JSON.parse(convertData('a: 1\nb: [x, y]\n', 'yaml', 'json').output)).toEqual({ a: 1, b: ['x', 'y'] });
    expect(convertData('{"a":1,"b":[1,2]}', 'json', 'yaml').output).toBe('a: 1\nb:\n  - 1\n  - 2\n');
    expect(JSON.parse(convertData('<r id="7"><n>x</n></r>', 'xml', 'json').output)).toEqual({ r: { '@_id': '7', n: 'x' } });
    expect(convertData('{"r":{"n":"x"}}', 'json', 'xml').output).toContain('<n>x</n>');
  });

  it('YAML e XML passam pelo JSON', () => {
    expect(convertData('r:\n  n: x\n', 'yaml', 'xml').output).toContain('<n>x</n>');
    expect(convertData('<r><nome>x</nome></r>', 'xml', 'yaml').output).toBe('r:\n  nome: x\n');
  });

  it('erros por formato de origem', () => {
    expect(convertData('{a', 'json', 'yaml').error).toMatch(/JSON inválido/);
    expect(convertData('<a><b></a>', 'xml', 'json').error).toMatch(/XML inválido na linha/);
    expect(convertData('a: [1', 'yaml', 'json').error).toMatch(/YAML inválido/);
  });

  it('mesmo formato devolve o texto; vazio devolve vazio; os exemplos convertem', () => {
    expect(convertData('x', 'json', 'json').output).toBe('x');
    expect(convertData('', 'json', 'xml')).toEqual({ output: '', error: null });
    expect(convertData(SAMPLE_JSON, 'json', 'yaml').error).toBeNull();
    expect(convertData(SAMPLE_XML, 'xml', 'json').error).toBeNull();
    expect(convertData(SAMPLE_YAML, 'yaml', 'xml').error).toBeNull();
  });
});

describe('Estúdio de Dados: schema', () => {
  it('gera o schema do exemplo e valida o payload', () => {
    const schema = inferSchema({ id: 1, nome: 'x', tags: ['a'] }) as Record<string, unknown>;
    expect(schema).toMatchObject({ type: 'object', required: ['id', 'nome', 'tags'] });
    expect(validate(schema, { id: 1, nome: 'y', tags: ['b'] })).toEqual([]);
    const errs = validate(schema, { id: 'um', nome: 'y' });
    expect(errs.map((e) => e.path).sort()).toEqual(['id', 'tags']);
  });
});

describe('Diff: contrato de API', () => {
  it('compara o primeiro nível e gera asserções', () => {
    const r = compareJson('{"a":1,"b":2}', '{"a":2,"c":3}');
    expect(r.items.map((i) => i.kind).sort()).toEqual(['added', 'changed', 'missing']);
    expect(compareJson('{"a":1}', '{"a":1}').items[0].kind).toBe('same');
    expect(compareJson('{', '{}').error).toMatch(/JSON inválido/);
    expect(generateAssertions('{"ok":true,"nome":"x"}', 'postman').text).toContain("pm.expect(responseData.ok).to.be.a('boolean')");
    expect(generateAssertions('{"ok":true}', 'cypress').text).toContain("to.have.property('ok')");
    expect(generateAssertions('{"ok":true}', 'playwright').text).toContain("toHaveProperty('ok')");
    expect(generateAssertions('nada', 'postman').error).toMatch(/JSON inválido/);
  });
});

describe('Codificação', () => {
  it('Base64 ida e volta com acentos, URL-safe e erro', () => {
    expect(decodeBase64(encodeBase64('ação ✓'))).toBe('ação ✓');
    expect(encodeBase64('???>>>', true)).not.toMatch(/[+/=]/);
    expect(decodeBase64(encodeBase64('???>>>', true))).toBe('???>>>');
    expect(runBase64(encodeBase64('{"a":1}'), 'decode')).toMatchObject({ kind: 'json', output: '{\n  "a": 1\n}' });
    expect(runBase64('@@@', 'decode').error).toMatch(/Base64 inválido/);
    expect(runBase64('', 'decode')).toEqual({ output: '', error: null, kind: 'texto' });
  });

  it('URL: valor x URL completa, "+" como espaço e erro', () => {
    expect(processUrl('a b&c', 'encode', 'component', false).output).toBe('a%20b%26c');
    expect(processUrl('https://x.com/a b?q=ç', 'encode', 'url', false).output).toBe('https://x.com/a%20b?q=%C3%A7');
    expect(processUrl('a+b%20c', 'decode', 'component', true).output).toBe('a b c');
    expect(processUrl('a+b', 'decode', 'component', false).output).toBe('a+b');
    expect(processUrl('%E0%A4%A', 'decode', 'component', false).error).toMatch(/inválida/);
  });

  it('Camadas: URL, Base64 e JSON em cadeia, com campos Base64 dentro do JSON', () => {
    const inner = encodeBase64('{"usuario":"maria","perfil":"PO","obs":"conteúdo interno"}');
    const r = deepDecode(encodeURIComponent(JSON.stringify({ id: 1, payload: inner })));
    expect(r.layers.map((l) => l.kind)).toEqual(['URL', 'JSON']);
    expect(JSON.parse(r.output).payload).toEqual({ usuario: 'maria', perfil: 'PO', obs: 'conteúdo interno' });
    expect(deepDecode('texto simples e legível').layers).toEqual([]);
  });
});

describe('Planilha para CSV: limite de tamanho', () => {
  it('aceita até 20 MB e recusa acima com mensagem', () => {
    expect(XLSX_MAX_BYTES).toBe(20 * 1024 * 1024);
    expect(xlsxSizeError(XLSX_MAX_BYTES)).toBeNull();
    expect(xlsxSizeError(1000)).toBeNull();
    expect(xlsxSizeError(XLSX_MAX_BYTES + 1)).toMatch(/limite é 20 MB/);
    expect(xlsxSizeError(25 * 1024 * 1024)).toContain('25,0 MB');
  });
});
