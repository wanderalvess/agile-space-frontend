'use client';

import React, { useMemo } from 'react';
import { Ban, Clock, Hourglass, ListChecks, RefreshCcw, RotateCw, SkipForward, Target, TrendingUp, Download, MessageSquareText, Plus, Check } from 'lucide-react';
import type { DeckType, Issue, Participant, VotingRound, Room } from '@/lib/types';
import { formatEstimateCopy, formatRoleForCopy, type SessionBreakdown } from '@/lib/poker-utils';
import { sumRoleHours } from '@/lib/poker-results';
import { cn } from '@/lib/utils';
import { ModalButton, StatusChip } from '@/components/room-kit';
import { ExportDialog } from './ExportDialog';
import { TopicTiming } from './TopicTiming';
import { SessionVelocity } from './SessionVelocity';

export interface ReportStats {
  totalTopics: number;
  totalPoints: number;
  durationStr: string;
  avgTimePerTopic: string;
  idleMins: number;
  estimatedIssues: Issue[];
  skippedIssues: Issue[];
  cancelledIssues: Issue[];
  parkedIssues: Issue[];
  untouchedIssues: Issue[];
  breakdown: SessionBreakdown;
}

interface Props {
  roomId: string;
  roomTitle?: string;
  roomTeam?: string;
  deck: DeckType;
  stats: ReportStats;
  issues: Issue[];
  participants: Participant[];
  rounds: VotingRound[];
  sessionStartedAt?: string;
  sessionEndedAt?: string;
  settings?: Room['settings'];
  onRefreshHistory: () => void;
  onOpenRetro?: () => void;
  onNewSession: () => void;
}

const CARD = 'rounded-[14px] border border-border bg-card shadow-[0_8px_24px_rgba(15,23,42,0.06)] dark:shadow-[0_20px_50px_rgba(0,0,0,0.4)]';

function StatCard({ icon: Icon, label, value, unit, sub, delay }: { icon: React.ComponentType<{ className?: string; strokeWidth?: number }>; label: string; value: string; unit?: string; sub?: string; delay: number }) {
  return (
    <div className={cn(CARD, 'room-rise flex flex-col gap-1.5 p-4')} style={{ animationDelay: `${delay}ms` }}>
      <span className="flex items-center gap-1.5 text-xs text-muted-foreground"><Icon className="h-3.5 w-3.5" strokeWidth={1.5} /> {label}</span>
      <span className="text-[28px] font-bold leading-none tabular-nums">
        {value}{unit && <span className="text-[13px] font-semibold text-muted-foreground"> {unit}</span>}
      </span>
      {sub && <span className="text-xs text-muted-foreground">{sub}</span>}
    </div>
  );
}

function Group({ icon: Icon, title, tone, items, extra }: { icon: React.ComponentType<{ className?: string; strokeWidth?: number }>; title: string; tone: string; items: Issue[]; extra?: (i: Issue) => { why?: string; tag?: string } }) {
  if (items.length === 0) return null;
  return (
    <div className={cn(CARD, 'flex flex-col gap-2.5 px-[18px] py-4')}>
      <div className="flex items-center gap-2.5">
        <span className={cn('flex h-[30px] w-[30px] items-center justify-center rounded-lg', tone)}><Icon className="h-[15px] w-[15px]" strokeWidth={1.5} /></span>
        <h3 className="m-0 flex-1 text-sm font-bold">{title}</h3>
        <span className="text-sm font-bold tabular-nums text-muted-foreground">{items.length}</span>
      </div>
      {items.map((it) => {
        const e = extra?.(it);
        return (
          <div key={it.id} className="flex flex-col gap-1.5 rounded-[10px] border border-border bg-muted/40 px-3 py-2.5">
            <span className="text-[13px] font-semibold"><span className="text-[11px] tabular-nums text-primary [.theme-totvs:not(.dark)_&]:text-foreground">{it.key || 'Tarefa'}</span> {it.title}</span>
            {e?.why && <span className="text-xs leading-snug text-muted-foreground">“{e.why}”</span>}
            {e?.tag && <StatusChip tone="neutral" className="self-start">{e.tag}</StatusChip>}
          </div>
        );
      })}
    </div>
  );
}

/** Fim da sessão: conclusão, números, tempo por tópico, histórico do time, detalhamento e o que ficou fora. */
export function PokerSessionReport({ roomId, roomTitle, roomTeam, deck, stats, issues, participants, rounds, sessionStartedAt, settings, onRefreshHistory, onOpenRetro, onNewSession }: Props) {
  const roleTotals = useMemo(() => (deck === 'hours' ? sumRoleHours(stats.estimatedIssues) : {}), [deck, stats.estimatedIssues]);
  const roleEntries = Object.entries(roleTotals);
  const roundsByIssue = useMemo(() => {
    const m = new Map<string, number>();
    rounds.filter((r) => !r.skipped && r.issueId).forEach((r) => m.set(r.issueId!, (m.get(r.issueId!) ?? 0) + 1));
    return m;
  }, [rounds]);

  const subtitle = [
    sessionStartedAt ? new Date(sessionStartedAt).toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: '2-digit' }) : null,
    stats.durationStr !== 'N/A' ? stats.durationStr : null,
    `${participants.length} ${participants.length === 1 ? 'participante' : 'participantes'}`,
  ].filter(Boolean).join(' · ');

  return (
    <div className="mx-auto flex w-full max-w-[1240px] flex-col gap-6">
      <section className="flex flex-wrap items-center justify-between gap-6">
        <div className="flex flex-col gap-2">
          <h1 className={cn('m-0 text-4xl font-bold leading-[1.05] tracking-[-0.035em] sm:text-5xl')}>Cerimônia concluída</h1>
          <p className="m-0 text-[15px] text-muted-foreground">{subtitle}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {onOpenRetro && <ModalButton onClick={onOpenRetro} className="gap-2"><MessageSquareText className="h-[15px] w-[15px]" strokeWidth={1.5} /> Abrir retro da sprint</ModalButton>}
          <ModalButton onClick={onNewSession} className="gap-2"><Plus className="h-[15px] w-[15px]" strokeWidth={1.5} /> Nova sessão</ModalButton>
          <ModalButton onClick={onRefreshHistory} className="gap-2"><RefreshCcw className="h-[15px] w-[15px]" strokeWidth={1.5} /> Atualizar histórico</ModalButton>
          <ExportDialog
            roomTitle={roomTitle || 'Planning Poker'}
            roomTeam={roomTeam}
            issues={issues}
            participants={participants}
            deck={deck}
            rounds={rounds}
            sessionStartedAt={sessionStartedAt}
            perTopicTime={settings?.perTopicTime !== false}
            triggerNode={<ModalButton variant="primary" className="gap-2"><Download className="h-[15px] w-[15px]" strokeWidth={1.5} /> Exportar resultados</ModalButton>}
          />
        </div>
      </section>

      <p className="m-0 inline-flex items-center gap-2 self-start text-xs text-muted-foreground">
        <Check className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" strokeWidth={1.75} aria-hidden="true" /> Resultados salvos no workspace
      </p>

      <section aria-label="Resumo" className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <StatCard icon={Clock} label="Tempo gasto" value={stats.durationStr.replace(' min', '')} unit={stats.durationStr === 'N/A' ? undefined : 'min'} sub={stats.idleMins > 0 ? `${stats.idleMins} min de pausa fora` : 'Duração ativa'} delay={0} />
        <StatCard icon={ListChecks} label="Tarefas debatidas" value={String(stats.breakdown.discussed)} sub={`${stats.totalTopics} estimada${stats.totalTopics !== 1 ? 's' : ''} de ${stats.breakdown.total}`} delay={60} />
        <StatCard icon={Target} label={deck === 'hours' ? 'Total de horas' : 'Total de pontos'} value={String(stats.totalPoints)} unit={deck === 'hours' ? 'h' : undefined} sub="Esforço estimado" delay={120} />
        {roleEntries.map(([role, hours], i) => (
          <StatCard key={role} icon={Target} label={`Esforço ${formatRoleForCopy(role)}`} value={String(hours)} unit="h" sub="Total por papel" delay={180 + i * 60} />
        ))}
        <StatCard icon={TrendingUp} label="Eficiência" value={stats.avgTimePerTopic.replace(' min/item', '')} unit={stats.avgTimePerTopic === 'N/A' ? undefined : 'min/item'} sub="Tempo por item" delay={180 + roleEntries.length * 60} />
      </section>

      <div className="flex flex-wrap items-center gap-2">
        <StatusChip tone="success">{stats.breakdown.estimated} estimada{stats.breakdown.estimated !== 1 ? 's' : ''}</StatusChip>
        {stats.breakdown.skipped > 0 && <StatusChip tone="warn">{stats.breakdown.skipped} pulada{stats.breakdown.skipped !== 1 ? 's' : ''}</StatusChip>}
        {stats.breakdown.cancelled > 0 && <StatusChip tone="danger">{stats.breakdown.cancelled} cancelada{stats.breakdown.cancelled !== 1 ? 's' : ''}</StatusChip>}
        {stats.breakdown.parked > 0 && <StatusChip tone="brand">{stats.breakdown.parked} adiada{stats.breakdown.parked !== 1 ? 's' : ''}</StatusChip>}
        {stats.breakdown.untouched > 0 && <StatusChip tone="neutral">{stats.breakdown.untouched} não abordada{stats.breakdown.untouched !== 1 ? 's' : ''}</StatusChip>}
      </div>

      <div className="grid gap-4 lg:grid-cols-12">
        {settings?.perTopicTime !== false && (
          <div className="lg:col-span-7"><TopicTiming rounds={rounds} issues={issues} sessionStartedAt={sessionStartedAt} /></div>
        )}
        {settings?.showVelocity && (
          <div className={settings?.perTopicTime !== false ? 'lg:col-span-5' : 'lg:col-span-12'}><SessionVelocity currentRoomId={roomId} /></div>
        )}
      </div>

      {stats.estimatedIssues.length > 0 && (
        <section aria-label="Detalhamento por tarefa" className={cn(CARD, 'flex flex-col gap-2.5 p-5')}>
          <h2 className="m-0 text-base font-bold">Detalhamento por tarefa</h2>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] border-collapse text-[13px]">
              <thead>
                <tr className="text-left text-[11px] text-muted-foreground">
                  <th scope="col" className="border-b border-border px-2.5 py-2 font-bold">Tarefa</th>
                  <th scope="col" className="border-b border-border px-2.5 py-2 text-right font-bold">Estimativa</th>
                  <th scope="col" className="border-b border-border px-2.5 py-2 text-center font-bold">Rodadas</th>
                  <th scope="col" className="border-b border-border px-2.5 py-2 font-bold">Nota de decisão</th>
                </tr>
              </thead>
              <tbody>
                {stats.estimatedIssues.map((i) => {
                  const rp = i.rolePoints ?? { Developer: i.devPoints ?? '', QA: i.qaPoints ?? '' };
                  const byRole = deck === 'hours' ? formatEstimateCopy(Object.entries(rp).map(([role, value]) => ({ role, value: String(value ?? '') })), 'h', { skipZero: true }) : '';
                  const total = i.estimatedPoints ? (deck === 'hours' ? `${i.estimatedPoints}h` : i.estimatedPoints) : '—';
                  return (
                    <tr key={i.id}>
                      <td className="border-b border-border px-2.5 py-2.5"><span className="text-[11px] tabular-nums text-primary [.theme-totvs:not(.dark)_&]:text-foreground">{i.key}</span> <span className="font-semibold">{i.title}</span></td>
                      <td className="whitespace-nowrap border-b border-border px-2.5 py-2.5 text-right font-bold tabular-nums">
                        {byRole ? <><span>{byRole}</span> <span className="font-normal text-muted-foreground">· {total}</span></> : total}
                      </td>
                      <td className="border-b border-border px-2.5 py-2.5 text-center tabular-nums">{roundsByIssue.get(i.id) ?? '—'}</td>
                      <td className="max-w-[320px] border-b border-border px-2.5 py-2.5 text-muted-foreground">{i.decisionNote || '—'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}

      <section aria-label="Fora da estimativa" className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <Group icon={SkipForward} title="Puladas" tone="bg-amber-500/10 text-amber-700 dark:text-amber-300" items={stats.skippedIssues} extra={(i) => ({ why: i.note || undefined })} />
        <Group icon={Ban} title="Canceladas" tone="bg-red-500/10 text-red-700 dark:text-red-300" items={stats.cancelledIssues} extra={(i) => ({ why: i.note || undefined })} />
        <Group icon={Hourglass} title="Adiadas" tone="bg-primary/10 text-primary [.theme-totvs:not(.dark)_&]:text-foreground" items={stats.parkedIssues} extra={(i) => ({
          why: i.parkedNote || undefined,
          tag: `adiada ${i.parkCount || 1}x · ${i.skipped ? 'terminou pulada' : i.status === 'completed' ? 'retomada e estimada' : 'ficou pendente'}`,
        })} />
        <Group icon={RotateCw} title="Não abordadas" tone="bg-muted text-muted-foreground" items={stats.untouchedIssues} />
      </section>
    </div>
  );
}
