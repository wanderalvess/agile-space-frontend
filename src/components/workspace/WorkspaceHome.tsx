'use client';

import React, { useMemo } from 'react';
import Link from 'next/link';
import { Activity, ArrowRight, History, LayoutGrid, Pin, Plus, TrendingUp } from 'lucide-react';
import { IconTile, ModalButton, StatusChip } from '@/components/room-kit';
import { ErrorState } from '@/components/page';
import { PAGE_CARD } from '@/components/page/styles';
import { moduleIcon, type ModuleKey } from '@/lib/modules-registry';
import { SESSION_CHIP_CLASSES } from '@/lib/session-status';
import { cn } from '@/lib/utils';
import type { UserProfile } from '@/lib/types';
import { HISTORY_TYPE_LABELS, historyDate, historyRoomUrl, historyStatusChip } from './history-utils';
import { completionRate, countByStatus } from './kanban-utils';
import type { HistoryItem, KanbanCardData, StickyNote } from './types';
import type { WorkspaceLocation } from './workspace-nav';
import { noteTone } from './note-colors';

interface WorkspaceHomeProps {
  tasks: KanbanCardData[];
  history: HistoryItem[] | null;
  notes: StickyNote[];
  userProfile: Pick<UserProfile, 'name'> | null;
  onNavigate: (loc: WorkspaceLocation) => void;
  onAddTask: () => void;
  onAddNote: () => void;
  /** Falha ao carregar o espaço: mostra o erro em vez de números zerados. */
  loadError?: boolean;
  onRetry?: () => void;
}

const TYPE_MODULE: Record<HistoryItem['type'], ModuleKey> = { poker: 'poker', retro: 'retro', health: 'health' };

function Link2Section({ children, onClick }: { children: React.ReactNode; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="inline-flex items-center gap-1 text-[13px] font-semibold text-primary hover:underline [.theme-totvs:not(.dark)_&]:text-foreground">
      {children}
    </button>
  );
}

/** Aba Início: boas-vindas, fluxo de trabalho, atividade recente e notas em destaque. */
export function WorkspaceHome({ tasks, history, notes, userProfile, onNavigate, onAddTask, onAddNote, loadError, onRetry }: WorkspaceHomeProps) {
  const recent = useMemo(() => (history || []).slice(0, 3), [history]);
  const pinned = useMemo(() => notes.filter((n) => n.isPinned).slice(0, 3), [notes]);
  const counts = useMemo(() => countByStatus(tasks), [tasks]);
  const total = tasks.length;
  const pct = completionRate(tasks);
  const firstName = userProfile?.name?.split(' ')[0] || 'Agilista';

  if (loadError) {
    return <ErrorState title="Não foi possível carregar o seu espaço" description="Verifique a conexão e tente de novo." onRetry={onRetry} />;
  }

  const width = (n: number) => (total > 0 ? `${(n / total) * 100}%` : '0%');

  return (
    <div className="grid grid-cols-1 items-start gap-4 xl:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
      <div className="flex min-w-0 flex-col gap-4">
        {/* Boas-vindas */}
        <section className={cn(PAGE_CARD, 'flex flex-col gap-5 rounded-3xl p-6')}>
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="flex max-w-xl flex-col gap-1.5">
              <h2 className="text-[28px] font-bold leading-tight tracking-tight text-foreground">Olá, {firstName}</h2>
              <p className="text-sm leading-relaxed text-muted-foreground">
                Você tem{' '}
                <strong className="font-semibold text-foreground">
                  {counts.todo} {counts.todo === 1 ? 'tarefa pendente' : 'tarefas pendentes'}
                </strong>{' '}
                e <strong className="font-semibold text-foreground">{counts.doing} em andamento (WIP)</strong>.
              </p>
            </div>
            <div className="flex items-center gap-3 rounded-2xl border border-border bg-muted/40 px-3.5 py-3">
              <div className="text-right">
                <div className="text-[28px] font-bold leading-none tabular-nums text-foreground">{pct}%</div>
                <div className="mt-1 text-xs font-semibold text-emerald-700 dark:text-emerald-300">do Kanban concluído</div>
              </div>
              <TrendingUp className="h-[22px] w-[22px] text-primary [.theme-totvs:not(.dark)_&]:text-foreground" strokeWidth={1.5} aria-hidden="true" />
            </div>
          </div>
          <div className="flex flex-wrap gap-2 border-t border-border pt-4">
            <ModalButton variant="primary" onClick={() => onNavigate({ aba: 'kanban' })}>
              <LayoutGrid className="h-4 w-4" strokeWidth={1.5} aria-hidden="true" /> Ir para o Kanban
            </ModalButton>
            <ModalButton onClick={onAddTask}>
              <Plus className="h-4 w-4" strokeWidth={1.5} aria-hidden="true" /> Nova tarefa
            </ModalButton>
            <ModalButton variant="ghost" onClick={onAddNote}>
              <Pin className="h-4 w-4" strokeWidth={1.5} aria-hidden="true" /> Nova nota
            </ModalButton>
          </div>
        </section>

        {/* Fluxo de trabalho */}
        <section className={cn(PAGE_CARD, 'flex flex-col gap-3.5 p-5')}>
          <div className="flex items-center justify-between gap-3">
            <h2 className="flex items-center gap-2 text-base font-bold text-foreground">
              <Activity className="h-4 w-4 text-muted-foreground" strokeWidth={1.5} aria-hidden="true" /> Fluxo de trabalho
            </h2>
            <StatusChip tone="neutral">
              {total} {total === 1 ? 'item' : 'itens'}
            </StatusChip>
          </div>
          <div
            role="img"
            aria-label={`A fazer ${counts.todo}, em andamento ${counts.doing}, concluído ${counts.done}`}
            className="flex h-3 overflow-hidden rounded-md border border-border bg-muted/50"
          >
            <span className="h-full bg-muted-foreground/60 transition-[width] duration-slow motion-reduce:transition-none" style={{ width: width(counts.todo) }} />
            <span className="h-full bg-primary transition-[width] duration-slow motion-reduce:transition-none" style={{ width: width(counts.doing) }} />
            <span className="h-full bg-emerald-600 transition-[width] duration-slow motion-reduce:transition-none dark:bg-emerald-400" style={{ width: width(counts.done) }} />
          </div>
          <dl className="flex flex-wrap gap-x-6 gap-y-2 text-[13px]">
            {[
              { label: 'A Fazer', n: counts.todo, dot: 'bg-muted-foreground/60' },
              { label: 'Andamento', n: counts.doing, dot: 'bg-primary' },
              { label: 'Concluído', n: counts.done, dot: 'bg-emerald-600 dark:bg-emerald-400' },
            ].map((s) => (
              <div key={s.label} className="flex flex-col">
                <dt className="flex items-center gap-1.5 text-muted-foreground">
                  <span aria-hidden="true" className={cn('h-2 w-2 rounded-full', s.dot)} /> {s.label}
                </dt>
                <dd className="text-xl font-bold tabular-nums text-foreground">{s.n}</dd>
              </div>
            ))}
          </dl>
          <div className="flex items-center justify-between gap-3 border-t border-border pt-3">
            <span className="text-[13px] font-semibold text-muted-foreground">
              {history?.length || 0} {(history?.length || 0) === 1 ? 'cerimônia registrada' : 'cerimônias registradas'}
            </span>
            <Link2Section onClick={() => onNavigate({ aba: 'historico' })}>
              Histórico <ArrowRight className="h-3.5 w-3.5" strokeWidth={1.5} aria-hidden="true" />
            </Link2Section>
          </div>
        </section>

        {/* Atividade recente */}
        <section className={cn(PAGE_CARD, 'flex flex-col gap-2 p-5')}>
          <div className="mb-1 flex items-baseline justify-between gap-3">
            <h2 className="flex items-center gap-2 text-base font-bold text-foreground">
              <History className="h-4 w-4 text-muted-foreground" strokeWidth={1.5} aria-hidden="true" /> Atividade recente
            </h2>
            <Link2Section onClick={() => onNavigate({ aba: 'historico' })}>Ver todas</Link2Section>
          </div>
          {recent.map((h) => {
            const chip = historyStatusChip(h);
            return (
              <Link
                key={`${h.type}-${h.id}`}
                href={historyRoomUrl(h.type, h.roomId || h.id)}
                className="group flex items-center gap-3 rounded-[14px] border border-border bg-muted/30 p-2.5 transition-colors duration-fast hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <IconTile icon={moduleIcon(TYPE_MODULE[h.type])} size="sm" />
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate text-sm font-semibold text-foreground">{h.title || (h as { sprintName?: string }).sprintName || 'Cerimônia sem título'}</span>
                  <span className="text-xs text-muted-foreground" suppressHydrationWarning>
                    {HISTORY_TYPE_LABELS[h.type]} · {historyDate(h.createdAt)}
                  </span>
                </span>
                <span className={cn('inline-flex h-[22px] shrink-0 items-center rounded-full border px-2.5 text-xs font-semibold', SESSION_CHIP_CLASSES[chip.tone])}>{chip.label}</span>
              </Link>
            );
          })}
          {recent.length === 0 && (
            <div className="flex flex-col items-center gap-2 py-7 text-center text-muted-foreground">
              <History className="h-6 w-6" strokeWidth={1.5} aria-hidden="true" />
              <span className="text-[13px] font-semibold">Nenhuma sessão registrada recentemente</span>
            </div>
          )}
        </section>
      </div>

      {/* Notas em destaque */}
      <section className={cn(PAGE_CARD, 'flex flex-col gap-3 p-5')}>
        <div className="flex items-start justify-between gap-3">
          <div className="flex flex-col gap-0.5">
            <h2 className="flex items-center gap-2 text-base font-bold text-foreground">
              <Pin className="h-4 w-4 text-muted-foreground" strokeWidth={1.5} aria-hidden="true" /> Notas em destaque
            </h2>
            <span className="text-xs text-muted-foreground">As anotações que você fixou</span>
          </div>
          <Link2Section onClick={() => onNavigate({ aba: 'notas' })}>Ver todas ({notes.length})</Link2Section>
        </div>
        {pinned.map((n) => {
          const tone = noteTone(n.color);
          return (
            <button
              key={n.id}
              type="button"
              onClick={() => onNavigate({ aba: 'notas' })}
              className={cn('flex flex-col gap-2.5 rounded-2xl border p-3.5 text-left transition-transform duration-fast hover:-translate-y-0.5 motion-reduce:hover:translate-y-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring', tone.surface)}
            >
              <span className="text-xs font-bold uppercase tracking-wide opacity-80">Fixada</span>
              <span className="line-clamp-3 whitespace-pre-line text-[13px] leading-relaxed">{n.content || 'Nota sem conteúdo...'}</span>
              <span className="text-xs opacity-80" suppressHydrationWarning>
                {new Date(n.updatedAt).toLocaleDateString('pt-BR')}
              </span>
            </button>
          );
        })}
        {pinned.length === 0 && (
          <div className="flex flex-col items-center gap-2.5 rounded-2xl border border-dashed border-border px-3 py-7 text-center text-muted-foreground">
            <Pin className="h-6 w-6" strokeWidth={1.5} aria-hidden="true" />
            <span className="text-[13px] font-semibold">Nenhuma nota fixada no momento</span>
            <ModalButton className="h-9 px-3 text-[13px]" onClick={onAddNote}>
              <Plus className="h-3.5 w-3.5" strokeWidth={1.5} aria-hidden="true" /> Criar primeira nota
            </ModalButton>
          </div>
        )}
      </section>
    </div>
  );
}
