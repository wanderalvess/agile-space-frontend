'use client';

import { ChevronDown, Code, Minus, Plus, RotateCcw, Users } from 'lucide-react';
import type { DeckType } from '@/lib/types';
import { formatRoleForCopy } from '@/lib/poker-utils';
import type { RoundSummary } from '@/lib/poker-results';
import { cn } from '@/lib/utils';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { FIELD, FOCUS_RING, RoleChip } from '@/components/room-kit';
import { CopyEstimateButton } from './Results';

interface DecisionBarProps {
  deck: DeckType;
  summary: RoundSummary;
  /** Quem decide (facilitador) vê os ajustes e o revotar; os outros veem só o resultado e o copiar. */
  canDecide: boolean;
  /** Ajustes do facilitador por papel (horas). Vale no lugar da média ao salvar e copiar. */
  adjusted: Record<string, string>;
  onAdjust: (role: string, value: string) => void;
  /** Papéis técnicos presentes na sala (revotação parcial). */
  presentCategories: readonly string[];
  onClear: () => void;
  onSelectiveRevote?: (category: string) => void;
  /** Nota de decisão ("por que essa estimativa?") — só quando a sala liga. */
  decisionNote?: { key: string; value: string; onSave: (note: string) => void } | null;
  /** "Enviar ao Jira ao salvar": só aparece para tarefa com chave do Jira. */
  jiraOnSave?: { checked: boolean; onChange: (checked: boolean) => void } | null;
}

/** Mesma faixa do baralho: encostada nas bordas, separada do miolo por um filete. */
const BAR = 'border-t border-border bg-card px-3 pb-[max(0.625rem,env(safe-area-inset-bottom))] pt-2.5 sm:px-5 shadow-[0_-8px_24px_rgba(15,23,42,0.05)] dark:shadow-[0_-8px_24px_rgba(0,0,0,0.3)]';

function Stepper({ role, value, suggested, onChange }: { role: string; value: string; suggested: string; onChange: (v: string) => void }) {
  const n = Number(value);
  const label = formatRoleForCopy(role);
  const set = (next: number) => onChange(String(Math.max(0, next)));
  return (
    <div className="flex items-center gap-2.5">
      <RoleChip category={role} label={label} />
      <span className="whitespace-nowrap text-xs text-muted-foreground">sugerido {suggested}h</span>
      <div className="flex h-9 items-center overflow-hidden rounded-[10px] border border-border">
        <button type="button" aria-label={`Diminuir horas do ${label}`} onClick={() => set((isNaN(n) ? 0 : n) - 1)} className={cn('flex h-9 w-8 items-center justify-center hover:bg-accent', FOCUS_RING)}>
          <Minus className="h-4 w-4" strokeWidth={1.5} />
        </button>
        <span className="flex h-9 w-14 items-center justify-center border-x border-border bg-background text-[15px] font-bold tabular-nums" aria-live="polite" aria-label={`Horas finais do ${label}: ${value}`}>{value}h</span>
        <button type="button" aria-label={`Aumentar horas do ${label}`} onClick={() => set((isNaN(n) ? 0 : n) + 1)} className={cn('flex h-9 w-8 items-center justify-center hover:bg-accent', FOCUS_RING)}>
          <Plus className="h-4 w-4" strokeWidth={1.5} />
        </button>
      </div>
    </div>
  );
}

/**
 * Faixa de decisão da rodada revelada, no lugar do baralho: horas finais por papel, revotar (todos ou só um
 * papel), copiar "(DEV 10h / QA 4h)" e "Enviar ao Jira ao salvar". Salvar fica no topo, como ação principal.
 */
export function DecisionBar({ deck, summary, canDecide, adjusted, onAdjust, presentCategories, onClear, onSelectiveRevote, decisionNote, jiraOnSave }: DecisionBarProps) {
  const adjustable = canDecide && deck === 'hours' && summary.activeRoles.length > 0;
  const values = deck === 'hours' ? adjusted : undefined;
  return (
    <section aria-label="Decidir a estimativa" className={cn(BAR, 'flex flex-col gap-2.5')}>
      <div className="mx-auto flex w-full max-w-[1500px] flex-wrap items-center gap-x-5 gap-y-2.5">
        <h2 className="m-0 whitespace-nowrap text-sm font-semibold">{adjustable ? 'Horas finais' : 'Resultado'}</h2>
        {adjustable ? (
          summary.activeRoles.map(role => {
            const suggested = summary.byRole[role]!.resultValue;
            return <Stepper key={role} role={role} suggested={suggested} value={adjusted[role] ?? suggested} onChange={(v) => onAdjust(role, v)} />;
          })
        ) : !canDecide ? (
          <span className="text-xs text-muted-foreground">Quem facilita decide as horas finais e salva.</span>
        ) : null}

        <span className="flex-1" />

        {canDecide && (
          <div className="inline-flex overflow-hidden rounded-[10px] border border-border">
            <button type="button" onClick={onClear} className={cn('inline-flex h-9 items-center gap-2 px-3 text-sm font-medium hover:bg-accent max-sm:h-11', FOCUS_RING)}>
              <RotateCcw className="h-4 w-4" strokeWidth={1.5} aria-hidden="true" /> Revotar
            </button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button type="button" aria-label="Revotar só um papel" className={cn('flex h-9 w-8 items-center justify-center border-l border-border hover:bg-accent max-sm:h-11', FOCUS_RING)}>
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
        )}

        {summary.activeRoles.length > 0 && <CopyEstimateButton summary={summary} deck={deck} values={values} />}

        {canDecide && jiraOnSave && (
          <label className={cn('inline-flex h-9 cursor-pointer items-center gap-2 whitespace-nowrap rounded-[10px] border border-border px-3 text-sm font-medium max-sm:h-11', 'has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring')}>
            <input
              type="checkbox"
              checked={jiraOnSave.checked}
              onChange={(e) => jiraOnSave.onChange(e.target.checked)}
              className="h-4 w-4 accent-[hsl(var(--primary))]"
            />
            Enviar ao Jira ao salvar
          </label>
        )}
      </div>

      {canDecide && decisionNote && (
        <div className="mx-auto flex w-full max-w-[1500px] items-center gap-3">
          <label htmlFor="decision-note" className="whitespace-nowrap text-[13px] font-semibold">Nota de decisão</label>
          <input
            id="decision-note"
            key={decisionNote.key}
            defaultValue={decisionNote.value}
            onBlur={(e) => decisionNote.onSave(e.target.value)}
            placeholder="Por que essa estimativa? Ex.: depende de integração externa ainda instável"
            className={cn(FIELD, 'h-9 flex-1')}
          />
        </div>
      )}
    </section>
  );
}
