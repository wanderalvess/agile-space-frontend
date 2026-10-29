import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Trava o visual novo em layout, ui, common, shared (tudo) e em login/onboarding
 * (só texto menor que 12 px): nada de paleta fixa neutra, branco/preto fixo,
 * font-black, itálico, hex em classe nem texto menor que 12 px.
 *
 * Exceções justificadas (linhas liberadas abaixo):
 * - AgileSpinner, variante `white`: spinner para fundo escuro saturado.
 * - chart-theme.ts: o Recharts precisa de hex em props (não são classes).
 */
const ROOT = join(__dirname, '..', '..', '..');
const FULL = ['layout', 'ui', 'common', 'shared'].map((d) => join(ROOT, 'components', d));
const TEXT_ONLY = ['login', 'onboarding'].map((d) => join(ROOT, 'components', d));

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) return name === '__tests__' ? [] : walk(p);
    return /\.(tsx?|css)$/.test(name) && !/\.test\./.test(name) ? [p] : [];
  });
}

const PALETTE = /(?:bg|text|border|ring|divide|fill|stroke|from|to|via|placeholder|shadow)-(?:slate|gray|zinc|neutral|stone)-\d+/;
const BW = /(?<![\w-])(?:bg|border|ring)-(?:white|black)(?![\w-])|(?<![\w:-])text-(?:white|black)(?![\w-])/;
const BW_OK = [/white: 'border-white/, /variant === 'white'/];
const SMALL = /text-\[(?:[0-9]|1[01])(?:\.\d+)?px\]|text-[2-6]xs(?![\w-])/;
const HEAVY = /(?<![\w-])(?:italic|font-black)(?![\w-])/;
const FONT_SIZE = /fontSize[:=]\s*[{'"]*(?:[0-9]|1[01])(?:\.\d+)?(?:px)?['"}]*[,\s}/]/;

function scan(files: string[], re: RegExp, ok: RegExp[] = []): string[] {
  const hits: string[] = [];
  for (const f of files) {
    readFileSync(f, 'utf8').split('\n').forEach((line, i) => {
      if (re.test(line) && !ok.some((a) => a.test(line))) {
        hits.push(`${relative(ROOT, f)}:${i + 1}: ${line.trim().slice(0, 120)}`);
      }
    });
  }
  return hits;
}

describe('layout/ui/common/shared sem classes do visual antigo', () => {
  const full = FULL.flatMap(walk);
  const all = [...full, ...TEXT_ONLY.flatMap(walk)];
  it('encontra arquivos para varrer', () => {
    expect(full.length).toBeGreaterThan(40);
  });
  it('sem paleta fixa neutra', () => expect(scan(full, PALETTE)).toEqual([]));
  it('sem branco/preto fixo sem justificativa', () => expect(scan(full, BW, BW_OK)).toEqual([]));
  it('sem font-black nem itálico', () => expect(scan(full, HEAVY)).toEqual([]));
  it('sem texto menor que 12px (inclui login e onboarding)', () => {
    expect(scan(all, SMALL)).toEqual([]);
    expect(scan(all, FONT_SIZE)).toEqual([]);
  });
  it('sem itálico em login e onboarding', () => {
    expect(scan(TEXT_ONLY.flatMap(walk), HEAVY)).toEqual([]);
  });
});
