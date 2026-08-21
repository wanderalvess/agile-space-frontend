import React from "react";
import { cn } from "@/lib/utils";
import { AgileBaseCard } from "@/components/shared/EliteBaseCard";

interface WidgetCardProps {
  title?: string;
  children: React.ReactNode;
  className?: string;
  headerIcon?: React.ReactNode;
}

export function WidgetCard({ title, children, className, headerIcon }: WidgetCardProps) {
  return (
    <AgileBaseCard
      theme="slate"
      disableAnimation={true}
      className={cn(
        "flex flex-col p-5 shadow-lg !rounded-xl !bg-[#171A21] !border-white/5",
        className
      )}
    >
      {title && (
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-sm font-semibold tracking-wide text-gray-200 uppercase">
            {title}
          </h3>
          {headerIcon && <div className="text-gray-400">{headerIcon}</div>}
        </div>
      )}
      <div className="flex-1">{children}</div>
    </AgileBaseCard>
  );
}
