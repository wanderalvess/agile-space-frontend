"use client";

import React from "react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { WidgetCard } from "@/components/ui/WidgetCard";
import { formatCompactNumber } from "@/lib/utils";
import { getChartTheme } from "@/components/ui/chart-theme";

interface LineChartData {
  name: string;
  value: number;
}

interface SimpleLineChartProps {
  title: string;
  data: LineChartData[];
  defaultColor?: string;
  height?: number;
  isLight?: boolean;
  bare?: boolean;
}

export function SimpleLineChart({ title, data, defaultColor, height = 230, isLight, bare }: SimpleLineChartProps) {
  const theme = getChartTheme(isLight);
  const chart = (
    <div style={{ width: "100%", height }}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 20, right: 20, left: -20, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={theme.grid} opacity={0.6} />
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
            cursor={{ stroke: theme.tick, strokeDasharray: "3 3" }}
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
          <Line
            type="monotone"
            dataKey="value"
            stroke={defaultColor || "hsl(var(--primary))"}
            strokeWidth={2.5}
            dot={{ r: 4, fill: defaultColor || "hsl(var(--primary))" }}
            activeDot={{ r: 6 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
  return bare ? chart : <WidgetCard title={title}>{chart}</WidgetCard>;
}
