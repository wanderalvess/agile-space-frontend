'use client';

import React, { useEffect, useId, useState } from 'react';
import Link from 'next/link';
import { ExternalLink, ListTodo, Trash2 } from 'lucide-react';
import { ConfirmDialog, Modal, ModalButton, SelectField } from '@/components/room-kit';
import { cn } from '@/lib/utils';
import type { KanbanCardData, KanbanCardPatch, KanbanPriority, KanbanStatus } from './types';
import { KANBAN_PRIORITY_LABELS, KANBAN_STATUS_LABELS, dueDateToServer, parseDueDate } from './kanban-utils';
import { Field, TEXT_AREA, TEXT_INPUT } from './workspace-ui';

const PRIORITY_OPTIONS = (Object.keys(KANBAN_PRIORITY_LABELS) as KanbanPriority[]).map((value) => ({ value, label: KANBAN_PRIORITY_LABELS[value] }));
const STATUS_OPTIONS = (Object.keys(KANBAN_STATUS_LABELS) as KanbanStatus[]).map((value) => ({ value, label: KANBAN_STATUS_LABELS[value] }));

export interface NewTaskInput {
  title: string;
  description: string;
  status: KanbanStatus;
  priority: KanbanPriority;
  tag: string;
  dueDate?: string;
}

interface TaskDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Tarefa em edição; `null` para uma nova. */
  card: KanbanCardData | null;
  /** Coluna em que a tarefa nova nasce. */
  initialStatus: KanbanStatus;
  onCreate: (input: NewTaskInput) => Promise<boolean>;
  onPatch: (id: string, changes: KanbanCardPatch) => Promise<boolean>;
  onDelete: (id: string) => Promise<boolean>;
}

/** Diálogo de tarefa: nova ou ajuste. Excluir pede confirmação. */
export function TaskDialog({ open, onOpenChange, card, initialStatus, onCreate, onPatch, onDelete }: TaskDialogProps) {
  const uid = useId();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [status, setStatus] = useState<KanbanStatus>('todo');
  const [priority, setPriority] = useState<KanbanPriority>('media');
  const [due, setDue] = useState('');
  const [tag, setTag] = useState('');
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const editing = !!card;

  // Cada abertura recomeça do cartão (ou do vazio): nada do diálogo anterior sobra.
  useEffect(() => {
    if (!open) return;
    setTitle(card?.title ?? '');
    setDescription(card?.description ?? '');
    setStatus(card?.status ?? initialStatus);
    setPriority(card?.priority ?? 'media');
    setDue(parseDueDate(card?.dueDate) ?? '');
    setTag(card ? card.tag ?? '' : 'Manual');
    setSaving(false);
    setConfirmDelete(false);
  }, [open, card, initialStatus]);

  const canSave = title.trim().length > 0 && !saving;
  // Tarefa vinda de cerimônia mantém a etiqueta de origem (Poker, Retro...).
  const tagLocked = !!card?.originLink;

  const handleSave = async () => {
    if (!canSave) return;
    setSaving(true);
    let ok: boolean;
    if (card) {
      const changes: KanbanCardPatch = {
        title: title.trim(),
        description: description.trim(),
        status,
        priority,
      };
      if (!tagLocked && tag.trim() !== (card.tag ?? '')) changes.tag = tag.trim() || null;
      if (due !== (parseDueDate(card.dueDate) ?? '')) changes.dueDate = due ? dueDateToServer(due) : null;
      ok = await onPatch(card.id, changes);
    } else {
      ok = await onCreate({
        title: title.trim(),
        description: description.trim(),
        status,
        priority,
        tag: tag.trim() || 'Manual',
        ...(due ? { dueDate: dueDateToServer(due) } : {}),
      });
    }
    setSaving(false);
    if (ok) onOpenChange(false);
  };

  const handleDelete = async () => {
    if (!card) return;
    setSaving(true);
    const ok = await onDelete(card.id);
    setSaving(false);
    if (ok) onOpenChange(false);
  };

  return (
    <>
      <Modal
        open={open}
        onOpenChange={onOpenChange}
        size="md"
        icon={ListTodo}
        title={editing ? 'Ajustar tarefa' : 'Nova tarefa'}
        preventClose={saving}
        footerStart={
          editing ? (
            <ModalButton variant="ghost" className="text-red-700 hover:bg-red-500/10 hover:text-red-700 dark:text-red-300 dark:hover:text-red-300" onClick={() => setConfirmDelete(true)} disabled={saving}>
              <Trash2 className="h-4 w-4" strokeWidth={1.5} aria-hidden="true" /> Excluir
            </ModalButton>
          ) : undefined
        }
        footer={
          <>
            <ModalButton onClick={() => onOpenChange(false)} disabled={saving}>
              Cancelar
            </ModalButton>
            <ModalButton variant="primary" onClick={handleSave} disabled={!canSave}>
              Salvar tarefa
            </ModalButton>
          </>
        }
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSave();
          }}
          className="flex flex-col gap-4 pt-2"
        >
          {card?.originLink && (
            <div className="flex items-center justify-between gap-3 rounded-xl border border-primary/25 bg-primary/10 px-3.5 py-2.5">
              <span className="text-xs font-bold uppercase tracking-wide text-primary [.theme-totvs:not(.dark)_&]:text-foreground">Vinculado a Cerimônia</span>
              <Link
                href={card.originLink}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-[13px] font-semibold text-primary hover:bg-primary/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring [.theme-totvs:not(.dark)_&]:text-foreground"
              >
                <ExternalLink className="h-3.5 w-3.5" strokeWidth={1.5} aria-hidden="true" /> Ver sala
              </Link>
            </div>
          )}

          <Field label="Título da atividade" htmlFor={`${uid}-title`}>
            <input
              id={`${uid}-title`}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={255}
              autoComplete="off"
              placeholder="Ex: Alinhar critérios do Spike de Auth"
              className={cn(TEXT_INPUT, 'font-semibold')}
            />
          </Field>

          <Field label="Descrição / detalhes" htmlFor={`${uid}-desc`}>
            <textarea
              id={`${uid}-desc`}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Descreva detalhes, links de documentação ou critérios de aceite..."
              className={TEXT_AREA}
            />
          </Field>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Urgência" htmlFor={`${uid}-prio`}>
              <SelectField id={`${uid}-prio`} value={priority} onChange={(v) => setPriority(v as KanbanPriority)} options={PRIORITY_OPTIONS} className="h-[42px]" />
            </Field>
            <Field label="Status" htmlFor={`${uid}-status`}>
              <SelectField id={`${uid}-status`} value={status} onChange={(v) => setStatus(v as KanbanStatus)} options={STATUS_OPTIONS} className="h-[42px]" />
            </Field>
            <Field label="Prazo" htmlFor={`${uid}-due`}>
              <div className="flex items-center gap-2">
                <input id={`${uid}-due`} type="date" value={due} onChange={(e) => setDue(e.target.value)} className={cn(TEXT_INPUT, 'min-w-0 flex-1')} />
                {due && (
                  <ModalButton variant="ghost" className="h-[42px] shrink-0 px-3 text-[13px]" onClick={() => setDue('')} aria-label="Limpar prazo">
                    Limpar
                  </ModalButton>
                )}
              </div>
            </Field>
            <Field label="Etiqueta" htmlFor={`${uid}-tag`} hint={tagLocked ? 'Vem da cerimônia: só leitura.' : undefined}>
              <input
                id={`${uid}-tag`}
                value={tag}
                onChange={(e) => setTag(e.target.value)}
                maxLength={60}
                readOnly={tagLocked}
                autoComplete="off"
                placeholder="Ex: Manual"
                className={cn(TEXT_INPUT, tagLocked && 'cursor-not-allowed opacity-70')}
              />
            </Field>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        tone="danger"
        icon={Trash2}
        title={`Excluir "${card?.title ?? 'tarefa'}"?`}
        description="Isso não pode ser desfeito."
        confirmLabel="Excluir"
        cancelLabel="Manter"
        onConfirm={handleDelete}
      />
    </>
  );
}
