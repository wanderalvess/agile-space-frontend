'use client';

import React, { useState, useEffect, useRef } from 'react';
import { 
  Play, Pause, RotateCcw, CheckCircle, Search, Plus, Trash2,
  Flame, Moon, Target, Headphones
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useDailyStore } from '@/store/useDailyStore';
import { useFirebase } from '@/firebase';
import { useToast } from '@/hooks/use-toast';
import { JiraImportDialog } from '@/components/shared/JiraImportDialog';
import { useCalmariaStore } from '@/store/useCalmariaStore';

export default function FocusPlayer() {
  const { firestore, user } = useFirebase();
  const { toast } = useToast();
  
  const [isJiraModalOpen, setIsJiraModalOpen] = useState(false);
  const [isMounted, setIsMounted] = useState(false);
  const { tasks, activeTaskId, setActiveTaskId, addTask, addWorklogFirebase, setTasks } = useDailyStore();
  const activeTask = isMounted ? tasks.find(t => t.id === activeTaskId) : null;

  const {
    isTimerRunning,
    timeRemaining,
    baseMinutes,
    cycles,
    startTimer,
    pauseTimer,
    resetTimer,
    setBaseMinutes,
    toggleOpen,
    activeSounds
  } = useCalmariaStore();

  const isFocusActive = isTimerRunning || Object.keys(activeSounds).length > 0;

  useEffect(() => {
    setIsMounted(true);
  }, []);

  // Solicitar permissão de notificações desktop
  useEffect(() => {
    if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }, []);

  // Atualizar dinamicamente o título do navegador com o cronômetro
  useEffect(() => {
    if (!isTimerRunning) return;
    const originalTitle = document.title;
    const taskTitle = activeTask ? activeTask.title : 'Foco Geral';
    
    const updateTitle = () => {
      const remaining = useCalmariaStore.getState().timeRemaining;
      const mins = String(Math.floor(remaining / 60)).padStart(2, '0');
      const secs = String(remaining % 60).padStart(2, '0');
      document.title = `(${mins}:${secs}) ${taskTitle} | Espaço Ágil`;
    };
    
    updateTitle();
    const interval = setInterval(updateTitle, 1000);
    
    return () => {
      clearInterval(interval);
      document.title = originalTitle;
    };
  }, [isTimerRunning, activeTask]);

  // Enviar notificação desktop quando o ciclo do Pomodoro terminar
  const prevCycles = useRef(cycles);
  useEffect(() => {
    if (cycles > prevCycles.current) {
      const taskTitle = activeTask ? activeTask.title : 'Foco Geral';
      
      // Notificação nativa do navegador (ótimo para quando o usuário está em outra aba/aplicativo)
      if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
        new Notification('Ciclo de Foco Concluído! 🧠', {
          body: `Você completou o seu bloco de foco na tarefa: "${taskTitle}". Hora de uma pausa!`,
        });
      }

      // Toast interno da aplicação (ótimo para quando a aba está aberta/focada)
      toast({
        title: "Ciclo de Foco Concluído! 🧠",
        description: `Parabéns! Bloco de foco finalizado para "${taskTitle}". Hora de uma merecida pausa!`,
      });

      prevCycles.current = cycles;
    }
  }, [cycles, activeTask, toast]);


  const minutesDisplay = Math.floor(timeRemaining / 60);
  const secondsDisplay = timeRemaining % 60;
  const progress = ((baseMinutes * 60 - timeRemaining) / (baseMinutes * 60)) * 100;

  const handlePlayPause = () => {
    if (isTimerRunning) {
      pauseTimer();
    } else {
      startTimer();
    }
  };

  const handleComplete = async () => {
    pauseTimer();
    
    const elapsedSeconds = baseMinutes * 60 - timeRemaining;
    const elapsedMinutes = Math.round(elapsedSeconds / 60);
    const defaultMinutes = elapsedMinutes > 0 ? elapsedMinutes : baseMinutes;
    
    const manualMinutesStr = window.prompt("Confirmar tempo gasto nesta tarefa (em minutos):", defaultMinutes.toString());
    if (manualMinutesStr === null) {
      // Cancelado pelo usuário
      return;
    }
    
    const finalMinutes = parseInt(manualMinutesStr);
    if (isNaN(finalMinutes) || finalMinutes <= 0) {
      toast({
        title: "Tempo inválido",
        description: "A duração deve ser um número maior que zero.",
        variant: "destructive"
      });
      return;
    }

    const taskTitle = activeTask ? activeTask.title : 'Foco Geral';
    
    if (firestore && user) {
      try {
        await addWorklogFirebase(firestore, user.uid, {
          taskId: activeTaskId || undefined,
          title: taskTitle,
          durationMinutes: finalMinutes
        });
        toast({
          title: "Tempo Registrado",
          description: `${finalMinutes}m salvos com sucesso no Firebase.`
        });
        
        // Remover da fila de foco e limpar tarefa ativa
        if (activeTaskId) {
          setTasks(tasks.filter(t => t.id !== activeTaskId));
          setActiveTaskId(null);
        }
      } catch (err) {
        toast({
          title: "Erro ao Salvar",
          description: "Não foi possível persistir o registro de foco no Firebase.",
          variant: "destructive"
        });
      }
    }

    resetTimer();
  };

  const handleImportJiraIssues = (importedIssues: any[]) => {
    if (importedIssues.length === 0) return;
    
    const mappedTasks = importedIssues.map(iss => ({
      id: iss.key,
      title: iss.title,
      category: 'Codificação'
    }));

    const currentTasks = useDailyStore.getState().tasks;
    const filteredCurrent = currentTasks.filter(t => !importedIssues.some(i => i.key.toLowerCase() === t.id.toLowerCase()));
    setTasks([...mappedTasks, ...filteredCurrent]);
    setActiveTaskId(importedIssues[0].key);

    toast({
      title: "Jira Importado",
      description: `${importedIssues.length} tickets adicionados à fila de Foco.`
    });
  };

  const handleCreateManual = () => {
    const title = window.prompt("Digite o título da tarefa manual:");
    if (title && title.trim()) {
      addTask(title.trim());
      toast({
        title: "Tarefa Manual Criada",
        description: `"${title}" foi adicionada à fila.`
      });
    }
  };

  const handleDeleteTask = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    setTasks(tasks.filter(t => t.id !== id));
    if (activeTaskId === id) {
      setActiveTaskId(null);
    }
    toast({
      title: "Tarefa Removida",
      description: "A tarefa foi removida da fila de foco."
    });
  };

  return (
    <div className="flex flex-col h-full bg-white/95 dark:bg-slate-900/95 text-slate-900 dark:text-white border border-primary/20 dark:border-primary/30 rounded-[2.5rem] shadow-2xl shadow-[0_20px_50px_rgba(249,115,22,0.08)] dark:shadow-[0_20px_50px_rgba(249,115,22,0.03)] p-5 overflow-hidden justify-between select-none">
      {/* Header */}
      <div className="flex items-center justify-between shrink-0 mb-3">
        <div className="flex items-center gap-1.5">
          <Moon className="h-4 w-4 text-orange-500" />
          <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Player de Foco</span>
        </div>
        <span className="text-[8px] font-black text-orange-600 dark:text-orange-400 bg-orange-500/10 border border-orange-500/20 px-2.5 py-1 rounded-full uppercase tracking-wider">
          Pomodoro
        </span>
      </div>

      {/* Circular Progress Timer */}
      <div className="relative flex flex-col items-center justify-center shrink-0 py-1.5">
        <div className="relative w-20 h-20 flex items-center justify-center">
          <svg viewBox="0 0 160 160" className="w-full h-full transform -rotate-90">
             <circle cx="80" cy="80" r="70" stroke="currentColor" strokeWidth="4" fill="transparent" className="text-slate-200 dark:text-slate-800/40" />
            <circle cx="80" cy="80" r="70" stroke="currentColor" strokeWidth="6" fill="transparent"
              strokeDasharray={439.8}
              strokeDashoffset={439.8 - (439.8 * progress) / 100}
              className="text-orange-500 transition-all duration-300"
              strokeLinecap="round"
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="font-black italic tracking-tighter text-xl text-slate-900 dark:text-white select-none">
              {String(minutesDisplay).padStart(2, '0')}:{String(secondsDisplay).padStart(2, '0')}
            </span>
          </div>
        </div>
      </div>

      {/* Control Buttons */}
      <div className="flex items-center justify-center gap-2.5 shrink-0 mb-3">
        <button 
          onClick={resetTimer} 
          className="h-9 w-9 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-400 flex items-center justify-center"
        >
          <RotateCcw className="h-4 w-4" />
        </button>
        
        <button 
          onClick={handlePlayPause} 
          className={cn(
            "h-11 w-11 rounded-xl shadow-lg transition-all active:scale-95 flex items-center justify-center", 
            isTimerRunning ? "bg-slate-800 dark:bg-white text-white dark:text-black hover:bg-slate-700 dark:hover:bg-white/90" : "bg-orange-600 hover:bg-orange-700 text-white"
          )}
        >
          {isTimerRunning ? <Pause className="h-4.5 w-4.5 text-current" /> : <Play className="h-4.5 w-4.5 fill-current text-current ml-0.5" />}
        </button>

        <button
          onClick={handleComplete}
          className="h-9 w-9 rounded-xl border border-emerald-500/20 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 shadow-sm flex items-center justify-center"
        >
          <CheckCircle className="h-4 w-4" />
        </button>

        <button 
          onClick={toggleOpen} 
          className={cn(
            "h-9 w-9 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 transition-all flex items-center justify-center",
            isFocusActive 
              ? "text-orange-500 border-orange-500/30 bg-orange-500/10" 
              : "text-muted-foreground"
          )}
          title="Calmaria - Sons e Spotify"
        >
          <Headphones className="h-4 w-4" />
        </button>
      </div>

      {/* Timer Presets */}
      <div className="flex items-center justify-center gap-1.5 shrink-0 mb-3.5 overflow-x-auto no-scrollbar pb-0.5">
        {[
          { label: '15m', mins: 15 },
          { label: '25m', mins: 25 },
          { label: '45m', mins: 45 },
          { label: '60m', mins: 60 }
        ].map(opt => (
          <button
            key={opt.mins}
            type="button"
            onClick={() => setBaseMinutes(opt.mins)}
            className={cn(
              "px-2.5 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all",
              baseMinutes === opt.mins && !isTimerRunning
                ? "bg-orange-500/20 text-orange-500 border border-orange-500/30"
                : "bg-muted text-muted-foreground hover:text-slate-900 dark:hover:text-slate-100"
            )}
          >
            {opt.label}
          </button>
        ))}
        <button
          type="button"
          onClick={() => {
            const mStr = window.prompt("Digite os minutos de foco desejados (ex: 30):");
            if (mStr) {
              const mins = parseInt(mStr);
              if (!isNaN(mins) && mins > 0 && mins <= 180) {
                setBaseMinutes(mins);
              }
            }
          }}
          className="px-2.5 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all bg-muted text-muted-foreground hover:text-slate-900 dark:hover:text-slate-100"
        >
          Custom
        </button>
      </div>

      {/* Active Task Card */}
      <div className="shrink-0 mb-3.5">
        <span className="text-[8px] font-black uppercase tracking-widest text-muted-foreground block mb-1">Tarefa Ativa</span>
        {activeTask ? (
          <div className="bg-muted/50 border border-orange-500/20 shadow-md rounded-xl p-3.5 animate-in fade-in slide-in-from-bottom-1 duration-300">
            <span className="text-[7.5px] font-black uppercase tracking-widest text-orange-500 bg-orange-500/10 px-1.5 py-0.5 rounded">
              {activeTask.id}
            </span>
            <h4 className="text-[10px] font-black text-foreground mt-1 leading-snug">
              {activeTask.title}
            </h4>
          </div>
        ) : (
          <div className="bg-slate-50 dark:bg-slate-950/20 border border-dashed border-slate-200 dark:border-slate-800 rounded-xl p-3 text-center">
            <p className="text-[8px] font-black uppercase tracking-widest text-muted-foreground">Nenhum foco ativo</p>
          </div>
        )}
      </div>

      {/* Tasks Queue List */}
      <div className="flex-1 min-h-0 border-t border-slate-200/60 dark:border-slate-800/60 pt-3.5 flex flex-col justify-between">
        <div className="flex-1 min-h-0 flex flex-col">
          <span className="text-[8px] font-black uppercase tracking-widest text-muted-foreground block mb-1">Fila de Foco</span>
          <div className="space-y-1 overflow-y-auto no-scrollbar pr-0.5 flex-1 min-h-0">
            {isMounted && Array.from(new Map(tasks.map(t => [t.id.toLowerCase(), t])).values()).map(t => (
              <div
                key={t.id}
                onClick={() => setActiveTaskId(activeTaskId === t.id ? null : t.id)}
                className={cn(
                  "group/item w-full text-left p-1.5 py-2 rounded-lg border text-[9.5px] font-bold flex items-center justify-between transition-all truncate cursor-pointer",
                  activeTaskId === t.id
                    ? "bg-orange-500/10 border-orange-500/20 text-orange-400"
                    : "bg-slate-50 dark:bg-slate-950/25 border border-slate-200/60 dark:border-slate-800/60 text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-900 hover:text-slate-900 dark:hover:text-slate-100"
                )}
              >
                <span className="truncate flex-1">{t.title}</span>
                <div className="flex items-center gap-1.5 shrink-0 ml-1.5">
                  {(!t.id.startsWith('TASK-')) && (
                    <span className="text-[7px] font-black uppercase tracking-widest bg-indigo-500/10 text-indigo-400 px-1 py-0.5 rounded border border-indigo-500/10">
                      {t.id}
                    </span>
                  )}
                  <button
                    onClick={(e) => handleDeleteTask(e, t.id)}
                    className="opacity-0 group-hover/item:opacity-100 p-0.5 text-muted-foreground hover:text-rose-500 rounded transition-all"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col gap-1.5 mt-3 pt-3 border-t border-slate-200/60 dark:border-slate-800/60 shrink-0">
          <button
            type="button"
            onClick={() => setIsJiraModalOpen(true)}
            className="w-full h-8.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-[9px] font-black uppercase tracking-widest shadow-sm flex items-center justify-center gap-1"
          >
            Buscar Tarefa no Jira
          </button>
          <button 
            type="button" 
            onClick={handleCreateManual}
            className="w-full h-8 rounded-lg border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-500 dark:text-slate-400 text-[8.5px] font-black uppercase tracking-widest shadow-sm flex items-center justify-center bg-transparent"
          >
            <Plus className="h-3 w-3 mr-1" /> Criar Manual
          </button>
        </div>
      </div>

      <JiraImportDialog 
        open={isJiraModalOpen}
        onClose={() => setIsJiraModalOpen(false)}
        onImport={handleImportJiraIssues}
        title="Buscar no Jira (Daily Center)"
        description="Utilize consultas JQL avançadas ou presets para selecionar seu ticket de foco."
      />
    </div>
  );
}
