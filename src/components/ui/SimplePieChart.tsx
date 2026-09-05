"use client";

import React from "react";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { WidgetCard } from "@/components/ui/WidgetCard";

interface PieChartData {
  name: string;
  value: number;
  color?: string;
}

interface SimplePieChartProps {
  title: string;
  data: PieChartData[];
  height?: number;
  colors?: string[];
}

const DEFAULT_COLORS = [
  "hsl(262, 83%, 65%)",
  "hsl(199, 89%, 60%)",
  "hsl(158, 64%, 52%)",
  "hsl(38, 92%, 60%)",
  "hsl(340, 82%, 65%)",
  "hsl(221, 83%, 65%)",
];

export function SimplePieChart({ title, data, height = 230, colors = DEFAULT_COLORS }: SimplePieChartProps) {
  return (
    <WidgetCard title={title}>
      <div style={{ width: "100%", height }}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              dataKey="value"
              nameKey="name"
              innerRadius="45%"
              outerRadius="85%"
              paddingAngle={2}
              label={(props: any) => {
                const { cx, cy, midAngle, innerRadius, outerRadius, percent } = props;
                const RADIAN = Math.PI / 180;
                const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
                const x = cx + radius * Math.cos(-midAngle * RADIAN);
                const y = cy + radius * Math.sin(-midAngle * RADIAN);
                if (!percent) return null;
                return (
                  <text x={x} y={y} textAnchor="middle" dominantBaseline="central" fontSize={11} fontWeight={700} fill="#ffffff">
                    {Math.round(percent * 100)}%
                  </text>
                );
              }}
              labelLine={false}
            >
              {data.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color || colors[index % colors.length]} />
              ))}
            </Pie>
            <Tooltip
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
            <Legend wrapperStyle={{ fontSize: 11, fontWeight: 600 }} />
          </PieChart>
        </ResponsiveContainer>
      </div>
    </WidgetCard>
  );
}
