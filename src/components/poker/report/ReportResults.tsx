'use client';

import React, { useMemo } from 'react';
import { FileDown, Printer } from 'lucide-react';
import { ModalButton, roleToneOf, ROLE_STYLES } from '@/components/room-kit';
import type { SessionReportData } from '@/lib/poker-report';
import { SEGMENT_COLOR, buildResultsPage, situationSummary } from '@/lib/poker-report-results';
import { cn } from '@/lib/utils';
import { Kpi } from './ReportOverview';
import { CARD, SituationChip, TaskKey } from './shared';

/**
 * Aba "Resultados": a folha-resumo da sessão (a mesma que sai como primeira página
 * do PDF A4), com os números-chave, as horas por papel, a situação das tarefas, as
 * maiores estimativas e as pendências. Só mostra o que a sala registrou.
 */
export function ReportResults({
  report,
  onDownload,
  onPrint,
  busy,
}: {
  report: SessionReportData;
  onDownload: () => void;
  onPrint: () => void;
  busy: boolean;
}) {
  const d = useMemo(() => buildResultsPage(report), [report]);
  const total = d.situation.reduce((n, s) => n + s.count, 0);

  return (
    <div className="flex flex-col gap-4" id="report-results">
      <section aria-label="Identificação dos resultados" className={cn(CARD, 'flex flex-wrap items-end justify-between gap-x-6 gap-y-3 px-5 py-4')}>
        <div className="flex min-w-0 flex-col gap-1">
          <span className="text-xs font-semibold tracking-wide text-muted-foreground">Scrum Poker · Portal Tech V&amp;D</span>
          <h2 className="m-0 text-xl font-bold leading-tight">Resultados da sessão</h2>
          <p className="m-0 text-sm text-muted-foreground">
            {d.title}
            {d.team && ` · ${d.team}`} · {d.dateLong}
            {d.timeRange && ` · ${d.timeRange}`}
          </p>
          <p className="m-0 text-xs text-muted-foreground">
            {d.facilitators.length > 0 && <>Facilitador: {d.facilitators.join(', ')} · </>}
            {d.participantsCount} {d.participantsCount === 1 ? 'participante' : 'participantes'}
            {d.participantsByRole.length > 0 && ` (${d.participantsByRole.map((p) => `${p.count} ${p.label}`).join(', ')})`}
            {d.durationLabel && ` · duração ${d.durationLabel}`} · {d.deckLabel}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <ModalButton variant="primary" onClick={onDownload} disabled={busy} className="h-9 gap-2 text-[13px]">
            <FileDown className="h-[15px] w-[15px]" strokeWidth={1.5} aria-hidden="true" /> {busy ? 'Gerando…' : 'Baixar página (PDF)'}
          </ModalButton>
          <ModalButton onClick={onPrint} className="h-9 gap-2 text-[13px]">
            <Printer className="h-[15px] w-[15px]" strokeWidth={1.5} aria-hidden="true" /> Imprimir página
          </ModalButton>
        </div>
      </section>

      <section aria-label="Números-chave" className="grid gap-3 [grid-template-columns:repeat(auto-fit,minmax(170px,1fr))]">
        {d.kpis.map((k, i) => (
          <Kpi
            key={k.id}
            label={k.label}
            value={k.value}
            unit={k.unit}
            sub={k.id === 'largest' ? <span className="block truncate" title={k.sub}>{k.sub}</span> : k.sub}
            emphasis={k.main}
            delay={i * 50}
            valueClassName={cn(k.value.length > 7 && 'text-xl', k.tone === 'danger' && 'text-red-700 dark:text-red-300')}
          />
        ))}
      </section>

      <div className="grid gap-4 lg:grid-cols-[3fr_2fr]">
        <div className="flex min-w-0 flex-col gap-4">
          {d.roleBars.length > 0 && (
            <section aria-label="Horas por papel" className={cn(CARD, 'flex flex-col gap-3 p-5')}>
              <h3 className="m-0 text-sm font-bold">Horas por papel</h3>
              <ul className="m-0 flex list-none flex-col gap-2.5 p-0">
                {d.roleBars.map((b) => (
                  <li key={b.key} className="grid grid-cols-[4.5rem_1fr] items-center gap-x-3 gap-y-1 text-sm sm:grid-cols-[4.5rem_1fr_13rem]">
                    <span className={cn('font-bold', ROLE_STYLES[roleToneOf(b.key)].text)}>{b.label}</span>
                    <span className="h-3 overflow-hidden rounded-full bg-muted" role="img" aria-label={`${b.label}: ${b.valueLabel}`}>
                      <span className={cn('block h-full rounded-full', ROLE_STYLES[roleToneOf(b.key)].bar)} style={{ width: `${Math.max(2, b.ratio * 100)}%` }} />
                    </span>
                    <span className="col-span-2 whitespace-nowrap font-semibold tabular-nums sm:col-span-1">
                      {b.valueLabel} <span className="font-normal text-muted-foreground">· {Math.round(b.share * 100)}% · {b.sub}</span>
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <section aria-label="Situação das tarefas" className={cn(CARD, 'flex flex-col gap-3 p-5')}>
            <h3 className="m-0 text-sm font-bold">Situação das tarefas</h3>
            <div className="flex h-4 overflow-hidden rounded-full bg-muted" role="img" aria-label={situationSummary(d.situation)}>
              {d.situation.map((s) => (
                <span key={s.situation} style={{ flex: `${s.count} 0 0`, background: SEGMENT_COLOR[s.situation] }} title={`${s.label}: ${s.count}`} />
              ))}
            </div>
            <ul className="m-0 grid list-none grid-cols-2 gap-x-4 gap-y-1.5 p-0 text-sm sm:grid-cols-3">
              {d.situation.map((s) => (
                <li key={s.situation} className="flex items-center gap-2">
                  <span className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ background: SEGMENT_COLOR[s.situation] }} aria-hidden="true" />
                  <span className="font-bold tabular-nums">{s.count}</span>
                  <span className="text-muted-foreground">{s.label} ({Math.round((s.count / Math.max(1, total)) * 100)}%)</span>
                </li>
              ))}
            </ul>
          </section>
        </div>

        <div className="flex min-w-0 flex-col gap-4">
          {d.largest.length > 0 && (
            <section aria-label="Maiores estimativas" className={cn(CARD, 'flex flex-col gap-2 p-5')}>
              <h3 className="m-0 text-sm font-bold">Maiores estimativas</h3>
              <ul className="m-0 flex list-none flex-col gap-2 p-0">
                {d.largest.map(({ task, detail }) => (
                  <li key={task.id} className="flex items-start justify-between gap-3 rounded-[10px] border border-border bg-muted/40 px-3 py-2.5">
                    <div className="flex min-w-0 flex-col gap-0.5">
                      <TaskKey task={task} />
                      <span className="text-[13px] font-semibold leading-snug">{task.title}</span>
                      {detail && <span className="text-xs text-muted-foreground">{detail}</span>}
                    </div>
                    <span className="shrink-0 text-sm font-bold tabular-nums">{task.totalLabel}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <section aria-label="Pendências sem estimativa" className={cn(CARD, 'flex flex-col gap-2 p-5')}>
            <h3 className="m-0 flex items-baseline justify-between text-sm font-bold">
              Pendências sem estimativa
              {d.pending.length > 0 && <span className="tabular-nums text-muted-foreground">{d.pending.length}</span>}
            </h3>
            {d.pending.length === 0 ? (
              <p className="m-0 text-sm text-muted-foreground">Nenhuma pendência: todas as tarefas da pauta foram tratadas.</p>
            ) : (
              <ul className="m-0 flex list-none flex-col gap-2 p-0">
                {d.pending.map(({ task, detail }) => (
                  <li key={task.id} className="flex items-start justify-between gap-3 rounded-[10px] border border-border bg-muted/40 px-3 py-2.5">
                    <div className="flex min-w-0 flex-col gap-0.5">
                      <TaskKey task={task} />
                      <span className="text-[13px] font-semibold leading-snug">{task.title}</span>
                      {detail && <span className="text-xs text-muted-foreground">{detail}</span>}
                    </div>
                    <SituationChip situation={task.situation} className="shrink-0" />
                  </li>
                ))}
              </ul>
            )}
            {d.cancelled > 0 && (
              <p className="m-0 text-xs text-muted-foreground">
                {d.cancelled} {d.cancelled === 1 ? 'tarefa cancelada' : 'tarefas canceladas'} no refinamento (fora da contagem de pendências).
              </p>
            )}
          </section>
        </div>
      </div>

      {d.omitted.length > 0 && (
        <p className="m-0 rounded-[10px] border border-dashed border-border px-4 py-3 text-xs text-muted-foreground">
          <span className="font-semibold text-foreground">Não incluído nesta folha (dado não registrado na sessão):</span> {d.omitted.join(' ')}
        </p>
      )}
    </div>
  );
}
