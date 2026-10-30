import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Trava o visual novo em Meu espaço, admin, health-check, brainstorming e squad:
 * nada de paleta fixa, bg-white/bg-black, itálico, font-black nem texto menor que 12 px.
 *
 * Exceções justificadas:
 * - `bg-slate-600` em SquadWorkflowPhasesDialog: valor guardado no banco.
 * - `bg-slate-950` / `text-slate-400` no editor de snippets: o Monaco usa vs-dark fixo.
 * - `text-white` só sobre fundo saturado (chip/botão colorido).
 * - QuickLinks: o valor 'text-slate-900 bg-slate-100' é gravado no banco (atalhos antigos).
 * - brainstorm-image.ts: fallback branco do PNG exportado, fora da interface.
 */
const ROOT = join(__dirname, '..', '..', '..');
const DIRS = [
  ['components', 'workspace'],
  ['app', 'workspace'],
  ['components', 'admin'],
  ['components', 'health-check'],
  ['components', 'brainstorming'],
  ['components', 'squad'],
].map((p) => join(ROOT, ...p));

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) return name === '__tests__' ? [] : walk(p);
    return /\.(tsx?|css)$/.test(name) && !/\.test\./.test(name) ? [p] : [];
  });
}

const FORBIDDEN: [string, RegExp][] = [
  ['paleta fixa', /(?:bg|text|border|ring|divide|fill|stroke|from|to|via|placeholder)-(?:slate|gray|zinc|neutral|stone)-\d+/],
  ['bg-white/bg-black/border-white/border-black', /(?<![\w-])(?:bg|border)-(?:white|black)(?![\w-])/],
  ['italic/font-black', /(?<![\w-])(?:italic|font-black)(?![\w-])/],
  ['texto menor que 12px', /text-\[(?:[0-9]|1[01])(?:\.\d+)?px\]/],
];

const ALLOWED_LINES = [/'bg-slate-600'/, /value: 'text-slate-900 bg-slate-100'/, /bg-slate-950/, /text-slate-400/];

function scan(files: string[], re: RegExp, extraOk?: RegExp): string[] {
  const hits: string[] = [];
  for (const f of files) {
    readFileSync(f, 'utf8').split('\n').forEach((line, i) => {
      if (re.test(line) && !ALLOWED_LINES.some((a) => a.test(line)) && !(extraOk && extraOk.test(line))) {
        hits.push(`${relative(ROOT, f)}:${i + 1}: ${line.trim().slice(0, 120)}`);
      }
    });
  }
  return hits;
}

describe('Meu espaço e demais telas sem classes do visual antigo', () => {
  const files = DIRS.flatMap(walk);
  it('encontra arquivos para varrer', () => {
    expect(files.length).toBeGreaterThan(50);
  });
  for (const [label, re] of FORBIDDEN) {
    it(`sem ${label}`, () => {
      expect(scan(files, re)).toEqual([]);
    });
  }
  it('text-white só sobre fundo saturado', () => {
    expect(
      scan(files, /(?<![\w:-])text-white/, /bg-(?:emerald|rose|red|amber|blue|teal|purple|violet|cyan|orange|fuchsia|lime)-[5-8]00|\$\{disc\.bg\}|from-amber-[57]00|absolute top-4 bottom-4 z-10/),
    ).toEqual([]);
  });
});
