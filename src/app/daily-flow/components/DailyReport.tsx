'use client';

import React, { useState } from 'react';
import { Send, Copy, AlertTriangle, FileCheck, CheckCircle2, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { useDailyStore } from '@/store/useDailyStore';
import { useFirebase } from '@/firebase';
import { dailyFlowApi } from '../api';

export default function DailyReport() {
  const { firestore, user } = useFirebase();
  const { toast } = useToast();
  const { worklogs, weeklyWorklogs, selectedDate } = useDailyStore();
  const [yesterday, setYesterday] = useState('');
  const [today, setToday] = useState('');
  const [blockers, setBlockers] = useState('');

  const handleImportTimesheet = () => {
    // Calcula a data de ontem com base na data selecionada
    const currDate = new Date(selectedDate + 'T12:00:00');
    // Se for Segunda (1), pega a Sexta (-3). Se Domingo (0), pega Sexta (-2). Senão, pega ontem (-1).
    const daysToSubtract = currDate.getDay() === 1 ? 3 : (currDate.getDay() === 0 ? 2 : 1);
    const yesterdayDate = new Date(currDate.getTime() - daysToSubtract * 24 * 60 * 60 * 1000);
    const yesterdayDateStr = yesterdayDate.toISOString().split('T')[0];

    // Busca os logs (priorizando a lista semanal que tem o histórico de vários dias)
    const allLogs = weeklyWorklogs.length > 0 ? weeklyWorklogs : worklogs;
    const yesterdayLogs = allLogs.filter(log => log.date === yesterdayDateStr);
    const todayLogs = allLogs.filter(log => log.date === selectedDate);

    if (yesterdayLogs.length === 0 && todayLogs.length === 0) {
      toast({
        title: "Timesheet Vazio",
        description: "Não há worklogs registrados hoje ou ontem para importar.",
        variant: "destructive"
      });
      return;
    }

    const formatLogs = (logsToFormat: typeof worklogs) => {
      const grouped: Record<string, { title: string; duration: number; isJira: boolean; taskId?: string }> = {};
      logsToFormat.forEach(log => {
        const key = log.taskId || log.title;
        if (grouped[key]) {
          grouped[key].duration += log.durationMinutes;
        } else {
          grouped[key] = {
            title: log.title,
            duration: log.durationMinutes,
            isJira: log.isJira,
            taskId: log.taskId
          };
        }
      });
      return Object.values(grouped).map(log => {
        const durationStr = `${log.duration}m`;
        return log.isJira && log.taskId
          ? `• [${log.taskId}] ${log.title} (${durationStr})`
          : `• [Manual] ${log.title} (${durationStr})`;
      });
    };

    if (yesterdayLogs.length > 0) {
      const yesterdayLines = formatLogs(yesterdayLogs);
      setYesterday(prev => {
        const prefix = prev ? prev.trim() + '\n' : '';
        return prefix + yesterdayLines.join('\n');
      });
    }

    if (todayLogs.length > 0) {
      const todayLines = formatLogs(todayLogs);
      setToday(prev => {
        const prefix = prev ? prev.trim() + '\n' : '';
        return prefix + todayLines.join('\n');
      });
    }

    toast({
      title: "Daily Preenchida!",
      description: "Logs de ontem inseridos no 'O que fiz' e os de hoje em 'O que vou fazer'."
    });
  };

  const handleCopy = () => {
    let reportText = `*Daily Report*\n\n`;
    reportText += `*O que fiz ontem:*\n${yesterday || 'Sem registros'}\n\n`;
    reportText += `*O que vou fazer hoje:*\n${today || 'Sem registros'}\n\n`;
    if (blockers.trim()) {
      reportText += `*⚠️ Impedimentos & Bloqueios:*\n${blockers}`;
    } else {
      reportText += `*⚠️ Impedimentos & Bloqueios:*\nNenhum`;
    }

    navigator.clipboard.writeText(reportText);
    toast({
      title: "Copiado!",
      description: "Relatório de status copiado para a área de transferência."
    });
  };

  const handleSaveAndCopy = async () => {
    if (!yesterday.trim() || !today.trim()) {
      toast({
        title: "Campos vazios",
        description: "Preencha o que fez ontem e o que fará hoje antes de salvar.",
        variant: "destructive"
      });
      return;
    }
    
    // Form and copy the text representation
    let reportText = `*Daily Report*\n\n`;
    reportText += `*O que fiz ontem:*\n${yesterday || 'Sem registros'}\n\n`;
    reportText += `*O que vou fazer hoje:*\n${today || 'Sem registros'}\n\n`;
    if (blockers.trim()) {
      reportText += `*⚠️ Impedimentos & Bloqueios:*\n${blockers}`;
    } else {
      reportText += `*⚠️ Impedimentos & Bloqueios:*\nNenhum`;
    }

    try {
      await navigator.clipboard.writeText(reportText);
    } catch (clipErr) {
      console.warn("Falha ao copiar para a área de transferência:", clipErr);
    }
    
    // Save report to Spring Boot
    if (user) {
      try {
        await dailyFlowApi.saveOrUpdateDailyReport({
          userId: user.uid,
          yesterday: yesterday.trim(),
          today: today.trim(),
          blockers: blockers.trim(),
          date: selectedDate
        });

        // Refresh the dashboard dailies history list instantly
        useDailyStore.getState().fetchDailyReports(null, user.uid);
        
        toast({
          title: "Daily Salva & Copiada!",
          description: "Relatório registrado no Spring Boot e copiado com sucesso."
        });
      } catch (err) {
        console.error("Erro ao salvar daily report:", err);
        toast({
          title: "Erro ao Salvar",
          description: "O status foi copiado, mas houve um erro ao persistir no Spring Boot.",
          variant: "destructive"
        });
      }
    } else {
      toast({
        title: "Copiado com Sucesso!",
        description: "O status foi copiado, mas conecte-se para habilitar o salvamento em nuvem."
      });
    }
  };

  return (
    <div className="flex flex-col h-full bg-white/80 backdrop-blur-xl dark:bg-slate-900/80 border border-slate-200/50 dark:border-slate-800/50 rounded-3xl shadow-xl p-4 overflow-hidden justify-between">
      {/* Header */}
      <div className="shrink-0 flex items-center justify-between border-b border-slate-100 dark:border-slate-800/50 pb-2">
        <div className="flex items-center gap-1.5">
          <FileCheck className="h-3.5 w-3.5 text-emerald-500" />
          <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">Daily Sync (Report)</span>
        </div>
        <span className="text-[9px] font-black text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/30 px-2 py-0.5 rounded-full uppercase flex items-center gap-1">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" /> Sincronizado
        </span>
      </div>

      {/* Inputs Form */}
      <div className="flex-1 overflow-y-auto no-scrollbar py-3 space-y-3.5">
        {/* Yesterday */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-[9px] font-black uppercase tracking-widest text-slate-400 flex items-center gap-1">
              <CheckCircle2 className="h-3 w-3 text-emerald-500" /> O que fiz
            </span>
            <Button
              type="button"
              onClick={handleImportTimesheet}
              variant="outline"
              size="xs"
              className="h-5.5 px-2 rounded-lg text-[8px] font-black uppercase tracking-widest gap-1 border-slate-200 hover:bg-slate-50"
            >
              <Zap className="h-3 w-3 text-indigo-500 fill-current animate-pulse" /> Importar Logs
            </Button>
          </div>
          <Textarea
            placeholder="Descreva as tarefas concluídas..."
            value={yesterday}
            onChange={e => setYesterday(e.target.value)}
            className="text-[10px] font-semibold bg-slate-50/50 dark:bg-slate-800/20 border-slate-200/60 dark:border-slate-800/60 rounded-2xl min-h-[75px] max-h-[110px] focus-visible:ring-emerald-500/20 resize-none"
          />
        </div>

        {/* Today */}
        <div className="space-y-1.5">
          <span className="text-[9px] font-black uppercase tracking-widest text-slate-400 flex items-center gap-1">
            <Send className="h-3 w-3 text-indigo-500" /> O que vou fazer
          </span>
          <Textarea
            placeholder="Qual é o plano para hoje?"
            value={today}
            onChange={e => setToday(e.target.value)}
            className="text-[10px] font-semibold bg-slate-50/50 dark:bg-slate-800/20 border-slate-200/60 dark:border-slate-800/60 rounded-2xl min-h-[75px] max-h-[110px] focus-visible:ring-indigo-500/20 resize-none"
          />
        </div>

        {/* Blockers */}
        <div className="space-y-1.5">
          <span className="text-[9px] font-black uppercase tracking-widest text-slate-400 flex items-center gap-1">
            <AlertTriangle className="h-3 w-3 text-amber-500" /> Impedimentos & Bloqueios
          </span>
          <Textarea
            placeholder="Descreva aqui o que está travando o seu progresso (infraestrutura, dependência de terceiros, regras de negócio)..."
            value={blockers}
            onChange={e => setBlockers(e.target.value)}
            className="text-[10px] font-semibold bg-slate-50/50 dark:bg-slate-800/20 border-slate-200/60 dark:border-slate-800/60 rounded-2xl min-h-[75px] max-h-[110px] focus-visible:ring-amber-500/20 resize-none"
          />
        </div>
      </div>

      {/* Buttons (Unified heights and styles) */}
      <div className="shrink-0 flex gap-3 border-t border-slate-100 dark:border-slate-800/50 pt-3">
        <Button
          onClick={handleCopy}
          variant="outline"
          className="flex-1 h-10 rounded-2xl text-[9px] font-black uppercase tracking-widest gap-1.5 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 bg-white dark:bg-slate-900 shadow-sm"
        >
          <Copy className="h-3.5 w-3.5" /> Copiar
        </Button>
        <Button
          onClick={handleSaveAndCopy}
          className="flex-1 h-10 rounded-2xl bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 text-[8.5px] font-black uppercase tracking-widest gap-1 hover:bg-slate-800 dark:hover:bg-slate-200 shadow-sm transition-all text-center leading-none"
        >
          <Send className="h-3.5 w-3.5 shrink-0" /> Salvar & Copiar Daily
        </Button>
      </div>
    </div>
  );
}
