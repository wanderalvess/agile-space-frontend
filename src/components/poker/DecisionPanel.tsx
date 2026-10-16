'use client';

import { CheckCircle2, ChevronDown, Code, Minus, Plus, RotateCcw, Users } from 'lucide-react';
import type { DeckType } from '@/lib/types';
import { formatRoleForCopy } from '@/lib/poker-utils';
import type { RoundSummary } from '@/lib/poker-results';
import { REVEAL_DELAY } from '@/lib/poker-table';
import { cn } from '@/lib/utils';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { FIELD, FOCUS_RING, ModalButton, RoleChip } from '@/components/room-kit';

interface DecisionPanelProps {
  deck: DeckType;
  summary: RoundSummary;
  /** Ajustes do facilitador por papel (horas). Vale no lugar da média ao salvar e copiar. */
  adjusted: Record<string, string>;
  onAdjust: (role: string, value: string) => void;
  /** Papéis técnicos presentes na sala (revotação parcial). */
  presentCategories: readonly string[];
  onClear: () => void;
  onSelectiveRevote?: (category: string) => void;
  onSave: () => void;
  hasNextPending: boolean;
  /** Nota de decisão ("por que essa estimativa?") — só quando a sala liga. */
  decisionNote?: { key: string; value: string; onSave: (note: string) => void } | null;
}

function Stepper({ role, value, suggested, onChange }: { role: string; value: string; suggested: string; onChange: (v: string) => void }) {
  const n = Number(value);
  const set = (next: number) => onChange(String(Math.max(0, next)));
  return (
    <div className="flex items-center gap-3">
      <RoleChip category={role} label={formatRoleForCopy(role)} className="w-11 justify-center" />
      <span className="flex-1 text-xs text-muted-foreground">sugerido {suggested}h</span>
      <div className="flex items-center overflow-hidden rounded-[10px] border border-border">
        <button type="button" aria-label={`Diminuir ${formatRoleForCopy(role)}`} onClick={() => set((isNaN(n) ? 0 : n) - 1)} className={cn('flex h-[38px] w-9 items-center justify-center bg-muted/50 hover:bg-accent', FOCUS_RING)}>
          <Minus className="h-4 w-4" strokeWidth={1.5} />
        </button>
        <span className="w-16 text-center text-lg font-bold tabular-nums" aria-live="polite">{value}h</span>
        <button type="button" aria-label={`Aumentar ${formatRoleForCopy(role)}`} onClick={() => set((isNaN(n) ? 0 : n) + 1)} className={cn('flex h-[38px] w-9 items-center justify-center bg-muted/50 hover:bg-accent', FOCUS_RING)}>
          <Plus className="h-4 w-4" strokeWidth={1.5} />
        </button>
      </div>
    </div>
  );
}

/**
 * Decisão da rodada (facilitador): horas finais por papel, nota de decisão,
 * revotar (todos ou só um papel) e salvar. A estimativa copiada e a salva usam
 * os valores daqui.
 */
export function DecisionPanel({ deck, summary, adjusted, onAdjust, presentCategories, onClear, onSelectiveRevote, onSave, hasNextPending, decisionNote }: DecisionPanelProps) {
  const adjustable = deck === 'hours' && summary.activeRoles.length > 0;
  return (
    <section aria-label="Decidir" className="room-rise flex flex-col gap-3.5 rounded-[14px] border border-border bg-card p-[18px] shadow-[0_8px_24px_rgba(15,23,42,0.06)] dark:shadow-[0_20px_50px_rgba(0,0,0,0.4)]" style={{ animationDelay: `${REVEAL_DELAY.decision}ms` }}>
      {adjustable && (
        <>
          <h2 className="text-[15px] font-semibold">Horas finais por papel</h2>
          <div className="flex flex-col gap-3">
            {summary.activeRoles.map(role => {
              const suggested = summary.byRole[role]!.resultValue;
              return <Stepper key={role} role={role} suggested={suggested} value={adjusted[role] ?? suggested} onChange={(v) => onAdjust(role, v)} />;
            })}
          </div>
        </>
      )}

      {decisionNote && (
        <div className="flex flex-col gap-1.5">
          <label htmlFor="decision-note" className="text-[13px] font-semibold">Nota de decisão <span className="font-normal text-muted-foreground">· por que essa estimativa?</span></label>
          <textarea
            id="decision-note"
            key={decisionNote.key}
            defaultValue={decisionNote.value}
            onBlur={(e) => decisionNote.onSave(e.target.value)}
            placeholder="Ex.: alto por depender de integração externa ainda instável"
            className={cn(FIELD, 'min-h-[72px] resize-none py-2.5')}
          />
        </div>
      )}

      <div className="flex flex-wrap items-center justify-end gap-2 pt-1">
        <div className="inline-flex overflow-hidden rounded-[10px] border border-border">
          <button
            type="button"
            onClick={onClear}
            className={cn('inline-flex h-10 items-center gap-2 px-4 text-sm font-medium hover:bg-accent', FOCUS_RING)}
          >
            <RotateCcw className="h-4 w-4" strokeWidth={1.5} aria-hidden="true" /> Revotar
          </button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button type="button" aria-label="Revotar só um papel" className={cn('flex h-10 w-9 items-center justify-center border-l border-border hover:bg-accent', FOCUS_RING)}>
                <ChevronDown className="h-4 w-4" strokeWidth={1.5} />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel className="text-xs font-semibold text-muted-foreground">Revotar só um papel</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {presentCategories.length === 0 && <div className="px-2 py-2 text-xs text-muted-foreground">Nenhum papel técnico presente</div>}
              {presentCategories.map(cat => (
                <DropdownMenuItem key={cat} onClick={() => onSelectiveRevote?.(cat)} className="gap-2">
                  {cat === 'Developer' ? <Code className="h-4 w-4" strokeWidth={1.5} /> : <Users className="h-4 w-4" strokeWidth={1.5} />}
                  Apenas {formatRoleForCopy(cat)}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        <ModalButton variant="primary" onClick={onSave} className="gap-2">
          <CheckCircle2 className="h-4 w-4" strokeWidth={1.5} aria-hidden="true" />
          {hasNextPending ? 'Salvar e avançar' : 'Salvar final'}
        </ModalButton>
      </div>
    </section>
  );
}
