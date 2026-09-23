'use client';

/**
 * /painel — Painel do Time.
 *
 * Porta de entrada pós-onboarding: o que a squad está entregando agora, numa
 * tela só. Não duplica o /squad (que segue com board completo, planos, pulse e
 * performance) — aqui fica a leitura de 3 segundos, com link pro detalhe.
 *
 * Todo número vem de dado real (useSquadDashboardData -> rollup + issues +
 * members). Sem mock: quando a squad não sincronizou ainda, a tela diz isso.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  LayoutDashboard,
  RefreshCw,
  ArrowRight,
  ArrowUpRight,
  Users,
  CircleAlert,
  Clock,
  Activity,
  Compass,
  X,
} from 'lucide-react';
import { formatDistanceToNow, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';

import { RoomHeader } from '@/components/layout/RoomHeader';
import { Footer } from '@/components/layout/Footer';
import { FeedbackWidget } from '@/components/feedback-widget';
import { NextCeremonyCard } from '@/components/painel/NextCeremonyCard';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { AgileSpinner } from '@/components/ui/AgileSpinner';
import { useUserContext } from '@/context/UserContext';
import { useSquadDashboardData } from '@/hooks/useSquadDashboardData';
import type { SquadIssueSnapshot } from '@/lib/types';
import { cn } from '@/lib/utils';

/** Atalhos de cerimônia/ferramenta mostrados no cartão "Explorar". */
const EXPLORE_SHORTCUTS = [
  { label: 'Poker', href: '/room' },
  { label: 'Retro', href: '/retro' },
  { label: 'Showcase', href: '/showcase' },
  { label: 'Health Check', href: '/health-check' },
  { label: 'Brainstorming', href: '/brainstorming' },
];

function initials(name?: string) {
  const clean = (name || '').trim();
  if (!clean) return '??';
  const parts = clean.split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function timeAgo(iso?: string) {
  if (!iso) return '';
  try {
    return formatDistanceToNow(parseISO(iso), { addSuffix: true, locale: ptBR });
  } catch {
    return '';
  }
}

function byUpdatedDesc(a: SquadIssueSnapshot, b: SquadIssueSnapshot) {
  return (b.updatedAtJira || '').localeCompare(a.updatedAtJira || '');
}

export default function PainelPage() {
  const router = useRouter();
  const { userProfile } = useUserContext();
  const [feedbackSignal, setFeedbackSignal] = useState<number | undefined>();
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [capacityNoticeDismissed, setCapacityNoticeDismissed] = useState(true);

  const {
    squadId,
    loading,
    error,
    rollup,
    issues,
    members,
    myIssues,
    sprintName,
    refresh,
  } = useSquadDashboardData();

  useEffect(() => {
    if (typeof document !== 'undefined') {
      document.title = squadId ? `Painel ${squadId} | Espaço Ágil` : 'Painel do Time | Espaço Ágil';
    }
  }, [squadId]);

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    try {
      await refresh();
    } finally {
      setIsRefreshing(false);
    }
  }, [refresh]);

  // Progresso da sprint: contagem de issues (o rollup é por issue/hora, não por
  // story point — ver SquadMetricsRollup).
  const stats = useMemo(() => {
    const total = rollup?.totalIssues ?? issues.length;
    const done = rollup?.doneIssues ?? issues.filter(i => i.statusCategory === 'done').length;
    const inProgress =
      rollup?.inProgressIssues ?? issues.filter(i => i.statusCategory === 'indeterminate').length;
    const todo = Math.max(total - done - inProgress, 0);
    const pct = total > 0 ? Math.round((done / total) * 100) : 0;
    return { total, done, inProgress, todo, pct };
  }, [rollup, issues]);

  const myKeys = useMemo(() => new Set(myIssues.map(i => i.key)), [myIssues]);

  const columns = useMemo(() => {
    const sorted = [...issues].sort(byUpdatedDesc);
    return [
      {
        id: 'todo',
        label: 'A fazer',
        accent: 'text-slate-500 dark:text-slate-400',
        items: sorted.filter(i => i.statusCategory === 'new' || i.statusCategory === 'unknown'),
      },
      {
        id: 'doing',
        label: 'Em andamento',
        accent: 'text-amber-600 dark:text-amber-400',
        items: sorted.filter(i => i.statusCategory === 'indeterminate'),
      },
      {
        id: 'done',
        label: 'Concluído',
        accent: 'text-emerald-600 dark:text-emerald-400',
        items: sorted.filter(i => i.statusCategory === 'done'),
      },
    ];
  }, [issues]);

  const movements = useMemo(() => [...issues].sort(byUpdatedDesc).slice(0, 5), [issues]);

  const lastSync = useMemo(() => {
    const latest = issues.reduce<string>((acc, i) => (i.syncedAt > acc ? i.syncedAt : acc), '');
    return latest || rollup?.computedAt || '';
  }, [issues, rollup]);

  const myRole = useMemo(() => {
    const email = (userProfile?.email || '').toLowerCase().trim();
    const name = (userProfile?.name || '').toLowerCase().trim();
    const me = members.find(
      m =>
        (!!email && (m.email || '').toLowerCase().trim() === email) ||
        (!!name && (m.displayName || '').toLowerCase().trim() === name)
    );
    return me?.role || userProfile?.role || '';
  }, [members, userProfile]);

  const hasSquad = !!squadId;
  const hasData = issues.length > 0 || !!rollup;

  // Capacidade: ninguém do time tem hora/dia definida (nem manual, nem calculada
  // pelo sistema) — a sprint até aparece, mas a capacidade sai torta. É um aviso
  // dispensável de propósito: não é tarefa obrigatória de onboarding.
  const capacityMissing = useMemo(
    () =>
      members.length > 0 &&
      members.every(m => !m.capacityHoursPerDay && !m.systemCalculatedCapacityHoursPerDay),
    [members]
  );

  useEffect(() => {
    if (!squadId) return;
    try {
      setCapacityNoticeDismissed(
        localStorage.getItem(`agileSpace_painel_capacityNotice_${squadId}`) === '1'
      );
    } catch {
      setCapacityNoticeDismissed(false);
    }
  }, [squadId]);

  const dismissCapacityNotice = useCallback(() => {
    setCapacityNoticeDismissed(true);
    try {
      localStorage.setItem(`agileSpace_painel_capacityNotice_${squadId}`, '1');
    } catch {
      /* modo privado / storage bloqueado: some só nesta sessão */
    }
  }, [squadId]);

  if (loading) {
    return (
      <div className="min-h-dvh flex items-center justify-center">
        <AgileSpinner />
      </div>
    );
  }

  return (
    <div className="relative flex flex-col min-h-dvh w-full bg-[#fafafa] dark:bg-slate-950 text-slate-900 dark:text-slate-100 overflow-x-hidden">
      <div className="fixed top-0 left-0 w-full h-full -z-10 pointer-events-none overflow-hidden">
        <div className="absolute top-[-15%] left-[-10%] w-[60%] h-[60%] bg-primary/5 rounded-full blur-[150px]" />
        <div className="absolute bottom-[-15%] right-[-10%] w-[55%] h-[55%] bg-blue-500/5 rounded-full blur-[140px]" />
      </div>

      <RoomHeader
        title={squadId ? `Painel · ${squadId}` : 'Painel do Time'}
        toolIcon={<LayoutDashboard className="h-4 w-4" />}
        toolColorClass="text-primary"
        onOpenFeedback={() => setFeedbackSignal(Date.now())}
        badge={
          <Badge
            variant="outline"
            className="bg-primary/10 text-primary border-primary/20 font-black uppercase text-[9px] tracking-widest px-2.5 py-0.5 rounded-full"
          >
            Seu time agora
          </Badge>
        }
        actions={
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            disabled={isRefreshing || !hasSquad}
            className="h-9 rounded-xl text-[11px] font-black uppercase tracking-widest gap-2"
          >
            <RefreshCw className={cn('h-3.5 w-3.5', isRefreshing && 'animate-spin')} />
            Atualizar
          </Button>
        }
      />

      <main className="relative z-10 flex-1 w-full px-4 md:px-8 lg:px-10 py-6 space-y-4">
        {!hasSquad ? (
          <EmptyState
            title="Você ainda não está em uma squad"
            description="Entre em um time pra ver sprint, board e movimentos aqui."
            actionLabel="Escolher meu time"
            onAction={() => router.push('/onboarding')}
          />
        ) : !hasData ? (
          <EmptyState
            title={`A squad ${squadId} ainda não sincronizou com o Jira`}
            description={
              error
                ? `Não consegui ler as métricas: ${error}`
                : 'Assim que a primeira sincronização rodar, sprint, board e movimentos aparecem aqui.'
            }
            actionLabel="Abrir configuração da squad"
            onAction={() => router.push('/squad')}
          />
        ) : (
          <>
            {error && (
              <div className="flex items-center gap-2.5 rounded-2xl border border-amber-500/30 bg-amber-500/5 px-4 py-2.5">
                <CircleAlert className="h-4 w-4 text-amber-500 shrink-0" />
                <p className="text-xs text-amber-700 dark:text-amber-300">
                  Alguns dados podem estar defasados: {error}
                </p>
              </div>
            )}

            {capacityMissing && !capacityNoticeDismissed && (
              <div className="flex items-center gap-3 rounded-2xl border border-amber-500/30 bg-amber-500/5 px-4 py-2.5">
                <Clock className="h-4 w-4 text-amber-500 shrink-0" />
                <p className="flex-1 text-xs text-amber-700 dark:text-amber-300 leading-snug">
                  A capacidade da sprint fica mais precisa com as horas do time — leva 1 minuto e não precisa ser agora.
                </p>
                <Button
                  asChild
                  size="sm"
                  variant="outline"
                  className="h-8 rounded-lg text-[10px] font-black uppercase tracking-widest border-amber-500/30 text-amber-700 dark:text-amber-300 hover:bg-amber-500/10"
                >
                  <Link href="/squad/roster">Configurar</Link>
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={dismissCapacityNotice}
                  aria-label="Dispensar aviso de capacidade"
                  className="h-8 w-8 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                >
                  <X className="h-3.5 w-3.5" />
                </Button>
              </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)] gap-4">
              {/* COLUNA PRINCIPAL */}
              <div className="flex flex-col gap-4 min-w-0">
                {/* SPRINT */}
                <section className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-white/70 dark:bg-slate-900/70 backdrop-blur-xl p-6 shadow-sm">
                  <div className="flex items-start justify-between gap-4 flex-wrap">
                    <div className="min-w-0">
                      <div className="text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400">
                        {sprintName}
                      </div>
                      <h2 className="mt-1.5 text-2xl font-black tracking-tight">
                        {typeof rollup?.workdaysRemaining === 'number'
                          ? `Faltam ${rollup.workdaysRemaining} dias úteis`
                          : `${stats.total} itens na sprint`}
                      </h2>
                    </div>
                    <div className="text-right">
                      <div className="text-3xl font-black text-emerald-600 dark:text-emerald-400 leading-none">
                        {stats.pct}%
                      </div>
                      <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                        {stats.done} de {stats.total} itens
                      </div>
                    </div>
                  </div>

                  <div className="mt-5 h-2 rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-emerald-600 to-emerald-400 transition-all"
                      style={{ width: `${stats.pct}%` }}
                    />
                  </div>

                  <div className="mt-4 flex items-center gap-4 flex-wrap text-[11px] font-bold text-slate-500 dark:text-slate-400">
                    <span>{stats.inProgress} em andamento</span>
                    <span>{stats.todo} a fazer</span>
                    {!!rollup?.staleIssues && <span className="text-amber-600 dark:text-amber-400">{rollup.staleIssues} parados</span>}
                    {!!rollup?.overdueIssues && <span className="text-rose-600 dark:text-rose-400">{rollup.overdueIssues} atrasados</span>}
                    {!!lastSync && (
                      <span className="ml-auto inline-flex items-center gap-1.5 font-medium">
                        <Clock className="h-3 w-3" /> sincronizado {timeAgo(lastSync)}
                      </span>
                    )}
                  </div>
                </section>

                {/* BOARD RESUMIDO */}
                <section className="flex-1 rounded-3xl border border-slate-200 dark:border-slate-800 bg-white/70 dark:bg-slate-900/70 backdrop-blur-xl p-5 shadow-sm">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400">
                      Board da sprint
                    </h3>
                    <Link
                      href="/squad"
                      className="text-[11px] font-black uppercase tracking-widest text-primary hover:opacity-80 inline-flex items-center gap-1"
                    >
                      Board completo <ArrowUpRight className="h-3.5 w-3.5" />
                    </Link>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    {columns.map(col => (
                      <div
                        key={col.id}
                        className="rounded-2xl border border-slate-200/80 dark:border-slate-800/80 bg-slate-50/60 dark:bg-slate-950/40 p-3 flex flex-col gap-2.5 min-w-0"
                      >
                        <div className="flex items-center justify-between">
                          <span className={cn('text-[11px] font-black uppercase tracking-wider', col.accent)}>
                            {col.label}
                          </span>
                          <span className="text-[10px] font-black text-slate-500 dark:text-slate-400 bg-slate-200/70 dark:bg-slate-800/70 px-2 py-0.5 rounded-full">
                            {col.items.length}
                          </span>
                        </div>

                        {col.items.length === 0 ? (
                          <p className="text-[11px] text-slate-400 dark:text-slate-600 py-3 text-center">
                            nada por aqui
                          </p>
                        ) : (
                          col.items.slice(0, 3).map(item => (
                            <article
                              key={item.key}
                              className={cn(
                                'rounded-xl border bg-white dark:bg-slate-900 p-2.5 min-w-0',
                                myKeys.has(item.key)
                                  ? 'border-primary/40'
                                  : 'border-slate-200 dark:border-slate-800'
                              )}
                            >
                              <div className="flex items-center justify-between gap-2">
                                <span className="text-[10px] font-black tracking-wider text-primary truncate">
                                  {item.key}
                                </span>
                                {myKeys.has(item.key) && (
                                  <span className="text-[9px] font-black uppercase text-primary bg-primary/10 px-1.5 py-0.5 rounded-full shrink-0">
                                    seu
                                  </span>
                                )}
                              </div>
                              {/* O snapshot do squad não guarda o summary da issue (só
                                  parent_title) — mesma razão pela qual o board do /squad
                                  também rotula o card pela chave. Sem título inventado. */}
                              <p className="text-[12px] leading-snug mt-1 line-clamp-2">
                                {item.title || item.parentTitle || item.assigneeName || 'sem responsável'}
                              </p>
                            </article>
                          ))
                        )}

                        {col.items.length > 3 && (
                          <span className="text-[10px] text-slate-500 dark:text-slate-400 text-center">
                            e mais {col.items.length - 3}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                </section>
              </div>

              {/* COLUNA LATERAL */}
              <div className="flex flex-col gap-4 min-w-0">
                {/* PRÓXIMA CERIMÔNIA */}
                <NextCeremonyCard squadId={squadId} userKey={userProfile?.email || userProfile?.id || ''} />

                {/* SEU TIME */}
                <section className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-white/70 dark:bg-slate-900/70 backdrop-blur-xl p-5 shadow-sm">
                  <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400 mb-3 flex items-center gap-1.5">
                    <Users className="h-3.5 w-3.5" /> Seu time
                  </h3>

                  {members.length === 0 ? (
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      Nenhuma pessoa cadastrada na squad ainda.
                    </p>
                  ) : (
                    <div className="flex items-center gap-3">
                      <div className="flex items-center">
                        {members.slice(0, 4).map(m => (
                          <div
                            key={m.dbId || m.jiraAccountId}
                            title={m.displayName}
                            className="w-8 h-8 rounded-full bg-slate-200 dark:bg-slate-800 border-2 border-white dark:border-slate-900 -ml-2 first:ml-0 flex items-center justify-center text-[10px] font-black text-slate-600 dark:text-slate-300"
                          >
                            {initials(m.displayName)}
                          </div>
                        ))}
                        {members.length > 4 && (
                          <div className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-900 border-2 border-white dark:border-slate-900 -ml-2 flex items-center justify-center text-[10px] font-black text-slate-500">
                            +{members.length - 4}
                          </div>
                        )}
                      </div>
                      <p className="text-xs text-slate-600 dark:text-slate-300 leading-snug">
                        {members.length} pessoas
                        {myRole ? (
                          <>
                            {' '}· você é <strong className="font-black">{myRole}</strong>
                          </>
                        ) : null}
                      </p>
                    </div>
                  )}

                  <Link
                    href="/squad"
                    className="mt-3 inline-flex items-center gap-1 text-[11px] font-black uppercase tracking-widest text-primary hover:opacity-80"
                  >
                    Gestão do time <ArrowRight className="h-3.5 w-3.5" />
                  </Link>
                </section>

                {/* MOVIMENTOS */}
                <section className="flex-1 rounded-3xl border border-slate-200 dark:border-slate-800 bg-white/70 dark:bg-slate-900/70 backdrop-blur-xl p-5 shadow-sm min-h-0">
                  <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400 mb-3 flex items-center gap-1.5">
                    <Activity className="h-3.5 w-3.5" /> Últimos movimentos
                  </h3>

                  <div className="space-y-3">
                    {movements.map(item => (
                      <div key={item.key} className="flex gap-2.5 min-w-0">
                        <div className="w-7 h-7 rounded-full bg-slate-200 dark:bg-slate-800 flex items-center justify-center text-[9px] font-black text-slate-600 dark:text-slate-300 shrink-0">
                          {initials(item.assigneeName)}
                        </div>
                        <p className="text-[12px] text-slate-600 dark:text-slate-300 leading-snug min-w-0">
                          <strong className="font-black text-slate-900 dark:text-slate-100">
                            {item.assigneeName || 'Sem responsável'}
                          </strong>{' '}
                          · {item.key} em <span className="font-bold">{item.status}</span>
                          <span className="block text-[11px] text-slate-400 dark:text-slate-500">
                            {timeAgo(item.updatedAtJira)}
                          </span>
                        </p>
                      </div>
                    ))}
                  </div>
                </section>

                {/* EXPLORAR */}
                <section className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-white/70 dark:bg-slate-900/70 backdrop-blur-xl p-5 shadow-sm">
                  <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400 mb-3 flex items-center gap-1.5">
                    <Compass className="h-3.5 w-3.5" /> Explorar o Espaço Ágil
                  </h3>

                  <div className="grid grid-cols-3 gap-2">
                    {EXPLORE_SHORTCUTS.map(s => (
                      <Link
                        key={s.href}
                        href={s.href}
                        className="text-center text-[11px] font-bold rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/50 py-1.5 px-1 text-slate-600 dark:text-slate-300 hover:border-primary/40 hover:text-primary transition-colors truncate"
                      >
                        {s.label}
                      </Link>
                    ))}
                  </div>

                  <Button asChild variant="outline" className="w-full mt-3 h-10 rounded-xl text-[11px] font-black uppercase tracking-widest gap-2">
                    <Link href="/">
                      Ir pra home e ver tudo <ArrowRight className="h-3.5 w-3.5" />
                    </Link>
                  </Button>
                </section>
              </div>
            </div>
          </>
        )}
      </main>

      <Footer onOpenFeedback={() => setFeedbackSignal(Date.now())} />
      <FeedbackWidget toolName="Espaço Ágil - Painel do Time" triggerVariant="none" externalTriggerSignal={feedbackSignal} />
    </div>
  );
}

function EmptyState({
  title,
  description,
  actionLabel,
  onAction,
}: {
  title: string;
  description: string;
  actionLabel: string;
  onAction: () => void;
}) {
  return (
    <div className="rounded-3xl border border-dashed border-slate-300 dark:border-slate-700 bg-white/60 dark:bg-slate-900/60 p-10 flex flex-col items-center text-center gap-3">
      <div className="w-12 h-12 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center">
        <LayoutDashboard className="h-5 w-5 text-primary" />
      </div>
      <h2 className="text-xl font-black tracking-tight">{title}</h2>
      <p className="text-sm text-slate-500 dark:text-slate-400 max-w-md leading-relaxed">{description}</p>
      <Button onClick={onAction} className="mt-2 h-11 rounded-xl text-[11px] font-black uppercase tracking-widest gap-2">
        {actionLabel} <ArrowRight className="h-4 w-4" />
      </Button>
    </div>
  );
}
