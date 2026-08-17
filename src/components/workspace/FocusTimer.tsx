'use client';

import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Play, Pause, RotateCcw, Coffee, Activity,
  Maximize2, Minimize2, Volume2, VolumeX,
  CloudRain, Wind, Waves, Flame, TreePine,
  Moon, Keyboard, TrainFront, Users, Droplets,
  CheckCircle2, ListTodo, Sparkles, Target, Coffee as CafeIcon,
  Clock, Trash2, Edit2, PlayCircle, Code2, Bug, Terminal, ShieldCheck, TrendingUp,
  Headphones
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Portal } from '@/components/ui/portal';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { KanbanCardData } from './types';
import { useCalmariaStore } from '@/store/useCalmariaStore';

interface FocusTimerProps {
  tasks: KanbanCardData[];
  dbSessions?: Array<{ id?: string; taskId: string | null; title: string; category: string; durationMinutes: number; createdAt: any }>;
  onSessionComplete?: (taskId: string | null, durationMinutes: number, title: string, category: string) => void;
  onAddTask?: (title: string) => void;
  onDeleteTask?: (taskId: string) => void;
  onEditTask?: (taskId: string, newTitle: string) => void;
  onClearHistory?: () => void;
}



const QUOTES = [
  "O foco é a chave para o sucesso.",
  "Produtividade é ser capaz de fazer coisas que você nunca foi capaz de fazer antes.",
  "Sua mente é para ter ideias, não para guardá-las.",
  "Feito é melhor que perfeito.",
  "A disciplina é a ponte entre metas e realizações."
];

const CATEGORIES = ['Codificação', 'Defeito', 'Spike', 'Teste Sistêmico', 'Alinhamento'];
const CATEGORY_COLORS: Record<string, string> = {
  'Codificação': 'bg-indigo-50 text-indigo-600 border-indigo-100',
  'Defeito': 'bg-rose-50 text-rose-600 border-rose-100',
  'Spike': 'bg-amber-50 text-amber-600 border-amber-100',
  'Teste Sistêmico': 'bg-emerald-50 text-emerald-600 border-emerald-100',
  'Alinhamento': 'bg-slate-50 text-slate-600 border-slate-100'
};
const CATEGORY_PROGRESS_COLORS: Record<string, string> = {
  'Codificação': 'bg-indigo-500',
  'Defeito': 'bg-rose-500',
  'Spike': 'bg-amber-500',
  'Teste Sistêmico': 'bg-emerald-500',
  'Alinhamento': 'bg-slate-500'
};
const CATEGORY_ICONS: Record<string, React.ReactNode> = {
  'Codificação': <Code2 className="h-3 w-3 shrink-0" />,
  'Defeito': <Bug className="h-3 w-3 shrink-0" />,
  'Spike': <Terminal className="h-3 w-3 shrink-0" />,
  'Teste Sistêmico': <ShieldCheck className="h-3 w-3 shrink-0" />,
  'Alinhamento': <Users className="h-3 w-3 shrink-0" />
};

export function FocusTimer({ tasks, dbSessions, onSessionComplete, onAddTask, onDeleteTask, onEditTask, onClearHistory }: FocusTimerProps) {
  const [baseMinutes, setBaseMinutes] = useState(25);
  const { toggleOpen, isTimerRunning: isCalmariaTimerRunning, activeSounds } = useCalmariaStore();
  const isFocusActive = isCalmariaTimerRunning || Object.keys(activeSounds).length > 0;
  const [minutes, setMinutes] = useState(25);
  const [seconds, setSeconds] = useState(0);
  const [isActive, setIsActive] = useState(false);
  const [mode, setMode] = useState<'work' | 'break'>('work');
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [isZenMode, setIsZenMode] = useState(false);
  const [currentQuote, setCurrentQuote] = useState(QUOTES[0]);
  const [completedSessions, setCompletedSessions] = useState(0);
  const [manualTaskTitle, setManualTaskTitle] = useState('');
  const [dailyGoal, setDailyGoal] = useState(120);
  const [isEditingGoal, setIsEditingGoal] = useState(false);
  const [taskCategories, setTaskCategories] = useState<Record<string, string>>({});
  const [manualCategory, setManualCategory] = useState('Codificação');
  const [streak, setStreak] = useState(3);
  
  // Histórico local de sessões concluídas (Persistido no localStorage)
  const [sessionHistory, setSessionHistory] = useState<{taskId: string, title: string, duration: number, category?: string}[]>([]);
  const [mounted, setMounted] = useState(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const lastTickTimestampRef = useRef<number | null>(null);

  useEffect(() => {
    setMounted(true);
    try {
      const savedCategories = localStorage.getItem('focus_task_categories');
      if (savedCategories) setTaskCategories(JSON.parse(savedCategories));

      const savedStreak = localStorage.getItem('focus_streak');
      if (savedStreak) setStreak(Number(savedStreak));

      const savedHistory = localStorage.getItem('focus_session_history');
      if (savedHistory) setSessionHistory(JSON.parse(savedHistory));

      const savedGoal = localStorage.getItem('focus_daily_goal');
      if (savedGoal) setDailyGoal(Number(savedGoal));
    } catch (e) {
      console.error('Error loading local storage focus settings:', e);
    }
  }, []);

  useEffect(() => {
    if (!mounted) return;
    try {
      localStorage.setItem('focus_session_history', JSON.stringify(sessionHistory));
    } catch (e) {
      console.error('Erro ao salvar histórico de foco:', e);
    }
  }, [sessionHistory, mounted]);

  useEffect(() => {
    if (!mounted) return;
    try {
      localStorage.setItem('focus_daily_goal', String(dailyGoal));
    } catch (e) {
      console.error('Erro ao salvar meta diária de foco:', e);
    }
  }, [dailyGoal, mounted]);



  const selectedTask = tasks.find(t => t.id === selectedTaskId);
  const availableTasks = tasks.filter(t => t.status !== 'done');

  // Request notifications permission
  useEffect(() => {
    if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }, []);

  // Update dynamic document title
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (isActive && mode === 'work') {
      const taskTitle = selectedTask ? selectedTask.title : 'Foco Geral';
      document.title = `(${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}) [${taskTitle}] | Espaço Ágil`;
    } else {
      document.title = 'Sala de Foco | Espaço Ágil';
    }
    return () => {
      document.title = 'Sala de Foco | Espaço Ágil';
    };
  }, [isActive, minutes, seconds, mode, selectedTask]);

  // Sync new tasks categories
  const pendingCategoriesRef = useRef<Record<string, string>>({});
  useEffect(() => {
    if (!mounted) return;
    let updated = false;
    const newCategories = { ...taskCategories };
    tasks.forEach(task => {
      if (!newCategories[task.id] && pendingCategoriesRef.current[task.title]) {
        newCategories[task.id] = pendingCategoriesRef.current[task.title];
        delete pendingCategoriesRef.current[task.title];
        updated = true;
      }
    });
    if (updated) {
      setTaskCategories(newCategories);
      localStorage.setItem('focus_task_categories', JSON.stringify(newCategories));
    }
  }, [tasks, taskCategories, mounted]);

  const triggerNotification = (taskTitle: string) => {
    if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
       new Notification('Ciclo de Foco Concluído', {
        body: `Parabéns! Completou o seu bloco de foco na tarefa: ${taskTitle}. Hora de uma merecida pausa.`,
      });
    }
  };

  const getTaskCategory = (task: KanbanCardData) => {
    return taskCategories[task.id] || task.tag || 'Codificação';
  };

  const handleCycleCategory = (taskId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    let current = taskCategories[taskId] || 'Codificação';
    const currentIndex = CATEGORIES.indexOf(current);
    const nextIndex = (currentIndex + 1) % CATEGORIES.length;
    const nextCategory = CATEGORIES[nextIndex];
    
    const updated = { ...taskCategories, [taskId]: nextCategory };
    setTaskCategories(updated);
    localStorage.setItem('focus_task_categories', JSON.stringify(updated));
  };

  const getTodaySessions = () => {
    if (!mounted) return [];
    const today = new Date();
    const dbToday = (dbSessions || []).filter(s => {
      if (!s.createdAt) return true;
      const date = s.createdAt.toDate ? s.createdAt.toDate() : new Date(s.createdAt);
      return date.getDate() === today.getDate() &&
             date.getMonth() === today.getMonth() &&
             date.getFullYear() === today.getFullYear();
    }).map(s => ({
      taskId: s.taskId || '',
      title: s.title || 'Foco Geral',
      duration: s.durationMinutes || 0,
      category: s.category || 'Codificação'
    }));

    if (dbToday.length > 0) return dbToday;
    return sessionHistory;
  };

  const getCategoryStats = () => {
    const stats: Record<string, number> = {
      'Codificação': 0,
      'Defeito': 0,
      'Spike': 0,
      'Teste Sistêmico': 0,
      'Alinhamento': 0
    };
    
    let total = 0;
    getTodaySessions().forEach(h => {
      let cat = h.category || 'Codificação';
      if (cat.includes('Codificação')) cat = 'Codificação';
      else if (cat.includes('Defeito')) cat = 'Defeito';
      else if (cat.includes('Spike')) cat = 'Spike';
      else if (cat.includes('Teste Sistêmico')) cat = 'Teste Sistêmico';
      else if (cat.includes('Alinhamento')) cat = 'Alinhamento';

      if (stats[cat] !== undefined) {
        stats[cat] += h.duration;
        total += h.duration;
      }
    });
    
    return { stats, total };
  };

  useEffect(() => {
    return () => { if (timerRef.current) { clearInterval(timerRef.current); } };
  }, []);
  useEffect(() => {
    if (isActive) {
      if (!lastTickTimestampRef.current) {
        lastTickTimestampRef.current = Date.now();
      }
      timerRef.current = setInterval(() => {
        const now = Date.now();
        const lastTick = lastTickTimestampRef.current || now;
        const elapsedSeconds = Math.floor((now - lastTick) / 1000);
        
        if (elapsedSeconds <= 0) return;
        
        lastTickTimestampRef.current = lastTick + (elapsedSeconds * 1000);
        
        const totalRemaining = (minutes * 60 + seconds) - elapsedSeconds;
        
        if (totalRemaining > 0) {
          setMinutes(Math.floor(totalRemaining / 60));
          setSeconds(totalRemaining % 60);
        } else {
          handleReset();
          const nextMode = mode === 'work' ? 'break' : 'work';
          if (mode === 'work') { 
            setCompletedSessions(p => p + 1);
            const taskTitle = selectedTask ? selectedTask.title : 'Foco Geral';
            const taskCategory = selectedTaskId ? (taskCategories[selectedTaskId] || 'Codificação') : 'Codificação';
            
            if (onSessionComplete) onSessionComplete(selectedTaskId, baseMinutes, taskTitle, taskCategory);
            
            setSessionHistory(prev => {
              const nextHistory = [...prev, {
                taskId: selectedTaskId || '', 
                title: taskTitle, 
                duration: baseMinutes,
                category: taskCategory
              }];
              const nextTotal = nextHistory.reduce((acc, h) => acc + h.duration, 0);
              if (nextTotal >= dailyGoal) {
                const currentStreak = Number(localStorage.getItem('focus_streak')) || 3;
                const lastGoalDate = localStorage.getItem('focus_last_goal_date');
                const todayStr = new Date().toDateString();
                if (lastGoalDate !== todayStr) {
                  const nextStreak = currentStreak + 1;
                  setStreak(nextStreak);
                  localStorage.setItem('focus_streak', String(nextStreak));
                  localStorage.setItem('focus_last_goal_date', todayStr);
                }
              }
              return nextHistory;
            });

            triggerNotification(taskTitle);
          }
          setMode(nextMode);
          setMinutes(nextMode === 'work' ? baseMinutes : 5);
          setSeconds(0);
          setCurrentQuote(QUOTES[Math.floor(Math.random() * QUOTES.length)]);
        }
      }, 1000);
    } else if (timerRef.current) { clearInterval(timerRef.current); }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [isActive, minutes, seconds, mode, baseMinutes, selectedTaskId, selectedTask, onSessionComplete, taskCategories, dailyGoal]);

  const toggleTimer = () => {
    if (!isActive) {
      lastTickTimestampRef.current = Date.now();
    } else {
      lastTickTimestampRef.current = null;
    }
    setIsActive(!isActive);
  };

  const handleReset = () => {
    setIsActive(false);
    setMinutes(mode === 'work' ? baseMinutes : 5);
    setSeconds(0);
    lastTickTimestampRef.current = null;
  };

  const handleSavePartial = () => {
    if (mode !== 'work') return;
    const elapsed = (baseMinutes * 60) - (minutes * 60 + seconds);
    if (elapsed > 0) {
      const durationMinutes = Math.max(1, Math.round(elapsed / 60));
      const taskTitle = selectedTask ? selectedTask.title : 'Foco Geral';
      const taskCategory = selectedTaskId ? (taskCategories[selectedTaskId] || 'Codificação') : 'Codificação';
      if (onSessionComplete) onSessionComplete(selectedTaskId, durationMinutes, taskTitle, taskCategory);
      setSessionHistory(prev => {
        const nextHistory = [...prev, {
          taskId: selectedTaskId || '', 
          title: taskTitle, 
          duration: durationMinutes,
          category: taskCategory
        }];
        const nextTotal = nextHistory.reduce((acc, h) => acc + h.duration, 0);
        if (nextTotal >= dailyGoal) {
          const currentStreak = Number(localStorage.getItem('focus_streak')) || 3;
          const lastGoalDate = localStorage.getItem('focus_last_goal_date');
          const todayStr = new Date().toDateString();
          if (lastGoalDate !== todayStr) {
            const nextStreak = currentStreak + 1;
            setStreak(nextStreak);
            localStorage.setItem('focus_streak', String(nextStreak));
            localStorage.setItem('focus_last_goal_date', todayStr);
          }
        }
        return nextHistory;
      });
    }
    handleReset();
  };

  const handleAddManualTask = (e: React.FormEvent) => {
    e.preventDefault();
    if (manualTaskTitle.trim() && onAddTask) { 
      const title = manualTaskTitle.trim();
      pendingCategoriesRef.current[title] = manualCategory;
      onAddTask(title); 
      setManualTaskTitle(''); 
    }
  };

  const changePreset = (m: number) => {
    setIsActive(false);
    setBaseMinutes(m); setMinutes(m); setSeconds(0); setMode('work');
  };

  const progress = mode === 'work'
    ? ((baseMinutes * 60 - (minutes * 60 + seconds)) / (baseMinutes * 60)) * 100
    : ((5 * 60 - (minutes * 60 + seconds)) / (5 * 60)) * 100;

  const elapsedSeconds = (baseMinutes * 60) - (minutes * 60 + seconds);

  const parseJiraTask = (title: string, taskId?: string) => {
    if (taskId && /^[A-Z0-9]+-\d+$/i.test(taskId)) {
      return { id: taskId.toUpperCase(), name: title };
    }
    const match = title.match(/^([A-Z0-9]+-\d+)(?:\s*-\s*|\s+)(.*)$/i) || title.match(/^\[([A-Z0-9]+-\d+)\]\s*(.*)$/i);
    if (match) {
      return { id: match[1].toUpperCase(), name: match[2] };
    }
    return { id: null, name: title };
  };

  const getTaskHistory = () => {
    const historyMap = new Map<string, { id: string, title: string, duration: number, category?: string }>();
    getTodaySessions().forEach(h => {
       const key = h.taskId || h.title;
       if (historyMap.has(key)) {
           historyMap.get(key)!.duration += h.duration;
        } else {
            historyMap.set(key, { id: h.taskId, title: h.title, duration: h.duration, category: h.category });
        }
    });
    return Array.from(historyMap.values());
  };

  const totalFocusTime = getTodaySessions().reduce((acc, h) => acc + h.duration, 0);

  return (
    <>
      <div className={cn(
        "grid grid-cols-1 md:grid-cols-12 gap-6 h-full w-full overflow-hidden transition-all duration-700",
        isZenMode && "opacity-0 scale-95 pointer-events-none"
      )}>
        
        <div className="md:col-span-7 flex flex-col gap-6 min-h-0 overflow-hidden relative">
          
          <div className="flex-1 rounded-[2.5rem] bg-white/70 backdrop-blur-xl border border-white/60 shadow-xl shadow-slate-200/50 p-6 flex flex-col items-center justify-between min-h-0 relative">
            
            <div className="w-full flex justify-between items-start shrink-0">
               <div className={cn("px-3 py-1.5 rounded-xl transition-all flex items-center gap-2 max-w-[70%]", mode === 'work' ? "bg-primary/10 text-primary" : "bg-emerald-500/10 text-emerald-500")}>
                 {mode === 'work' ? <Activity className="h-4 w-4 shrink-0" /> : <Coffee className="h-4 w-4 shrink-0" />}
                 <span className="text-xs font-black uppercase tracking-widest truncate">
                   {mode === 'work' ? (selectedTask ? selectedTask.title : 'Foco Ativo') : 'Pausa'}
                 </span>
                 <span className="relative flex h-2 w-2 ml-1 shrink-0">
                   <span className={cn("animate-ping absolute inline-flex h-full w-full rounded-full opacity-75", mode === 'work' ? "bg-primary" : "bg-emerald-500")} />
                   <span className={cn("relative inline-flex rounded-full h-2 w-2", mode === 'work' ? "bg-primary" : "bg-emerald-500")} />
                 </span>
               </div>
               
               <Button onClick={() => setIsZenMode(true)} variant="ghost" size="icon"
                 className="h-10 w-10 rounded-xl text-slate-400 hover:text-primary hover:bg-white/50 transition-all">
                 <Maximize2 className="h-5 w-5" />
               </Button>
            </div>

            <div className="relative flex items-center justify-center flex-1 w-full min-h-0 py-4">
              <div className="relative aspect-square h-full max-h-[320px] w-auto">
                <svg viewBox="0 0 320 320" className="w-full h-full transform -rotate-90">
                  <circle cx="160" cy="160" r="140" stroke="currentColor" strokeWidth="6" fill="transparent" className="text-slate-100" />
                  <motion.circle cx="160" cy="160" r="140" stroke="currentColor" strokeWidth="12" fill="transparent"
                    strokeDasharray={879.64}
                    animate={{ strokeDashoffset: 879.64 - (879.64 * progress) / 100 }}
                    className={cn("drop-shadow-2xl", mode === 'work' ? "text-primary" : "text-emerald-500")}
                    strokeLinecap="round" transition={{ ease: "linear", duration: 1 }} />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="font-black italic tracking-tighter leading-none text-6xl lg:text-7xl text-slate-900 select-none">
                    {String(minutes).padStart(2, '0')}:{String(seconds).padStart(2, '0')}
                  </span>
                  {selectedTask && (
                    <span className="mt-3 text-[10px] font-bold uppercase tracking-widest text-slate-400 truncate max-w-[70%] text-center">
                      {selectedTask.title}
                    </span>
                  )}
                </div>
              </div>
            </div>

            <div className="flex flex-col items-center gap-4 shrink-0 w-full pb-2">
              <div className="flex items-center gap-4">
                <button onClick={toggleOpen} title="Calmaria - Sons e Spotify"
                  className={cn("h-12 w-12 rounded-2xl border transition-all active:scale-95 flex items-center justify-center shadow-sm",
                    isFocusActive 
                      ? "bg-orange-50 hover:bg-orange-100 border-orange-200 text-orange-500" 
                      : "border-slate-200 text-slate-400 hover:text-orange-500 hover:bg-slate-50"
                  )}
                >
                  <Headphones className="h-5 w-5" />
                </button>
                <button onClick={handleReset} title="Reiniciar"
                  className="h-12 w-12 rounded-2xl border border-slate-200 text-slate-400 hover:text-primary hover:bg-slate-50 shadow-sm transition-all active:scale-95 flex items-center justify-center">
                  <RotateCcw className="h-5 w-5" />
                </button>
                <button onClick={toggleTimer}
                  className={cn("h-16 w-16 lg:h-20 lg:w-20 rounded-[2rem] shadow-xl transition-all active:scale-95 flex items-center justify-center",
                    isActive ? "bg-slate-900 text-white" : "bg-white text-slate-900 border-2 border-slate-200 hover:border-primary/40")}>
                  {isActive ? <Pause className="h-6 w-6 lg:h-8 lg:w-8" /> : <Play className="h-6 w-6 lg:h-8 lg:w-8 ml-1" />}
                </button>
                {mode === 'work' && elapsedSeconds > 0 ? (
                  <button onClick={handleSavePartial} title="Salvar parcial"
                    className="h-12 w-12 rounded-2xl border border-emerald-200 bg-emerald-50 text-emerald-600 hover:bg-emerald-100 shadow-sm transition-all active:scale-95 flex items-center justify-center">
                    <CheckCircle2 className="h-5 w-5" />
                  </button>
                ) : <div className="h-12 w-12 shrink-0" />}
              </div>

              <div className="flex items-center justify-center bg-slate-100/50 p-1.5 rounded-2xl border border-slate-200/50 backdrop-blur-md">
                {[25, 45, 60].map(m => (
                  <button key={m} onClick={() => changePreset(m)}
                    className={cn("px-4 py-1.5 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all",
                      baseMinutes === m && mode === 'work' ? "bg-white text-slate-900 shadow-sm" : "text-slate-400 hover:text-slate-600")}>
                    {m}m
                  </button>
                ))}
                <div className="w-px h-5 bg-slate-200 mx-2" />
                <input 
                  type="number" 
                  min="1"
                  className="w-16 h-8 text-center text-xs font-black bg-white rounded-xl outline-none focus:ring-2 focus:ring-primary/20 text-slate-700 shadow-sm transition-all" 
                  placeholder="Min" 
                  onKeyDown={(e) => { 
                    if(e.key === 'Enter') { 
                      const v = parseInt(e.currentTarget.value); 
                      if(v > 0) changePreset(v); 
                    }
                  }}
                  onBlur={(e) => {
                      const v = parseInt(e.target.value); 
                      if(v > 0) changePreset(v);
                  }}
                />
              </div>


            </div>
          </div>

          <div className="min-h-[9rem] shrink-0 rounded-[2.5rem] bg-white/70 backdrop-blur-xl border border-white/60 shadow-xl shadow-slate-200/50 p-6 flex flex-col justify-center gap-3">
             <div className="flex items-center justify-between">
                <h3 className="text-xs font-black uppercase tracking-widest text-slate-800 flex items-center gap-2">
                   <Target className="h-4 w-4 text-primary"/> Resumo do Dia
                </h3>
                <div className="flex items-center gap-1.5 text-[9px] font-black text-indigo-600 bg-indigo-50 border border-indigo-100 px-2.5 py-1 rounded-lg">
                   <TrendingUp className="h-3 w-3 text-indigo-500" />
                   <span className="uppercase tracking-wider">Consistência: {streak} Dias</span>
                </div>
             </div>
            
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-xs font-bold text-slate-600 bg-white px-3 py-1.5 rounded-lg border border-slate-200/50 shadow-sm">
                 <Clock className="h-3.5 w-3.5 text-primary"/> {totalFocusTime} min
              </div>
              <div className="text-[10px] font-bold uppercase tracking-widest">
                {isEditingGoal ? (
                  <input 
                    autoFocus
                    type="number" 
                    className="h-6 w-16 text-xs text-center border rounded outline-none text-slate-600 focus:border-primary/50" 
                    defaultValue={dailyGoal}
                    onBlur={(e) => { setDailyGoal(Number(e.target.value) || 120); setIsEditingGoal(false); }}
                    onKeyDown={(e) => { if(e.key === 'Enter') { setDailyGoal(Number(e.currentTarget.value) || 120); setIsEditingGoal(false); } }}
                  />
                ) : (
                  <span onClick={() => setIsEditingGoal(true)} className="underline decoration-dashed underline-offset-4 cursor-pointer text-slate-500 hover:text-slate-700">
                    Meta: {dailyGoal} min
                  </span>
                )}
              </div>
            </div>

            {getCategoryStats().total > 0 ? (
              <div className="flex flex-col gap-2 mt-1">
                <div className="h-3 bg-slate-100 rounded-full overflow-hidden border border-slate-200/50 flex">
                  {Object.entries(getCategoryStats().stats).map(([cat, minutes]) => {
                    if (minutes === 0) return null;
                    const pct = (minutes / getCategoryStats().total) * 100;
                    return (
                      <div 
                        key={cat} 
                        className={cn("h-full transition-all duration-1000", CATEGORY_PROGRESS_COLORS[cat])}
                        style={{ width: `${pct}%` }}
                        title={`${cat}: ${minutes}m (${Math.round(pct)}%)`}
                      />
                    );
                  })}
                </div>
                <div className="flex gap-2 text-[9px] font-black text-slate-500 flex-wrap justify-between tracking-wider uppercase">
                  {Object.entries(getCategoryStats().stats).map(([cat, minutes]) => {
                    if (minutes === 0) return null;
                    const pct = Math.round((minutes / getCategoryStats().total) * 100);
                    return (
                      <span key={cat} className="flex items-center gap-1 font-sans">
                        <span className={cn("w-1.5 h-1.5 rounded-full", CATEGORY_PROGRESS_COLORS[cat])} />
                        {cat}: {pct}%
                      </span>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div className="h-2.5 bg-slate-100 rounded-full overflow-hidden border border-slate-200/50 mt-1">
                <div className="h-full bg-primary transition-all duration-1000 relative" style={{ width: `${Math.min((totalFocusTime / dailyGoal) * 100, 100)}%` }}>
                   <div className="absolute inset-0 bg-white/20" />
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="md:col-span-5 flex flex-col h-full rounded-[2.5rem] bg-white/70 backdrop-blur-xl border border-white/60 shadow-xl shadow-slate-200/50 p-6 overflow-hidden relative">
          <Tabs defaultValue="queue" className="flex-1 flex flex-col min-h-0 w-full h-full">
            <div className="shrink-0 mb-5">
              <TabsList className="bg-slate-100/50 h-12 p-1.5 rounded-[1.25rem] w-full border border-slate-200/50">
                 <TabsTrigger value="queue" className="rounded-xl text-[10px] lg:text-xs font-black uppercase tracking-widest flex-1 h-full data-[state=active]:shadow-sm">Fila de Foco</TabsTrigger>
                 <TabsTrigger value="history" className="rounded-xl text-[10px] lg:text-xs font-black uppercase tracking-widest flex-1 h-full data-[state=active]:shadow-sm">Histórico</TabsTrigger>
              </TabsList>
            </div>

            <TabsContent value="queue" className="flex-1 flex flex-col min-h-0 mt-0 data-[state=active]:flex data-[state=inactive]:hidden">
               <form onSubmit={handleAddManualTask} className="flex gap-2 shrink-0 mb-4 items-center">
                 <input type="text" placeholder="Adicionar tarefa..." value={manualTaskTitle}
                   onChange={e => setManualTaskTitle(e.target.value)}
                   className="flex-1 h-10 px-4 rounded-xl text-xs font-semibold outline-none bg-white border border-slate-200 text-slate-900 placeholder:text-slate-400 focus:border-primary/50 focus:ring-2 focus:ring-primary/20 transition-all shadow-sm" />
                 
                 <select 
                   value={manualCategory}
                   onChange={e => setManualCategory(e.target.value)}
                   className="h-10 px-2 rounded-xl text-xs font-bold bg-white border border-slate-200 text-slate-700 outline-none focus:border-primary/50 transition-all shadow-sm cursor-pointer"
                 >
                   {CATEGORIES.map(c => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                 </select>

                 <button type="submit" disabled={!manualTaskTitle.trim()}
                   className="h-10 px-4 rounded-xl text-[10px] font-black uppercase tracking-wider bg-slate-900 text-white disabled:opacity-40 hover:bg-slate-800 active:scale-95 transition-all shadow-md shrink-0">
                   Add
                 </button>
               </form>

               <div className="flex-1 overflow-y-auto no-scrollbar flex flex-col gap-2 min-h-0 pr-1">
                  {availableTasks.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full gap-3 text-slate-300">
                      <Sparkles className="h-8 w-8 opacity-50" />
                      <span className="text-xs font-semibold text-center text-slate-400">Sem tarefas na fila.</span>
                    </div>
                  ) : (
                    availableTasks.map(task => {
                        const { id: jiraId, name } = parseJiraTask(task.title, task.id);
                        const taskCategory = getTaskCategory(task);
                        return (
                           <div 
                              key={task.id} 
                              onClick={() => setSelectedTaskId(selectedTaskId === task.id ? null : task.id)}
                              className={cn(
                                 "group w-full p-3.5 rounded-2xl transition-all flex items-start gap-3 border cursor-pointer select-none",
                                 selectedTaskId === task.id 
                                   ? "bg-indigo-50/50 border-indigo-200/80 shadow-sm" 
                                   : "bg-white/60 backdrop-blur-sm border-slate-200 hover:border-slate-300 hover:shadow-md"
                              )}
                           >
                              <div className={cn("w-5 h-5 mt-0.5 rounded-md flex items-center justify-center shrink-0 border transition-all", selectedTaskId === task.id ? "bg-primary border-primary text-white" : "border-slate-300 bg-white")}>
                                 {selectedTaskId === task.id && <CheckCircle2 className="h-3 w-3" />}
                              </div>
                              <div className="flex-1 flex flex-col gap-1.5 min-w-0">
                                 <div className="flex items-center gap-2 flex-wrap">
                                    {jiraId && <Badge variant="secondary" className="text-[9px] px-1.5 py-0 rounded bg-indigo-50 text-indigo-600 border border-indigo-100 font-black tracking-widest">{jiraId}</Badge>}
                                     <Badge 
                                       variant="outline" 
                                       onClick={(e) => handleCycleCategory(task.id, e)}
                                       className={cn("text-[9px] px-1.5 py-0 rounded font-black tracking-widest border transition-all cursor-pointer select-none hover:brightness-95 active:scale-95 flex items-center gap-1", CATEGORY_COLORS[taskCategory])}
                                       title="Clique para alterar a categoria"
                                     >
                                       {CATEGORY_ICONS[taskCategory]}
                                       <span>{taskCategory}</span>
                                     </Badge>
                                 </div>
                                 <span className={cn("text-xs font-bold leading-tight", selectedTaskId === task.id ? "text-primary" : "text-slate-700")}>{name}</span>
                              </div>
                              <div className="flex items-center gap-1 opacity-40 lg:opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                                <button 
                                  onClick={(e) => { e.stopPropagation(); setSelectedTaskId(selectedTaskId === task.id ? null : task.id); }} 
                                  title="Focar" 
                                  className={cn("p-1.5 rounded-lg transition-colors", selectedTaskId === task.id ? "bg-primary/10 text-primary" : "text-slate-400 hover:text-primary hover:bg-primary/10")}
                                >
                                  <Target className="h-4 w-4" />
                                </button>
                                <button onClick={(e) => { e.stopPropagation(); onEditTask && onEditTask(task.id, task.title); }} title="Editar" className="p-1.5 rounded-lg hover:bg-slate-200 text-slate-400 hover:text-slate-600 transition-colors">
                                  <Edit2 className="h-4 w-4" />
                                </button>
                                <button onClick={(e) => { e.stopPropagation(); onDeleteTask && onDeleteTask(task.id); }} title="Excluir" className="p-1.5 rounded-lg hover:bg-red-100 text-red-400 hover:text-red-600 transition-colors">
                                  <Trash2 className="h-4 w-4" />
                                </button>
                              </div>
                           </div>
                        )
                    })
                  )}
               </div>
            </TabsContent>

            <TabsContent value="history" className="flex-1 flex flex-col min-h-0 mt-0 data-[state=active]:flex data-[state=inactive]:hidden">
               {getTaskHistory().length > 0 && (
                 <div className="flex justify-between items-center mb-3 shrink-0 px-1">
                   <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Ciclos do Dia</span>
                   <Button 
                     variant="ghost" 
                     onClick={() => { 
                        if (confirm('Deseja limpar todo o histórico de hoje?')) {
                          if (onClearHistory) {
                            onClearHistory();
                          } else {
                            setSessionHistory([]);
                          }
                        }
                      }} 
                     className="h-7 px-2 text-[9px] font-black text-rose-500 hover:bg-rose-50 hover:text-rose-600 uppercase tracking-widest rounded-lg flex items-center gap-1"
                   >
                     <Trash2 className="h-3.5 w-3.5" /> Limpar Tudo
                   </Button>
                 </div>
               )}
               <div className="flex-1 overflow-y-auto no-scrollbar flex flex-col gap-2 min-h-0 pr-1">
                  {getTaskHistory().length === 0 ? (
                     <div className="flex flex-col items-center justify-center h-full gap-3 text-slate-300">
                        <CheckCircle2 className="h-8 w-8 opacity-30" />
                        <span className="text-xs text-slate-400 font-medium text-center">Nenhum ciclo concluído hoje.</span>
                     </div>
                  ) : (
                     getTaskHistory().map((historyItem, idx) => {
                        const { id: jiraId, name } = parseJiraTask(historyItem.title, historyItem.id);
                        return (
                           <div key={idx} className="w-full p-3.5 rounded-2xl flex items-center justify-between border border-emerald-200/50 bg-emerald-50/50 backdrop-blur-sm transition-all hover:shadow-md">
                              <div className="flex items-center gap-3 min-w-0">
                                 <div className="w-7 h-7 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center shrink-0 shadow-sm">
                                    <CheckCircle2 className="h-4 w-4" />
                                 </div>
                                 <div className="flex flex-col gap-1.5 min-w-0">
                                    <div className="flex items-center gap-2 flex-wrap">
                                       {jiraId && <Badge variant="outline" className="text-[9px] px-1.5 py-0 rounded bg-white text-emerald-700 border-emerald-200 font-black tracking-widest">{jiraId}</Badge>}
                                        {historyItem.category && (
                                           <Badge variant="outline" className={cn("text-[9px] px-1.5 py-0 rounded font-black tracking-widest border flex items-center gap-1", CATEGORY_COLORS[historyItem.category])}>
                                              {CATEGORY_ICONS[historyItem.category]}
                                              <span>{historyItem.category}</span>
                                           </Badge>
                                         )}
                                    </div>
                                    <span className="text-xs font-bold text-slate-700 truncate">{name}</span>
                                 </div>
                              </div>
                              <div className="flex flex-col items-end shrink-0 pl-3">
                                 <span className="text-[10px] font-black text-emerald-700 uppercase tracking-widest bg-emerald-100 px-2.5 py-1 rounded-lg">
                                    {historyItem.duration} min
                                 </span>
                              </div>
                           </div>
                        )
                     })
                  )}
               </div>
            </TabsContent>
          </Tabs>
        </div>
      </div>

      {/* ===================== ZEN MODE (Mantido como tela cheia imersiva) ===================== */}
      <Portal>
        <AnimatePresence>
          {isZenMode && (
            <motion.div
              initial={{ opacity: 0, scale: 0.9, filter: 'blur(20px)' }}
              animate={{ opacity: 1, scale: 1, filter: 'blur(0px)' }}
              exit={{ opacity: 0, scale: 0.9, filter: 'blur(20px)' }}
              transition={{ type: 'spring', damping: 30, stiffness: 100 }}
              className="fixed inset-0 z-[99999] bg-slate-950 flex flex-col items-center p-6 md:p-10 overflow-hidden"
            >
              {/* Background */}
              <div className="absolute inset-0 pointer-events-none">
                <div className={cn("absolute inset-0 opacity-20 transition-colors duration-1000",
                  mode === 'work'
                    ? "bg-[radial-gradient(ellipse_at_top_left,_var(--tw-gradient-stops))] from-primary via-slate-950 to-slate-950"
                    : "bg-[radial-gradient(ellipse_at_top_left,_var(--tw-gradient-stops))] from-emerald-600 via-slate-950 to-slate-950"
                )} />
                <div className="absolute inset-0 opacity-20 bg-[radial-gradient(ellipse_at_bottom_right,_var(--tw-gradient-stops))] from-blue-700 via-transparent to-transparent" />
                <div className="absolute inset-0 opacity-20" style={{ backgroundImage: 'radial-gradient(2px 2px at 20px 30px, white, rgba(0,0,0,0)), radial-gradient(2px 2px at 40px 70px, #fff, rgba(0,0,0,0)), radial-gradient(2px 2px at 90px 40px, #fff, rgba(0,0,0,0)), radial-gradient(2px 2px at 130px 80px, #fff, rgba(0,0,0,0)), radial-gradient(2px 2px at 160px 120px, #ddd, rgba(0,0,0,0))', backgroundSize: '200px 200px' }} />
              </div>

              <Button onClick={() => setIsZenMode(false)} variant="ghost"
                className="absolute top-6 right-6 z-[110] h-12 w-12 rounded-2xl bg-white/10 text-white hover:bg-white/20 border border-white/10 flex items-center justify-center">
                <Minimize2 className="h-5 w-5" />
              </Button>

              <div className="relative z-10 flex flex-col items-center justify-between h-full w-full max-w-5xl py-2">
                {/* Quote */}
                <motion.p initial={{ y: -20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.2 }}
                  className="text-xl md:text-2xl font-medium text-white/50 italic text-center max-w-xl px-4 shrink-0">
                  "{currentQuote}"
                </motion.p>

                {/* Big clock */}
                <div className="flex flex-col items-center justify-center flex-1 w-full min-h-0">
                  <div className="relative flex items-center justify-center w-[min(80vmin,350px)] h-[min(80vmin,350px)] md:w-[min(70vmin,600px)] md:h-[min(70vmin,600px)]">
                    <motion.div
                      animate={{ scale: isActive ? [1, 1.05, 1] : 1, opacity: isActive ? [0.2, 0.4, 0.2] : 0.2 }}
                      transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
                      className={cn("absolute inset-0 blur-[80px] md:blur-[120px] rounded-full", mode === 'work' ? "bg-primary" : "bg-emerald-500")}
                    />
                    <svg className="w-full h-full transform -rotate-90 absolute inset-0" viewBox="0 0 500 500">
                      <circle cx="250" cy="250" r="230" stroke="white" strokeWidth="2" fill="transparent" className="opacity-10" />
                      <motion.circle cx="250" cy="250" r="230" stroke="currentColor" strokeWidth="6" fill="transparent"
                        strokeDasharray={1445}
                        animate={{ strokeDashoffset: 1445 - (1445 * progress) / 100 }}
                        className={mode === 'work' ? "text-primary" : "text-emerald-500"}
                        strokeLinecap="round" transition={{ ease: "linear", duration: 1 }} />
                    </svg>
                    <div className="absolute inset-0 flex flex-col items-center justify-center p-4">
                      <motion.span key={minutes}
                        className="font-black italic tracking-tighter leading-none text-[5.5rem] sm:text-[7rem] md:text-[12rem] text-white drop-shadow-[0_0_40px_rgba(255,255,255,0.4)]">
                        {String(minutes).padStart(2, '0')}:{String(seconds).padStart(2, '0')}
                      </motion.span>
                      {selectedTask && (
                        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 0.6 }}
                          className="mt-1 px-4 py-1 rounded-2xl bg-white/5 border border-white/10 text-[9px] font-black uppercase tracking-[0.4em] text-white max-w-[80%] text-center truncate mb-3">
                          {selectedTask.title}
                        </motion.div>
                      )}
                      <motion.button onClick={toggleTimer} whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
                        className={cn("h-14 w-14 md:h-20 md:w-20 rounded-full shadow-2xl flex items-center justify-center",
                          isActive ? "bg-white text-slate-950" : "bg-primary text-white shadow-primary/50")}>
                        {isActive ? <Pause className="h-6 w-6 md:h-8 md:w-8" /> : <Play className="h-6 w-6 md:h-8 md:w-8 ml-1" />}
                      </motion.button>
                    </div>
                  </div>
                </div>

                {/* Bottom controls */}
                <div className={cn("shrink-0 flex items-end justify-center w-full h-[120px] transition-all duration-1000",
                  isActive ? "opacity-0 translate-y-10 pointer-events-none" : "opacity-100 translate-y-0")}>
                  <div className="flex flex-col md:flex-row items-center gap-4 md:gap-8">
                    <div className="flex gap-3">
                      {[25, 45, 60].map(m => (
                        <button key={m} onClick={() => changePreset(m)}
                          className={cn("px-6 py-2 md:px-8 md:py-3 rounded-2xl text-[10px] md:text-xs font-black uppercase tracking-widest border-2 active:scale-95 transition-all",
                            baseMinutes === m ? "bg-primary text-white border-primary shadow-2xl" : "bg-white/5 text-white/40 border-white/10 hover:bg-white/10")}>
                          {m}m
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </Portal>
    </>
  );
}
