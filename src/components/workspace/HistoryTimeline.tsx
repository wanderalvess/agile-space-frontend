'use client';

import React, { useMemo, useState } from 'react';
import Link from 'next/link';
import { AlertTriangle, CheckCircle2, ChevronRight, ExternalLink, History, MessageSquare, Target, Trophy, Users, Zap } from 'lucide-react';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { IconTile, StatusChip } from '@/components/room-kit';
import { EmptyState, ErrorState, LoadingSkeleton } from '@/components/page';
import { PAGE_CARD } from '@/components/page/styles';
import { moduleIcon, type ModuleKey } from '@/lib/modules-registry';
import { SESSION_CHIP_CLASSES } from '@/lib/session-status';
import { cn } from '@/lib/utils';
import {
  HISTORY_FILTERS,
  HISTORY_FILTER_LABELS,
  HISTORY_TYPE_LABELS,
  distinctTeams,
  filterHistory,
  historyDate,
  historyRoomUrl,
  historyStatusChip,
  type HistoryFilter,
} from './history-utils';
import type { HistoryItem } from './types';
import { SubTabs, WorkspaceSectionHeader } from './workspace-ui';

interface HistoryTimelineProps {
  items: HistoryItem[] | null;
  isLoading: boolean;
  error?: boolean;
  onRetry?: () => void;
  userId: string;
}

const TYPE_MODULE: Record<HistoryItem['type'], ModuleKey> = { poker: 'poker', retro: 'retro', health: 'health' };

export function HistoryTimeline({ items, isLoading, error, onRetry, userId }: HistoryTimelineProps) {
  const [filter, setFilter] = useState<HistoryFilter>('todos');
  const shown = useMemo(() => filterHistory(items || [], filter), [items, filter]);
  const showTeam = useMemo(() => distinctTeams(items || []).length > 1, [items]);
  const count = shown.length;

  return (
    <div className="flex w-full flex-col gap-4">
      <WorkspaceSectionHeader
        title="Linha do tempo de cerimônias"
        subtitle="Sessões de que você participou ou que organizou, na squad ativa"
        action={!isLoading && !error && items ? <StatusChip tone="neutral">{count} {count === 1 ? 'sessão' : 'sessões'}</StatusChip> : undefined}
      />

      {!isLoading && !error && items && items.length > 0 && (
        <SubTabs role="group" label="Filtrar por ritual" value={filter} onChange={setFilter} items={HISTORY_FILTERS.map((id) => ({ id, label: HISTORY_FILTER_LABELS[id] }))} />
      )}

      {isLoading ? (
        <LoadingSkeleton variant="table" rows={4} label="Carregando histórico..." />
      ) : error ? (
        <ErrorState title="Não foi possível carregar o histórico" description="Verifique a conexão e tente de novo." onRetry={onRetry} />
      ) : !items || items.length === 0 ? (
        <EmptyState icon={History} title="Nenhum registro encontrado" description="Quando você participar de um Poker, uma Retro ou um Radar de clima, a sessão aparece aqui." />
      ) : shown.length === 0 ? (
        <EmptyState icon={History} title="Nenhum registro neste filtro" />
      ) : (
        <section className={cn(PAGE_CARD, 'overflow-clip')}>
          <Accordion type="single" collapsible className="w-full">
            {shown.map((room) => (
              <HistoryEntry key={`${room.type}-${room.id}`} room={room} userId={userId} showTeam={showTeam} />
            ))}
          </Accordion>
        </section>
      )}
    </div>
  );
}

function HistoryEntry({ room, userId, showTeam }: { room: HistoryItem; userId: string; showTeam: boolean }) {
  const isOrganizer = room.creatorId === userId;
  const roomUrl = historyRoomUrl(room.type, room.roomId);
  const chip = historyStatusChip(room);

  return (
    <AccordionItem value={`${room.type}-${room.id}`} className="border-b border-border px-4 last:border-b-0 sm:px-5">
      <AccordionTrigger className="py-4 hover:bg-transparent hover:no-underline">
        <div className="flex w-full min-w-0 items-center gap-3.5 text-left">
          <IconTile icon={moduleIcon(TYPE_MODULE[room.type])} size="md" />
          <div className="flex min-w-0 flex-1 flex-col gap-0.5">
            <div className="flex flex-wrap items-center gap-2">
              <span className="truncate text-sm font-semibold text-foreground">{room.title || 'Sessão sem título'}</span>
              {isOrganizer ? <StatusChip tone="brand">Organizador</StatusChip> : <StatusChip tone="neutral">Participante</StatusChip>}
            </div>
            <div className="flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground" suppressHydrationWarning>
              <span>{historyDate(room.createdAt, true)}</span>
              <span aria-hidden="true">·</span>
              <span className="font-semibold text-foreground/80">{HISTORY_TYPE_LABELS[room.type]}</span>
            </div>
          </div>
          <span className={cn('hidden h-[22px] shrink-0 items-center rounded-full border px-2.5 text-xs font-semibold sm:inline-flex', SESSION_CHIP_CLASSES[chip.tone])}>{chip.label}</span>
          {showTeam && (
            <StatusChip tone="neutral" className="hidden md:inline-flex">
              <Users className="h-3 w-3" strokeWidth={1.5} aria-hidden="true" /> {room.team || 'Squad geral'}
            </StatusChip>
          )}
        </div>
      </AccordionTrigger>

      <AccordionContent className="pb-5">
        <div className="flex flex-col gap-5 pt-1">
          {!room.summary ? (
            <div className="flex items-center gap-3 rounded-2xl border border-border bg-muted/30 p-4 text-muted-foreground">
              <MessageSquare className="h-4 w-4 shrink-0 text-primary [.theme-totvs:not(.dark)_&]:text-foreground" strokeWidth={1.5} aria-hidden="true" />
              <p className="text-[13px]">Resumo indisponível. Esta cerimônia pode ainda estar ativa ou sem relatórios gerados.</p>
            </div>
          ) : (
            <div className="animate-in fade-in duration-300 motion-reduce:animate-none">
              {room.type === 'poker' && <PokerSummary summary={room.summary} />}
              {room.type === 'retro' && <RetroSummary summary={room.summary} />}
              {room.type === 'health' && <HealthSummary summary={room.summary} />}
            </div>
          )}

          <div className="flex flex-wrap items-center justify-end gap-2 border-t border-dashed border-border pt-4">
            <Link
              href={roomUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex h-10 items-center gap-1.5 rounded-[10px] px-4 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              Acessar sala <ChevronRight className="h-4 w-4" strokeWidth={1.5} aria-hidden="true" />
            </Link>
            <Link
              href={roomUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="room-glow inline-flex h-10 items-center gap-2 rounded-[10px] bg-primary px-4 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            >
              Ver relatório <ExternalLink className="h-3.5 w-3.5" strokeWidth={1.5} aria-hidden="true" />
            </Link>
          </div>
        </div>
      </AccordionContent>
    </AccordionItem>
  );
}

function PokerSummary({ summary }: { summary: any }) {
  const stats = [
    { label: 'Duração', val: summary.stats?.durationStr || '-', icon: History },
    { label: 'Tópicos', val: summary.stats?.totalTopics || '-', icon: Target },
    { label: 'Esforço', val: summary.stats?.totalPoints || '-', icon: Zap },
    { label: 'Média', val: summary.stats?.avgTimePerTopic || '-', icon: Target },
  ];
  return (
    <div className="flex flex-col gap-5">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {stats.map((s) => (
          <div key={s.label} className="rounded-2xl border border-border bg-muted/40 p-3.5">
            <div className="mb-1 flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
              <s.icon className="h-3 w-3" strokeWidth={1.5} aria-hidden="true" /> {s.label}
            </div>
            <div className="text-base font-bold tabular-nums text-foreground">{s.val}</div>
          </div>
        ))}
      </div>

      {summary.estimatedTasks && (
        <div className="flex flex-col gap-2.5">
          <h4 className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-muted-foreground">
            <Target className="h-4 w-4 text-primary [.theme-totvs:not(.dark)_&]:text-foreground" strokeWidth={1.5} aria-hidden="true" /> Estimativas
          </h4>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {summary.estimatedTasks.slice(0, 4).map((t: any, i: number) => (
              <div key={i} className="flex items-center justify-between gap-3 rounded-xl border border-border bg-card p-3">
                <span className="truncate text-[13px] font-semibold text-foreground">{t.title}</span>
                <StatusChip tone="brand">{t.points} SP</StatusChip>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function RetroSummary({ summary }: { summary: any }) {
  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="flex items-center gap-3 rounded-2xl border border-emerald-500/25 bg-emerald-500/10 px-4 py-2.5">
          <CheckCircle2 className="h-5 w-5 text-emerald-700 dark:text-emerald-300" strokeWidth={1.5} aria-hidden="true" />
          <span className="text-[13px] font-semibold text-emerald-700 dark:text-emerald-300">{summary.goodCount} Positivos</span>
        </div>
        <div className="flex items-center gap-3 rounded-2xl border border-red-500/25 bg-red-500/10 px-4 py-2.5">
          <AlertTriangle className="h-5 w-5 text-red-700 dark:text-red-300" strokeWidth={1.5} aria-hidden="true" />
          <span className="text-[13px] font-semibold text-red-700 dark:text-red-300">{summary.badCount} Pontos Críticos</span>
        </div>
      </div>

      <div className="rounded-2xl border border-border bg-card p-4 sm:p-5">
        <h4 className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-primary [.theme-totvs:not(.dark)_&]:text-foreground">
          <Zap className="h-4 w-4" strokeWidth={1.5} aria-hidden="true" /> Plano de Ação Estratégico
        </h4>
        <ol className="m-0 flex list-none flex-col gap-2 p-0">
          {summary.actionItems?.map((a: string, i: number) => (
            <li key={i} className="flex items-start gap-3 rounded-xl border border-border bg-muted/40 p-3">
              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/15 text-xs font-bold text-primary [.theme-totvs:not(.dark)_&]:text-foreground">{i + 1}</span>
              <span className="text-[13px] leading-relaxed text-foreground">{a}</span>
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}

function HealthSummary({ summary }: { summary: any }) {
  return (
    <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
      <div className="flex flex-col gap-2.5">
        <h4 className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-emerald-700 dark:text-emerald-300">
          <Trophy className="h-4 w-4" strokeWidth={1.5} aria-hidden="true" /> Fortalezas da Squad
        </h4>
        <div className="flex flex-wrap gap-2">
          {summary.topMetrics?.map((m: string, i: number) => (
            <StatusChip key={i} tone="success" className="h-7 px-3 text-[13px]">
              {m}
            </StatusChip>
          ))}
        </div>
      </div>
      <div className="flex flex-col gap-2.5">
        <h4 className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-amber-700 dark:text-amber-300">
          <AlertTriangle className="h-4 w-4" strokeWidth={1.5} aria-hidden="true" /> Pontos de Atenção
        </h4>
        <div className="flex flex-wrap gap-2">
          {summary.lowMetrics?.map((m: string, i: number) => (
            <StatusChip key={i} tone="warn" className="h-7 px-3 text-[13px]">
              {m}
            </StatusChip>
          ))}
        </div>
      </div>
    </div>
  );
}
