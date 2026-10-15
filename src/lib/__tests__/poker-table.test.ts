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
  DECK_CARD_MAX,
  DECK_CARD_MAX_SHORT,
  DECK_CARD_MIN,
  deckLayout,
  ellipsePerimeter,
  ellipsePoints,
  ringFits,
  stageMinHeight,
  tableGeometry,
} from '../poker-table';

describe('baralho: tamanho das cartas', () => {
  it('Fibonacci cabe numa fileira no tamanho cheio (72 px) em tela larga', () => {
    expect(deckLayout(10, 1300, 17)).toEqual({ cardWidth: DECK_CARD_MAX, rows: 1 });
  });

  it('Horas (24 cartas) fica numa fileira com cartas legíveis em 1366 e em 1920', () => {
    const a = deckLayout(24, 1326, 17);
    expect(a.rows).toBe(1);
    expect(a.cardWidth).toBeGreaterThanOrEqual(DECK_CARD_MIN);
    const b = deckLayout(24, 1500, 17);
    expect(b.rows).toBe(1);
    expect(b.cardWidth).toBeGreaterThanOrEqual(a.cardWidth);
  });

  it('largura apertada quebra em fileiras em vez de espremer a carta', () => {
    const l = deckLayout(24, 900, 17);
    expect(l.rows).toBeGreaterThan(1);
    expect(l.cardWidth).toBeGreaterThanOrEqual(DECK_CARD_MIN);
  });

  it('tela baixa limita o teto da carta; sem medida devolve um tamanho médio', () => {
    expect(deckLayout(10, 1300, 17, DECK_CARD_MAX_SHORT).cardWidth).toBe(DECK_CARD_MAX_SHORT);
    expect(deckLayout(10, 0)).toEqual({ cardWidth: 64, rows: 1 });
  });

  it('as cartas somadas nunca passam da largura (1 fileira)', () => {
    for (const w of [900, 1100, 1326, 1500]) {
      const l = deckLayout(24, w, 17);
      if (l.rows === 1) expect(l.cardWidth * 24 + 23 * 8 + 17).toBeLessThanOrEqual(w);
    }
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
