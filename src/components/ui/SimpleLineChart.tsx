"use client";

import React from "react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { WidgetCard } from "@/components/ui/WidgetCard";
import { formatCompactNumber } from "@/lib/utils";

interface LineChartData {
  name: string;
  value: number;
}

interface SimpleLineChartProps {
  title: string;
  data: LineChartData[];
  defaultColor?: string;
  height?: number;
}

export function SimpleLineChart({ title, data, defaultColor, height = 230 }: SimpleLineChartProps) {
  return (
    <WidgetCard title={title}>
      <div style={{ width: "100%", height }}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 20, right: 20, left: -20, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" opacity={0.6} />
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
              tickFormatter={formatCompactNumber}
            />
            <Tooltip
              cursor={{ stroke: "hsl(var(--muted-foreground))", strokeDasharray: "3 3" }}
              formatter={(value: number) => value.toLocaleString('pt-BR')}
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
    </WidgetCard>
  );
}
