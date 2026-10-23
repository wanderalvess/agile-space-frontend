'use client';

import { useEffect, useState } from 'react';
import { CalendarPlus, Loader2, Search } from 'lucide-react';
import { FIELD, Modal, ModalButton } from '@/components/room-kit';
import { errorMessage } from '@/lib/ceremony-api';
import { sprintPlanApi, type PlanView } from '@/lib/sprint-planner/api';
import { validatePlanForm } from '@/lib/sprint-planner/format';

const LABEL = 'text-[13px] font-semibold text-foreground';

/** "Planejar a próxima sprint": nome, datas e meta. O backend responde 409 se a sprint já tem plano. */
export function CreatePlanDialog({
  open,
  onOpenChange,
  squadId,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  squadId: string;
  onCreated: (plan: PlanView) => void;
}) {
  const [sprintName, setSprintName] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [goal, setGoal] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [jiraSprintId, setJiraSprintId] = useState<string | null>(null);
  const [fetching, setFetching] = useState(false);
  const [fetchNotice, setFetchNotice] = useState<{ tone: 'info' | 'error'; text: string } | null>(null);

  useEffect(() => {
    if (open) {
      setError(null);
      setFetchNotice(null);
    }
  }, [open]);

  /** Preenche nome, datas e meta com a próxima sprint do Jira e guarda o id; tudo continua editável. */
  const fetchNext = async () => {
    setFetching(true);
    setFetchNotice(null);
    try {
      const next = await sprintPlanApi.nextSprint(squadId);
      if (!next.found) {
        setJiraSprintId(null);
        setFetchNotice({ tone: 'info', text: 'Nenhuma sprint futura encontrada: preencha à mão.' });
        return;
      }
      setJiraSprintId(next.jiraSprintId);
      if (next.name) setSprintName(next.name);
      if (next.startDate) setStartDate(next.startDate.slice(0, 10));
      if (next.endDate) setEndDate(next.endDate.slice(0, 10));
      if (next.goal) setGoal(next.goal);
      setFetchNotice({ tone: 'info', text: 'Dados da próxima sprint do Jira preenchidos. Confira e ajuste se precisar.' });
    } catch (e) {
      setFetchNotice({ tone: 'error', text: errorMessage(e, 'Não foi possível buscar a próxima sprint no Jira. Preencha à mão.') });
    } finally {
      setFetching(false);
    }
  };

  const submit = async () => {
    const invalid = validatePlanForm({ sprintName, startDate, endDate });
    if (invalid) {
      setError(invalid);
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const plan = await sprintPlanApi.create(squadId, {
        jiraSprintId,
        sprintName: sprintName.trim(),
        startDate,
        endDate,
        goal: goal.trim() || null,
      });
      setSprintName('');
      setStartDate('');
      setEndDate('');
      setGoal('');
      setJiraSprintId(null);
      setFetchNotice(null);
      onCreated(plan);
    } catch (e) {
      setError(errorMessage(e, 'Não foi possível criar o planejamento. Tente de novo.'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      icon={CalendarPlus}
      title="Planejar a próxima sprint"
      description="Comece pela capacidade do time. Depois você escolhe as tarefas já refinadas."
      preventClose={saving}
      footer={
        <>
          <ModalButton onClick={() => onOpenChange(false)} disabled={saving}>Cancelar</ModalButton>
          <ModalButton variant="primary" onClick={submit} disabled={saving}>
            {saving ? 'Criando…' : 'Começar pela capacidade'}
          </ModalButton>
        </>
      }
    >
      <form
        className="flex flex-col gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
      >
        <div className="flex flex-wrap items-center gap-2">
          <ModalButton onClick={() => void fetchNext()} disabled={fetching || saving}>
            {fetching ? <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" strokeWidth={1.5} /> : <Search aria-hidden="true" className="h-4 w-4" strokeWidth={1.5} />}
            {fetching ? 'Buscando no Jira…' : 'Buscar a próxima sprint do Jira'}
          </ModalButton>
          {fetchNotice && (
            <p
              role={fetchNotice.tone === 'error' ? 'alert' : 'status'}
              className={fetchNotice.tone === 'error' ? 'min-w-0 flex-1 text-[13px] text-red-700 dark:text-red-300' : 'min-w-0 flex-1 text-[13px] text-muted-foreground'}
              data-testid="proxima-sprint-aviso"
            >
              {fetchNotice.text}
            </p>
          )}
        </div>
        <label className="flex flex-col gap-1.5">
          <span className={LABEL}>Sprint</span>
          <input
            className={`${FIELD} h-10`}
            value={sprintName}
            onChange={(e) => setSprintName(e.target.value)}
            placeholder="Ex.: Sprint 2026.10/2"
            maxLength={255}
            required
          />
        </label>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="flex flex-col gap-1.5">
            <span className={LABEL}>Início</span>
            <input type="date" className={`${FIELD} h-10`} value={startDate} onChange={(e) => setStartDate(e.target.value)} required />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className={LABEL}>Fim</span>
            <input type="date" className={`${FIELD} h-10`} value={endDate} min={startDate || undefined} onChange={(e) => setEndDate(e.target.value)} required />
          </label>
        </div>
        <label className="flex flex-col gap-1.5">
          <span className={LABEL}>Meta da sprint (opcional)</span>
          <textarea
            className={`${FIELD} min-h-[72px] py-2`}
            value={goal}
            onChange={(e) => setGoal(e.target.value)}
            placeholder="O que o time quer entregar nesta sprint"
          />
        </label>
        <p className="text-xs text-muted-foreground">
          A reserva da sprint já vem preenchida com a da última sprint revisada da squad, quando houver.
        </p>
        {error && (
          <p role="alert" className="rounded-[10px] bg-red-500/10 px-3 py-2 text-[13px] text-red-700 dark:text-red-300">
            {error}
          </p>
        )}
        <button type="submit" className="sr-only" tabIndex={-1}>Criar</button>
      </form>
    </Modal>
  );
}
