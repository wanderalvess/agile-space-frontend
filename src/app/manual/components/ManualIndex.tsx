'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { LayoutGrid, Search, X } from 'lucide-react';
import { PageHeader } from '@/components/page';
import { FOCUS_RING } from '@/components/room-kit/tokens';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { moduleIcon } from '@/lib/modules-registry';
import { cn } from '@/lib/utils';
import packageInfo from '../../../../package.json';
import { TOPIC_CONTENT } from '../content';
import { buildIndex, searchTopics, type SearchHit } from '../data/search';
import { MANUAL_CATEGORIES, MANUAL_TOPICS, resolveTopicId, type ManualCategoryId } from '../data/topics';
import { TopicCard } from './TopicCard';

const SupportIcon = moduleIcon('support');
const VersionIcon = moduleIcon('changelog');
const SAMPLES = ['poker', 'chave', 'jira'];

const BUTTON = cn(
  'inline-flex h-10 items-center justify-center gap-2 rounded-[10px] border border-border bg-card px-4 text-sm font-semibold text-foreground hover:bg-accent',
  FOCUS_RING,
);

/** Índice montado uma vez: título, frase, palavras-chave e o texto de todos os tópicos. */
const INDEX = buildIndex(MANUAL_TOPICS, TOPIC_CONTENT);

function plural(n: number, one: string, many: string) {
  return `${n} ${n === 1 ? one : many}`;
}

export function ManualIndex() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<ManualCategoryId | null>(null);
  useDocumentTitle('Manual');

  // Compatibilidade: /manual#poker (ou um apelido antigo) leva ao tópico.
  useEffect(() => {
    const go = () => {
      const hash = window.location.hash.replace('#', '');
      const id = hash ? resolveTopicId(hash) : undefined;
      if (id) router.replace(`/manual/${id}`);
    };
    go();
    window.addEventListener('hashchange', go);
    return () => window.removeEventListener('hashchange', go);
  }, [router]);

  // Atalho: "/" leva o foco à busca, a não ser que a pessoa já esteja digitando.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== '/' || e.metaKey || e.ctrlKey || e.altKey) return;
      const t = e.target as HTMLElement | null;
      if (t && (['INPUT', 'TEXTAREA', 'SELECT'].includes(t.tagName) || t.isContentEditable)) return;
      e.preventDefault();
      inputRef.current?.focus();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  const searching = query.trim().length > 0;
  const allHits = useMemo(() => searchTopics(INDEX, query), [query]);
  const hits: SearchHit[] = useMemo(
    () => (category ? allHits.filter((h) => h.topic.category === category) : allHits),
    [allHits, category],
  );
  const countIn = (id: ManualCategoryId) => allHits.filter((h) => h.topic.category === id).length;

  const groups = searching
    ? []
    : MANUAL_CATEGORIES.map((c) => ({ category: c, items: hits.filter((h) => h.topic.category === c.id) })).filter((g) => g.items.length > 0);

  const clear = () => {
    setQuery('');
    inputRef.current?.focus();
  };

  return (
    <>
      <PageHeader
        title="Manual"
        module="manual"
        subtitle="Como usar cada parte do portal, com exemplos do dia a dia."
        actions={
          <>
            <Link href="/support" className={BUTTON}>
              <SupportIcon className="h-4 w-4" strokeWidth={1.5} aria-hidden="true" />
              Falar com o suporte
            </Link>
            <Link href="/changelog" className={BUTTON}>
              <VersionIcon className="h-4 w-4" strokeWidth={1.5} aria-hidden="true" />O que mudou na v{packageInfo.version}
            </Link>
          </>
        }
      />

      <section aria-label="Busca" className="flex flex-col gap-2.5">
        <label className="relative block">
          <span className="sr-only">Buscar no manual</span>
          <Search className="pointer-events-none absolute left-[18px] top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" strokeWidth={1.5} aria-hidden="true" />
          <input
            ref={inputRef}
            id="manual-busca"
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Escape' && query) setQuery('');
            }}
            placeholder="Buscar no manual: título ou texto"
            autoComplete="off"
            className={cn(
              'h-14 w-full rounded-[14px] border border-border bg-card pl-[52px] pr-[90px] text-base text-foreground placeholder:text-muted-foreground [&::-webkit-search-cancel-button]:hidden',
              FOCUS_RING,
            )}
          />
          {searching && (
            <button
              type="button"
              onClick={clear}
              aria-label="Limpar busca"
              className={cn('absolute right-[52px] top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-lg text-muted-foreground hover:bg-accent max-sm:h-11 max-sm:w-11', FOCUS_RING)}
            >
              <X className="h-4 w-4" strokeWidth={1.5} aria-hidden="true" />
            </button>
          )}
          <kbd aria-hidden="true" className="absolute right-4 top-1/2 flex h-[26px] w-[26px] -translate-y-1/2 items-center justify-center rounded-[7px] border border-border bg-muted text-[13px] font-semibold text-muted-foreground max-sm:hidden">
            /
          </kbd>
        </label>
        <div className="flex flex-wrap items-center gap-2 text-[13px] text-muted-foreground">
          <span>Experimente:</span>
          {SAMPLES.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setQuery(s)}
              className={cn('h-7 rounded-full border border-border px-3 text-[13px] text-foreground hover:bg-accent max-sm:h-11', FOCUS_RING)}
            >
              {s}
            </button>
          ))}
        </div>
      </section>

      <div className="grid grid-cols-1 items-start gap-8 lg:grid-cols-[264px_minmax(0,1fr)]">
        <aside className="flex flex-col gap-4 lg:sticky lg:top-20">
          <nav aria-label="Categorias do manual" className="flex gap-1 overflow-x-auto pb-1 lg:flex-col lg:overflow-visible lg:pb-0">
            <p className="mb-1.5 ml-3 hidden text-xs font-bold text-muted-foreground lg:block">Categorias</p>
            {[{ id: null, label: 'Todas', Icon: LayoutGrid, n: allHits.length }, ...MANUAL_CATEGORIES.map((c) => ({ id: c.id, label: c.label, Icon: moduleIcon(c.iconModule), n: countIn(c.id) }))].map(
              ({ id, label, Icon, n }) => {
                const on = category === id;
                return (
                  <button
                    key={label}
                    type="button"
                    aria-pressed={on}
                    onClick={() => setCategory(id)}
                    className={cn(
                      'flex h-[42px] shrink-0 items-center gap-2.5 rounded-[10px] border px-3 text-left text-sm max-sm:h-11 lg:w-full',
                      on ? 'border-primary/40 bg-primary/10 font-bold text-foreground dark:bg-primary/15' : 'border-transparent font-medium text-muted-foreground hover:bg-accent hover:text-foreground',
                      FOCUS_RING,
                    )}
                  >
                    <Icon className="h-[17px] w-[17px] shrink-0" strokeWidth={1.5} aria-hidden="true" />
                    <span className="flex-1 whitespace-nowrap">{label}</span>
                    <span className="text-xs text-muted-foreground">{n}</span>
                  </button>
                );
              },
            )}
          </nav>
          <div className="hidden flex-col gap-1.5 rounded-xl border border-border bg-card p-3.5 lg:flex">
            <p className="text-sm font-bold text-foreground">Não achou?</p>
            <p className="text-[13px] leading-relaxed text-muted-foreground">Conte o que você procurava. O manual cresce com as perguntas da squad.</p>
            <Link href="/support" className={cn('w-fit rounded-sm text-[13px] font-semibold text-foreground underline underline-offset-2', FOCUS_RING)}>
              Abrir um chamado
            </Link>
          </div>
        </aside>

        <div className="flex min-w-0 flex-col gap-7">
          <p role="status" className={searching && hits.length > 0 ? 'text-sm text-muted-foreground' : 'sr-only'}>
            {searching ? `${plural(hits.length, 'tópico encontrado', 'tópicos encontrados')} para “${query.trim()}”` : ''}
          </p>

          {hits.length === 0 && (
            <section className="flex flex-col items-center gap-2.5 rounded-2xl border border-dashed border-border px-6 py-16 text-center">
              <span aria-hidden="true" className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-muted text-muted-foreground">
                <Search className="h-[26px] w-[26px]" strokeWidth={1.5} />
              </span>
              <h2 className="text-xl font-bold text-foreground">{searching ? `Nada encontrado para “${query.trim()}”` : 'Nenhum tópico nesta categoria'}</h2>
              <p className="max-w-md text-sm leading-relaxed text-muted-foreground">
                Confira a grafia, tente uma palavra mais curta ou veja uma categoria inteira. Se o assunto deveria estar aqui, avise o suporte.
              </p>
              <div className="mt-1.5 flex flex-wrap justify-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setQuery('');
                    setCategory(null);
                  }}
                  className={cn('inline-flex h-10 items-center rounded-[10px] bg-primary px-4 text-sm font-semibold text-primary-foreground hover:bg-primary/90', FOCUS_RING)}
                >
                  Limpar busca
                </button>
                <Link href="/support" className={BUTTON}>
                  Falar com o suporte
                </Link>
              </div>
            </section>
          )}

          {searching && hits.length > 0 && (
            <section aria-label="Resultados" className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
              {hits.map((h) => (
                <TopicCard key={h.topic.id} topic={h.topic} snippet={h.snippet} />
              ))}
            </section>
          )}

          {groups.map(({ category: c, items }) => (
            <section key={c.id} aria-labelledby={`cat-${c.id}`} className="flex flex-col gap-3.5">
              <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 border-b border-border pb-2">
                <h2 id={`cat-${c.id}`} className="text-xl font-bold text-foreground">
                  {c.label}
                </h2>
                <span className="text-[13px] text-muted-foreground">{c.description}</span>
              </div>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
                {items.map((h) => (
                  <TopicCard key={h.topic.id} topic={h.topic} />
                ))}
              </div>
            </section>
          ))}
        </div>
      </div>
    </>
  );
}
