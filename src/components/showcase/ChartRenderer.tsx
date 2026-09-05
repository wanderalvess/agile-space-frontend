'use client';

import React from 'react';
import { SimpleBarChart } from '@/components/ui/SimpleBarChart';
import { SimplePieChart } from '@/components/ui/SimplePieChart';
import { SimpleLineChart } from '@/components/ui/SimpleLineChart';
import type { ChartType } from './types';

interface ChartRendererProps {
  type: ChartType | undefined;
  title: string;
  data: { name: string; value: number; color?: string }[];
  height?: number;
  defaultColor?: string;
}

/** Escolhe o componente de gráfico certo pro chartType do card de métricas —
 * ponto único usado pelo editor (TaskCard), pela apresentação (TeatroMode) e
 * pelos slides de impressão que reaproveitam recharts (não os que desenham
 * SVG puro por causa do ResizeObserver, ver PrintSlidesView). Sem chartType
 * definido (cards antigos) cai em barra, comportamento anterior inalterado.
 */
export function ChartRenderer({ type, title, data, height, defaultColor }: ChartRendererProps) {
  if (type === 'pie') return <SimplePieChart title={title} data={data} height={height} />;
  if (type === 'line') return <SimpleLineChart title={title} data={data} height={height} defaultColor={defaultColor} />;
  return <SimpleBarChart title={title} data={data} height={height} defaultColor={defaultColor} />;
}
