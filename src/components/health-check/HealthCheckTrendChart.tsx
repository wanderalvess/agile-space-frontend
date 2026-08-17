'use client';

import { useMemo } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import type { HealthCheckRound, HealthCheckDimension } from '@/lib/types';

interface HealthCheckTrendChartProps {
  rounds: HealthCheckRound[];
  dimensions: HealthCheckDimension[];
}

const VOTE_SCORE_MAP: Record<string, number> = {
  green: 3,
  yellow: 2,
  red: 1,
};

const CHART_COLORS = [
  'hsl(var(--chart-1))',
  'hsl(var(--chart-2))',
  'hsl(var(--chart-3))',
  'hsl(var(--chart-4))',
  'hsl(var(--chart-5))',
  'hsl(197 77% 52%)',
  'hsl(27 87% 62%)',
  'hsl(12 76% 61%)',
];

export function HealthCheckTrendChart({ rounds, dimensions }: HealthCheckTrendChartProps) {
  const trendData = useMemo(() => {
    // Reverse rounds to process from oldest to newest
    const sortedRounds = [...rounds].reverse();

    return sortedRounds.map((round, index) => {
      const roundResult: { [key: string]: string | number } = {
        name: round.title || `Rodada ${index + 1}`,
      };

      dimensions.forEach(dim => {
        const votesForDim = round.votes.filter(v => v.dimensionKey === dim.key);
        if (votesForDim.length === 0) {
          roundResult[dim.key] = 0; // or null, to create gaps
          return;
        }
        const totalScore = votesForDim.reduce((acc, vote) => {
          return acc + (VOTE_SCORE_MAP[vote.value] || 0);
        }, 0);

        const averageScore = totalScore / votesForDim.length;
        roundResult[dim.key] = parseFloat(averageScore.toFixed(2));
      });

      return roundResult;
    });
  }, [rounds, dimensions]);
  
  if (rounds.length < 2) {
    return (
        <Card>
            <CardHeader>
                <CardTitle>Tendências Históricas</CardTitle>
                <CardDescription>
                Visualize a evolução da saúde da equipe ao longo do tempo.
                </CardDescription>
            </CardHeader>
            <CardContent>
                <div className="flex items-center justify-center h-48 text-sm text-muted-foreground">
                    Você precisa de pelo menos duas rodadas concluídas para ver as tendências.
                </div>
            </CardContent>
        </Card>
    );
  }

  return (
    <Card>
       <CardHeader>
        <CardTitle>Tendências Históricas</CardTitle>
        <CardDescription>
          Visualize a evolução da saúde da equipe ao longo do tempo. A pontuação é uma média de 1 (Mal) a 3 (Bem).
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={400}>
          <LineChart
            data={trendData}
            margin={{
              top: 5,
              right: 30,
              left: 20,
              bottom: 5,
            }}
          >
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="name" />
            <YAxis domain={[1, 3]} ticks={[1, 2, 3]} tickFormatter={(value) => {
                if (value === 1) return 'Mal';
                if (value === 2) return 'Ok';
                if (value === 3) return 'Bem';
                return '';
            }} />
            <Tooltip
              contentStyle={{
                backgroundColor: 'hsl(var(--background))',
                borderColor: 'hsl(var(--border))',
              }}
            />
            <Legend />
            {dimensions.map((dim, index) => (
              <Line
                key={dim.key}
                type="monotone"
                dataKey={dim.key}
                name={dim.title}
                stroke={CHART_COLORS[index % CHART_COLORS.length]}
                strokeWidth={2}
                activeDot={{ r: 8 }}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
