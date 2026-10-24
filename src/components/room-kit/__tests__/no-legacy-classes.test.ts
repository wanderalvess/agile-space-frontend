import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Trava o visual novo no Poker (incl. team-chat), na sala (app/room), na Home,
 * no kit de sala e na Retro: nada de paleta fixa, branco/preto fixo sem
 * justificativa, texto menor que 12 px, font-black ou itálico.
 *
 * Exceções explícitas:
 * - Cenário temático da Retro (RetroScene, retro-format-themes, retro-scene-contrast,
 *   SVGs dos cenários): têm teste de contraste próprio e não entram na varredura.
 * - Relatório de impressão do Poker (poker/report/ReportPrintDocument e reportPrintCss):
 *   papel branco com cores fixas por desenho, independente do tema.
 * - ExportRetroDialog: 'italic' e os tamanhos em pt são do jsPDF (PDF), não CSS.
 * - Scrim do modal (bg-black), fundo do QR (bg-white) e text-white dos botões cheios
 *   de perigo/sucesso/atenção em room-kit/tokens.ts: marcados com "Intencional".
 * - text-[0.5em] da unidade na face da carta (VoteKit): proporcional ao valor da carta.
 */
const ROOT = join(__dirname, '..', '..', '..');
const DIRS = ['components/poker', 'app/room', 'components/home', 'components/room-kit', 'components/retro'].map((d) => join(ROOT, d));

const SKIP_FILE = /(RetroScene|retro-format-themes|retro-scene-contrast|ReportPrintDocument|reportPrintCss|ExportRetroDialog|retro-scenes?|scenes?\/)/i;

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) return name === '__tests__' ? [] : walk(p);
    return /\.(tsx?|css)$/.test(name) && !/\.test\./.test(name) && !SKIP_FILE.test(p) ? [p] : [];
  });
}

const FORBIDDEN: [string, RegExp][] = [
  ['paleta fixa (slate/gray/zinc/neutral/indigo/stone)', /(?:bg|text|border|ring|divide|fill|stroke|from|to|via|placeholder)-(?:slate|gray|zinc|neutral|indigo|stone)-\d+/],
  ['hex fixo', /['"`]#[0-9a-fA-F]{3,8}['"`]/],
  ['italic/font-black', /(?<![\w-])(?:italic|font-black)(?![\w-])/],
  ['texto menor que 12px', /text-\[(?:[0-9]|1[01])(?:\.\d+)?px\]|text-[2-6]xs/],
  ['fontSize menor que 12', /fontSize[:=]\s*[{'"]*(?:[0-9]|1[01])(?:\.\d+)?(?:px)?['"}]*[,\s}/]/],
];

const ALLOWED = [/Intencional/, /text-\[0\.5em\]/, /(?:bg|hover:bg)-(?:red|emerald|amber)-[5-8]00/];

function scan(files: string[], re: RegExp): string[] {
  const hits: string[] = [];
  for (const f of files) {
    const lines = readFileSync(f, 'utf8').split('\n');
    lines.forEach((line, i) => {
      const prev = i > 0 ? lines[i - 1] : '';
      if (re.test(line) && !ALLOWED.some((a) => a.test(line) || a.test(prev))) {
        hits.push(`${relative(ROOT, f)}:${i + 1}: ${line.trim().slice(0, 120)}`);
      }
    });
  }
  return hits;
}

describe('Poker, sala, Home, kit de sala e Retro sem classes do visual antigo', () => {
  const files = DIRS.flatMap(walk);
  it('encontra arquivos para varrer', () => {
    expect(files.length).toBeGreaterThan(40);
  });
  for (const [label, re] of FORBIDDEN) {
    it(`sem ${label}`, () => {
      expect(scan(files, re)).toEqual([]);
    });
  }
  it('bg-white/bg-black só com justificativa', () => {
    expect(scan(files, /(?<![\w:-])bg-(?:white|black)(?![\w-])/)).toEqual([]);
  });
  it('text-white só sobre fundo saturado (tokens.ts) e marcado', () => {
    expect(scan(files, /(?<![\w:-])text-(?:white|black)(?![\w-])|hover:text-white/)).toEqual([]);
  });
});
