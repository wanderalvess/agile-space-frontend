import React from "react";
import { WidgetCard } from "./WidgetCard";
import { cn } from "@/lib/utils";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";

interface KPICardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  trend?: "up" | "down" | "neutral";
  trendValue?: string;
  icon?: React.ReactNode;
  className?: string;
}

export function KPICard({ title, value, subtitle, trend, trendValue, icon, className }: KPICardProps) {
  return (
    <WidgetCard title={title} className={className} headerIcon={icon}>
      <div className="flex flex-col items-center justify-center py-4 text-center">
        <div className="flex items-end gap-2">
          <span className="text-6xl font-bold tracking-tight text-white">{value}</span>
          {trend === "up" && <TrendingUp className="mb-2 h-6 w-6 text-green-500" />}
          {trend === "down" && <TrendingDown className="mb-2 h-6 w-6 text-red-500" />}
          {trend === "neutral" && <Minus className="mb-2 h-6 w-6 text-gray-500" />}
        </div>
        
        {(subtitle || trendValue) && (
          <div className="mt-4 text-sm text-gray-400">
            {trendValue && (
              <span
                className={cn(
                  "font-medium mr-2",
                  trend === "up" ? "text-green-500" : trend === "down" ? "text-red-500" : "text-gray-400"
                )}
              >
                {trendValue}
              </span>
            )}
            {subtitle}
          </div>
        )}
      </div>
    </WidgetCard>
  );
}
