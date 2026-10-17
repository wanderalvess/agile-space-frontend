'use client';

import React, { useState } from 'react';
import { AlertCircle } from 'lucide-react';
import { FIELD, SettingRow } from '@/components/room-kit';
import { cn } from '@/lib/utils';
import { DEFAULT_VOTE_LIMIT, MAX_VOTE_LIMIT, MIN_VOTE_LIMIT, readVoteLimit } from './brainstorm-ceremony';

/**
 * "Votos por pessoa": interruptor (sem limite quando desligado) e o número de 1 a 100. Serve ao diálogo de nova
 * sessão e às configurações. O número só vale ao sair do campo ou apertar Enter; valor inválido volta ao anterior.
 */
export function VoteLimitField({
  idPrefix,
  value,
  onChange,
  disabled,
}: {
  idPrefix: string;
  /** Limite atual; `null` = sem limite. */
  value: number | null;
  onChange: (value: number | null) => void;
  disabled?: boolean;
}) {
  const [draft, setDraft] = useState(value === null ? '' : String(value));
  const [invalid, setInvalid] = useState(false);

  // Outra pessoa (ou o servidor) pode mudar o limite: o campo acompanha.
  const [seen, setSeen] = useState(value);
  if (seen !== value) {
    setSeen(value);
    setDraft(value === null ? '' : String(value));
    setInvalid(false);
  }

  const commit = () => {
    const reading = readVoteLimit(draft);
    if (!reading.ok) {
      setInvalid(true);
      setDraft(value === null ? '' : String(value));
      return;
    }
    setInvalid(false);
    if (reading.value !== value) onChange(reading.value);
  };

  return (
    <SettingRow
      id={`${idPrefix}-vote-limit`}
      title="Limitar os votos por pessoa"
      desc="Cada pessoa tem uma cota de votos. Tirar um voto devolve a cota."
      checked={value !== null}
      onChange={(on) => onChange(on ? DEFAULT_VOTE_LIMIT : null)}
      disabled={disabled}
    >
      <div className="mt-3 flex flex-col gap-1.5">
        <div className="flex items-center justify-between gap-4">
          <label htmlFor={`${idPrefix}-vote-count`} className="text-[13px] font-semibold text-foreground">Votos por pessoa</label>
          <input
            id={`${idPrefix}-vote-count`}
            inputMode="numeric"
            autoComplete="off"
            value={draft}
            disabled={disabled}
            maxLength={3}
            aria-invalid={invalid}
            aria-describedby={invalid ? `${idPrefix}-vote-error` : undefined}
            onChange={(e) => setDraft(e.target.value.replace(/[^\d]/g, ''))}
            onBlur={commit}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                commit();
              }
            }}
            className={cn(FIELD, 'h-10 w-24 text-center tabular-nums', invalid && 'border-red-500/60')}
          />
        </div>
        {invalid && (
          <p id={`${idPrefix}-vote-error`} role="alert" className="m-0 flex items-center gap-1.5 text-xs text-red-700 dark:text-red-300">
            <AlertCircle className="h-3.5 w-3.5" strokeWidth={1.5} aria-hidden="true" /> Use um número de {MIN_VOTE_LIMIT} a {MAX_VOTE_LIMIT}.
          </p>
        )}
      </div>
    </SettingRow>
  );
}
