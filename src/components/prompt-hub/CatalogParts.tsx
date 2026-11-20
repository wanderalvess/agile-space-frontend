'use client';

import { Filter, Layers, Library, Copy, Search, X } from 'lucide-react';
import { KpiCard, KpiRow, PAGE_CARD } from '@/components/page';
import { FIELD, SelectField } from '@/components/room-kit';
import { cn } from '@/lib/utils';
import {
  IMPACT_ORDER,
  IMPACT_META,
  SORT_OPTIONS,
  STATUS_FILTER_OPTIONS,
  TYPE_ORDER,
  getTypeMeta,
  type SortKey
} from '@/app/prompt-hub/constants';
import type { PromptFacets } from '@/app/prompt-hub/api';
import type { CatalogFilters, PromptItem, PromptType, StatusFilter } from '@/app/prompt-hub/types';
import { TagButton } from './Chips';

const num = (value?: number) => (value === undefined ? '—' : value.toLocaleString('pt-BR'));

/** Os três números do topo. "Cópias" conta quantas vezes alguém copiou um item, nada além disso. */
export function CatalogKpis({ facets, loggedIn }: { facets: PromptFacets | null; loggedIn: boolean }) {
  return (
    <KpiRow columns={3}>
      <KpiCard label="Itens disponíveis" value={num(facets?.totals.items)} hint={loggedIn ? 'públicos e seus' : 'públicos'} icon={Library} />
      <KpiCard label="Cópias" value={num(facets?.totals.copies)} hint="vezes que alguém copiou um item" icon={Copy} />
      <KpiCard label="Coleções" value={num(facets?.totals.collections)} hint="trilhas de itens em ordem" icon={Layers} />
    </KpiRow>
  );
}

interface ToolbarProps {
  search: string;
  onSearch: (value: string) => void;
  filtersOpen: boolean;
  onToggleFilters: () => void;
  filterCount: number;
  sort: SortKey;
  onSort: (value: SortKey) => void;
}

/** Busca em destaque, botão de filtros e ordem. A busca espera 300 ms depois da última tecla. */
export function CatalogToolbar({ search, onSearch, filtersOpen, onToggleFilters, filterCount, sort, onSort }: ToolbarProps) {
  return (
    <section aria-label="Busca e ordem" className="flex flex-wrap items-center gap-2.5">
      <div className="relative min-w-[260px] flex-1">
        <label htmlFor="ph-busca" className="sr-only">
          Buscar na biblioteca
        </label>
        <Search className="pointer-events-none absolute left-3.5 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-muted-foreground" strokeWidth={1.5} aria-hidden="true" />
        <input
          id="ph-busca"
          type="search"
          value={search}
          onChange={event => onSearch(event.target.value)}
          placeholder="Buscar por título, texto, autor, objetivo ou etiqueta"
          className={cn(FIELD, 'h-12 rounded-xl bg-card pl-11 pr-11 text-[15px] [&::-webkit-search-cancel-button]:hidden')}
        />
        {search && (
          <button
            type="button"
            onClick={() => onSearch('')}
            aria-label="Limpar busca"
            className="absolute right-2 top-1/2 inline-flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-lg text-muted-foreground hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <X className="h-4 w-4" strokeWidth={1.5} aria-hidden="true" />
          </button>
        )}
      </div>

      <button
        type="button"
        onClick={onToggleFilters}
        aria-expanded={filtersOpen}
        aria-controls="ph-filtros"
        className="inline-flex h-12 items-center gap-2 rounded-xl border border-border bg-card px-4 text-sm font-semibold text-foreground transition-colors duration-fast hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <Filter className="h-4 w-4" strokeWidth={1.5} aria-hidden="true" />
        Filtros
        {filterCount > 0 && (
          <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-xs font-bold text-primary-foreground">
            {filterCount}
          </span>
        )}
      </button>

      <label className="flex items-center gap-2 text-[13px] text-muted-foreground">
        Ordenar por
        <SelectField
          aria-label="Ordenar por"
          value={sort}
          onChange={value => onSort(value as SortKey)}
          options={SORT_OPTIONS}
          className="h-12 w-[170px] rounded-xl bg-card text-sm"
        />
      </label>
    </section>
  );
}

/** Pílulas de tipo com contagem. Tipos sem item ficam desligados (a menos que já estejam escolhidos). */
export function TypePills({
  active,
  counts,
  total,
  onChange,
}: {
  active: PromptType | 'all';
  counts: Partial<Record<PromptType, number>> | null;
  total: number | null;
  onChange: (type: PromptType | 'all') => void;
}) {
  const pill = (on: boolean, off: boolean) =>
    cn(
      'inline-flex h-9 items-center gap-2 rounded-full border px-3.5 text-sm font-semibold transition-colors duration-fast',
      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
      on
        ? 'border-primary/50 bg-primary/10 text-primary dark:bg-primary/15 [.theme-totvs:not(.dark)_&]:text-foreground'
        : 'border-border bg-card text-foreground hover:bg-accent',
      off && 'cursor-default border-dashed text-muted-foreground hover:bg-card'
    );
  return (
    <section aria-label="Tipo de item" className="flex flex-wrap gap-2">
      <button type="button" aria-pressed={active === 'all'} onClick={() => onChange('all')} className={pill(active === 'all', false)}>
        Todos
        {total !== null && <span className="text-xs font-bold tabular-nums">{total.toLocaleString('pt-BR')}</span>}
      </button>
      {TYPE_ORDER.map(type => {
        const meta = getTypeMeta(type);
        const Icon = meta.icon;
        const count = counts ? (counts[type] ?? 0) : null;
        const on = active === type;
        const off = count === 0 && !on;
        return (
          <button
            key={type}
            type="button"
            aria-pressed={on}
            aria-disabled={off || undefined}
            disabled={off}
            title={meta.summary}
            onClick={() => onChange(on ? 'all' : type)}
            className={pill(on, off)}
          >
            <Icon className="h-[15px] w-[15px]" strokeWidth={1.5} aria-hidden="true" />
            {meta.label}
            {count !== null && <span className="text-xs font-bold tabular-nums">{count.toLocaleString('pt-BR')}</span>}
          </button>
        );
      })}
    </section>
  );
}

function OptionList<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: Array<{ value: T; label: string }>;
  onChange: (value: T) => void;
}) {
  return (
    <div role="group" aria-label={label} className="flex flex-col gap-1.5">
      <span className="text-xs font-bold tracking-wide text-muted-foreground">{label.toUpperCase()}</span>
      {options.map(option => {
        const on = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            aria-pressed={on}
            onClick={() => onChange(option.value)}
            className={cn(
              'h-9 rounded-lg border px-3 text-left text-sm transition-colors duration-fast',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
              on
                ? 'border-primary/40 bg-primary/10 font-bold text-foreground dark:bg-primary/15'
                : 'border-transparent text-foreground hover:bg-accent'
            )}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

interface FiltersPanelProps {
  filters: CatalogFilters;
  onChange: (patch: Partial<CatalogFilters>) => void;
  loggedIn: boolean;
  /** Esconde a escolha de visibilidade (só públicos ou aba "Meus itens"). */
  hideVisibility: boolean;
  favoritesOnly: boolean;
  onFavoritesOnly: ((value: boolean) => void) | null;
  favoriteCount: number | null;
  topTags: Array<{ tag: string; count: number }>;
}

/** Painel "Filtros": visibilidade, situação, impacto, favoritos e etiquetas mais usadas. */
export function FiltersPanel({ filters, onChange, loggedIn, hideVisibility, favoritesOnly, onFavoritesOnly, favoriteCount, topTags }: FiltersPanelProps) {
  return (
    <section id="ph-filtros" aria-label="Filtros" className={cn(PAGE_CARD, 'grid gap-6 p-5 sm:grid-cols-2 xl:grid-cols-4')}>
      {loggedIn && !hideVisibility && (
        <OptionList
          label="Visibilidade"
          value={filters.visibility}
          onChange={visibility => onChange({ visibility })}
          options={[
            { value: 'all', label: 'Todos' },
            { value: 'public', label: 'Públicos' },
            { value: 'private', label: 'Meus privados' },
          ]}
        />
      )}
      <OptionList label="Situação" value={filters.status} onChange={(status: StatusFilter) => onChange({ status })} options={STATUS_FILTER_OPTIONS} />
      <div className="flex flex-col gap-4">
        <OptionList
          label="Impacto"
          value={filters.impact}
          onChange={impact => onChange({ impact })}
          options={[{ value: 'all', label: 'Qualquer' }, ...IMPACT_ORDER.map(value => ({ value, label: IMPACT_META[value].filterLabel }))]}
        />
        {onFavoritesOnly && (
          <button
            type="button"
            role="switch"
            aria-checked={favoritesOnly}
            onClick={() => onFavoritesOnly(!favoritesOnly)}
            className={cn(
              'flex h-10 items-center justify-between gap-2.5 rounded-[10px] border px-3 text-sm text-foreground transition-colors duration-fast',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
              favoritesOnly ? 'border-primary/40 bg-primary/10 dark:bg-primary/15' : 'border-border hover:bg-accent'
            )}
          >
            <span>Apenas favoritos</span>
            {favoriteCount !== null && <span className="text-xs font-bold text-muted-foreground">{favoriteCount}</span>}
          </button>
        )}
      </div>
      <div className="flex flex-col gap-2">
        <span className="text-xs font-bold tracking-wide text-muted-foreground">ETIQUETAS MAIS USADAS</span>
        <div className="flex flex-wrap gap-1.5">
          {topTags.length === 0 && <span className="text-sm text-muted-foreground">Ainda não há etiquetas.</span>}
          {topTags.map(({ tag, count }) => (
            <TagButton key={tag} tag={tag} count={count} active={filters.tag === tag} onClick={() => onChange({ tag: filters.tag === tag ? null : tag })} />
          ))}
        </div>
      </div>
    </section>
  );
}

/** "Mais usados": quatro atalhos para o que mais se copia, só na visão sem filtros. */
export function MostUsed({ items, onOpen }: { items: PromptItem[]; onOpen: (item: PromptItem) => void }) {
  if (items.length === 0) return null;
  return (
    <section aria-label="Mais usados" className="flex flex-col gap-2.5">
      <h2 className="text-base font-bold text-foreground">Mais usados</h2>
      <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {items.map((item, index) => (
          <li key={item.id}>
            <button
              type="button"
              onClick={() => onOpen(item)}
              className={cn(
                PAGE_CARD,
                'flex w-full items-center gap-3 rounded-[14px] px-4 py-3.5 text-left transition-colors duration-fast hover:border-primary/40',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'
              )}
            >
              <span className="min-w-[22px] text-xl font-bold tabular-nums text-primary [.theme-totvs:not(.dark)_&]:text-foreground">{index + 1}</span>
              <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span className="truncate text-sm font-bold text-foreground">{item.title?.trim() || 'Item sem título'}</span>
                <span className="text-xs text-muted-foreground">
                  {getTypeMeta(item.type).label} · {(item.useCount || 0).toLocaleString('pt-BR')} usos
                </span>
              </span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
