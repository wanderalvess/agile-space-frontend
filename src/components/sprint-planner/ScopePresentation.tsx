'use client';

import { useEffect, useState } from 'react';
import { LayoutGrid, List, RotateCcw } from 'lucide-react';
import { FOCUS_RING, PresentationBar, StatusChip } from '@/components/room-kit';
import { cn } from '@/lib/utils';
import type { PlanView, Thermometer } from '@/lib/sprint-planner/api';
import { formatHours, formatRange, formatWorkingDays } from '@/lib/sprint-planner/format';
import { scopeTotals, type ScopeEntry } from '@/lib/sprint-planner/scope';
import { ScopeBars } from './ScopeBars';
import { HoursChips } from './ScopeTaskCard';

type Layout = 'grade' | 'lista';

/**
 * Modo reunião: a mesma informação do Escopo, grande e sem nenhum controle de edição (sem adicionar, remover,
 * sincronizar ou salvar). Cobre a tela inteira; Esc ou o botão da barra saem.
 */
export function ScopePresentation({
  plan,
  entries,
  thermometer,
  syncedLabel,
  onExit,
}: {
  plan: PlanView;
  entries: ScopeEntry[];
  thermometer: Record<string, Thermometer>;
  syncedLabel: string | null;
  onExit: () => void;
}) {
  const [layout, setLayout] = useState<Layout>('grade');
  const totals = scopeTotals(entries);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onExit(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onExit]);

  return (
    <div role="dialog" aria-label="Modo reunião: escopo da sprint" className="fixed inset-0 z-50 flex flex-col overflow-y-auto bg-background text-foreground" data-testid="modo-reuniao">
      <PresentationBar title={`Planejamento · ${plan.sprint.name}`} onExit={onExit}>
        {syncedLabel && <span className="text-sm text-muted-foreground">Jira sincronizado {syncedLabel}</span>}
        <div role="group" aria-label="Como mostrar o escopo" className="flex gap-1">
          {([['grade', 'Grade', LayoutGrid], ['lista', 'Lista', List]] as const).map(([id, label, Icon]) => (
            <button
              key={id}
              type="button"
              aria-pressed={layout === id}
              onClick={() => setLayout(id)}
              className={cn(
                'inline-flex h-9 items-center gap-1.5 rounded-lg border px-3 text-sm font-medium max-sm:h-11',
                layout === id ? 'border-primary/60 bg-primary/10 text-foreground' : 'border-border text-muted-foreground hover:bg-accent',
                FOCUS_RING,
              )}
            >
              <Icon aria-hidden="true" className="h-4 w-4" strokeWidth={1.5} /> {label}
            </button>
          ))}
        </div>
      </PresentationBar>

      <main className="mx-auto flex w-full max-w-[1400px] flex-col gap-6 px-4 py-6 md:px-8">
        <section aria-labelledby="pres-meta" className="flex flex-col gap-2">
          <p className="text-sm text-muted-foreground">
            {plan.sprint.name} · {formatRange(plan.sprint.startDate, plan.sprint.endDate)} · {formatWorkingDays(plan.capacity.workingDays)}
          </p>
          <h2 id="pres-meta" className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Meta da sprint (Sprint goal do Jira)</h2>
          <p className="text-2xl font-bold leading-snug md:text-3xl" data-testid="pres-meta-texto">{plan.goal?.trim() ? plan.goal : 'A meta ainda não foi definida.'}</p>
        </section>

        <section aria-label="Números do escopo" className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <div className="rounded-[12px] border border-border bg-card p-4">
            <span className="block text-xs font-semibold text-muted-foreground">Tarefas no escopo</span>
            <strong className="text-3xl tabular-nums" data-testid="pres-total-tarefas">{entries.length}</strong>
          </div>
          <div className="rounded-[12px] border border-border bg-card p-4">
            <span className="block text-xs font-semibold text-muted-foreground">Horas DEV</span>
            <strong className="text-3xl tabular-nums" data-testid="pres-total-DEV">{formatHours(totals.DEV)}</strong>
          </div>
          <div className="rounded-[12px] border border-border bg-card p-4">
            <span className="block text-xs font-semibold text-muted-foreground">Horas QA</span>
            <strong className="text-3xl tabular-nums" data-testid="pres-total-QA">{formatHours(totals.QA)}</strong>
          </div>
        </section>

        <section aria-label="Capacidade" className="rounded-[12px] border border-border bg-card p-4 md:p-5">
          <ScopeBars thermometer={thermometer} />
        </section>

        <section aria-label="Tarefas do escopo">
          {entries.length === 0 ? (
            <p className="rounded-[12px] border border-dashed border-border p-6 text-center text-base text-muted-foreground">Nenhuma tarefa no escopo ainda.</p>
          ) : (
            <ul className={cn('grid gap-3', layout === 'grade' ? 'sm:grid-cols-2 xl:grid-cols-3' : 'grid-cols-1')} data-testid="pres-itens">
              {entries.map((e) => (
                <li key={e.key} className="flex flex-col gap-2 rounded-[12px] border border-border bg-card p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-mono text-sm font-semibold text-muted-foreground">{e.key}</span>
                    <HoursChips dev={e.dev} qa={e.qa} />
                  </div>
                  <p className="text-base font-medium [overflow-wrap:anywhere]">{e.title ?? 'Sem título'}</p>
                  {e.carryOver && (
                    <StatusChip tone="warn" className="w-fit"><RotateCcw aria-hidden="true" className="h-3 w-3" strokeWidth={1.5} /> Sobra da anterior</StatusChip>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>

        <p className="text-sm text-muted-foreground">Próximo passo: cada pessoa pega as suas subtarefas e marca início e fim.</p>
      </main>
    </div>
  );
}
