'use client';

import { useCallback, useEffect, useState } from 'react';
import { ArrowLeft, ArrowRight, Hourglass } from 'lucide-react';
import { EmptyState, ErrorState, LoadingSkeleton, PageHeader } from '@/components/page';
import { ModalButton, PhaseStepper, StatusChip, TabBar } from '@/components/room-kit';
import { useToast } from '@/hooks/use-toast';
import { errorMessage } from '@/lib/ceremony-api';
import {
  isConflict,
  sprintPlanApi,
  statusOf,
  type AbsenceRequest,
  type AbsenceView,
  type CapacityUpdateRequest,
  type Holiday,
  type PatchPlanRequest,
  type PlanStatus,
  type PlanView,
} from '@/lib/sprint-planner/api';
import {
  PLAN_STEPS,
  STATUS_LABEL,
  STATUS_TONE,
  formatRange,
  formatWorkingDays,
  nextStatus,
  previousStatus,
  stepOfStatus,
  type StepId,
} from '@/lib/sprint-planner/format';
import { canAdvanceFromScope } from '@/lib/sprint-planner/scope';
import { CapacityStep } from './CapacityStep';
import { ScopeStep } from './ScopeStep';

type Load = { state: 'loading' } | { state: 'error'; notFound: boolean } | { state: 'ok'; plan: PlanView };

export const CONFLICT_MESSAGE = 'Outra pessoa alterou este planejamento. Recarregamos a versão atual: confira e refaça a sua mudança.';

const PLACEHOLDER: Record<Exclude<StepId, 'capacidade' | 'escopo'>, { title: string; description: string }> = {
  distribuicao: {
    title: 'Distribuição chega numa próxima entrega',
    description: 'Aqui cada pessoa vai pegar as próprias subtarefas e marcar as datas; o QA começa quando o Code Review DEV termina.',
  },
  revisao: {
    title: 'Revisar e enviar chega numa próxima entrega',
    description: 'Aqui vai aparecer o resumo, as pendências e a prévia do que seria gravado no Jira. O envio ao Jira ainda não está disponível.',
  },
};

/** Tela do plano: cabeçalho, as 4 etapas (Capacidade e Escopo funcionais) e o tratamento de conflito 409. */
export function PlanScreen({
  squadId,
  planId,
  step,
  onStepChange,
}: {
  squadId: string;
  planId: string;
  step: StepId;
  onStepChange: (step: StepId) => void;
}) {
  const [load, setLoad] = useState<Load>({ state: 'loading' });
  const [changingStatus, setChangingStatus] = useState(false);
  const { toast } = useToast();

  const reload = useCallback(async (quiet = false) => {
    if (!quiet) setLoad({ state: 'loading' });
    try {
      const plan = await sprintPlanApi.get(squadId, planId);
      setLoad({ state: 'ok', plan });
    } catch (e) {
      const s = statusOf(e);
      setLoad({ state: 'error', notFound: s === 404 || s === 403 });
    }
  }, [squadId, planId]);

  useEffect(() => { void reload(); }, [reload]);

  const plan = load.state === 'ok' ? load.plan : null;

  /** Executa uma escrita; 409 recarrega e avisa; outro erro mostra a mensagem do servidor. */
  const run = useCallback(
    async <T,>(fn: () => Promise<T>, fail: string): Promise<T | undefined> => {
      try {
        return await fn();
      } catch (e) {
        if (isConflict(e)) {
          toast({ title: 'O planejamento mudou', description: CONFLICT_MESSAGE, variant: 'destructive' });
          await reload(true);
        } else {
          toast({ title: fail, description: errorMessage(e, 'Tente de novo.'), variant: 'destructive' });
        }
        return undefined;
      }
    },
    [reload, toast],
  );

  if (load.state === 'loading') return <LoadingSkeleton variant="page" label="Carregando o planejamento" />;
  if (load.state === 'error' || !plan) {
    return load.state === 'error' && load.notFound ? (
      <EmptyState title="Planejamento não encontrado" description="Ele pode ter sido excluído ou ser de outra squad. Volte para a lista de planejamentos." />
    ) : (
      <ErrorState title="Não foi possível carregar o planejamento" onRetry={() => void reload()} />
    );
  }

  const canEdit = plan.permissions.canEditPlan;
  const next = nextStatus(plan.status);
  const prev = previousStatus(plan.status);
  const workingDays = plan.capacity.workingDays;

  const onPatch = (body: Omit<PatchPlanRequest, 'version'>) =>
    void run(async () => {
      const updated = await sprintPlanApi.patch(squadId, planId, { ...body, version: plan.version });
      setLoad({ state: 'ok', plan: updated });
    }, 'Não foi possível salvar');

  const onUpdatePerson = (accountId: string, body: CapacityUpdateRequest) =>
    void run(async () => {
      await sprintPlanApi.updatePerson(squadId, planId, accountId, body);
      await reload(true);
    }, 'Não foi possível salvar a capacidade');

  const onAddAbsence = async (body: AbsenceRequest) => {
    const ok = await run(async () => {
      await sprintPlanApi.addAbsence(squadId, planId, body);
      await reload(true);
      return true;
    }, 'Não foi possível lançar a ausência');
    return ok === true;
  };

  const onRemoveAbsence = (a: AbsenceView) =>
    void run(async () => {
      await sprintPlanApi.deleteAbsence(squadId, planId, a.id);
      await reload(true);
    }, 'Não foi possível remover a ausência');

  const onReplaceHolidays = (list: Holiday[]) =>
    void run(async () => {
      await sprintPlanApi.replaceHolidays(squadId, planId, list);
      await reload(true);
    }, 'Não foi possível salvar os feriados');

  const openTypes = () => {
    onStepChange('capacidade');
    setTimeout(() => document.getElementById('cap-tipos')?.scrollIntoView({ block: 'start' }), 150);
  };

  const changeStatus = async (to: PlanStatus) => {
    // O escopo precisa de pelo menos uma tarefa para seguir (o backend também exige e responde 422).
    if (plan.status === 'ESCOPO' && to === 'DISTRIBUICAO' && !canAdvanceFromScope(plan)) {
      toast({ title: 'O escopo está vazio', description: 'Adicione pelo menos uma tarefa ao escopo para avançar para a Distribuição.', variant: 'destructive' });
      return;
    }
    setChangingStatus(true);
    const updated = await run(() => sprintPlanApi.changeStatus(squadId, planId, plan.version, to), 'Não foi possível mudar a etapa');
    setChangingStatus(false);
    if (updated) {
      setLoad({ state: 'ok', plan: updated });
      onStepChange(stepOfStatus(updated.status));
    }
  };

  return (
    <>
      <PageHeader
        title={plan.sprint.name}
        breadcrumb={[{ label: 'Planejamento', href: '/sprint-planner' }, { label: plan.sprint.name }]}
        module="sprint-planner"
        badges={<StatusChip tone={STATUS_TONE[plan.status]}>{STATUS_LABEL[plan.status]}</StatusChip>}
        subtitle={
          <>
            {formatRange(plan.sprint.startDate, plan.sprint.endDate)} · {formatWorkingDays(workingDays)}
            {plan.holidays.length > 0 && ` (${plan.holidays.length === 1 ? '1 feriado' : `${plan.holidays.length} feriados`})`}
            {plan.goal ? <span className="block">Meta: {plan.goal}</span> : null}
            <span className="block text-xs">{plan.syncedAt ? `Jira sincronizado em ${plan.syncedAt}` : 'Backlog do Jira ainda não sincronizado para este plano.'}</span>
          </>
        }
        actions={
          canEdit ? (
            <div className="flex flex-wrap gap-2">
              {prev && (
                <ModalButton onClick={() => void changeStatus(prev)} disabled={changingStatus}>
                  <ArrowLeft aria-hidden="true" className="h-4 w-4" strokeWidth={1.5} /> Voltar para {STATUS_LABEL[prev].toLowerCase()}
                </ModalButton>
              )}
              {next && (
                <ModalButton variant="primary" onClick={() => void changeStatus(next)} disabled={changingStatus}>
                  Avançar para {STATUS_LABEL[next].toLowerCase()} <ArrowRight aria-hidden="true" className="h-4 w-4" strokeWidth={1.5} />
                </ModalButton>
              )}
            </div>
          ) : null
        }
      />

      <div className="flex flex-col gap-3">
        <PhaseStepper steps={PLAN_STEPS} current={stepOfStatus(plan.status)} label="Etapa do planejamento" collapseBelow="lg" className="w-fit max-w-full" />
        <TabBar
          tabs={PLAN_STEPS}
          value={step}
          onChange={onStepChange}
          label="Ver etapa"
          idPrefix="etapa"
          className="overflow-x-auto px-0"
          tabClassName="shrink-0 whitespace-nowrap"
        />
      </div>

      <div role="tabpanel" id={`etapa-panel-${step}`} aria-labelledby={`etapa-tab-${step}`}>
        {step === 'capacidade' ? (
          <CapacityStep
            plan={plan}
            onUpdatePerson={onUpdatePerson}
            onPatch={onPatch}
            onAddAbsence={onAddAbsence}
            onRemoveAbsence={onRemoveAbsence}
            onReplaceHolidays={onReplaceHolidays}
          />
        ) : step === 'escopo' ? (
          <ScopeStep
            plan={plan}
            onPlan={(p) => setLoad({ state: 'ok', plan: p })}
            onReload={() => reload(true)}
            onPatch={onPatch}
            onOpenTypes={openTypes}
          />
        ) : (
          <EmptyState icon={Hourglass} title={PLACEHOLDER[step].title} description={PLACEHOLDER[step].description} />
        )}
      </div>
    </>
  );
}
