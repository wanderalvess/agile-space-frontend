'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { useUserContext } from '@/context/UserContext';
import { ThemeToggle } from '@/components/layout/ThemeToggle';
import { motion } from 'framer-motion';
import {
  Zap,
  Clock,
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Settings, LogOut, User } from 'lucide-react';

const DAILY_TIPS = [
  "Revise suas pendências antes de iniciar blocos de foco intensos.",
  "O modo foco (Calmaria) ajuda a evitar distrações durante o deep work.",
  "Um bom planejamento diário é o primeiro passo para um dia produtivo.",
  "Pausas curtas e estratégicas mantêm a sua energia em alta.",
  "Priorize as tarefas de maior impacto no início do dia.",
  "Mantenha seu backlog limpo e foque no que precisa ser entregue hoje."
];

export function HeroWidget() {
  const { userProfile, requestIdentity, isInitializing, setIsEditProfileOpen, logout } = useUserContext();

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

  const userName = userProfile?.name?.split(' ')[0] || 'Visitante';

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
      </div>
    </div>
  );
}
