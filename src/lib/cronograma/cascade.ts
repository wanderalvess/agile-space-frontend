/**
 * Cascata por história: a fase que atrasa empurra o INÍCIO das seguintes, sempre em dias ÚTEIS.
 *  - fases na mesma ordem (mesmo "tier") rodam em paralelo e NÃO empurram uma à outra;
 *  - o atraso de um tier que empurra o seguinte é o PIOR caso do tier, não a soma;
 *  - o atraso próprio estica o fim da própria fase.
 */
import { shiftPt, type Pt } from './dates';

export interface CascadeInput {
  key: string;
  /** Ordem da fase na sequência da história. */
  order: number;
  /** Desempate dentro do tier (ordem de rank do Jira). */
  tie: number;
  start: Pt;
  end: Pt;
  /** Atraso próprio em dias úteis (detectado ou simulado). */
  ownSlip: number;
}

export interface CascadeResult {
  start: Pt;
  end: Pt;
  /** Fim antes de qualquer atraso. */
  plannedEnd: Pt;
  /** Dias úteis totais de deslocamento do fim (empurrão + atraso próprio). */
  shift: number;
  /** Atraso próprio. */
  own: number;
  /** Empurrão recebido de fases anteriores. */
  pushed: number;
}

export function cascadeStory(items: CascadeInput[]): Map<string, CascadeResult> {
  const sorted = [...items].sort((a, b) => a.order - b.order || a.tie - b.tie);
  const out = new Map<string, CascadeResult>();
  let push = 0;
  let pending = 0;
  let lastOrder: number | null = null;
  for (const it of sorted) {
    if (lastOrder !== null && it.order !== lastOrder) {
      push += pending;
      pending = 0;
    }
    lastOrder = it.order;
    const shift = push + it.ownSlip;
    out.set(it.key, {
      start: shiftPt(it.start, push),
      end: shiftPt(it.end, shift),
      plannedEnd: it.end,
      shift,
      own: it.ownSlip,
      pushed: push,
    });
    pending = Math.max(pending, it.ownSlip);
  }
  return out;
}
