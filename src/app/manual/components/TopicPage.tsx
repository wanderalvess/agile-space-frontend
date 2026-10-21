import Link from 'next/link';
import { ArrowLeft, ArrowRight, ArrowUpRight, BookOpen, ChevronRight, LifeBuoy } from 'lucide-react';
import { CARD_SHADOW, FOCUS_RING } from '@/components/room-kit/tokens';
import { cn } from '@/lib/utils';
import type { ManualBlock } from '../content/types';
import { headingsOf, readingMinutes } from '../data/search';
import { getCategory, getTopicById, neighborsOf, type ManualTopic } from '../data/topics';
import { TopicBlocks } from './TopicBlocks';
import { TopicHelpful } from './TopicHelpful';
import { TopicNav, TopicNavSheet } from './TopicNav';
import { TopicToc } from './TopicToc';

const CARD = cn('border border-border bg-card text-card-foreground', CARD_SHADOW);
const CHIP = 'inline-flex h-6 items-center rounded-full border border-border px-2.5 text-xs text-muted-foreground';
const PRIMARY_LINK = cn(
  'inline-flex h-10 items-center justify-center gap-2 rounded-[10px] bg-primary px-4 text-sm font-semibold text-primary-foreground hover:bg-primary/90',
  FOCUS_RING,
);

function Breadcrumb({ topic }: { topic: ManualTopic }) {
  const category = getCategory(topic.category);
  return (
    <nav aria-label="Caminho" className="flex flex-wrap items-center gap-1.5 text-[13px] text-muted-foreground">
      <Link href="/manual" className={cn('inline-flex min-h-6 items-center gap-1.5 rounded-md hover:text-foreground max-sm:min-h-11', FOCUS_RING)}>
        <BookOpen className="h-3.5 w-3.5" strokeWidth={1.5} aria-hidden="true" />
        Manual
      </Link>
      <ChevronRight className="h-3 w-3" strokeWidth={1.5} aria-hidden="true" />
      <span>{category.label}</span>
      <ChevronRight className="h-3 w-3" strokeWidth={1.5} aria-hidden="true" />
      <span aria-current="page" className="font-semibold text-foreground">
        {topic.title}
      </span>
    </nav>
  );
}

function TopicHeader({ topic, minutes }: { topic: ManualTopic; minutes: number }) {
  const Icon = topic.icon;
  return (
    <header className={cn('flex flex-col gap-4 rounded-[20px] p-7 max-sm:p-5', CARD)}>
      <div className="flex flex-wrap items-center gap-[18px]">
        <span aria-hidden="true" className="inline-flex h-16 w-16 shrink-0 items-center justify-center rounded-[18px] bg-primary/10 text-foreground ring-1 ring-inset ring-primary/25 dark:bg-primary/15">
          <Icon className="h-8 w-8" strokeWidth={1.5} />
        </span>
        <div className="flex min-w-0 flex-1 basis-64 flex-col gap-1">
          <h1 className="text-[34px] font-bold leading-[1.12] tracking-tight text-foreground max-sm:text-[28px]">{topic.title}</h1>
          <p className="text-base text-muted-foreground">{topic.summary}</p>
        </div>
        {topic.actionUrl && (
          <Link href={topic.actionUrl} className={cn(PRIMARY_LINK, 'h-[42px] max-sm:w-full')}>
            {topic.actionLabel ?? 'Abrir'}
            <ArrowUpRight className="h-4 w-4" strokeWidth={1.5} aria-hidden="true" />
          </Link>
        )}
      </div>
      <div className="flex flex-wrap gap-2 border-t border-border pt-3.5">
        <span className="inline-flex h-6 items-center rounded-full bg-primary/10 px-2.5 text-xs font-bold text-foreground dark:bg-primary/15">{getCategory(topic.category).label}</span>
        {topic.isNew && <span className="inline-flex h-6 items-center rounded-full bg-emerald-500/15 px-2.5 text-xs font-bold text-emerald-800 dark:text-emerald-300">Novo</span>}
        <span className={CHIP}>Atualizado em {topic.updatedIn}</span>
        <span className={CHIP}>Leitura de {minutes} min</span>
      </div>
    </header>
  );
}

function Pager({ id }: { id: string }) {
  const { prev, next } = neighborsOf(id);
  const box = cn('flex items-center gap-3.5 rounded-[14px] px-[18px] py-4 hover:bg-accent', CARD, FOCUS_RING);
  return (
    <nav aria-label="Anterior e próximo" className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      {prev ? (
        <Link href={`/manual/${prev.id}`} className={box}>
          <ArrowLeft className="h-[18px] w-[18px] shrink-0 text-muted-foreground" strokeWidth={1.5} aria-hidden="true" />
          <span className="flex min-w-0 flex-col gap-0.5">
            <span className="text-xs text-muted-foreground">Anterior</span>
            <span className="truncate text-base font-bold text-foreground">{prev.title}</span>
          </span>
        </Link>
      ) : (
        <span aria-hidden="true" className="hidden sm:block" />
      )}
      {next && (
        <Link href={`/manual/${next.id}`} className={cn(box, 'justify-end text-right sm:col-start-2')}>
          <span className="flex min-w-0 flex-col gap-0.5">
            <span className="text-xs text-muted-foreground">Próximo</span>
            <span className="truncate text-base font-bold text-foreground">{next.title}</span>
          </span>
          <ArrowRight className="h-[18px] w-[18px] shrink-0 text-muted-foreground" strokeWidth={1.5} aria-hidden="true" />
        </Link>
      )}
    </nav>
  );
}

function Aside({ topic, blocks }: { topic: ManualTopic; blocks: ManualBlock[] }) {
  const related = topic.related.map((id) => getTopicById(id)).filter((t): t is ManualTopic => !!t);
  return (
    <aside className="flex flex-col gap-4 lg:col-start-2 xl:sticky xl:top-20 xl:col-start-3 xl:row-start-1 xl:self-start">
      <div className="hidden xl:block">
        <TopicToc key={topic.id} headings={headingsOf(blocks)} />
      </div>

      {related.length > 0 && (
        <section aria-labelledby="veja-tambem" className={cn('flex flex-col gap-1.5 rounded-[14px] p-4', CARD)}>
          <h2 id="veja-tambem" className="text-[15px] font-bold text-foreground">
            Veja também
          </h2>
          {related.map((r) => {
            const Icon = r.icon;
            return (
              <Link
                key={r.id}
                href={`/manual/${r.id}`}
                className={cn('-mx-2 flex h-10 items-center gap-2.5 rounded-lg px-2 text-sm text-foreground hover:bg-accent max-sm:h-11', FOCUS_RING)}
              >
                <Icon className="h-4 w-4 shrink-0 text-foreground" strokeWidth={1.5} aria-hidden="true" />
                {r.title}
              </Link>
            );
          })}
        </section>
      )}

      <section aria-labelledby="falar-suporte" className="flex flex-col gap-2.5 rounded-[14px] border border-primary/30 bg-primary/10 p-4 dark:bg-primary/15">
        <div className="flex items-center gap-2.5">
          <LifeBuoy className="h-5 w-5 shrink-0 text-foreground" strokeWidth={1.5} aria-hidden="true" />
          <h2 id="falar-suporte" className="text-[15px] font-bold text-foreground">
            Ainda com dúvida?
          </h2>
        </div>
        <p className="text-sm leading-relaxed text-muted-foreground">Abra um chamado e conte o que você tentou. A resposta chega no portal.</p>
        <Link href="/support" className={PRIMARY_LINK}>
          Falar com o suporte
        </Link>
      </section>
    </aside>
  );
}

/**
 * Página de um tópico do Manual: sumário de tópicos à esquerda, texto até 1040 px no centro e, à direita,
 * "Neste tópico", "Veja também" e o atalho do Suporte. Abaixo de 1280 px a coluna da direita desce para depois do texto
 * e, abaixo de 1024 px, o sumário vira a folha "Tópicos".
 */
export function TopicPage({ topic, blocks }: { topic: ManualTopic; blocks: ManualBlock[] }) {
  return (
    <div className="flex flex-col gap-5">
      <Breadcrumb topic={topic} />
      <TopicNavSheet currentId={topic.id} />
      <div className="grid grid-cols-1 items-start gap-10 lg:grid-cols-[264px_minmax(0,1fr)] xl:grid-cols-[280px_minmax(0,1040px)_288px] xl:justify-center">
        <div className="hidden lg:row-span-2 lg:block xl:row-span-1">
          <TopicNav currentId={topic.id} />
        </div>
        <article className="flex min-w-0 flex-col gap-6 motion-safe:animate-in motion-safe:fade-in motion-safe:duration-200">
          <TopicHeader topic={topic} minutes={readingMinutes(blocks)} />
          <TopicBlocks blocks={blocks} />
          <TopicHelpful key={topic.id} topicId={topic.id} />
          <Pager id={topic.id} />
        </article>
        <Aside topic={topic} blocks={blocks} />
      </div>
    </div>
  );
}
