'use client';

import { FIELD, FOCUS_RING } from '@/components/room-kit';
import { cn } from '@/lib/utils';
import type { PatchPlanRequest, ReserveMode, ReserveView } from '@/lib/sprint-planner/api';
import { formatPct } from '@/lib/sprint-planner/format';

const MODES: { id: ReserveMode; label: string; description: string }[] = [
  {
    id: 'HORAS',
    label: 'Horas produtivas e fora da conta',
    description: 'A reserva já sai das horas por dia de cada pessoa (ex.: 6 h de 8 h). Tipos de subtarefa fora da conta não somam.',
  },
  {
    id: 'FOCO',
    label: 'Fator de foco',
    description: 'A capacidade de cada pessoa é multiplicada pelo fator de foco do time, ou pelo da pessoa quando for diferente.',
  },
];

function PctInput({ id, value, label, min, onCommit, disabled }: { id: string; value: number | null; label: string; min: number; onCommit: (v: number) => void; disabled?: boolean }) {
  return (
    <div className="flex items-center gap-1.5">
      <input
        key={String(value)}
        id={id}
        type="number"
        inputMode="decimal"
        aria-label={label}
        className={cn(FIELD, 'h-10 w-[96px] px-2 text-right tabular-nums')}
        defaultValue={value ?? ''}
        min={min}
        max={100}
        step={1}
        disabled={disabled}
        onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
        onBlur={(e) => {
          const n = Number(e.target.value.replace(',', '.'));
          if (e.target.value === '' || !Number.isFinite(n) || n < min || n > 100) {
            e.target.value = value == null ? '' : String(value);
            return;
          }
          if (n !== value) onCommit(n);
        }}
      />
      <span className="text-sm text-muted-foreground">%</span>
    </div>
  );
}

/**
 * Reserva da sprint: o tipo (horas produtivas ou fator de foco) e o percentual que o termômetro aceita acima da
 * capacidade ("coberto pela reserva"). Grava com PATCH + version; o conflito 409 é tratado por quem chama.
 */
export function ReserveSettings({
  reserve,
  canEdit,
  onPatch,
}: {
  reserve: ReserveView;
  canEdit: boolean;
  onPatch: (body: Omit<PatchPlanRequest, 'version'>) => void;
}) {
  return (
    <div className="flex flex-col gap-4">
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1 text-[13px] font-semibold text-foreground">Tipo de reserva</legend>
        {MODES.map((m) => {
          const on = reserve.mode === m.id;
          return (
            <label
              key={m.id}
              className={cn(
                'flex cursor-pointer items-start gap-2.5 rounded-[10px] border p-3 transition-colors',
                on ? 'border-primary/60 bg-primary/10 dark:bg-primary/15' : 'border-border hover:bg-accent',
                !canEdit && 'cursor-default',
              )}
            >
              <input
                type="radio"
                name="reserve-mode"
                className={cn('mt-0.5 h-4 w-4 accent-[hsl(var(--primary))]', FOCUS_RING)}
                checked={on}
                disabled={!canEdit}
                onChange={() => onPatch({ reserveMode: m.id })}
              />
              <span className="flex flex-col gap-0.5">
                <span className="text-sm font-semibold text-foreground">{m.label}</span>
                {/* Selecionado, o fundo ganha o tom da marca: o cinza apagado ficava em 4,3:1 em dois temas. */}
                <span className={cn('text-[13px]', on ? 'text-foreground/80' : 'text-muted-foreground')}>{m.description}</span>
              </span>
            </label>
          );
        })}
      </fieldset>

      {reserve.mode === 'FOCO' && (
        <div className="flex flex-col gap-1.5">
          <label htmlFor="foco-time" className="text-[13px] font-semibold text-foreground">Fator de foco do time</label>
          {canEdit ? (
            <PctInput id="foco-time" value={reserve.focusPct} label="Fator de foco do time" min={1} onCommit={(v) => onPatch({ focusFactorPct: v })} />
          ) : (
            <span className="text-sm tabular-nums text-foreground">{formatPct(reserve.focusPct ?? 100)}</span>
          )}
          <p className="text-xs text-muted-foreground">Vale para todos; mude na linha da pessoa quando for diferente. Sem valor, conta 100%.</p>
        </div>
      )}

      <div className="flex flex-col gap-1.5">
        <label htmlFor="reserva-pct" className="text-[13px] font-semibold text-foreground">Reserva desta sprint (%)</label>
        {canEdit ? (
          <PctInput id="reserva-pct" value={reserve.pct} label="Reserva desta sprint em porcentagem" min={0} onCommit={(v) => onPatch({ reservePct: v })} />
        ) : (
          <span className="text-sm tabular-nums text-foreground">{reserve.pct == null ? 'Não definida' : formatPct(reserve.pct)}</span>
        )}
        <p className="text-xs text-muted-foreground">
          Ao criar o plano, vem a reserva da última sprint revisada da squad (sugestão). Até esse percentual acima da
          capacidade o termômetro diz &quot;coberto pela reserva&quot;; além disso, alerta forte. Nunca bloqueia.
        </p>
      </div>
    </div>
  );
}
