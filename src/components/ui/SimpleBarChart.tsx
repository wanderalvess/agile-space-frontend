"use client";

import React from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";
import { WidgetCard } from "@/components/ui/WidgetCard";
import { formatCompactNumber } from "@/lib/utils";
import { getChartTheme } from "@/components/ui/chart-theme";

interface BarChartData {
  name: string;
  value: number;
  color?: string;
}

interface SimpleBarChartProps {
  title: string;
  data: BarChartData[];
  defaultColor?: string;
  height?: number;
  isLight?: boolean;
  bare?: boolean;
}

export function SimpleBarChart({
  title,
  data,
  defaultColor,
  height = 230,
  isLight,
  bare,
}: SimpleBarChartProps) {
  const theme = getChartTheme(isLight);
  const chart = (
    <div style={{ width: "100%", height }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 20, right: 20, left: -20, bottom: 5 }}>
          <CartesianGrid
            strokeDasharray="3 3"
            vertical={false}
            stroke={theme.grid}
            opacity={0.6}
          />
          <XAxis
            dataKey="name"
            axisLine={false}
            tickLine={false}
            tick={{ fill: theme.tick, fontSize: 11, fontWeight: 600 }}
            dy={8}
          />
          <YAxis
            axisLine={false}
            tickLine={false}
            tick={{ fill: theme.tick, fontSize: 11 }}
            tickFormatter={formatCompactNumber}
          />
          <Tooltip
            cursor={{ fill: theme.cursor, opacity: isLight === undefined ? 0.3 : 1 }}
            formatter={(value: number) => value.toLocaleString('pt-BR')}
            contentStyle={{
              backgroundColor: theme.tooltipBg,
              borderColor: theme.tooltipBorder,
              borderRadius: "12px",
              color: theme.tooltipText,
              fontSize: "12px",
              boxShadow: "0 10px 25px -5px rgba(0, 0, 0, 0.2)",
            }}
            itemStyle={{ color: theme.tooltipText }}
          />
          <Bar dataKey="value" radius={[6, 6, 0, 0]} maxBarSize={55}>
            {data.map((entry, index) => (
              <Cell
                key={`cell-${index}`}
                fill={entry.color || defaultColor || "hsl(var(--primary))"}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
  return bare ? chart : <WidgetCard title={title}>{chart}</WidgetCard>;
}
