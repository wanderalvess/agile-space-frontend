'use client';

import { PolarAngleAxis, PolarGrid, PolarRadiusAxis, Radar, RadarChart, ResponsiveContainer, Tooltip } from 'recharts';
import { formatScore, type DimensionStat } from '@/lib/health-check-rules';
import { cn } from '@/lib/utils';

export interface RadarPrevious {
  /** Nome do radar anterior (legenda e texto para leitor de tela). */
  label: string;
  /** Nota (0 a 10) por chave de dimensão. */
  scores: ReadonlyMap<string, number>;
}

interface HealthCheckRadarChartProps {
  stats: readonly DimensionStat[];
  /** Radar anterior, sobreposto tracejado. */
  previous?: RadarPrevious;
  /** Nome do radar atual para a legenda. */
  currentLabel?: string;
  height?: number;
  className?: string;
}

const MAX_LABEL = 22;

/** Rótulo do eixo: curto para caber ao redor do gráfico (o nome inteiro está no tooltip e na lista para leitor de tela). */
function shortLabel(title: string): string {
  return title.length > MAX_LABEL ? `${title.slice(0, MAX_LABEL - 1).trimEnd()}…` : title;
}

/**
 * Gráfico radar do resultado: uma ponta por dimensão, régua de 0 a 10 igual nas três escalas e texto de 12 px.
 * Com `previous`, sobrepõe o radar anterior da squad. Sem respostas numa dimensão, a ponta fica em 0.
 */
export function HealthCheckRadarChart({ stats, previous, currentLabel = 'Este radar', height = 380, className }: HealthCheckRadarChartProps) {
  if (stats.length < 3) {
    return (
      <p className="m-0 rounded-xl border border-dashed border-border px-5 py-9 text-center text-sm text-muted-foreground">
        O gráfico radar precisa de 3 ou mais dimensões. Veja as notas na aba Frequência de respostas.
      </p>
    );
  }
  const data = stats.map((s) => ({
    subject: shortLabel(s.title),
    full: s.title,
    score: s.score === null ? 0 : Number(s.score.toFixed(1)),
    previous: previous?.scores.get(s.key),
  }));
  return (
    <div className={cn('flex flex-col gap-3', className)}>
      <div
        role="img"
        aria-label={`Gráfico radar da nota de clima por dimensão, de 0 a 10: ${stats.map((s) => `${s.title} ${formatScore(s.score)}`).join(', ')}`}
        className="mx-auto w-full max-w-[560px] [--health-accent:hsl(var(--primary))] [.theme-totvs:not(.dark)_&]:[--health-accent:hsl(var(--foreground))]"
        style={{ height }}
      >
        <ResponsiveContainer width="100%" height="100%">
          <RadarChart data={data} cx="50%" cy="50%" outerRadius="64%">
            <PolarGrid stroke="hsl(var(--border))" />
            <PolarAngleAxis dataKey="subject" tick={{ fontSize: 12, fill: 'hsl(var(--foreground))' }} />
            <PolarRadiusAxis angle={90 - 180 / stats.length} domain={[0, 10]} tickCount={3} tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} />
            {previous && (
              <Radar name={previous.label} dataKey="previous" stroke="hsl(var(--muted-foreground))" strokeWidth={2} strokeDasharray="5 4" fill="hsl(var(--muted-foreground))" fillOpacity={0.12} isAnimationActive={false} />
            )}
            <Radar name={currentLabel} dataKey="score" stroke="var(--health-accent)" strokeWidth={2} fill="var(--health-accent)" fillOpacity={0.25} dot={{ r: 3, fill: 'var(--health-accent)' }} isAnimationActive={false} />
            <Tooltip
              content={({ active, payload }) => {
                if (!active || !payload?.length) return null;
                const row = payload[0].payload as { full: string; score: number; previous?: number };
                return (
                  <div className="rounded-lg border border-border bg-popover px-3 py-2 text-xs text-popover-foreground shadow-md">
                    <p className="m-0 font-bold">{row.full}</p>
                    <p className="m-0 tabular-nums">{currentLabel}: {formatScore(row.score)}</p>
                    {previous && row.previous !== undefined && <p className="m-0 tabular-nums text-muted-foreground">{previous.label}: {formatScore(row.previous)}</p>}
                  </div>
                );
              }}
            />
          </RadarChart>
        </ResponsiveContainer>
      </div>
      {previous && (
        <p className="m-0 flex flex-wrap items-center justify-center gap-x-5 gap-y-1 text-xs text-muted-foreground" aria-hidden="true">
          <span className="inline-flex items-center gap-1.5"><span className="h-0.5 w-5 bg-primary [.theme-totvs:not(.dark)_&]:bg-foreground" /> {currentLabel}</span>
          <span className="inline-flex items-center gap-1.5"><span className="h-0 w-5 border-t-2 border-dashed border-muted-foreground" /> {previous.label}</span>
        </p>
      )}
      <ul className="sr-only">
        {stats.map((s) => <li key={s.key}>{s.title}: {formatScore(s.score)} de 10</li>)}
      </ul>
    </div>
  );
}
