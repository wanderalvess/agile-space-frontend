import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * O DevTools (hub, casca e as 25 ferramentas) usa só os tokens do tema. Paleta fixa, branco/preto literais,
 * texto menor que 12 px, caixa-alta, font-black, itálico, select nativo e window.confirm/alert quebram nos
 * 7 temas e no escuro. Este teste impede que voltem. Estado só em âmbar, verde e vermelho (com variante dark).
 */
const SRC = path.resolve(__dirname, '../../..');
const DIRS = ['components/devtools', 'app/devtools', 'lib/devtools', 'app/qa'];

const PROIBIDOS: [string, RegExp][] = [
  ['paleta fixa de estrutura', /(?<![\w-])(?:[\w[\]:./-]*:)?(?:text|bg|border|divide|ring|outline|from|via|to|fill|stroke|shadow|placeholder:text|decoration)-(?:slate|gray|zinc|neutral|stone|cyan|indigo|blue|sky|teal|violet|purple|fuchsia|pink|rose|orange|yellow|lime|green)-\d{2,3}/],
  ['branco/preto literal', /(?<![\w-])(?:[\w[\]:./-]*:)?(?:text|bg|border|ring|divide|from|via|to)-(?:white|black)(?![\w-])/],
  ['cor hexadecimal solta', /#[0-9a-fA-F]{6}\b(?![^'"]*['"]\s*\))/],
  ['texto menor que 12 px', /text-\[(?:[0-9]|1[01])px\]/],
  ['caixa-alta (uppercase)', /\suppercase(?=[\s"'`])|(?<=["'`])uppercase\s/],
  ['font-black', /font-black/],
  ['espaçamento de caixa-alta (tracking-wide/er/est)', /tracking-(?:widest|wider)/],
  ['itálico', /(?<=[\s"'`])italic(?=[\s"'`])/],
  ['select nativo', /<select[\s>]/],
  ['window.confirm/alert', /window\.(?:confirm|alert)\(|(?<![\w.])confirm\(/],
];

function arquivos(dir: string, acc: string[] = []): string[] {
  for (const nome of readdirSync(dir)) {
    const p = path.join(dir, nome);
    if (statSync(p).isDirectory()) {
      if (nome === '__tests__' || nome === 'node_modules') continue;
      arquivos(p, acc);
    } else if (/\.(tsx?|css)$/.test(nome) && !/\.test\./.test(nome)) {
      acc.push(p);
    }
  }
  return acc;
}

describe('classes legadas fora do DevTools', () => {
  const todos = DIRS.flatMap((d) => arquivos(path.join(SRC, d)));

  it('encontra os arquivos da varredura', () => {
    expect(todos.length).toBeGreaterThan(50);
  });

  for (const [nome, re] of PROIBIDOS) {
    it(`não usa ${nome}`, () => {
      const achados: string[] = [];
      for (const arq of todos) {
        readFileSync(arq, 'utf8').split('\n').forEach((linha, i) => {
          if (re.test(linha)) achados.push(`${path.relative(SRC, arq)}:${i + 1}: ${linha.trim().slice(0, 120)}`);
        });
      }
      expect(achados).toEqual([]);
    });
  }

  it('a casca e o ToolPane não repetem o rótulo de campo: ele vem de um lugar só', () => {
    const duplicados = todos.filter((f) => /const label(?:Class|Cls) =/.test(readFileSync(f, 'utf8')));
    expect(duplicados.map((f) => path.relative(SRC, f))).toEqual([]);
  });
});
