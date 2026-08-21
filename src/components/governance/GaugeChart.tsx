"use client";

import React from "react";
import { PieChart, Pie, Cell, ResponsiveContainer } from "recharts";
import { WidgetCard } from "./WidgetCard";

interface GaugeChartProps {
  title: string;
  value: number;
  color?: string;
  description?: string;
}

export function GaugeChart({ title, value, color = "#F97316", description }: GaugeChartProps) {
  const data = [
    { name: "Value", value: value },
    { name: "Empty", value: 100 - value },
  ];

  return (
    <WidgetCard title={title}>
      <div className="relative h-48 w-full flex flex-col items-center justify-end overflow-hidden pb-4">
        <ResponsiveContainer width="100%" height={250} className="absolute top-[-20px]">
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              startAngle={180}
              endAngle={0}
              innerRadius={80}
              outerRadius={100}
              paddingAngle={0}
              dataKey="value"
              stroke="none"
              cornerRadius={5}
            >
              <Cell key="cell-0" fill={color} />
              <Cell key="cell-1" fill="#2A2E39" />
            </Pie>
          </PieChart>
        </ResponsiveContainer>
        <div className="z-10 text-center">
          <span className="text-4xl font-bold text-white">{value}%</span>
        </div>
      </div>
      {description && (
        <div className="text-center text-sm text-gray-400 mt-2">
          {description}
        </div>
      )}
    </WidgetCard>
  );
}
