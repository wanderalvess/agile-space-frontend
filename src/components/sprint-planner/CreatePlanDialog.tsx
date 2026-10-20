'use client';

import { useEffect, useState } from 'react';
import { CalendarPlus } from 'lucide-react';
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

  useEffect(() => {
    if (open) setError(null);
  }, [open]);

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
        sprintName: sprintName.trim(),
        startDate,
        endDate,
        goal: goal.trim() || null,
      });
      setSprintName('');
      setStartDate('');
      setEndDate('');
      setGoal('');
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
