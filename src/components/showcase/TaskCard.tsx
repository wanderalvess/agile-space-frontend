'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { Plus, TrendingUp } from 'lucide-react';
import { BRAND_TEXT, FOCUS_RING } from '@/components/room-kit/tokens';
import { cn } from '@/lib/utils';
import { ShowcaseTask, SessionMember } from './types';
import { isTaskContentComplete } from './utils';
import { isManualTask } from './session-model';
import { ControlledTextarea } from './ControlledFields';
import { FieldLabel } from './TaskCardFields';
import { MetricsEditor, ChartDisplayPicker } from './MetricsEditor';
import { TaskCardHeader } from './TaskCardHeader';
import { TaskCardSummary } from './TaskCardSummary';
import { TaskCardContentFields } from './TaskCardContentFields';
import { TaskCardExecutionDetails } from './TaskCardExecutionDetails';

/** Faixa lateral na cor da preparação: dá para ler o estado da lista inteira de relance. */
const PREP_ACCENT: Record<string, string> = {
  todo: 'bg-muted-foreground/30',
  doing: 'bg-primary',
  review: 'bg-blue-500',
  done: 'bg-emerald-500',
};

const METRICS_PANEL = 'flex flex-col gap-3 rounded-xl border border-primary/20 bg-primary/5 p-4 dark:bg-primary/10';

interface TaskCardProps {
  task: ShowcaseTask;
  index: number;
  members: SessionMember[];
  // taskId-first (em vez de já vir pré-aplicado): permite passar a MESMA função para todos os cards, e junto com
  // React.memo evita re-renderizar todo mundo a cada edição de um único card.
  onUpdateTask: (taskId: string, updates: Partial<ShowcaseTask> | ((prev: ShowcaseTask) => ShowcaseTask)) => void | Promise<boolean>;
  onRemoveTask: (taskId: string) => void;
  // Anexos (PNG/JPEG/PDF): funções estáveis da página, pelo mesmo motivo do React.memo acima.
  sessionId?: string;
  onUploadFile?: (taskId: string, file: File) => Promise<void>;
  onDeleteFile?: (fileId: string) => Promise<void>;
}

function TaskCardComponent({ task, index, onUpdateTask, onRemoveTask, sessionId, onUploadFile, onDeleteFile }: TaskCardProps) {
  const onUpdate = React.useCallback(
    (updates: Partial<ShowcaseTask> | ((prev: ShowcaseTask) => ShowcaseTask)) => { void onUpdateTask(task.id, updates); },
    [task.id, onUpdateTask]
  );
  const onRemove = React.useCallback(() => onRemoveTask(task.id), [task.id, onRemoveTask]);
  const isMetricsCard = task.cardKind === 'metrics';
  const isReady = isTaskContentComplete(task);
  const isManual = isManualTask(task);
  // Só pode recolher quando a squad já marcou a preparação como "Pronta": colapsar um card ainda em aberto
  // escondia campo vazio que precisava de atenção. O critério é o status explícito (preparationStatus), não o
  // isReady calculado por conteúdo: são coisas diferentes.
  const canCollapse = task.preparationStatus === 'done';
  // Recolhido de cara só quando a task JÁ chega pronta (import do Jira, sprint grande): sprint de 40 itens não
  // vira scroll infinito de card 100% aberto.
  const [collapsed, setCollapsed] = React.useState(canCollapse);

  // Recolhe/reabre sozinho seguindo a transição de "Pronta", só na TRANSIÇÃO (via ref), nunca a cada render:
  // marcar "Pronta" é uma ação deliberada no próprio cabeçalho do card, então recolher na hora é a confirmação
  // visual esperada. Reabre se o status regredir de "Pronta": nunca deixa escondido um card fora do critério.
  const prevCanCollapseRef = React.useRef(canCollapse);
  const cardRef = React.useRef<HTMLDivElement>(null);
  React.useEffect(() => {
    const prev = prevCanCollapseRef.current;
    prevCanCollapseRef.current = canCollapse;
    if (canCollapse && !prev) {
      // Outra pessoa marcou "Pronta" enquanto alguém digita neste card: não recolhe debaixo do cursor.
      if (cardRef.current?.contains(document.activeElement) && document.activeElement !== document.body) return;
      setCollapsed(true);
    } else if (!canCollapse && collapsed) setCollapsed(false);
  }, [canCollapse, collapsed]);

  const applyPreset = (preset: { chartType: ShowcaseTask['chartType']; chartTitle: string; metrics: { field: string; value: number }[] }) =>
    onUpdate({ chartType: preset.chartType, chartTitle: preset.chartTitle, metrics: preset.metrics.map(m => ({ ...m })) });

  return (
    <motion.div
      ref={cardRef}
      // "position" e não `layout` inteiro: animar o tamanho escalava o card (texto esticado e um vão vazio)
      // durante a transição de recolher/expandir. Agora só a posição anima.
      layout="position"
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: Math.min(index, 8) * 0.04, ease: [0.23, 1, 0.32, 1] }}
      className="group/card"
    >
      <div
        className={cn(
          'relative overflow-hidden rounded-2xl border bg-card text-card-foreground transition-shadow duration-base',
          'hover:shadow-[0_8px_24px_rgba(15,23,42,0.08)] dark:hover:shadow-[0_12px_32px_rgba(0,0,0,0.35)]',
          isReady ? 'border-emerald-500/50' : 'border-border',
        )}
      >
        <div aria-hidden="true" className={cn('absolute inset-y-0 left-0 w-1', PREP_ACCENT[task.preparationStatus || 'todo'])} />

        <div className={cn('flex flex-col gap-4 pl-6 pr-5', collapsed ? 'py-3.5' : 'py-5')}>
          <TaskCardHeader
            task={task}
            index={index}
            isManual={isManual}
            isMetricsCard={isMetricsCard}
            canCollapse={canCollapse}
            collapsed={collapsed}
            onToggleCollapse={() => canCollapse && setCollapsed(c => !c)}
            onUpdate={onUpdate}
            onRemove={onRemove}
          />

          {collapsed ? (
            <TaskCardSummary task={task} isMetricsCard={isMetricsCard} onExpand={() => setCollapsed(false)} />
          ) : (
            <>
              <TaskCardContentFields task={task} isMetricsCard={isMetricsCard} onUpdate={onUpdate} />

              {isMetricsCard ? (
                <div className={METRICS_PANEL}>
                  <FieldLabel icon={TrendingUp} label="Campos e valores" color={BRAND_TEXT} />
                  <MetricsEditor
                    metrics={task.metrics || []}
                    onChange={(metrics) => onUpdate({ metrics })}
                    chartType={task.chartType}
                    onChartTypeChange={(chartType) => onUpdate({ chartType })}
                    chartTitle={task.chartTitle}
                    onChartTitleChange={(chartTitle) => onUpdate({ chartTitle })}
                    onApplyPreset={applyPreset}
                  />
                </div>
              ) : (
                <TaskCardExecutionDetails task={task} onUpdate={onUpdate} sessionId={sessionId} onUploadFile={onUploadFile} onDeleteFile={onDeleteFile} />
              )}

              {/* Métrica de impacto avulsa: só no card padrão (no card de métricas isso já é a seção acima). */}
              {!isMetricsCard && ((task.metrics && task.metrics.length > 0) ? (
                <div className={METRICS_PANEL}>
                  <div className="flex items-center justify-between gap-2">
                    <FieldLabel icon={TrendingUp} label="Métricas de impacto" color={BRAND_TEXT} />
                    <ChartDisplayPicker value={task.chartDisplay} onChange={(chartDisplay) => onUpdate({ chartDisplay })} />
                  </div>
                  <MetricsEditor
                    metrics={task.metrics}
                    onChange={(metrics) => onUpdate({ metrics })}
                    chartType={task.chartType}
                    onChartTypeChange={(chartType) => onUpdate({ chartType })}
                    chartTitle={task.chartTitle}
                    onChartTitleChange={(chartTitle) => onUpdate({ chartTitle })}
                    onApplyPreset={applyPreset}
                  />
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => onUpdate({ metrics: [{ field: '', value: 0 }] })}
                  className={cn('inline-flex h-8 w-fit items-center gap-1 rounded-lg px-2.5 text-xs font-semibold text-muted-foreground transition-colors hover:bg-accent hover:text-foreground max-sm:h-11', FOCUS_RING)}
                >
                  <Plus className="h-3 w-3" strokeWidth={1.5} aria-hidden="true" /> Métrica de impacto
                </button>
              ))}

              {/* Feedback do PO: só depois que a decisão foi tomada na apresentação. Na preparação o bloco
                  aparecia vazio em todo card novo (feedback: ''). */}
              {(task.decision === 'needs_adjustment' || task.decision === 'rejected' || !!task.feedback?.trim()) && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="flex gap-3 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3"
                >
                  <div className="w-1 shrink-0 rounded-full bg-amber-500" />
                  <div className="flex-1">
                    <label htmlFor={`feedback-${task.id}`} className="mb-0.5 block text-xs font-semibold text-amber-800 dark:text-amber-300">Feedback da Review</label>
                    <ControlledTextarea
                      id={`feedback-${task.id}`}
                      value={task.feedback || ''}
                      onChange={(v: string) => onUpdate({ feedback: v })}
                      placeholder="Detalhes do ajuste ou motivo da rejeição..."
                      className="min-h-[40px] w-full resize-none border-none bg-transparent text-[13px] leading-relaxed text-foreground outline-none placeholder:text-amber-800/50 dark:placeholder:text-amber-300/50"
                    />
                  </div>
                </motion.div>
              )}
            </>
          )}
        </div>
      </div>
    </motion.div>
  );
}

export const TaskCard = React.memo(TaskCardComponent);
