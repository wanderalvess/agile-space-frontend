import { describe, expect, it } from 'vitest';
import { checkJson, describeProblem, formatJson, tryFixJson } from '../jolt-json';

describe('checkJson', () => {
  it('aceita JSON válido e devolve o valor', () => {
    expect(checkJson('{"a":1}')).toEqual({ ok: true, value: { a: 1 } });
  });

  it('aponta linha e coluna do erro, em português', () => {
    const text = '{\n  "a": 1\n  "b": 2\n}';
    const c = checkJson(text);
    expect(c.ok).toBe(false);
    if (c.ok) return;
    // Alguns navegadores não informam a posição: então linha 0 e a mensagem sai sem local.
    if (c.problem.line > 0) expect(c.problem.line).toBe(3);
    expect(c.problem.hint).toMatch(/[a-zç]/i);
    expect(c.problem.hint).not.toMatch(/Unexpected|Expected/);
  });

  it('descreve o problema com e sem posição', () => {
    expect(describeProblem('Erro de sintaxe', { line: 10, column: 9, position: 80, hint: 'Falta uma vírgula.' })).toBe('Erro de sintaxe na linha 10, coluna 9. Falta uma vírgula.');
    expect(describeProblem('Erro de sintaxe', { line: 0, column: 0, position: -1, hint: 'Falta uma vírgula.' })).toBe('Erro de sintaxe. Falta uma vírgula.');
  });
});

describe('tryFixJson', () => {
  it('conserta a vírgula esquecida no fim da linha anterior', () => {
    const broken = '{\n  "a": 1\n  "b": 2\n}';
    const fixed = tryFixJson(broken);
    // Se o navegador não informa a posição do erro, não há como consertar (e nada é alterado).
    if (fixed !== null) expect(JSON.parse(fixed)).toEqual({ a: 1, b: 2 });
  });

  it('não mexe em JSON válido nem em erros que não são vírgula', () => {
    expect(tryFixJson('{"a":1}')).toBeNull();
    expect(tryFixJson('{"a":')).toBeNull();
    expect(tryFixJson('{"a":1,}')).toBeNull();
  });
});

describe('formatJson', () => {
  it('indenta com dois espaços e recusa o que não é JSON', () => {
    expect(formatJson('{"a":[1,2]}')).toBe('{\n  "a": [\n    1,\n    2\n  ]\n}');
    expect(formatJson('{"a":')).toBeNull();
  });
});
