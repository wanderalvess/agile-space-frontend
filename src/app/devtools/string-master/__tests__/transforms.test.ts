import { applyTool, numeroPorExtenso, toCamelCase, toSlug, toStylized } from '../transforms';

const P = { delimiter: ',', limit: 100, word: '' };

describe('string-master', () => {
  it('converte nomes', () => {
    expect(toCamelCase('Criar Tarefa Nova')).toBe('criarTarefaNova');
    expect(toSlug('Reunião de Planejamento')).toBe('reuniao-de-planejamento');
    expect(applyTool('snake', 'minhaVariavelTeste', P)).toBe('minha_variavel_teste');
  });
  it('número por extenso', () => {
    expect(numeroPorExtenso(0)).toBe('zero');
    expect(numeroPorExtenso(101)).toBe('cento e um');
    expect(numeroPorExtenso(1001)).toBe('mil e um');
    expect(numeroPorExtenso(1234)).toBe('mil duzentos e trinta e quatro');
    expect(numeroPorExtenso(2500)).toBe('dois mil e quinhentos');
    expect(numeroPorExtenso(1_000_000)).toBe('um milhão');
    expect(numeroPorExtenso(100)).toBe('cem');
  });
  it('outras', () => {
    expect(toStylized('Ab')).toBe('𝔄𝔟');
    expect(applyTool('capitalize', 'olá MUNDO', P)).toBe('Olá Mundo');
    expect(applyTool('unique', 'a\nb\na', P)).toBe('a\nb');
    expect(applyTool('occurrence', 'a.b a.b', { ...P, word: 'a.b' })).toContain('2 vez');
    expect(applyTool('cut', 'abcdef', { ...P, limit: 3 })).toBe('abc...');
  });
});
