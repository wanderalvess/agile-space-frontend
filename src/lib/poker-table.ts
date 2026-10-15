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
