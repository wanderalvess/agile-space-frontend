'use client';

import { useMemo, type ReactElement } from 'react';
import {
  Radar,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  ResponsiveContainer,
  Legend,
  Tooltip
} from 'recharts';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import type { HealthCheckRound, HealthCheckDimension, HealthCheckScaleType } from '@/lib/types';
import { ChartContainer, ChartTooltipContent, type ChartConfig } from '@/components/ui/chart';

interface HealthCheckRadarChartProps {
  round: HealthCheckRound;
  dimensions: HealthCheckDimension[];
  scaleType?: HealthCheckScaleType;
}

const VOTE_SCORE_MAP: Record<string, number> = {
  green: 3,
  yellow: 2,
  red: 1,
  happy: 3,
  neutral: 2,
  sad: 1,
  '1': 1,
  '2': 2,
  '3': 3,
  '4': 4,
  '5': 5,
};

const radarChartConfig = {
  score: {
    label: "Pontuação Média",
    color: "hsl(var(--primary))",
  },
} satisfies ChartConfig;


export function HealthCheckRadarChart({ round, dimensions, scaleType = 'traffic_light' }: HealthCheckRadarChartProps) {
  const radarData = useMemo(() => {
    const dimensionsMap = new Map(dimensions.map(d => [d.key, d.title]));
    const maxScore = scaleType === 'numbers_5' ? 5 : 3;

    const scoresByDimension = dimensions.map(dim => {
      const votesForDim = round.votes.filter(v => v.dimensionKey === dim.key);
      let averageScore = 0;
      if (votesForDim.length > 0) {
        const totalScore = votesForDim.reduce((acc, vote) => {
          return acc + (VOTE_SCORE_MAP[vote.value] || 0);
        }, 0);
        averageScore = totalScore / votesForDim.length;
      }
      
      return {
        subject: dimensionsMap.get(dim.key) || dim.key,
        score: parseFloat(averageScore.toFixed(2)),
        fullMark: maxScore,
      };
    });

    return scoresByDimension;
  }, [round, dimensions, scaleType]);

  if (!round || radarData.length === 0) {
    return (
        <Card>
            <CardHeader>
                <CardTitle>Gráfico de Radar</CardTitle>
                <CardDescription>
                Uma visão geral da saúde da equipe nesta rodada.
                </CardDescription>
            </CardHeader>
            <CardContent>
                <div className="flex items-center justify-center h-48 text-sm text-muted-foreground">
                    Não há dados suficientes para exibir o gráfico de radar.
                </div>
            </CardContent>
        </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Gráfico de Radar</CardTitle>
        <CardDescription>
          Uma visão geral da saúde da equipe nesta rodada, com pontuação de 1 (Mal) a 3 (Bem).
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ChartContainer config={radarChartConfig} className="mx-auto aspect-square h-[400px]">
          <RadarChart cx="50%" cy="50%" outerRadius="80%" data={radarData}>
            <PolarGrid />
            <PolarAngleAxis dataKey="subject" tick={{ fontSize: 10, fontWeight: 'bold' }} />
            <PolarRadiusAxis 
              angle={30} 
              domain={[0, scaleType === 'numbers_5' ? 5 : 3]} 
              tickCount={(scaleType === 'numbers_5' ? 5 : 3) + 1} 
              tick={(props: any) => {
                const { x, y, payload } = props;
                let label = payload.value;
                if (scaleType === 'numbers_5') {
                   if (payload.value === 1) label = 'Crítico';
                   if (payload.value === 3) label = 'Neutro';
                   if (payload.value === 5) label = 'Elite';
                } else {
                   if (payload.value === 1) label = 'Ruim';
                   if (payload.value === 2) label = 'Médio';
                   if (payload.value === 3) label = 'Bom';
                }

                // Recharts' `tick` render prop is typed to return a single
                // ReactElement, but returning null (to hide numeric ticks) is
                // supported at runtime. Cast keeps the original behavior.
                if (typeof label === 'number') return null as unknown as ReactElement;

                return (
                  <text 
                    x={x} 
                    y={y} 
                    dy={-4}
                    fill="#94a3b8" 
                    fontSize={8} 
                    fontWeight="black" 
                    textAnchor="middle"
                    className="uppercase tracking-tighter"
                  >
                    {label}
                  </text>
                );
              }}
            />
            <Tooltip
                content={<ChartTooltipContent />}
                cursor={{ fill: 'hsl(var(--muted))' }}
            />
            <Radar
              name={round.title || `Rodada`}
              dataKey="score"
              stroke="var(--color-score)"
              fill="var(--color-score)"
              fillOpacity={0.6}
            />
            <Legend />
          </RadarChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
