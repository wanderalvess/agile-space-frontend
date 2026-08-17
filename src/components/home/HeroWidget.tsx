'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useUserContext } from '@/context/UserContext';
import { useFirebase } from '@/firebase';
import { useDailyStore } from '@/store/useDailyStore';
import { ThemeToggle } from '@/components/layout/ThemeToggle';
import { motion } from 'framer-motion';
import {
  Zap,
  ArrowRight,
  Clock,
  TrendingUp,
  Plus,
  Headphones,
} from 'lucide-react';
import { useCalmariaStore } from '@/store/useCalmariaStore';
import { cn } from '@/lib/utils';

// Jira Icon SVG
function JiraIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
      <path d="M11.53 2c0 0-5.32.74-5.32 6.8 0 4.1 3.23 4.8 3.23 4.8l-4.14 4.54s-3.66-3.21-3.66-6.4C1.64 6 5.8.55 5.8.55h5.73zM12.47 22c0 0 5.32-.74 5.32-6.8 0-4.1-3.23-4.8-3.23-4.8l4.14-4.54s-3.66 3.21 3.66 6.4c0 5.75-4.16 11.2-4.16 11.2h-5.73z" />
    </svg>
  );
}

const DAILY_TIPS = [
  "Revise suas pendências antes de iniciar blocos de foco intensos.",
  "O modo foco (Calmaria) ajuda a evitar distrações durante o deep work.",
  "Lembre-se de registrar suas horas no Jira para manter o painel atualizado.",
  "Um bom planejamento diário é o primeiro passo para um dia produtivo.",
  "Pausas curtas e estratégicas mantêm a sua energia em alta.",
  "Sincronize seu Timesheet regularmente para evitar acúmulo de horas.",
  "Priorize as tarefas de maior impacto no início do dia.",
  "Mantenha seu backlog limpo e foque no que precisa ser entregue hoje."
];

export function HeroWidget() {
  const router = useRouter();
  const { toggleOpen, isTimerRunning, activeSounds } = useCalmariaStore();
  const isFocusActive = isTimerRunning || Object.keys(activeSounds).length > 0;
  const { userProfile, requestIdentity, isInitializing } = useUserContext();
  const { user, firestore } = useFirebase();
  const {
    worklogs,
    weeklyWorklogs,
    fetchWorklogs,
    fetchWeeklyWorklogs,
    selectedDate,
  } = useDailyStore();

  const [greeting, setGreeting] = useState('Olá');
  const [dateString, setDateString] = useState('');
  const [phraseIndex, setPhraseIndex] = useState(0);

  useEffect(() => {
    setPhraseIndex(Math.floor(Math.random() * DAILY_TIPS.length));
    const interval = setInterval(() => {
      setPhraseIndex((prev) => (prev + 1) % DAILY_TIPS.length);
    }, 8000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const hr = new Date().getHours();
    if (hr < 12) setGreeting('Bom dia');
    else if (hr < 18) setGreeting('Boa tarde');
    else setGreeting('Boa noite');

    const options: Intl.DateTimeFormatOptions = {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
    };
    let dateStr = new Date().toLocaleDateString('pt-BR', options);
    dateStr = dateStr.charAt(0).toUpperCase() + dateStr.slice(1);
    setDateString(dateStr);
  }, []);

  useEffect(() => {
    if (firestore && user) {
      fetchWorklogs(firestore, user.uid, selectedDate);
      fetchWeeklyWorklogs(firestore, user.uid);
    }
  }, [firestore, user, selectedDate, fetchWorklogs, fetchWeeklyWorklogs]);

  const userName = userProfile?.name?.split(' ')[0] || 'Visitante';

  // Today hours
  const todayMinutes = worklogs.reduce((acc, log) => acc + log.durationMinutes, 0);
  const todayH = Math.floor(todayMinutes / 60);
  const todayM = todayMinutes % 60;
  const todayHoursStr = todayMinutes > 0 ? `${todayH}h${todayM > 0 ? ` ${todayM}m` : ''}` : '0h';

  // Yesterday hours
  const yDate = new Date();
  yDate.setDate(yDate.getDate() - 1);
  const yesterdayStr = `${yDate.getFullYear()}-${String(yDate.getMonth() + 1).padStart(2, '0')}-${String(yDate.getDate()).padStart(2, '0')}`;
  const yesterdayLogs = weeklyWorklogs.filter((w) => w.date === yesterdayStr);
  const yesterdayMinutes = yesterdayLogs.reduce((acc, log) => acc + log.durationMinutes, 0);
  const yesterdayH = Math.floor(yesterdayMinutes / 60);
  const yesterdayM = yesterdayMinutes % 60;
  const yesterdayHoursStr = yesterdayMinutes > 0 ? `${yesterdayH}h${yesterdayM > 0 ? ` ${yesterdayM}m` : ''}` : '0h';

  // Progress bar (meta: 8h = 480min)
  const progressPct = Math.min(100, Math.round((todayMinutes / 480) * 100));

  if (isInitializing) {
    return (
      <div className="w-full bg-white/60 dark:bg-slate-900/60 backdrop-blur-xl rounded-[2.5rem] border border-white/60 dark:border-slate-800/60 shadow-lg min-h-[240px] animate-pulse p-8 md:p-10" />
    );
  }

  return (
    <div className="w-full relative overflow-hidden bg-white/60 dark:bg-slate-900/60 backdrop-blur-xl rounded-[2.5rem] border border-white/60 dark:border-slate-800/60 shadow-lg shadow-slate-200/50 dark:shadow-none group">
      {/* Ambient gradient orb — top left */}
      <div className="absolute top-[-30%] left-[-5%] w-[40%] h-[150%] bg-primary/5 dark:bg-primary/10 rounded-full blur-[120px] pointer-events-none transition-transform duration-700 group-hover:scale-110" />
      {/* Ambient gradient orb — right */}
      <div className="absolute top-[-20%] right-[-5%] w-[30%] h-[140%] bg-blue-500/5 dark:bg-blue-500/10 rounded-full blur-[100px] pointer-events-none" />

      <div className="relative z-10 flex flex-col lg:flex-row min-h-[240px]">

        {/* ─── LEFT: Greeting ─────────────────────────────────── */}
        <div className="flex-1 flex flex-col justify-between p-8 md:p-10 lg:pr-6">
          {/* Top bar */}
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 dark:text-slate-500">
                Resumo Diário
              </span>
              <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
            </div>
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon"
                onClick={(e) => {
                  e.preventDefault();
                  toggleOpen();
                }}
                className={cn(
                  "h-6 w-6 rounded-lg transition-all relative border-none",
                  isFocusActive 
                    ? "bg-orange-50 hover:bg-orange-100 dark:bg-orange-950/20 text-orange-500" 
                    : "text-slate-400 hover:text-orange-500 hover:bg-orange-100/50 dark:hover:bg-slate-800/50"
                )}
                title="Modo de Foco (Calmaria)"
              >
                <Headphones className={cn("h-3.5 w-3.5", isFocusActive && "animate-pulse")} />
                {isFocusActive && (
                  <span className="absolute -top-0.5 -right-0.5 flex h-1.5 w-1.5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-orange-400 opacity-75 animate-duration-1000"></span>
                    <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-orange-500"></span>
                  </span>
                )}
              </Button>
              <ThemeToggle className="h-6 w-6 rounded-lg border-none hover:bg-slate-100/50 dark:hover:bg-slate-800/50 text-slate-400 hover:text-slate-900 transition-all dark:hover:text-slate-100" />
            </div>
          </div>

          {/* Greeting text */}
          <div className="space-y-3 flex-1 flex flex-col justify-center">
            <h1 className="text-3xl md:text-5xl font-black tracking-tight text-slate-900 dark:text-slate-100 leading-tight">
              {greeting},{' '}
              <span className="text-primary">{userName}!</span>
            </h1>
            <div className="text-sm font-medium text-slate-500 dark:text-slate-400 leading-relaxed max-w-sm min-h-[40px] flex items-start">
              {userProfile ? (
                <motion.span
                  key={phraseIndex}
                  initial={{ opacity: 0, y: 5 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5 }}
                >
                  {DAILY_TIPS[phraseIndex]}
                </motion.span>
              ) : (
                <span>Faça login para visualizar suas atividades e conectar-se ao seu time.</span>
              )}
            </div>

            {/* Date pill */}
            {dateString && (
              <span className="inline-flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-500 mt-1">
                <Clock className="h-3 w-3" />
                {dateString}
              </span>
            )}
          </div>

          {/* CTA for guest */}
          {!userProfile && (
            <div className="mt-6">
              <Button
                onClick={() => requestIdentity()}
                className="bg-primary hover:bg-orange-600 text-white font-extrabold uppercase text-[10px] tracking-widest rounded-xl h-10 px-6 active:scale-95 transition-all shadow-md flex items-center gap-2 w-fit border-none"
              >
                <Zap className="h-4 w-4 text-white animate-pulse" /> Fazer Login
              </Button>
            </div>
          )}
        </div>

        {/* ─── DIVIDER ────────────────────────────────────────── */}
        <div className="hidden lg:block w-px bg-gradient-to-b from-transparent via-slate-200 dark:via-slate-700 to-transparent my-6 shrink-0" />
        <div className="block lg:hidden h-px mx-8 bg-gradient-to-r from-transparent via-slate-200 dark:via-slate-700 to-transparent shrink-0" />

        {/* ─── RIGHT: Timesheet ────────────────────────────────── */}
        <div className="lg:w-[360px] xl:w-[420px] flex flex-col justify-between p-8 md:p-10 lg:pl-8">

          {/* Header */}
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-blue-600 to-blue-500 flex items-center justify-center shadow-md shadow-blue-500/20 shrink-0">
                <JiraIcon className="w-4 h-4 text-white" />
              </div>
              <div>
                <span className="block text-[11px] font-black text-slate-800 dark:text-slate-200 uppercase tracking-wider leading-none">
                  Timesheet
                </span>
                <span className="block text-[9px] font-bold text-slate-500 dark:text-slate-500 uppercase tracking-widest leading-none mt-0.5">
                  Conectado ao Jira
                </span>
              </div>
            </div>
            {user && (
              <Badge
                variant="outline"
                className="bg-emerald-50 dark:bg-emerald-950/30 border-emerald-100 dark:border-emerald-900/50 text-emerald-600 dark:text-emerald-400 text-[9px] font-extrabold uppercase tracking-wider py-0.5 px-2"
              >
                Sincronizado
              </Badge>
            )}
          </div>

          {/* Content: logged vs guest */}
          {user ? (
            <div className="flex-1 flex flex-col gap-4">

              {/* Today stat */}
              <div className="bg-slate-50/80 dark:bg-slate-900/60 rounded-2xl p-4 border border-slate-100 dark:border-slate-800/80">
                <div className="flex items-baseline justify-between mb-3">
                  <span className="text-[9px] font-extrabold text-slate-600 dark:text-slate-500 uppercase tracking-widest">
                    Hoje
                  </span>
                  <span className="text-2xl font-black text-slate-900 dark:text-slate-100 leading-none tabular-nums">
                    {todayHoursStr}
                    <span className="text-[9px] font-bold text-slate-500 dark:text-slate-500 ml-1">
                      lançadas
                    </span>
                  </span>
                </div>

                {/* Progress bar */}
                <div className="w-full h-1.5 bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden mb-3">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${progressPct}%` }}
                    transition={{ duration: 1, ease: 'easeOut', delay: 0.3 }}
                    className="h-full bg-gradient-to-r from-blue-500 to-blue-400 rounded-full"
                  />
                </div>

                {/* Worklog list */}
                <div className="space-y-2 max-h-[90px] overflow-y-auto no-scrollbar">
                  {worklogs.length === 0 ? (
                    <p className="text-[10px] font-bold text-slate-500 text-center py-1 uppercase tracking-wider">
                      Nenhum registro hoje
                    </p>
                  ) : (
                    worklogs.map((log) => {
                      const h = Math.floor(log.durationMinutes / 60);
                      const m = log.durationMinutes % 60;
                      return (
                        <div key={log.id} className="flex items-center justify-between text-[11px] min-w-0 gap-2">
                          <div className="flex items-center gap-1.5 min-w-0 flex-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-blue-500 shrink-0" />
                            <span className="font-semibold text-slate-700 dark:text-slate-300 truncate">
                              {log.taskId ? `[${log.taskId}] ${log.title}` : log.title}
                            </span>
                          </div>
                          <span className="font-black text-slate-600 dark:text-slate-400 shrink-0 tabular-nums text-[10px]">
                            {h > 0 ? `${h}h` : ''}{m > 0 ? `${m}m` : ''}
                          </span>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

              {/* Yesterday + actions row */}
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 bg-slate-50/80 dark:bg-slate-900/60 border border-slate-100 dark:border-slate-800/80 rounded-xl px-3 py-2">
                  <TrendingUp className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                  <div className="flex flex-col">
                    <span className="text-[8px] font-bold text-slate-500 uppercase tracking-widest leading-none">Ontem</span>
                    <span className="text-[12px] font-black text-slate-700 dark:text-slate-300 leading-none mt-0.5 tabular-nums">
                      {yesterdayHoursStr}
                    </span>
                  </div>
                </div>

                <div className="flex gap-2 flex-1 justify-end">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => router.push('/daily-flow')}
                    className="h-9 text-[9px] font-extrabold uppercase tracking-widest text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-xl transition-all border border-blue-100 dark:border-blue-900/30 gap-1.5 px-3"
                  >
                    Ver tudo <ArrowRight className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            </div>
          ) : (
            /* Guest state */
            <div className="flex-1 flex flex-col items-center justify-center text-center gap-4 py-4">
              <div className="w-12 h-12 rounded-2xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center">
                <JiraIcon className="w-6 h-6 text-slate-400 dark:text-slate-500" />
              </div>
              <div>
                <p className="text-[11px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400 mb-1">
                  Timesheet Disponível
                </p>
                <p className="text-[10px] text-slate-500 dark:text-slate-500 leading-snug max-w-[200px] mx-auto">
                  Faça login para ver suas horas lançadas e sincronizar com o Jira
                </p>
              </div>
              <Button
                size="sm"
                onClick={() => requestIdentity()}
                className="h-9 bg-blue-600 hover:bg-blue-700 text-white font-extrabold uppercase text-[9px] tracking-widest rounded-xl border-none gap-1.5 px-4 transition-all active:scale-95"
              >
                <Plus className="h-3.5 w-3.5" />
                Conectar Jira
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
