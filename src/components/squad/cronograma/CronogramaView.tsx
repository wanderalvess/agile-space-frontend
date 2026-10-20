'use client';

import { useCallback, useMemo, useState } from 'react';
import { CalendarRange, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { SquadDataState, deriveSquadDataState } from '@/components/squad/SquadDataState';
import { useSquadStore } from '@/store/useSquadStore';
import { formatDay, isoOfDay, parseDay } from '@/lib/cronograma/dates';
import { computeKpis, inferredSubtasks, type DateSource, type Simulation } from '@/lib/cronograma/schedule';
import {
  EMPTY_FILTERS, axisDays, buildRows, filterStories, presetRange, sprintRange, uniqueValues,
  type DayRange, type Filters, type Grouping, type HierarchyLevel, type PeriodPreset,
} from '@/lib/cronograma/view';
import { CronogramaToolbar } from './CronogramaToolbar';
import { DateFieldsDialog } from './DateFieldsDialog';
import { GanttGrid, type Selection } from './GanttGrid';
import { InferredBanner } from './InferredBanner';
import { IssueSheet } from './IssueSheet';
import { CronogramaKpis, CronogramaLegend } from './Summary';
import { DAY_W, LEFT_W } from './styles';
import { useCronogramaModel, useNowMs } from './useCronogramaModel';

export interface CronogramaViewProps {
  squadId: string;
  jiraConnected?: boolean;
  onConnectJira?: () => void;
  onSync?: () => void;
  /** Quem pode configurar a squad (escolhe os campos de data do Jira). */
  canConfigure?: boolean;
}

function timeAgo(iso: string | undefined, nowMs: number): string {
  if (!iso) return 'nunca';
  const ms = nowMs - new Date(iso).getTime();
  if (Number.isNaN(ms)) return 'nunca';
  const minutes = Math.floor(ms / 60_000);
  if (minutes < 1) return 'agora mesmo';
  if (minutes < 60) return `há ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `há ${hours}h`;
  return `há ${Math.floor(hours / 24)}d`;
}

export function CronogramaView({ squadId, jiraConnected = true, onConnectJira, onSync, canConfigure = false }: CronogramaViewProps) {
  const { issuesSnapshot, viewingSprintId, viewedIssuesSnapshot, rollup, viewedRollup, config, isSyncing, members } = useSquadStore();
  const issues = viewingSprintId ? viewedIssuesSnapshot : issuesSnapshot;
  const activeRollup = viewingSprintId ? viewedRollup : rollup;
  const nowMs = useNowMs();

  const sprint = useMemo<DayRange>(() => {
    const meta = activeRollup?.extraMetrics as Record<string, unknown> | undefined;
    return sprintRange(meta?.activeSprintStart as string | undefined, meta?.activeSprintEnd as string | undefined, nowMs);
  }, [activeRollup, nowMs]);

  const [grouping, setGrouping] = useState<Grouping>('story');
  const [level, setLevel] = useState<HierarchyLevel>('story-to-subtask');
  const [source, setSource] = useState<DateSource>('jira');
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
  const [preset, setPreset] = useState<PeriodPreset>('SPRINT_CURRENT');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');
  const [dayWidth, setDayWidth] = useState<number>(DAY_W.initial);
  const [leftWidth, setLeftWidth] = useState<number>(LEFT_W.initial);
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [selection, setSelection] = useState<Selection | null>(null);
  const [sim, setSim] = useState<Simulation | null>(null);
  const [fieldsOpen, setFieldsOpen] = useState(false);

  const { tasks, stories } = useCronogramaModel({
    issues,
    phases: config?.phases,
    members,
    squadDefaultHours: config?.defaultDailyCapacityHours,
    source,
    sprintStartDay: sprint.start,
    sprintEndDay: sprint.end,
    sim,
    nowMs,
  });

  const range = useMemo<DayRange>(() => {
    if (preset === 'CUSTOM') {
      const s = parseDay(customStart);
      const e = parseDay(customEnd);
      return s !== null && e !== null ? { start: s, end: e } : sprint;
    }
    return presetRange(preset, sprint, nowMs);
  }, [preset, customStart, customEnd, sprint, nowMs]);
  const days = useMemo(() => axisDays(range), [range]);

  const visible = useMemo(() => filterStories(stories, filters), [stories, filters]);
  const rows = useMemo(() => buildRows(visible, { grouping, level, collapsed }), [visible, grouping, level, collapsed]);
  const kpis = useMemo(() => computeKpis(stories), [stories]);
  const inferred = useMemo(() => inferredSubtasks(visible.flatMap((v) => v.tasks.map((t) => t.task))), [visible]);

  const statuses = useMemo(() => uniqueValues(tasks, (t) => t.status), [tasks]);
  const types = useMemo(() => uniqueValues(tasks, (t) => t.type), [tasks]);
  const assignees = useMemo(() => uniqueValues(tasks, (t) => t.assigneeName), [tasks]);

  const selectedTask = useMemo(() => {
    if (selection?.kind !== 'task') return null;
    for (const s of stories) {
      const p = s.tasks.find((t) => t.task.key === selection.key);
      if (p) return p;
    }
    return null;
  }, [selection, stories]);
  const selectedStory = useMemo(
    () => (selection?.kind === 'story' ? stories.find((s) => s.key === selection.key) ?? null : null),
    [selection, stories],
  );

  const choosePreset = useCallback((p: PeriodPreset) => {
    if (p === 'CUSTOM') {
      setCustomStart((v) => v || isoOfDay(range.start));
      setCustomEnd((v) => v || isoOfDay(range.end));
    }
    setPreset(p);
  }, [range]);

  const toggle = useCallback((key: string) => setCollapsed((c) => ({ ...c, [key]: !c[key] })), []);
  const close = useCallback(() => setSelection(null), []);
  const zoom = useCallback((delta: number) => setDayWidth((w) => Math.min(DAY_W.max, Math.max(DAY_W.min, w + delta))), []);

  const simForSelected = sim && selection?.kind === 'task' && sim.key === selection.key ? sim.days : 0;

  const subtitle = `${activeRollup?.sprintName || issues[0]?.sprintName || 'Sprint'} · ${formatDay(sprint.start)} a ${formatDay(sprint.end)}`;

  return (
    <div className="flex min-w-0 flex-col gap-4">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex items-start gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary" aria-hidden="true">
            <CalendarRange className="h-5 w-5" strokeWidth={1.5} />
          </span>
          <div className="flex flex-col gap-0.5">
            <h2 className="m-0 text-xl font-bold text-foreground">Cronograma</h2>
            <p className="m-0 text-sm text-muted-foreground">{subtitle}</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground" role="status">
            <span className={`h-2 w-2 rounded-full ${isSyncing ? 'bg-primary' : 'bg-emerald-600 dark:bg-emerald-400'}`} aria-hidden="true" />
            {isSyncing ? 'Sincronizando…' : `Sincronizado ${timeAgo(config?.lastSyncAt, nowMs)}`}
          </span>
          {onSync && (
            <Button type="button" variant="outline" onClick={onSync} disabled={isSyncing} className="h-10 gap-2 rounded-xl font-semibold">
              <RefreshCw className={`h-4 w-4 ${isSyncing ? 'motion-safe:animate-spin' : ''}`} strokeWidth={1.5} aria-hidden="true" />
              Sincronizar agora
            </Button>
          )}
        </div>
      </header>

      {issues.length === 0 ? (
        <SquadDataState
          kind={deriveSquadDataState({ jiraConnected, lastSyncAt: config?.lastSyncAt, lastSyncStatus: config?.lastSyncStatus })}
          subject="o Cronograma"
          isSyncing={isSyncing}
          errorMessage={config?.lastSyncError}
          onConnect={onConnectJira}
          onSync={onSync}
        />
      ) : (
        <>
          {inferred.inferred > 0 && (
            <InferredBanner
              inferred={inferred.inferred}
              total={inferred.total}
              suggesting={source === 'horas'}
              canConfigure={canConfigure}
              onSuggest={() => setSource('horas')}
              onChooseFields={() => setFieldsOpen(true)}
            />
          )}

          <CronogramaKpis kpis={kpis} />

          <CronogramaToolbar
            filters={filters} onFilters={setFilters}
            statuses={statuses} types={types} assignees={assignees}
            grouping={grouping} onGrouping={setGrouping}
            level={level} onLevel={setLevel}
            source={source} onSource={setSource}
            preset={preset} onPreset={choosePreset}
            sprintLabel={`Sprint atual · ${formatDay(sprint.start)} a ${formatDay(sprint.end)}`}
            customStart={customStart} customEnd={customEnd}
            onCustomStart={setCustomStart} onCustomEnd={setCustomEnd}
            dayWidth={dayWidth} onZoom={zoom}
            simulating={!!sim} onClearSim={() => setSim(null)}
            canConfigure={canConfigure} onOpenFields={() => setFieldsOpen(true)}
          />

          <section aria-label="Cronograma" className="overflow-hidden rounded-2xl border border-border bg-card">
            {days.length === 0 ? (
              <p className="p-6 text-sm text-muted-foreground">O período escolhido não tem dias. Confira as datas de início e de fim.</p>
            ) : (
              <GanttGrid
                rows={rows} days={days} dayWidth={dayWidth} leftWidth={leftWidth} onLeftWidth={setLeftWidth}
                grouping={grouping} nowMs={nowMs} selected={selection} onSelect={setSelection} onToggle={toggle}
              />
            )}
            <CronogramaLegend phases={config?.phases} />
          </section>
        </>
      )}

      <IssueSheet
        task={selectedTask}
        story={selectedStory}
        jiraBaseUrl={config?.jiraDomain}
        simDays={simForSelected}
        onSimDays={(d) => { if (selection?.kind === 'task') setSim(d > 0 ? { key: selection.key, days: d } : null); }}
        onClose={close}
      />

      {canConfigure && (
        <DateFieldsDialog
          open={fieldsOpen}
          onOpenChange={setFieldsOpen}
          squadId={squadId}
          onSaved={() => onSync?.()}
        />
      )}
    </div>
  );
}
