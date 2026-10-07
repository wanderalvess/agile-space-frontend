'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { ArrowUpRight, Hourglass, Search, SearchX } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import {
  DEVTOOLS,
  DEVTOOL_CATEGORIES,
  getCategory,
  getDevToolHref,
  type DevToolCategoryId,
  type DevToolMeta,
} from '@/lib/devtools/registry';

interface DevToolsHubProps {
  /** 'qa' filtra a visão da Central de Qualidade; sem valor mostra tudo. */
  collection?: 'qa';
}

function ToolCard({ tool }: { tool: DevToolMeta }) {
  const Icon = tool.icon;
  const soon = tool.status === 'soon';
  const category = getCategory(tool.category);

  const body = (
    <Card
      className={cn(
        'group relative flex h-full min-h-[188px] flex-col justify-between overflow-hidden rounded-[2rem] border border-slate-200 bg-white/60 p-6 backdrop-blur-xl transition-all duration-300 dark:border-slate-800 dark:bg-slate-900/60',
        soon ? 'opacity-70' : 'shadow-lg hover:border-primary/40 hover:shadow-2xl dark:shadow-none dark:hover:border-primary/40',
      )}
    >
      <div className="pointer-events-none absolute right-0 top-0 h-28 w-28 rounded-full bg-primary/5 blur-2xl transition-transform duration-700 group-hover:scale-125 dark:bg-primary/10" />
      <div className="relative z-10">
        <div className="mb-4 flex items-center justify-between">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-primary/20 bg-primary/10 transition-transform duration-300 group-hover:scale-110">
            <Icon className="h-5 w-5 text-primary" />
          </div>
          {soon ? (
            <span className="inline-flex items-center gap-1 rounded-full border border-primary/20 bg-primary/10 px-2.5 py-1 text-[9px] font-black uppercase tracking-widest text-primary">
              <Hourglass className="h-3 w-3" /> Em breve
            </span>
          ) : (
            <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[9px] font-black uppercase tracking-widest text-slate-500 dark:border-slate-800/80 dark:bg-slate-950">
              {category.label}
            </span>
          )}
        </div>
        <h3 className="mb-2 flex items-center gap-1.5 font-headline text-lg font-black uppercase tracking-tight text-slate-950 transition-colors group-hover:text-primary dark:text-slate-50">
          {tool.title}
          {!soon && <ArrowUpRight className="h-4 w-4 text-primary opacity-0 transition-all duration-300 group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:opacity-100" />}
        </h3>
        <p className="text-[13px] font-medium leading-relaxed text-slate-500 dark:text-slate-400">{tool.description}</p>
      </div>
    </Card>
  );

  if (soon) return <div aria-disabled="true">{body}</div>;
  return (
    <Link href={getDevToolHref(tool.id)} className="block h-full rounded-[2rem] outline-none focus-visible:ring-2 focus-visible:ring-primary">
      {body}
    </Link>
  );
}

// Hub único de ferramentas. A Central de Qualidade (/qa) é este mesmo hub filtrado por `collection="qa"`.
export function DevToolsHub({ collection }: DevToolsHubProps) {
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<DevToolCategoryId | 'all'>('all');
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (e.key === '/' && !e.metaKey && !e.ctrlKey && t && !['INPUT', 'TEXTAREA'].includes(t.tagName) && !t.isContentEditable) {
        e.preventDefault();
        searchRef.current?.focus();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const base = useMemo(() => DEVTOOLS.filter(t => (collection === 'qa' ? t.qa : true)), [collection]);
  const categories = useMemo(() => DEVTOOL_CATEGORIES.filter(c => base.some(t => t.category === c.id)), [base]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return base
      .filter(t => category === 'all' || t.category === category)
      .filter(t => !q || [t.title, t.description, ...t.keywords].some(s => s.toLowerCase().includes(q)))
      // prontas primeiro; dentro de cada grupo, ordem alfabética
      .sort((a, b) => (a.status === b.status ? a.title.localeCompare(b.title, 'pt-BR') : a.status === 'ready' ? -1 : 1));
  }, [base, category, query]);

  const readyCount = base.filter(t => t.status === 'ready').length;

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 md:flex-row md:items-center">
        <div className="relative w-full md:max-w-sm">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <Input
            ref={searchRef}
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Buscar ferramenta (tecle / para focar)"
            aria-label="Buscar ferramenta"
            className="h-10 rounded-xl pl-9"
          />
        </div>
        <div className="flex flex-wrap gap-1.5" role="tablist" aria-label="Categorias">
          {[{ id: 'all' as const, label: 'Todas' }, ...categories].map(c => (
            <button
              key={c.id}
              type="button"
              role="tab"
              aria-selected={category === c.id}
              onClick={() => setCategory(c.id)}
              className={cn(
                'rounded-full border px-3 py-1.5 text-[10px] font-black uppercase tracking-widest transition-colors',
                category === c.id
                  ? 'border-primary bg-primary text-primary-foreground'
                  : 'border-border bg-card text-muted-foreground hover:border-primary/40 hover:text-foreground',
              )}
            >
              {c.label}
            </button>
          ))}
        </div>
        <span className="text-[11px] font-bold text-muted-foreground md:ml-auto">
          {readyCount} disponíveis · {base.length - readyCount} em breve
        </span>
      </div>

      {visible.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-[2rem] border border-dashed border-border py-16 text-center">
          <SearchX className="h-8 w-8 text-muted-foreground/50" aria-hidden />
          <p className="text-sm font-bold text-foreground">Nenhuma ferramenta encontrada</p>
          <p className="text-xs font-medium text-muted-foreground">Tente outro termo ou limpe o filtro de categoria.</p>
        </div>
      ) : (
        <div className="grid auto-rows-fr grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
          {visible.map(tool => (
            <ToolCard key={tool.id} tool={tool} />
          ))}
        </div>
      )}
    </div>
  );
}
