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
        "flex flex-col rounded-2xl border border-border bg-card text-card-foreground p-5 shadow-sm transition-all",
        className
      )}
    >
      {title && (
        <div className="mb-4 flex items-center justify-between border-b border-border pb-3">
          <h3 className="text-sm font-bold text-foreground">
            {title}
          </h3>
          {headerIcon && <div className="text-primary">{headerIcon}</div>}
        </div>
      )}
      <div className="flex-1">{children}</div>
    </div>
  );
}
