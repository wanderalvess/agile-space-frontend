import { describe, expect, it } from 'vitest';
import rawVersions from '../versions.json';
import {
  NO_FILTERS,
  applyFilters,
  classifyChange,
  countByType,
  formatLongDate,
  groupByMonth,
  hasActiveFilters,
  newerThan,
  parseReleaseDate,
  releaseTypeOf,
  releasesFromFile,
  sortEntries,
  toEntry,
  yearsOf,
  type ChangelogEntry,
  type RawVersion,
} from '../releases';

const entry = (tag: string, iso: string | null, over: Partial<ChangelogEntry> = {}): ChangelogEntry => ({
  tag,
  iso,
  type: 'minor',
  title: `Título ${tag}`,
  description: `Descrição ${tag}`,
  changes: [{ kind: 'novo', text: `mudança de ${tag}` }],
  ...over,
});

describe('parseReleaseDate', () => {
  it('lê o formato do arquivo e do backend, ISO e dd/mm/aaaa', () => {
    expect(parseReleaseDate('14 de Outubro, 2026')).toBe('2026-10-14');
    expect(parseReleaseDate('1 de Março, 2026')).toBe('2026-03-01');
    expect(parseReleaseDate('2026-10-14')).toBe('2026-10-14');
    expect(parseReleaseDate('14/10/2026')).toBe('2026-10-14');
  });
  it('data que não dá para ler vira null (e não quebra)', () => {
    expect(parseReleaseDate('semana que vem')).toBeNull();
    expect(parseReleaseDate(undefined)).toBeNull();
    expect(formatLongDate(null)).toBe('Data não informada');
    expect(formatLongDate('2026-10-14')).toBe('14 de outubro de 2026');
  });
  it('todas as 216 versões do arquivo têm data legível', () => {
    const list = releasesFromFile(rawVersions as RawVersion[]).map(toEntry);
    expect(list).toHaveLength(216);
    expect(list.filter((e) => !e.iso)).toEqual([]);
  });
});

describe('releaseTypeOf e classifyChange', () => {
  it('usa o tipo cadastrado e deduz do número quando falta', () => {
    expect(releaseTypeOf('major', 'v1.2.3')).toBe('major');
    expect(releaseTypeOf(undefined, 'v4.24.0')).toBe('minor');
    expect(releaseTypeOf(undefined, 'v4.23.2')).toBe('patch');
    expect(releaseTypeOf(undefined, 'v5.0.0')).toBe('major');
    expect(releaseTypeOf('qualquer', 'v4.1.0')).toBe('minor');
  });
  it('classifica a mudança pelo começo da frase', () => {
    expect(classifyChange('fix(poker): voto duplicado')).toBe('correcao');
    expect(classifyChange('Corrige o cálculo')).toBe('correcao');
    expect(classifyChange('Melhorias: busca mais rápida')).toBe('melhoria');
    expect(classifyChange('refactor(jira): extrai serviço')).toBe('melhoria');
    expect(classifyChange('feat(poker): histórico')).toBe('novo');
    expect(classifyChange('A sessão se renova sozinha')).toBe('novo');
  });
});

describe('filtros', () => {
  const list = [
    entry('v4.24.0', '2026-10-14', { type: 'minor', changes: [{ kind: 'novo', text: 'Gerador de spec Jolt' }] }),
    entry('v4.23.2', '2026-10-09', { type: 'patch', changes: [{ kind: 'correcao', text: 'Importação do TDN' }] }),
    entry('v3.28.0', '2025-11-15', { type: 'patch', title: 'Última da linha 3' }),
  ];
  it('busca por versão, título, descrição ou mudança, sem diferenciar acento nem caixa', () => {
    expect(applyFilters(list, { ...NO_FILTERS, query: 'jolt' }).map((e) => e.tag)).toEqual(['v4.24.0']);
    expect(applyFilters(list, { ...NO_FILTERS, query: 'IMPORTACAO' }).map((e) => e.tag)).toEqual(['v4.23.2']);
    expect(applyFilters(list, { ...NO_FILTERS, query: 'v3.28' }).map((e) => e.tag)).toEqual(['v3.28.0']);
    expect(applyFilters(list, { ...NO_FILTERS, query: 'ultima' })).toHaveLength(1);
  });
  it('filtra por tipo e por ano e combina com a busca', () => {
    expect(applyFilters(list, { ...NO_FILTERS, type: 'patch' })).toHaveLength(2);
    expect(applyFilters(list, { ...NO_FILTERS, year: '2025' }).map((e) => e.tag)).toEqual(['v3.28.0']);
    expect(applyFilters(list, { query: 'tdn', type: 'patch', year: '2026' }).map((e) => e.tag)).toEqual(['v4.23.2']);
    expect(applyFilters(list, { query: 'tdn', type: 'minor', year: 'todos' })).toEqual([]);
  });
  it('conta por tipo respeitando busca e ano; anos do mais novo ao mais antigo', () => {
    expect(countByType(list, NO_FILTERS)).toEqual({ todos: 3, major: 0, minor: 1, patch: 2 });
    expect(countByType(list, { ...NO_FILTERS, year: '2026' })).toEqual({ todos: 2, major: 0, minor: 1, patch: 1 });
    expect(yearsOf(list)).toEqual(['2026', '2025']);
    expect(hasActiveFilters(NO_FILTERS)).toBe(false);
    expect(hasActiveFilters({ ...NO_FILTERS, query: ' x ' })).toBe(true);
  });
});

describe('groupByMonth', () => {
  it('agrupa por mês na ordem recebida, com rótulo, ano e contagem', () => {
    const groups = groupByMonth([entry('v4.24.0', '2026-10-14'), entry('v4.23.2', '2026-10-09'), entry('v4.22.0', '2026-09-22'), entry('v3.1.0', '2025-11-15')]);
    expect(groups.map((g) => [g.key, g.label, g.entries.length])).toEqual([
      ['2026-10', 'Outubro de 2026', 2],
      ['2026-09', 'Setembro de 2026', 1],
      ['2025-11', 'Novembro de 2025', 1],
    ]);
    expect(groups[0].year).toBe('2026');
    expect(groups[0].short).toBe('Outubro');
  });
  it('versão sem data cai no grupo "Sem data"', () => {
    const groups = groupByMonth([entry('v1.0.0', null)]);
    expect(groups).toHaveLength(1);
    expect(groups[0].label).toBe('Sem data');
  });
});

describe('newerThan e sortEntries', () => {
  it('só as mais novas que a última vista; sem última vista, nenhuma', () => {
    const list = sortEntries([entry('v4.22.0', '2026-09-22'), entry('v4.24.0', '2026-10-14'), entry('v4.23.0', '2026-10-02')]);
    expect(list.map((e) => e.tag)).toEqual(['v4.24.0', 'v4.23.0', 'v4.22.0']);
    expect(newerThan(list, 'v4.22.0').map((e) => e.tag)).toEqual(['v4.24.0', 'v4.23.0']);
    expect(newerThan(list, 'v4.24.0')).toEqual([]);
    expect(newerThan(list, null)).toEqual([]);
  });
});
