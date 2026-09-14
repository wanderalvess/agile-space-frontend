'use client';

import React from 'react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

const KICKER_COLOR_CLASSES: Record<string, string> = {
  cyan: 'bg-cyan-50 text-cyan-600 border-cyan-100 dark:!bg-cyan-500/10 dark:!text-cyan-300 dark:!border-cyan-400/20',
  orange: 'bg-orange-50 text-orange-600 border-orange-100 dark:!bg-orange-500/10 dark:!text-orange-300 dark:!border-orange-400/20',
  violet: 'bg-violet-50 text-violet-600 border-violet-100 dark:!bg-violet-500/10 dark:!text-violet-300 dark:!border-violet-400/20',
  indigo: 'bg-indigo-50 text-indigo-600 border-indigo-100 dark:!bg-indigo-500/10 dark:!text-indigo-300 dark:!border-indigo-400/20',
  emerald: 'bg-emerald-50 text-emerald-600 border-emerald-100 dark:!bg-emerald-500/10 dark:!text-emerald-300 dark:!border-emerald-400/20',
  amber: 'bg-amber-50 text-amber-600 border-amber-100 dark:!bg-amber-500/10 dark:!text-amber-300 dark:!border-amber-400/20',
};

const ACCENT_TEXT_CLASSES: Record<string, string> = {
  cyan: 'text-cyan-600',
  orange: 'text-orange-600 dark:!text-orange-300',
  violet: 'text-violet-600',
  indigo: 'text-indigo-600',
  emerald: 'text-emerald-600',
  amber: 'text-amber-600',
};

export type WorkspaceHeaderAccent = keyof typeof KICKER_COLOR_CLASSES;

interface WorkspaceSectionHeaderProps {
  kicker: string;
  accent: WorkspaceHeaderAccent;
  title: React.ReactNode;
  titleAccent: React.ReactNode;
  subtitle: string;
  action?: React.ReactNode;
  className?: string;
}

/** Standard header used across all Meu Espaço tabs: kicker badge + two-tone title + subtitle + optional action. */
export function WorkspaceSectionHeader({ kicker, accent, title, titleAccent, subtitle, action, className }: WorkspaceSectionHeaderProps) {
  return (
    <div className={cn("flex flex-col md:flex-row md:items-end justify-between gap-4", className)}>
      <div className="space-y-1">
        <div className="flex items-center gap-2">
          <Badge variant="outline" className={cn("font-black uppercase tracking-[0.2em] text-[7px] px-1.5 py-0 italic", KICKER_COLOR_CLASSES[accent])}>
            {kicker}
          </Badge>
        </div>
        <h1 className="text-2xl font-black italic tracking-tighter text-slate-900 uppercase flex items-center gap-3">
          {title} <span className={cn("not-italic", ACCENT_TEXT_CLASSES[accent])}>{titleAccent}</span>
        </h1>
        <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-slate-400">{subtitle}</p>
      </div>
      {action}
    </div>
  );
}
