import { describe, expect, it } from 'vitest';
import { extractVariables, fillVariables, splitFilled } from '../variables';

describe('campos {{nome}}', () => {
  it('lista cada campo uma vez, na ordem em que aparece', () => {
    expect(extractVariables('Resuma {{issue}} para {{ público }} e de novo {{issue}}')).toEqual(['issue', 'público']);
  });

  it('ignora ${{x}} (template de CI) e conteúdo vazio', () => {
    expect(extractVariables('run: echo ${{ secrets.TOKEN }}')).toEqual([]);
    expect(extractVariables('')).toEqual([]);
    expect(extractVariables(undefined)).toEqual([]);
  });

  it('substitui numa passada só e sem interpretar "$&"', () => {
    const out = fillVariables('A {{x}} B {{y}}', { x: 'custo $& total', y: '{{x}}' });
    expect(out).toBe('A custo $& total B {{x}}');
  });

  it('deixa o campo vazio como está', () => {
    expect(fillVariables('Olá {{nome}} e {{outro}}', { nome: 'Ana' })).toBe('Olá Ana e {{outro}}');
  });

  it('divide o texto marcando o que foi preenchido e o que falta', () => {
    const parts = splitFilled('Oi {{a}} e {{b}}!', { a: 'Ana' });
    expect(parts).toEqual([
      { text: 'Oi ', kind: 'text' },
      { text: 'Ana', kind: 'filled' },
      { text: ' e ', kind: 'text' },
      { text: '{{b}}', kind: 'empty' },
      { text: '!', kind: 'text' },
    ]);
  });
});
