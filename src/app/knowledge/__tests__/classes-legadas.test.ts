import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';

/**
 * Conhecimento e Manual usam só os tokens do tema (foreground, muted, card, primary...), que valem nos
 * 7 temas, claro e escuro. Cores de estado (verde, âmbar, vermelho) continuam permitidas, com par escuro.
 * Este teste impede a volta das classes do visual antigo nesses diretórios.
 */
const SRC = resolve(__dirname, '../../..');
const DIRS = ['app/knowledge', 'components/knowledge', 'app/manual'];

const PROIBIDAS: Array<[string, RegExp]> = [
  ['cinzas fixos (slate, gray, zinc, neutral, stone)', /(?<![\w-])(?:[a-z-]+:)*[a-z-]*-(?:slate|gray|zinc|neutral|stone)-\d/],
  ['cores de marca antigas (cyan, indigo, violet, purple, blue, sky, teal, fuchsia, pink)', /(?<![\w-])(?:[a-z-]+:)*[a-z-]*-(?:cyan|indigo|violet|purple|blue|sky|teal|fuchsia|pink)-\d/],
  ['bg-white, text-white, text-black', /(?<![\w-])(?:[a-z-]+:)*(?:bg-white|text-white|text-black|border-white)(?![\w-])/],
  ['cor em hexadecimal', /(?<![\w-])(?:[a-z-]+:)*(?:bg|text|border|from|to|via)-\[#/],
  ['font-black', /(?<![\w-])font-black(?![\w-])/],
  ['itálico em classe', /(?:\sitalic\s|["'`]italic\s|\sitalic["'`])/],
  ['texto abaixo de 12 px', /(?<![\w-])text-\[(?:[0-9]|1[01])(?:\.\d+)?px\]|(?<![\w-])text-(?:2xs|3xs|4xs|5xs|6xs)(?![\w-])/],
  ['texto com degradê', /bg-clip-text|text-transparent/],
];

function arquivos(dir: string, saida: string[] = []): string[] {
  for (const nome of readdirSync(dir)) {
    const caminho = join(dir, nome);
    if (statSync(caminho).isDirectory()) {
      if (nome !== '__tests__') arquivos(caminho, saida);
    } else if (/\.tsx?$/.test(nome) && !/\.test\./.test(nome)) {
      saida.push(caminho);
    }
  }
  return saida;
}

describe('Conhecimento e Manual: sem classes do visual antigo', () => {
  const todos = DIRS.flatMap((d) => arquivos(join(SRC, d)));

  it('encontra os arquivos dos três diretórios', () => {
    expect(todos.length).toBeGreaterThan(40);
  });

  for (const [nome, regra] of PROIBIDAS) {
    it(`não usa ${nome}`, () => {
      const achados: string[] = [];
      for (const arquivo of todos) {
        readFileSync(arquivo, 'utf8').split(/\r?\n/).forEach((linha, i) => {
          if (regra.test(linha)) achados.push(`${relative(SRC, arquivo)}:${i + 1}`);
        });
      }
      expect(achados).toEqual([]);
    });
  }
});
