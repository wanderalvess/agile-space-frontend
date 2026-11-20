import { describe, expect, it } from 'vitest';
import {
  coerceLike,
  draftFromRule,
  exampleValue,
  fieldName,
  groupRules,
  overrideFromDraft,
  suggestFix,
  MODE_INFO,
  MODE_DETECTION_TEXT,
  type GeneratorRule,
} from '../jolt-generator';

const rule = (over: Partial<GeneratorRule>): GeneratorRule => ({
  output: 'items[].nome', scope: 'items[]', kind: 'COPY', source: 'name', confidence: 'HIGH', pending: false,
  reason: 'mesmo valor', alternatives: [], example: '"ISAC 2"', ...over,
});

const saida = { items: [{ nome: 'ISAC 2', situacao: 1, UtilizaPrecoAtacado: 'False', emb: [{ qtd: 2 }] }], tipoIdInterno: 'X' };

describe('jolt-generator', () => {
  it('nome do campo dentro da lista e agrupamento com pendentes primeiro', () => {
    expect(fieldName(rule({ output: 'items[].emb[].qtd', scope: 'items[].emb[]' }))).toBe('qtd');
    expect(fieldName(rule({ output: 'tipoIdInterno', scope: '' }))).toBe('tipoIdInterno');
    const { pending, groups } = groupRules([
      rule({ output: 'items[].a' }),
      rule({ output: 'idInterno', scope: '' }),
      rule({ output: 'items[].b', pending: true }),
    ]);
    expect(pending.map((r) => r.output)).toEqual(['items[].b']);
    expect(groups.map((g) => g.scope)).toEqual(['', 'items[]']);
  });

  it('acha o valor de exemplo e converte o que a pessoa digitou no mesmo tipo', () => {
    expect(exampleValue(saida, 'items[].situacao')).toBe(1);
    expect(exampleValue(saida, 'items[].emb[].qtd')).toBe(2);
    expect(exampleValue(saida, 'tipoIdInterno')).toBe('X');
    expect(coerceLike('0', 1)).toBe(0);
    expect(coerceLike('1,5', 1)).toBe(1.5);
    expect(coerceLike('False', 'texto')).toBe('False');
    expect(coerceLike('true', false)).toBe(true);
  });

  it('rascunho de um de-para inferido e a escolha enviada ao backend', () => {
    const r = rule({ output: 'items[].UtilizaPrecoAtacado', kind: 'VALUE_MAP', source: 'wholesalePriceUses', example: 'N → "False"', pending: true });
    const draft = draftFromRule(r, saida);
    expect(draft.kind).toBe('VALUE_MAP');
    expect(draft.map).toEqual([{ from: 'N', to: 'False' }]);
    draft.map.push({ from: 'S', to: 'True' });
    expect(overrideFromDraft(draft, 'False')).toEqual({ kind: 'VALUE_MAP', source: 'wholesalePriceUses', map: { N: 'False', S: 'True' } });
  });

  it('fixo vira valor no tipo do exemplo; cópia sem origem não é enviada', () => {
    expect(overrideFromDraft({ kind: 'CONSTANT', source: '', value: '0', map: [], otherwise: '' }, 1)).toEqual({ kind: 'CONSTANT', value: 0 });
    expect(overrideFromDraft({ kind: 'COPY', source: '', value: '', map: [], otherwise: '' }, 'x')).toBeNull();
    const concat = draftFromRule(rule({ kind: 'CONCAT', source: "'a-' + id" }), saida);
    expect(concat.kind).toBe('COPY');
    expect(concat.source).toBe('');
  });
});

describe('campo sem origem com candidatas', () => {
  it('o ajuste começa como cópia da primeira origem sugerida; sem candidatas, como valor fixo', () => {
    const withAlts = draftFromRule(rule({ kind: 'UNRESOLVED', source: null, pending: true, alternatives: ['pedido.vendedor', 'pedido.representante'] }), saida);
    expect(withAlts.kind).toBe('COPY');
    expect(withAlts.source).toBe('pedido.vendedor');
    const none = draftFromRule(rule({ kind: 'UNRESOLVED', source: null, pending: true, alternatives: [] }), saida);
    expect(none.kind).toBe('CONSTANT');
    expect(none.source).toBe('');
  });
});

describe('conferência: o que fazer diante de cada diferença', () => {
  const diff = (kind: string, expected: unknown, actual: unknown) => ({ path: 'x', kind, expected, actual });

  it('tipo errado aponta a regra certa', () => {
    expect(suggestFix(diff('valor diferente', 298.8, '298.80'))).toMatch(/Como número/);
    expect(suggestFix(diff('valor diferente', '30', 30))).toMatch(/Como texto/);
    expect(suggestFix(diff('tipo diferente do contrato', 0, 'x'))).toMatch(/Como número/);
  });

  it('campo faltando, sobrando e lista com tamanho diferente', () => {
    expect(suggestFix(diff('faltou na saída gerada', 'a', undefined))).toMatch(/de onde ele vem/);
    expect(suggestFix(diff('a mais na saída gerada', undefined, 'a'))).toMatch(/não tem/);
    expect(suggestFix(diff('lista com tamanho diferente', [1], [1, 2]))).toMatch(/lista/);
  });
});

describe('modos CONTRATO e VALORES (decididos pelo servidor)', () => {
  it('os textos descrevem o que o backend faz, sem prometer uma escolha na tela', () => {
    expect(MODE_INFO.CONTRATO.label).toBe('Contrato');
    expect(MODE_INFO.CONTRATO.long).toMatch(/genéricos/);
    expect(MODE_INFO.CONTRATO.long).toMatch(/tipos, não valores/);
    expect(MODE_INFO.VALORES.label).toBe('Valores');
    expect(MODE_INFO.VALORES.long).toMatch(/mesmo registro/);
    expect(MODE_DETECTION_TEXT).toMatch(/decide sozinho/);
  });
});
