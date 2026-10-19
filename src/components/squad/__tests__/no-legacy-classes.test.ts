import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Trava o visual novo em /squad: nada de paleta fixa (slate, gray, zinc, indigo),
 * bg-white, hex, itálico/uppercase/font-black nem texto menor que 12 px.
 * Cores de estado (emerald, amber, rose, red) e categorias do Gantt (blue, teal,
 * purple...) com par claro/escuro continuam valendo, como no kit de sala.
 *
 * Exceções justificadas:
 * - `bg-slate-600` em SquadWorkflowPhasesDialog: é um valor guardado no banco
 *   (paleta de cores das fases); trocar quebraria as fases já salvas.
 * - `text-white` só sobre fundo saturado (barra, chip colorido).
 */
const ROOT = join(__dirname, '..', '..', '..');
const DIRS = [join(ROOT, 'components', 'squad'), join(ROOT, 'app', 'squad')];

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) return name === '__tests__' ? [] : walk(p);
    return /\.(tsx?|css)$/.test(name) && !/\.test\./.test(name) ? [p] : [];
  });
}

const FORBIDDEN: [string, RegExp][] = [
  ['paleta fixa (slate/gray/zinc/neutral/indigo)', /(?:bg|text|border|ring|divide|fill|stroke|from|to|via|placeholder)-(?:slate|gray|zinc|neutral|indigo)-\d+/],
  ['bg-white', /(?<![\w-])bg-white/],
  ['dark:text-white', /dark:(?:hover:)?text-white/],
  ['hex fixo', /['"`]#[0-9a-fA-F]{3,8}['"`]/],
  ['uppercase/italic/font-black', /(?<![\w-])(?:uppercase|italic|font-black)(?![\w-])/],
  ['texto menor que 12px', /text-\[(?:[0-9]|1[01])(?:\.\d+)?px\]/],
  ['fontSize menor que 12', /fontSize[:=]\s*[{'"]*(?:[0-9]|1[01])(?:\.\d+)?(?:px)?['"}]*[,\s}/]/],
];

const ALLOWED_LINES = [/'bg-slate-600'/];

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

describe('/squad sem classes do visual antigo', () => {
  const files = DIRS.flatMap(walk);
  it('encontra arquivos para varrer', () => {
    expect(files.length).toBeGreaterThan(20);
  });
  for (const [label, re] of FORBIDDEN) {
    it(`sem ${label}`, () => {
      expect(scan(files, re)).toEqual([]);
    });
  }
  it('text-white só sobre fundo saturado', () => {
    expect(
      scan(files, /(?<![\w:-])text-white/, /bg-(?:emerald|rose|red|amber|blue|teal|purple|violet|cyan|orange)-[5-7]00|\$\{disc\.bg\}|from-amber-500|absolute top-4 bottom-4 z-10/),
    ).toEqual([]);
  });
});
