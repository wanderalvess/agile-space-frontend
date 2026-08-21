"use client";

import React from "react";
import { PieChart, Pie, Cell, ResponsiveContainer } from "recharts";
import { WidgetCard } from "./WidgetCard";

interface GaugeChartProps {
  title: string;
  value: number; // Porcentagem (0-100)
  color?: string;
  description?: string;
}

export function GaugeChart({ title, value, color = "#F97316", description }: GaugeChartProps) {
  const data = [
    { name: "Progresso", value: value },
    { name: "Restante", value: Math.max(0, 100 - value) },
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
              <Cell key="cell-0" fill={color} />
              <Cell key="cell-1" fill="#242B3B" />
            </Pie>
          </PieChart>
        </ResponsiveContainer>
        
        {/* Texto central em destaque com contraste total */}
        <div className="z-10 text-center mt-10">
          <span className="text-4xl font-extrabold tracking-tight text-white drop-shadow-md">
            {value}%
          </span>
        </div>
      </div>

      {description && (
        <div className="text-center text-xs font-medium text-slate-400 mt-2 border-t border-slate-800/40 pt-3">
          {description}
        </div>
      )}
    </WidgetCard>
  );
}
