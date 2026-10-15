'use client';

import React from 'react';
import { AlertTriangle, FileText, Hourglass, RotateCw, TrendingUp, type LucideIcon } from 'lucide-react';
import { IconTile, ROLE_STYLES, type Tone } from '@/components/room-kit';
import type { ReportTask, SessionReportData } from '@/lib/poker-report';
import { cn } from '@/lib/utils';
import { CARD, SituationChip, TaskKey } from './shared';

function HighlightCard({ icon, tone, title, count, children }: { icon: LucideIcon; tone: Tone; title: string; count?: number; children: React.ReactNode }) {
  return (
    <section aria-label={title} className={cn(CARD, 'flex min-w-0 flex-col gap-3 px-[18px] py-4')}>
      <div className="flex items-center gap-2.5">
        <IconTile icon={icon} tone={tone} size="sm" />
        <h3 className="m-0 flex-1 text-sm font-bold">{title}</h3>
        {count !== undefined && <span className="text-sm font-bold tabular-nums text-muted-foreground">{count}</span>}
      </div>
      <ul className="m-0 flex list-none flex-col gap-2 p-0">{children}</ul>
    </section>
  );
}

function Item({ task, aside, detail }: { task: ReportTask; aside?: React.ReactNode; detail?: React.ReactNode }) {
  return (
    <li className="flex flex-col gap-1 rounded-[10px] border border-border bg-muted/40 px-3 py-2.5">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-0.5">
          <TaskKey task={task} />
          <span className="text-[13px] font-semibold leading-snug">{task.title}</span>
        </div>
        {aside && <span className="shrink-0 text-sm font-bold tabular-nums">{aside}</span>}
      </div>
      {detail && <span className="text-xs leading-snug text-muted-foreground">{detail}</span>}
    </li>
  );
}

/** Destaques para a gestão: o que pesa, o que deu trabalho, onde houve divergência e o que ficou pendente. */
export function ReportHighlights({ report }: { report: SessionReportData }) {
  const hl = report.highlights;
  const hasCards = hl.largest.length + hl.mostDiscussed.length + hl.divergent.length + hl.pending.length > 0;
  if (!hasCards && hl.withNotes.length === 0) return null;

  return (
    <div className="flex flex-col gap-3">
      {hasCards && (
        <section aria-label="Destaques para a gestão" className="flex flex-col gap-3">
          <h2 className="m-0 text-base font-bold">Destaques para a gestão</h2>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            {hl.largest.length > 0 && (
              <HighlightCard icon={TrendingUp} tone="brand" title="Maiores estimativas">
                {hl.largest.map((t) => (
                  <Item key={t.id} task={t} aside={t.totalLabel} detail={t.copyText || undefined} />
                ))}
              </HighlightCard>
            )}
            {hl.mostDiscussed.length > 0 && (
              <HighlightCard icon={RotateCw} tone="brand" title="Mais discutidas">
                {hl.mostDiscussed.map((t) => (
                  <Item key={t.id} task={t} aside={`${t.rounds} rodadas`} detail={`Estimada em ${t.totalLabel}`} />
                ))}
              </HighlightCard>
            )}
            {hl.divergent.length > 0 && (
              <HighlightCard icon={AlertTriangle} tone="danger" title="Com divergência" count={hl.divergent.length}>
                {hl.divergent.map((t) => (
                  <Item key={t.id} task={t} aside={t.totalLabel} detail={t.divergence?.text} />
                ))}
              </HighlightCard>
            )}
            {hl.pending.length > 0 && (
              <HighlightCard icon={Hourglass} tone="warn" title="Pendências sem estimativa" count={hl.pending.length}>
                {hl.pending.map((t) => (
                  <Item
                    key={t.id}
                    task={t}
                    aside={<SituationChip situation={t.situation} />}
                    detail={
                      [t.reason ?? t.parkedNote, t.assignee ? `Responsável no Jira: ${t.assignee}` : null].filter(Boolean).join(' · ') || undefined
                    }
                  />
                ))}
              </HighlightCard>
            )}
          </div>
        </section>
      )}

      {hl.withNotes.length > 0 && (
        <section aria-label="Notas de refinamento" className={cn(CARD, 'flex flex-col gap-3 px-[18px] py-4')}>
          <div className="flex items-center gap-2.5">
            <IconTile icon={FileText} tone="neutral" size="sm" />
            <h3 className="m-0 flex-1 text-sm font-bold">Notas de refinamento</h3>
            <span className="text-sm font-bold tabular-nums text-muted-foreground">{hl.withNotes.length}</span>
          </div>
          <ul className="m-0 grid list-none gap-2 p-0 md:grid-cols-2">
            {hl.withNotes.map((t) => (
              <li key={t.id} className="flex flex-col gap-1.5 rounded-[10px] border border-border bg-muted/40 px-3 py-2.5">
                <div className="flex flex-col gap-0.5">
                  <TaskKey task={t} />
                  <span className="text-[13px] font-semibold leading-snug">{t.title}</span>
                </div>
                {t.devNotes && (
                  <p className="m-0 text-xs leading-snug text-muted-foreground">
                    <span className={cn('font-bold', ROLE_STYLES.dev.text)}>DEV</span> {t.devNotes}
                  </p>
                )}
                {t.qaNotes && (
                  <p className="m-0 text-xs leading-snug text-muted-foreground">
                    <span className={cn('font-bold', ROLE_STYLES.qa.text)}>QA</span> {t.qaNotes}
                  </p>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
