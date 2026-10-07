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
  // Fundo/apresentação sabe se o próprio tema visual em volta é claro ou
  // escuro (TeatroMode.isLight) — independente do tema claro/escuro do app
  // (ThemeContext). Sem isso o gráfico segue só a classe `dark` global, que
  // pode divergir do fundo de apresentação escolhido e sair ilegível (texto
  // escuro sobre slide escura, ou vice-versa). Ausente = comportamento
  // antigo (segue o tema do app via CSS var).
  isLight?: boolean;
  // Pula o cartão (borda/fundo/sombra) do WidgetCard — usado quando o
  // gráfico já mora dentro de um cartão da apresentação (Teatro), pra não
  // duplicar moldura dentro de moldura.
  bare?: boolean;
}

/** Escolhe o componente de gráfico certo pro chartType do card de métricas —
 * ponto único usado pelo editor (TaskCard), pela apresentação (TeatroMode) e
 * pelos slides de impressão que reaproveitam recharts (não os que desenham
 * SVG puro por causa do ResizeObserver, ver PrintSlidesView). Sem chartType
 * definido (cards antigos) cai em barra, comportamento anterior inalterado.
 */
export function ChartRenderer({ type, title, data, height, defaultColor, isLight, bare }: ChartRendererProps) {
  if (type === 'pie') return <SimplePieChart title={title} data={data} height={height} isLight={isLight} bare={bare} />;
  if (type === 'line') return <SimpleLineChart title={title} data={data} height={height} defaultColor={defaultColor} isLight={isLight} bare={bare} />;
  return <SimpleBarChart title={title} data={data} height={height} defaultColor={defaultColor} isLight={isLight} bare={bare} />;
}
