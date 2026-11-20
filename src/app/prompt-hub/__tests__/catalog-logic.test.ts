import { describe, expect, it } from 'vitest';
import {
  DEFAULT_FILTERS,
  canEditItem,
  canModerateItem,
  countPanelFilters,
  hasAnyFilter,
  highlightParts,
  isAdminOverride,
  legacyQuery,
  safeHttpUrl,
  sortItems,
} from '../catalog-logic';
import type { PromptItem } from '../types';

const item = (over: Partial<PromptItem>): PromptItem => ({
  id: 'x',
  title: 'Título',
  type: 'prompt',
  visibility: 'public',
  authorId: 'a',
  authorName: 'Ana',
  authorRole: 'Analista',
  authorSquad: '',
  useCount: 0,
  forkCount: 0,
  tags: [],
  createdAt: '2026-01-01T00:00:00Z',
  ...over,
});

const ctx = { sessionId: 'me', favoriteIds: new Set<string>(), favoritesOnly: false, mineOnly: false };

describe('regras do catálogo no navegador (servidor antigo)', () => {
  const all = [
    item({ id: '1', title: 'Resumir issue', useCount: 9, tags: ['jira'], type: 'prompt', updatedAt: '2026-03-01T00:00:00Z' }),
    item({ id: '2', title: 'Revisar contrato', useCount: 3, forkCount: 7, type: 'skill', updatedAt: '2026-04-01T00:00:00Z' }),
    item({ id: '3', title: 'Meu rascunho', visibility: 'private', authorId: 'me', type: 'prompt' }),
    item({ id: '4', title: 'Privado de outra pessoa', visibility: 'private', authorId: 'b' }),
    item({ id: '5', title: 'Antigo', status: 'arquivado' }),
  ];

  it('mostra públicos e os meus, esconde privados de outras pessoas e arquivados', () => {
    const r = legacyQuery(all, DEFAULT_FILTERS, 'recent', 0, 24, ctx, 2);
    expect(r.items.map(i => i.id).sort()).toEqual(['1', '2', '3']);
    expect(r.total).toBe(3);
  });

  it('busca sem diferenciar acento nem maiúscula e nas etiquetas', () => {
    expect(legacyQuery(all, { ...DEFAULT_FILTERS, search: 'REVISAR' }, 'recent', 0, 24, ctx, null).items.map(i => i.id)).toEqual(['2']);
    expect(legacyQuery(all, { ...DEFAULT_FILTERS, search: 'jira' }, 'recent', 0, 24, ctx, null).items.map(i => i.id)).toEqual(['1']);
  });

  it('as contagens por tipo ignoram o filtro de tipo; a lista respeita', () => {
    const r = legacyQuery(all, { ...DEFAULT_FILTERS, type: 'skill' }, 'recent', 0, 24, ctx, null);
    expect(r.items.map(i => i.id)).toEqual(['2']);
    expect(r.facets.typeCounts).toEqual({ prompt: 2, skill: 1 });
  });

  it('pagina e informa o total de páginas', () => {
    const many = Array.from({ length: 30 }, (_, i) => item({ id: String(i), title: `Item ${i}` }));
    const first = legacyQuery(many, DEFAULT_FILTERS, 'az', 0, 24, ctx, null);
    const second = legacyQuery(many, DEFAULT_FILTERS, 'az', 1, 24, ctx, null);
    expect(first.items).toHaveLength(24);
    expect(second.items).toHaveLength(6);
    expect(first.totalPages).toBe(2);
    expect(first.total).toBe(30);
  });

  it('só favoritos e só os meus', () => {
    const fav = legacyQuery(all, DEFAULT_FILTERS, 'recent', 0, 24, { ...ctx, favoriteIds: new Set(['2']), favoritesOnly: true }, null);
    expect(fav.items.map(i => i.id)).toEqual(['2']);
    const mine = legacyQuery(all, DEFAULT_FILTERS, 'recent', 0, 24, { ...ctx, mineOnly: true }, null);
    expect(mine.items.map(i => i.id)).toEqual(['3']);
  });

  it('os números do topo não dependem dos filtros', () => {
    const r = legacyQuery(all, { ...DEFAULT_FILTERS, search: 'contrato' }, 'recent', 0, 24, ctx, 5);
    expect(r.facets.totals).toEqual({ items: 3, copies: 12, collections: 5 });
  });

  it('ordena por uso, duplicações e A a Z', () => {
    expect(sortItems(all, 'used')[0].id).toBe('1');
    expect(sortItems(all, 'cloned')[0].id).toBe('2');
    expect(sortItems(all, 'az')[0].title).toBe('Antigo');
  });
});

describe('destaque do termo buscado', () => {
  it('marca o termo sem diferenciar maiúsculas e sem tratá-lo como regex', () => {
    expect(highlightParts('Revisar o contrato', 'CON')).toEqual([
      { text: 'Revisar o ', match: false },
      { text: 'con', match: true },
      { text: 'trato', match: false },
    ]);
    expect(highlightParts('a (b) c', '(b)')).toEqual([
      { text: 'a ', match: false },
      { text: '(b)', match: true },
      { text: ' c', match: false },
    ]);
    expect(highlightParts('texto', '')).toEqual([{ text: 'texto', match: false }]);
  });
});

describe('permissões do item', () => {
  it('usa canEdit/canModerate do servidor quando existem', () => {
    expect(canEditItem({ authorId: 'b', canEdit: true }, 'me')).toBe(true);
    expect(canEditItem({ authorId: 'me', canEdit: false }, 'me')).toBe(false);
    expect(canModerateItem({ authorId: 'b', canModerate: true, canEdit: false }, 'me')).toBe(true);
  });

  it('sem os campos novos, só a autora edita e modera', () => {
    expect(canEditItem({ authorId: 'me' }, 'me')).toBe(true);
    expect(canEditItem({ authorId: 'b' }, 'me')).toBe(false);
    expect(canEditItem({ authorId: 'b' }, undefined)).toBe(false);
    expect(canModerateItem({ authorId: 'me' }, 'me')).toBe(true);
  });

  it('administradora em item de outra pessoa mostra o selo; a autora não', () => {
    expect(isAdminOverride({ authorId: 'b', canEdit: true, canModerate: true }, 'me')).toBe(true);
    expect(isAdminOverride({ authorId: 'me', canEdit: true, canModerate: true }, 'me')).toBe(false);
    expect(isAdminOverride({ authorId: 'b', canEdit: false, canModerate: false }, 'me')).toBe(false);
  });
});

describe('filtros ligados e links', () => {
  it('conta só os filtros do painel', () => {
    expect(countPanelFilters(DEFAULT_FILTERS, false)).toBe(0);
    expect(countPanelFilters({ ...DEFAULT_FILTERS, status: 'all', impact: 'alto', tag: 'jira', visibility: 'public' }, true)).toBe(5);
    expect(hasAnyFilter({ ...DEFAULT_FILTERS, search: ' ' }, false, false)).toBe(false);
    expect(hasAnyFilter({ ...DEFAULT_FILTERS, type: 'gem' }, false, false)).toBe(true);
  });

  it('só abre links http e https com o esquema escrito', () => {
    expect(safeHttpUrl('https://gemini.google.com/gem/x')).toBe('https://gemini.google.com/gem/x');
    expect(safeHttpUrl('http://exemplo.com')).toBe('http://exemplo.com/');
    expect(safeHttpUrl('gemini.google.com/gem/x')).toBeNull();
    expect(safeHttpUrl('javascript:alert(1)')).toBeNull();
    expect(safeHttpUrl('')).toBeNull();
  });
});
