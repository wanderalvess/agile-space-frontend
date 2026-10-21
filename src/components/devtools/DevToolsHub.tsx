'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { CircleCheck, Cloud, History, Monitor, Search, Star, X } from 'lucide-react';
import { FOCUS_RING, TONES } from '@/components/room-kit/tokens';
import { PAGE_CARD } from '@/components/page/styles';
import { buildHubView, networkTools, parseHubTab, tabCounts, type HubCard, type HubEmpty } from '@/lib/devtools/hub';
import {
  DEVTOOL_GROUPS,
  HUB_FILTER_FAVORITES,
  HUB_FILTER_QUALITY,
  HUB_FILTER_RECENTS,
  getDevToolHref,
  isLocalTool,
  DEVTOOLS,
  type DevToolHubTab,
} from '@/lib/devtools/registry';
import { cn } from '@/lib/utils';
import { StarButton } from './StarButton';
import { ToolBadge, toolButtonClass } from './ToolControls';
import { useDevToolPrefs } from './useDevToolPrefs';

const TAB_LABEL: Record<string, string> = {
  todas: 'Todas',
  [HUB_FILTER_QUALITY]: 'Qualidade',
  [HUB_FILTER_FAVORITES]: 'Favoritas',
  [HUB_FILTER_RECENTS]: 'Recentes',
  ...Object.fromEntries(DEVTOOL_GROUPS.map((g) => [g.id, g.label])),
};

function ToolCard({ card, starred, onToggle }: { card: HubCard; starred: boolean; onToggle: () => void }) {
  const { tool, foot } = card;
  const Icon = tool.icon;
  return (
    <div
      className={cn(
        PAGE_CARD,
        'group relative flex min-h-[148px] flex-col gap-2.5 p-4 transition-colors duration-base hover:border-primary/50 focus-within:border-primary focus-within:ring-2 focus-within:ring-ring',
      )}
    >
      <div className="flex items-center gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary dark:bg-primary/15 [.theme-totvs:not(.dark)_&]:text-foreground">
          <Icon className="h-5 w-5" strokeWidth={1.5} aria-hidden="true" />
        </span>
        <h3 className="min-w-0 flex-1 text-base font-bold text-foreground">
          <Link
            href={getDevToolHref(tool.id)}
            className="rounded-md after:absolute after:inset-0 after:rounded-2xl focus-visible:outline-none"
            aria-label={`Abrir ${tool.title}`}
          >
            {tool.title}
          </Link>
        </h3>
        <StarButton on={starred} name={tool.title} onToggle={onToggle} />
      </div>
      <p className="flex-1 text-sm leading-normal text-muted-foreground">{tool.description}</p>
      <div className="flex flex-wrap items-center justify-between gap-x-2.5 gap-y-1.5">
        <ToolBadge tool={tool} />
        {foot && <span className="text-xs text-muted-foreground">{foot}</span>}
      </div>
    </div>
  );
}

const EMPTY: Record<HubEmpty, { icon: typeof Search; title: (q: string) => string; text: string; button: string; go: 'clear' | 'todas' }> = {
  busca: {
    icon: Search,
    title: (q) => `Nada encontrado para "${q}"`,
    text: 'Tente outra palavra, como o formato (json, xml), o documento (cpf, cep) ou a tarefa (comparar, converter).',
    button: 'Limpar a busca',
    go: 'clear',
  },
  favoritas: {
    icon: Star,
    title: () => 'Você ainda não tem favoritas',
    text: 'Clique na estrela de uma ferramenta para fixá-la aqui. As favoritas ficam guardadas neste navegador.',
    button: 'Ver todas as ferramentas',
    go: 'todas',
  },
  recentes: {
    icon: History,
    title: () => 'Nenhuma ferramenta aberta ainda',
    text: 'As ferramentas que você abrir aparecem aqui, da mais recente para a mais antiga.',
    button: 'Ver todas as ferramentas',
    go: 'todas',
  },
};

// Tela do DevTools: busca, pílulas dos 5 grupos + Qualidade + Favoritas + Recentes, e cartões com selo.
// `?grupo=` escolhe a pílula (a antiga Central de qualidade abre em `?grupo=qualidade`).
export function DevToolsHub({ onOpenGuide }: { onOpenGuide?: () => void }) {
  const params = useSearchParams();
  const [tab, setTab] = useState<DevToolHubTab>(() => parseHubTab(params.get('grupo')));
  const [query, setQuery] = useState('');
  const searchRef = useRef<HTMLInputElement>(null);
  const { favorites, recents, toggleFavorite } = useDevToolPrefs();
  const [now] = useState(() => Date.now());

  // Vindo de outro link (ex.: /qa) com a tela já aberta: acompanha o parâmetro.
  const grupoParam = params.get('grupo');
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- sincroniza a pílula com a URL quando ela muda por fora
    setTab(parseHubTab(grupoParam));
  }, [grupoParam]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (e.key === '/' && !e.metaKey && !e.ctrlKey && t && !['INPUT', 'TEXTAREA', 'SELECT'].includes(t.tagName) && !t.isContentEditable) {
        e.preventDefault();
        searchRef.current?.focus();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const goTab = (next: DevToolHubTab) => {
    setTab(next);
    setQuery('');
    try {
      const url = new URL(window.location.href);
      if (next === 'todas') url.searchParams.delete('grupo');
      else url.searchParams.set('grupo', next);
      window.history.replaceState(null, '', `${url.pathname}${url.search}`);
    } catch {
      /* sem history: a pílula vale só nesta visita */
    }
  };

  const view = useMemo(() => buildHubView({ tab, query, favorites, recents, now }), [tab, query, favorites, recents, now]);
  const counts = useMemo(() => tabCounts(favorites, recents), [favorites, recents]);
  const hasQuery = query.trim().length > 0;
  const nLocal = DEVTOOLS.filter(isLocalTool).length;
  const nExt = networkTools().length;
  const empty = view.empty ? EMPTY[view.empty] : null;
  const EmptyIcon = empty?.icon;

  const pill = (id: DevToolHubTab, icon?: typeof Star, gap = false) => {
    const on = !hasQuery && tab === id;
    const Icon = icon;
    return (
      <button
        key={id}
        type="button"
        role="tab"
        aria-selected={on}
        onClick={() => goTab(id)}
        className={cn(
          'inline-flex h-9 items-center gap-2 rounded-full border px-3.5 text-sm font-semibold transition-colors duration-fast',
          FOCUS_RING,
          gap && 'sm:ml-2.5',
          on ? 'border-primary/50 bg-primary/10 text-foreground dark:bg-primary/15' : 'border-border bg-transparent text-foreground hover:bg-accent',
        )}
      >
        {Icon && <Icon className="h-[15px] w-[15px]" strokeWidth={1.5} aria-hidden="true" />}
        {TAB_LABEL[id]}
        <span className="text-xs font-semibold tabular-nums text-muted-foreground">{counts[id]}</span>
      </button>
    );
  };

  return (
    <div className="flex flex-col gap-5">
      <section className="flex flex-col gap-2.5" aria-label="Busca e filtros">
        <div className="relative">
          <Search className="pointer-events-none absolute left-[18px] top-[16px] h-5 w-5 text-muted-foreground" strokeWidth={1.5} aria-hidden="true" />
          <label htmlFor="dt-busca" className="sr-only">Buscar ferramenta</label>
          <input
            id="dt-busca"
            ref={searchRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar por nome ou tarefa: json, cep, token, cron..."
            autoComplete="off"
            className={cn(
              'h-[52px] w-full rounded-[14px] border border-border bg-card pl-[52px] pr-16 text-base text-foreground placeholder:text-muted-foreground',
              'focus-visible:border-primary/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
            )}
          />
          {hasQuery && (
            <button
              type="button"
              onClick={() => setQuery('')}
              aria-label="Limpar a busca"
              className={cn('absolute right-[54px] top-[11px] flex h-[30px] w-[30px] items-center justify-center rounded-lg text-muted-foreground hover:bg-accent', FOCUS_RING)}
            >
              <X className="h-4 w-4" strokeWidth={1.5} aria-hidden="true" />
            </button>
          )}
          <kbd
            aria-label="Atalho: tecla barra"
            className="absolute right-4 top-[14px] inline-flex h-6 min-w-6 items-center justify-center rounded-md border border-border bg-muted px-1.5 font-code text-[13px] text-muted-foreground"
          >
            /
          </kbd>
        </div>

        <div role="tablist" aria-label="Grupos de ferramentas" className="flex flex-wrap items-center gap-x-1.5 gap-y-2">
          {pill('todas')}
          {DEVTOOL_GROUPS.map((g) => pill(g.id))}
          {pill(HUB_FILTER_QUALITY, CircleCheck, true)}
          {pill(HUB_FILTER_FAVORITES, Star)}
          {pill(HUB_FILTER_RECENTS, History)}
        </div>

        <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[13px] text-muted-foreground">
          <span className="inline-flex items-center gap-1.5">
            <Monitor className="h-3.5 w-3.5" strokeWidth={1.5} aria-hidden="true" />
            {nLocal} rodam no navegador
          </span>
          <span className="inline-flex items-center gap-1.5">
            <Cloud className={cn('h-3.5 w-3.5', TONES.warn.text)} strokeWidth={1.5} aria-hidden="true" />
            {nExt} usam serviço externo
          </span>
          {onOpenGuide && (
            <button type="button" onClick={onOpenGuide} className={cn('rounded-md font-semibold text-foreground underline underline-offset-2', FOCUS_RING)}>
              Ver quais
            </button>
          )}
        </div>
      </section>

      {view.hintFavorite && (
        <div className="flex items-center gap-2.5 rounded-xl border border-dashed border-border px-4 py-3 text-sm text-muted-foreground">
          <Star className="h-4 w-4 shrink-0" strokeWidth={1.5} aria-hidden="true" />
          Marque a estrela de uma ferramenta para fixá-la aqui, no topo.
        </div>
      )}

      {empty && EmptyIcon && (
        <section className="flex flex-col items-center gap-2.5 rounded-2xl border border-dashed border-border px-6 py-16 text-center">
          <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-muted text-muted-foreground">
            <EmptyIcon className="h-[26px] w-[26px]" strokeWidth={1.5} aria-hidden="true" />
          </span>
          <h2 className="text-xl font-bold text-foreground">{empty.title(query.trim())}</h2>
          <p className="max-w-[460px] text-sm leading-relaxed text-muted-foreground">{empty.text}</p>
          <button
            type="button"
            onClick={() => (empty.go === 'clear' ? setQuery('') : goTab('todas'))}
            className={cn(toolButtonClass(true), 'h-[42px]')}
          >
            {empty.button}
          </button>
        </section>
      )}

      {view.sections.map((sec) => (
        <section key={sec.id} aria-label={sec.title} className="flex flex-col gap-3">
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <h2 className="text-lg font-bold text-foreground">{sec.title}</h2>
            <span className="text-[13px] text-muted-foreground">{sec.sub}</span>
          </div>
          <div className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,300px),1fr))] gap-3.5">
            {sec.cards.map((card) => (
              <ToolCard key={`${sec.id}-${card.tool.id}`} card={card} starred={favorites.includes(card.tool.id)} onToggle={() => toggleFavorite(card.tool.id)} />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
