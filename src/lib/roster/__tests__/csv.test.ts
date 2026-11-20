import { describe, it, expect } from 'vitest';
import { csvField, csvLine, decodeCsvBytes, detectDelimiter, parseCsv } from '../csv';

describe('detectDelimiter', () => {
  it('reconhece ponto e vírgula (Excel em português)', () => {
    expect(detectDelimiter('Nome;Email;Horas\nAna;ana@x.com;6,5')).toBe(';');
  });

  it('reconhece vírgula', () => {
    expect(detectDelimiter('Nome,Email,Horas\nAna,ana@x.com,6.5')).toBe(',');
  });

  it('ignora separadores dentro de aspas e o BOM', () => {
    expect(detectDelimiter('﻿"Nome, completo";Email\nAna;a@x.com')).toBe(';');
  });

  it('sem separador algum cai em vírgula', () => {
    expect(detectDelimiter('so uma coluna\noutra linha')).toBe(',');
  });
});

describe('parseCsv', () => {
  it('lê com vírgula, respeitando aspas e aspas duplas', () => {
    const { delimiter, rows } = parseCsv('a,b,c\n"Silva, Ana","diz ""oi""",3');
    expect(delimiter).toBe(',');
    expect(rows[1]).toEqual(['Silva, Ana', 'diz "oi"', '3']);
  });

  it('lê com ponto e vírgula e vírgula decimal', () => {
    const { delimiter, rows } = parseCsv('id;nome;horas\r\nana;Ana Souza;5,5\r\n\r\nbru;Bruno;6');
    expect(delimiter).toBe(';');
    expect(rows).toEqual([
      ['id', 'nome', 'horas'],
      ['ana', 'Ana Souza', '5,5'],
      ['bru', 'Bruno', '6'],
    ]);
  });

  it('quebra de linha entre aspas fica no campo', () => {
    const { rows } = parseCsv('a;b\n"linha 1\nlinha 2";x');
    expect(rows[1]).toEqual(['linha 1\nlinha 2', 'x']);
  });

  it('descarta linhas vazias e a última sem quebra', () => {
    const { rows } = parseCsv('a;b\n;\nx;y');
    expect(rows).toEqual([['a', 'b'], ['x', 'y']]);
  });
});

describe('csvField / csvLine', () => {
  it('põe aspas só quando precisa', () => {
    expect(csvField('simples')).toBe('simples');
    expect(csvField('com, vírgula')).toBe('"com, vírgula"');
    expect(csvField('com; ponto', ';')).toBe('"com; ponto"');
    expect(csvField('diz "oi"')).toBe('"diz ""oi"""');
  });

  it('monta a linha com o separador pedido', () => {
    expect(csvLine(['a', 5.5, null, 'b;c'], ';')).toBe('a;5.5;;"b;c"');
  });
});

describe('decodeCsvBytes', () => {
  it('lê UTF-8', () => {
    const bytes = new TextEncoder().encode('João;6').buffer as ArrayBuffer;
    expect(decodeCsvBytes(bytes)).toBe('João;6');
  });

  it('cai em Windows-1252 quando não é UTF-8 válido (Excel em português)', () => {
    // "João" em Windows-1252: J o ã(0xE3) o
    const bytes = new Uint8Array([0x4a, 0x6f, 0xe3, 0x6f]).buffer as ArrayBuffer;
    expect(decodeCsvBytes(bytes)).toBe('João');
  });
});
