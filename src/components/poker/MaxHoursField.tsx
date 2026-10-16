'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { FIELD, SelectField } from '@/components/room-kit';
import { HOURS_MAX_LIMIT, HOURS_MAX_MIN, HOURS_MAX_PRESETS } from '@/lib/poker-deck';

const CUSTOM = 'custom';

const OPTIONS = [
  ...HOURS_MAX_PRESETS.map((n) => ({ value: String(n), label: `${n} h` })),
  { value: CUSTOM, label: 'Personalizado' },
];

/**
 * "Horas máximas do baralho": opções prontas e valor personalizado (inteiro de 1 a 100).
 * `value` é sempre um número válido; quem usa decide o que gravar.
 */
export function MaxHoursField({ id, value, onChange, className }: {
  id: string;
  value: number;
  onChange: (value: number) => void;
  className?: string;
}) {
  const isPreset = (HOURS_MAX_PRESETS as readonly number[]).includes(value);
  const [custom, setCustom] = useState(!isPreset);
  const [draft, setDraft] = useState(String(value));

  // Valor trocado por fora (ex.: aplicar template): acompanha.
  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect -- espelha o valor vindo de fora no rascunho do campo */
    if (!(HOURS_MAX_PRESETS as readonly number[]).includes(value)) setCustom(true);
    setDraft(String(value));
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [value]);

  const commit = (text: string) => {
    const n = Math.floor(Number(text));
    if (!Number.isFinite(n) || n < HOURS_MAX_MIN) { setDraft(String(value)); return; }
    const clamped = Math.min(HOURS_MAX_LIMIT, n);
    setDraft(String(clamped));
    if (clamped !== value) onChange(clamped);
  };

  return (
    <div className={cn('flex items-center gap-2', className)}>
      {custom && (
        <input
          id={`${id}-custom`}
          type="number"
          inputMode="numeric"
          min={HOURS_MAX_MIN}
          max={HOURS_MAX_LIMIT}
          step={1}
          value={draft}
          aria-label="Horas máximas (valor personalizado)"
          onChange={(e) => {
            setDraft(e.target.value);
            const n = Math.floor(Number(e.target.value));
            if (Number.isFinite(n) && n >= HOURS_MAX_MIN && n <= HOURS_MAX_LIMIT && n !== value) onChange(n);
          }}
          onBlur={(e) => commit(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') commit((e.target as HTMLInputElement).value); }}
          className={cn(FIELD, 'h-9 w-20 text-center text-[13px] font-medium tabular-nums')}
        />
      )}
      <SelectField
        id={id}
        aria-label="Horas máximas do baralho"
        value={custom ? CUSTOM : String(value)}
        onChange={(v) => {
          if (v === CUSTOM) { setCustom(true); return; }
          setCustom(false);
          onChange(Number(v));
        }}
        options={OPTIONS}
        className="w-36"
      />
    </div>
  );
}
