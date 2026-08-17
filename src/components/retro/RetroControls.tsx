'use client';

import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { 
  Eye, 
  EyeOff, 
  Vote, 
  SquareCheck, 
  RefreshCw, 
  Timer as TimerIcon, 
  Play, 
  Pause, 
  RotateCcw, 
  ThumbsUp, 
  FileText, 
  Users,
  Clock,
  Download,
  Volume2,
  VolumeX
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { TimerState } from "@/lib/types";
import { useState, useEffect, useRef } from "react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

interface RetroControlsProps {
  isCardsRevealed: boolean;
  onToggleCardsRevealed: () => void;
  votingStatus: 'disabled' | 'active' | 'finished';
  onSetVotingStatus: (status: 'disabled' | 'active' | 'finished') => void;
  // Timer Props
  timer?: TimerState;
  isFacilitator: boolean;
  onSetTimerDuration: (duration: number) => void;
  onStartTimer: (duration: number) => void;
  onPauseTimer: () => void;
  onResumeTimer: () => void;
  onResetTimer: () => void;
  // Sorting Props
  onExport: () => void;
  activeStage: string;
  onStageChange: (stage: any) => void;
  // Audio Props
  isSoundEnabled: boolean;
  onToggleSound: (enabled: boolean) => void;
  // Auto-revelar ao fim do timer (config. em RetroSettingsDialog)
  autoRevealOnTimerEnd?: boolean;
}

const DURATION_OPTIONS = [120, 180, 240, 300]; // 2, 3, 4, 5 mins

export function RetroControls({ 
  isCardsRevealed, 
  onToggleCardsRevealed,
  votingStatus,
  onSetVotingStatus,
  timer,
  isFacilitator,
  onSetTimerDuration,
  onStartTimer,
  onPauseTimer,
  onResumeTimer,
  onResetTimer,
  onExport,
  activeStage,
  onStageChange,
  isSoundEnabled,
  onToggleSound,
  autoRevealOnTimerEnd
}: RetroControlsProps) {
  const [remainingTime, setRemainingTime] = useState(timer?.initialDuration ?? 300);
  const prevStatusRef = useRef(timer?.status);

  useEffect(() => {
    if (timer?.status !== 'running' || !timer.endTime) {
      if (timer?.status === 'paused') {
        setRemainingTime(timer.remainingOnPause);
      } else {
        setRemainingTime(timer?.initialDuration ?? 300);
      }
      prevStatusRef.current = timer?.status;
      return;
    }
    
    const interval = setInterval(() => {
      const now = Date.now();
      const end = timer.endTime!;
      const remaining = Math.round((end - now) / 1000);
      
      if (remaining <= 0 && prevStatusRef.current === 'running') {
        if (isSoundEnabled) {
          const audio = new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3');
          audio.play().catch(e => console.warn("Audio play failed:", e));
        }
        if (autoRevealOnTimerEnd && isFacilitator && !isCardsRevealed) {
          onToggleCardsRevealed();
        }
        prevStatusRef.current = 'stopped'; // Marker
      }

      setRemainingTime(Math.max(0, remaining));
    }, 1000);

    prevStatusRef.current = 'running';
    return () => clearInterval(interval);
  }, [timer, isSoundEnabled, autoRevealOnTimerEnd, isFacilitator, isCardsRevealed, onToggleCardsRevealed]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  };

  const isRunning = timer?.status === 'running';
  const isPaused = timer?.status === 'paused';
  const isStopped = !timer || timer.status === 'stopped';

  return (
    <>
      {/* 🛠️ CONTROLES GLOBAIS DE TOPO (Para injeção no RoomHeader) */}
      <div className="flex items-center gap-3 shrink-0 pr-2">
        {/* VISIBILIDADE */}
        <div className="flex items-center gap-2.5 px-3 py-1 bg-slate-50/50 rounded-xl border border-slate-200/30">
          <div className={cn(
            "p-1.5 rounded-lg transition-all",
            isCardsRevealed ? "bg-indigo-600 text-white" : "bg-slate-200 text-slate-400"
          )}>
            {isCardsRevealed ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
          </div>
          <div className="flex flex-col min-w-[70px]">
            <span className="text-[8px] font-black uppercase tracking-widest text-slate-400 leading-none mb-0.5">Cards</span>
            <div className="flex items-center gap-1.5">
              <span className="text-[9px] font-black uppercase text-slate-600">{isCardsRevealed ? "Públicos" : "Ocultos"}</span>
              {isFacilitator && (
                <Switch
                  checked={isCardsRevealed}
                  onCheckedChange={onToggleCardsRevealed}
                  className="scale-[0.6] data-[state=checked]:bg-indigo-600 h-4 w-8"
                />
              )}
            </div>
          </div>
        </div>

        <div className="w-px h-5 bg-slate-200 mx-1 hidden sm:block" />

        {/* VOTAÇÃO */}
        <div className="flex items-center gap-1 hidden sm:flex">
          {votingStatus === 'disabled' ? (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="inline-block">
                    <Button 
                      onClick={() => onSetVotingStatus('active')} 
                      disabled={!isCardsRevealed || !isFacilitator} 
                      size="sm" 
                      className="h-8 px-3 text-[9px] font-black uppercase tracking-widest rounded-xl bg-slate-900 hover:bg-slate-800 text-white shadow-lg disabled:opacity-50"
                    >
                      <Vote className="sm:mr-1.5 h-3.5 w-3.5" /> <span className="hidden xl:inline">Iniciar Votos</span>
                    </Button>
                  </div>
                </TooltipTrigger>
                {(!isCardsRevealed || !isFacilitator) && (
                   <TooltipContent side="bottom" className="bg-slate-900 text-white border-none rounded-xl p-3 shadow-2xl z-[9999]">
                     <p className="text-[10px] font-black uppercase tracking-widest leading-relaxed max-w-[200px]">
                       {!isCardsRevealed 
                         ? "⚠️ Revele os cards para iniciar" 
                         : "🔒 Apenas facilitador"}
                     </p>
                   </TooltipContent>
                )}
              </Tooltip>
            </TooltipProvider>
          ) : votingStatus === 'active' ? (
            <Button 
              variant="destructive" 
              onClick={() => onSetVotingStatus('finished')} 
              disabled={!isFacilitator}
              size="sm" 
              className="h-8 px-3 text-[9px] font-black uppercase tracking-widest rounded-xl shadow-lg animate-pulse"
            >
              <SquareCheck className="sm:mr-1.5 h-3.5 w-3.5" /> <span className="hidden xl:inline">Encerrar</span>
            </Button>
          ) : (
            <Button 
              variant="outline" 
              onClick={() => onSetVotingStatus('disabled')} 
              disabled={!isFacilitator}
              size="sm" 
              className="h-8 px-3 text-[9px] font-black uppercase tracking-widest rounded-xl border-slate-200 text-slate-500 bg-slate-50 hover:bg-slate-100"
              title="Resetar Votação"
            >
              <RefreshCw className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>

        <div className="w-px h-5 bg-slate-200 mx-1 hidden lg:block" />

        {/* TIMER */}
        <div className="flex items-center gap-2 px-2.5 py-1 bg-slate-100/40 rounded-xl border border-slate-200/30 backdrop-blur-sm transition-all hover:bg-slate-100/60">
          <div className={cn(
            "p-1.5 rounded-lg transition-all",
            isRunning ? "bg-indigo-600 text-white shadow-[0_0_12px_rgba(79,70,229,0.3)] animate-pulse" : "text-slate-400"
          )}>
            <Clock className="h-3.5 w-3.5" />
          </div>
          <span className={cn(
            "font-mono text-sm sm:text-lg font-black tabular-nums tracking-tighter w-[54px] text-center",
            isRunning && remainingTime <= 30 ? "text-red-500" : "text-slate-700"
          )}>
            {formatTime(remainingTime)}
          </span>

          {isFacilitator && (
            <div className="flex items-center gap-0.5">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => onToggleSound(!isSoundEnabled)}
                className={cn(
                  "h-7 w-7 rounded-lg transition-all mr-1",
                  isSoundEnabled ? "text-emerald-600 hover:bg-emerald-50" : "text-slate-300 hover:bg-slate-50"
                )}
                title={isSoundEnabled ? "Desativar Som" : "Ativar Som"}
              >
                {isSoundEnabled ? <Volume2 className="h-3.5 w-3.5" /> : <VolumeX className="h-3.5 w-3.5" />}
              </Button>

              {isStopped ? (
                <>
                  <div className="flex items-center pr-1 gap-0.5">
                    {DURATION_OPTIONS.map(d => (
                       <Button
                         key={d}
                         variant="ghost"
                         size="icon"
                         onClick={() => onSetTimerDuration(d)}
                         className={cn(
                           "h-6 w-6 text-[8px] font-black rounded-md transition-all",
                           timer?.initialDuration === d ? "bg-white text-indigo-600 shadow-sm border border-slate-100" : "text-slate-400 hover:text-slate-600"
                         )}
                       >
                         {d/60}m
                       </Button>
                    ))}
                  </div>
                  <Button size="icon" variant="ghost" className="h-7 w-7 text-emerald-600 hover:bg-emerald-50 rounded-lg" onClick={() => onStartTimer(timer?.initialDuration ?? 300)}>
                    <Play className="h-4 w-4 fill-current" />
                  </Button>
                </>
              ) : (
                <>
                  {isRunning ? (
                    <Button size="icon" variant="ghost" className="h-7 w-7 text-amber-500 hover:bg-amber-50 rounded-lg" onClick={onPauseTimer}>
                      <Pause className="h-4 w-4 fill-current" />
                    </Button>
                  ) : (
                    <Button size="icon" variant="ghost" className="h-7 w-7 text-emerald-600 hover:bg-emerald-50 rounded-lg" onClick={onResumeTimer}>
                      <Play className="h-4 w-4 fill-current" />
                    </Button>
                  )}
                  <Button size="icon" variant="ghost" className="h-7 w-7 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg" onClick={onResetTimer}>
                    <RotateCcw className="h-3.5 w-3.5" />
                  </Button>
                </>
              )}
            </div>
          )}
        </div>

        <div className="w-px h-5 bg-slate-200 mx-1 hidden xl:block" />

        {/* EXPORT */}
        <Button 
          variant="ghost"
          size="icon"
          onClick={onExport}
          className="h-8 w-8 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-all hidden lg:flex"
          title="Exportar Resumo"
        >
          <Download className="h-4 w-4" />
        </Button>
      </div>
    </>
  );
}
