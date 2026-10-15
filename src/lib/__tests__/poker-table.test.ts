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
