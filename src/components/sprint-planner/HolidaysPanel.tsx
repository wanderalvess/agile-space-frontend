'use client';

import { useState } from 'react';
import { Trash2 } from 'lucide-react';
import { FIELD, IconButton, ModalButton } from '@/components/room-kit';
import { cn } from '@/lib/utils';
import type { Holiday } from '@/lib/sprint-planner/api';
import { formatDay, weekdayOf } from '@/lib/sprint-planner/format';

/** Feriados da sprint. Grava a lista inteira (PUT /holidays); cada feriado em dia útil tira um dia de todos. */
export function HolidaysPanel({
  holidays,
  sprint,
  canEdit,
  onReplace,
}: {
  holidays: Holiday[];
  sprint: { startDate: string; endDate: string };
  canEdit: boolean;
  onReplace: (next: Holiday[]) => void;
}) {
  const [day, setDay] = useState('');
  const [label, setLabel] = useState('');
  const [error, setError] = useState<string | null>(null);

  const add = () => {
    if (!day) { setError('Informe a data do feriado.'); return; }
    if (day < sprint.startDate || day > sprint.endDate) { setError('O feriado precisa estar dentro da sprint.'); return; }
    if (holidays.some((h) => h.day === day)) { setError('Esse dia já está na lista.'); return; }
    setError(null);
    onReplace([...holidays, { day, label: label.trim() || null }].sort((a, b) => a.day.localeCompare(b.day)));
    setDay('');
    setLabel('');
  };

  return (
    <div className="flex flex-col gap-3">
      {holidays.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nenhum feriado nesta sprint.</p>
      ) : (
        <ul className="flex flex-col gap-1.5">
          {holidays.map((h) => (
            <li key={h.day} className="flex items-center gap-3 text-sm">
              <span className="tabular-nums font-semibold text-foreground">{formatDay(h.day)}</span>
              <span className="text-muted-foreground">({weekdayOf(h.day)}){h.label ? ` · ${h.label}` : ''}</span>
              {canEdit && (
                <IconButton
                  className="ml-auto"
                  size="sm"
                  label={`Remover feriado ${formatDay(h.day)}`}
                  icon={Trash2}
                  onClick={() => onReplace(holidays.filter((x) => x.day !== h.day))}
                />
              )}
            </li>
          ))}
        </ul>
      )}
      {canEdit && (
        <form
          aria-label="Adicionar feriado"
          className="flex flex-wrap items-end gap-2"
          onSubmit={(e) => { e.preventDefault(); add(); }}
        >
          <label className="flex flex-col gap-1.5">
            <span className="text-[13px] font-semibold text-foreground">Dia</span>
            <input type="date" className={cn(FIELD, 'h-10 w-[160px]')} value={day} min={sprint.startDate} max={sprint.endDate} onChange={(e) => setDay(e.target.value)} />
          </label>
          <label className="flex min-w-[140px] flex-1 flex-col gap-1.5">
            <span className="text-[13px] font-semibold text-foreground">Nome (opcional)</span>
            <input className={cn(FIELD, 'h-10')} value={label} maxLength={120} onChange={(e) => setLabel(e.target.value)} placeholder="Ex.: Finados" />
          </label>
          <ModalButton type="submit">Adicionar</ModalButton>
          {error && <p role="alert" className="w-full text-[13px] text-red-700 dark:text-red-300">{error}</p>}
        </form>
      )}
    </div>
  );
}
