import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Varredura das regras visuais e de texto do Jolt (telas e componentes): só tokens do tema, sem itálico, caixa-alta
 * em título, texto abaixo de 12 px, `<select>` nativo, `window.confirm`, barra fixa por cima da navegação, e as palavras
 * do motor JavaScript que saiu (a tela só fala de executar no servidor).
 */
const SRC = join(__dirname, '../../..');

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name);
    if (name === '__tests__') return [];
    return statSync(full).isDirectory() ? files(full) : /\.(tsx?|ts)$/.test(name) ? [full] : [];
  });
}

const FILES = [
  ...files(join(SRC, 'app/jolt')),
  ...files(join(SRC, 'components/jolt')),
  join(SRC, 'lib/jolt-editor-theme.ts'),
];

/** Código sem comentários (os comentários podem citar o que foi removido). */
const code = (path: string) =>
  readFileSync(path, 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '')
    .replace(/\s\/\/ .*$/gm, '');

const FORBIDDEN: [string, RegExp][] = [
  ['itálico', /\bitalic\b/],
  ['font-black', /font-black/],
  ['título em caixa-alta', /\buppercase\b/],
  ['texto menor que 12px', /text-\[(?:[0-9]|1[01])(?:\.\d+)?px\]/],
  ['cor fixa de estrutura (slate/cyan/indigo/purple/violet/sky/blue)', /\b(?:bg|text|border)-(?:slate|cyan|indigo|purple|violet|sky|blue)-\d{2,3}/],
  ['degradê em texto', /bg-clip-text/],
  ['branco/preto literal', /(?:bg|text|border)-(?:white|black)/],
  ['confirm/alert do navegador', /window\.(?:confirm|alert)\(|\balert\(/],
  ['select nativo', /<select\b/],
  ['barra presa à janela por cima da navegação', /fixed inset-x-0/],
  ['foguete', /Rocket/],
  ['"engenharia" na cópia', /[Ee]ngenharia/],
];

describe('Jolt: regras visuais', () => {
  it('encontrou os arquivos do Jolt', () => {
    expect(FILES.length).toBeGreaterThanOrEqual(14);
  });

  for (const [rule, pattern] of FORBIDDEN) {
    it(`sem ${rule}`, () => {
      const hits = FILES.filter((f) => pattern.test(code(f))).map((f) => f.replace(SRC, 'src'));
      expect(hits).toEqual([]);
    });
  }

  it('o texto das telas não fala do motor JavaScript que saiu nem de "Comparar"', () => {
    const hits = FILES.filter((f) => /[Mm]otor|JavaScript|Comparar|jolt-lite|jolt-engine/.test(code(f))).map((f) => f.replace(SRC, 'src'));
    expect(hits).toEqual([]);
  });

  it('o conteúdo inventado do guia antigo não voltou', () => {
    const hits = FILES.filter((f) => /Laborat[óo]rio da Squad|Pair Programming|isolamento total|ambiente isolado/i.test(code(f))).map((f) => f.replace(SRC, 'src'));
    expect(hits).toEqual([]);
  });

  it('o Jolt não usa mais as chaves antigas do Mapeador fora da camada de armazenamento', () => {
    const hits = FILES.filter((f) => !f.endsWith('jolt-storage.ts') && /jolt_visual_|jolt_generator_input/.test(code(f)));
    expect(hits).toEqual([]);
  });
});
