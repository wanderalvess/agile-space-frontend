/**
 * Cores dos gráficos (recharts) fora do fluxo normal do app — ex.: dentro do
 * modo Teatro, onde o fundo de apresentação (`isLight`) é escolhido pelo
 * usuário e pode divergir do tema claro/escuro do app (`ThemeContext`). Os
 * componentes de gráfico usam `hsl(var(--xxx))` por padrão, que só reflete o
 * tema do app — sem isso, um gráfico podia sair com texto escuro numa slide
 * escura (ou o inverso) sempre que os dois temas divergissem.
 *
 * `isLight` ausente/undefined mantém o comportamento antigo (segue o tema do
 * app via CSS var) — usado pelos gráficos fora do Teatro (editor, dashboards
 * de squad). `isLight` explícito ignora o tema do app e força as cores certas
 * pro fundo da apresentação.
 */
export function getChartTheme(isLight?: boolean) {
  if (isLight === undefined) {
    return {
      grid: 'hsl(var(--border))',
      tick: 'hsl(var(--muted-foreground))',
      cursor: 'hsl(var(--muted))',
      tooltipBg: 'hsl(var(--card))',
      tooltipText: 'hsl(var(--card-foreground))',
      tooltipBorder: 'hsl(var(--border))',
    };
  }
  return isLight
    ? {
      grid: 'rgba(15, 23, 42, 0.08)',
      tick: 'rgba(15, 23, 42, 0.45)',
      cursor: 'rgba(15, 23, 42, 0.06)',
      tooltipBg: '#ffffff',
      tooltipText: '#0f172a',
      tooltipBorder: 'rgba(15, 23, 42, 0.08)',
    }
    : {
      grid: 'rgba(255, 255, 255, 0.08)',
      tick: 'rgba(255, 255, 255, 0.45)',
      cursor: 'rgba(255, 255, 255, 0.06)',
      tooltipBg: '#171522',
      tooltipText: '#ffffff',
      tooltipBorder: 'rgba(255, 255, 255, 0.1)',
    };
}

/** Preto ou branco pro texto de um rótulo em cima de `bgColor` (hex ou hsl()),
 * pela luminância relativa — cor de categoria/paleta pode ser clara (amber,
 * lime) ou escura (violet, rose) e um branco fixo fica ilegível na metade dos
 * casos. */
export function readableLabelColor(bgColor: string): string {
  const rgb = colorToRgb(bgColor);
  if (!rgb) return '#ffffff';
  const luminance = (0.299 * rgb[0] + 0.587 * rgb[1] + 0.114 * rgb[2]) / 255;
  return luminance > 0.6 ? '#0f172a' : '#ffffff';
}

function colorToRgb(color: string): [number, number, number] | null {
  if (color.startsWith('#')) {
    const hex = color.slice(1);
    const full = hex.length === 3 ? hex.split('').map(c => c + c).join('') : hex;
    const num = parseInt(full, 16);
    if (Number.isNaN(num)) return null;
    return [(num >> 16) & 255, (num >> 8) & 255, num & 255];
  }
  const hslMatch = color.match(/hsl\(\s*([\d.]+)[,\s]+([\d.]+)%[,\s]+([\d.]+)%/i);
  if (hslMatch) {
    const [, h, s, l] = hslMatch.map(Number) as unknown as [number, number, number, number];
    return hslToRgb(h, s / 100, l / 100);
  }
  return null;
}

function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  const [r1, g1, b1] =
    h < 60 ? [c, x, 0] :
    h < 120 ? [x, c, 0] :
    h < 180 ? [0, c, x] :
    h < 240 ? [0, x, c] :
    h < 300 ? [x, 0, c] :
    [c, 0, x];
  return [Math.round((r1 + m) * 255), Math.round((g1 + m) * 255), Math.round((b1 + m) * 255)];
}
