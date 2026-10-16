import { describe, it, expect } from 'vitest';
import { splitSeats, modeOf, seatToneOf, waitingLabel } from '../poker-table';

describe('mesa de votação', () => {
  it('divide os assentos com a sobra em cima', () => {
    expect(splitSeats([1, 2, 3, 4, 5])).toEqual({ top: [1, 2, 3], bottom: [4, 5] });
    expect(splitSeats([])).toEqual({ top: [], bottom: [] });
    expect(splitSeats([1])).toEqual({ top: [1], bottom: [] });
  });

  it('valor mais votado; empate não elege ninguém', () => {
    expect(modeOf(['8', '6', '8', '16'])).toBe('8');
    expect(modeOf(['8', '6'])).toBeNull();
    expect(modeOf(['5'])).toBe('5');
    expect(modeOf([])).toBeNull();
  });

  it('tom da carta: divergência manda, depois a moda', () => {
    expect(seatToneOf('8', '8', 'none')).toBe('mode');
    expect(seatToneOf('6', '8', undefined)).toBe('plain');
    expect(seatToneOf('16', '8', 'destructive')).toBe('critical');
    expect(seatToneOf('6', '8', 'warning')).toBe('warn');
  });

  it('quem falta votar, por primeiro nome', () => {
    expect(waitingLabel([])).toBe('Pronto para revelar');
    expect(waitingLabel(['Carla Mendes'])).toBe('Aguardando Carla');
    expect(waitingLabel(['Carla Mendes', 'Felipe Rocha'])).toBe('Aguardando Carla e Felipe');
    expect(waitingLabel(['A x', 'B x', 'C x', 'D x', 'E x'])).toBe('Aguardando A, B e C +2');
  });
});

import { plainSnippet } from '../poker-table';

describe('plainSnippet', () => {
  it('tira tags e entidades e colapsa espaços', () => {
    expect(plainSnippet('<p>Hoje, ao <b>encerrar</b>&nbsp;a rodada</p><p>voto fica &amp; travado</p>')).toBe('Hoje, ao encerrar a rodada voto fica & travado');
  });
  it('corta no limite com reticências e aceita vazio', () => {
    expect(plainSnippet('a'.repeat(300), 20)).toHaveLength(20);
    expect(plainSnippet('a'.repeat(300), 20).endsWith('…')).toBe(true);
    expect(plainSnippet(null)).toBe('');
  });
});

import {
  CENTER_BOX,
  DECK_CARD_DENSE,
  INTRO_STEP_MAX_MS,
  INTRO_TOTAL_MS,
  DECK_CARD_FULL,
  deckRows,
  ellipsePerimeter,
  ellipsePoints,
  introOffset,
  introTiming,
  newcomersOf,
  ringFits,
  stageMinHeight,
  tableGeometry,
} from '../poker-table';

describe('baralho: fileiras com cartas de tamanho fixo', () => {
  it('as cartas seguem o baralho antigo: 72 x 96 e 56 x 72 (3:4 e ~0,78)', () => {
    expect(DECK_CARD_FULL).toEqual({ w: 72, h: 96 });
    expect(DECK_CARD_FULL.w / DECK_CARD_FULL.h).toBeCloseTo(0.75, 5);
    expect(DECK_CARD_DENSE).toEqual({ w: 56, h: 72 });
  });

  it('Fibonacci cabe numa fileira em tela larga', () => {
    const r = deckRows(10, 1300, DECK_CARD_FULL.w, 12, 25);
    expect(r.rows).toBe(1);
    expect(r.width).toBe(10 * 72 + 9 * 12 + 25);
  });

  it('Horas (24 cartas de 56 px) quebra em 2 fileiras iguais em 1100 px, sem encolher a carta', () => {
    const r = deckRows(24, 1100, DECK_CARD_DENSE.w, 12);
    expect(r.rows).toBe(2);
    expect(r.perRow).toBe(12);
    expect(r.width).toBe(12 * 56 + 11 * 12);
    expect(r.width).toBeLessThanOrEqual(1100);
  });

  it('em tela larga o Horas cabe em uma fileira', () => {
    expect(deckRows(24, 1920, 56, 12, 25).rows).toBe(1);
  });

  it('largura apertada ganha mais fileiras, nunca cartas menores; a fileira nunca passa da largura', () => {
    for (const w of [300, 420, 640, 900, 1100, 1326]) {
      const r = deckRows(24, w, 56, 8);
      expect(r.rows * r.perRow).toBeGreaterThanOrEqual(24);
      expect(r.width).toBeLessThanOrEqual(Math.max(w, 56));
    }
    expect(deckRows(24, 640, 56, 8).rows).toBeGreaterThan(deckRows(24, 1100, 56, 8).rows);
  });

  it('sem largura medida (primeiro render) devolve uma fileira', () => {
    expect(deckRows(10, 0, 72, 12).rows).toBe(1);
    expect(deckRows(0, 500, 72, 12)).toEqual({ rows: 1, perRow: 0, width: 0 });
  });
});

describe('mesa oval: geometria', () => {
  it('perímetro de uma circunferência é 2πr e o da elipse fica entre os eixos', () => {
    expect(ellipsePerimeter(100, 100)).toBeCloseTo(2 * Math.PI * 100, 3);
    const p = ellipsePerimeter(400, 100);
    expect(p).toBeGreaterThan(4 * 400);
    expect(p).toBeLessThan(2 * Math.PI * 400);
  });

  it('pontos ficam sobre a elipse e são simétricos', () => {
    const pts = ellipsePoints(8, 500, 150, 400, 100);
    expect(pts).toHaveLength(8);
    for (const p of pts) {
      expect(((p.x - 500) / 400) ** 2 + ((p.y - 150) / 100) ** 2).toBeCloseTo(1, 1);
    }
    // metade em cima e metade embaixo (primeiro ponto meio passo à direita do topo)
    expect(pts.filter((p) => p.y < 150)).toHaveLength(4);
    // espelhados na vertical: cada ponto tem o par do outro lado do eixo
    for (const p of pts) {
      expect(pts.some((q) => Math.abs(q.x - (1000 - p.x)) < 8 && Math.abs(q.y - p.y) < 8)).toBe(true);
    }
    expect(ellipsePoints(0, 0, 0, 1, 1)).toEqual([]);
  });

  it('mesa de 10 em 1366x768 (palco ~1326x300) é oval, com cartas pequenas e sem assentos se tocando', () => {
    const g = tableGeometry(10, 1326, 300);
    expect(g.mode).toBe('ring');
    const { seatW, seatH } = g.tier;
    g.seats.forEach((a, i) => {
      expect(a.x - seatW / 2).toBeGreaterThanOrEqual(0);
      expect(a.x + seatW / 2).toBeLessThanOrEqual(1326);
      expect(a.y - seatH / 2).toBeGreaterThanOrEqual(0);
      expect(a.y + seatH / 2).toBeLessThanOrEqual(300);
      g.seats.slice(i + 1).forEach((b) => {
        expect(Math.abs(a.x - b.x) >= seatW || Math.abs(a.y - b.y) >= seatH).toBe(true);
      });
      // nenhum assento cobre o centro da mesa
      expect(Math.abs(a.x - 663) >= (seatW + CENTER_BOX.w) / 2 || Math.abs(a.y - 150) >= (seatH + CENTER_BOX.h) / 2).toBe(true);
    });
  });

  it('palco mais alto usa carta maior', () => {
    const small = tableGeometry(8, 1300, 300).tier.seatH;
    const big = tableGeometry(8, 1300, 460).tier.seatH;
    expect(big).toBeGreaterThan(small);
  });

  it('em palco largo a oval não passa de 3,2x a altura e fica centrada', () => {
    const g = tableGeometry(6, 1900, 340);
    expect(g.mode).toBe('ring');
    const xs = g.seats.map((s) => s.x);
    expect(Math.max(...xs) + g.tier.seatW / 2).toBeLessThanOrEqual(Math.round(340 * 3.2) + (1900 - Math.round(340 * 3.2)) / 2 + 1);
    expect((Math.min(...xs) + Math.max(...xs)) / 2).toBeCloseTo(950, 0);
  });

  it('mesa de 4 num palco largo usa uma oval estreita, não as pontas do palco inteiro', () => {
    const g = tableGeometry(4, 1326, 380);
    expect(g.mode).toBe('ring');
    expect(g.felt.w).toBeLessThanOrEqual(740);
    const xs = g.seats.map((s) => s.x);
    expect((Math.min(...xs) + Math.max(...xs)) / 2).toBeCloseTo(663, 0);
  });

  it('tela estreita ou mesa cheia demais cai na grade', () => {
    expect(tableGeometry(10, 375, 300).mode).toBe('grid');
    expect(ringFits(10, 375)).toBe(false);
    expect(ringFits(10, 1326)).toBe(true);
    expect(ringFits(30, 1326)).toBe(false);
    expect(tableGeometry(0, 1326, 300).mode).toBe('grid');
  });

  it('mesa cheia pede palco mais alto; "roomy" sobe o piso', () => {
    expect(stageMinHeight(8)).toBe(300);
    expect(stageMinHeight(14)).toBe(380);
    expect(stageMinHeight(18)).toBe(460);
    expect(stageMinHeight(8, true)).toBe(380);
    expect(ringFits(14, 1326)).toBe(true);
  });
});

describe('entrada do time na mesa', () => {
  it('poucas pessoas: 45 ms entre assentos; ninguém espera à toa', () => {
    expect(introTiming(1)).toEqual({ step: 0, duration: 320, total: 320 });
    expect(introTiming(6).step).toBe(INTRO_STEP_MAX_MS);
    expect(introTiming(0).total).toBe(320);
  });

  it('mesa cheia aperta o intervalo (>= 30 ms até 20 pessoas) e a entrada nunca passa de 900 ms', () => {
    expect(introTiming(20).step).toBeGreaterThanOrEqual(30);
    for (const n of [2, 6, 10, 15, 20, 30, 60]) {
      expect(introTiming(n).total).toBeLessThanOrEqual(INTRO_TOTAL_MS);
      expect(introTiming(n).step).toBeLessThanOrEqual(INTRO_STEP_MAX_MS);
    }
  });

  it('o assento parte da metade do caminho até o centro, com teto de distância', () => {
    expect(introOffset({ x: 100, y: 50 }, { x: 300, y: 150 })).toEqual({ dx: 100, dy: 50 });
    expect(introOffset({ x: 0, y: 0 }, { x: 0, y: 0 })).toEqual({ dx: 0, dy: 0 });
    const far = introOffset({ x: 0, y: 0 }, { x: 2000, y: 0 });
    expect(far.dx).toBe(180);
    expect(far.dy).toBe(0);
  });

  it('newcomersOf devolve só quem não estava, na ordem', () => {
    expect(newcomersOf(new Set(['a', 'b']), ['a', 'c', 'b', 'd'])).toEqual(['c', 'd']);
    expect(newcomersOf(new Set(), [])).toEqual([]);
  });
});
