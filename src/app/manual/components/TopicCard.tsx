import Link from 'next/link';
import { CARD_SHADOW, FOCUS_RING } from '@/components/room-kit/tokens';
import { moduleIcon } from '@/lib/modules-registry';
import { cn } from '@/lib/utils';
import type { ManualTopic } from '../data/topics';

const VersionIcon = moduleIcon('changelog');

/** Cartão de um tópico no índice: ícone do módulo, nome, frase, trecho do texto (na busca) e "Atualizado em". */
export function TopicCard({ topic, snippet }: { topic: ManualTopic; snippet?: string }) {
  const Icon = topic.icon;
  return (
    <Link
      href={`/manual/${topic.id}`}
      className={cn(
        'group flex min-h-[156px] flex-col gap-3 rounded-2xl border border-border bg-card p-[18px] text-card-foreground',
        CARD_SHADOW,
        'motion-safe:transition-[transform,border-color] motion-safe:duration-200 motion-safe:hover:-translate-y-0.5 hover:border-primary/60',
        FOCUS_RING,
      )}
    >
      <div className="flex items-center gap-3">
        <span aria-hidden="true" className="inline-flex h-[42px] w-[42px] shrink-0 items-center justify-center rounded-xl bg-primary/10 text-foreground dark:bg-primary/15">
          <Icon className="h-[21px] w-[21px]" strokeWidth={1.5} />
        </span>
        <h3 className="flex-1 text-base font-bold leading-tight text-foreground">{topic.title}</h3>
        {topic.isNew && <span className="inline-flex h-[22px] items-center rounded-full bg-emerald-500/15 px-2.5 text-xs font-bold text-emerald-800 dark:text-emerald-300">Novo</span>}
      </div>
      <p className="text-sm leading-relaxed text-muted-foreground">{topic.summary}</p>
      {snippet && (
        <p className="rounded-lg bg-muted px-2.5 py-2 text-[13px] leading-snug text-foreground">
          <span className="font-semibold">No texto:</span> {snippet}
        </p>
      )}
      <span className="flex-1" />
      <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <VersionIcon className="h-3.5 w-3.5" strokeWidth={1.5} aria-hidden="true" />
        Atualizado em {topic.updatedIn}
      </span>
    </Link>
  );
}
