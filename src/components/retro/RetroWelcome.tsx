'use client';

import { useEffect, useState } from 'react';
import { PenLine, Eye, Vote, ListChecks, X, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';

const DISMISS_KEY = 'agile_retro_welcome_dismissed';

interface RetroWelcomeProps {
  isFacilitator: boolean;
}

const STEPS = [
  { icon: PenLine, label: 'Escrever', hint: 'Cada pessoa escreve em silêncio. Os cards ficam ocultos para os outros.' },
  { icon: Eye, label: 'Revelar', hint: 'O facilitador revela os cards e o time funde ideias repetidas.' },
  { icon: Vote, label: 'Votar', hint: 'Cada pessoa vota nos temas que mais merecem a discussão.' },
  { icon: ListChecks, label: 'Agir', hint: 'Os temas mais votados viram ações com responsável e prazo.' },
];

// Faixa de boas-vindas do quadro vazio: mostra o fluxo da cerimônia em uma
// linha. Some sozinha quando o primeiro card aparece (o pai só a renderiza com
// o quadro vazio) e pode ser dispensada de vez.
export function RetroWelcome({ isFacilitator }: RetroWelcomeProps) {
  const [dismissed, setDismissed] = useState(true);

  useEffect(() => {
    try {
      setDismissed(localStorage.getItem(DISMISS_KEY) === 'true');
    } catch {
      setDismissed(false);
    }
  }, []);

  if (dismissed) return null;

  const handleDismiss = () => {
    setDismissed(true);
    try {
      localStorage.setItem(DISMISS_KEY, 'true');
    } catch {
      /* sem storage: some só nesta sessão */
    }
  };

  return (
    <div className="shrink-0 mb-3 flex items-center gap-3 rounded-2xl border border-emerald-200/60 dark:!border-emerald-800/40 bg-emerald-50/60 dark:!bg-emerald-950/20 backdrop-blur-xl pl-4 pr-2 py-2.5 animate-in fade-in slide-in-from-top-2 duration-500">
      <div className="hidden md:flex flex-col shrink-0 pr-3 mr-1 border-r border-emerald-200/60 dark:!border-emerald-800/40">
        <span className="text-[9px] font-black uppercase tracking-[0.2em] text-emerald-700 dark:!text-emerald-400">Como funciona</span>
        <span className="text-[10px] font-bold text-slate-500 dark:!text-slate-400">
          {isFacilitator ? 'Você conduz as etapas' : 'O facilitador conduz as etapas'}
        </span>
      </div>

      <ol className="flex-1 min-w-0 flex items-center gap-1 overflow-x-auto scrollbar-none">
        {STEPS.map(({ icon: Icon, label, hint }, i) => (
          <li key={label} className="flex items-center gap-1 shrink-0">
            {i > 0 && <ChevronRight className="h-3 w-3 text-emerald-400/70 shrink-0" />}
            <div
              title={hint}
              className={cn(
                'flex items-center gap-1.5 h-8 px-2.5 rounded-xl border text-[10px] font-black uppercase tracking-widest cursor-default',
                i === 0
                  ? 'bg-emerald-600 border-emerald-600 text-white shadow-md shadow-emerald-600/20'
                  : 'bg-white/70 dark:!bg-slate-800/50 border-slate-200/70 dark:!border-slate-600/50 text-slate-500 dark:!text-slate-300'
              )}
            >
              <Icon className="h-3.5 w-3.5 shrink-0" />
              <span className="text-[9px] opacity-60 tabular-nums">{i + 1}</span>
              {label}
            </div>
          </li>
        ))}
      </ol>

      <button
        type="button"
        onClick={handleDismiss}
        className="h-7 w-7 shrink-0 flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-700 hover:bg-white/70 dark:hover:!bg-slate-800/60 transition-all"
        title="Não mostrar de novo"
        aria-label="Dispensar boas-vindas"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
