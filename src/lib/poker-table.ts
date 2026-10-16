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
// Entrada do time na mesa (animação ao iniciar o refinamento)
// ---------------------------------------------------------------------------

/** Duração de cada assento entrando (ms). */
export const INTRO_SEAT_MS = 320;
/** A entrada inteira (último assento incluso) nunca passa disso, mesmo com a mesa cheia. */
export const INTRO_TOTAL_MS = 900;
/** Atraso máximo entre um assento e o seguinte (ms). */
export const INTRO_STEP_MAX_MS = 45;
/** Quem chega depois entra sozinho, mais curto. */
export const LATE_SEAT_MS = 260;

export interface IntroTiming {
  /** Atraso entre assentos consecutivos (ms). */
  step: number;
  duration: number;
  /** Do início ao fim do último assento (ms). */
  total: number;
}

/** Escalonamento dos assentos: até 45 ms entre um e outro, apertando para a entrada toda caber em 900 ms. */
export function introTiming(count: number): IntroTiming {
  const gaps = Math.max(0, count - 1);
  const step = gaps === 0 ? 0 : Math.max(0, Math.min(INTRO_STEP_MAX_MS, Math.floor((INTRO_TOTAL_MS - INTRO_SEAT_MS) / gaps)));
  return { step, duration: INTRO_SEAT_MS, total: step * gaps + INTRO_SEAT_MS };
}

/**
 * De onde o assento parte: a meio caminho entre a posição final e o centro da mesa
 * (`pull` = fração do trajeto), com o deslocamento limitado a `maxDist` px.
 */
export function introOffset(seat: { x: number; y: number }, center: { x: number; y: number }, pull = 0.5, maxDist = 180): { dx: number; dy: number } {
  const dx = (center.x - seat.x) * pull;
  const dy = (center.y - seat.y) * pull;
  const dist = Math.hypot(dx, dy);
  const k = dist > maxDist && dist > 0 ? maxDist / dist : 1;
  return { dx: Math.round(dx * k), dy: Math.round(dy * k) };
}

/** Quem apareceu desde a última conferência (ordem preservada). */
export function newcomersOf(seen: ReadonlySet<string>, ids: readonly string[]): string[] {
  return ids.filter((id) => !seen.has(id));
}

// ---------------------------------------------------------------------------
// Geometria da mesa e do baralho (tudo em px; o componente só mede e desenha)
// ---------------------------------------------------------------------------

export interface DeckRows {
  /** Quantas fileiras o baralho ocupa (1 sempre que couber). */
  rows: number;
  /** Cartas por fileira (a última pode ter menos). */
  perRow: number;
  /** Largura (px) da fileira: o container limita nela para as fileiras saírem equilibradas. */
  width: number;
}

/** Cartas do baralho antigo, fixas (px): nunca encolhem para caber; o que sobra quebra em fileiras. */
export const DECK_CARD_FULL = { w: 72, h: 96 } as const;
/** Baralho grande (Horas, 24 cartas). */
export const DECK_CARD_DENSE = { w: 56, h: 72 } as const;
/** Mais que isso e o baralho usa as cartas pequenas. */
export const DECK_DENSE_THRESHOLD = 14;

/**
 * Fileiras do baralho para cartas de largura fixa `cardW`, em `avail` px: cabendo
 * tudo, uma fileira; senão o menor número de fileiras, com as cartas repartidas
 * por igual (24 cartas em 2 fileiras de 12, não 16 + 8). `extra` é o espaço de
 * separadores que só existem com uma fileira. Sem largura medida (primeiro
 * render) devolve uma fileira.
 */
export function deckRows(count: number, avail: number, cardW: number, gap: number, extra = 0): DeckRows {
  if (count <= 0) return { rows: 1, perRow: 0, width: 0 };
  const single = count * cardW + (count - 1) * gap + extra;
  if (avail <= 0 || single <= avail) return { rows: 1, perRow: count, width: single };
  const maxPerRow = Math.max(1, Math.floor((avail + gap) / (cardW + gap)));
  const rows = Math.ceil(count / maxPerRow);
  const perRow = Math.ceil(count / rows);
  return { rows, perRow, width: perRow * cardW + (perRow - 1) * gap };
}

export type SeatCardSize = 'xs' | 'sm' | 'mid' | 'lg' | 'xl';

export interface TableTier {
  size: SeatCardSize;
  /** Largura e altura (px) da pegada do assento: carta + nome + papel. */
  seatW: number;
  seatH: number;
}

/** Do maior para o menor: a mesa usa o maior que cabe sem assentos se tocando. */
const TIERS: readonly TableTier[] = [
  { size: 'lg', seatW: 152, seatH: 152 },
  { size: 'mid', seatW: 140, seatH: 128 },
  { size: 'sm', seatW: 132, seatH: 110 },
  { size: 'xs', seatW: 124, seatH: 94 },
];
/** Modo apresentação: a carta cresce um degrau, com o assento acompanhando. */
const XL_TIER: TableTier = { size: 'xl', seatW: 176, seatH: 192 };

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

/** Largura da oval para poucos assentos (null = sem limite além do palco). Em apresentação (`large`) as cartas são maiores e o limite sobe. */
function compactRingWidth(count: number, large: boolean): number | null {
  const scale = large ? 1.35 : 1;
  if (count <= 4) return Math.round(720 * scale);
  if (count <= 6) return Math.round(840 * scale);
  if (count <= 8) return Math.round(980 * scale);
  return null;
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
  const full = Math.min(width, Math.round(h * RING_MAX_ASPECT));
  if (full < RING_MIN_WIDTH) return fallback;
  const tiers = large ? [XL_TIER, ...TIERS] : h >= 500 ? TIERS : TIERS.slice(1);
  // Mesa pequena não espalha os poucos assentos nas pontas de uma oval gigante: tenta primeiro uma oval mais estreita
  // (proporcional à quantidade) e só usa a largura toda se a estreita não comportar o desenho.
  const compact = compactRingWidth(count, large);
  const widths = compact !== null && compact < full ? [Math.max(RING_MIN_WIDTH, compact), full] : [full];
  for (const w of widths) {
    const dx = (width - w) / 2;
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
  }
  return fallback;
}

/** A mesa cheia cabe na oval mesmo com o palco no tamanho mínimo? Decide o modo sem depender da altura medida. */
export function ringFits(count: number, width: number, large = false, minHeight = stageMinHeight(count)): boolean {
  return tableGeometry(count, width, minHeight, large, minHeight).mode === 'ring';
}
