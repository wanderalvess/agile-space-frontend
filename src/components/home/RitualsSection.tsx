'use client';

import Link from 'next/link';
import { ArrowUpRight, CloudOff } from 'lucide-react';
import { motion } from 'framer-motion';
import { isLive, ritualFacts, toolListHref } from '@/hooks/home/derive';
import type { RitualKey, ToolSession } from '@/hooks/home/types';
import { cn } from '@/lib/utils';
import { moduleLabel } from '@/lib/modules-registry';
import { CARD, FOCUS_RING, IconTile, ORB, RetryButton, SectionHeading, TOOL_ICON } from './home-ui';
import { RitualArt } from './RitualArt';

interface RitualDef {
  key: RitualKey;
  title: string;
  description: string;
  highlight?: boolean;
}

const RITUALS: RitualDef[] = [
  { key: 'poker', title: moduleLabel('poker'), description: 'Estimativa em horas por papel, ao vivo ou assíncrona.', highlight: true },
  { key: 'retro', title: moduleLabel('retro'), description: 'Correu bem, melhorar e ações, com votação por pontos.' },
  { key: 'showcase', title: moduleLabel('showcase'), description: 'Review da sprint com evidências e modo Teatro.' },
  { key: 'health', title: moduleLabel('health'), description: 'Health check anônimo do time.' },
  { key: 'brainstorming', title: moduleLabel('brainstorming'), description: 'Mural, grupos, matriz e plano em 5 fases.' },
];

interface Props {
  history: Record<RitualKey, ToolSession[]>;
  loading: boolean;
  /** A última busca falhou: sem lista, "nenhuma sessão" seria enganoso. */
  failed?: boolean;
  /** "Tentar de novo" dos avisos de histórico indisponível (refaz a busca; `loading` fica true enquanto isso). */
  onRetry?: () => void;
  now: Date;
}

export function RitualsSection({ history, loading, failed = false, onRetry, now }: Props) {
  const anyUnavailable = failed && RITUALS.some((r) => history[r.key].length === 0);

  return (
    <section aria-labelledby="home-rituals" className="flex flex-col gap-3">
      <SectionHeading id="home-rituals">Rituais do time</SectionHeading>

      {/* Região sempre montada: o leitor de tela anuncia o aviso quando ele aparece. */}
      <div aria-live="polite">
        {anyUnavailable && (
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-xl border border-dashed border-border bg-card px-4 py-2.5">
            <CloudOff aria-hidden="true" className="h-4 w-4 shrink-0 text-muted-foreground" strokeWidth={1.5} />
            <p className="min-w-0 flex-1 text-[13px] text-muted-foreground">Histórico indisponível agora.</p>
            {onRetry && <RetryButton onRetry={onRetry} busy={loading} />}
          </div>
        )}
      </div>

      <ul className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        {RITUALS.map((r) => {
          const noData = failed && history[r.key].length === 0;
          const facts = loading ? [] : noData ? ['Histórico indisponível'] : ritualFacts(history[r.key], now);
          const liveNow = history[r.key].some(isLive);
          return (
            // O cartão leva direto à página da ferramenta, que já tem o histórico e o "Nova sessão".
            <motion.li key={r.key} whileHover="hover" className={cn(r.key === 'brainstorming' && 'sm:col-span-2 lg:col-span-1')}>
              <Link
                href={toolListHref(r.key)}
                className={cn(
                  CARD,
                  'group relative flex h-full min-h-[300px] w-full flex-col gap-2.5 overflow-hidden rounded-[24px] p-5 text-left shadow-lg transition-[border-color,box-shadow] duration-300 hover:border-primary/50 hover:shadow-2xl dark:shadow-none',
                  r.highlight && 'border-primary/40',
                  FOCUS_RING,
                )}
              >
                <span aria-hidden="true" className={cn('pointer-events-none absolute -right-12 -top-12 h-48 w-48 rounded-full motion-safe:transition-transform motion-safe:duration-700 motion-safe:group-hover:scale-125', ORB)} />
                {/* Ícone ao lado do nome: devolve ~37 px de altura por cartão e deixa o botão de entrar dentro da tela em 1080p. */}
                <span className="relative flex flex-col gap-1.5">
                  <span className="flex items-center gap-3">
                    <span className="motion-safe:transition-transform motion-safe:duration-300 motion-safe:group-hover:scale-110">
                      <IconTile icon={TOOL_ICON[r.key]} size="lg" />
                    </span>
                    <span className="flex min-w-0 flex-1 items-center gap-1.5 text-lg font-bold leading-tight transition-colors group-hover:text-primary 2xl:text-xl [.theme-totvs:not(.dark)_&]:group-hover:text-foreground">
                      {r.title}
                      {/* A setinha só aparece em tela larga: abaixo disso ela reservaria espaço e quebraria o nome em duas linhas. */}
                      <ArrowUpRight aria-hidden="true" className="hidden h-4 w-4 shrink-0 -translate-x-0.5 translate-y-0.5 text-primary opacity-0 transition-all duration-300 group-hover:translate-x-0 group-hover:translate-y-0 group-hover:opacity-100 2xl:block" strokeWidth={1.75} />
                    </span>
                  </span>
                  <span className="text-[13px] leading-relaxed text-muted-foreground">{r.description}</span>
                </span>
                <RitualArt ritual={r.key} />
                <span className="relative mt-auto flex flex-wrap gap-1.5">
                  {liveNow && (
                    <span className="inline-flex h-6 items-center rounded-full bg-emerald-500/15 px-2.5 text-xs font-semibold text-emerald-700 dark:text-emerald-400">Ao vivo</span>
                  )}
                  {facts.map((f) => (
                    <span key={f} className="inline-flex h-6 items-center rounded-full border border-border bg-muted/40 px-2.5 text-xs">
                      {f}
                    </span>
                  ))}
                </span>
                <span className="relative inline-flex h-10 w-full items-center justify-center rounded-xl bg-primary text-sm font-bold text-primary-foreground transition-opacity group-hover:opacity-90 [.theme-totvs:not(.dark)_&]:text-foreground">
                  Ver sessões de {r.title.toLowerCase()}
                </span>
              </Link>
            </motion.li>
          );
        })}
      </ul>

    </section>
  );
}
