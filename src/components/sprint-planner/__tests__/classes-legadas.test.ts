import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * O Sprint Planner nasce só com tokens do tema (text-foreground, bg-card, border-border...). Paleta fixa, branco/preto
 * literais, texto menor que 12 px, texto em degradê, a palavra "engenharia" e o nome da empresa quebram os 7 temas
 * ou as regras de marca. Mesmo padrão de components/showcase/__tests__/classes-legadas.test.ts.
 */
const SRC = path.resolve(__dirname, '../../..');
const DIRS = ['components/sprint-planner', 'app/sprint-planner', 'lib/sprint-planner'];

const PROIBIDOS: [string, RegExp][] = [
  ['paleta fixa (slate/gray/zinc/neutral/stone)', /(?<![\w-])(?:[\w[\]:./-]*:)?(?:text|bg|border|divide|ring|outline|from|via|to|fill|stroke|shadow|placeholder:text|decoration)-(?:slate|gray|zinc|neutral|stone)-\d{2,3}/],
  ['branco/preto literal', /(?<![\w-])(?:[\w[\]:./-]*:)?(?:text|bg|border|ring|divide|from|via|to)-(?:white|black)(?![\w-])/],
  ['texto menor que 12 px', /text-\[(?:[0-9]|1[01])px\]/],
  ['texto em degradê', /bg-clip-text|text-transparent/],
  ['"engenharia" na copy', /engenharia/i],
  ['nome da empresa visível', /totvs/i],
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

describe('classes legadas no Sprint Planner', () => {
  const todos = DIRS.flatMap((d) => arquivos(path.join(SRC, d)));

  it('encontra os arquivos da varredura', () => {
    expect(todos.length).toBeGreaterThan(10);
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
});
