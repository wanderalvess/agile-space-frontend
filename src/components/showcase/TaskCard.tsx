'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { Plus, TrendingUp } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { ShowcaseTask, SessionMember } from './types';
import { isTaskContentComplete } from './utils';
import { ControlledTextarea } from './ControlledFields';
import { FieldLabel } from './TaskCardFields';
import { MetricsEditor, ChartDisplayPicker } from './MetricsEditor';
import { TaskCardHeader } from './TaskCardHeader';
import { TaskCardSummary } from './TaskCardSummary';
import { TaskCardContentFields } from './TaskCardContentFields';
import { TaskCardExecutionDetails } from './TaskCardExecutionDetails';

const PREP_ACCENT: Record<string, string> = {
  todo: 'bg-slate-200 dark:bg-slate-700',
  doing: 'bg-blue-500',
  review: 'bg-indigo-500',
  done: 'bg-emerald-500',
};

interface TaskCardProps {
  task: ShowcaseTask;
  index: number;
  members: SessionMember[];
  // taskId-first (em vez de já vir pré-aplicado) — permite passar a MESMA
  // função pra todos os cards, e junto com React.memo evita re-renderizar
  // todo mundo a cada edição de um único card.
  onUpdateTask: (taskId: string, updates: Partial<ShowcaseTask> | ((prev: ShowcaseTask) => ShowcaseTask)) => void;
  onRemoveTask: (taskId: string) => void;
  // Anexos (PNG/JPEG/PDF): funções estáveis da página, pelo mesmo motivo do React.memo acima.
  sessionId?: string;
  onUploadFile?: (taskId: string, file: File) => Promise<void>;
  onDeleteFile?: (fileId: string) => Promise<void>;
}

function TaskCardComponent({ task, index, onUpdateTask, onRemoveTask, sessionId, onUploadFile, onDeleteFile }: TaskCardProps) {
  const onUpdate = React.useCallback(
    (updates: Partial<ShowcaseTask> | ((prev: ShowcaseTask) => ShowcaseTask)) => onUpdateTask(task.id, updates),
    [task.id, onUpdateTask]
  );
  const onRemove = React.useCallback(() => onRemoveTask(task.id), [task.id, onRemoveTask]);
  const isMetricsCard = task.cardKind === 'metrics';
  const isReady = isTaskContentComplete(task);
  const isManual = task.id.startsWith('manual_') || task.key.startsWith('MANUAL-');
  // Só pode recolher quando a squad já marcou a preparação como "Pronta" —
  // colapsar um card ainda em aberto escondia campo vazio que precisava de
  // atenção. Critério é o status explícito (preparationStatus), não o
  // isReady calculado por conteúdo — são coisas diferentes.
  const canCollapse = task.preparationStatus === 'done';
  // Recolhido de cara só quando a task JÁ chega pronta (import do Jira, sprint
  // grande) — sprint de 40 itens não vira scroll infinito de card 100% aberto.
  const [collapsed, setCollapsed] = React.useState(canCollapse);

  // Colapsa/reabre sozinho seguindo a transição de "Pronta" — mas só na
  // TRANSIÇÃO (via ref), nunca a cada render: marcar "Pronta" já é uma ação
  // discreta e deliberada no próprio header do card (clique num dropdown),
  // então reagir a ela colapsando na hora é a confirmação visual esperada,
  // não vira fechar "debaixo do cursor" de quem tá digitando num campo de
  // texto. Reabre se o status regredir de "Pronta" — nunca deixa escondido
  // um card fora do critério de recolher. Sem o `prev` isso brigaria com
  // reabrir manualmente um card já pronto pra reconferir algo.
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

  return (
    <motion.div
      ref={cardRef}
      // "position" e não `layout` inteiro: animar o tamanho escalava o card (texto esticado e
      // um vão vazio) durante a transição de recolher/expandir. Agora só a posição anima.
      layout="position"
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: index * 0.04, ease: [0.23, 1, 0.32, 1] }}
      className="group/card"
    >
      <Card className={cn(
        'relative border rounded-2xl overflow-hidden bg-white dark:bg-slate-900/80 transition-shadow duration-300',
        'hover:shadow-lg hover:shadow-slate-200/60 dark:hover:shadow-black/30',
        isReady ? 'border-emerald-200 dark:border-emerald-900/50' : 'border-slate-200 dark:border-slate-800',
      )}>
        {/* Faixa lateral com a cor da preparação: dá para ler o estado da lista inteira de relance. */}
        <div aria-hidden className={cn('absolute inset-y-0 left-0 w-1', PREP_ACCENT[task.preparationStatus || 'todo'])} />

        <div className={cn('pl-6 pr-5 space-y-4', collapsed ? 'py-3.5' : 'py-5')}>
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
                <div className="p-4 bg-violet-50/40 dark:bg-violet-950/10 border border-violet-100 dark:border-violet-900/30 rounded-xl space-y-3">
                  <FieldLabel icon={TrendingUp} label="Campos e Valores" color="text-violet-500 dark:text-violet-400" />
                  <MetricsEditor
                    metrics={task.metrics || []}
                    onChange={(metrics) => onUpdate({ metrics })}
                    chartType={task.chartType}
                    onChartTypeChange={(chartType) => onUpdate({ chartType })}
                    chartTitle={task.chartTitle}
                    onChartTitleChange={(chartTitle) => onUpdate({ chartTitle })}
                    onApplyPreset={(preset) => onUpdate({ chartType: preset.chartType, chartTitle: preset.chartTitle, metrics: preset.metrics.map(m => ({ ...m })) })}
                  />
                </div>
              ) : (
                <TaskCardExecutionDetails task={task} onUpdate={onUpdate} sessionId={sessionId} onUploadFile={onUploadFile} onDeleteFile={onDeleteFile} />
              )}

              {/* Métrica de Impacto avulsa — só no card padrão (no card de
                  métricas isso já é a seção acima). */}
              {!isMetricsCard && ((task.metrics && task.metrics.length > 0) ? (
                <div className="p-4 bg-violet-50/40 dark:bg-violet-950/10 border border-violet-100 dark:border-violet-900/30 rounded-xl space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <FieldLabel icon={TrendingUp} label="Métricas de Impacto" color="text-violet-500 dark:text-violet-400" />
                    <ChartDisplayPicker value={task.chartDisplay} onChange={(chartDisplay) => onUpdate({ chartDisplay })} />
                  </div>
                  <MetricsEditor
                    metrics={task.metrics}
                    onChange={(metrics) => onUpdate({ metrics })}
                    chartType={task.chartType}
                    onChartTypeChange={(chartType) => onUpdate({ chartType })}
                    chartTitle={task.chartTitle}
                    onChartTitleChange={(chartTitle) => onUpdate({ chartTitle })}
                    onApplyPreset={(preset) => onUpdate({ chartType: preset.chartType, chartTitle: preset.chartTitle, metrics: preset.metrics.map(m => ({ ...m })) })}
                  />
                </div>
              ) : (
                <Button
                  variant="ghost" size="sm"
                  onClick={() => onUpdate({ metrics: [{ field: '', value: 0 }] })}
                  className="h-7 px-2.5 rounded-lg text-[11px] font-bold uppercase tracking-wide text-slate-400 hover:text-violet-500 hover:bg-violet-50 dark:hover:bg-violet-950/20 gap-1 w-fit"
                >
                  <Plus className="h-3 w-3" /> Métrica de Impacto
                </Button>
              ))}

              {/* Feedback do PO: só depois que a decisão foi tomada na apresentação. Na
                  preparação o bloco aparecia vazio em todo card novo (feedback: ''). */}
              {(task.decision === 'needs_adjustment' || task.decision === 'rejected' || !!task.feedback?.trim()) && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="flex gap-3 p-3 bg-amber-50 dark:bg-amber-950/20 border border-amber-100 dark:border-amber-900/30 rounded-xl"
                >
                  <div className="w-1 rounded-full bg-amber-400 shrink-0" />
                  <div className="flex-1">
                    <p className="text-[11px] font-bold uppercase tracking-wide text-amber-500 dark:text-amber-400 mb-0.5">Feedback da Review</p>
                    <ControlledTextarea
                      value={task.feedback || ''}
                      onChange={(v: string) => onUpdate({ feedback: v })}
                      placeholder="Detalhes do ajuste ou motivo da rejeição..."
                      className="w-full bg-transparent border-none outline-none text-[12px] font-medium text-amber-900 dark:text-amber-300 italic placeholder:text-amber-500/50 resize-none min-h-[40px]"
                    />
                  </div>
                </motion.div>
              )}
            </>
          )}
        </div>
      </Card>
    </motion.div>
  );
}

export const TaskCard = React.memo(TaskCardComponent);
