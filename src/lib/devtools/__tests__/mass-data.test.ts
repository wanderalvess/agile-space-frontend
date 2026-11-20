import { describe, expect, it } from 'vitest';
import {
  DEFAULT_CONFIG,
  MAX_QTY,
  describeConfig,
  formatMass,
  generateMass,
  newSet,
  parseQty,
  readSets,
  setsKey,
  validateLines,
  writeSets,
  type MassConfig,
} from '../mass-data';
import { validateDocument } from '../br-docs';

const cfg = (p: Partial<MassConfig>): MassConfig => ({ ...DEFAULT_CONFIG, ...p });

describe('Massa de Dados: gerar', () => {
  it('parseQty aceita de 1 a 1.000', () => {
    expect(parseQty('10')).toBe(10);
    expect(parseQty(' 1000 ')).toBe(1000);
    expect(parseQty('0')).toBeNull();
    expect(parseQty('1001')).toBeNull();
    expect(parseQty('abc')).toBeNull();
    expect(parseQty('')).toBeNull();
    expect(MAX_QTY).toBe(1000);
  });

  it('CPF: quantidade pedida, todos válidos, com ou sem máscara', () => {
    const masked = generateMass(cfg({ kind: 'cpf', qty: 25 }));
    expect(masked).toHaveLength(25);
    expect(masked[0].cpf).toMatch(/^\d{3}\.\d{3}\.\d{3}-\d{2}$/);
    expect(masked.every((r) => validateDocument(r.cpf)?.valid)).toBe(true);
    const raw = generateMass(cfg({ kind: 'cpf', qty: 3, mask: false }));
    expect(raw[0].cpf).toMatch(/^\d{11}$/);
  });

  it('CNPJ: numérico, alfanumérico e filiais com a mesma raiz; passa de 100 em fatias', () => {
    const num = generateMass(cfg({ kind: 'cnpj', qty: 5, mask: false }));
    expect(num.every((r) => /^\d{14}$/.test(r.cnpj) && validateDocument(r.cnpj)?.valid)).toBe(true);
    const alfa = generateMass(cfg({ kind: 'cnpj', cnpjAlfa: true, qty: 30, mask: false }));
    expect(alfa.every((r) => /^[0-9A-Z]{12}\d{2}$/.test(r.cnpj) && validateDocument(r.cnpj)?.valid)).toBe(true);
    expect(alfa.some((r) => /[A-Z]/.test(r.cnpj.slice(0, 12)))).toBe(true);
    const filiais = generateMass(cfg({ kind: 'cnpj', filiais: true, qty: 4, mask: false }));
    expect(new Set(filiais.map((r) => r.cnpj.slice(0, 8))).size).toBe(1);
    expect(filiais.map((r) => r.cnpj.slice(8, 12))).toEqual(['0001', '0002', '0003', '0004']);
    expect(generateMass(cfg({ kind: 'cpf', qty: 250 }))).toHaveLength(250);
  });

  it('pessoa completa e cartão', () => {
    const p = generateMass(cfg({ kind: 'pessoa', qty: 3 }));
    expect(Object.keys(p[0])).toEqual(['nome', 'email', 'cpf', 'rg', 'telefone', 'dataNascimento', 'cidade']);
    expect(validateDocument(p[0].cpf)?.valid).toBe(true);
    const c = generateMass(cfg({ kind: 'cartao', qty: 2, brand: 'elo' }));
    expect(c[0].brand).toBe('ELO');
    expect(c[0].number).toMatch(/^[\d ]+$/);
  });
});

describe('Massa de Dados: formatos de saída', () => {
  const rows = [{ nome: 'Ana "A"', cpf: '1' }, { nome: "D'Ávila", cpf: '2' }];
  it('CSV com aspas escapadas, JSON e SQL com apóstrofo escapado', () => {
    expect(formatMass(rows, 'csv', 'pessoa')).toBe('nome,cpf\n"Ana ""A""","1"\n"D\'Ávila","2"');
    expect(JSON.parse(formatMass(rows, 'json', 'pessoa'))).toEqual(rows);
    expect(formatMass(rows, 'sql', 'pessoa')).toBe("INSERT INTO tb_massa_pessoa (nome, cpf)\nVALUES\n  ('Ana \"A\"', '1'),\n  ('D''Ávila', '2');");
    expect(formatMass([], 'csv', 'cpf')).toBe('');
  });
});

describe('Massa de Dados: validar', () => {
  it('confere um documento por linha, ignora linhas vazias', () => {
    const [a, b, c, d] = validateLines('111.444.777-35\n\n123.456.789-00\n 11.222.333/0001-81 \n12345');
    expect(a.result).toMatchObject({ valid: true, kind: 'CPF' });
    expect(b.result.valid).toBe(false);
    expect(c.result).toMatchObject({ valid: true, kind: 'CNPJ' });
    expect(d.result.kind).toBeNull();
    expect(validateLines('')).toEqual([]);
  });
});

describe('Massa de Dados: conjuntos salvos', () => {
  const mem = () => {
    const data: Record<string, string> = {};
    return { getItem: (k: string) => data[k] ?? null, setItem: (k: string, v: string) => { data[k] = v; } };
  };

  it('guarda e relê por usuário; descarta conjuntos quebrados', () => {
    const s = mem();
    const one = newSet([], cfg({ kind: 'pessoa', qty: 50 }));
    expect(one.name).toBe('Conjunto 1');
    expect(one.desc).toBe('50 pessoas completas');
    expect(writeSets('u1', [one], s)).toBe(true);
    expect(readSets('u1', s)).toEqual([one]);
    expect(readSets('u2', s)).toEqual([]);
    s.setItem(setsKey('u3'), JSON.stringify([{ id: 'x', name: 'ruim', config: { kind: 'invalido' } }, { id: 'y', name: 'ok', config: { kind: 'cnpj', qty: 5000, brand: 'x', format: 'y' } }]));
    expect(readSets('u3', s)).toEqual([{ id: 'y', name: 'ok', desc: '', config: { ...DEFAULT_CONFIG, kind: 'cnpj', mask: true } }]);
    s.setItem(setsKey('u4'), '{lixo');
    expect(readSets('u4', s)).toEqual([]);
  });

  it('com o localStorage falhando nada quebra', () => {
    const broken = { getItem: () => { throw new Error('x'); }, setItem: () => { throw new Error('x'); } };
    expect(readSets('u', broken)).toEqual([]);
    expect(writeSets('u', [], broken)).toBe(false);
    expect(describeConfig(cfg({ kind: 'cnpj', cnpjAlfa: true, qty: 20 }))).toBe('20 CNPJs alfanuméricos');
  });
});
