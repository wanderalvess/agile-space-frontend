'use client';

import type { ReactNode } from 'react';
import { AlertTriangle, Check, HeartPulse, Info, ListChecks, Quote, Target } from 'lucide-react';
import { CARD_SHADOW, IconTile, ModalButton, StatusChip } from '@/components/room-kit';
import {
  BAND_LABELS,
  LEVEL_LABELS,
  focusSentence,
  formatScore,
  groupLabels,
  headline,
  toneGroups,
  worstVotesText,
  type DimensionStat,
  type HealthSummary,
} from '@/lib/health-check-rules';
import { respondentsText } from '@/lib/health-check-export';
import type { HealthCheckScaleType, HealthCheckVote } from '@/lib/types';
import { cn } from '@/lib/utils';
import { TONE_SEGMENT, TONE_TEXT, ValueGlyph, levelText, levelTone } from './health-ui';
import { scaleOptions } from '@/lib/health-check-rules';

const CARD = `rounded-2xl border border-border bg-card p-5 text-card-foreground sm:p-6 ${CARD_SHADOW}`;

function bandTone(band: HealthSummary['band']) {
  return band === 'strong' ? ('success' as const) : band === 'on_track' ? ('warn' as const) : ('danger' as const);
}

/** Nota de clima em destaque: placa com o número, faixa em texto, frase do resultado e os totais. */
export function ScoreHero({ summary, dimensionCount, large = false }: { summary: HealthSummary; dimensionCount: number; large?: boolean }) {
  const { climate, band } = summary;
  return (
    <section aria-label="Nota de clima" className={cn(CARD, 'flex flex-col items-center gap-6 sm:flex-row sm:items-center')}>
      <div role="img" aria-label={climate === null ? 'Sem nota de clima' : `Nota de clima ${formatScore(climate)} de 10`} className={cn('flex shrink-0 flex-col items-center justify-center rounded-3xl border border-border bg-muted/40', large ? 'h-44 w-44' : 'h-36 w-36')}>
        <HeartPulse className="mb-1 h-6 w-6 text-muted-foreground" strokeWidth={1.5} aria-hidden="true" />
        <span className={cn('font-bold leading-none tabular-nums', large ? 'text-6xl' : 'text-5xl')}>{formatScore(climate)}</span>
        <span className="mt-1.5 text-xs text-muted-foreground">Nota de clima, 0 a 10</span>
      </div>
      <div className="flex min-w-0 flex-col items-center gap-3 text-center sm:items-start sm:text-left">
        {band && <StatusChip tone={bandTone(band)}>{BAND_LABELS[band]}</StatusChip>}
        <h2 className={cn('m-0 font-bold leading-tight', large ? 'text-3xl' : 'text-2xl')}>{headline(summary)}</h2>
        <p className="m-0 text-sm text-muted-foreground">
          {respondentsText(summary.respondents)}, {summary.totalVotes} {summary.totalVotes === 1 ? 'voto' : 'votos'} no total.
        </p>
        <dl className="m-0 flex flex-wrap gap-x-8 gap-y-2 text-sm">
          <div className="flex flex-col"><dt className="text-xs text-muted-foreground">Dimensões</dt><dd className="m-0 text-lg font-bold tabular-nums">{dimensionCount}</dd></div>
          <div className="flex flex-col"><dt className="text-xs text-muted-foreground">Votos</dt><dd className="m-0 text-lg font-bold tabular-nums">{summary.totalVotes}</dd></div>
          <div className="flex flex-col"><dt className="text-xs text-muted-foreground">Em atenção</dt><dd className="m-0 text-lg font-bold tabular-nums">{summary.attention.length}</dd></div>
        </dl>
      </div>
    </section>
  );
}

export interface AboutRow {
  label: string;
  value: ReactNode;
}

/** "Sobre este radar": os dados reais do próprio radar (nada fixo). */
export function AboutCard({ rows }: { rows: AboutRow[] }) {
  return (
    <section aria-label="Sobre este radar" className={cn(CARD, 'flex flex-col gap-3')}>
      <div className="flex items-center gap-3">
        <IconTile icon={Info} size="md" />
        <h2 className="m-0 text-base font-bold">Sobre este radar</h2>
      </div>
      <dl className="m-0 flex flex-col">
        {rows.map((r) => (
          <div key={r.label} className="flex items-baseline justify-between gap-3 border-b border-border py-2 text-sm last:border-b-0">
            <dt className="text-muted-foreground">{r.label}</dt>
            <dd className="m-0 text-right font-semibold">{r.value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

/** Frequência por dimensão: barra empilhada com a contagem em cada trecho e a nota à direita. */
export function FrequencyChart({ stats, scale, large = false }: { stats: readonly DimensionStat[]; scale: HealthCheckScaleType | undefined; large?: boolean }) {
  const labels = groupLabels(scale);
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5 text-xs text-muted-foreground">
        {(['good', 'mid', 'bad'] as const).map((tone) => (
          <span key={tone} className="inline-flex items-center gap-1.5"><span aria-hidden="true" className={cn('h-2.5 w-2.5 rounded-sm', TONE_SEGMENT[tone].split(' ')[0])} />{labels[tone]}</span>
        ))}
        <span className="ml-auto">Nota de 0 a 10</span>
      </div>
      <ul className="m-0 flex list-none flex-col gap-2.5 p-0">
        {stats.map((s) => {
          const groups = toneGroups(s, scale);
          return (
            <li key={s.key} className={cn('grid grid-cols-[minmax(0,8.5rem)_minmax(0,1fr)_3rem] items-center gap-3 sm:grid-cols-[minmax(0,12rem)_minmax(0,1fr)_3rem]', large && 'sm:grid-cols-[minmax(0,16rem)_minmax(0,1fr)_3.5rem]')}>
              <span className={cn('truncate font-semibold', large ? 'text-base' : 'text-sm')} title={s.title}>{s.title}</span>
              {s.total === 0 ? (
                <span className="h-7 rounded-md bg-muted px-3 text-xs leading-7 text-muted-foreground">Sem respostas</span>
              ) : (
                <div
                  role="img"
                  aria-label={`${s.title}: ${groups.map((g) => `${g.label} ${g.count}`).join(', ')}`}
                  className={cn('flex overflow-hidden rounded-md bg-muted', large ? 'h-9' : 'h-7')}
                >
                  {groups.filter((g) => g.count > 0).map((g) => (
                    <span key={g.tone} style={{ flexGrow: g.count, flexBasis: 0 }} className={cn('flex min-w-0 items-center justify-center text-xs font-bold tabular-nums', TONE_SEGMENT[g.tone])}>
                      {g.count}
                    </span>
                  ))}
                </div>
              )}
              <span className={cn('text-right font-bold tabular-nums', large ? 'text-lg' : 'text-sm', levelText(s.level))}>{formatScore(s.score)}</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/** Pontos fortes (nota de 7,5 ou mais). */
export function StrongCard({ stats }: { stats: readonly DimensionStat[] }) {
  return (
    <section aria-label="Pontos fortes" className={cn(CARD, 'flex flex-col gap-3 border-l-4 border-l-emerald-600 dark:border-l-emerald-400')}>
      <h2 className="m-0 flex items-center gap-2 text-base font-bold">
        <Check className={cn('h-4 w-4', TONE_TEXT.good)} strokeWidth={2} aria-hidden="true" /> Pontos fortes
        <StatusChip tone="success">{stats.length}</StatusChip>
      </h2>
      {stats.length > 0 ? (
        <ul className="m-0 flex list-none flex-wrap gap-2 p-0">
          {stats.map((s) => <li key={s.key}><StatusChip tone="success" className="h-7 px-3 text-[13px]">{s.title}</StatusChip></li>)}
        </ul>
      ) : (
        <p className="m-0 text-sm text-muted-foreground">Nenhum ponto forte destacado.</p>
      )}
      <p className="m-0 text-xs text-muted-foreground">Nota de 7,5 ou mais.</p>
    </section>
  );
}

/** Em atenção: críticas primeiro, depois alertas, com o que sustenta cada uma. */
export function AttentionCard({ stats }: { stats: readonly DimensionStat[] }) {
  return (
    <section aria-label="Em atenção" className={cn(CARD, 'flex flex-col gap-3 border-l-4 border-l-red-600 dark:border-l-red-400')}>
      <h2 className="m-0 flex items-center gap-2 text-base font-bold">
        <AlertTriangle className={cn('h-4 w-4', TONE_TEXT.bad)} strokeWidth={1.5} aria-hidden="true" /> Em atenção
        <StatusChip tone={stats.length ? 'danger' : 'neutral'}>{stats.length}</StatusChip>
      </h2>
      {stats.length > 0 ? (
        <ul className="m-0 flex list-none flex-col gap-2 p-0">
          {stats.map((s) => (
            <li key={s.key} className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <StatusChip tone={levelTone(s.level)}>{LEVEL_LABELS[s.level]}</StatusChip>
              <span className="min-w-0 flex-1 text-sm font-semibold">{s.title}</span>
              <span className="text-[13px] text-muted-foreground">{worstVotesText(s)}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="m-0 text-sm text-muted-foreground">Nenhuma dimensão em atenção. O time está bem em todas as áreas.</p>
      )}
      <p className="m-0 text-xs text-muted-foreground">Crítico: nota abaixo de 4 ou 30% dos votos na pior resposta. Alerta: nota abaixo de 6.</p>
    </section>
  );
}

/** Sugestão de foco: cita a dimensão real e leva ao plano de ação. */
export function FocusCard({ focus, planCreated, onPlan }: { focus: DimensionStat | null; planCreated: boolean; onPlan: () => void }) {
  return (
    <section aria-label="Sugestão de foco" className={cn(CARD, 'flex flex-col gap-3 border-l-4 border-l-primary')}>
      <h2 className="m-0 flex items-center gap-2 text-base font-bold">
        <Target className="h-4 w-4 text-primary [.theme-totvs:not(.dark)_&]:text-foreground" strokeWidth={1.5} aria-hidden="true" /> Sugestão de foco
      </h2>
      <p className="m-0 text-sm leading-relaxed">
        {focus ? (
          <>Para a próxima sprint, escolha uma ação simples para <strong>{focus.title}</strong> e combine um prazo com a squad.</>
        ) : (
          focusSentence(null)
        )}
      </p>
      <ModalButton variant="primary" className="w-full gap-2" onClick={onPlan}>
        {planCreated ? <Check className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" /> : <ListChecks className="h-4 w-4" strokeWidth={1.5} aria-hidden="true" />}
        {planCreated ? 'Plano criado' : 'Criar plano de ação'}
      </ModalButton>
    </section>
  );
}

/** Detalhamento de uma dimensão: nota, contagem por valor e comentários anônimos. */
export function DimensionDetail({ stat, index, scale, votes }: { stat: DimensionStat; index: number; scale: HealthCheckScaleType | undefined; votes: readonly HealthCheckVote[] }) {
  const comments = votes.filter((v) => v.dimensionKey === stat.key && !!v.comment && v.comment.trim() !== '');
  const options = scaleOptions(scale);
  return (
    <article aria-label={`Detalhe de ${stat.title}`} className={cn(CARD, 'flex flex-col gap-4')}>
      <header className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 flex-col">
          <span className="text-xs text-muted-foreground">Dimensão {index + 1}</span>
          <h3 className="m-0 text-base font-bold leading-tight">{stat.title}</h3>
          {stat.description && <p className="m-0 mt-1 text-[13px] text-muted-foreground">{stat.description}</p>}
        </div>
        <StatusChip tone={levelTone(stat.level)} className="shrink-0">Nota {formatScore(stat.score)}</StatusChip>
      </header>
      <dl className={cn('m-0 grid gap-2', options.length === 5 ? 'grid-cols-5' : 'grid-cols-3')}>
        {stat.counts.map((c) => (
          <div key={c.option.value} className="flex flex-col items-center gap-0.5 rounded-xl border border-border bg-muted/40 px-1.5 py-2.5 text-center">
            <dd className={cn('m-0 text-xl font-bold leading-none tabular-nums', TONE_TEXT[c.option.tone])}>{c.count}</dd>
            <dt className="inline-flex items-center gap-1 text-xs text-muted-foreground">
              <ValueGlyph option={c.option} scale={scale} className={scale === 'emojis' ? 'h-3.5 w-3.5' : 'h-2 w-2'} />
              {scale === 'numbers_5' ? `Nota ${c.option.label}` : c.option.label}
            </dt>
          </div>
        ))}
      </dl>
      <section aria-label={`Comentários anônimos de ${stat.title}`} className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <h4 className="m-0 text-[13px] font-bold">Comentários anônimos</h4>
          <StatusChip tone="neutral">{comments.length}</StatusChip>
        </div>
        {comments.length > 0 ? (
          <ul className="m-0 flex list-none flex-col gap-2 p-0">
            {comments.map((c, i) => (
              <li key={c.id || i} className="relative rounded-xl border border-border bg-muted/40 px-3.5 py-2.5 pl-9 text-[13px] leading-relaxed">
                <Quote className="absolute left-3 top-3 h-3.5 w-3.5 text-muted-foreground" strokeWidth={1.5} aria-hidden="true" />
                {c.comment}
              </li>
            ))}
          </ul>
        ) : (
          <p className="m-0 py-2 text-center text-[13px] text-muted-foreground">Nenhum comentário para esta dimensão.</p>
        )}
      </section>
    </article>
  );
}
