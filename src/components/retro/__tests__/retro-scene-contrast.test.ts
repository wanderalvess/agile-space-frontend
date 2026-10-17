import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  AA_NORMAL,
  SCENE_PANEL_ALPHA,
  contrastRatio,
  hslTripleToRgb,
  mixRgb,
  sceneContrast,
  type SceneTokens,
} from '../retro-scene-contrast';

// O arquivo pode vir com CRLF no Windows (autocrlf): normaliza para as buscas por trecho abaixo.
const CSS = readFileSync(join(__dirname, '../../../app/globals.css'), 'utf8').replace(/\r\n/g, '\n');

/** Blocos "seletor { declarações }" do globals.css (só os que têm declarações diretas), com o último valor de cada token. */
function parseBlocks(css: string): Map<string, Record<string, string>> {
  const clean = css.replace(/\/\*[\s\S]*?\*\//g, '');
  const blocks = new Map<string, Record<string, string>>();
  for (const m of clean.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    const selector = m[1].trim().replace(/\s+/g, ' ');
    const decls: Record<string, string> = blocks.get(selector) ?? {};
    for (const d of m[2].matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)) decls[d[1]] = d[2].trim();
    blocks.set(selector, decls);
  }
  return blocks;
}

const BLOCKS = parseBlocks(CSS);
const THEMES = ['default', 'nebula', 'cyberpunk', 'midnight', 'nordic', 'totvs', 'leitura'] as const;

/** Tokens efetivos no <html>, na ordem da cascata do globals.css: :root, .dark, .theme-x, .dark.theme-x / .theme-x:not(.dark). */
function tokensOf(theme: (typeof THEMES)[number], dark: boolean): SceneTokens {
  const t: Record<string, string> = { ...BLOCKS.get(':root') };
  if (dark) Object.assign(t, BLOCKS.get('.dark'));
  if (theme !== 'default') {
    Object.assign(t, BLOCKS.get(`.theme-${theme}`));
    Object.assign(t, BLOCKS.get(dark ? `.dark.theme-${theme}` : `.theme-${theme}:not(.dark)`));
  }
  return {
    background: t['--background'],
    foreground: t['--foreground'],
    card: t['--card'],
    mutedForeground: t['--muted-foreground'],
    primary: t['--primary'],
    dark,
  };
}

describe('contraste: funções puras', () => {
  it('preto sobre branco é 21:1 e a razão é simétrica', () => {
    const black: [number, number, number] = [0, 0, 0];
    const white: [number, number, number] = [255, 255, 255];
    expect(contrastRatio(black, white)).toBeCloseTo(21, 1);
    expect(contrastRatio(white, black)).toBeCloseTo(21, 1);
    expect(contrastRatio(white, white)).toBeCloseTo(1, 5);
  });

  it('converte tokens HSL do shadcn e mistura como o color-mix em sRGB', () => {
    const [r, g, b] = hslTripleToRgb('0 0% 100%');
    expect([Math.round(r), Math.round(g), Math.round(b)]).toEqual([255, 255, 255]);
    const [r2, g2, b2] = hslTripleToRgb('0 100% 50%');
    expect([Math.round(r2), Math.round(g2), Math.round(b2)]).toEqual([255, 0, 0]);
    expect(mixRgb([100, 100, 100], [200, 200, 200], 0.25)).toEqual([175, 175, 175]);
    expect(() => hslTripleToRgb('rojo')).toThrow();
  });
});

describe('contraste do texto da coluna sobre o cenário (7 temas, claro e escuro, tokens reais do globals.css)', () => {
  it('o leitor do globals.css achou os tokens de todos os temas', () => {
    for (const theme of THEMES) for (const dark of [false, true]) {
      const t = tokensOf(theme, dark);
      for (const key of ['background', 'foreground', 'card', 'mutedForeground', 'primary'] as const) {
        expect(t[key], `${theme} ${dark ? 'escuro' : 'claro'} ${key}`).toBeTruthy();
      }
    }
  });

  it('a coluna usa o cartão a 80% (o que o CSS aplica)', () => {
    expect(SCENE_PANEL_ALPHA).toBe(0.8);
  });

  // Leitura confortável não tem cenário (decoração desligada): fica de fora da conta, o teste do CSS abaixo garante isso.
  const WITH_SCENE = THEMES.filter((t) => t !== 'leitura');
  for (const theme of WITH_SCENE) {
    for (const dark of [false, true]) {
      it(`${theme}, ${dark ? 'escuro' : 'claro'}: texto e texto secundário passam de AA (4,5:1) no pior caso`, () => {
        const c = sceneContrast(tokensOf(theme, dark));
        expect(c.text, `texto sobre ${c.worstUnder}`).toBeGreaterThanOrEqual(AA_NORMAL);
        expect(c.secondary, `secundário sobre ${c.worstUnder}`).toBeGreaterThanOrEqual(AA_NORMAL);
        expect(c.secondaryOnCard).toBeGreaterThanOrEqual(AA_NORMAL);
      });
    }
  }

  it('o texto secundário misturado a 50% com o texto nunca fica pior que o cinza do tema', () => {
    for (const theme of WITH_SCENE) for (const dark of [false, true]) {
      const t = tokensOf(theme, dark);
      const card = hslTripleToRgb(t.card);
      const plain = contrastRatio(hslTripleToRgb(t.mutedForeground), card);
      expect(sceneContrast(t).secondaryOnCard).toBeGreaterThanOrEqual(plain - 0.001);
    }
  });
});

describe('regras de CSS do cenário', () => {
  it('o tema Leitura desliga o cenário da sala (a miniatura do seletor continua)', () => {
    expect(CSS).toContain('.theme-leitura .retro-scene:not(.retro-scene-thumb) { display: none; }');
  });

  it('o texto secundário sobre o cenário é 50% cinza do tema e 50% texto', () => {
    expect(CSS).toMatch(/\.retro-on-scene \.text-muted-foreground \{\s*color: color-mix\(in srgb, hsl\(var\(--muted-foreground\)\) 50%, hsl\(var\(--foreground\)\)\);/);
  });

  it('o bloco do cenário não usa cor fixa (hexadecimal, rgb ou nome)', () => {
    const start = CSS.indexOf('.retro-scene {');
    const block = CSS.slice(start);
    expect(block).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
    expect(block).not.toMatch(/\brgba?\(/);
    expect(block).not.toMatch(/:\s*(white|black)\b/);
  });

  it('o movimento só roda no Completo e fora de "reduzir movimento"', () => {
    const motion = CSS.slice(CSS.indexOf('@media (prefers-reduced-motion: no-preference) {\n  .retro-scene'));
    expect(motion).toContain("[data-mode='full'] .dr");
    expect(motion).toContain("[data-mode='full'] .bob");
    expect(motion).toContain("[data-mode='full'] .tw");
  });
});
