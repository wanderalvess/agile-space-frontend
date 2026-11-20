'use client';

import React from 'react';
import { ExternalLink } from 'lucide-react';
import { StatusChip, type Tone } from '@/components/room-kit';
import { BRAND_TEXT } from '@/components/room-kit';
import { SITUATION_LABEL, type ReportTask, type TaskSituation } from '@/lib/poker-report';
import { cn } from '@/lib/utils';

export const SITUATION_TONE: Record<TaskSituation, Tone> = {
  consenso: 'success',
  revotada: 'brand',
  divergencia: 'danger',
  estimada: 'neutral',
  adiada: 'warn',
  pulada: 'warn',
  cancelada: 'neutral',
  nao_abordada: 'neutral',
};

export function SituationChip({ situation, className }: { situation: TaskSituation; className?: string }) {
  return <StatusChip tone={SITUATION_TONE[situation]} className={className}>{SITUATION_LABEL[situation]}</StatusChip>;
}

/** Só links http(s) viram âncora (a chave vem do Jira, mas o link é texto livre). */
export function safeHref(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    const u = new URL(url);
    return u.protocol === 'http:' || u.protocol === 'https:' ? u.toString() : null;
  } catch {
    return null;
  }
}

/** Chave da tarefa (link do Jira quando houver). */
export function TaskKey({ task, className }: { task: Pick<ReportTask, 'key' | 'jiraLink'>; className?: string }) {
  if (!task.key) return null;
  const href = safeHref(task.jiraLink);
  const base = cn('text-xs font-semibold tabular-nums', BRAND_TEXT, className);
  if (!href) return <span className={base}>{task.key}</span>;
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={cn(base, 'inline-flex items-center gap-0.5 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring')}
      aria-label={`Abrir ${task.key} no Jira`}
    >
      {task.key}
      <ExternalLink className="h-3 w-3 opacity-60" strokeWidth={1.5} aria-hidden="true" />
    </a>
  );
}

export const CARD = 'rounded-[14px] border border-border bg-card shadow-[0_8px_24px_rgba(15,23,42,0.06)] dark:shadow-[0_20px_50px_rgba(0,0,0,0.4)]';

export interface NoteLine {
  kind: 'decision' | 'reason' | 'divergence' | 'park';
  text: string;
}

/** Linhas de observação de uma tarefa (decisão, motivo, divergência e histórico de adiamento). */
export function taskNoteLines(t: ReportTask): NoteLine[] {
  const lines: NoteLine[] = [];
  if (t.divergence) lines.push({ kind: 'divergence', text: t.divergence.text });
  if (t.decisionNote) lines.push({ kind: 'decision', text: t.decisionNote });
  if (t.reason) lines.push({ kind: 'reason', text: t.reason });
  if (t.parkCount > 0) {
    const head = `Adiada ${t.parkCount}x${t.parkOutcome ? `, ${t.parkOutcome}` : ''}`;
    lines.push({ kind: 'park', text: t.parkedNote ? `${head}: ${t.parkedNote}` : head });
  }
  return lines;
}
