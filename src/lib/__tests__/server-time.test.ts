import { afterEach, describe, expect, it, vi } from 'vitest';
import { format } from 'date-fns';
import { parseServerDate, parseServerTime } from '../server-time';

describe('parseServerDate', () => {
  it('sem zona vale UTC (acrescenta Z), inclusive com microssegundos', () => {
    expect(parseServerDate('2026-10-17T22:43:10.123456')?.toISOString()).toBe('2026-10-17T22:43:10.123Z');
    expect(parseServerDate('2026-10-17T22:43:10')?.toISOString()).toBe('2026-10-17T22:43:10.000Z');
    expect(parseServerDate('2026-10-17T22:43')?.toISOString()).toBe('2026-10-17T22:43:00.000Z');
    expect(parseServerDate('2026-10-17 22:43:10')?.toISOString()).toBe('2026-10-17T22:43:10.000Z');
  });

  it('com Z fica igual (idempotente)', () => {
    expect(parseServerDate('2026-10-17T22:43:10.123Z')?.toISOString()).toBe('2026-10-17T22:43:10.123Z');
    expect(parseServerDate('2026-10-17T22:43:10Z')?.getTime()).toBe(Date.parse('2026-10-17T22:43:10Z'));
    expect(parseServerDate('2026-10-17T22:43:10z')?.getTime()).toBe(Date.parse('2026-10-17T22:43:10Z'));
  });

  it('com deslocamento fica igual, sinal positivo ou negativo, com ou sem dois-pontos', () => {
    expect(parseServerDate('2026-10-17T19:43:10-03:00')?.toISOString()).toBe('2026-10-17T22:43:10.000Z');
    expect(parseServerDate('2026-10-17T19:43:10-0300')?.toISOString()).toBe('2026-10-17T22:43:10.000Z');
    expect(parseServerDate('2026-10-18T01:43:10+03:00')?.toISOString()).toBe('2026-10-17T22:43:10.000Z');
    expect(parseServerDate('2026-10-17T19:43:10.5-03')?.toISOString()).toBe('2026-10-17T22:43:10.500Z');
  });

  it('data pura continua sendo lida como o JS lê (UTC), sem receber Z', () => {
    expect(parseServerDate('2026-10-17')?.toISOString()).toBe('2026-10-17T00:00:00.000Z');
  });

  it('vazio, nulo, indefinido e texto inválido devolvem null', () => {
    expect(parseServerDate(null)).toBeNull();
    expect(parseServerDate(undefined)).toBeNull();
    expect(parseServerDate('')).toBeNull();
    expect(parseServerDate('   ')).toBeNull();
    expect(parseServerDate('não é data')).toBeNull();
    expect(parseServerDate('2026-13-45T25:61:00')).toBeNull();
    expect(parseServerDate(12345 as unknown as string)).toBeNull();
  });

  it('é o mesmo instante com ou sem Z, então a ordem entre carimbos mistos fica certa', () => {
    const semZona = parseServerDate('2026-10-17T22:43:10.123456');
    const comZ = parseServerDate('2026-10-17T22:43:10.123Z');
    expect(semZona?.getTime()).toBe(comZ?.getTime());
  });
});

describe('parseServerTime', () => {
  it('devolve os milissegundos ou null', () => {
    expect(parseServerTime('2026-10-17T22:43:10')).toBe(Date.UTC(2026, 9, 17, 22, 43, 10));
    expect(parseServerTime('x')).toBeNull();
    expect(parseServerTime(null)).toBeNull();
  });
});

describe('o bug da Review (22:43 UTC aparecia como 22:43 em Brasília)', () => {
  const original = process.env.TZ;
  afterEach(() => {
    if (original === undefined) delete process.env.TZ;
    else process.env.TZ = original;
    vi.restoreAllMocks();
  });

  it('em America/Sao_Paulo o carimbo sem zona mostra 19:43, não 22:43', () => {
    process.env.TZ = 'America/Sao_Paulo';
    const antes = new Date('2026-10-17T22:43:10.123456'); // leitura ingênua: horário local
    expect(format(antes, 'HH:mm')).toBe('22:43');

    const certo = parseServerDate('2026-10-17T22:43:10.123456');
    expect(certo).not.toBeNull();
    expect(format(certo as Date, 'HH:mm')).toBe('19:43');
    expect(format(certo as Date, 'dd/MM')).toBe('17/10');
  });
});
