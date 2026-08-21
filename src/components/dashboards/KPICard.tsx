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
        <div className="flex items-center justify-center gap-3">
          <span className="text-5xl font-extrabold tracking-tight text-white">{value}</span>
          {trend === "up" && <TrendingUp className="h-6 w-6 text-emerald-400" />}
          {trend === "down" && <TrendingDown className="h-6 w-6 text-rose-400" />}
          {trend === "neutral" && <Minus className="h-6 w-6 text-slate-400" />}
        </div>
        
        {(subtitle || trendValue) && (
          <div className="mt-4 text-xs font-medium text-slate-400 max-w-[260px] leading-relaxed">
            {trendValue && (
              <span
                className={cn(
                  "font-bold mr-1.5",
                  trend === "up" ? "text-emerald-400" : trend === "down" ? "text-rose-400" : "text-slate-400"
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
