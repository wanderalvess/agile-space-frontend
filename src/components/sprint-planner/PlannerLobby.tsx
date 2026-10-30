'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { CalendarDays, CalendarPlus, ChevronRight, Trash2, Users } from 'lucide-react';
import { EmptyState, ErrorState, LoadingSkeleton, PAGE_CARD, PageHeader } from '@/components/page';
import { moduleLabel } from '@/lib/modules-registry';
import { ConfirmDialog, FOCUS_RING, IconButton, ModalButton, StatusChip } from '@/components/room-kit';
import { useToast } from '@/hooks/use-toast';
import { errorMessage } from '@/lib/ceremony-api';
import { cn } from '@/lib/utils';
import { sprintPlanApi, type PlanSummary } from '@/lib/sprint-planner/api';
import { STATUS_LABEL, STATUS_TONE, canDeleteStatus, formatHours, formatRange } from '@/lib/sprint-planner/format';

type Load = { state: 'loading' } | { state: 'error' } | { state: 'ok'; plans: PlanSummary[] };

export interface PlannerLobbyProps {
  squadId: string;
  /** Liderança da squad (ou admin): cria e exclui. Os demais só leem. O backend confere de novo. */
  canCreate: boolean;
  /** Abre o diálogo de criação (injetado para não acoplar o lobby ao formulário). */
  onCreate: () => void;
  /** Muda quando um plano é criado, para recarregar a lista. */
  reloadKey?: number;
}

function TotalsLine({ label, cap, plan }: { label: string; cap: number; plan: number }) {
  return (
    <div className="flex min-w-0 flex-col gap-0.5">
      <span className="text-xs font-semibold text-muted-foreground">{label}</span>
      <span className="text-sm font-semibold tabular-nums text-foreground">
        {formatHours(plan)} <span className="font-normal text-muted-foreground">de {formatHours(cap)}</span>
      </span>
    </div>
  );
}

/** Lista de planejamentos da squad ativa (board "Planejamento da sprint — lista"). */
export function PlannerLobby({ squadId, canCreate, onCreate, reloadKey = 0 }: PlannerLobbyProps) {
  const [load, setLoad] = useState<Load>({ state: 'loading' });
  const [toDelete, setToDelete] = useState<PlanSummary | null>(null);
  const [deleting, setDeleting] = useState(false);
  const { toast } = useToast();

  const fetchPlans = useCallback(async () => {
    setLoad({ state: 'loading' });
    try {
      const plans = await sprintPlanApi.list(squadId);
      setLoad({ state: 'ok', plans });
    } catch {
      setLoad({ state: 'error' });
    }
  }, [squadId]);

  useEffect(() => {
    void fetchPlans();
  }, [fetchPlans, reloadKey]);

  const confirmDelete = async () => {
    if (!toDelete) return;
    setDeleting(true);
    try {
      await sprintPlanApi.remove(squadId, toDelete.id);
      toast({ title: 'Planejamento excluído' });
      setToDelete(null);
      void fetchPlans();
    } catch (e) {
      toast({ title: 'Não foi possível excluir', description: errorMessage(e, 'Tente de novo.'), variant: 'destructive' });
    } finally {
      setDeleting(false);
    }
  };

  const createButton = canCreate ? (
    <ModalButton variant="primary" onClick={onCreate}>
      <CalendarPlus aria-hidden="true" className="h-4 w-4" strokeWidth={1.5} /> Planejar a próxima sprint
    </ModalButton>
  ) : null;

  let body: React.ReactNode;
  if (load.state === 'loading') {
    body = <LoadingSkeleton variant="cards" rows={3} label="Carregando planejamentos" />;
  } else if (load.state === 'error') {
    body = <ErrorState title="Não foi possível carregar os planejamentos" onRetry={() => void fetchPlans()} />;
  } else if (load.plans.length === 0) {
    body = (
      <EmptyState
        icon={CalendarDays}
        title="Nenhum planejamento ainda"
        description={
          canCreate
            ? 'Comece pela capacidade do time: dias, horas por dia e ausências de cada pessoa. Depois você escolhe as tarefas já refinadas.'
            : 'A liderança da squad ainda não começou o planejamento da próxima sprint. Quando começar, ele aparece aqui.'
        }
        actions={createButton}
      />
    );
  } else {
    body = (
      <section aria-labelledby="planos-titulo" className="flex flex-col gap-3">
        <h2 id="planos-titulo" className="flex items-baseline gap-2 text-base font-bold text-foreground">
          Planejamentos <span className="text-[13px] font-medium text-muted-foreground">{load.plans.length} {load.plans.length === 1 ? 'sprint' : 'sprints'}</span>
        </h2>
        <ul className="flex flex-col gap-3">
          {load.plans.map((p) => (
            <li key={p.id} className={cn(PAGE_CARD, 'flex flex-wrap items-center gap-x-6 gap-y-3 p-4 sm:p-5')}>
              <div className="flex min-w-0 flex-1 basis-[220px] flex-col gap-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="truncate text-[15px] font-bold text-foreground">{p.sprintName}</span>
                  <StatusChip tone={STATUS_TONE[p.status]}>{STATUS_LABEL[p.status]}</StatusChip>
                </div>
                <span className="text-[13px] text-muted-foreground">{formatRange(p.startDate, p.endDate)}</span>
              </div>
              <div className="flex gap-6">
                <TotalsLine label="DEV" cap={p.totals?.capDev ?? 0} plan={p.totals?.planDev ?? 0} />
                <TotalsLine label="QA" cap={p.totals?.capQa ?? 0} plan={p.totals?.planQa ?? 0} />
              </div>
              <div className="ml-auto flex items-center gap-2">
                {canCreate && canDeleteStatus(p.status) && (
                  <IconButton label={`Excluir o planejamento ${p.sprintName}`} icon={Trash2} onClick={() => setToDelete(p)} />
                )}
                <Link
                  href={`/sprint-planner/${encodeURIComponent(p.id)}`}
                  className={cn(
                    'inline-flex h-10 items-center gap-1.5 rounded-[10px] border border-border px-4 text-sm font-semibold text-foreground hover:bg-accent',
                    FOCUS_RING,
                  )}
                >
                  Abrir <ChevronRight aria-hidden="true" className="h-4 w-4" strokeWidth={1.5} />
                </Link>
              </div>
            </li>
          ))}
        </ul>
      </section>
    );
  }

  return (
    <>
      <PageHeader
        title={moduleLabel('sprint-planner')}
        module="sprint-planner"
        subtitle="Capacidade do time, escopo da sprint e quem faz o quê, antes de iniciar a sprint no Jira."
        actions={load.state === 'ok' && load.plans.length > 0 ? createButton : null}
      />
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="min-w-0">{body}</div>
        <aside className={cn(PAGE_CARD, 'flex h-fit flex-col gap-3 p-5')} aria-labelledby="como-funciona">
          <h2 id="como-funciona" className="text-base font-bold text-foreground">Como funciona</h2>
          <ol className="flex flex-col gap-2 text-[13px] leading-relaxed text-muted-foreground">
            <li><strong className="text-foreground">Capacidade</strong> · a liderança confere as horas DEV e QA de cada pessoa.</li>
            <li><strong className="text-foreground">Escopo</strong> · escolhe as tarefas refinadas até perto da capacidade e apresenta ao time.</li>
            <li><strong className="text-foreground">Distribuição</strong> · cada pessoa pega as suas subtarefas e marca as datas.</li>
            <li><strong className="text-foreground">Revisar e enviar</strong> · confere pendências e grava no Jira.</li>
          </ol>
          <p className="flex items-start gap-2 border-t border-border pt-3 text-[13px] text-muted-foreground">
            <Users aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0" strokeWidth={1.5} />
            {canCreate
              ? 'Você está na liderança da squad: pode criar e editar os planejamentos.'
              : 'Quem monta é a liderança da squad. Você acompanha em leitura.'}
          </p>
        </aside>
      </div>
      <ConfirmDialog
        open={!!toDelete}
        onOpenChange={(o) => { if (!o) setToDelete(null); }}
        tone="danger"
        icon={Trash2}
        title="Excluir este planejamento?"
        description={toDelete ? `${toDelete.sprintName}: a capacidade, as ausências e os feriados lançados serão apagados.` : undefined}
        confirmLabel="Excluir"
        loading={deleting}
        loadingLabel="Excluindo…"
        keepOpenOnConfirm
        onConfirm={() => void confirmDelete()}
      />
    </>
  );
}
