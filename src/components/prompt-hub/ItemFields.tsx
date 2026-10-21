'use client';

import { PAGE_CARD } from '@/components/page';
import { FIELD } from '@/components/room-kit';
import { cn } from '@/lib/utils';

/** Campos {{nome}} do conteúdo viram caixas de texto: quem usa preenche antes de copiar. */
export function ItemFields({
  fields,
  values,
  onChange,
  columns,
}: {
  fields: string[];
  values: Record<string, string>;
  onChange: (name: string, value: string) => void;
  columns: 1 | 2 | 3;
}) {
  const filled = fields.filter(name => values[name]).length;
  const grid = columns === 1 ? 'grid-cols-1' : columns === 2 ? 'grid-cols-1 sm:grid-cols-2' : 'grid-cols-1 sm:grid-cols-2 xl:grid-cols-3';
  return (
    <section aria-label="Campos" className={cn(PAGE_CARD, 'flex flex-col gap-3 p-[18px]')}>
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-base font-bold text-foreground">Preencha os campos</h2>
        <span className="text-[13px] text-muted-foreground" aria-live="polite">
          {filled} de {fields.length} preenchidos
        </span>
      </div>
      <div className={cn('grid gap-3', grid)}>
        {fields.map(name => (
          <label key={name} className="flex flex-col gap-1.5 text-[13px] font-semibold text-muted-foreground">
            <span className="font-mono text-primary [.theme-totvs:not(.dark)_&]:text-foreground">{`{{${name}}}`}</span>
            <input
              value={values[name] ?? ''}
              onChange={event => onChange(name, event.target.value)}
              placeholder={`Valor para ${name}`}
              className={cn(FIELD, 'h-[42px]')}
            />
          </label>
        ))}
      </div>
    </section>
  );
}
