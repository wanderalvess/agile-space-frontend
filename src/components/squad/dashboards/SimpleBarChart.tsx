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
import { WidgetCard } from "./WidgetCard";

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
}

export function SimpleBarChart({
  title,
  data,
  defaultColor,
  height = 230,
}: SimpleBarChartProps) {
  return (
    <WidgetCard title={title}>
      <div style={{ width: "100%", height }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 20, right: 20, left: -20, bottom: 5 }}>
            <CartesianGrid
              strokeDasharray="3 3"
              vertical={false}
              stroke="hsl(var(--border))"
              opacity={0.6}
            />
            <XAxis
              dataKey="name"
              axisLine={false}
              tickLine={false}
              tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11, fontWeight: 600 }}
              dy={8}
            />
            <YAxis
              axisLine={false}
              tickLine={false}
              tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }}
            />
            <Tooltip
              cursor={{ fill: "hsl(var(--muted))", opacity: 0.3 }}
              contentStyle={{
                backgroundColor: "hsl(var(--card))",
                borderColor: "hsl(var(--border))",
                borderRadius: "12px",
                color: "hsl(var(--card-foreground))",
                fontSize: "12px",
                boxShadow: "0 10px 25px -5px rgba(0, 0, 0, 0.2)",
              }}
              itemStyle={{ color: "hsl(var(--card-foreground))" }}
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
    </WidgetCard>
  );
}
