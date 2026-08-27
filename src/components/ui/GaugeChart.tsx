"use client";

import React from "react";
import { PieChart, Pie, Cell, ResponsiveContainer } from "recharts";
import { WidgetCard } from "@/components/ui/WidgetCard";

interface GaugeChartProps {
  title: string;
  value: number;
  color?: string;
  description?: string;
}

export function GaugeChart({ title, value, color, description }: GaugeChartProps) {
  const safeValue = Math.min(100, Math.max(0, Math.round(value || 0)));
  const data = [
    { name: "Progresso", value: safeValue },
    { name: "Restante", value: 100 - safeValue },
  ];

  return (
    <WidgetCard title={title}>
      <div className="relative h-44 w-full flex flex-col items-center justify-center overflow-hidden">
        <ResponsiveContainer width="100%" height={220} className="absolute top-[-10px]">
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="65%"
              startAngle={180}
              endAngle={0}
              innerRadius={70}
              outerRadius={92}
              paddingAngle={0}
              dataKey="value"
              stroke="none"
              cornerRadius={6}
            >
              <Cell key="cell-0" fill={color || "hsl(var(--primary))"} />
              <Cell key="cell-1" fill="hsl(var(--muted))" />
            </Pie>
          </PieChart>
        </ResponsiveContainer>

        <div className="z-10 text-center mt-10">
          <span className="text-4xl font-extrabold tracking-tight text-foreground drop-shadow-sm font-headline">
            {safeValue}%
          </span>
        </div>
      </div>

      {description && (
        <div className="text-center text-xs font-medium text-muted-foreground mt-2 border-t border-border/40 pt-3">
          {description}
        </div>
      )}
    </WidgetCard>
  );
}
