"use client";

import { useEffect, useRef, useState } from 'react';
import { Bug, ChevronDown, Code, Layers, ListPlus, Palette, type LucideIcon } from 'lucide-react';
import { FIELD, FOCUS_RING, Modal, ModalButton, StatusChip } from '@/components/room-kit';
import { cn } from '@/lib/utils';
import { findQueueDuplicate } from '@/lib/poker-queue';
import type { Issue } from '@/lib/types';

const TYPES: { id: NonNullable<Issue['type']>; label: string; icon: LucideIcon }[] = [
  { id: 'dev', label: 'Dev', icon: Code },
  { id: 'qa', label: 'QA', icon: Bug },
  { id: 'design', label: 'Design', icon: Palette },
  { id: 'other', label: 'Outro', icon: Layers },
];

interface QueueTaskModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  issues: Issue[];
  onAdd: (title: string, jiraLink?: string, type?: Issue['type'], extraData?: Partial<Issue>) => void;
}

/** "Nova tarefa" da fila: um campo principal e detalhes recolhíveis. Dá para adicionar várias seguidas. */
export function QueueTaskModal({ open, onOpenChange, issues, onAdd }: QueueTaskModalProps) {
  const [title, setTitle] = useState('');
  const [type, setType] = useState<NonNullable<Issue['type']>>('dev');
  const [link, setLink] = useState('');
  const [description, setDescription] = useState('');
  const [devNotes, setDevNotes] = useState('');
  const [criteria, setCriteria] = useState('');
  const [showDetails, setShowDetails] = useState(false);
  const [addedCount, setAddedCount] = useState(0);
  const titleRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    // O Modal do kit foca o próprio painel ao abrir; o campo principal assume logo depois.
    const t = window.setTimeout(() => titleRef.current?.focus(), 60);
    return () => window.clearTimeout(t);
  }, [open]);

  const close = () => {
    setTitle(''); setType('dev'); setLink(''); setDescription(''); setDevNotes(''); setCriteria('');
    setShowDetails(false); setAddedCount(0);
    onOpenChange(false);
  };

  const trimmed = title.trim();
  const duplicate = trimmed ? findQueueDuplicate(issues, trimmed) : undefined;
  const canSubmit = !!trimmed && !duplicate;

  const submit = (keepOpen: boolean) => {
    if (!canSubmit) return;
    const extra: Partial<Issue> = {};
    if (description.trim()) extra.description = description.trim();
    if (devNotes.trim()) extra.devNotes = devNotes.trim();
    if (criteria.trim()) extra.acceptanceCriteria = criteria.trim();
    onAdd(trimmed, link.trim(), type, Object.keys(extra).length ? extra : undefined);
    if (keepOpen) {
      setTitle(''); setLink(''); setDescription(''); setDevNotes(''); setCriteria('');
      setAddedCount((n) => n + 1);
      titleRef.current?.focus();
    } else {
      close();
    }
  };

  const area = cn(FIELD, 'resize-none py-2.5 text-[13px] leading-relaxed');

  return (
    <Modal
      open={open}
      onOpenChange={(o) => { if (o) onOpenChange(true); else close(); }}
      size="md"
      icon={ListPlus}
      title="Nova tarefa"
      footerStart={addedCount > 0 ? <StatusChip tone="success">{addedCount} {addedCount === 1 ? 'adicionada' : 'adicionadas'}</StatusChip> : undefined}
      footer={
        <>
          <ModalButton onClick={close}>{addedCount > 0 ? 'Concluir' : 'Cancelar'}</ModalButton>
          <ModalButton onClick={() => submit(true)} disabled={!canSubmit} className="max-sm:hidden">Adicionar e continuar</ModalButton>
          <ModalButton variant="primary" onClick={() => submit(false)} disabled={!canSubmit}>Adicionar tarefa</ModalButton>
        </>
      }
    >
      <form onSubmit={(e) => { e.preventDefault(); submit(false); }} className="flex flex-col gap-5">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="queue-task-title" className="text-[13px] font-semibold text-foreground">Tarefa</label>
          <input
            ref={titleRef}
            id="queue-task-title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Chave do Jira ou título"
            autoComplete="off"
            aria-invalid={!!duplicate}
            className={cn(FIELD, 'h-11 text-sm font-medium', duplicate && 'border-red-500/60')}
          />
          {duplicate && <p role="alert" className="m-0 text-xs font-medium text-red-700 dark:text-red-300">Já está na fila.</p>}
        </div>

        <div className="flex flex-col gap-1.5">
          <span id="queue-task-type" className="text-[13px] font-semibold text-foreground">Tipo</span>
          <div role="radiogroup" aria-labelledby="queue-task-type" className="grid grid-cols-4 gap-1.5 rounded-xl border border-border bg-muted/40 p-1">
            {TYPES.map(({ id, label, icon: Icon }) => {
              const on = type === id;
              return (
                <button
                  key={id}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  onClick={() => setType(id)}
                  className={cn(
                    'flex h-9 items-center justify-center gap-1.5 rounded-lg text-[13px] font-medium transition-colors duration-fast',
                    FOCUS_RING,
                    on ? 'bg-card font-semibold text-foreground shadow-sm ring-1 ring-border' : 'text-muted-foreground hover:text-foreground'
                  )}
                >
                  <Icon className="h-3.5 w-3.5" strokeWidth={1.5} aria-hidden="true" />
                  {label}
                </button>
              );
            })}
          </div>
        </div>

        <div className="flex flex-col gap-3">
          <button
            type="button"
            onClick={() => setShowDetails((v) => !v)}
            aria-expanded={showDetails}
            aria-controls="queue-task-details"
            className={cn('flex items-center gap-1.5 self-start rounded text-[13px] font-semibold text-muted-foreground hover:text-foreground', FOCUS_RING)}
          >
            <ChevronDown className={cn('h-3.5 w-3.5 transition-transform duration-base motion-reduce:transition-none', showDetails && 'rotate-180')} strokeWidth={1.5} aria-hidden="true" />
            Detalhes
          </button>
          {showDetails && (
            <div id="queue-task-details" className="room-rise flex flex-col gap-3">
              <input aria-label="Link do cartão" value={link} onChange={(e) => setLink(e.target.value)} placeholder="Link do cartão" inputMode="url" className={cn(FIELD, 'h-10 text-[13px]')} />
              <textarea aria-label="Descrição" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Descrição ou objetivo" rows={3} className={area} />
              <textarea aria-label="Notas técnicas" value={devNotes} onChange={(e) => setDevNotes(e.target.value)} placeholder="Notas técnicas" rows={2} className={area} />
              <textarea aria-label="Critérios de aceite" value={criteria} onChange={(e) => setCriteria(e.target.value)} placeholder="Critérios de aceite" rows={3} className={area} />
            </div>
          )}
        </div>
        <button type="submit" className="sr-only" tabIndex={-1} aria-hidden="true" disabled={!canSubmit} />
      </form>
    </Modal>
  );
}
