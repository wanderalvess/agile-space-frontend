'use client';

import { useState } from 'react';
import { CalendarOff, Trash2 } from 'lucide-react';
import { FIELD, IconButton, ModalButton } from '@/components/room-kit';
import { cn } from '@/lib/utils';
import type { AbsenceRequest, AbsenceView, CapacityRow, Holiday } from '@/lib/sprint-planner/api';
import { absenceAmount, formatHours, formatRange, weekdayOf, formatDay } from '@/lib/sprint-planner/format';

const LABEL = 'text-[13px] font-semibold text-foreground';

/** Validação local da ausência (o backend valida de novo e responde 422 fora da sprint). */
export function validateAbsence(
  f: { accountId: string; startDate: string; endDate: string; partial: boolean; hours: string },
  sprint: { startDate: string; endDate: string },
): string | null {
  if (!f.accountId) return 'Escolha a pessoa.';
  if (!f.startDate) return 'Informe a data.';
  const end = f.endDate || f.startDate;
  if (end < f.startDate) return 'O fim não pode ser antes do início.';
  if (f.startDate < sprint.startDate || end > sprint.endDate) return 'A ausência precisa estar dentro da sprint.';
  if (f.partial) {
    const h = Number(f.hours.replace(',', '.'));
    if (!Number.isFinite(h) || h <= 0 || h > 24) return 'Informe as horas por dia (entre 0 e 24).';
  }
  return null;
}

/** Ausências e folgas por pessoa: o PL lança data/intervalo, dia inteiro ou horas, e o motivo. */
export function AbsencesPanel({
  absences,
  holidays,
  people,
  sprint,
  canEdit,
  onAdd,
  onRemove,
}: {
  absences: AbsenceView[];
  holidays: Holiday[];
  people: CapacityRow[];
  sprint: { startDate: string; endDate: string };
  canEdit: boolean;
  onAdd: (body: AbsenceRequest) => Promise<boolean>;
  onRemove: (absence: AbsenceView) => void;
}) {
  const [accountId, setAccountId] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [partial, setPartial] = useState(false);
  const [hours, setHours] = useState('4');
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const nameOf = (id: string) => people.find((p) => p.accountId === id)?.name || id;

  const submit = async () => {
    const invalid = validateAbsence({ accountId, startDate, endDate, partial, hours }, sprint);
    if (invalid) { setError(invalid); return; }
    setError(null);
    setSaving(true);
    const ok = await onAdd({
      accountId,
      startDate,
      endDate: endDate || startDate,
      hoursPerDay: partial ? Number(hours.replace(',', '.')) : null,
      reason: reason.trim() || null,
    });
    setSaving(false);
    if (ok) { setStartDate(''); setEndDate(''); setReason(''); }
  };

  return (
    <div className="flex flex-col gap-3">
      <ul className="flex flex-col divide-y divide-border rounded-[10px] border border-border">
        {holidays.map((h) => (
          <li key={`f-${h.day}`} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2.5 text-sm">
            <span className="font-semibold text-foreground">Todos</span>
            <span className="tabular-nums text-muted-foreground">{formatDay(h.day)} ({weekdayOf(h.day)})</span>
            <span className="text-muted-foreground">Feriado{h.label ? ` · ${h.label}` : ''} · dia inteiro</span>
          </li>
        ))}
        {absences.map((a) => (
          <li key={a.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2.5 text-sm">
            <span className="font-semibold text-foreground">{nameOf(a.accountId)}</span>
            <span className="tabular-nums text-muted-foreground">{formatRange(a.startDate, a.endDate)}</span>
            <span className="text-muted-foreground">{absenceAmount(a)}{a.reason ? ` · ${a.reason}` : ''}</span>
            {canEdit && (
              <IconButton className="ml-auto" size="sm" label={`Remover ausência de ${nameOf(a.accountId)}`} icon={Trash2} onClick={() => onRemove(a)} />
            )}
          </li>
        ))}
        {absences.length === 0 && holidays.length === 0 && (
          <li className="flex items-center gap-2 px-3 py-4 text-sm text-muted-foreground">
            <CalendarOff aria-hidden="true" className="h-4 w-4" strokeWidth={1.5} /> Nenhuma ausência lançada nesta sprint.
          </li>
        )}
      </ul>

      {canEdit && (
        <form
          aria-label="Lançar ausência"
          className="grid gap-3 rounded-[10px] border border-dashed border-border p-3 sm:grid-cols-2"
          onSubmit={(e) => { e.preventDefault(); void submit(); }}
        >
          <label className="flex flex-col gap-1.5">
            <span className={LABEL}>Pessoa</span>
            <select className={cn(FIELD, 'h-10')} value={accountId} onChange={(e) => setAccountId(e.target.value)}>
              <option value="">Escolha</option>
              {people.map((p) => <option key={p.accountId} value={p.accountId}>{p.name || p.accountId}</option>)}
            </select>
          </label>
          <label className="flex flex-col gap-1.5">
            <span className={LABEL}>Quanto</span>
            <select className={cn(FIELD, 'h-10')} value={partial ? 'horas' : 'dia'} onChange={(e) => setPartial(e.target.value === 'horas')}>
              <option value="dia">Dia inteiro</option>
              <option value="horas">Algumas horas por dia</option>
            </select>
          </label>
          <label className="flex flex-col gap-1.5">
            <span className={LABEL}>De</span>
            <input type="date" className={cn(FIELD, 'h-10')} value={startDate} min={sprint.startDate} max={sprint.endDate} onChange={(e) => setStartDate(e.target.value)} />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className={LABEL}>Até (opcional)</span>
            <input type="date" className={cn(FIELD, 'h-10')} value={endDate} min={startDate || sprint.startDate} max={sprint.endDate} onChange={(e) => setEndDate(e.target.value)} />
          </label>
          {partial && (
            <label className="flex flex-col gap-1.5">
              <span className={LABEL}>Horas por dia</span>
              <input type="number" inputMode="decimal" min={0.5} max={24} step={0.5} className={cn(FIELD, 'h-10')} value={hours} onChange={(e) => setHours(e.target.value)} />
            </label>
          )}
          <label className={cn('flex flex-col gap-1.5', !partial && 'sm:col-span-2')}>
            <span className={LABEL}>Motivo (opcional)</span>
            <input className={cn(FIELD, 'h-10')} value={reason} maxLength={255} onChange={(e) => setReason(e.target.value)} placeholder="Ex.: folga, consulta, curso" />
          </label>
          {error && <p role="alert" className="text-[13px] text-red-700 dark:text-red-300 sm:col-span-2">{error}</p>}
          <div className="sm:col-span-2">
            <ModalButton type="submit" variant="primary" disabled={saving}>{saving ? 'Lançando…' : 'Lançar'}</ModalButton>
          </div>
        </form>
      )}
      {absences.length > 0 && (
        <p className="text-xs text-muted-foreground">
          Total descontado de ausências: {formatHours(people.reduce((s, p) => s + p.absencesHours, 0))}.
        </p>
      )}
    </div>
  );
}
