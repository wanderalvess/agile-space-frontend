import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Review (Showcase), Jolt e Prompt Hub já usam só os tokens do tema (text-foreground, bg-card, border-border...).
 * Classes de paleta fixa (slate/gray/zinc...), branco/preto literais e texto menor que 12 px quebram nos
 * 7 temas, no escuro e no tema "Leitura". Este teste impede que voltem.
 * Botão cheio colorido usa as constantes do kit (DANGER_BUTTON, SUCCESS_BUTTON, WARN_BUTTON, DANGER_HOVER).
 */
const SRC = path.resolve(__dirname, '../../..');
const DIRS = ['components/showcase', 'app/showcase', 'components/jolt', 'app/jolt', 'app/prompt-hub', 'components/prompt-hub'];

const PROIBIDOS: [string, RegExp][] = [
  ['paleta fixa (slate/gray/zinc/neutral/stone)', /(?<![\w-])(?:[\w[\]:./-]*:)?(?:text|bg|border|divide|ring|outline|from|via|to|fill|stroke|shadow|placeholder:text|decoration)-(?:slate|gray|zinc|neutral|stone)-\d{2,3}/],
  ['branco/preto literal', /(?<![\w-])(?:[\w[\]:./-]*:)?(?:text|bg|border|ring|divide|from|via|to)-(?:white|black)(?![\w-])/],
  ['texto menor que 12 px', /text-\[(?:[0-9]|1[01])px\]/],
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

describe('classes legadas fora de Review, Jolt e Prompt Hub', () => {
  const todos = DIRS.flatMap((d) => arquivos(path.join(SRC, d)));

  it('encontra os arquivos da varredura', () => {
    expect(todos.length).toBeGreaterThan(40);
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

  it('o Prompt Hub não usa window.confirm nem alert (confirmações são ConfirmDialog)', () => {
    const achados = todos.filter(arq => !/prompt-hub/.test(arq) ? false : /(?<![\w.])(?:window\.)?(?:confirm|alert)\(/.test(readFileSync(arq, 'utf8')));
    expect(achados.map(a => path.relative(SRC, a))).toEqual([]);
  });
});
