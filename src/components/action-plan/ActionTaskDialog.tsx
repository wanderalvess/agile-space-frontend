'use client';

import React, { useEffect, useRef, useState } from 'react';
import { CalendarDays, ChevronDown, ListChecks, Trash2 } from 'lucide-react';
import { actionPlanApi } from '@/app/action-plan/api';
import { useAuth } from '@/context/AuthContext';
import { errorMessage } from '@/lib/ceremony-api';
import { ConfirmDialog, FIELD, Modal, ModalButton } from '@/components/room-kit';
import { useToast } from '@/hooks/use-toast';
import {
  TASK_STATUSES,
  STATUS_LABEL,
  dateInputToText,
  findPersonByName,
  taskToForm,
  validateTaskForm,
  type PlanPerson,
  type TaskForm,
  type TaskFormErrors,
} from '@/lib/action-plan';
import type { ActionPlanTask } from '@/lib/types';
import { cn } from '@/lib/utils';
import { WhoField } from './WhoField';

interface ActionTaskDialogProps {
  boardId: string;
  task: ActionPlanTask | null;
  isOpen: boolean;
  onClose: () => void;
  totalTasks: number;
  onSaveSuccess?: () => void;
  /** Pessoas da squad do plano, para o campo "Quem". */
  people?: readonly PlanPerson[];
}

const LABEL = 'text-[13px] font-semibold text-foreground';
const HINT = 'text-xs text-muted-foreground';
const ERROR = 'text-xs font-medium text-red-700 dark:text-red-300';

/**
 * Janela da ação 5W2H (nova ou editar): os sete campos, o status (só na edição) e Excluir com confirmação.
 * Erro de campo e falha do servidor ficam na própria janela, com o que foi digitado mantido.
 */
export function ActionTaskDialog({ boardId, task, isOpen, onClose, totalTasks, onSaveSuccess, people = [] }: ActionTaskDialogProps) {
  const { session } = useAuth();
  const { toast } = useToast();
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [form, setForm] = useState<TaskForm>(() => taskToForm(task));
  const [errors, setErrors] = useState<TaskFormErrors>({});
  const [serverError, setServerError] = useState<string | null>(null);
  // No celular os campos de apoio ficam atrás de "Mais campos"; editando uma ação que já os tem, abrem de saída.
  const [showMore, setShowMore] = useState(() => !!task && !!(task.why || task.how || task.where || task.howMuch));
  const dateRef = useRef<HTMLInputElement>(null);
  const whatRef = useRef<HTMLInputElement>(null);

  // Ação nova: o cursor já entra no "O quê" (depois que o modal assume o foco).
  useEffect(() => {
    if (task) return;
    const t = setTimeout(() => whatRef.current?.focus(), 0);
    return () => clearTimeout(t);
  }, [task]);

  const set = <K extends keyof TaskForm>(key: K, value: TaskForm[K]) => {
    setForm((f) => ({ ...f, [key]: value }));
    if (key === 'what' || key === 'who') setErrors((e) => ({ ...e, [key]: undefined }));
  };

  const handleSave = async () => {
    if (!session) return;
    const found = validateTaskForm(form);
    if (found.what || found.who) {
      setErrors(found);
      return;
    }
    setIsSaving(true);
    setServerError(null);
    try {
      if (task) {
        await actionPlanApi.updateTask(task.id, form);
      } else {
        await actionPlanApi.createTask(boardId, { ...form, authorId: session.id, order: totalTasks });
      }
      onSaveSuccess?.();
      onClose();
    } catch (e) {
      console.error('Erro ao salvar tarefa', e);
      // a janela continua aberta com o que foi digitado
      setServerError(errorMessage(e, 'Confira a conexão e tente de novo.'));
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!task) return;
    setIsDeleting(true);
    try {
      await actionPlanApi.deleteTask(task.id);
      onSaveSuccess?.();
      onClose();
    } catch (e) {
      setConfirmDelete(false);
      toast({ title: 'Não foi possível excluir', description: errorMessage(e, 'Não foi possível excluir a ação.'), variant: 'destructive' });
    } finally {
      setIsDeleting(false);
    }
  };

  const picked = findPersonByName(people, form.who);
  const moreOnPhone = showMore ? '' : 'max-md:hidden';

  return (
    <>
      <Modal
        open={isOpen && !confirmDelete}
        onOpenChange={(next) => { if (!next) onClose(); }}
        size="lg"
        icon={ListChecks}
        title={task ? 'Editar ação' : 'Nova ação 5W2H'}
        description="O quê e Quem são obrigatórios na tela; o servidor só exige o quê."
        preventClose={isSaving}
        footerStart={
          task ? (
            <ModalButton variant="ghost" onClick={() => setConfirmDelete(true)} disabled={isSaving || isDeleting} className="gap-2 text-red-700 hover:bg-red-500/10 hover:text-red-700 dark:text-red-300 dark:hover:text-red-300">
              <Trash2 className="h-4 w-4" strokeWidth={1.5} aria-hidden="true" /> Excluir ação
            </ModalButton>
          ) : undefined
        }
        footer={
          <>
            <ModalButton onClick={onClose} disabled={isSaving}>Cancelar</ModalButton>
            <ModalButton variant="primary" onClick={handleSave} disabled={isSaving}>
              {isSaving ? 'Salvando…' : 'Salvar ação'}
            </ModalButton>
          </>
        }
      >
        <form
          className="grid grid-cols-1 gap-4 md:grid-cols-2"
          onSubmit={(e) => { e.preventDefault(); void handleSave(); }}
          noValidate
        >
          {serverError && (
            <div role="alert" className="flex flex-col gap-0.5 rounded-xl border border-red-500/30 bg-red-500/10 px-3.5 py-3 text-sm text-red-700 dark:text-red-300 md:col-span-2">
              <span className="font-semibold">Não foi possível salvar a ação.</span>
              <span>{serverError} O que você digitou foi mantido.</span>
            </div>
          )}

          <div className="flex flex-col gap-1.5 md:col-span-2">
            <label htmlFor="task-what" className={LABEL}>O quê (What) *</label>
            <input
              id="task-what"
              ref={whatRef}
              value={form.what}
              onChange={(e) => set('what', e.target.value)}
              placeholder="Ex.: Criar o endpoint de pagamento"
              aria-invalid={errors.what ? true : undefined}
              aria-describedby={errors.what ? 'task-what-error' : undefined}
              className={cn(FIELD, 'h-11', errors.what && 'border-red-500/70')}
            />
            {errors.what && <span id="task-what-error" role="alert" className={ERROR}>{errors.what}</span>}
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="task-who" className={LABEL}>Quem (Who) *</label>
            <WhoField
              id="task-who"
              value={form.who}
              onChange={(v) => set('who', v)}
              people={people}
              placeholder={people.length > 0 ? 'Escolha ou digite um nome' : 'Ex.: João Silva'}
              invalid={!!errors.who}
              describedBy={errors.who ? 'task-who-error' : 'task-who-hint'}
            />
            {errors.who ? (
              <span id="task-who-error" role="alert" className={ERROR}>{errors.who}</span>
            ) : (
              <span id="task-who-hint" className={HINT}>
                {picked ? `${picked.name} é avisada quando vira responsável.` : 'Se o nome bater com alguém da squad, a pessoa é avisada.'}
              </span>
            )}
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="task-when" className={LABEL}>Quando (When)</label>
            <div className="flex gap-2">
              <input
                id="task-when"
                value={form.when}
                onChange={(e) => set('when', e.target.value)}
                placeholder="Ex.: 15/10 até as 18h"
                aria-describedby="task-when-hint"
                className={cn(FIELD, 'h-11 min-w-0 flex-1')}
              />
              <button
                type="button"
                aria-label="Escolher a data no calendário"
                title="Escolher a data no calendário"
                onClick={() => {
                  const input = dateRef.current;
                  if (!input) return;
                  if (typeof input.showPicker === 'function') {
                    try { input.showPicker(); return; } catch { /* sem gesto do usuário: cai no clique */ }
                  }
                  input.click();
                }}
                className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-[10px] border border-border text-foreground transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <CalendarDays className="h-4 w-4" strokeWidth={1.5} aria-hidden="true" />
              </button>
              <input
                ref={dateRef}
                type="date"
                tabIndex={-1}
                aria-hidden="true"
                className="sr-only"
                onChange={(e) => {
                  const text = dateInputToText(e.target.value);
                  if (text) set('when', text);
                  e.target.value = '';
                }}
              />
            </div>
            <span id="task-when-hint" className={HINT}>Texto livre; o calendário preenche a data.</span>
          </div>

          <button
            type="button"
            aria-expanded={showMore}
            onClick={() => setShowMore((v) => !v)}
            className="inline-flex h-11 items-center justify-between gap-2 rounded-[10px] border border-border px-3.5 text-sm font-semibold text-foreground hover:bg-accent md:hidden"
          >
            Mais campos: por quê, como, onde, quanto
            <ChevronDown className={cn('h-4 w-4 transition-transform', showMore && 'rotate-180')} strokeWidth={1.5} aria-hidden="true" />
          </button>

          <div className={cn('flex flex-col gap-1.5', moreOnPhone)}>
            <label htmlFor="task-why" className={LABEL}>Por quê (Why)</label>
            <textarea
              id="task-why"
              value={form.why}
              onChange={(e) => set('why', e.target.value)}
              placeholder="Ex.: Para permitir pagamentos por PIX"
              rows={3}
              className={cn(FIELD, 'resize-none py-2.5 leading-relaxed')}
            />
          </div>

          <div className={cn('flex flex-col gap-1.5', moreOnPhone)}>
            <label htmlFor="task-how" className={LABEL}>Como (How)</label>
            <textarea
              id="task-how"
              value={form.how}
              onChange={(e) => set('how', e.target.value)}
              placeholder="Ex.: Usando a API do provedor v2"
              rows={3}
              className={cn(FIELD, 'resize-none py-2.5 leading-relaxed')}
            />
          </div>

          <div className={cn('flex flex-col gap-1.5', moreOnPhone)}>
            <label htmlFor="task-where" className={LABEL}>Onde (Where)</label>
            <input
              id="task-where"
              value={form.where}
              onChange={(e) => set('where', e.target.value)}
              placeholder="Ex.: Repositório backend-core"
              className={cn(FIELD, 'h-11')}
            />
          </div>

          <div className={cn('flex flex-col gap-1.5', moreOnPhone)}>
            <label htmlFor="task-howmuch" className={LABEL}>Quanto (How Much)</label>
            <input
              id="task-howmuch"
              value={form.howMuch}
              onChange={(e) => set('howMuch', e.target.value)}
              placeholder="Ex.: 8 horas ou R$ 500"
              className={cn(FIELD, 'h-11')}
            />
          </div>

          {task && (
            <div role="group" aria-labelledby="task-status-label" className="border-t border-border pt-4 md:col-span-2">
              <span id="task-status-label" className={cn(LABEL, 'mb-2 block')}>Status</span>
              <div className="flex flex-wrap gap-2">
                {TASK_STATUSES.map((status) => {
                  const on = form.status === status;
                  return (
                    <button
                      key={status}
                      type="button"
                      aria-pressed={on}
                      onClick={() => set('status', status)}
                      className={cn(
                        'inline-flex h-10 items-center rounded-full border px-4 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring max-sm:h-11',
                        on ? 'border-primary/60 bg-primary/10 text-primary dark:bg-primary/15 [.theme-totvs:not(.dark)_&]:text-foreground' : 'border-border text-muted-foreground hover:bg-accent/60',
                      )}
                    >
                      {STATUS_LABEL[status]}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
          {/* Enter dentro de um campo envia o formulário */}
          <button type="submit" className="sr-only" tabIndex={-1} aria-hidden="true">Salvar</button>
        </form>
      </Modal>

      <ConfirmDialog
        open={isOpen && confirmDelete}
        onOpenChange={setConfirmDelete}
        tone="danger"
        icon={Trash2}
        title="Excluir esta ação?"
        description={<>A ação “{task?.what}” some do plano. Não dá para desfazer.</>}
        confirmLabel="Excluir ação"
        loading={isDeleting}
        loadingLabel="Excluindo…"
        keepOpenOnConfirm
        onConfirm={handleDelete}
      />
    </>
  );
}
