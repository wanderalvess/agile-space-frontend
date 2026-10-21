import { normalize } from '@/lib/text-normalize';
import { toSafeExternalUrl } from '@/lib/utils';
import type { SortKey } from './constants';
import type { PromptFacets } from './api';
import type { CatalogFilters, PromptItem, PromptType } from './types';

/**
 * Regras do catálogo que rodam no navegador. Com o servidor novo, busca, filtros, ordem e
 * paginação acontecem lá e este arquivo só serve ao que a tela faz sozinha (destacar o termo,
 * decidir permissões). Com o servidor antigo, que devolve tudo sem filtrar, o catálogo aplica
 * as mesmas regras aqui para continuar funcionando.
 */

export const DEFAULT_FILTERS: CatalogFilters = {
  search: '',
  type: 'all',
  status: 'active',
  impact: 'all',
  visibility: 'all',
  tag: null,
};

/** Quantos filtros do painel "Filtros" estão ligados (o tipo e a busca têm lugar próprio). */
export function countPanelFilters(filters: CatalogFilters, favoritesOnly: boolean): number {
  return (
    (filters.visibility !== 'all' ? 1 : 0) +
    (filters.status !== 'active' ? 1 : 0) +
    (filters.impact !== 'all' ? 1 : 0) +
    (filters.tag ? 1 : 0) +
    (favoritesOnly ? 1 : 0)
  );
}

export function hasAnyFilter(filters: CatalogFilters, favoritesOnly: boolean, mineOnly: boolean): boolean {
  return (
    !!filters.search.trim() ||
    filters.type !== 'all' ||
    countPanelFilters(filters, favoritesOnly) > 0 ||
    mineOnly
  );
}

export interface LegacyContext {
  sessionId?: string;
  favoriteIds: Set<string>;
  favoritesOnly: boolean;
  mineOnly: boolean;
}

const toMillis = (value?: string | null): number => {
  if (!value) return 0;
  const time = new Date(value).getTime();
  return Number.isNaN(time) ? 0 : time;
};

const searchable = (item: PromptItem) =>
  normalize(
    [item.title, item.description, item.content, item.authorName, item.businessGoal, item.targetAudience, ...(item.tags ?? [])]
      .filter(Boolean)
      .join(' ')
  );

/** Itens que a pessoa pode ver, com todos os filtros menos o de tipo (para as contagens por tipo não zerarem ao clicar). */
export function legacyScope(items: PromptItem[], filters: CatalogFilters, ctx: LegacyContext): PromptItem[] {
  const term = normalize(filters.search);
  return items.filter(item => {
    const isOwner = !!ctx.sessionId && item.authorId === ctx.sessionId;
    if (!isOwner && item.visibility !== 'public') return false;
    if (ctx.mineOnly && !isOwner) return false;
    if (filters.visibility === 'public' && item.visibility !== 'public') return false;
    if (filters.visibility === 'private' && (item.visibility !== 'private' || !isOwner)) return false;
    if (ctx.favoritesOnly && !ctx.favoriteIds.has(item.id)) return false;

    const status = item.status || 'producao';
    if (filters.status === 'active') {
      if (status === 'arquivado') return false;
    } else if (filters.status !== 'all' && status !== filters.status) {
      return false;
    }
    if (filters.impact !== 'all' && (item.impact || 'medio') !== filters.impact) return false;
    if (filters.tag && !(item.tags ?? []).some(t => t.toLowerCase() === filters.tag!.toLowerCase())) return false;
    if (term && !searchable(item).includes(term)) return false;
    return true;
  });
}

export function sortItems(items: PromptItem[], sort: SortKey): PromptItem[] {
  const list = [...items];
  switch (sort) {
    case 'used':
      return list.sort((a, b) => (b.useCount || 0) - (a.useCount || 0));
    case 'cloned':
      return list.sort((a, b) => (b.forkCount || 0) - (a.forkCount || 0));
    case 'az':
      return list.sort((a, b) => (a.title || '').localeCompare(b.title || '', 'pt-BR'));
    default:
      return list.sort((a, b) => toMillis(b.updatedAt || b.createdAt) - toMillis(a.updatedAt || a.createdAt));
  }
}

export function legacyFacets(scoped: PromptItem[], totalsSource: PromptItem[], collections: number | null): PromptFacets {
  const typeCounts: Partial<Record<PromptType, number>> = {};
  const tagCount = new Map<string, number>();
  for (const item of scoped) {
    typeCounts[item.type] = (typeCounts[item.type] ?? 0) + 1;
    for (const raw of item.tags ?? []) {
      const tag = raw.trim().toLowerCase();
      if (tag) tagCount.set(tag, (tagCount.get(tag) || 0) + 1);
    }
  }
  const topTags = Array.from(tagCount.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([tag, count]) => ({ tag, count }));
  return {
    total: scoped.length,
    typeCounts,
    topTags,
    totals: {
      items: totalsSource.filter(item => (item.status || 'producao') !== 'arquivado').length,
      copies: totalsSource.reduce((sum, item) => sum + (item.useCount || 0), 0),
      collections: collections ?? 0,
    },
  };
}

/** Roda a consulta inteira no navegador (servidor antigo). Devolve a página pedida, o total e as contagens. */
export function legacyQuery(
  all: PromptItem[],
  filters: CatalogFilters,
  sort: SortKey,
  page: number,
  size: number,
  ctx: LegacyContext,
  collections: number | null
) {
  const scoped = legacyScope(all, filters, ctx);
  const byType = filters.type === 'all' ? scoped : scoped.filter(item => item.type === filters.type);
  const sorted = sortItems(byType, sort);
  const items = sorted.slice(page * size, (page + 1) * size);
  return {
    items,
    total: sorted.length,
    totalPages: Math.max(1, Math.ceil(sorted.length / size)),
    facets: legacyFacets(scoped, legacyScope(all, DEFAULT_FILTERS, { ...ctx, favoritesOnly: false, mineOnly: false }), collections),
  };
}

export interface HighlightPart {
  text: string;
  match: boolean;
}

/** Quebra o texto em trechos para destacar o termo buscado (sem diferenciar maiúsculas; sem interpretar o termo como regex). */
export function highlightParts(text: string | undefined | null, query: string | undefined | null): HighlightPart[] {
  const value = text ?? '';
  const term = (query ?? '').trim();
  if (!term || !value) return [{ text: value, match: false }];
  const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const parts = value.split(new RegExp(`(${escaped})`, 'ig')).filter(part => part !== '');
  return parts.map(part => ({ text: part, match: part.toLowerCase() === term.toLowerCase() }));
}

/** Permissões do item para quem está vendo. O servidor novo manda `canEdit`/`canModerate`; no antigo vale ser a pessoa autora. */
export function canEditItem(item: Pick<PromptItem, 'authorId' | 'canEdit'>, sessionId?: string | null): boolean {
  if (typeof item.canEdit === 'boolean') return item.canEdit;
  return !!sessionId && item.authorId === sessionId;
}

export function canModerateItem(item: Pick<PromptItem, 'authorId' | 'canModerate' | 'canEdit'>, sessionId?: string | null): boolean {
  if (typeof item.canModerate === 'boolean') return item.canModerate;
  return canEditItem(item, sessionId);
}

/** Administradora mexendo em item de outra pessoa: a tela mostra o selo "Admin" e avisa nas confirmações. */
export function isAdminOverride(item: Pick<PromptItem, 'authorId' | 'canEdit' | 'canModerate'>, sessionId?: string | null): boolean {
  const canManage = canEditItem(item, sessionId) || canModerateItem(item, sessionId);
  return canManage && (!sessionId || item.authorId !== sessionId);
}

/**
 * Link que a tela aceita abrir: precisa começar com http:// ou https://. Sem o esquema (ou com
 * javascript:, data: e afins) devolve null e o botão "Abrir ferramenta" fica desligado.
 */
export function safeHttpUrl(url?: string | null): string | null {
  const trimmed = url?.trim();
  if (!trimmed || !/^https?:\/\//i.test(trimmed)) return null;
  return toSafeExternalUrl(trimmed);
}
