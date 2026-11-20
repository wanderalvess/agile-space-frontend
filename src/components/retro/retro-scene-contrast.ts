/**
 * Contraste (WCAG 2.x) do texto da coluna sobre o cenário da Retro. Funções puras, sem DOM: o teste lê os tokens
 * reais do `globals.css` (7 temas x claro/escuro) e confere o pior caso, para nenhum tema cair abaixo de AA.
 *
 * Espelha o CSS de `.retro-scene` e `.retro-on-scene`: a coluna é o cartão do tema a 80% sobre o cenário (o
 * desfoque só suaviza) e o texto secundário é 50% cinza do tema + 50% texto.
 */

export type Rgb = [number, number, number];

/** Opacidade do cartão da coluna sobre o cenário (`bg-card/80`). */
export const SCENE_PANEL_ALPHA = 0.8;
/** AA para texto normal. */
export const AA_NORMAL = 4.5;

/** "222.2 47% 11.2%" (o formato dos tokens do shadcn) -> RGB 0-255. */
export function hslTripleToRgb(triple: string): Rgb {
  const m = triple.trim().match(/^([\d.]+)\s+([\d.]+)%\s+([\d.]+)%$/);
  if (!m) throw new Error(`token HSL inválido: "${triple}"`);
  const h = parseFloat(m[1]) / 360;
  const s = parseFloat(m[2]) / 100;
  const l = parseFloat(m[3]) / 100;
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  const channel = (t: number) => {
    const x = ((t % 1) + 1) % 1;
    if (x < 1 / 6) return p + (q - p) * 6 * x;
    if (x < 1 / 2) return q;
    if (x < 2 / 3) return p + (q - p) * (2 / 3 - x) * 6;
    return p;
  };
  return [channel(h + 1 / 3) * 255, channel(h) * 255, channel(h - 1 / 3) * 255];
}

/** `color-mix(in srgb, a <share>%, b)`: `share` é a parte de `a` (0 a 1). */
export function mixRgb(a: Rgb, b: Rgb, share: number): Rgb {
  return [a[0] * share + b[0] * (1 - share), a[1] * share + b[1] * (1 - share), a[2] * share + b[2] * (1 - share)];
}

const lin = (v: number) => {
  const c = v / 255;
  return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
};

export function relativeLuminance(c: Rgb): number {
  return 0.2126 * lin(c[0]) + 0.7152 * lin(c[1]) + 0.0722 * lin(c[2]);
}

export function contrastRatio(a: Rgb, b: Rgb): number {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

/** Tokens do tema usados pelo cenário e pela coluna (triplas HSL do shadcn). */
export interface SceneTokens {
  background: string;
  foreground: string;
  card: string;
  mutedForeground: string;
  primary: string;
  dark: boolean;
}

/** As cores que o cenário pode pôr por baixo da coluna (mesmas variáveis de `.retro-scene`). */
export function sceneUnderColors(t: SceneTokens): Record<string, Rgb> {
  const bg = hslTripleToRgb(t.background);
  const fg = hslTripleToRgb(t.foreground);
  const pr = hslTripleToRgb(t.primary);
  const card = hslTripleToRgb(t.card);
  return {
    s1: mixRgb(pr, bg, 0.09),
    s2: mixRgb(pr, bg, 0.15),
    s3: mixRgb(pr, bg, 0.24),
    s4: mixRgb(pr, bg, 0.35),
    ln: mixRgb(fg, bg, 0.3),
    // destaque e "branco" do cenário: o disco cheio é o pior caso (a cor mais próxima do texto)
    ac: t.dark ? pr : mixRgb(pr, bg, 0.78),
    wh: t.dark ? mixRgb(fg, bg, 0.28) : mixRgb(card, bg, 0.75),
    st: t.dark ? mixRgb(fg, bg, 0.55) : mixRgb(pr, bg, 0.35),
  };
}

export interface SceneContrast {
  /** Texto principal sobre o pior fundo (o menor valor entre as cores do cenário). */
  text: number;
  /** Texto secundário (50% cinza do tema + 50% texto) sobre o pior fundo. */
  secondary: number;
  /** A cor do cenário que deu o pior resultado no texto secundário. */
  worstUnder: string;
  /** Texto secundário sobre o cartão opaco (os cartões da coluna), sem cenário por baixo. */
  secondaryOnCard: number;
}

/** Pior caso do texto da coluna sobre o cenário, no tema dado. */
export function sceneContrast(t: SceneTokens, panelAlpha = SCENE_PANEL_ALPHA): SceneContrast {
  const fg = hslTripleToRgb(t.foreground);
  const card = hslTripleToRgb(t.card);
  const secondary = mixRgb(hslTripleToRgb(t.mutedForeground), fg, 0.5);
  let text = Infinity;
  let sec = Infinity;
  let worstUnder = '';
  for (const [name, under] of Object.entries(sceneUnderColors(t))) {
    const panel = mixRgb(card, under, panelAlpha);
    text = Math.min(text, contrastRatio(fg, panel));
    const s2 = contrastRatio(secondary, panel);
    if (s2 < sec) { sec = s2; worstUnder = name; }
  }
  return {
    text,
    secondary: sec,
    worstUnder,
    secondaryOnCard: contrastRatio(secondary, card),
  };
}
