'use client';

import { Fragment, useId, useMemo } from 'react';
import { Lock } from 'lucide-react';
import { PAGE_CARD } from '@/components/page';
import { cn } from '@/lib/utils';
import { dowShort, formatDay as formatDayNum, isWeekendDay, parseDay } from '@/lib/cronograma/dates';
import { axisDays, barGeometry } from '@/lib/cronograma/view';
import { DAY_W, HEADER_H, LEFT_W, ROW_H, phaseStyle } from '@/components/squad/cronograma/styles';
import type { DistributionView } from '@/lib/sprint-planner/api';
import {
  distributableTasks, ownershipOf, phaseKindOf, phaseLabelOf, sprintHolidayDays, type Distributable,
} from '@/lib/sprint-planner/distribution';
import { formatDay } from '@/lib/sprint-planner/format';

const TASK_ROW_H = 32;
const HATCH = 'repeating-linear-gradient(135deg, currentColor 0 2px, transparent 2px 8px)';

interface RowPos { sub: Distributable; top: number; mid: number }

/**
 * Gantt da Distribuição. Reaproveita do Cronograma da squad o eixo de dias úteis (`dates`/`view`), a geometria das
 * barras e as cores das FASES (`styles`); a cadeia Codificação, Code Review, QA vem do servidor (`startsAfterKey`).
 * Feriados e fins de semana saem hachurados/sombreados; as barras dos colegas são somente leitura (cadeado).
 */
export function DistributionGantt({ view, compact = false }: { view: DistributionView; compact?: boolean }) {
  const arrowId = useId().replace(/:/g, '');
  const { tasks } = useMemo(() => distributableTasks(view), [view]);
  const holidays = useMemo(() => sprintHolidayDays(view), [view]);
  const startDay = parseDay(view.sprint.startDate);
  const endDay = parseDay(view.sprint.endDate);
  const days = useMemo(() => (startDay !== null && endDay !== null ? axisDays({ start: startDay, end: endDay }) : []), [startDay, endDay]);
  const dayW = compact ? 40 : DAY_W.initial;
  const leftW = compact ? 150 : LEFT_W.initial - 60;

  const layout = useMemo(() => {
    const pos = new Map<string, RowPos>();
    const blocks: { task: (typeof tasks)[number]; top: number; rows: RowPos[] }[] = [];
    let y = 0;
    for (const t of tasks) {
      if (t.subtasks.length === 0) continue;
      const top = y;
      y += TASK_ROW_H;
      const rows: RowPos[] = [];
      for (const s of t.subtasks) {
        const r = { sub: s, top: y, mid: y + ROW_H.task / 2 };
        rows.push(r);
        pos.set(s.key, r);
        y += ROW_H.task;
      }
      blocks.push({ task: t, top, rows });
    }
    return { pos, blocks, height: y };
  }, [tasks]);

  if (days.length === 0 || layout.blocks.length === 0) {
    return (
      <p className={cn(PAGE_CARD, 'p-4 text-sm text-muted-foreground')}>
        {days.length === 0 ? 'A sprint não tem datas válidas para desenhar o cronograma.' : 'Ainda não há subtarefas de DEV ou QA para mostrar no cronograma.'}
      </p>
    );
  }

  const firstDay = days[0];
  const lastDay = days[days.length - 1];
  const bodyW = days.length * dayW;
  const totalW = leftW + bodyW;

  const barFor = (s: Distributable) => {
    const a = parseDay(s.startDate);
    const b = parseDay(s.endDate);
    if (a === null || b === null) return null;
    return barGeometry({ start: { day: a, frac: 0 }, end: { day: b, frac: 1 } }, firstDay, lastDay, dayW);
  };

  return (
    <div className={cn(PAGE_CARD, 'overflow-hidden p-0')}>
      <div className="overflow-x-auto" role="group" aria-label="Cronograma da distribuição" tabIndex={0}>
        <div className="relative" style={{ width: totalW }}>
          {/* Cabeçalho dos dias */}
          <div className="sticky top-0 z-20 flex border-b border-border bg-card" style={{ height: HEADER_H }}>
            <div className="sticky left-0 z-30 flex shrink-0 items-center border-r border-border bg-card px-3 text-xs font-semibold text-muted-foreground" style={{ width: leftW }}>
              Tarefa e subtarefa
            </div>
            {days.map((d) => {
              const holiday = holidays.has(d);
              return (
                <div
                  key={d}
                  title={holiday ? `Feriado${holidays.get(d) ? `: ${holidays.get(d)}` : ''}` : undefined}
                  className={cn('flex shrink-0 flex-col items-center justify-center border-r border-border/60 text-xs tabular-nums', isWeekendDay(d) || holiday ? 'text-muted-foreground' : 'text-foreground')}
                  style={{ width: dayW }}
                >
                  <span>{dowShort(d)}</span>
                  <span className="font-semibold">{formatDayNum(d)}</span>
                </div>
              );
            })}
          </div>

          <div className="relative" style={{ height: layout.height }}>
            {/* Fundo: fins de semana sombreados e feriados hachurados */}
            <div aria-hidden="true" className="pointer-events-none absolute inset-y-0" style={{ left: leftW, width: bodyW }}>
              {days.map((d, i) => {
                const holiday = holidays.has(d);
                if (!holiday && !isWeekendDay(d)) return null;
                return (
                  <span
                    key={d}
                    data-testid={holiday ? 'gantt-feriado' : undefined}
                    className={cn('absolute inset-y-0', holiday ? 'text-muted-foreground' : 'bg-muted/50')}
                    style={{ left: i * dayW, width: dayW, ...(holiday ? { backgroundImage: HATCH, opacity: 0.35 } : null) }}
                  />
                );
              })}
            </div>

            {layout.blocks.map(({ task, top, rows }) => (
              <Fragment key={task.itemId}>
                <div className="absolute inset-x-0 flex items-center border-b border-border/60 bg-muted/40" style={{ top, height: TASK_ROW_H }}>
                  <div className="sticky left-0 z-10 flex min-w-0 items-center gap-2 px-3 text-xs" style={{ width: leftW }}>
                    <span className="font-bold text-foreground">{task.parentKey}</span>
                    <span className="truncate text-muted-foreground">{task.title}</span>
                  </div>
                </div>
                {rows.map(({ sub, top: rowTop }) => {
                  const own = ownershipOf(sub, view.myAccountId);
                  const geom = barFor(sub);
                  const ps = phaseStyle({ kind: phaseKindOf(sub) });
                  const label = `${sub.key}, ${phaseLabelOf(sub)}, ${sub.assigneeName ?? 'sem responsável'}, ${geom ? `de ${formatDay(sub.startDate)} a ${formatDay(sub.endDate)}` : 'sem datas'}${own === 'other' ? ', somente leitura' : ''}`;
                  return (
                    <div key={sub.key} className="absolute inset-x-0 border-b border-border/40" style={{ top: rowTop, height: ROW_H.task }}>
                      <div className="sticky left-0 z-10 flex h-full flex-col justify-center border-r border-border bg-card px-3" style={{ width: leftW }}>
                        <span className="flex items-center gap-1.5 truncate text-xs font-semibold text-foreground">
                          {sub.key}
                          <span className="font-normal text-muted-foreground">{phaseLabelOf(sub)}</span>
                        </span>
                        <span className={cn('flex items-center gap-1 truncate text-xs', own === 'mine' ? 'font-semibold text-foreground' : 'text-muted-foreground')}>
                          {own === 'other' && <Lock aria-hidden="true" className="h-3 w-3 shrink-0" strokeWidth={1.5} />}
                          {sub.assigneeName ?? 'Sem responsável'}
                        </span>
                      </div>
                      {geom ? (
                        <span
                          role="img"
                          aria-label={label}
                          title={label}
                          data-testid={`barra-${sub.key}`}
                          data-owner={own}
                          className={cn(
                            'absolute flex items-center gap-1 overflow-hidden px-2 text-xs font-bold',
                            own === 'mine' ? ps.solid : `${ps.soft} border ${ps.border}`,
                            own === 'free' && 'border-dashed',
                            geom.clippedStart ? 'rounded-l-none' : 'rounded-l-lg',
                            geom.clippedEnd ? 'rounded-r-none' : 'rounded-r-lg',
                          )}
                          style={{ left: leftW + geom.left + 1, width: Math.max(4, geom.width - 2), top: (ROW_H.task - 28) / 2, height: 28 }}
                        >
                          {own === 'other' && <Lock aria-hidden="true" className="h-3 w-3 shrink-0" strokeWidth={1.5} />}
                          {geom.width >= 56 && <span className="truncate">{sub.countedH} h</span>}
                        </span>
                      ) : (
                        <span className="absolute text-xs text-muted-foreground" style={{ left: leftW + 8, top: (ROW_H.task - 16) / 2 }}>sem datas</span>
                      )}
                    </div>
                  );
                })}
              </Fragment>
            ))}

            {/* Cadeia: seta da antecessora para a próxima etapa */}
            <svg aria-hidden="true" className={'pointer-events-none absolute left-0 top-0 overflow-visible text-foreground/70'} width={totalW} height={layout.height}>
              <defs>
                <marker id={`seta-${arrowId}`} viewBox="0 0 8 8" refX="7" refY="4" markerWidth="7" markerHeight="7" orient="auto">
                  <path d="M0 0 L8 4 L0 8 z" fill="currentColor" />
                </marker>
              </defs>
              {layout.blocks.flatMap((b) => b.rows).map(({ sub, mid }) => {
                if (!sub.startsAfterKey) return null;
                const pred = layout.pos.get(sub.startsAfterKey);
                const g1 = pred && barFor(pred.sub);
                const g2 = barFor(sub);
                if (!pred || !g1 || !g2) return null;
                const x1 = leftW + g1.left + g1.width - 1;
                const x2 = leftW + g2.left + 1;
                const xm = Math.max(x1 + 4, Math.min(x2 - 4, x1 + (x2 - x1) / 2));
                return (
                  <path
                    key={`${sub.startsAfterKey}->${sub.key}`}
                    data-testid={`cadeia-${sub.startsAfterKey}-${sub.key}`}
                    d={`M${x1} ${pred.mid} H${xm} V${mid} H${x2}`}
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    markerEnd={`url(#seta-${arrowId})`}
                  />
                );
              })}
            </svg>
          </div>
        </div>
      </div>
      <p className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-border px-3 py-2 text-xs text-muted-foreground">
        <span>Barra cheia: sua subtarefa</span>
        <span>Barra suave: colega (somente leitura)</span>
        <span>Tracejada: sem dono</span>
        <span>Hachurado: feriado</span>
        <span>Seta: a etapa seguinte começa quando a anterior termina</span>
      </p>
    </div>
  );
}
