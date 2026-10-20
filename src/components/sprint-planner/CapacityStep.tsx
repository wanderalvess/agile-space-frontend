'use client';

import { Info } from 'lucide-react';
import { PAGE_CARD } from '@/components/page';
import { cn } from '@/lib/utils';
import type { AbsenceRequest, AbsenceView, CapacityUpdateRequest, Holiday, PatchPlanRequest, PlanView } from '@/lib/sprint-planner/api';
import { formatHours } from '@/lib/sprint-planner/format';
import { AbsencesPanel } from './AbsencesPanel';
import { CapacityTable } from './CapacityTable';
import { CapacityThermometer } from './CapacityThermometer';
import { HolidaysPanel } from './HolidaysPanel';
import { ReserveSettings } from './ReserveSettings';
import { SubtaskTypesSection } from './SubtaskTypesSection';

function Card({ title, description, children, className, id }: { title: string; description?: string; children: React.ReactNode; className?: string; id: string }) {
  return (
    <section aria-labelledby={id} className={cn(PAGE_CARD, 'flex min-w-0 flex-col gap-3 p-4 sm:p-5', className)}>
      <header className="flex flex-col gap-0.5">
        <h2 id={id} className="text-base font-bold text-foreground">{title}</h2>
        {description && <p className="text-[13px] text-muted-foreground">{description}</p>}
      </header>
      {children}
    </section>
  );
}

export interface CapacityStepProps {
  plan: PlanView;
  onUpdatePerson: (accountId: string, body: CapacityUpdateRequest) => void;
  onPatch: (body: Omit<PatchPlanRequest, 'version'>) => void;
  onAddAbsence: (body: AbsenceRequest) => Promise<boolean>;
  onRemoveAbsence: (a: AbsenceView) => void;
  onReplaceHolidays: (next: Holiday[]) => void;
}

/** Etapa 1: capacidade por pessoa, reserva, termômetro, ausências, feriados e tipos de subtarefa. */
export function CapacityStep({ plan, onUpdatePerson, onPatch, onAddAbsence, onRemoveAbsence, onReplaceHolidays }: CapacityStepProps) {
  const canEdit = plan.permissions.canEditPlan;
  const people = plan.capacity.people;
  const dev = plan.capacity.byClass?.DEV ?? 0;
  const qa = plan.capacity.byClass?.QA ?? 0;
  const count = (papel: string) => people.filter((p) => p.included && p.papel === papel).length;
  const formula =
    plan.reserve.mode === 'FOCO'
      ? '(dias cod./teste + dias regressivo) × horas por dia − feriados − ausências, × fator de foco'
      : '(dias cod./teste + dias regressivo) × horas por dia − feriados − ausências';

  return (
    <div className="flex flex-col gap-5">
      {!canEdit && (
        <p className="flex items-start gap-2 rounded-[10px] bg-muted px-4 py-3 text-[13px] text-muted-foreground" role="note">
          <Info aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0" strokeWidth={1.5} />
          Só a liderança da squad monta a capacidade. Você vê como ficou a sua.
        </p>
      )}

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
        <Card id="cap-pessoas" title="Capacidade por pessoa" description={formula} className="p-0 sm:p-0 [&>header]:px-4 [&>header]:pt-4 sm:[&>header]:px-5 sm:[&>header]:pt-5">
          <CapacityTable people={people} mode={plan.reserve.mode} canEdit={canEdit} onUpdate={onUpdatePerson} />
          <div className="grid grid-cols-2 gap-3 border-t border-border px-4 py-3 sm:px-5">
            <div data-testid="total-DEV">
              <span className="block text-xs font-semibold text-muted-foreground">Total DEV · {count('DEV')} {count('DEV') === 1 ? 'pessoa' : 'pessoas'}</span>
              <strong className="text-lg tabular-nums text-foreground">{formatHours(dev)}</strong>
            </div>
            <div data-testid="total-QA">
              <span className="block text-xs font-semibold text-muted-foreground">Total QA · {count('QA')} {count('QA') === 1 ? 'pessoa' : 'pessoas'}</span>
              <strong className="text-lg tabular-nums text-foreground">{formatHours(qa)}</strong>
            </div>
          </div>
        </Card>

        <div className="flex min-w-0 flex-col gap-5">
          <Card id="cap-termometro" title="Termômetro de carga">
            <CapacityThermometer thermometer={plan.thermometer} />
          </Card>
          <Card id="cap-reserva" title="Reserva" description="Horas que não entram no escopo: gestão, reuniões, defeitos e imprevistos.">
            <ReserveSettings reserve={plan.reserve} canEdit={canEdit} onPatch={onPatch} />
          </Card>
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,380px)]">
        <Card id="cap-ausencias" title="Ausências e folgas" description="Cada pessoa combina com o PL; o PL lança aqui. Feriados já saem dos dias úteis de todos.">
          <AbsencesPanel
            absences={plan.absences}
            holidays={plan.holidays}
            people={people}
            sprint={plan.sprint}
            canEdit={canEdit}
            onAdd={onAddAbsence}
            onRemove={onRemoveAbsence}
          />
        </Card>
        <Card id="cap-feriados" title="Feriados da sprint">
          <HolidaysPanel holidays={plan.holidays} sprint={plan.sprint} canEdit={canEdit} onReplace={onReplaceHolidays} />
        </Card>
      </div>

      <Card id="cap-tipos" title="Tipos de subtarefa da squad" description="A classe vem do tipo no Jira, não do título.">
        <SubtaskTypesSection squadId={plan.squadId} sprintKey={plan.sprint.sprintKey} canEdit={plan.permissions.canEditTypes} />
      </Card>
    </div>
  );
}
