/** Lógica pura da mesa de votação (assentos, valor mais votado, tom da carta). */

/** Metade de cima e metade de baixo da mesa: a de cima fica com a sobra. */
export function splitSeats<T>(items: readonly T[]): { top: T[]; bottom: T[] } {
  const topCount = Math.ceil(items.length / 2);
  return { top: items.slice(0, topCount), bottom: items.slice(topCount) };
}

/** Valor mais votado; empate devolve null (nenhuma carta é "a" moda). */
export function modeOf(values: readonly string[]): string | null {
  const counts = new Map<string, number>();
  for (const v of values) counts.set(v, (counts.get(v) ?? 0) + 1);
  let best: string | null = null;
  let bestN = 0;
  let tie = false;
  counts.forEach((n, v) => {
    if (n > bestN) { best = v; bestN = n; tie = false; }
    else if (n === bestN) tie = true;
  });
  return tie && counts.size > 1 ? null : best;
}

export type SeatTone = 'plain' | 'mode' | 'warn' | 'critical';

/** Divergência manda; sem ela, a carta que é o valor mais votado ganha destaque. */
export function seatToneOf(value: string, mode: string | null, divergence: 'warning' | 'destructive' | 'none' | undefined): SeatTone {
  if (divergence === 'destructive') return 'critical';
  if (divergence === 'warning') return 'warn';
  return mode !== null && value === mode ? 'mode' : 'plain';
}

/** Quem falta votar, em primeiros nomes: "Ana, Bruno e Carla" (até 3, o resto vira "+N"). */
export function waitingLabel(nicknames: readonly string[]): string {
  const first = nicknames.map((n) => n.trim().split(/\s+/)[0]).filter(Boolean);
  if (first.length === 0) return 'Pronto para revelar';
  const shown = first.slice(0, 3);
  const extra = first.length - shown.length;
  const joined = shown.length > 1 ? `${shown.slice(0, -1).join(', ')} e ${shown[shown.length - 1]}` : shown[0];
  return `Aguardando ${joined}${extra > 0 ? ` +${extra}` : ''}`;
}

/** Trecho de texto puro de uma descrição (pode vir em HTML do Jira): sem tags, espaços colapsados, cortado em `max`. */
export function plainSnippet(html: string | null | undefined, max = 220): string {
  if (!html) return '';
  const text = html
    .replace(/<\s*(br|\/p|\/li|\/div|\/h[1-6])\s*\/?>/gi, ' ')
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
  return text.length > max ? `${text.slice(0, max - 1).trimEnd()}…` : text;
}

// ---------------------------------------------------------------------------
// Geometria da mesa e do baralho (tudo em px; o componente só mede e desenha)
// ---------------------------------------------------------------------------

export interface DeckLayout {
  /** Largura da carta; a altura é 4/3 dela. */
  cardWidth: number;
  /** Quantas fileiras o baralho ocupa (1 sempre que couber). */
  rows: number;
}

export const DECK_CARD_MAX = 72;
/** Teto das cartas em telas baixas (<= 820 px de altura), para o baralho não comer a mesa. */
export const DECK_CARD_MAX_SHORT = 60;
export const DECK_CARD_MIN = 46;
const DECK_GAP = 8;

/**
 * Tamanho das cartas do baralho para caberem na largura disponível: grande
 * (até 72 px, como o baralho antigo) quando sobra espaço e menor, em uma só
 * fileira, quando o baralho tem muitas cartas (Horas, 24). Só passa para duas
 * ou três fileiras se a carta ficaria menor que o mínimo legível.
 * `extra` é o espaço de separadores (ex.: o traço antes das cartas especiais).
 * Sem largura medida (primeiro render) devolve um tamanho médio.
 */
export function deckLayout(count: number, width: number, extra = 0, maxCard = DECK_CARD_MAX): DeckLayout {
  if (count <= 0 || width <= 0) return { cardWidth: 64, rows: 1 };
  for (let rows = 1; rows <= 3; rows++) {
    const perRow = Math.ceil(count / rows);
    const free = width - 2 - (perRow - 1) * DECK_GAP - (rows === 1 ? extra : 0);
    const cardWidth = Math.floor(free / perRow);
    if (cardWidth >= DECK_CARD_MIN || rows === 3) {
      return { cardWidth: Math.max(36, Math.min(maxCard, cardWidth)), rows };
    }
  }
  return { cardWidth: DECK_CARD_MIN, rows: 3 };
}

export type SeatCardSize = 'xs' | 'sm' | 'md' | 'lg';

export interface TableTier {
  size: SeatCardSize;
  /** Largura e altura (px) da pegada do assento: carta + nome + papel. */
  seatW: number;
  seatH: number;
}

/** Do maior para o menor: a mesa usa o maior que cabe sem assentos se tocando. */
const TIERS: readonly TableTier[] = [
  { size: 'lg', seatW: 152, seatH: 144 },
  { size: 'md', seatW: 140, seatH: 120 },
  { size: 'sm', seatW: 132, seatH: 106 },
  { size: 'xs', seatW: 124, seatH: 94 },
];

export interface RingSeat {
  /** Centro do assento, em px dentro do palco. */
  x: number;
  y: number;
}

/** Perímetro aproximado de uma elipse (Ramanujan). */
export function ellipsePerimeter(rx: number, ry: number): number {
  const h = ((rx - ry) ** 2) / ((rx + ry) ** 2);
  return Math.PI * (rx + ry) * (1 + (3 * h) / (10 + Math.sqrt(4 - 3 * h)));
}

/**
 * Pontos igualmente espaçados (por comprimento de arco, não por ângulo) sobre
 * uma elipse centrada em (cx, cy), a partir do topo e no sentido horário. O
 * primeiro fica meio passo à direita do topo, então a mesa sai simétrica.
 */
export function ellipsePoints(count: number, cx: number, cy: number, rx: number, ry: number): RingSeat[] {
  if (count <= 0) return [];
  const STEPS = 720;
  const pts: { x: number; y: number; len: number }[] = [];
  let acc = 0;
  for (let i = 0; i <= STEPS; i++) {
    const t = (i / STEPS) * Math.PI * 2;
    const x = cx + rx * Math.sin(t);
    const y = cy - ry * Math.cos(t);
    if (i > 0) acc += Math.hypot(x - pts[i - 1].x, y - pts[i - 1].y);
    pts.push({ x, y, len: acc });
  }
  const out: RingSeat[] = [];
  let k = 0;
  for (let n = 0; n < count; n++) {
    const target = ((n + 0.5) / count) * acc;
    while (k < pts.length - 1 && pts[k].len < target) k++;
    out.push({ x: Math.round(pts[k].x * 10) / 10, y: Math.round(pts[k].y * 10) / 10 });
  }
  return out;
}

/** Área que o centro da mesa (total, chips por papel) ocupa e nenhum assento pode cobrir. */
export const CENTER_BOX = { w: 380, h: 64 };

function overlaps(seats: readonly RingSeat[], w: number, h: number, cx: number, cy: number): boolean {
  for (let i = 0; i < seats.length; i++) {
    // Cobre o centro da mesa?
    if (Math.abs(seats[i].x - cx) < (w + CENTER_BOX.w) / 2 && Math.abs(seats[i].y - cy) < (h + CENTER_BOX.h) / 2) return true;
    for (let j = i + 1; j < seats.length; j++) {
      if (Math.abs(seats[i].x - seats[j].x) < w && Math.abs(seats[i].y - seats[j].y) < h) return true;
    }
  }
  return false;
}

export interface TableGeometry {
  /** `ring`: oval com assentos em volta; `grid`: lista em grade (telas estreitas ou mesa cheia). */
  mode: 'ring' | 'grid';
  tier: TableTier;
  seats: RingSeat[];
  /** Feltro (a oval da mesa), em px dentro do palco. */
  felt: { x: number; y: number; w: number; h: number };
}

/** Proporção máxima da oval (largura / altura): em tela larga ela não vira uma pista esticada. */
export const RING_MAX_ASPECT = 3.2;

/** Largura mínima do palco para desenhar a oval. */
export const RING_MIN_WIDTH = 620;
/** Altura mínima do palco da oval (px) para `count` assentos: mesa cheia pede mais altura. `roomy` (tela com rolagem de qualquer jeito) sobe o piso. */
export function stageMinHeight(count: number, roomy = false): number {
  const base = count <= 12 ? 300 : count <= 16 ? 380 : 460;
  return roomy ? Math.max(base, 380) : base;
}

/** Espaço livre mínimo no centro da oval (px). */
export const CENTER_MIN_HEIGHT = 100;
export const CENTER_MIN_WIDTH = 220;

function ringAt(count: number, width: number, height: number, tier: TableTier) {
  const rx = (width - tier.seatW) / 2 - 4;
  const ry = (height - tier.seatH) / 2 - 4;
  if (rx <= 0 || ry <= 0) return null;
  // O miolo da oval (entre as fileiras de cima e de baixo) precisa dar para o total e os chips por papel.
  if (ry * 2 - tier.seatH < CENTER_MIN_HEIGHT || rx * 2 - tier.seatW * 2 < CENTER_MIN_WIDTH) return null;
  const seats = ellipsePoints(count, width / 2, height / 2, rx, ry);
  if (overlaps(seats, tier.seatW, tier.seatH, width / 2, height / 2)) return null;
  return { seats, rx, ry };
}

/**
 * Escolhe o desenho da mesa para `count` assentos num palco de width x height (altura nunca abaixo de `minHeight`).
 * Usa o maior tamanho de carta em que os assentos não se tocam; se nem o menor
 * couber (ou o palco for estreito), cai na grade. `large` (apresentação) ou um palco alto (500 px ou mais) tentam
 * as cartas grandes primeiro.
 */
export function tableGeometry(count: number, width: number, height: number, large = false, minHeight = stageMinHeight(count)): TableGeometry {
  const fallback: TableGeometry = { mode: 'grid', tier: TIERS[2], seats: [], felt: { x: 0, y: 0, w: 0, h: 0 } };
  if (count <= 0 || width < RING_MIN_WIDTH) return fallback;
  const h = Math.max(height, minHeight);
  // A oval ocupa no máximo RING_MAX_ASPECT x a altura e fica centrada no palco.
  const w = Math.min(width, Math.round(h * RING_MAX_ASPECT));
  if (w < RING_MIN_WIDTH) return fallback;
  const dx = (width - w) / 2;
  const tiers = large || h >= 500 ? TIERS : TIERS.slice(1);
  for (const tier of tiers) {
    const ring = ringAt(count, w, h, tier);
    if (ring) {
      return {
        mode: 'ring',
        tier,
        seats: ring.seats.map((p) => ({ x: Math.round((p.x + dx) * 10) / 10, y: p.y })),
        felt: { x: dx + w / 2 - ring.rx, y: h / 2 - ring.ry, w: ring.rx * 2, h: ring.ry * 2 },
      };
    }
  }
  return fallback;
}

/** A mesa cheia cabe na oval mesmo com o palco no tamanho mínimo? Decide o modo sem depender da altura medida. */
export function ringFits(count: number, width: number, large = false, minHeight = stageMinHeight(count)): boolean {
  return tableGeometry(count, width, minHeight, large, minHeight).mode === 'ring';
}
