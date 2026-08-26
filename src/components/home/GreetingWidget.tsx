'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { useUserContext } from '@/context/UserContext';
import { Zap, Headphones, User, LogOut, Settings } from 'lucide-react';
import { ThemeToggle } from '@/components/layout/ThemeToggle';
import { useCalmariaStore } from '@/store/useCalmariaStore';
import { cn } from '@/lib/utils';
import { motion } from 'framer-motion';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

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

export function GreetingWidget() {
  const { userProfile, requestIdentity, isInitializing, setIsEditProfileOpen, logout } = useUserContext();
  const [greeting, setGreeting] = useState('Olá');
  const { toggleOpen, isTimerRunning, activeSounds } = useCalmariaStore();
  const isFocusActive = isTimerRunning || Object.keys(activeSounds).length > 0;
  
  const [phraseIndex, setPhraseIndex] = useState(0);

  useEffect(() => {
    setPhraseIndex(Math.floor(Math.random() * DAILY_TIPS.length));
    const interval = setInterval(() => {
      setPhraseIndex((prev) => (prev + 1) % DAILY_TIPS.length);
    }, 8000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const updateGreeting = () => {
      const hr = new Date().getHours();
      if (hr < 12) setGreeting('Bom dia');
      else if (hr < 18) setGreeting('Boa tarde');
      else setGreeting('Boa noite');
    };
    updateGreeting();
  }, []);

  const userName = userProfile?.name?.split(' ')[0] || 'Visitante';

  if (isInitializing) {
    return (
      <div className="flex flex-col justify-center bg-white/60 dark:bg-slate-900/60 backdrop-blur-xl p-8 md:p-10 rounded-[2.5rem] border border-white/60 dark:border-slate-800/60 shadow-lg min-h-[280px] h-full animate-pulse">
        <div className="space-y-4">
          <div className="h-3 w-24 bg-slate-200 dark:bg-slate-800 rounded" />
          <div className="h-8 w-64 bg-slate-200 dark:bg-slate-800 rounded" />
          <div className="h-4 w-80 bg-slate-200 dark:bg-slate-800 rounded" />
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col justify-center bg-white/60 dark:bg-slate-900/60 backdrop-blur-xl p-8 md:p-10 rounded-[2.5rem] border border-white/60 dark:border-slate-800/60 shadow-lg shadow-slate-200/50 dark:shadow-none min-h-[280px] h-full relative overflow-hidden group">
      {/* Decorative gradient highlight */}
      <div className="absolute top-[-20%] right-[-20%] w-[50%] h-[50%] bg-primary/5 dark:bg-primary/10 rounded-full blur-[100px] pointer-events-none group-hover:scale-110 transition-transform duration-700"></div>

      <div className="space-y-5 relative z-10">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 dark:text-slate-500">Resumo Diário</span>
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
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-6 w-6 rounded-lg border-none hover:bg-slate-100/50 dark:hover:bg-slate-800/50 text-slate-400 hover:text-slate-900 transition-all dark:hover:text-slate-100">
                  <User className="h-3.5 w-3.5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56 rounded-xl">
                {userProfile ? (
                  <>
                    <DropdownMenuLabel className="font-bold">Meu Perfil</DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => setIsEditProfileOpen(true)} className="cursor-pointer rounded-lg">
                      <Settings className="mr-2 h-4 w-4" />
                      <span>Configurações</span>
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={logout} className="cursor-pointer rounded-lg text-red-600 focus:bg-red-50 focus:text-red-700 dark:focus:bg-red-950 dark:focus:text-red-400">
                      <LogOut className="mr-2 h-4 w-4" />
                      <span>Sair</span>
                    </DropdownMenuItem>
                  </>
                ) : (
                  <DropdownMenuItem onClick={() => requestIdentity()} className="cursor-pointer rounded-lg">
                    <Zap className="mr-2 h-4 w-4" />
                    <span>Fazer Login</span>
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        <div className="space-y-2">
          <h1 className="text-3xl md:text-5xl font-black tracking-tight text-slate-900 dark:text-slate-100 leading-tight">
            {greeting}, <span className="text-primary">{userName}!</span>
          </h1>
          <div className="text-sm font-medium text-slate-500 dark:text-slate-400 leading-relaxed max-w-md min-h-[40px] flex items-start">
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
        </div>

        <div className="pt-1">
          {!userProfile && (
            <Button
              onClick={() => requestIdentity()}
              className="bg-primary hover:bg-orange-600 text-white font-extrabold uppercase text-[10px] tracking-widest rounded-xl h-10 px-6 active:scale-95 transition-all shadow-md flex items-center gap-2 w-fit border-none"
            >
              <Zap className="h-4 w-4 text-white animate-pulse" /> Fazer Login
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
