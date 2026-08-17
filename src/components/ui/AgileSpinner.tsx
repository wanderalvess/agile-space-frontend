'use client';

import { cn } from "@/lib/utils";

interface AgileSpinnerProps {
  className?: string;
  size?: 'xs' | 'sm' | 'md' | 'lg';
  variant?: 'primary' | 'white' | 'indigo' | 'rose' | 'amber' | 'emerald';
  title?: string;
  subtitle?: string;
}

export function AgileSpinner({ 
  className, 
  size = 'md', 
  variant = 'primary',
  title,
  subtitle
}: AgileSpinnerProps) {
  const sizeClasses = {
    xs: 'h-3 w-3 border-[1.5px]',
    sm: 'h-4 w-4 border-[1.5px]',
    md: 'h-6 w-6 border-2',
    lg: 'h-10 w-10 border-[3px]',
  };

  const variantClasses = {
    primary: 'border-primary/20 border-t-primary shadow-[0_0_15px_rgba(255,107,0,0.1)]',
    white: 'border-white/20 border-t-white',
    indigo: 'border-indigo-500/20 border-t-indigo-500 shadow-[0_0_15px_rgba(99,102,241,0.1)]',
    rose: 'border-rose-500/20 border-t-rose-500 shadow-[0_0_15px_rgba(244,63,94,0.1)]',
    amber: 'border-amber-500/20 border-t-amber-500 shadow-[0_0_15px_rgba(245,158,11,0.1)]',
    emerald: 'border-emerald-500/20 border-t-emerald-500 shadow-[0_0_15px_rgba(16,185,129,0.1)]',
  };

  return (
    <div className={cn("relative flex flex-col items-center justify-center gap-4", className)}>
      <div className="relative flex items-center justify-center">
        {/* Outer Glow */}
        <div className={cn(
          "absolute inset-0 rounded-full blur-[4px] animate-pulse opacity-20",
          variant === 'primary' && "bg-primary",
          variant === 'indigo' && "bg-indigo-500",
          variant === 'rose' && "bg-rose-500",
          variant === 'amber' && "bg-amber-500",
          variant === 'emerald' && "bg-emerald-500",
          variant === 'white' && "bg-white",
        )} />
        
        {/* Spinner Ring */}
        <div className={cn(
          "rounded-full animate-spin transition-all duration-300",
          sizeClasses[size],
          variantClasses[variant]
        )} />
      </div>

      {(title || subtitle) && (
        <div className="flex flex-col items-center text-center space-y-1">
          {title && (
            <h3 className="text-sm font-black uppercase tracking-tighter italic text-slate-800">
              {title}
            </h3>
          )}
          {subtitle && (
            <p className="text-[10px] font-medium text-slate-400 max-w-[200px] leading-tight">
               {subtitle}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
