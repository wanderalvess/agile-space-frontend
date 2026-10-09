'use client';

import { useState } from 'react';
import { Trash2, TrendingUp, Maximize2, Minimize2, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
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

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 flex-wrap">
        {isManual && (
          <span className="inline-flex items-center h-7 px-2 rounded-lg bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400 text-[11px] font-bold uppercase tracking-wide shrink-0">
            Manual
          </span>
        )}
        {isMetricsCard && (
          <span className="inline-flex items-center gap-1 h-7 px-2 rounded-lg bg-violet-100 text-violet-700 dark:bg-violet-950/40 dark:text-violet-400 text-[11px] font-bold uppercase tracking-wide shrink-0">
            <TrendingUp className="h-3 w-3" /> Métrica
          </span>
        )}

        {/* Chave */}
        <div className="inline-flex items-center h-7 pl-2.5 pr-1 rounded-lg bg-slate-100 dark:bg-slate-800 shrink-0">
          <ControlledInput
            id={`key-${task.id}`}
            value={task.key}
            onChange={(v: string) => onUpdate({ key: v.toUpperCase() })}
            placeholder="CHAVE-00"
            style={{ width: `${keyWidthCh}ch` }}
            className="bg-transparent border-none outline-none text-[11px] font-bold uppercase tracking-wide text-slate-700 dark:text-slate-200 placeholder:text-slate-400 dark:placeholder:text-slate-600"
          />
          {jiraUrl && (
            <a
              href={jiraUrl}
              target="_blank"
              rel="noopener noreferrer"
              title="Abrir no Jira"
              className="h-5 w-5 rounded-md flex items-center justify-center text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-white dark:hover:bg-slate-700 transition-colors"
            >
              <ExternalLink className="h-3 w-3" />
            </a>
          )}
        </div>

        {/* Tipo */}
        <Select value={task.type} onValueChange={(v) => onUpdate({ type: v })}>
          <SelectTrigger className="h-7 w-fit gap-1 px-2.5 bg-indigo-50 dark:bg-indigo-950/20 border border-indigo-100 dark:border-indigo-900/30 rounded-lg text-[11px] font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-wide hover:bg-indigo-100 dark:hover:bg-indigo-900/50 transition-colors focus:ring-0 shrink-0">
            <SelectValue placeholder="Tipo" />
          </SelectTrigger>
          <SelectContent className="dark:bg-slate-900 dark:border-slate-800">
            {ISSUE_TYPES.map((type) => (
              <SelectItem key={type} value={type} className="text-[11px] font-black uppercase">
                {type}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {decided && (
          <span
            title="Decisão registrada na apresentação"
            className={cn('inline-flex items-center gap-1.5 h-7 px-2.5 rounded-lg text-[11px] font-bold uppercase tracking-wide shrink-0', DECISION[task.decision].cls)}
          >
            {DECISION[task.decision].icon}
            {DECISION[task.decision].label}
          </span>
        )}

        <div className="flex-1" />

        {/* Preparação */}
        <Select
          value={task.preparationStatus || 'todo'}
          onValueChange={(v) => onUpdate({ preparationStatus: v as PreparationStatus })}
        >
          <SelectTrigger
            data-tour={index === 0 ? 'first-card-status' : undefined}
            className={cn(
              'h-7 w-fit gap-1 px-2.5 rounded-lg text-[11px] font-bold uppercase tracking-wide transition-colors shrink-0 border focus:ring-0',
              prep.cls,
              prep.border
            )}
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="dark:bg-slate-900 dark:border-slate-800">
            {Object.entries(PREPARATION_STATUS).map(([key, config]) => (
              <SelectItem key={key} value={key} className="text-[11px] font-bold uppercase">
                {config.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <div className="flex items-center shrink-0">
          {/* Recolher/Expandir — Maximize2/Minimize2, não Chevron, para não parecer a seta do select ao lado. */}
          <Button
            variant="ghost" size="icon"
            onClick={onToggleCollapse}
            disabled={!canCollapse}
            title={!canCollapse ? 'Marque a preparação como "Pronta" pra poder recolher' : (collapsed ? 'Expandir' : 'Recolher')}
            aria-label={collapsed ? 'Expandir card' : 'Recolher card'}
            className={cn(
              'h-7 w-7 rounded-lg transition-all',
              canCollapse
                ? 'text-slate-400 hover:text-violet-500 hover:bg-violet-50 dark:hover:bg-violet-950/20'
                : 'text-slate-200 dark:text-slate-700 cursor-not-allowed'
            )}
          >
            {collapsed ? <Maximize2 className="h-3.5 w-3.5" /> : <Minimize2 className="h-3.5 w-3.5" />}
          </Button>
          {confirmingRemove ? (
            <span className="flex items-center gap-1.5 pl-1" role="group" aria-label="Confirmar remoção do card">
              <button
                type="button"
                onClick={() => { setConfirmingRemove(false); onRemove(); }}
                className="text-[11px] font-bold text-rose-600 hover:underline"
              >
                Remover card e anexos
              </button>
              <button
                type="button"
                onClick={() => setConfirmingRemove(false)}
                className="text-[11px] font-bold text-slate-400 hover:underline"
              >
                Manter
              </button>
            </span>
          ) : (
            <Button
              variant="ghost" size="icon" onClick={() => setConfirmingRemove(true)}
              title="Remover card"
              aria-label="Remover card"
              className="h-7 w-7 rounded-lg text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/20 transition-all"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>
      </div>

      {/* Título */}
      <ControlledInput
        id={`title-${task.id}`}
        value={task.title}
        onChange={(v: string) => onUpdate({ title: v })}
        placeholder="Título da entrega"
        className="w-full text-[15px] font-bold leading-snug text-slate-900 dark:text-slate-100 bg-transparent border-none outline-none focus:text-violet-700 dark:focus:text-violet-300 transition-colors placeholder:text-slate-400"
      />
    </div>
  );
}
