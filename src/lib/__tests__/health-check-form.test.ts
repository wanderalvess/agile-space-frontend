import { describe, expect, it } from 'vitest';
import { MAX_DIMENSIONS, cleanDimensions, newDimensionKey, parseBulkDimensions, parseDimensionLine, remainingSlots, validateForm } from '../health-check-form';

describe('importar em massa', () => {
  it('separa título e pergunta por " - ", ": ", " – " e " — "', () => {
    expect(parseDimensionLine('Autonomia - Temos poder de decisão?')).toEqual({ title: 'Autonomia', description: 'Temos poder de decisão?' });
    expect(parseDimensionLine('Aprendizado: Estamos evoluindo?')).toEqual({ title: 'Aprendizado', description: 'Estamos evoluindo?' });
    expect(parseDimensionLine('Carga – O volume é sustentável?')).toEqual({ title: 'Carga', description: 'O volume é sustentável?' });
    expect(parseDimensionLine('Moral — Estamos motivados?')).toEqual({ title: 'Moral', description: 'Estamos motivados?' });
  });

  it('linha sem separador é só título; hífen sem espaços não separa', () => {
    expect(parseDimensionLine('Missão')).toEqual({ title: 'Missão', description: '' });
    expect(parseDimensionLine('Pós-venda')).toEqual({ title: 'Pós-venda', description: '' });
  });

  it('o primeiro separador da linha vale e o resto fica na pergunta', () => {
    expect(parseDimensionLine('Processos - Eles ajudam: ou atrapalham?')).toEqual({ title: 'Processos', description: 'Eles ajudam: ou atrapalham?' });
    expect(parseDimensionLine('Moral: bom - ou ruim?')).toEqual({ title: 'Moral', description: 'bom - ou ruim?' });
  });

  it('ignora linhas vazias e conta só as válidas', () => {
    const rows = parseBulkDimensions('A - um\n\n   \nB\nC: três\n');
    expect(rows.map((r) => r.title)).toEqual(['A', 'B', 'C']);
  });

  it('respeita os limites de tamanho do servidor', () => {
    const r = parseDimensionLine(`${'t'.repeat(300)} - ${'d'.repeat(2500)}`);
    expect(r?.title).toHaveLength(255);
    expect(r?.description).toHaveLength(2000);
  });
});

describe('validação', () => {
  const dim = (title: string) => ({ key: newDimensionKey(), title, description: '' });

  it('título obrigatório e ao menos uma pergunta', () => {
    expect(validateForm('', [dim('A')])).toEqual({ title: 'Dê um título para a pesquisa.' });
    expect(validateForm('Radar', [])).toEqual({ dimensions: 'Adicione pelo menos uma pergunta.' });
    expect(validateForm('Radar', [dim('  ')])).toEqual({ dimensions: 'Adicione pelo menos uma pergunta.' });
    expect(validateForm('Radar', [dim('A')])).toEqual({});
  });

  it('avisa antes do erro 400 do servidor', () => {
    expect(validateForm('x'.repeat(256), [dim('A')]).title).toContain('255');
    const many = Array.from({ length: MAX_DIMENSIONS + 1 }, (_, i) => dim(`D${i}`));
    expect(validateForm('Radar', many).dimensions).toContain('30');
    expect(remainingSlots(28)).toBe(2);
    expect(remainingSlots(40)).toBe(0);
  });

  it('limpa as linhas em branco e apara o texto', () => {
    expect(cleanDimensions([{ key: 'a', title: ' A ', description: ' d ' }, { key: 'b', title: ' ', description: 'x' }])).toEqual([{ key: 'a', title: 'A', description: 'd' }]);
  });

  it('chaves novas nunca se repetem, nem no mesmo milissegundo', () => {
    const keys = new Set(Array.from({ length: 500 }, () => newDimensionKey()));
    expect(keys.size).toBe(500);
  });
});
