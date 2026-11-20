import type { AppReleaseItem } from '@/services/changelogApi';
import { compareTagsDesc } from './merge';

/** Linha de `versions.json`: o time gera a cada entrega; `type` e `icon` faltam nas mais antigas. */
export interface RawVersion {
  tag: string;
  date?: string;
  displayDate?: string;
  title: string;
  description: string;
  changes?: string[];
  type?: string;
  icon?: { name: string; className: string };
}

export type ReleaseType = 'major' | 'minor' | 'patch';
export type ChangeKind = 'novo' | 'melhoria' | 'correcao';

export interface ChangeEntry {
  kind: ChangeKind;
  text: string;
}

/** Versão pronta para a tela: data ISO, tipo certo e mudanças classificadas. */
export interface ChangelogEntry {
  tag: string;
  /** "2026-10-14", ou null quando a data do cadastro não é reconhecida. */
  iso: string | null;
  type: ReleaseType;
  title: string;
  description: string;
  changes: ChangeEntry[];
}

export const MONTHS = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];

const MONTH_INDEX: Record<string, number> = Object.fromEntries(
  MONTHS.map((m, i) => [m.normalize('NFD').replace(/[̀-ͯ]/g, ''), i + 1]),
);

const pad2 = (n: number) => String(n).padStart(2, '0');

/**
 * Lê a data de um cadastro: "14 de Outubro, 2026" (formato do arquivo e do backend), "2026-10-14" ou "14/10/2026".
 * Devolve "2026-10-14" ou null.
 */
export function parseReleaseDate(raw?: string | null): string | null {
  if (!raw) return null;
  const text = raw.trim();
  const iso = /^(\d{4})-(\d{2})-(\d{2})/.exec(text);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  const br = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(text);
  if (br) return `${br[3]}-${pad2(Number(br[2]))}-${pad2(Number(br[1]))}`;
  const long = /^(\d{1,2})\s+de\s+([A-Za-zÀ-ÿ]+)\s*,?\s*(?:de\s+)?(\d{4})$/i.exec(text);
  if (long) {
    const month = MONTH_INDEX[long[2].toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')];
    if (month) return `${long[3]}-${pad2(month)}-${pad2(Number(long[1]))}`;
  }
  return null;
}

/** "2026-10-14" -> "14 de outubro de 2026". */
export function formatLongDate(iso: string | null): string {
  if (!iso) return 'Data não informada';
  const [y, m, d] = iso.split('-').map(Number);
  return `${d} de ${MONTHS[m - 1]} de ${y}`;
}

/** "2026-10-14" -> "14/10". */
export function formatShortDate(iso: string | null): string {
  if (!iso) return '';
  const [, m, d] = iso.split('-').map(Number);
  return `${d}/${pad2(m)}`;
}

/** Tipo da versão: o cadastrado, ou deduzido do número (x.y.z com z diferente de 0 é patch, com y é minor). */
export function releaseTypeOf(type: string | undefined | null, tag: string): ReleaseType {
  const t = (type ?? '').toLowerCase();
  if (t === 'major' || t === 'minor' || t === 'patch') return t;
  const m = /^v?(\d+)\.(\d+)\.(\d+)/.exec(tag.trim());
  if (!m) return 'patch';
  if (Number(m[3]) !== 0) return 'patch';
  if (Number(m[2]) !== 0) return 'minor';
  return 'major';
}

/**
 * As mudanças são texto livre (algumas com prefixo de commit). O tipo é deduzido do começo da frase:
 * "fix", "corrige" e parentes viram Correção; "melhora", "ajuste", "refactor", "chore" viram Melhoria;
 * o resto é Novo. É uma regra de apresentação: o cadastro não guarda o tipo de cada mudança.
 */
export function classifyChange(text: string): ChangeKind {
  const t = text.trim().toLowerCase();
  if (/^(fix|bugfix|hotfix|corrig|corrij|corre[cç][aã]o|corre[cç][oõ]es)/.test(t)) return 'correcao';
  if (/^(melhor|ajust|refactor|perf|chore|polimento|otimiz)/.test(t)) return 'melhoria';
  return 'novo';
}

export const KIND_LABEL: Record<ChangeKind, string> = { novo: 'Novo', melhoria: 'Melhoria', correcao: 'Correção' };
export const TYPE_LABEL: Record<ReleaseType, string> = { major: 'Major', minor: 'Minor', patch: 'Patch' };

export function toEntry(r: AppReleaseItem): ChangelogEntry {
  return {
    tag: r.tag,
    iso: parseReleaseDate(r.displayDate ?? r.date),
    type: releaseTypeOf(r.type, r.tag),
    title: r.title ?? '',
    description: r.description ?? '',
    changes: (r.changes ?? []).map((text) => ({ kind: classifyChange(text), text })),
  };
}

/** Converte o arquivo `versions.json` no formato do serviço, sem `any`. */
export function releasesFromFile(raw: RawVersion[]): AppReleaseItem[] {
  return raw.map((v) => ({
    tag: v.tag,
    title: v.title,
    description: v.description,
    changes: v.changes ?? [],
    type: v.type ?? releaseTypeOf(undefined, v.tag),
    displayDate: v.date ?? v.displayDate,
    date: v.date ?? v.displayDate,
    iconName: v.icon?.name ?? 'Sparkles',
    iconClass: v.icon?.className ?? 'h-5 w-5 text-primary',
  }));
}

/** Mais nova primeiro; empate de tag resolvido pela data. */
export function sortEntries(entries: ChangelogEntry[]): ChangelogEntry[] {
  return [...entries].sort((a, b) => compareTagsDesc(a.tag, b.tag));
}

export type TypeFilter = 'todos' | ReleaseType;
export type YearFilter = 'todos' | string;

export interface Filters {
  query: string;
  type: TypeFilter;
  year: YearFilter;
}

export const NO_FILTERS: Filters = { query: '', type: 'todos', year: 'todos' };

export function hasActiveFilters(f: Filters): boolean {
  return f.query.trim() !== '' || f.type !== 'todos' || f.year !== 'todos';
}

const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

export function matchesQuery(e: ChangelogEntry, query: string): boolean {
  const q = norm(query.trim());
  if (!q) return true;
  const haystack = norm([e.tag, e.title, e.description, ...e.changes.map((c) => c.text)].join(' '));
  return haystack.includes(q);
}

export const matchesType = (e: ChangelogEntry, type: TypeFilter) => type === 'todos' || e.type === type;
export const matchesYear = (e: ChangelogEntry, year: YearFilter) => year === 'todos' || (e.iso ?? '').slice(0, 4) === year;

export function applyFilters(entries: ChangelogEntry[], f: Filters): ChangelogEntry[] {
  return entries.filter((e) => matchesQuery(e, f.query) && matchesType(e, f.type) && matchesYear(e, f.year));
}

/** Contagem por tipo respeitando busca e ano (o que o filtro de tipo mostraria se fosse escolhido). */
export function countByType(entries: ChangelogEntry[], f: Filters): Record<TypeFilter, number> {
  const base = entries.filter((e) => matchesQuery(e, f.query) && matchesYear(e, f.year));
  return {
    todos: base.length,
    major: base.filter((e) => e.type === 'major').length,
    minor: base.filter((e) => e.type === 'minor').length,
    patch: base.filter((e) => e.type === 'patch').length,
  };
}

/** Anos presentes nos dados, do mais novo para o mais antigo. */
export function yearsOf(entries: ChangelogEntry[]): string[] {
  return [...new Set(entries.map((e) => (e.iso ?? '').slice(0, 4)).filter(Boolean))].sort((a, b) => b.localeCompare(a));
}

export interface MonthGroup {
  /** "2026-10", ou "sem-data". */
  key: string;
  year: string;
  /** "Outubro de 2026". */
  label: string;
  /** "Outubro" (para o painel Navegar). */
  short: string;
  entries: ChangelogEntry[];
}

const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** Agrupa por mês na ordem recebida (já ordenada da mais nova para a mais antiga). Sem data vai para o fim. */
export function groupByMonth(entries: ChangelogEntry[]): MonthGroup[] {
  const groups: MonthGroup[] = [];
  const byKey = new Map<string, MonthGroup>();
  for (const e of entries) {
    const key = e.iso ? e.iso.slice(0, 7) : 'sem-data';
    let g = byKey.get(key);
    if (!g) {
      if (e.iso) {
        const [y, m] = key.split('-').map(Number);
        g = { key, year: String(y), label: `${capitalize(MONTHS[m - 1])} de ${y}`, short: capitalize(MONTHS[m - 1]), entries: [] };
      } else {
        g = { key, year: '', label: 'Sem data', short: 'Sem data', entries: [] };
      }
      byKey.set(key, g);
      groups.push(g);
    }
    g.entries.push(e);
  }
  return groups;
}

/** Versões mais novas que a última vista (a lista já vem ordenada). */
export function newerThan(entries: ChangelogEntry[], seenTag: string | null): ChangelogEntry[] {
  if (!seenTag) return [];
  return entries.filter((e) => compareTagsDesc(e.tag, seenTag) < 0);
}

export function monthLabel(count: number): string {
  return `${count} ${count === 1 ? 'versão' : 'versões'}`;
}
