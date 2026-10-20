'use client';

import { Fragment, memo, useEffect, useMemo, useRef, type KeyboardEvent as ReactKeyboardEvent, type PointerEvent as ReactPointerEvent } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { InitialsAvatar } from '@/components/common/InitialsAvatar';
import { dowShort, formatDay, formatHours, isWeekendDay, nowFrac, todayDay, ymdOfDay } from '@/lib/cronograma/dates';
import type { PlannedTask, StoryModel } from '@/lib/cronograma/schedule';
import { statusLabel, statusTone } from '@/lib/cronograma/status';
import { barGeometry, taskSpans, type GanttRow, type Grouping } from '@/lib/cronograma/view';
import { SlipOverlay, StoryBar, TaskBar } from './GanttBar';
import {
  FOCUS, HEADER_H, LEFT_W, ROW_H, STATUS_CHIP, WARN_CHIP, phaseStyle,
} from './styles';

export type Selection = { kind: 'task' | 'story'; key: string };

interface Props {
  rows: GanttRow[];
  days: number[];
  dayWidth: number;
  leftWidth: number;
  onLeftWidth: (w: number) => void;
  grouping: Grouping;
  nowMs: number;
  selected: Selection | null;
  onSelect: (s: Selection) => void;
  onToggle: (storyKey: string) => void;
}

const clampLeft = (w: number) => Math.min(LEFT_W.max, Math.max(LEFT_W.min, w));

function rowHeight(r: GanttRow): number {
  if (r.kind === 'story') return ROW_H.story;
  if (r.kind === 'task') return ROW_H.task;
  return ROW_H.laneTop * 2 + r.lanes * ROW_H.lane - (ROW_H.lane - ROW_H.laneBar);
}

function StatusChip({ status, category }: { status: string; category: string }) {
  return (
    <span className={`inline-flex h-6 shrink-0 items-center rounded-full px-2 text-xs font-semibold max-sm:hidden ${STATUS_CHIP[statusTone(status, category)]}`} title={`Status no Jira: ${status || 'sem status'}`}>
      {statusLabel(status)}
    </span>
  );
}

function LeftCell({ width, children, tint }: { width: number; children: React.ReactNode; tint?: boolean }) {
  return (
    <div
      role="rowheader"
      className={`sticky left-0 z-20 flex max-w-[46vw] shrink-0 items-center gap-2 border-r border-border px-3 md:max-w-[75vw] ${tint ? 'bg-muted' : 'bg-card'}`}
      style={{ width }}
    >
      {children}
    </div>
  );
}

function TitleButton({ title, sub, onClick, strong, label }: { title: string; sub: string; onClick: () => void; strong?: boolean; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className={`flex min-w-0 flex-1 flex-col rounded-md text-left ${FOCUS}`}
    >
      <span className={`truncate text-sm ${strong ? 'font-bold' : 'font-semibold'} text-foreground`}>{title}</span>
      <span className="truncate text-xs text-muted-foreground">{sub}</span>
    </button>
  );
}

const GanttGridImpl = ({ rows, days, dayWidth, leftWidth, onLeftWidth, grouping, nowMs, selected, onSelect, onToggle }: Props) => {
  const axisStart = days[0];
  const axisEnd = days[days.length - 1];
  const chartW = days.length * dayWidth;
  const today = todayDay(nowMs);
  const todayX = days.length > 0 && today >= axisStart && today <= axisEnd ? (today - axisStart + nowFrac(nowMs)) * dayWidth : null;

  // Ao abrir (e ao trocar o período), leva a linha de hoje para perto da borda da coluna fixa: em tela estreita
  // o início da sprint pode estar a vários dias de distância do que importa agora.
  const scroller = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = scroller.current;
    if (el && todayX !== null) el.scrollLeft = Math.max(0, todayX - 96);
    // Só ao abrir ou trocar o período: zoom e relógio não podem puxar a rolagem de volta.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [axisStart, days.length]);

  const dayHeaders = useMemo(
    () => days.map((d) => ({ d, weekend: isWeekendDay(d), isToday: d === today, n: String(ymdOfDay(d).d), dow: dowShort(d) })),
    [days, today],
  );

  const startResize = (e: ReactPointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    const startX = e.clientX;
    const startW = leftWidth;
    const move = (ev: PointerEvent) => onLeftWidth(clampLeft(startW + ev.clientX - startX));
    const up = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  };

  const onResizeKey = (e: ReactKeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'ArrowLeft') { e.preventDefault(); onLeftWidth(clampLeft(leftWidth - 16)); }
    if (e.key === 'ArrowRight') { e.preventDefault(); onLeftWidth(clampLeft(leftWidth + 16)); }
  };

  // Setas movem o foco entre as barras: esquerda/direita na ordem, cima/baixo para a linha vizinha.
  const onGridKey = (e: ReactKeyboardEvent<HTMLDivElement>) => {
    const k = e.key;
    if (!['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(k)) return;
    const target = e.target as HTMLElement;
    if (!target.matches('[data-gantt-bar]')) return;
    const bars = Array.from(e.currentTarget.querySelectorAll<HTMLElement>('[data-gantt-bar]'));
    const i = bars.indexOf(target);
    const row = target.dataset.row;
    let next: HTMLElement | undefined;
    if (k === 'ArrowRight') next = bars[i + 1];
    else if (k === 'ArrowLeft') next = bars[i - 1];
    else if (k === 'ArrowDown') next = bars.slice(i + 1).find((b) => b.dataset.row !== row);
    else next = bars.slice(0, i).reverse().find((b) => b.dataset.row !== row);
    if (next) {
      e.preventDefault();
      next.focus();
      next.scrollIntoView?.({ block: 'nearest', inline: 'nearest' });
    }
  };

  const isSel = (kind: Selection['kind'], key: string) => selected?.kind === kind && selected.key === key;

  const renderTaskBars = (p: PlannedTask, rowIndex: number, top: number, height: number, showKey: boolean) => {
    const spans = taskSpans(p);
    if (!spans) return null;
    const g = barGeometry(spans.solid, axisStart, axisEnd, dayWidth);
    const sg = spans.slip ? barGeometry(spans.slip, axisStart, axisEnd, dayWidth, 6) : null;
    return (
      <>
        {g && (
          <TaskBar
            ptask={p} geom={g} top={top} height={height} showKey={showKey} rowIndex={rowIndex}
            selected={isSel('task', p.task.key)} onSelect={() => onSelect({ kind: 'task', key: p.task.key })}
          />
        )}
        {sg && <SlipOverlay left={sg.left} width={sg.width} top={top} height={height} title={`Atraso: ${p.slip.own} dia(s) útil(eis)`} />}
      </>
    );
  };

  const renderStoryBars = (s: StoryModel, rowIndex: number) => {
    if (!s.planned || !s.effective) return null;
    const g = barGeometry(s.planned, axisStart, axisEnd, dayWidth);
    const sg = s.delayDays > 0 ? barGeometry({ start: s.planned.end, end: s.effective.end }, axisStart, axisEnd, dayWidth, 6) : null;
    const top = (ROW_H.story - 28) / 2;
    return (
      <>
        {g && <StoryBar story={s} geom={g} top={top} height={28} rowIndex={rowIndex} selected={isSel('story', s.key)} onSelect={() => onSelect({ kind: 'story', key: s.key })} />}
        {sg && <SlipOverlay left={sg.left} width={sg.width} top={top} height={28} title={`Previsão: ${s.delayDays} dia(s) útil(eis) a mais`} />}
      </>
    );
  };

  return (
    <div ref={scroller} className="overflow-x-auto" onKeyDown={onGridKey}>
      <div role="grid" aria-label="Cronograma da sprint" aria-rowcount={rows.length + 1} className="relative" style={{ width: leftWidth + chartW, minWidth: '100%' }}>
        {/* Fundo: colunas dos dias, finais de semana sombreados e a linha de hoje */}
        <div aria-hidden="true" className="pointer-events-none absolute bottom-0 top-0 z-0 flex" style={{ left: leftWidth, width: chartW }}>
          {dayHeaders.map((h) => (
            <div key={h.d} className={`h-full shrink-0 border-l border-border ${h.weekend ? 'bg-muted/60' : ''}`} style={{ width: dayWidth }} />
          ))}
        </div>
        {todayX !== null && (
          <div aria-hidden="true" className="pointer-events-none absolute bottom-0 top-0 z-[5] w-0.5 bg-primary" style={{ left: leftWidth + todayX - 1 }}>
            <span className="absolute left-1/2 top-0 inline-flex h-[18px] -translate-x-1/2 items-center rounded-b-lg bg-primary px-2 text-xs font-bold text-primary-foreground">hoje</span>
          </div>
        )}

        <div role="row" className="relative z-10 flex border-b border-border" style={{ height: HEADER_H }}>
          <div
            role="columnheader"
            className="sticky left-0 z-20 flex max-w-[46vw] shrink-0 items-end border-r border-border bg-card px-4 pb-2 text-xs font-semibold text-muted-foreground md:max-w-[75vw]"
            style={{ width: leftWidth }}
          >
            {grouping === 'story' ? 'História e fases' : 'Pessoa'}
            <div
              role="separator"
              aria-orientation="vertical"
              aria-label="Redimensionar a coluna de issues"
              aria-valuemin={LEFT_W.min}
              aria-valuemax={LEFT_W.max}
              aria-valuenow={leftWidth}
              tabIndex={0}
              onPointerDown={startResize}
              onKeyDown={onResizeKey}
              className={`absolute bottom-0 right-0 top-0 w-2 cursor-col-resize hover:bg-primary/30 ${FOCUS}`}
            />
          </div>
          <div className="flex" role="presentation">
            {dayHeaders.map((h) => (
              <div
                key={h.d}
                role="columnheader"
                className="flex shrink-0 flex-col items-center justify-end pb-1.5"
                style={{ width: dayWidth }}
                aria-label={`${h.dow} ${formatDay(h.d)}${h.isToday ? ', hoje' : ''}`}
              >
                <span className="text-xs text-muted-foreground">{h.dow}</span>
                <span className={`text-sm tabular-nums ${h.isToday ? 'font-bold text-foreground underline decoration-primary decoration-2 underline-offset-4' : 'font-medium text-foreground'}`}>{h.n}</span>
              </div>
            ))}
          </div>
        </div>

        {rows.map((r, idx) => {
          const h = rowHeight(r);
          const rowIndex = idx;
          if (r.kind === 'story') {
            const s = r.visible.story;
            const delayed = s.delayDays > 0;
            return (
              <div key={r.id} role="row" aria-rowindex={idx + 2} className="relative z-[1] flex border-b border-border" style={{ height: h }}>
                <LeftCell width={leftWidth} tint>
                  {r.expandable ? (
                    <button
                      type="button"
                      aria-expanded={r.open}
                      aria-label={`${r.open ? 'Recolher' : 'Expandir'} ${s.key}`}
                      onClick={() => onToggle(s.key)}
                      className={`flex min-h-6 min-w-6 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-card hover:text-foreground ${FOCUS}`}
                    >
                      {r.open ? <ChevronDown className="h-4 w-4" aria-hidden="true" /> : <ChevronRight className="h-4 w-4" aria-hidden="true" />}
                    </button>
                  ) : (
                    <span className="w-6 shrink-0" aria-hidden="true" />
                  )}
                  <TitleButton
                    strong
                    label={`Abrir detalhes de ${s.key}`}
                    title={s.title || 'Título ainda não sincronizado'}
                    sub={`${s.key} · ${s.doneCount} de ${s.tasks.length} fases concluídas · ${s.progress}%`}
                    onClick={() => onSelect({ kind: 'story', key: s.key })}
                  />
                  {delayed && <span className={`inline-flex h-6 shrink-0 items-center rounded-full px-2 text-xs font-bold ${WARN_CHIP}`}>prevê +{s.delayDays} d</span>}
                </LeftCell>
                <div role="gridcell" className="relative shrink-0 bg-muted/30" style={{ width: chartW }}>{renderStoryBars(s, rowIndex)}</div>
              </div>
            );
          }
          if (r.kind === 'task') {
            const p = r.ptask;
            const t = p.task;
            const ps = phaseStyle(p.phase);
            return (
              <div key={r.id} role="row" aria-rowindex={idx + 2} className="relative z-[1] flex border-b border-border" style={{ height: h }}>
                <LeftCell width={leftWidth}>
                  <span className="w-6 shrink-0" aria-hidden="true" />
                  <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${ps.dot}`} aria-hidden="true" />
                  <TitleButton
                    label={`Abrir detalhes de ${t.key}`}
                    title={p.phase.label}
                    sub={`${t.key}${t.assigneeName ? ` · ${t.assigneeName}` : ' · sem responsável'}`}
                    onClick={() => onSelect({ kind: 'task', key: t.key })}
                  />
                  {t.assigneeName && <InitialsAvatar name={t.assigneeName} className="h-6 w-6 shrink-0 text-xs max-sm:hidden" />}
                  {p.slip.shift > 0
                    ? <span className={`inline-flex h-6 shrink-0 items-center rounded-full px-2 text-xs font-bold ${WARN_CHIP}`}>+{p.slip.shift} d</span>
                    : <StatusChip status={t.status} category={t.statusCategory} />}
                </LeftCell>
                <div role="gridcell" className="relative shrink-0" style={{ width: chartW }}>
                  {renderTaskBars(p, rowIndex, (ROW_H.task - 28) / 2, 28, false)}
                  {!p.effective && <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">sem datas nem horas para calcular</span>}
                </div>
              </div>
            );
          }
          return (
            <div key={r.id} role="row" aria-rowindex={idx + 2} className="relative z-[1] flex border-b border-border" style={{ height: h }}>
              <LeftCell width={leftWidth}>
                {r.name !== 'Sem responsável' ? <InitialsAvatar name={r.name} className="h-8 w-8 shrink-0 text-xs" /> : <span className="h-8 w-8 shrink-0 rounded-full bg-muted" aria-hidden="true" />}
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate text-sm font-bold text-foreground">{r.name}</span>
                  <span className="truncate text-xs text-muted-foreground">{r.count} {r.count === 1 ? 'fase' : 'fases'} · {formatHours(r.remainingHours)} restantes</span>
                </span>
                {r.overlap && <span className={`inline-flex h-6 shrink-0 items-center rounded-full px-2 text-xs font-semibold ${WARN_CHIP}`} title="Duas tarefas da mesma pessoa no mesmo dia">sobreposição</span>}
              </LeftCell>
              <div role="gridcell" className="relative shrink-0" style={{ width: chartW }}>
                {r.entries.map((en) => (
                  <Fragment key={en.ptask.task.key}>{renderTaskBars(en.ptask, rowIndex, ROW_H.laneTop + en.lane * ROW_H.lane, ROW_H.laneBar, true)}</Fragment>
                ))}
              </div>
            </div>
          );
        })}
        {rows.length === 0 && (
          <div className="relative z-[1] flex border-b border-border">
            <div className="sticky left-0 z-20 bg-card px-4 py-8 text-sm text-muted-foreground" style={{ width: leftWidth }}>Nenhuma issue com esses filtros.</div>
          </div>
        )}
      </div>
    </div>
  );
};

export const GanttGrid = memo(GanttGridImpl);
