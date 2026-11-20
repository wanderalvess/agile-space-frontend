'use client';

import React, { useMemo, useState } from 'react';
import { ArrowDown, ClipboardCopy } from 'lucide-react';
import { ModalButton, FOCUS_RING, roleToneOf, ROLE_STYLES } from '@/components/room-kit';
import { useToast } from '@/hooks/use-toast';
import {
  SITUATION_LABEL,
  SITUATION_ORDER,
  countBySituation,
  formatHours,
  formatNumber,
  sortTasks,
  type ReportTask,
  type SessionReportData,
  type TaskSituation,
  type TaskSort,
} from '@/lib/poker-report';
import { buildEstimatesCopy } from '@/lib/poker-report-export';
import { cn } from '@/lib/utils';
import { CARD, SituationChip, TaskKey, taskNoteLines } from './shared';

type Filter = TaskSituation | 'todas';

function Notes({ task }: { task: ReportTask }) {
  const lines = taskNoteLines(task);
  if (lines.length === 0) return <span className="text-muted-foreground">—</span>;
  return (
    <div className="flex flex-col gap-1">
      {lines.map((l, i) => (
        <span
          key={i}
          className={cn(
            'leading-snug',
            l.kind === 'divergence' && 'font-semibold text-red-700 dark:text-red-300',
            l.kind === 'decision' && 'text-foreground',
            (l.kind === 'reason' || l.kind === 'park') && 'text-muted-foreground'
          )}
        >
          {l.text}
        </span>
      ))}
    </div>
  );
}

function SortHeader({ label, sort, active, onSort, align = 'left' }: { label: string; sort: TaskSort; active: TaskSort; onSort: (s: TaskSort) => void; align?: 'left' | 'right' | 'center' }) {
  const on = active === sort;
  return (
    <button
      type="button"
      onClick={() => onSort(on ? 'pauta' : sort)}
      className={cn(
        'inline-flex items-center gap-1 rounded font-bold hover:text-foreground',
        FOCUS_RING,
        on && 'text-foreground',
        align === 'right' && 'flex-row-reverse'
      )}
      title={on ? 'Voltar à ordem da pauta' : `Ordenar por ${label.toLowerCase()}`}
    >
      {label}
      <ArrowDown className={cn('h-3 w-3 transition-opacity', on ? 'opacity-100' : 'opacity-0')} strokeWidth={1.75} aria-hidden="true" />
    </button>
  );
}

const TH = 'border-b border-border px-2.5 py-2 text-xs font-bold text-muted-foreground';
const TD = 'border-b border-border px-2.5 py-2.5 align-top';

/** Situação do envio da tarefa ao Jira (o envio mais recente). */
export type JiraTaskStatus = 'PENDING' | 'RUNNING' | 'DONE' | 'ERROR';

const JIRA_CHIP: Record<JiraTaskStatus | 'TODO', { label: string; cls: string }> = {
  DONE: { label: 'Enviada', cls: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300' },
  RUNNING: { label: 'Enviando', cls: 'bg-primary/10 text-primary [.theme-totvs:not(.dark)_&]:text-foreground' },
  PENDING: { label: 'Na fila', cls: 'bg-primary/10 text-primary [.theme-totvs:not(.dark)_&]:text-foreground' },
  ERROR: { label: 'Com erro', cls: 'bg-red-500/10 text-red-700 dark:text-red-300' },
  TODO: { label: 'Não enviada', cls: 'bg-muted text-muted-foreground' },
};

const ESTIMATED: ReadonlySet<TaskSituation> = new Set(['consenso', 'revotada', 'divergencia', 'estimada']);
const sendable = (t: ReportTask) => !!t.key && ESTIMATED.has(t.situation);

/** Selo do Jira na linha: só para tarefa estimada com chave; o resto fica com traço. */
function JiraCell({ task, status }: { task: ReportTask; status?: JiraTaskStatus }) {
  if (!sendable(task)) return <span className="text-muted-foreground">—</span>;
  const chip = JIRA_CHIP[status ?? 'TODO'];
  return <span className={cn('inline-flex h-[22px] items-center whitespace-nowrap rounded-full px-2 text-xs font-semibold', chip.cls)}>{chip.label}</span>;
}

/**
 * Tabela principal do relatório: uma linha por tarefa da pauta, filtrável por situação e ordenável.
 * Com `jiraStatus`, ganha a coluna "Jira" (só na tela: o PDF e as exportações não levam o status de envio).
 */
export function ReportTaskTable({ report, jiraStatus }: { report: SessionReportData; jiraStatus?: Record<string, JiraTaskStatus> }) {
  const { toast } = useToast();
  const [filter, setFilter] = useState<Filter>('todas');
  const [sort, setSort] = useState<TaskSort>('pauta');

  const counts = useMemo(() => countBySituation(report.tasks), [report.tasks]);
  const visible = useMemo(
    () => sortTasks(report.tasks, sort).filter((t) => filter === 'todas' || t.situation === filter),
    [report.tasks, sort, filter]
  );
  const isHours = report.header.deck === 'hours';
  const hasEstimates = report.kpis.estimated > 0;
  const totalRounds = report.tasks.reduce((s, t) => s + t.rounds, 0);
  const showJira = !!jiraStatus && report.tasks.some(sendable);
  const extraCols = (isHours ? 1 : 0) + (showJira ? 1 : 0);

  const copy = async (text: string, title: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast({ title, description: `"${text.length > 80 ? `${text.slice(0, 77)}…` : text}" pronto para colar.` });
    } catch {
      toast({ title: 'Não foi possível copiar', variant: 'destructive' });
    }
  };

  const chips: Array<{ id: Filter; label: string; n: number }> = [
    { id: 'todas', label: 'Todas', n: report.tasks.length },
    ...SITUATION_ORDER.filter((s) => counts[s] > 0).map((s) => ({ id: s as Filter, label: SITUATION_LABEL[s], n: counts[s] })),
  ];

  return (
    <section aria-label="Tarefas da sessão" className={cn(CARD, 'flex flex-col gap-3 p-5')}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="m-0 text-base font-bold">Tarefas da sessão</h2>
        {hasEstimates && (
          <ModalButton className="h-9 gap-2 text-[13px]" onClick={() => copy(buildEstimatesCopy(report), 'Estimativas copiadas')}>
            <ClipboardCopy className="h-4 w-4" strokeWidth={1.5} aria-hidden="true" /> Copiar estimativas
          </ModalButton>
        )}
      </div>

      <div role="group" aria-label="Filtrar por situação" className="flex flex-wrap gap-2">
        {chips.map((c) => {
          const on = filter === c.id;
          return (
            <button
              key={c.id}
              type="button"
              aria-pressed={on}
              onClick={() => setFilter(c.id)}
              className={cn(
                'inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-xs font-semibold transition-colors duration-fast',
                FOCUS_RING,
                on ? 'border-primary/60 bg-primary/10 text-foreground dark:bg-primary/15' : 'border-border text-muted-foreground hover:bg-accent/50'
              )}
            >
              {c.label}
              <span className="tabular-nums opacity-80">{c.n}</span>
            </button>
          );
        })}
      </div>

      {/* Tela larga: tabela */}
      <div className="hidden overflow-x-auto md:block">
        <table className="w-full min-w-[820px] border-collapse text-[13px]">
          <thead>
            <tr className="text-left">
              <th scope="col" className={TH}>Tarefa</th>
              {report.roles.map((r) => (
                <th key={r.role} scope="col" className={cn(TH, 'text-right', ROLE_STYLES[roleToneOf(r.role)].text)}>{r.label}</th>
              ))}
              <th scope="col" className={cn(TH, 'text-right')} aria-sort={sort === 'maior' ? 'descending' : 'none'}>
                <SortHeader label="Total" sort="maior" active={sort} onSort={setSort} align="right" />
              </th>
              <th scope="col" className={cn(TH, 'text-center')} aria-sort={sort === 'rodadas' ? 'descending' : 'none'}>
                <SortHeader label="Rodadas" sort="rodadas" active={sort} onSort={setSort} />
              </th>
              <th scope="col" className={TH}>Situação</th>
              <th scope="col" className={TH}>Decisão e observações</th>
              {showJira && <th scope="col" className={TH}>Jira</th>}
              {isHours && <th scope="col" className={cn(TH, 'w-10')}><span className="sr-only">Copiar estimativa</span></th>}
            </tr>
          </thead>
          <tbody>
            {visible.map((t) => (
              <tr key={t.id}>
                <td className={cn(TD, 'max-w-[340px]')}>
                  <div className="flex flex-col gap-0.5">
                    <TaskKey task={t} />
                    <span className={cn('font-semibold leading-snug', t.situation === 'cancelada' && 'text-muted-foreground line-through')}>{t.title}</span>
                  </div>
                </td>
                {report.roles.map((r) => (
                  <td key={r.role} className={cn(TD, 'text-right tabular-nums')}>
                    {t.roles[r.role] !== undefined ? formatHours(t.roles[r.role]) : <span className="text-muted-foreground">—</span>}
                  </td>
                ))}
                <td className={cn(TD, 'whitespace-nowrap text-right font-bold tabular-nums')}>{t.totalLabel}</td>
                <td className={cn(TD, 'text-center tabular-nums')}>{t.rounds > 0 ? t.rounds : <span className="text-muted-foreground">—</span>}</td>
                <td className={TD}><SituationChip situation={t.situation} /></td>
                <td className={cn(TD, 'max-w-[320px]')}><Notes task={t} /></td>
                {showJira && <td className={TD}><JiraCell task={t} status={jiraStatus?.[t.id]} /></td>}
                {isHours && (
                  <td className={cn(TD, 'text-right')}>
                    {t.copyText && (
                      <button
                        type="button"
                        onClick={() => copy(t.copyText, 'Estimativa copiada')}
                        aria-label={`Copiar estimativa de ${t.key ?? t.title}`}
                        title={`Copiar ${t.copyText}`}
                        className={cn('inline-flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-accent hover:text-accent-foreground', FOCUS_RING)}
                      >
                        <ClipboardCopy className="h-4 w-4" strokeWidth={1.5} aria-hidden="true" />
                      </button>
                    )}
                  </td>
                )}
              </tr>
            ))}
            {visible.length === 0 && (
              <tr>
                <td className={cn(TD, 'text-center text-muted-foreground')} colSpan={report.roles.length + 5 + extraCols}>Nenhuma tarefa nesta situação.</td>
              </tr>
            )}
          </tbody>
          {hasEstimates && (
            <tfoot>
              <tr className="font-bold">
                <th scope="row" className="px-2.5 py-3 text-left">
                  Total da sessão <span className="font-normal text-muted-foreground">· {report.kpis.estimated} {report.kpis.estimated === 1 ? 'estimada' : 'estimadas'}</span>
                </th>
                {report.roles.map((r) => (
                  <td key={r.role} className="px-2.5 py-3 text-right tabular-nums">{formatHours(report.totals.roles[r.role] ?? 0)}</td>
                ))}
                <td className={cn('whitespace-nowrap px-2.5 py-3 text-right tabular-nums')}>{report.kpis.totalLabel}</td>
                <td className="px-2.5 py-3 text-center tabular-nums">{totalRounds}</td>
                <td colSpan={2 + extraCols} />
              </tr>
              {report.totals.rolesDiffer && (
                <tr>
                  <td colSpan={report.roles.length + 5 + extraCols} className="px-2.5 pb-2 text-xs text-muted-foreground">
                    A soma dos papéis ({formatNumber(Object.values(report.totals.roles).reduce((a, b) => a + b, 0))}h) difere do total por ajuste manual de estimativa.
                  </td>
                </tr>
              )}
            </tfoot>
          )}
        </table>
      </div>

      {/* Tela estreita: cartões */}
      <ul className="m-0 flex list-none flex-col gap-2 p-0 md:hidden">
        {visible.map((t) => (
          <li key={t.id} className="flex flex-col gap-2 rounded-[10px] border border-border bg-muted/30 p-3">
            <div className="flex items-start justify-between gap-3">
              <div className="flex min-w-0 flex-col gap-0.5">
                <TaskKey task={t} />
                <span className={cn('text-sm font-semibold leading-snug', t.situation === 'cancelada' && 'text-muted-foreground line-through')}>{t.title}</span>
              </div>
              <span className={cn('whitespace-nowrap text-base font-bold tabular-nums')}>{t.totalLabel}</span>
            </div>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs">
              <SituationChip situation={t.situation} />
              {report.roles.map((r) =>
                t.roles[r.role] !== undefined ? (
                  <span key={r.role} className="tabular-nums text-muted-foreground">
                    <span className={cn('font-bold', ROLE_STYLES[roleToneOf(r.role)].text)}>{r.label}</span> {formatHours(t.roles[r.role])}
                  </span>
                ) : null
              )}
              {t.rounds > 0 && <span className="tabular-nums text-muted-foreground">{t.rounds} {t.rounds === 1 ? 'rodada' : 'rodadas'}</span>}
              {showJira && sendable(t) && <span className="inline-flex items-center gap-1.5 text-muted-foreground">Jira <JiraCell task={t} status={jiraStatus?.[t.id]} /></span>}
            </div>
            <div className="text-xs"><Notes task={t} /></div>
          </li>
        ))}
        {visible.length === 0 && <li className="py-4 text-center text-sm text-muted-foreground">Nenhuma tarefa nesta situação.</li>}
        {hasEstimates && (
          <li className="flex items-center justify-between gap-3 rounded-[10px] border border-border px-3 py-2.5 text-sm font-bold">
            <span>Total da sessão</span>
            <span className="tabular-nums">
              {report.kpis.totalLabel}
              {report.roles.length > 0 && (
                <span className="ml-2 text-xs font-normal text-muted-foreground">
                  {report.roles.map((r) => `${r.label} ${formatHours(report.totals.roles[r.role] ?? 0)}`).join(' · ')}
                </span>
              )}
            </span>
          </li>
        )}
      </ul>
    </section>
  );
}
