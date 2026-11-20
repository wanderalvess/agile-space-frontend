'use client';

import { useState } from 'react';
import { ExternalLink, Maximize2, Minimize2, Trash2, TrendingUp } from 'lucide-react';
import { FOCUS_RING, IconButton, SelectField } from '@/components/room-kit';
import { cn } from '@/lib/utils';
import { ShowcaseTask, PreparationStatus, DECISION, ISSUE_TYPES, PREPARATION_STATUS } from './types';
import { ControlledInput } from './ControlledFields';
import { toSafeUrl } from './utils';

interface TaskCardHeaderProps {
  task: ShowcaseTask;
  index: number;
  isManual: boolean;
  isMetricsCard: boolean;
  canCollapse: boolean;
  collapsed: boolean;
  onToggleCollapse: () => void;
  onUpdate: (updates: Partial<ShowcaseTask>) => void;
  onRemove: () => void;
}

const PREP_OPTIONS = (Object.keys(PREPARATION_STATUS) as PreparationStatus[]).map((k) => ({ value: k, label: PREPARATION_STATUS[k].label }));

/**
 * Duas linhas: em cima a identificação (chave, tipo, preparação e ações), embaixo o título
 * inteiro. Numa linha só o título disputava espaço com cinco controles e a chave era cortada.
 *
 * A decisão do PO não é editável aqui: ela é tomada no Modo Teatro, durante a apresentação.
 * Na preparação só aparece como selo, e apenas depois que já existe uma decisão.
 */
export function TaskCardHeader({ task, index, isManual, isMetricsCard, canCollapse, collapsed, onToggleCollapse, onUpdate, onRemove }: TaskCardHeaderProps) {
  const prep = PREPARATION_STATUS[task.preparationStatus || 'todo'];
  const decided = task.decision && task.decision !== 'open';
  // A chave cresce com o texto: chaves do Jira como DDWMISSI-5622 eram cortadas em w-20.
  const keyWidthCh = Math.max(8, (task.key || '').length + 1);
  // Remover apaga o card, as métricas e os arquivos anexados: pede confirmação antes.
  const [confirmingRemove, setConfirmingRemove] = useState(false);
  const jiraUrl = toSafeUrl(task.url);
  const typeOptions = ISSUE_TYPES.includes(task.type) || !task.type ? ISSUE_TYPES : [task.type, ...ISSUE_TYPES];

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        {isManual && (
          <span className="inline-flex h-7 shrink-0 items-center rounded-lg bg-amber-500/10 px-2 text-xs font-semibold text-amber-700 dark:text-amber-300">Manual</span>
        )}
        {isMetricsCard && (
          <span className="inline-flex h-7 shrink-0 items-center gap-1 rounded-lg bg-primary/10 px-2 text-xs font-semibold text-primary dark:bg-primary/15 [.theme-totvs:not(.dark)_&]:text-foreground">
            <TrendingUp className="h-3 w-3" strokeWidth={1.5} aria-hidden="true" /> Métrica
          </span>
        )}

        {/* Chave */}
        <div className="inline-flex h-8 shrink-0 items-center rounded-lg bg-muted pl-2.5 pr-1">
          <ControlledInput
            id={`key-${task.id}`}
            aria-label="Chave da issue"
            value={task.key}
            onChange={(v: string) => onUpdate({ key: v.toUpperCase() })}
            placeholder="CHAVE-00"
            style={{ width: `${keyWidthCh}ch` }}
            className="h-6 border-none bg-transparent text-[13px] font-bold uppercase tabular-nums text-foreground outline-none placeholder:text-muted-foreground focus-visible:ring-0"
          />
          {jiraUrl && (
            <a
              href={jiraUrl}
              target="_blank"
              rel="noopener noreferrer"
              title="Abrir no Jira"
              aria-label="Abrir no Jira"
              className={cn('flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-background hover:text-foreground', FOCUS_RING)}
            >
              <ExternalLink className="h-3.5 w-3.5" strokeWidth={1.5} aria-hidden="true" />
            </a>
          )}
        </div>

        {/* Tipo */}
        <SelectField
          aria-label="Tipo da issue"
          value={task.type || ''}
          onChange={(v) => onUpdate({ type: v })}
          options={typeOptions.map((t) => ({ value: t, label: t }))}
          placeholder="Tipo"
          className="h-8 w-auto min-w-[7.5rem] shrink-0 rounded-lg px-2.5 text-[13px] font-medium"
        />

        {decided && (
          <span
            title="Decisão registrada na apresentação"
            className={cn('inline-flex h-7 shrink-0 items-center gap-1.5 rounded-lg px-2.5 text-xs font-semibold', DECISION[task.decision].cls)}
          >
            {DECISION[task.decision].icon}
            {DECISION[task.decision].label}
          </span>
        )}

        <div className="flex-1" />

        {/* Preparação */}
        <div data-tour={index === 0 ? 'first-card-status' : undefined} className="shrink-0">
          <SelectField
            aria-label="Status de preparação"
            value={task.preparationStatus || 'todo'}
            onChange={(v) => onUpdate({ preparationStatus: v as PreparationStatus })}
            options={PREP_OPTIONS}
            className={cn('h-8 w-auto min-w-[8.5rem] rounded-lg border px-2.5 text-[13px] font-semibold', prep.cls, prep.border)}
          />
        </div>

        <div className="flex shrink-0 items-center gap-1">
          {/* Recolher/Expandir: Maximize2/Minimize2, não Chevron, para não parecer a seta do select ao lado. */}
          <IconButton
            size="sm"
            label={collapsed ? 'Expandir card' : 'Recolher card'}
            title={!canCollapse ? 'Marque a preparação como "Pronta" para poder recolher' : (collapsed ? 'Expandir' : 'Recolher')}
            icon={collapsed ? Maximize2 : Minimize2}
            onClick={onToggleCollapse}
            disabled={!canCollapse}
            className="border-transparent max-sm:h-11 max-sm:w-11"
          />
          {confirmingRemove ? (
            <span className="flex items-center gap-2 pl-1" role="group" aria-label="Confirmar remoção do card">
              <button
                type="button"
                onClick={() => { setConfirmingRemove(false); onRemove(); }}
                className={cn('rounded-md px-1 text-[13px] font-semibold text-red-700 hover:underline dark:text-red-300 max-sm:min-h-11', FOCUS_RING)}
              >
                Remover card e anexos
              </button>
              <button
                type="button"
                onClick={() => setConfirmingRemove(false)}
                className={cn('rounded-md px-1 text-[13px] font-semibold text-muted-foreground hover:underline max-sm:min-h-11', FOCUS_RING)}
              >
                Manter
              </button>
            </span>
          ) : (
            <IconButton size="sm" label="Remover card" icon={Trash2} onClick={() => setConfirmingRemove(true)} className="border-transparent hover:text-red-700 dark:hover:text-red-300 max-sm:h-11 max-sm:w-11" />
          )}
        </div>
      </div>

      {/* Título */}
      <ControlledInput
        id={`title-${task.id}`}
        aria-label="Título da entrega"
        value={task.title}
        onChange={(v: string) => onUpdate({ title: v })}
        placeholder="Título da entrega"
        className="min-h-6 w-full border-none bg-transparent text-base font-bold leading-snug text-foreground outline-none transition-colors placeholder:text-muted-foreground focus:text-primary [.theme-totvs:not(.dark)_&]:focus:text-foreground"
      />
    </div>
  );
}
