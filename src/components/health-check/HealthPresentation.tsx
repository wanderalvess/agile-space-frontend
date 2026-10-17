'use client';

import { Check, ListChecks, Quote } from 'lucide-react';
import { ModalButton, StatusChip } from '@/components/room-kit';
import {
  BAND_LABELS,
  LEVEL_LABELS,
  formatScore,
  worstVotesText,
  type HealthSummary,
} from '@/lib/health-check-rules';
import type { HealthCheckScaleType, HealthCheckVote } from '@/lib/types';
import { cn } from '@/lib/utils';
import { HealthCheckRadarChart } from './HealthCheckRadarChart';
import { FrequencyChart, ScoreHero } from './HealthResultParts';
import { levelTone } from './health-ui';

export type PresentationStage = 'score' | 'radar' | 'freq' | 'comments' | 'plan';

export const PRESENTATION_STAGES: readonly { id: PresentationStage; label: string }[] = [
  { id: 'score', label: 'Nota' },
  { id: 'radar', label: 'Radar' },
  { id: 'freq', label: 'Frequência' },
  { id: 'comments', label: 'Comentários' },
  { id: 'plan', label: 'Plano' },
];

/** "Processos pede atenção: 3 de 10 votos ruins. O restante está em 5,5 ou mais." */
export function focusLine(summary: Pick<HealthSummary, 'focus' | 'stats'>): string {
  const { focus, stats } = summary;
  if (!focus) return 'Nenhuma dimensão pede atenção neste radar.';
  const others = stats.filter((s) => s.key !== focus.key && s.score !== null).map((s) => s.score as number);
  const rest = others.length ? ` O restante está em ${formatScore(Math.min(...others))} ou mais.` : '';
  return `${focus.title} pede atenção: ${worstVotesText(focus)}.${rest}`;
}

export interface HealthPresentationProps {
  stage: PresentationStage;
  summary: HealthSummary;
  scale: HealthCheckScaleType | undefined;
  votes: readonly HealthCheckVote[];
  dimensionCount: number;
  planCreated: boolean;
  onPlan: () => void;
}

/** Conteúdo de cada etapa do modo apresentação: grande, sem rolagem aninhada, para ler de longe. */
export function HealthPresentation({ stage, summary, scale, votes, dimensionCount, planCreated, onPlan }: HealthPresentationProps) {
  if (stage === 'score') {
    return (
      <div className="mx-auto flex min-h-full w-full max-w-5xl flex-col justify-center px-4 py-10 md:px-8">
        <ScoreHero summary={summary} dimensionCount={dimensionCount} large />
      </div>
    );
  }

  if (stage === 'radar') {
    return (
      <div className="mx-auto grid min-h-full w-full max-w-6xl grid-cols-1 items-center gap-8 px-4 py-10 md:px-8 lg:grid-cols-2">
        <div className="flex flex-col gap-4">
          {summary.band && <StatusChip tone={summary.band === 'strong' ? 'success' : summary.band === 'on_track' ? 'warn' : 'danger'} className="w-fit">{BAND_LABELS[summary.band]}</StatusChip>}
          <p className="m-0 flex items-baseline gap-3">
            <span className="text-7xl font-bold leading-none tabular-nums">{formatScore(summary.climate)}</span>
            <span className="text-xl text-muted-foreground">de 10</span>
          </p>
          <p className="m-0 text-2xl leading-snug">{focusLine(summary)}</p>
        </div>
        <HealthCheckRadarChart stats={summary.stats} height={460} />
      </div>
    );
  }

  if (stage === 'freq') {
    return (
      <div className="mx-auto flex min-h-full w-full max-w-5xl flex-col justify-center px-4 py-10 md:px-8">
        <FrequencyChart stats={summary.stats} scale={scale} large />
      </div>
    );
  }

  if (stage === 'comments') {
    const blocks = summary.stats
      .map((s) => ({ stat: s, comments: votes.filter((v) => v.dimensionKey === s.key && !!v.comment && v.comment.trim() !== '').map((v) => (v.comment as string).trim()) }))
      .filter((b) => b.comments.length > 0);
    return (
      <div className="mx-auto w-full max-w-6xl px-4 py-10 md:px-8">
        {blocks.length === 0 ? (
          <p className="m-0 py-20 text-center text-xl text-muted-foreground">Nenhum comentário neste radar.</p>
        ) : (
          <ul className="m-0 grid list-none grid-cols-1 gap-4 p-0 lg:grid-cols-2">
            {blocks.map(({ stat, comments }) => (
              <li key={stat.key} className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-5">
                <h3 className="m-0 flex items-center gap-2 text-lg font-bold">{stat.title}<StatusChip tone={levelTone(stat.level)}>Nota {formatScore(stat.score)}</StatusChip></h3>
                <ul className="m-0 flex list-none flex-col gap-2 p-0">
                  {comments.map((c, i) => (
                    <li key={i} className="relative rounded-xl bg-muted/50 px-4 py-3 pl-10 text-base leading-relaxed">
                      <Quote className="absolute left-3.5 top-3.5 h-4 w-4 text-muted-foreground" strokeWidth={1.5} aria-hidden="true" />
                      {c}
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
        )}
      </div>
    );
  }

  return (
    <div className="mx-auto flex min-h-full w-full max-w-4xl flex-col justify-center gap-6 px-4 py-10 md:px-8">
      <h2 className="m-0 text-3xl font-bold">O que vira ação</h2>
      {summary.attention.length === 0 ? (
        <p className="m-0 text-xl text-muted-foreground">Nenhuma dimensão em atenção. Mantenha o que está funcionando e compare com o próximo radar.</p>
      ) : (
        <ul className="m-0 flex list-none flex-col gap-3 p-0">
          {summary.attention.map((s) => (
            <li key={s.key} className={cn('flex flex-wrap items-center gap-x-4 gap-y-1 rounded-2xl border border-border bg-card px-5 py-4')}>
              <StatusChip tone={levelTone(s.level)} className="h-7 px-3 text-sm">{LEVEL_LABELS[s.level]}</StatusChip>
              <span className="min-w-0 flex-1 text-xl font-bold">{s.title}</span>
              <span className="text-base text-muted-foreground">{worstVotesText(s)} · nota {formatScore(s.score)}</span>
            </li>
          ))}
        </ul>
      )}
      <div>
        <ModalButton variant="primary" className="h-12 gap-2 px-6 text-base" onClick={onPlan}>
          {planCreated ? <Check className="h-5 w-5" strokeWidth={1.75} aria-hidden="true" /> : <ListChecks className="h-5 w-5" strokeWidth={1.5} aria-hidden="true" />}
          {planCreated ? 'Plano criado' : 'Criar plano de ação'}
        </ModalButton>
      </div>
    </div>
  );
}
