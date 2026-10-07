import React from "react";
import { cn } from "@/lib/utils";

interface WidgetCardProps {
  title?: string;
  children: React.ReactNode;
  className?: string;
  headerIcon?: React.ReactNode;
}

export function WidgetCard({ title, children, className, headerIcon }: WidgetCardProps) {
  return (
    <div
      className={cn(
        "flex flex-col rounded-3xl border border-slate-200/60 dark:border-slate-800/60 bg-white/80 dark:bg-slate-900/80 text-slate-900 dark:text-slate-100 p-5 shadow-sm transition-all",
        className
      )}
    >
      {title && (
        <div className="mb-4 flex items-center justify-between border-b border-slate-100 dark:border-slate-800/60 pb-3">
          <h3 className="text-sm font-bold text-slate-700 dark:text-slate-200">
            {title}
          </h3>
          {headerIcon && <div className="text-primary">{headerIcon}</div>}
        </div>
      )}
      <div className="flex-1">{children}</div>
    </div>
  );
}
