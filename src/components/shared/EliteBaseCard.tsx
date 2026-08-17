'use client';

import React from 'react';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { motion, HTMLMotionProps } from 'framer-motion';

export interface AgileBaseCardProps extends Omit<HTMLMotionProps<"div">, "children"> {
  children: React.ReactNode;
  theme?: string;
  isMergingSource?: boolean;
  canMergeTarget?: boolean;
  isDragging?: boolean;
  isOver?: boolean;
  isHot?: boolean;
  hasChildrenGroup?: boolean;
  className?: string;
  onClick?: (e: React.MouseEvent) => void;
  disableAnimation?: boolean;
}

const THEME_STYLES: Record<string, any> = {
  primary: {
    hoverShadow: 'hover:shadow-2xl hover:shadow-violet-500/15 hover:border-violet-300/50',
    mergeSource: 'ring-4 ring-violet-500 shadow-2xl shadow-violet-500/40 border-violet-500 z-30 scale-95 opacity-90',
    mergeTarget: 'cursor-pointer hover:border-violet-400 hover:border-dashed hover:bg-violet-50/50 hover:scale-[1.02] active:scale-95',
    dragOver: 'ring-4 ring-violet-500/20 border-violet-500 bg-violet-50/50 scale-[1.02] z-20',
  },
  amber: {
    hoverShadow: 'hover:shadow-2xl hover:shadow-amber-500/15 hover:border-amber-300/50',
    mergeSource: 'ring-4 ring-amber-500 shadow-2xl shadow-amber-500/40 border-amber-500 z-30 scale-95 opacity-90',
    mergeTarget: 'cursor-pointer hover:border-amber-400 hover:border-dashed hover:bg-amber-50/50 hover:scale-[1.02] active:scale-95',
    dragOver: 'ring-4 ring-amber-500/20 border-amber-500 bg-amber-50/50 scale-[1.02] z-20',
  },
  emerald: {
    hoverShadow: 'hover:shadow-2xl hover:shadow-emerald-500/15 hover:border-emerald-300/50',
    mergeSource: 'ring-4 ring-emerald-500 shadow-2xl shadow-emerald-500/40 border-emerald-500 z-30 scale-[1.05]',
    mergeTarget: 'cursor-pointer hover:border-emerald-400 hover:border-dashed hover:bg-emerald-50/20 hover:scale-[1.02] active:scale-95',
    dragOver: 'ring-4 ring-emerald-500/20 border-emerald-500 bg-emerald-50/50 scale-[1.02] z-20',
  },
  rose: {
    hoverShadow: 'hover:shadow-2xl hover:shadow-rose-500/15 hover:border-rose-300/50',
    mergeSource: 'ring-4 ring-rose-500 shadow-2xl shadow-rose-500/40 border-rose-500 z-30 scale-95 opacity-90',
    mergeTarget: 'cursor-pointer hover:border-rose-400 hover:border-dashed hover:bg-rose-50/50 hover:scale-[1.02] active:scale-95',
    dragOver: 'ring-4 ring-rose-500/20 border-rose-500 bg-rose-50/50 scale-[1.02] z-20',
  },
  indigo: {
    hoverShadow: 'hover:shadow-2xl hover:shadow-indigo-500/15 hover:border-indigo-300/50',
    mergeSource: 'ring-4 ring-indigo-500 shadow-2xl shadow-indigo-500/40 border-indigo-500 z-30 scale-[1.05]',
    mergeTarget: 'cursor-pointer hover:border-indigo-400 hover:border-dashed hover:bg-indigo-50/20 hover:scale-[1.02] active:scale-95',
    dragOver: 'ring-4 ring-indigo-500/20 border-indigo-500 bg-indigo-50/50 scale-[1.02] z-20',
  },
  slate: {
    hoverShadow: 'hover:shadow-2xl hover:shadow-slate-500/15 hover:border-slate-300/50',
    mergeSource: 'ring-4 ring-slate-500 shadow-2xl shadow-slate-500/40 border-slate-500 z-30 scale-95 opacity-90',
    mergeTarget: 'cursor-pointer hover:border-slate-400 hover:border-dashed hover:bg-slate-50 hover:scale-[1.02] active:scale-95',
    dragOver: 'ring-4 ring-slate-500/20 border-slate-500 bg-slate-50 scale-[1.02] z-20',
  }
};

// Aliases para Retro e outros módulos
THEME_STYLES.success = THEME_STYLES.emerald;
THEME_STYLES.warning = THEME_STYLES.amber;
THEME_STYLES.action = THEME_STYLES.primary;
THEME_STYLES.neutral = THEME_STYLES.slate;
THEME_STYLES.purple = THEME_STYLES.indigo;
THEME_STYLES.pink = THEME_STYLES.rose;
THEME_STYLES.cyan = THEME_STYLES.indigo; // Fallback para indigo por enquanto
THEME_STYLES.info = THEME_STYLES.indigo;

export function AgileBaseCard({
  children,
  theme = 'slate',
  isMergingSource = false,
  canMergeTarget = false,
  isDragging = false,
  isOver = false,
  hasChildrenGroup = false,
  className,
  onClick,
  disableAnimation = false,
  isHot = false,
  ...motionProps
}: AgileBaseCardProps) {
  // Garantia total contra undefined/null
  const activeTheme = theme || 'slate';
  const styles = THEME_STYLES[activeTheme] || THEME_STYLES.slate;

  const content = (
    <Card 
      onClick={onClick}
      className={cn(
        "relative bg-white/70 dark:bg-slate-900/70 backdrop-blur-xl transition-all duration-300 break-words rounded-[2.5rem] border border-white/60 dark:border-slate-800/60 shadow-2xl shadow-slate-500/5 dark:shadow-none",
        
        // Base Hover
        styles.hoverShadow,
        
        // Dragging states
        isDragging && "shadow-2xl opacity-50 scale-95",
        isOver && !isDragging && styles.dragOver,
        
        // Merge states
        isMergingSource && styles.mergeSource,
        canMergeTarget && styles.mergeTarget,
        
        // Group styling
        hasChildrenGroup && "border-r-4 border-b-4 border-slate-200/60 dark:border-slate-800/60 pb-1 pr-1",
        
        className
      )}
    >
      {/* Target Marker Overlay */}
      {canMergeTarget && (
        <div className="absolute inset-0 bg-current opacity-[0.02] rounded-[1.5rem] pointer-events-none transition-all group-hover:ring-2 group-hover:ring-current group-hover:ring-inset" />
      )}

      {children}
    </Card>
  );

  if (disableAnimation) {
    return <div {...(motionProps as any)}>{content}</div>;
  }

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      {...motionProps}
    >
      {content}
    </motion.div>
  );
}
