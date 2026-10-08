'use client';

import React from 'react';
import { cn } from '@/lib/utils';
import { ControlledInput, ControlledTextarea } from './ControlledFields';

export function FieldLabel({ icon: Icon, label, color }: { icon: React.ElementType; label: string; color: string }) {
  return (
    <p className={cn('flex items-center gap-1.5 text-[9px] font-black uppercase tracking-[0.2em]', color)}>
      <Icon className="h-3 w-3 shrink-0" />
      {label}
    </p>
  );
}

export function TextField({
  id, label, icon, value, onChange, placeholder, colorScheme, multiline = false, minRows = 3,
}: {
  id: string; label: string; icon: React.ElementType; value: string;
  onChange: (v: string) => void; placeholder: string;
  colorScheme: { label: string; focus: string; ring: string };
  multiline?: boolean; minRows?: number;
}) {
  const baseClass = cn(
    'w-full text-[11px] text-slate-700 dark:text-slate-200 font-medium bg-slate-50 dark:bg-slate-950/40 border border-slate-200 dark:border-slate-800 rounded-xl px-3 transition-all',
    'placeholder:text-slate-300 dark:placeholder:text-slate-700',
    'focus:bg-white dark:focus:bg-slate-950 focus:outline-none',
    colorScheme.focus, colorScheme.ring,
  );

  return (
    <div className="space-y-1.5">
      <FieldLabel icon={icon} label={label} color={colorScheme.label} />
      {multiline ? (
        <ControlledTextarea
          id={id}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          rows={minRows}
          className={cn(baseClass, 'py-2.5 resize-none leading-relaxed')}
        />
      ) : (
        <ControlledInput
          id={id}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          className={cn(baseClass, 'h-9 py-0')}
        />
      )}
    </div>
  );
}
