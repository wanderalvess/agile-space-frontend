'use client';

import { useState, useEffect, useRef } from 'react';
import { Timer as TimerIcon, Play, Pause, RotateCcw, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import type { TimerState } from '@/lib/types';

interface TimerProps {
  timer: TimerState | undefined;
  isFacilitator: boolean;
  onStart: (duration: number) => void;
  onPause: () => void;
  onResume: () => void;
  onReset: () => void;
  onSetDuration: (duration: number) => void;
  isSoundEnabled: boolean;
  onToggleSound: (enabled: boolean) => void;
  // Offset (ms) do relógio local para o do servidor. endTime é gravado em
  // epoch de servidor, então o "agora" também precisa do offset. Default 0 =
  // comportamento antigo (relógio local puro).
  serverOffset?: number;
  // Barra apertada (sala de poker): os 5 presets de duração viram um seletor
  // único abaixo de lg. Eram 5 botões sempre visíveis competindo com o resto
  // da barra. Default false = layout original (brainstorming não muda).
  compact?: boolean;
}

const DURATION_OPTIONS = [60, 120, 180, 240, 300]; // 1, 2, 3, 4, 5 minutos

export function EliteTimer({ 
  timer, 
  isFacilitator, 
  onStart, 
  onPause, 
  onResume, 
  onReset, 
  onSetDuration, 
  isSoundEnabled,
  onToggleSound,
  serverOffset = 0,
  compact = false,
}: TimerProps) {
  const [remainingTime, setRemainingTime] = useState(timer?.initialDuration ?? 120);
  // Guarda o endTime para o qual o alarme já tocou (em vez de um marcador de
  // status que era resetado a cada re-render do efeito, causando repetição
  // do som quando o objeto `timer` mudava de referência sem trocar de status).
  const remindedEndTimeRef = useRef<number | null>(null);

  useEffect(() => {
    if (timer?.status !== 'running' || !timer.endTime) {
      if (timer?.status === 'paused') {
        setRemainingTime(timer.remainingOnPause);
      } else {
        setRemainingTime(timer?.initialDuration ?? 120);
      }
      return;
    }

    const interval = setInterval(() => {
      // "agora" em epoch de servidor (mesma base do endTime).
      const now = Date.now() + serverOffset;
      const end = timer.endTime!;
      const remaining = Math.round((end - now) / 1000);

      if (remaining <= 0 && remindedEndTimeRef.current !== end && isSoundEnabled) {
        const audio = new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3');
        audio.play().catch(e => console.warn("Audio play failed:", e));
        remindedEndTimeRef.current = end; // Marca este endTime como já alertado
      }

      setRemainingTime(Math.max(0, remaining));
    }, 1000);

    const now = Date.now() + serverOffset;
    const end = timer.endTime!;
    const remaining = Math.round((end - now) / 1000);
    setRemainingTime(Math.max(0, remaining));

    return () => clearInterval(interval);
  }, [timer, isSoundEnabled, serverOffset]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  };

  const isRunning = timer?.status === 'running';
  const isPaused = timer?.status === 'paused';
  const isStopped = !timer || timer.status === 'stopped';
  const initialDuration = timer?.initialDuration ?? 120;
  
  return (
    <div className="flex items-center gap-2.5 shrink-0 bg-white/60 backdrop-blur-md px-3 py-1 rounded-xl border border-white/80 shadow-sm">
        <div className="flex items-center gap-2">
            <div className={cn(
              "p-1.5 rounded-lg transition-all",
              isRunning ? "bg-emerald-600 text-white shadow-lg shadow-emerald-500/20 animate-pulse" : "bg-slate-100 text-slate-400"
            )}>
              <TimerIcon className="h-3.5 w-3.5" />
            </div>
            <span className={cn(
                "font-mono text-xl font-black tabular-nums tracking-tighter leading-none italic",
                isRunning && remainingTime <= 10 && remainingTime > 0 ? "text-red-500 animate-bounce" : isRunning ? "text-slate-900" : "text-slate-400"
            )}>
                {formatTime(remainingTime)}
            </span>
        </div>

        <div className="flex items-center gap-2 border-l border-slate-200 pl-3 h-6">
            {isFacilitator && (
                <div className="flex items-center gap-2 border-l border-slate-100 ml-1 pl-3">
                    {isStopped && (
                        <div className={cn("items-center gap-1", compact ? "hidden lg:flex" : "flex")}>
                            {DURATION_OPTIONS.map(duration => (
                                <Button
                                    key={duration}
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => onSetDuration(duration)}
                                    className={cn(
                                      "h-8 px-2 text-[10px] font-black uppercase tracking-widest rounded-lg transition-all",
                                      initialDuration === duration 
                                        ? "bg-white text-emerald-600 shadow-sm border border-slate-100" 
                                        : "text-slate-400 hover:text-slate-600"
                                    )}
                                >
                                    {duration / 60}m
                                </Button>
                            ))}
                        </div>
                    )}

                    {/* Mesmos presets num seletor só, para telas onde a fileira
                        de botões não cabe. */}
                    {isStopped && compact && (
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    aria-label="Duração do timer"
                                    className="lg:hidden h-8 px-2 gap-1 text-[10px] font-black uppercase tracking-widest rounded-lg text-slate-500 hover:text-slate-700"
                                >
                                    {initialDuration / 60}m
                                    <ChevronDown className="h-3 w-3" />
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="min-w-[7rem]">
                                {DURATION_OPTIONS.map(duration => (
                                    <DropdownMenuItem
                                        key={duration}
                                        onClick={() => onSetDuration(duration)}
                                        className={cn(
                                          "text-[11px] font-bold uppercase tracking-widest",
                                          initialDuration === duration && "text-emerald-600"
                                        )}
                                    >
                                        {duration / 60} minutos
                                    </DropdownMenuItem>
                                ))}
                            </DropdownMenuContent>
                        </DropdownMenu>
                    )}
                    
                    <div className="flex items-center gap-1.5 ml-1">
                        {isStopped && (
                            <Button size="icon" variant="ghost" aria-label="Iniciar timer" className="h-9 w-9 text-emerald-600 hover:bg-emerald-50 rounded-xl" onClick={() => onStart(initialDuration)}>
                                <Play className="h-5 w-5 fill-current" />
                            </Button>
                        )}
                        {isRunning && (
                            <Button size="icon" variant="ghost" aria-label="Pausar timer" className="h-9 w-9 text-slate-600 hover:bg-slate-100 rounded-xl" onClick={onPause}>
                                <Pause className="h-5 w-5" />
                            </Button>
                        )}
                        {isPaused && (
                             <Button size="icon" variant="ghost" aria-label="Retomar timer" className="h-9 w-9 text-emerald-600 hover:bg-emerald-50 rounded-xl" onClick={onResume}>
                                <Play className="h-5 w-5 fill-current" />
                            </Button>
                        )}
                        <Button
                          size="icon"
                          variant="ghost"
                          aria-label="Reiniciar timer"
                          className="h-9 w-9 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-colors"
                          onClick={onReset}
                          disabled={isStopped}
                        >
                            <RotateCcw className="h-4 w-4" />
                        </Button>
                    </div>
                </div>
            )}
        </div>
    </div>
  );
}
