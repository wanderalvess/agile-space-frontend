import { describe, expect, it } from 'vitest';
import {
  coerceLike,
  draftFromRule,
  exampleValue,
  fieldName,
  groupRules,
  overrideFromDraft,
  parseJsonText,
  type GeneratorRule,
} from '../jolt-generator';

const rule = (over: Partial<GeneratorRule>): GeneratorRule => ({
  output: 'items[].nome', scope: 'items[]', kind: 'COPY', source: 'name', confidence: 'HIGH', pending: false,
  reason: 'mesmo valor', alternatives: [], example: '"ISAC 2"', ...over,
});

const saida = { items: [{ nome: 'ISAC 2', situacao: 1, UtilizaPrecoAtacado: 'False', emb: [{ qtd: 2 }] }], tipoIdInterno: 'X' };

describe('jolt-generator', () => {
  it('lê o JSON colado e aponta a linha do erro', () => {
    expect(parseJsonText('{"a":1}')).toEqual({ ok: true, value: { a: 1 } });
    const bad = parseJsonText('{\n"a": 1,\n}');
    expect(bad.ok).toBe(false);
    expect(parseJsonText('   ')).toEqual({ ok: false, error: 'Cole um JSON.' });
  });

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
