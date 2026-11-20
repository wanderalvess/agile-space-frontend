import { formatDocument, generateBatch, validateDocument, type DocType, type ValidationResult } from './br-docs';
import {
  generateCreditCard,
  generatePerson,
  type CardBrand,
} from './test-data-generators';

/**
 * Massa de Dados: junta o gerador de pessoas e cartões (antiga Massa de Dados) com o de CPF e CNPJ
 * (antigo CPF e CNPJ). Os algoritmos continuam em `test-data-generators.ts` e `br-docs.ts`;
 * aqui só se monta o lote, o formato de saída, a validação em linhas e os conjuntos salvos.
 */

export const MAX_QTY = 1000;

export type MassKind = 'cpf' | 'cnpj' | 'pessoa' | 'cartao';
export type MassFormat = 'csv' | 'json' | 'sql';

export const KIND_LABEL: Record<MassKind, string> = {
  cpf: 'CPF',
  cnpj: 'CNPJ',
  pessoa: 'Pessoa completa',
  cartao: 'Cartão de crédito',
};

export const KIND_PLURAL: Record<MassKind, string> = {
  cpf: 'CPFs',
  cnpj: 'CNPJs',
  pessoa: 'pessoas completas',
  cartao: 'cartões',
};

export interface MassConfig {
  kind: MassKind;
  /** CNPJ alfanumérico (letras e números na raiz e na filial). */
  cnpjAlfa: boolean;
  /** CNPJ: mesma raiz, filiais 0001, 0002… */
  filiais: boolean;
  /** Com pontos, barra e traço. */
  mask: boolean;
  qty: number;
  brand: CardBrand;
  format: MassFormat;
}

export const DEFAULT_CONFIG: MassConfig = { kind: 'cpf', cnpjAlfa: false, filiais: false, mask: true, qty: 10, brand: 'visa', format: 'csv' };

/** "10" -> 10; vazio, texto ou fora de 1 a 1.000 -> null. */
export function parseQty(raw: string): number | null {
  if (!/^\s*\d+\s*$/.test(raw)) return null;
  const n = parseInt(raw, 10);
  return n >= 1 && n <= MAX_QTY ? n : null;
}

export type MassRow = Record<string, string>;

/** Gera o lote. CPF e CNPJ usam o gerador de documentos (CNPJ alfanumérico e filiais); pessoa e cartão, o de massa. */
export function generateMass(cfg: MassConfig): MassRow[] {
  const qty = Math.min(Math.max(1, Math.floor(cfg.qty) || 1), MAX_QTY);
  if (cfg.kind === 'pessoa') return Array.from({ length: qty }, () => ({ ...generatePerson(cfg.mask) }));
  if (cfg.kind === 'cartao') return Array.from({ length: qty }, () => ({ ...generateCreditCard(cfg.brand), brand: cfg.brand.toUpperCase() }));
  const docType: DocType = cfg.kind === 'cpf' ? 'CPF' : cfg.cnpjAlfa ? 'CNPJ_ALPHANUM' : 'CNPJ_CLASSIC';
  const out: MassRow[] = [];
  // generateBatch limita a 100 por chamada; lotes maiores saem em fatias (cada fatia com a própria raiz no modo filial).
  for (let left = qty; left > 0; left -= 100) {
    for (const raw of generateBatch(docType, Math.min(left, 100), cfg.kind === 'cnpj' && cfg.filiais)) {
      out.push({ [cfg.kind]: cfg.mask ? formatDocument(raw, docType) : raw });
    }
  }
  return out;
}

const csvCell = (v: string) => `"${String(v).replace(/"/g, '""')}"`;
const sqlCell = (v: string) => `'${String(v).replace(/'/g, "''")}'`;

/** Texto do lote no formato escolhido: CSV, JSON (lista) ou SQL (INSERT INTO). */
export function formatMass(rows: MassRow[], format: MassFormat, kind: MassKind): string {
  if (rows.length === 0) return '';
  if (format === 'json') return JSON.stringify(rows, null, 2);
  const columns = Object.keys(rows[0]);
  if (format === 'csv') return [columns.join(','), ...rows.map((r) => columns.map((c) => csvCell(r[c])).join(','))].join('\n');
  const values = rows.map((r) => `(${columns.map((c) => sqlCell(r[c])).join(', ')})`).join(',\n  ');
  return `INSERT INTO tb_massa_${kind} (${columns.join(', ')})\nVALUES\n  ${values};`;
}

export const FORMAT_EXT: Record<MassFormat, string> = { csv: 'csv', json: 'json', sql: 'sql' };

export interface LineValidation { line: string; result: ValidationResult }

/** Valida um documento por linha (linhas em branco são ignoradas). */
export function validateLines(text: string): LineValidation[] {
  const out: LineValidation[] = [];
  for (const raw of text.split('\n')) {
    const line = raw.trim();
    if (!line) continue;
    const result = validateDocument(line);
    if (result) out.push({ line, result });
  }
  return out;
}

// ---- Conjuntos salvos (neste navegador) -------------------------------------

export interface SavedSet {
  id: string;
  name: string;
  desc: string;
  config: MassConfig;
}

type StorageLike = Pick<Storage, 'getItem' | 'setItem'>;

export const setsKey = (userId: string) => `agile-devtools:massa:${userId || 'anon'}`;

function defaultStorage(): StorageLike | null {
  try {
    return typeof window !== 'undefined' ? window.localStorage : null;
  } catch {
    return null;
  }
}

const KINDS = new Set<string>(['cpf', 'cnpj', 'pessoa', 'cartao']);
const BRANDS = new Set<string>(['visa', 'mastercard', 'elo', 'amex']);
const FORMATS = new Set<string>(['csv', 'json', 'sql']);

function sanitizeConfig(c: Partial<MassConfig> | undefined): MassConfig | null {
  if (!c || !KINDS.has(c.kind as string)) return null;
  const qty = typeof c.qty === 'number' && c.qty >= 1 && c.qty <= MAX_QTY ? Math.floor(c.qty) : DEFAULT_CONFIG.qty;
  return {
    kind: c.kind as MassKind,
    cnpjAlfa: !!c.cnpjAlfa,
    filiais: !!c.filiais,
    mask: c.mask !== false,
    qty,
    brand: BRANDS.has(c.brand as string) ? (c.brand as CardBrand) : 'visa',
    format: FORMATS.has(c.format as string) ? (c.format as MassFormat) : 'csv',
  };
}

export function readSets(userId: string, storage?: StorageLike | null): SavedSet[] {
  try {
    const s = storage === undefined ? defaultStorage() : storage;
    const raw = s?.getItem(setsKey(userId));
    const data = raw ? JSON.parse(raw) : null;
    if (!Array.isArray(data)) return [];
    const out: SavedSet[] = [];
    for (const item of data) {
      const config = sanitizeConfig(item?.config);
      if (config && typeof item.id === 'string' && typeof item.name === 'string') {
        out.push({ id: item.id, name: item.name, desc: typeof item.desc === 'string' ? item.desc : '', config });
      }
    }
    return out;
  } catch {
    return [];
  }
}

export function writeSets(userId: string, sets: SavedSet[], storage?: StorageLike | null): boolean {
  try {
    const s = storage === undefined ? defaultStorage() : storage;
    if (!s) return false;
    s.setItem(setsKey(userId), JSON.stringify(sets));
    return true;
  } catch {
    return false;
  }
}

/** Descrição curta do conjunto: "50 pessoas completas", "20 CNPJs alfanuméricos". */
export function describeConfig(cfg: MassConfig): string {
  const what = cfg.kind === 'cnpj' && cfg.cnpjAlfa ? 'CNPJs alfanuméricos' : cfg.kind === 'cnpj' && cfg.filiais ? 'CNPJs (filiais)' : KIND_PLURAL[cfg.kind];
  return `${cfg.qty} ${what}`;
}

export function newSet(existing: SavedSet[], cfg: MassConfig): SavedSet {
  return { id: `s${Date.now().toString(36)}${Math.floor(Math.random() * 1296).toString(36)}`, name: `Conjunto ${existing.length + 1}`, desc: describeConfig(cfg), config: cfg };
}
