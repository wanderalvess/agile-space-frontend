import { AlertTriangle, ChevronDown, Info } from 'lucide-react';
import { CARD_SHADOW, FOCUS_RING } from '@/components/room-kit/tokens';
import { cn } from '@/lib/utils';
import { headingsOf } from '../data/search';
import type { ManualBlock } from '../content/types';
import { Inline } from './Inline';
import { ManualCode } from './ManualCode';
import { ModuleApiToolSection } from './ModuleApiToolSection';

const CARD = cn('border border-border bg-card text-card-foreground', CARD_SHADOW);

type Item = Exclude<ManualBlock, { kind: 'idea' | 'h2' | 'p' | 'warn' | 'code' | 'module-api' }>;
type Node =
  | { type: 'block'; block: ManualBlock; heading?: { id: string; n: number } }
  | { type: 'list'; kind: 'li' | 'step' | 'api' | 'faq'; items: Item[] };

const LISTED = new Set<ManualBlock['kind']>(['li', 'step', 'api', 'faq']);

/** Junta blocos seguidos do mesmo tipo de lista (passos, itens, referências, perguntas) e numera as seções. */
export function groupBlocks(blocks: ManualBlock[]): Node[] {
  const headings = headingsOf(blocks);
  const nodes: Node[] = [];
  let h = 0;
  let n = 0;
  for (const block of blocks) {
    if (LISTED.has(block.kind)) {
      const last = nodes[nodes.length - 1];
      if (last?.type === 'list' && last.kind === block.kind) last.items.push(block as Item);
      else nodes.push({ type: 'list', kind: block.kind as 'li' | 'step' | 'api' | 'faq', items: [block as Item] });
      continue;
    }
    if (block.kind === 'h2' || block.kind === 'module-api') {
      const heading = headings[h];
      h += 1;
      if (block.kind === 'h2') n += 1;
      nodes.push({ type: 'block', block, heading: { id: heading.id, n } });
      continue;
    }
    nodes.push({ type: 'block', block });
  }
  return nodes;
}

function Idea({ text }: { text: string }) {
  return (
    <div role="note" className="flex gap-3.5 rounded-2xl border border-primary/30 bg-primary/10 px-5 py-4 dark:bg-primary/15">
      <Info className="mt-1 h-[22px] w-[22px] shrink-0 text-foreground" strokeWidth={1.5} aria-hidden="true" />
      <div className="flex flex-col gap-1">
        <span className="text-xs font-bold text-muted-foreground">Ideia central</span>
        <p className="text-lg leading-relaxed text-foreground">
          <Inline text={text} />
        </p>
      </div>
    </div>
  );
}

function Warn({ text }: { text: string }) {
  return (
    <div role="note" className="flex gap-3 rounded-xl border border-amber-500/35 bg-amber-500/10 px-4 py-3.5 text-base leading-relaxed text-foreground">
      <AlertTriangle className="mt-1 h-[18px] w-[18px] shrink-0 text-amber-700 dark:text-amber-300" strokeWidth={1.5} aria-hidden="true" />
      <p>
        <strong className="font-semibold">Atenção.</strong> <Inline text={text} />
      </p>
    </div>
  );
}

function ListNode({ node }: { node: Extract<Node, { type: 'list' }> }) {
  if (node.kind === 'step') {
    return (
      <ol className="m-0 flex list-none flex-col gap-3 p-0">
        {node.items.map((it, i) => {
          if (it.kind !== 'step') return null;
          return (
            <li key={it.title} className={cn('flex gap-4 rounded-2xl px-[18px] py-4', CARD)}>
              <span aria-hidden="true" className="flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-full bg-primary text-sm font-bold text-primary-foreground">
                {i + 1}
              </span>
              <div className="flex min-w-0 flex-col gap-0.5">
                <strong className="text-[17px] font-semibold text-foreground">{it.title}</strong>
                <span className="text-base leading-relaxed text-muted-foreground">
                  <Inline text={it.text} />
                </span>
              </div>
            </li>
          );
        })}
      </ol>
    );
  }
  if (node.kind === 'faq') {
    return (
      <div className="flex flex-col gap-2.5">
        {node.items.map((it) =>
          it.kind === 'faq' ? (
            <details key={it.q} className="group rounded-xl border border-border bg-card px-4">
              <summary className={cn('flex min-h-12 cursor-pointer list-none items-center justify-between gap-3 rounded-lg text-base font-semibold text-foreground [&::-webkit-details-marker]:hidden', FOCUS_RING)}>
                {it.q}
                <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground motion-safe:transition-transform group-open:rotate-180" strokeWidth={1.5} aria-hidden="true" />
              </summary>
              <p className="pb-3.5 text-base leading-relaxed text-muted-foreground">
                <Inline text={it.a} />
              </p>
            </details>
          ) : null,
        )}
      </div>
    );
  }
  if (node.kind === 'api') {
    return (
      <ul className="m-0 flex list-none flex-col gap-2 p-0">
        {node.items.map((it) =>
          it.kind === 'api' ? (
            <li key={`${it.label}-${it.path}`} className="flex flex-wrap items-start gap-x-3.5 gap-y-1 rounded-xl border border-border bg-card px-3.5 py-2.5">
              <span className="inline-flex h-6 min-w-24 items-center justify-center rounded-md border border-border bg-muted px-2 text-xs font-bold text-foreground">{it.label}</span>
              <code className="min-w-0 break-all font-code text-sm text-foreground sm:min-w-56">{it.path}</code>
              <span className="min-w-0 flex-1 basis-64 text-[15px] leading-relaxed text-muted-foreground">{it.text}</span>
            </li>
          ) : null,
        )}
      </ul>
    );
  }
  return (
    <ul className="m-0 flex list-none flex-col gap-2.5 p-0 pl-1.5">
      {node.items.map((it, i) =>
        it.kind === 'li' ? (
          <li key={i} className="flex gap-3">
            <span aria-hidden="true" className="mt-3 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
            <span>
              <Inline text={it.text} />
            </span>
          </li>
        ) : null,
      )}
    </ul>
  );
}

/** Desenha os blocos de um tópico: ideia central, seções numeradas, passos, avisos, código, referência de API e perguntas. */
export function TopicBlocks({ blocks }: { blocks: ManualBlock[] }) {
  return (
    <div className="flex flex-col gap-3.5 text-[17px] leading-[1.7] text-foreground">
      {groupBlocks(blocks).map((node, i) => {
        if (node.type === 'list') return <ListNode key={i} node={node} />;
        const b = node.block;
        switch (b.kind) {
          case 'idea':
            return <Idea key={i} text={b.text} />;
          case 'h2':
            return (
              <h2 key={i} id={node.heading?.id} className="mt-4 flex scroll-mt-24 items-center gap-3 text-[26px] font-bold leading-tight tracking-tight text-foreground">
                <span aria-hidden="true" className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-[9px] bg-primary/10 text-[15px] font-bold text-foreground dark:bg-primary/15">
                  {node.heading?.n}
                </span>
                {b.text}
              </h2>
            );
          case 'p':
            return (
              <p key={i}>
                <Inline text={b.text} />
              </p>
            );
          case 'warn':
            return <Warn key={i} text={b.text} />;
          case 'code':
            return <ManualCode key={i} code={b.code} lang={b.lang} />;
          case 'module-api':
            return <ModuleApiToolSection key={i} moduleId={b.moduleId} id={node.heading?.id} />;
          default:
            return null;
        }
      })}
    </div>
  );
}
