import { describe, it, expect } from 'vitest';
import { diffJson, describeValue } from '../jolt-compare';

describe('diffJson (motor local x Java)', () => {
  it('mesmo conteúdo com a ordem das chaves diferente não é divergência', () => {
    const local = { items: [{ a: 1, b: 'x' }], idInterno: '150', tipoIdInterno: 'T' };
    const java = { tipoIdInterno: 'T', idInterno: '150', items: [{ b: 'x', a: 1 }] };
    expect(diffJson(local, java)).toEqual([]);
  });

  it('1 e "1" são diferentes (é o tipo de erro que a prévia local escondia)', () => {
    expect(diffJson({ pessoaFisica: 1 }, { pessoaFisica: '1' })).toEqual([
      { path: 'pessoaFisica', kind: 'valor', local: 1, java: '1' },
    ]);
    expect(diffJson({ ok: false }, { ok: 'False' })).toHaveLength(1);
    expect(diffJson({ n: null }, { n: null })).toHaveLength(0);
  });

  it('aponta o caminho exato, inclusive dentro de listas', () => {
    const d = diffJson({ items: [{ x: 1 }, { x: 2 }] }, { items: [{ x: 1 }, { x: 3 }] });
    expect(d).toEqual([{ path: 'items[1].x', kind: 'valor', local: 2, java: 3 }]);
  });

  it('separa o que só existe de um lado', () => {
    const d = diffJson({ a: 1, soLocal: true, l: [1, 2, 3] }, { a: 1, soJava: true, l: [1, 2] });
    expect(d).toEqual(
      expect.arrayContaining([
        { path: 'soLocal', kind: 'so-local', local: true },
        { path: 'soJava', kind: 'so-java', java: true },
        { path: 'l[2]', kind: 'so-local', local: 3 },
      ])
    );
    expect(d).toHaveLength(3);
  });

  it('valores simples na raiz e limite de diferenças', () => {
    expect(diffJson(1, 2)).toEqual([{ path: '(raiz)', kind: 'valor', local: 1, java: 2 }]);
    const big = Array.from({ length: 500 }, (_, i) => i);
    expect(diffJson(big, big.map(n => n + 1)).length).toBeLessThanOrEqual(200);
  });
});

describe('describeValue', () => {
  it('mostra texto entre aspas e abrevia valores longos', () => {
    expect(describeValue('1')).toBe('"1"');
    expect(describeValue(1)).toBe('1');
    expect(describeValue(undefined)).toBe('(ausente)');
    expect(describeValue('x'.repeat(100))).toHaveLength(60);
  });
});
