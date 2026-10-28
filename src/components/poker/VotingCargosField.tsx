'use client';

import { useState } from 'react';
import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import { DEFAULT_VOTING_CARGOS, VOTING_CARGO_OPTIONS, isVotingCargo } from '@/lib/poker-utils';

const sameCargo = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

/** A lista de cargos que votam é igual à padrão (só dev e QA)? Ordem e caixa não contam. */
export function isDefaultVotingCargos(value: readonly string[]): boolean {
  return value.length === DEFAULT_VOTING_CARGOS.length
    && DEFAULT_VOTING_CARGOS.every((d) => value.some((v) => sameCargo(v, d)))
    && value.every((v) => DEFAULT_VOTING_CARGOS.some((d) => sameCargo(v, d)));
}

/**
 * "Quem vota": escolha dos cargos (os mesmos da administração) que votam na sala; os demais entram como
 * observadores. Seleção múltipla em caixas de marcar acessíveis (teclado e leitor de tela), com alvo de 44 px no
 * celular. Sempre sobra ao menos um cargo votando — sem isso a sala ficaria sem votantes.
 */
export function VotingCargosField({
  value,
  onChange,
  idPrefix = 'vc',
}: {
  value: readonly string[];
  onChange: (next: string[]) => void;
  idPrefix?: string;
}) {
  const [blocked, setBlocked] = useState(false);
  const helpId = `${idPrefix}-help`;

  const toggle = (cargo: string, checked: boolean) => {
    if (checked) {
      setBlocked(false);
      onChange([...value.filter((v) => !sameCargo(v, cargo)), cargo]);
      return;
    }
    const next = value.filter((v) => !sameCargo(v, cargo));
    // Sobra ao menos um cargo da lista de opções votando.
    if (!VOTING_CARGO_OPTIONS.some((o) => isVotingCargo(o, next))) {
      setBlocked(true);
      return;
    }
    setBlocked(false);
    onChange(next);
  };

  return (
    <fieldset className="m-0 flex flex-col gap-2 border-0 p-0" aria-describedby={helpId}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <legend className="p-0 text-[13px] font-semibold">Quem vota</legend>
        {!isDefaultVotingCargos(value) && (
          <button
            type="button"
            onClick={() => { setBlocked(false); onChange([...DEFAULT_VOTING_CARGOS]); }}
            className="inline-flex min-h-11 items-center rounded-lg px-2 text-[13px] font-semibold text-primary underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:min-h-8 [.theme-totvs:not(.dark)_&]:text-foreground"
          >
            Restaurar padrão
          </button>
        )}
      </div>
      <div className="flex flex-wrap gap-2">
        {VOTING_CARGO_OPTIONS.map((cargo) => {
          const checked = isVotingCargo(cargo, value);
          const id = `${idPrefix}-${cargo.toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}`;
          return (
            <label
              key={cargo}
              htmlFor={id}
              className={cn(
                'inline-flex min-h-11 cursor-pointer items-center gap-1.5 rounded-full border px-3.5 text-sm transition-colors has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring sm:min-h-9',
                checked ? 'border-primary bg-primary/10 font-semibold text-foreground dark:bg-primary/15' : 'border-border text-muted-foreground hover:bg-accent/40 hover:text-foreground'
              )}
            >
              <input
                id={id}
                type="checkbox"
                className="sr-only"
                checked={checked}
                onChange={(e) => toggle(cargo, e.target.checked)}
              />
              {checked && <Check aria-hidden="true" className="h-3.5 w-3.5 shrink-0" strokeWidth={1.5} />}
              {cargo}
            </label>
          );
        })}
      </div>
      <p id={helpId} className="m-0 text-xs text-muted-foreground">
        Os demais cargos entram como observadores. Quem está sem cargo na administração também entra como observador.
      </p>
      <p role="status" className={cn('m-0 text-xs text-amber-800 dark:text-amber-200', !blocked && 'sr-only')}>
        {blocked ? 'Deixe ao menos um cargo votando.' : ''}
      </p>
    </fieldset>
  );
}
