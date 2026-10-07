'use client';

/**
 * Visão geral da squad: diz em que ponto a sprint está, o que pede atenção e leva às cerimônias.
 * Tudo vem do rollup sincronizado do Jira e da configuração da squad; nada aqui é número fixo.
 */

import Link from 'next/link';
import {
  Activity, ArrowRight, CalendarRange, CheckCircle2, History, ListTodo, RefreshCw, Trophy, Users,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { SquadRituals } from '@/components/squad/SquadRituals';
import type { SquadConfig, SquadMember, SquadMetricsRollup } from '@/lib/types';
import { cn } from '@/lib/utils';

interface SquadOverviewProps {
  squadId: string;
  config: SquadConfig | null;
  rollup: SquadMetricsRollup | null;
  members: SquadMember[];
  /** Pessoas do time. Vem do maior entre os membros sincronizados e o cadastro do projeto (mesma fonte do Painel). */
  peopleCount: number;
  lastSyncLabel: string;
  isSyncing: boolean;
  canSync: boolean;
  onSync: () => void;
  onOpenTab: (tab: string) => void;
  onNavigate: (href: string) => void;
}

type Ceremony = { name: string; desc: string; icon: React.ElementType; tone: string; href?: string; soon?: boolean };

const CEREMONIES: Ceremony[] = [
  {
    name: 'Scrum Poker', href: '/room', icon: Trophy, tone: 'text-amber-500 bg-amber-500/10',
    desc: 'Estimar as tarefas do refinamento votando em conjunto.',
  },
  {
    name: 'Planejador', icon: CalendarRange, tone: 'text-slate-400 bg-slate-500/10', soon: true,
    desc: 'Planejar a capacidade e o escopo da próxima sprint.',
  },
  {
    name: 'Review', href: '/showcase', icon: CheckCircle2, tone: 'text-violet-500 bg-violet-500/10',
    desc: 'Apresentar as entregas e registrar o aceite do PO.',
  },
  {
    name: 'Retrospectiva', href: '/retro', icon: History, tone: 'text-emerald-500 bg-emerald-500/10',
    desc: 'Registrar o que funcionou, o que melhorar e as ações.',
  },
  {
    name: 'Plano de ação', href: '/action-plan', icon: ListTodo, tone: 'text-blue-500 bg-blue-500/10',
    desc: 'Transformar melhorias em ações com responsável e prazo (5W2H).',
  },
  {
    name: 'Health Check', href: '/health-check', icon: Activity, tone: 'text-rose-500 bg-rose-500/10',
    desc: 'Medir o clima e a saúde do time com o gráfico radar.',
  },
];

function StatCard({ label, value, unit, hint, tone, action }: {
  label: string; value: string | number; unit?: string; hint: string;
  tone?: 'ok' | 'info' | 'warn' | 'neutral'; action?: React.ReactNode;
}) {
  const valueTone = tone === 'ok' ? 'text-emerald-500' : tone === 'info' ? 'text-blue-500' : tone === 'warn' ? 'text-rose-500' : 'text-slate-900 dark:text-slate-100';
  return (
    <div className={cn(
      'rounded-2xl border p-5',
      tone === 'warn' ? 'border-rose-500/40 bg-rose-500/5' : 'border-slate-200/70 dark:border-slate-800 bg-white dark:bg-slate-900/70'
    )}>
      <p className="text-sm font-semibold text-slate-600 dark:text-slate-300">{label}</p>
      <p className={cn('mt-1.5 text-4xl font-black leading-none tracking-tight font-headline', valueTone)}>
        {value}
        {unit && <span className="ml-1.5 text-base font-semibold text-slate-500 dark:text-slate-400">{unit}</span>}
      </p>
      <p className="mt-2.5 text-sm text-slate-500 dark:text-slate-400">{hint}</p>
      {action && <div className="mt-1.5">{action}</div>}
    </div>
  );
}

export function SquadOverview({
  squadId, config, rollup, members, peopleCount, lastSyncLabel, isSyncing, canSync, onSync, onOpenTab, onNavigate,
}: SquadOverviewProps) {
  const total = rollup?.totalIssues ?? 0;
  const done = rollup?.doneIssues ?? 0;
  const inProgress = rollup?.inProgressIssues ?? 0;
  const notStarted = Math.max(0, total - done - inProgress);
  const overdue = rollup?.overdueIssues ?? 0;
  const stale = rollup?.staleIssues ?? 0;
  const loggedH = Math.round((rollup?.loggedTotalSec ?? 0) / 3600);
  const estimateH = Math.round((rollup?.estimateTotalSec ?? 0) / 3600);

  const wdTotal = rollup?.workdaysTotal ?? 0;
  const wdLeft = rollup?.workdaysRemaining ?? 0;
  const timePct = wdTotal > 0 ? Math.min(100, Math.max(0, Math.round(((wdTotal - wdLeft) / wdTotal) * 100))) : null;
  const workPct = total > 0 ? Math.round((done / total) * 100) : null;
  const sprintName = rollup?.sprintName || (config?.activeSprintId ? `Sprint ${config.activeSprintId}` : '');

  const attention: { tone: string; text: string; actionLabel?: string; onAction?: () => void }[] = [];
  if (overdue > 0) attention.push({ tone: 'bg-rose-500', text: `${overdue} ${overdue === 1 ? 'item está' : 'itens estão'} com o prazo vencido.`, actionLabel: 'Ver no Cronograma', onAction: () => onOpenTab('plans') });
  if (stale > 0) attention.push({ tone: 'bg-amber-500', text: `${stale} ${stale === 1 ? 'item está' : 'itens estão'} sem nenhuma mudança há mais de 3 dias.`, actionLabel: 'Ver nas Métricas', onAction: () => onOpenTab('metrics') });
  if (!rollup) attention.push({ tone: 'bg-blue-500', text: 'A sprint ainda não foi sincronizada com o Jira, então os números abaixo estão vazios.', actionLabel: canSync ? 'Sincronizar agora' : undefined, onAction: canSync ? onSync : undefined });
  if (peopleCount === 0) attention.push({ tone: 'bg-amber-500', text: 'Nenhuma pessoa do time foi sincronizada ainda.', actionLabel: 'Configurar squad', onAction: () => onNavigate('/squad/roster') });

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      {/* Cabeçalho da squad */}
      <section className="space-y-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0 flex-1 basis-[420px]">
            <div className="flex flex-wrap items-center gap-3">
              <h2 className="text-3xl md:text-4xl font-black tracking-tight font-headline text-slate-900 dark:text-white">
                {config?.name || squadId}
              </h2>
              <span className="font-code text-xs font-semibold text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-700 rounded-full px-2.5 py-0.5">{squadId}</span>
            </div>
            <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-sm text-slate-500 dark:text-slate-400">
              {sprintName && <span>{sprintName}{wdTotal > 0 ? ` · faltam ${wdLeft} de ${wdTotal} dias úteis` : ''}</span>}
              <span>{lastSyncLabel}</span>
              <span>{peopleCount} {peopleCount === 1 ? 'pessoa' : 'pessoas'} no time</span>
            </div>
          </div>
          {canSync && (
            <Button onClick={onSync} disabled={isSyncing} className="h-11 rounded-xl px-5 font-bold gap-2">
              <RefreshCw className={cn('h-4 w-4', isSyncing && 'animate-spin')} />
              {isSyncing ? 'Sincronizando…' : 'Sincronizar agora'}
            </Button>
          )}
        </div>

        {timePct !== null && workPct !== null && (
          <div className="rounded-2xl border border-slate-200/70 dark:border-slate-800 bg-white dark:bg-slate-900/70 p-5 space-y-4">
            <div className="grid gap-5 md:grid-cols-2">
              <div>
                <div className="mb-2 flex justify-between text-sm text-slate-600 dark:text-slate-300"><span>Tempo da sprint</span><span className="font-semibold">{timePct}%</span></div>
                <div className="h-2 rounded-full bg-slate-200 dark:bg-slate-800"><div className="h-full rounded-full bg-blue-500" style={{ width: `${timePct}%` }} /></div>
              </div>
              <div>
                <div className="mb-2 flex justify-between text-sm text-slate-600 dark:text-slate-300"><span>Trabalho concluído</span><span className="font-semibold">{workPct}%</span></div>
                <div className="h-2 rounded-full bg-slate-200 dark:bg-slate-800"><div className="h-full rounded-full bg-emerald-500" style={{ width: `${workPct}%` }} /></div>
              </div>
            </div>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              {workPct + 5 < timePct
                ? 'O trabalho concluído está abaixo do tempo que já passou. Vale olhar o que está atrasado ou parado.'
                : 'O trabalho concluído acompanha o tempo da sprint.'}
            </p>
          </div>
        )}
      </section>

      {/* Como a sprint está */}
      <section>
        <h3 className="text-xl font-black tracking-tight font-headline text-slate-900 dark:text-white">Como a sprint está</h3>
        <p className="mb-4 text-sm text-slate-500 dark:text-slate-400">
          {rollup ? 'Resumo dos itens da sprint, vindo do Jira.' : 'Os números aparecem aqui depois da primeira sincronização com o Jira.'}
        </p>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard label="Concluídos" value={done} unit={`de ${total} itens`} tone="ok" hint={total > 0 ? `${Math.round((done / total) * 100)}% do escopo da sprint` : 'Sem itens ainda'} />
          <StatCard label="Em andamento" value={inProgress} unit="itens" tone="info" hint={`${notStarted} ${notStarted === 1 ? 'ainda não foi iniciado' : 'ainda não foram iniciados'}`} />
          <StatCard
            label="Atrasados" value={overdue} unit="itens" tone={overdue > 0 ? 'warn' : 'neutral'}
            hint={overdue > 0 ? 'Prazo vencido e ainda não concluídos.' : 'Nenhum item com prazo vencido.'}
            action={overdue > 0 ? <button type="button" onClick={() => onOpenTab('plans')} className="text-sm font-semibold text-primary hover:underline">Ver no Cronograma</button> : undefined}
          />
          <StatCard label="Horas registradas" value={loggedH} unit="h" hint={estimateH > 0 ? `de ${estimateH} h estimadas no escopo` : 'Sem horas estimadas no Jira'} />
        </div>
      </section>

      <div className="flex flex-wrap items-start gap-8">
        {/* Cerimônias */}
        <section className="min-w-0 flex-[2_1_620px]">
          <h3 className="text-xl font-black tracking-tight font-headline text-slate-900 dark:text-white">Cerimônias do time</h3>
          <p className="mb-4 text-sm text-slate-500 dark:text-slate-400">Uma ferramenta para cada momento da sprint. Abra a que você precisa agora.</p>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {CEREMONIES.map(c => {
              const soon = !!c.soon;
              const body = (
                <>
                  <div className="flex items-center gap-3">
                    <span className={cn('flex h-10 w-10 items-center justify-center rounded-xl', c.tone)}><c.icon className="h-5 w-5" /></span>
                    <span className="text-lg font-black tracking-tight font-headline text-slate-900 dark:text-white">{c.name}</span>
                    {soon && <span className="ml-auto rounded-full border border-amber-500/50 px-2.5 py-0.5 text-xs font-semibold text-amber-600 dark:text-amber-400">Em breve</span>}
                  </div>
                  <p className="text-sm text-slate-600 dark:text-slate-300">{c.desc}</p>
                  {!soon && (
                    <span className="mt-auto flex items-center gap-1.5 text-sm font-semibold text-primary">Abrir <ArrowRight className="h-3.5 w-3.5" /></span>
                  )}
                </>
              );
              return soon ? (
                <div key={c.name} className="flex flex-col gap-3 rounded-2xl border border-dashed border-slate-300 dark:border-slate-700 bg-slate-50/60 dark:bg-slate-900/30 p-5 opacity-80">{body}</div>
              ) : (
                <Link key={c.name} href={c.href!} onClick={(e) => { e.preventDefault(); onNavigate(c.href!); }} className="flex flex-col gap-3 rounded-2xl border border-slate-200/70 dark:border-slate-800 bg-white dark:bg-slate-900/70 p-5 transition-colors hover:border-primary/60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary">
                  {body}
                </Link>
              );
            })}
          </div>
        </section>

        {/* Atenção e próximas cerimônias */}
        <section className="min-w-0 flex-[1_1_320px] space-y-5">
          <div className="rounded-2xl border border-slate-200/70 dark:border-slate-800 bg-white dark:bg-slate-900/70 p-5">
            <h3 className="mb-3 text-lg font-black tracking-tight font-headline text-slate-900 dark:text-white">Precisa de atenção</h3>
            {attention.length === 0 ? (
              <p className="text-sm text-slate-500 dark:text-slate-400">Nada pede atenção agora.</p>
            ) : (
              <ul className="space-y-3.5">
                {attention.map(a => (
                  <li key={a.text} className="flex items-start gap-3">
                    <span className={cn('mt-2 h-2.5 w-2.5 shrink-0 rounded-full', a.tone)} />
                    <p className="text-sm text-slate-700 dark:text-slate-200">
                      {a.text}{' '}
                      {a.actionLabel && a.onAction && (
                        <button type="button" onClick={a.onAction} className="font-semibold text-primary hover:underline">{a.actionLabel}</button>
                      )}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="rounded-2xl border border-slate-200/70 dark:border-slate-800 bg-white dark:bg-slate-900/70 p-5">
            <div className="mb-3 flex items-baseline justify-between gap-3">
              <h3 className="text-lg font-black tracking-tight font-headline text-slate-900 dark:text-white">Cerimônias combinadas</h3>
              <Link href="/painel" className="text-sm font-semibold text-primary hover:underline">Configurar horários</Link>
            </div>
            <SquadRituals />
          </div>

          <button
            type="button"
            onClick={() => onOpenTab('dashboards')}
            className="flex w-full items-center gap-3 rounded-2xl border border-slate-200/70 dark:border-slate-800 bg-white dark:bg-slate-900/70 p-4 text-left transition-colors hover:border-primary/60"
          >
            <Users className="h-5 w-5 text-primary shrink-0" />
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-bold text-slate-900 dark:text-white">Meu painel</span>
              <span className="block text-sm text-slate-500 dark:text-slate-400">Os números do seu papel na squad.</span>
            </span>
            <ArrowRight className="h-4 w-4 text-slate-400" />
          </button>
        </section>
      </div>
    </div>
  );
}
