'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useFirebase } from '@/firebase';
import { useDailyStore } from '@/store/useDailyStore';
import { CheckCircle2, Lock } from 'lucide-react';

export function TimesheetWidget() {
  const router = useRouter();
  const { user, firestore } = useFirebase();
  const {
    worklogs,
    weeklyWorklogs,
    fetchWorklogs,
    fetchWeeklyWorklogs
  } = useDailyStore();

  const [dateString, setDateString] = useState('');

  // Data de hoje calculada localmente — não usa o `selectedDate` do store,
  // que é compartilhado com o navegador de dias do Daily Flow e fica preso
  // no último dia visto lá em vez de sempre mostrar "hoje" aqui no widget.
  const now = new Date();
  const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      const options: Intl.DateTimeFormatOptions = { weekday: 'long', day: 'numeric', month: 'long' };
      let dateStr = now.toLocaleDateString('pt-BR', options);
      dateStr = dateStr.charAt(0).toUpperCase() + dateStr.slice(1);
      setDateString(dateStr);
    };
    updateTime();
  }, []);

  useEffect(() => {
    if (firestore && user) {
      fetchWorklogs(firestore, user.uid, todayStr);
      fetchWeeklyWorklogs(firestore, user.uid);
    }
  }, [firestore, user, todayStr, fetchWorklogs, fetchWeeklyWorklogs]);

  // Calculate real hours for today
  const todayMinutes = worklogs.reduce((acc, log) => acc + log.durationMinutes, 0);
  const todayHoursStr = todayMinutes > 0 ? `${Math.floor(todayMinutes / 60)}h ${todayMinutes % 60}m` : '0h';

  // Calculate real hours for yesterday
  const yesterdayDate = new Date();
  yesterdayDate.setDate(yesterdayDate.getDate() - 1);
  const yY = yesterdayDate.getFullYear();
  const yM = String(yesterdayDate.getMonth() + 1).padStart(2, '0');
  const yD = String(yesterdayDate.getDate()).padStart(2, '0');
  const yesterdayStr = `${yY}-${yM}-${yD}`;
  
  const yesterdayLogs = weeklyWorklogs.filter(w => w.date === yesterdayStr);
  const yesterdayMinutes = yesterdayLogs.reduce((acc, log) => acc + log.durationMinutes, 0);
  const yesterdayHoursStr = yesterdayMinutes > 0 ? `${Math.floor(yesterdayMinutes / 60)}h ${yesterdayMinutes % 60}m` : '0h';

  return (
    <div className="w-full h-full flex flex-col justify-between p-7 bg-white/60 dark:bg-slate-900/60 backdrop-blur-xl rounded-[2.5rem] border border-slate-200 dark:border-slate-800 shadow-lg hover:shadow-2xl dark:shadow-none transition-all duration-500 relative overflow-hidden group">
      {/* Decorative JIRA background */}
      <div className="absolute top-[-10px] right-[-10px] p-4 opacity-[0.03] dark:opacity-[0.01] group-hover:opacity-[0.06] group-hover:scale-110 transition-all duration-500 pointer-events-none">
        <svg viewBox="0 0 24 24" fill="currentColor" className="w-32 h-32 text-blue-600 dark:text-blue-500">
          <path d="M11.53 2c0 0-5.32.74-5.32 6.8 0 4.1 3.23 4.8 3.23 4.8l-4.14 4.54s-3.66-3.21-3.66-6.4C1.64 6 5.8.55 5.8.55h5.73zM12.47 22c0 0 5.32-.74 5.32-6.8 0-4.1-3.23-4.8-3.23-4.8l4.14-4.54s-3.66 3.21 3.66 6.4c0 5.75-4.16 11.2-4.16 11.2h-5.73z"/>
        </svg>
      </div>

      <div className="relative z-10 flex flex-col justify-between h-full w-full">
        <div>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-600 to-blue-500 flex items-center justify-center shadow-md shadow-blue-500/20 animate-in fade-in duration-500">
                <svg viewBox="0 0 24 24" fill="white" className="w-4 h-4">
                  <path d="M11.53 2c0 0-5.32.74-5.32 6.8 0 4.1 3.23 4.8 3.23 4.8l-4.14 4.54s-3.66-3.21-3.66-6.4C1.64 6 5.8.55 5.8.55h5.73zM12.47 22c0 0 5.32-.74 5.32-6.8 0-4.1-3.23-4.8-3.23-4.8l4.14-4.54s-3.66 3.21 3.66 6.4c0 5.75-4.16 11.2-4.16 11.2h-5.73z"/>
                </svg>
              </div>
              <div>
                <span className="block text-[11px] font-black text-slate-800 dark:text-slate-200 uppercase tracking-wider leading-none mb-1">Timesheet</span>
                <span className="block text-[9px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest leading-none">Conectado ao Jira</span>
              </div>
            </div>
            {user && (
              <Badge variant="outline" className="bg-emerald-50 dark:bg-emerald-950/30 border-emerald-100 dark:border-emerald-900/50 text-emerald-600 dark:text-emerald-400 text-[9px] font-extrabold uppercase tracking-wider py-0.5 px-2">
                Sincronizado
              </Badge>
            )}
          </div>

          {user ? (
            <div className="space-y-4">
              {/* Hoje */}
              <div>
                <div className="flex justify-between items-baseline mb-2">
                  <p className="text-[10px] font-extrabold text-slate-500 dark:text-slate-400 uppercase tracking-widest">{dateString.split(',')[0]} (Hoje)</p>
                  <p className="text-xl font-black text-slate-900 dark:text-slate-100 leading-none">{todayHoursStr} <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider ml-0.5">Lançadas</span></p>
                </div>
                <div className="bg-slate-50/80 dark:bg-slate-900/80 rounded-2xl p-3 border border-slate-100/80 dark:border-slate-800/80 space-y-2.5 max-h-[110px] overflow-y-auto no-scrollbar">
                  {worklogs.length === 0 ? (
                    <p className="text-[10px] font-bold text-slate-400 text-center py-2 uppercase tracking-wider">Nenhum registro hoje</p>
                  ) : (
                    worklogs.map(log => {
                      const h = Math.floor(log.durationMinutes / 60);
                      const m = log.durationMinutes % 60;
                      return (
                        <div key={log.id} className="flex items-center justify-between text-[11px] min-w-0">
                          <div className="flex items-center gap-2 min-w-0 flex-1 mr-2">
                            <span className="w-1.5 h-1.5 rounded-full bg-blue-500 shrink-0"></span>
                            <span className="font-extrabold text-slate-700 dark:text-slate-350 truncate block max-w-[150px] sm:max-w-[200px]">
                              {log.taskId ? `[${log.taskId}] ${log.title}` : log.title}
                            </span>
                          </div>
                          <span className="font-bold text-slate-600 dark:text-slate-400 bg-white dark:bg-slate-950 px-2 py-0.5 rounded-md border border-slate-200/60 dark:border-slate-800/60 shadow-sm shrink-0">
                            {h > 0 ? `${h}h ` : ''}{m}m
                          </span>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

              {/* Ontem */}
              <div className="pt-3 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between">
                <div className="flex flex-col">
                  <span className="text-[9px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">Resumo de Ontem</span>
                  <span className="text-[12px] font-extrabold text-slate-700 dark:text-slate-300 mt-0.5">{yesterdayHoursStr} trabalhadas</span>
                </div>
                <div className="w-8 h-8 rounded-full bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-800 flex items-center justify-center">
                  <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                </div>
              </div>
            </div>
          ) : (
            <div className="p-4 bg-slate-50 dark:bg-slate-900/50 rounded-[2rem] border border-slate-100/80 dark:border-slate-800 shadow-inner text-center py-6 flex flex-col justify-center flex-1 min-h-[175px]">
              <Lock className="h-6 w-6 text-slate-300 dark:text-slate-700 mx-auto mb-2" />
              <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-1">Acesso Pendente</p>
              <p className="text-[10px] text-slate-400 dark:text-slate-500 max-w-[200px] mx-auto leading-tight">
                Faça login para conectar seu painel ao Jira
              </p>
            </div>
          )}
        </div>

        <Button
          size="sm"
          variant="ghost"
          onClick={() => router.push('/daily-flow')}
          className="w-full mt-4 text-[10px] font-extrabold uppercase tracking-widest text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 hover:text-blue-700 h-10 rounded-xl transition-all shrink-0"
        >
          Ver Worklog Completo
        </Button>
      </div>
    </div>
  );
}
