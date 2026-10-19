'use client';

import React, { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import { ArrowUp, ChevronRight, Download, ExternalLink, Link2, Pencil, RefreshCw, Star } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { AgileSpinner } from '@/components/ui/AgileSpinner';
import { cn } from '@/lib/utils';
import type { KnowledgeDocument } from '@/lib/knowledge-types';
import {
  buildTdnLink,
  buildToc,
  estimateReadingMinutes,
  findActiveHeadingIndex,
  formatSizeKb,
  formatUpdatedAgo,
  type TocItem,
} from '@/lib/knowledge-reader';
import { ArticleContent } from './ArticleContent';
import { DocumentHistory } from './DocumentHistory';

export interface ArticleReaderProps {
  document: KnowledgeDocument;
  isFavorite: boolean;
  onToggleFavorite: () => void;
  /** Volta para a lista da Base de Conhecimento. */
  onBack: () => void;
  /** Sincroniza com o TDN. O botão só aparece para artigo importado do TDN. */
  onSync: () => void;
  isSyncing: boolean;
  /** Abre o diálogo de formato de exportação. */
  onExport: () => void;
  /** Abre o editor. O botão só aparece quando o usuário pode editar. */
  onEdit: () => void;
  /** URL base do TDN configurada pelo usuário; sem ela não há link "Abrir original". */
  tdnBaseUrl?: string | null;
  /** Depois de restaurar uma versão, com o documento já atualizado. */
  onRestored: (doc: KnowledgeDocument) => void;
}

type ReaderTab = 'document' | 'history';

const TABS: { key: ReaderTab; label: string }[] = [
  { key: 'document', label: 'Documento' },
  { key: 'history', label: 'Histórico' },
];

const FOCUS = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ring-offset-background';

/** Linha de leitura (px abaixo do topo da área rolável) a partir da qual um heading conta como "atual". */
const READING_LINE = 96;

function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
}

function TocLinks({ items, activeId, onGo, compact }: { items: TocItem[]; activeId: string | null; onGo: (id: string) => void; compact?: boolean }) {
  const minLevel = Math.min(...items.map((i) => i.level));
  return (
    <ul className={cn('flex flex-col', !compact && 'border-l border-border')}>
      {items.map((item) => {
        const active = item.id === activeId;
        return (
          <li key={item.id}>
            <button
              type="button"
              onClick={() => onGo(item.id)}
              aria-current={active ? 'location' : undefined}
              style={{ paddingLeft: `${12 + (item.level - minLevel) * 14}px` }}
              className={cn(
                'block w-full py-1.5 pr-2 text-left text-sm leading-snug transition-colors',
                FOCUS,
                !compact && '-ml-px border-l-2',
                !compact && (active ? 'border-primary font-semibold text-foreground' : 'border-transparent text-muted-foreground hover:border-border hover:text-foreground'),
                compact && (active ? 'font-semibold text-foreground' : 'text-muted-foreground hover:text-foreground'),
              )}
            >
              {item.text}
            </button>
          </li>
        );
      })}
    </ul>
  );
}

function Chip({ children, tone = 'muted', className }: { children: React.ReactNode; tone?: 'muted' | 'brand'; className?: string }) {
  return (
    <span
      className={cn(
        'inline-flex h-6 items-center rounded-full px-2.5 text-xs',
        tone === 'brand' ? 'bg-primary/10 font-bold text-primary [.theme-totvs:not(.dark)_&]:text-foreground' : 'border border-border bg-muted/50 text-muted-foreground',
        className,
      )}
    >
      {children}
    </span>
  );
}

/**
 * Leitor de artigo da Base de Conhecimento: cabeçalho com ações, progresso de leitura,
 * abas Documento/Histórico, sumário "Nesta página" e coluna "Sobre este artigo".
 * A grade usa a largura da tela: sumário (lg+) | artigo | sobre este artigo (xl+).
 */
export function ArticleReader({
  document: doc,
  isFavorite,
  onToggleFavorite,
  onBack,
  onSync,
  isSyncing,
  onExport,
  onEdit,
  tdnBaseUrl,
  onRestored,
}: ArticleReaderProps) {
  const uid = useId();
  const [tab, setTab] = useState<ReaderTab>('document');
  const [progress, setProgress] = useState(0);
  const [activeId, setActiveId] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const tocDetailsRef = useRef<HTMLDetailsElement>(null);
  const frameRef = useRef<number | null>(null);

  const { items: toc, html: anchoredHtml } = useMemo(() => buildToc(doc.content || ''), [doc.content]);
  const hasToc = toc.length > 0;
  const readingMinutes = useMemo(() => estimateReadingMinutes(doc.content || ''), [doc.content]);
  const size = formatSizeKb(doc.byteSize);
  const updatedAgo = formatUpdatedAgo(doc.updatedAt);
  const updatedExact = useMemo(() => {
    const d = new Date(doc.updatedAt);
    return isNaN(d.getTime()) ? undefined : d.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
  }, [doc.updatedAt]);
  const isTdn = !!doc.tdnId;
  const tdnLink = isTdn ? buildTdnLink(tdnBaseUrl, doc.tdnId) : null;
  const tdnSpace = isTdn && doc.tags?.[0] === 'TDN' ? doc.tags[1] : undefined;
  const origin = isTdn ? `Importado do TDN${tdnSpace ? ` (espaço ${tdnSpace})` : ''}` : 'Escrito no portal';
  const tags = doc.tags || [];

  // Progresso de leitura e heading atual a partir do scroll da própria área do artigo.
  const measure = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const max = el.scrollHeight - el.clientHeight;
    setProgress(max > 0 ? Math.min(100, (el.scrollTop / max) * 100) : 0);
    const root = contentRef.current;
    if (root && toc.length > 0) {
      const base = el.getBoundingClientRect().top;
      const tops = toc.map((item) => {
        const h = root.querySelector(`[id="${item.id}"]`);
        return h ? h.getBoundingClientRect().top - base : Number.POSITIVE_INFINITY;
      });
      setActiveId(toc[findActiveHeadingIndex(tops, READING_LINE)]?.id ?? null);
    }
  }, [toc]);

  const onScroll = useCallback(() => {
    if (frameRef.current !== null) return;
    frameRef.current = requestAnimationFrame(() => {
      frameRef.current = null;
      measure();
    });
  }, [measure]);

  useEffect(() => {
    measure();
    window.addEventListener('resize', measure);
    return () => {
      window.removeEventListener('resize', measure);
      if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
      frameRef.current = null;
    };
  }, [measure, tab, anchoredHtml]);

  const switchTab = (next: ReaderTab) => {
    setTab(next);
    setProgress(0);
    scrollRef.current?.scrollTo?.({ top: 0 });
  };

  const onTabKeyDown = (e: React.KeyboardEvent) => {
    const i = TABS.findIndex((t) => t.key === tab);
    let next = -1;
    if (e.key === 'ArrowRight') next = (i + 1) % TABS.length;
    else if (e.key === 'ArrowLeft') next = (i - 1 + TABS.length) % TABS.length;
    else if (e.key === 'Home') next = 0;
    else if (e.key === 'End') next = TABS.length - 1;
    if (next < 0) return;
    e.preventDefault();
    switchTab(TABS[next].key);
    window.document.getElementById(`${uid}-tab-${TABS[next].key}`)?.focus();
  };

  const scrollToHeading = (id: string) => {
    const container = scrollRef.current;
    const target = contentRef.current?.querySelector(`[id="${id}"]`);
    if (!container || !target) return;
    // Fecha o sumário recolhível antes de medir: ele muda a altura acima do título de destino.
    if (tocDetailsRef.current) tocDetailsRef.current.open = false;
    const top = target.getBoundingClientRect().top - container.getBoundingClientRect().top + container.scrollTop - 16;
    container.scrollTo?.({ top, behavior: prefersReducedMotion() ? 'auto' : 'smooth' });
    setActiveId(id);
  };

  const scrollToTop = () => scrollRef.current?.scrollTo?.({ top: 0, behavior: prefersReducedMotion() ? 'auto' : 'smooth' });

  const shownProgress = tab === 'document' ? progress : 0;
  const titleId = `${uid}-title`;

  return (
    <section aria-label="Leitor de artigo" className="flex h-full min-h-0 flex-col bg-card/40 motion-safe:animate-in motion-safe:fade-in motion-safe:duration-300">
      <header className="shrink-0 border-b border-border bg-card/80 backdrop-blur-md">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-2.5 md:px-8">
          <nav aria-label="Caminho" className="flex min-w-0 flex-1 items-center gap-2 text-sm text-muted-foreground">
            <button
              type="button"
              onClick={onBack}
              className={cn('shrink-0 rounded-sm transition-colors hover:text-foreground', FOCUS)}
            >
              Base de Conhecimento
            </button>
            <ChevronRight className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            <span aria-current="page" className="min-w-0 truncate font-semibold text-foreground">
              {doc.title}
            </span>
          </nav>

          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              size="icon"
              onClick={onToggleFavorite}
              aria-pressed={isFavorite}
              aria-label={isFavorite ? 'Remover dos favoritos' : 'Favoritar artigo'}
              title={isFavorite ? 'Remover dos favoritos' : 'Favoritar artigo'}
              className="h-9 w-9 rounded-[10px]"
            >
              <Star className={cn('h-4 w-4', isFavorite ? 'fill-amber-500 text-amber-700 dark:text-amber-300' : 'text-muted-foreground')} aria-hidden="true" />
            </Button>

            {isTdn && (
              <Button variant="outline" size="sm" onClick={onSync} disabled={isSyncing} className="h-9 rounded-[10px]">
                {isSyncing ? <AgileSpinner size="xs" /> : <RefreshCw className="h-4 w-4" aria-hidden="true" />}
                {isSyncing ? 'Sincronizando...' : 'Sincronizar com o TDN'}
              </Button>
            )}

            <Button variant="outline" size="sm" onClick={onExport} className="h-9 rounded-[10px]">
              <Download className="h-4 w-4" aria-hidden="true" /> Exportar
            </Button>

            {doc.canEdit && (
              <Button size="sm" onClick={onEdit} className="h-9 rounded-[10px] font-semibold">
                <Pencil className="h-4 w-4" aria-hidden="true" /> Editar
              </Button>
            )}
          </div>
        </div>
      </header>

      <div
        role="progressbar"
        aria-label="Progresso de leitura"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(shownProgress)}
        className="h-[3px] shrink-0 bg-muted"
      >
        <div className="h-full bg-primary motion-safe:transition-[width] motion-safe:duration-150" style={{ width: `${shownProgress}%` }} />
      </div>

      <div role="tablist" aria-label="Seções do artigo" onKeyDown={onTabKeyDown} className="flex shrink-0 gap-1 border-b border-border bg-card/60 px-4 md:px-8">
        {TABS.map(({ key, label }) => {
          const selected = tab === key;
          return (
            <button
              key={key}
              id={`${uid}-tab-${key}`}
              type="button"
              role="tab"
              aria-selected={selected}
              aria-controls={`${uid}-panel-${key}`}
              tabIndex={selected ? 0 : -1}
              onClick={() => switchTab(key)}
              className={cn(
                '-mb-px h-11 border-b-2 px-4 text-sm transition-colors',
                FOCUS,
                selected ? 'border-primary font-bold text-foreground' : 'border-transparent font-medium text-muted-foreground hover:text-foreground',
              )}
            >
              {label}
            </button>
          );
        })}
      </div>

      <div ref={scrollRef} onScroll={onScroll} className="min-h-0 flex-1 overflow-y-auto">
        {tab === 'history' ? (
          <div role="tabpanel" id={`${uid}-panel-history`} aria-labelledby={`${uid}-tab-history`} className="mx-auto w-full max-w-[1680px] px-4 pb-24 pt-8 md:px-8 xl:px-12">
            <DocumentHistory
              documentId={doc.id}
              canEdit={!!doc.canEdit}
              onRestored={(restored) => {
                onRestored(restored);
                switchTab('document');
              }}
            />
          </div>
        ) : (
          <div
            role="tabpanel"
            id={`${uid}-panel-document`}
            aria-labelledby={`${uid}-tab-document`}
            className={cn(
              'mx-auto grid w-full max-w-[1680px] grid-cols-[minmax(0,1fr)] justify-center gap-x-12 px-4 pb-24 pt-8 md:px-8 xl:px-12',
              hasToc
                ? 'lg:grid-cols-[220px_minmax(0,1fr)] xl:grid-cols-[220px_minmax(0,1040px)_300px]'
                : 'xl:grid-cols-[minmax(0,1040px)_300px]',
            )}
          >
            {hasToc && (
              <nav aria-label="Nesta página" className="sticky top-8 hidden max-h-[calc(100dvh-16rem)] self-start overflow-y-auto pr-2 lg:block">
                <h2 className="mb-2 text-xs font-bold tracking-normal text-muted-foreground">Nesta página</h2>
                <TocLinks items={toc} activeId={activeId} onGo={scrollToHeading} />
              </nav>
            )}

            <article aria-labelledby={titleId} className="mx-auto w-full min-w-0 max-w-[1040px]">
              <header className="flex flex-col gap-4 border-b border-border pb-5">
                <div className="flex flex-wrap items-center gap-2">
                  {doc.category && <Chip tone="brand">{doc.category}</Chip>}
                  {tags.map((tag) => (
                    <Chip key={tag} className="xl:hidden">
                      {tag}
                    </Chip>
                  ))}
                </div>
                <h1 id={titleId} className="text-[1.75rem] font-bold leading-[1.1] tracking-tight text-foreground md:text-[2.5rem]">
                  {doc.title}
                </h1>
                <p className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground xl:hidden">
                  {!isTdn && <span>{origin}</span>}
                  {updatedAgo && <span title={updatedExact}>Atualizado {updatedAgo}</span>}
                  <span>Leitura de {readingMinutes} min</span>
                  {size && <span>{size}</span>}
                </p>
              </header>

              {isTdn && (
                <div className="mt-6 flex flex-wrap items-center gap-x-3 gap-y-1 rounded-xl border border-primary/30 bg-primary/10 px-4 py-3 text-sm text-foreground">
                  <Link2 className="h-4 w-4 shrink-0 text-primary [.theme-totvs:not(.dark)_&]:text-foreground" aria-hidden="true" />
                  <span className="min-w-0 flex-1">
                    {origin}.
                  </span>
                  {tdnLink && (
                    <a
                      href={tdnLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={cn('inline-flex items-center gap-1 rounded-sm font-bold text-primary [.theme-totvs:not(.dark)_&]:text-foreground underline-offset-4 hover:underline', FOCUS)}
                    >
                      Abrir original <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
                    </a>
                  )}
                </div>
              )}

              {hasToc && (
                <details ref={tocDetailsRef} className="group mt-6 rounded-xl border border-border bg-card px-4 lg:hidden">
                  <summary className={cn('flex h-11 cursor-pointer list-none items-center justify-between rounded-md text-sm font-semibold text-foreground', FOCUS)}>
                    Nesta página
                    <ChevronRight className="h-4 w-4 text-muted-foreground motion-safe:transition-transform group-open:rotate-90" aria-hidden="true" />
                  </summary>
                  <nav aria-label="Nesta página (recolhível)" className="pb-3">
                    <TocLinks items={toc} activeId={activeId} onGo={scrollToHeading} compact />
                  </nav>
                </details>
              )}

              <ArticleContent ref={contentRef} html={anchoredHtml} className="mt-8" />

              <div className="mt-12 flex justify-end border-t border-border pt-5">
                <button
                  type="button"
                  onClick={scrollToTop}
                  className={cn('inline-flex items-center gap-1.5 rounded-sm text-sm font-semibold text-primary [.theme-totvs:not(.dark)_&]:text-foreground underline-offset-4 hover:underline', FOCUS)}
                >
                  Voltar ao topo <ArrowUp className="h-3.5 w-3.5" aria-hidden="true" />
                </button>
              </div>
            </article>

            <aside aria-label="Sobre este artigo" className="hidden xl:block">
              <div className="sticky top-8 rounded-2xl border border-border bg-card p-5">
                <h2 className="text-sm font-bold text-foreground">Sobre este artigo</h2>
                <dl className="mt-4 flex flex-col gap-4 text-sm">
                  <div>
                    <dt className="text-xs text-muted-foreground">Origem</dt>
                    <dd className="mt-0.5 text-foreground">{origin}</dd>
                  </div>
                  {doc.fullPath && (
                    <div>
                      <dt className="text-xs text-muted-foreground">Pasta</dt>
                      <dd className="mt-0.5 break-words text-foreground">{doc.fullPath}</dd>
                    </div>
                  )}
                  {doc.category && (
                    <div>
                      <dt className="text-xs text-muted-foreground">Categoria</dt>
                      <dd className="mt-0.5 text-foreground">{doc.category}</dd>
                    </div>
                  )}
                  {tags.length > 0 && (
                    <div>
                      <dt className="text-xs text-muted-foreground">Etiquetas</dt>
                      <dd className="mt-1.5 flex flex-wrap gap-1.5">
                        {tags.map((tag) => (
                          <Chip key={tag}>{tag}</Chip>
                        ))}
                      </dd>
                    </div>
                  )}
                  {updatedAgo && (
                    <div>
                      <dt className="text-xs text-muted-foreground">Atualizado</dt>
                      <dd className="mt-0.5 text-foreground" title={updatedExact}>
                        {updatedAgo}
                      </dd>
                    </div>
                  )}
                  {size && (
                    <div>
                      <dt className="text-xs text-muted-foreground">Tamanho</dt>
                      <dd className="mt-0.5 text-foreground">{size}</dd>
                    </div>
                  )}
                  <div>
                    <dt className="text-xs text-muted-foreground">Tempo de leitura</dt>
                    <dd className="mt-0.5 text-foreground">{readingMinutes} min</dd>
                  </div>
                </dl>
              </div>
            </aside>
          </div>
        )}
      </div>
    </section>
  );
}
