import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { AA_NORMAL, contrastRatio, hslTripleToRgb, mixRgb, type Rgb } from '../../components/retro/retro-scene-contrast';

/**
 * Contraste do QA visual (rodada 3), lido dos tokens reais do globals.css: 7 temas x claro/escuro nas combinações
 * texto/fundo que foram trocadas. Mesma técnica do teste do cenário da Retro.
 */
const ROOT = join(__dirname, '../../..');
const read = (rel: string) => readFileSync(join(ROOT, rel), 'utf8').replace(/\r\n/g, '\n');
const CSS = read('src/app/globals.css');

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
const THEMES = ['default', 'midnight', 'totvs', 'leitura', 'nebula', 'cyberpunk', 'nordic'] as const;
type Theme = (typeof THEMES)[number];

/** Tokens efetivos no <html> na ordem da cascata do globals.css. */
function tokens(theme: Theme, dark: boolean): Record<string, string> {
  const t: Record<string, string> = { ...BLOCKS.get(':root') };
  if (dark) Object.assign(t, BLOCKS.get('.dark'));
  if (theme !== 'default') {
    Object.assign(t, BLOCKS.get(`.theme-${theme}`));
    Object.assign(t, BLOCKS.get(dark ? `.dark.theme-${theme}` : `.theme-${theme}:not(.dark)`));
  }
  return t;
}
const rgb = (t: Record<string, string>, key: string): Rgb => hslTripleToRgb(t[key]);
const hex = (h: string): Rgb => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];

/** Cor que o texto `text-primary` realmente tem: a regra central do Corporativo claro troca por `foreground`. */
function brandTextColor(theme: Theme, dark: boolean): Rgb {
  const t = tokens(theme, dark);
  return theme === 'totvs' && !dark ? rgb(t, '--foreground') : rgb(t, '--primary');
}

/** Os 14 casos (7 temas x claro/escuro) no formato do it.each. */
const CASES: Array<[string, Theme, boolean]> = THEMES.flatMap((theme) =>
  [false, true].map((dark): [string, Theme, boolean] => [`${theme} ${dark ? 'escuro' : 'claro'}`, theme, dark]),
);

describe('regra central do texto de marca no Corporativo claro', () => {
  it('o globals.css tem a regra que troca text-primary por foreground só no totvs claro', () => {
    expect(CSS).toMatch(/\.theme-totvs:not\(\.dark\) :is\(\[class~="text-primary"\]/);
    expect(CSS).toMatch(/\.theme-totvs:not\(\.dark\) :is\([^)]*\) \{\s*color: hsl\(var\(--foreground\)\);/);
  });

  it('sem a regra o azul TOTVS no claro dá menos de 2:1 (o defeito medido: 1,6 a 1,7)', () => {
    const t = tokens('totvs', false);
    expect(contrastRatio(rgb(t, '--primary'), rgb(t, '--background'))).toBeLessThan(2);
    expect(contrastRatio(rgb(t, '--primary'), rgb(t, '--card'))).toBeLessThan(2);
  });

  it.each(CASES)('texto de marca lê sobre fundo e cartão: %s', (_l, theme, dark) => {
    const t = tokens(theme, dark);
    const text = brandTextColor(theme, dark);
    expect(contrastRatio(text, rgb(t, '--background'))).toBeGreaterThanOrEqual(AA_NORMAL);
    expect(contrastRatio(text, rgb(t, '--card'))).toBeGreaterThanOrEqual(AA_NORMAL);
  });

  it.each(CASES)('texto padrão sobre o tom de marca a 20% (selos do Manual): %s', (_l, theme, dark) => {
    const t = tokens(theme, dark);
    const tint = mixRgb(rgb(t, '--primary'), rgb(t, '--card'), 0.2);
    expect(contrastRatio(rgb(t, '--foreground'), tint)).toBeGreaterThanOrEqual(AA_NORMAL);
  });
});

describe('texto secundário e estados desabilitados', () => {
  it.each(CASES)('"2. Rota" desabilitado (muted-foreground sobre muted, sem opacidade): %s', (_l, theme, dark) => {
    const t = tokens(theme, dark);
    expect(contrastRatio(rgb(t, '--muted-foreground'), rgb(t, '--muted'))).toBeGreaterThanOrEqual(AA_NORMAL);
  });

  it.each(CASES)('"Em breve" e "Obter chave" no cartão (muted/40 sobre cartão, sem opacidade): %s', (_l, theme, dark) => {
    const t = tokens(theme, dark);
    const unavailable = mixRgb(rgb(t, '--muted'), rgb(t, '--card'), 0.4);
    expect(contrastRatio(rgb(t, '--muted-foreground'), unavailable)).toBeGreaterThanOrEqual(AA_NORMAL);
    expect(contrastRatio(brandTextColor(theme, dark), unavailable)).toBeGreaterThanOrEqual(AA_NORMAL);
  });

  it.each(CASES)('chip de tipo desabilitado do Prompt Hub fica >= 3:1 (antes, com opacity-40, caía abaixo): %s', (_l, theme, dark) => {
    const t = tokens(theme, dark);
    const bg = rgb(t, '--background');
    expect(contrastRatio(rgb(t, '--muted-foreground'), bg)).toBeGreaterThanOrEqual(3);
    // O que havia: o texto a 40% de opacidade sobre o fundo.
    const old = mixRgb(rgb(t, '--muted-foreground'), bg, 0.4);
    expect(contrastRatio(old, bg)).toBeLessThan(3);
  });
});

describe('capa do Teatro da Review (palcos claro e escuro)', () => {
  it.each(['stage-light', 'stage-dark'])('texto da capa lê sobre o cartão do briefing a 95%%: %s', (name) => {
    const t = { ...BLOCKS.get(`.${name}`) };
    const card = mixRgb(rgb(t, '--card'), rgb(t, '--background'), 0.95);
    expect(contrastRatio(rgb(t, '--foreground'), card)).toBeGreaterThanOrEqual(AA_NORMAL);
    expect(contrastRatio(rgb(t, '--muted-foreground'), card)).toBeGreaterThanOrEqual(AA_NORMAL);
  });

  it('o verde-menta sobre claro era 1,7:1; o valor usa o texto do palco e a capa respeita o fundo escolhido', () => {
    expect(contrastRatio(hex('#34d399'), hex('#ffffff'))).toBeLessThan(2);
    const cover = read('src/components/showcase/ShowcaseCover.tsx');
    expect(cover).toMatch(/m-0 mt-1 truncate text-sm font-bold text-foreground/);
    expect(cover).toMatch(/!session\.presentationBackground/);
  });
});

describe('barras e selos do Cronograma (texto branco sobre a cor da fase)', () => {
  const WHITE = hex('#ffffff');
  const OLD: Record<string, string> = {
    'purple-500 (escuro)': '#a855f7',
    'teal-500 (escuro)': '#14b8a6',
    'amber-600': '#d97706',
    'amber-500 (escuro)': '#f59e0b',
    'blue-500 (escuro)': '#3b82f6',
  };
  const NEW: Record<string, string> = {
    'purple-700': '#7e22ce',
    'teal-700': '#0f766e',
    'amber-700': '#b45309',
    'blue-700': '#1d4ed8',
    'cyan-800': '#155e75',
    'rose-700': '#be123c',
    'amber-800': '#92400e',
    'rose-800': '#9f1239',
  };
  it('as cores antigas ficavam abaixo de 4,5:1', () => {
    for (const [name, h] of Object.entries(OLD)) expect(contrastRatio(WHITE, hex(h)), name).toBeLessThan(AA_NORMAL);
  });
  it.each(Object.entries(NEW))('texto branco sobre %s >= 4,5:1', (_n, h) => {
    expect(contrastRatio(WHITE, hex(h))).toBeGreaterThanOrEqual(AA_NORMAL);
  });
  it('o componente usa as cores novas e nenhuma 500/600 clara com texto branco', () => {
    const src = read('src/components/squad/SquadPlansTimeline.tsx');
    expect(src).not.toMatch(/bg: '[^']*bg-(purple|teal|amber|blue)-(500|600)/);
    expect(src).not.toMatch(/\{ label: '[^']*', bg: '[^']*-(500|600)/);
    expect(src).not.toMatch(/from-amber-500/);
    expect(src).toMatch(/bg-cyan-800/);
  });
});

describe('Jolt: botão de motor selecionado', () => {
  it.each(CASES)('"JavaScript" e "Manutenção" (texto de marca sobre o cartão): %s', (_l, theme, dark) => {
    const t = tokens(theme, dark);
    expect(contrastRatio(brandTextColor(theme, dark), rgb(t, '--card'))).toBeGreaterThanOrEqual(AA_NORMAL);
  });
});

describe('varredura dos arquivos tocados', () => {
  const TOUCHED = [
    'src/components/shared/CodeBlock.tsx',
    'src/components/poker/team-chat/ChatMessageContent.tsx',
    'src/app/prompt-hub/tutorial/page.tsx',
    'src/app/manual/components/ModuleApiToolSection.tsx',
    'src/app/manual/components/ManualHero.tsx',
    'src/app/manual/page.tsx',
    'src/components/showcase/ShowcaseCover.tsx',
    'src/components/squad/SquadPlansTimeline.tsx',
    'src/app/knowledge/settings/page.tsx',
    'src/components/invite/InviteAcceptView.tsx',
  ];
  it.each(TOUCHED)('sem itálico nem fonte de 8 a 11 px: %s', (file) => {
    const code = read(file).replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
    expect(code.replace(/not-italic/g, '')).not.toMatch(/\bitalic\b/);
    expect(code).not.toMatch(/<(em|i|cite|dfn)[\s>]/);
    expect(code).not.toMatch(/text-\[(8|9|10|11)px\]/);
  });

  it('Prompt Hub: nenhum chip desabilitado usa opacity-40 e os chips de tag têm 24 px de altura', () => {
    const src = read('src/app/prompt-hub/components/Dashboard.tsx');
    expect(src).not.toMatch(/cursor-not-allowed opacity-40/);
    expect(src.match(/min-h-6/g)?.length ?? 0).toBeGreaterThanOrEqual(2);
  });

  it('copy: sem "pra/pro" coloquial nos textos de tela do convite, onboarding e squad', () => {
    for (const file of [
      'src/components/invite/InviteAcceptView.tsx',
      'src/components/onboarding/RoleStep.tsx',
      'src/components/onboarding/InviteFooter.tsx',
      'src/components/onboarding/OnboardingFlow.tsx',
      'src/components/squad/hub/NextCeremonyCard.tsx',
      'src/components/squad/hub/SquadHub.tsx',
      'src/components/squad/hub/SummaryTab.tsx',
      'src/components/squad/SquadWorkflowPhasesDialog.tsx',
      'src/components/manual/IntegrationsSection.tsx',
    ]) {
      const code = read(file).replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
      expect(code, file).not.toMatch(/\b(pra|pro|pras|pros)\b/i);
    }
    expect(read('src/components/invite/InviteAcceptView.tsx')).toContain('Convite para a squad');
  });

  it('alvos de toque: logo, breadcrumb, caixas de seleção e botões do Cronograma passam de 24 px', () => {
    expect(read('src/components/layout/AppHeader.tsx')).toMatch(/-my-2 inline-flex items-center rounded-md py-2/);
    expect(read('src/components/page/PageHeader.tsx')).toMatch(/inline-flex min-h-6 items-center/);
    expect(read('src/components/ui/checkbox.tsx')).toMatch(/after:-inset-1/);
    expect(read('src/components/squad/SquadPlansTimeline.tsx')).toMatch(/min-h-6 min-w-6/);
  });
});
