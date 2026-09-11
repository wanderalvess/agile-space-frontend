'use client';

import React from 'react';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { CalendarIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';

interface PlannerDatePickerProps {
  value?: string;
  onChange: (value: string | undefined) => void;
  min?: string;
  max?: string;
  placeholder?: string;
  disabled?: boolean;
}

export function PlannerDatePicker({ value, onChange, min, max, placeholder = 'Data', disabled }: PlannerDatePickerProps) {
  const selected = value ? parseISO(value) : undefined;
  const minDate = min ? parseISO(min) : undefined;
  const maxDate = max ? parseISO(max) : undefined;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          disabled={disabled}
          className={cn(
            'h-9 justify-start text-left font-bold text-[10px] uppercase tracking-wider gap-2 border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/60',
            !selected && 'text-slate-400'
          )}
        >
          <CalendarIcon className="h-3.5 w-3.5 shrink-0" />
          {selected ? format(selected, 'dd/MM/yy', { locale: ptBR }) : placeholder}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          selected={selected}
          onSelect={(date) => onChange(date ? format(date, 'yyyy-MM-dd') : undefined)}
          disabled={(date) => (minDate ? date < minDate : false) || (maxDate ? date > maxDate : false)}
          initialFocus
        />
      </PopoverContent>
    </Popover>
  );
}
