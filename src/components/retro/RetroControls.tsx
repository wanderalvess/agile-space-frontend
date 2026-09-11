'use client';

import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Eye,
  EyeOff,
  Vote,
  SquareCheck,
  RefreshCw,
  Play,
  Pause,
  RotateCcw,
  Download,
  Volume2,
  VolumeX,
  LayoutGrid,
  Maximize2,
  Clock,
  SlidersHorizontal,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import type { TimerState } from "@/lib/types";
import { useState, useEffect, useRef } from "react";
import { cn } from "@/lib/utils";

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
  // Audio Props
  isSoundEnabled: boolean;
  onToggleSound: (enabled: boolean) => void;
  // Auto-revelar ao fim do timer (config. em RetroSettingsDialog)
  autoRevealOnTimerEnd?: boolean;
  // Layout Mode Props (Quadro completo vs Foco na coluna)
  layoutMode?: 'board' | 'focus';
  onToggleLayoutMode?: (mode: 'board' | 'focus') => void;
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
  isSoundEnabled,
  onToggleSound,
  autoRevealOnTimerEnd,
  layoutMode = 'board',
  onToggleLayoutMode,
}: RetroControlsProps) {
  const [remainingTime, setRemainingTime] = useState(timer?.initialDuration ?? 300);
  const prevStatusRef = useRef(timer?.status);
  const [isMenuOpen, setIsMenuOpen] = useState(false);

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
  const hasActiveTimer = isRunning || isPaused;

  return (
    <div className="flex items-center gap-2 shrink-0 pr-2">
      {/* STATUS COMPACTO — visível pra todo mundo, sem controles */}
      <div className="hidden sm:flex items-center gap-2 px-2.5 py-1 bg-slate-50/50 rounded-xl border border-slate-200/30">
        <div className={cn(
          "p-1 rounded-lg transition-all",
          isCardsRevealed ? "bg-indigo-600 text-white" : "bg-slate-200 text-slate-400"
        )}>
          {isCardsRevealed ? <Eye className="h-3 w-3" /> : <EyeOff className="h-3 w-3" />}
        </div>
        {votingStatus !== 'disabled' && (
          <span className={cn(
            "text-[8px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded-md",
            votingStatus === 'active' ? "bg-slate-900 text-white animate-pulse" : "bg-slate-200 text-slate-500"
          )}>
            {votingStatus === 'active' ? 'Votando' : 'Votos'}
          </span>
        )}
        {hasActiveTimer && (
          <span className={cn(
            "flex items-center gap-1 font-mono text-xs font-black tabular-nums",
            isRunning && remainingTime <= 30 ? "text-red-500" : "text-slate-600"
          )}>
            <Clock className="h-3 w-3" />
            {formatTime(remainingTime)}
          </span>
        )}
      </div>

      {/* LAYOUT: preferência pessoal de visualização — sempre visível */}
      {onToggleLayoutMode && (
        <div className="flex items-center p-0.5 bg-slate-100/70 rounded-xl border border-slate-200/40">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onToggleLayoutMode('board')}
                  className={cn(
                    "h-7 px-2.5 text-[9px] font-black uppercase tracking-wider rounded-lg transition-all gap-1.5",
                    layoutMode === 'board'
                      ? "bg-white text-slate-800 shadow-sm border border-slate-200/50"
                      : "text-slate-400 hover:text-slate-600"
                  )}
                >
                  <LayoutGrid className="h-3.5 w-3.5" />
                  <span className="hidden lg:inline">Quadro</span>
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="bg-slate-900 text-white rounded-xl text-[10px] font-black uppercase tracking-widest border-none">
                <p>Visão Quadro: todas as colunas lado a lado</p>
              </TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onToggleLayoutMode('focus')}
                  className={cn(
                    "h-7 px-2.5 text-[9px] font-black uppercase tracking-wider rounded-lg transition-all gap-1.5",
                    layoutMode === 'focus'
                      ? "bg-white text-slate-800 shadow-sm border border-slate-200/50"
                      : "text-slate-400 hover:text-slate-600"
                  )}
                >
                  <Maximize2 className="h-3.5 w-3.5" />
                  <span className="hidden lg:inline">Foco</span>
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="bg-slate-900 text-white rounded-xl text-[10px] font-black uppercase tracking-widest border-none">
                <p>Visão Foco: foco na coluna ativa</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      )}

      {/* CONTROLES DO FACILITADOR — agrupados num único menu */}
      {isFacilitator && (
        <Popover open={isMenuOpen} onOpenChange={setIsMenuOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className={cn(
                "h-8 px-3 rounded-xl border transition-all gap-1.5",
                isMenuOpen
                  ? "bg-indigo-50 text-indigo-600 border-indigo-200"
                  : "text-slate-500 border-slate-200/60 bg-slate-50/50 hover:bg-indigo-50 hover:text-indigo-600"
              )}
            >
              <SlidersHorizontal className="h-3.5 w-3.5" />
              <span className="text-[9px] font-black uppercase tracking-widest hidden sm:inline">Controles</span>
            </Button>
          </PopoverTrigger>
          <PopoverContent align="end" className="w-[300px] rounded-2xl border-slate-200 shadow-2xl p-3 space-y-2 bg-white/95 backdrop-blur-xl">
            {/* Visibilidade */}
            <div className="flex items-center justify-between gap-3 p-2.5 rounded-xl bg-slate-50 border border-slate-100">
              <div className="flex items-center gap-2">
                <div className={cn("p-1.5 rounded-lg", isCardsRevealed ? "bg-indigo-600 text-white" : "bg-slate-200 text-slate-400")}>
                  {isCardsRevealed ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
                </div>
                <div>
                  <Label className="text-[9px] font-black uppercase tracking-widest text-slate-700 block leading-none">Cards</Label>
                  <span className="text-[9px] font-bold text-slate-400 uppercase">{isCardsRevealed ? "Públicos" : "Ocultos"}</span>
                </div>
              </div>
              <Switch
                checked={isCardsRevealed}
                onCheckedChange={onToggleCardsRevealed}
                className="data-[state=checked]:bg-indigo-600"
              />
            </div>

            {/* Votação */}
            <div className="flex items-center justify-between gap-3 p-2.5 rounded-xl bg-slate-50 border border-slate-100">
              <Label className="text-[9px] font-black uppercase tracking-widest text-slate-700">Votação</Label>
              {votingStatus === 'disabled' ? (
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div className="inline-block">
                        <Button
                          onClick={() => onSetVotingStatus('active')}
                          disabled={!isCardsRevealed}
                          size="sm"
                          className="h-7 px-3 text-[9px] font-black uppercase tracking-widest rounded-lg bg-slate-900 hover:bg-slate-800 text-white disabled:opacity-50"
                        >
                          <Vote className="mr-1.5 h-3 w-3" /> Iniciar
                        </Button>
                      </div>
                    </TooltipTrigger>
                    {!isCardsRevealed && (
                      <TooltipContent side="left" className="bg-slate-900 text-white border-none rounded-xl p-2 text-[9px] font-black uppercase tracking-widest">
                        Revele os cards primeiro
                      </TooltipContent>
                    )}
                  </Tooltip>
                </TooltipProvider>
              ) : votingStatus === 'active' ? (
                <Button
                  variant="destructive"
                  onClick={() => onSetVotingStatus('finished')}
                  size="sm"
                  className="h-7 px-3 text-[9px] font-black uppercase tracking-widest rounded-lg animate-pulse"
                >
                  <SquareCheck className="mr-1.5 h-3 w-3" /> Encerrar
                </Button>
              ) : (
                <Button
                  variant="outline"
                  onClick={() => onSetVotingStatus('disabled')}
                  size="sm"
                  className="h-7 px-3 text-[9px] font-black uppercase tracking-widest rounded-lg border-slate-200 text-slate-500 bg-white hover:bg-slate-100"
                >
                  <RefreshCw className="mr-1.5 h-3 w-3" /> Resetar
                </Button>
              )}
            </div>

            {/* Timer */}
            <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100 space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-[9px] font-black uppercase tracking-widest text-slate-700 flex items-center gap-1.5">
                  <Clock className="h-3 w-3" /> Timer
                </Label>
                <div className="flex items-center gap-2">
                  <span className={cn(
                    "font-mono text-sm font-black tabular-nums",
                    isRunning && remainingTime <= 30 ? "text-red-500" : "text-slate-700"
                  )}>
                    {formatTime(remainingTime)}
                  </span>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => onToggleSound(!isSoundEnabled)}
                    className={cn("h-6 w-6 rounded-lg", isSoundEnabled ? "text-emerald-600 hover:bg-emerald-50" : "text-slate-300 hover:bg-slate-100")}
                    title={isSoundEnabled ? "Desativar Som" : "Ativar Som"}
                  >
                    {isSoundEnabled ? <Volume2 className="h-3.5 w-3.5" /> : <VolumeX className="h-3.5 w-3.5" />}
                  </Button>
                </div>
              </div>

              {isStopped ? (
                <div className="flex items-center justify-between gap-1">
                  <div className="flex items-center gap-1">
                    {DURATION_OPTIONS.map(d => (
                      <Button
                        key={d}
                        variant="ghost"
                        size="sm"
                        onClick={() => onSetTimerDuration(d)}
                        className={cn(
                          "h-6 px-1.5 text-[9px] font-black rounded-md transition-all",
                          timer?.initialDuration === d ? "bg-white text-indigo-600 shadow-sm border border-slate-200" : "text-slate-400 hover:text-slate-600"
                        )}
                      >
                        {d / 60}m
                      </Button>
                    ))}
                  </div>
                  <Button size="icon" variant="ghost" className="h-7 w-7 text-emerald-600 hover:bg-emerald-100 rounded-lg" onClick={() => onStartTimer(timer?.initialDuration ?? 300)}>
                    <Play className="h-4 w-4 fill-current" />
                  </Button>
                </div>
              ) : (
                <div className="flex items-center justify-end gap-1">
                  {isRunning ? (
                    <Button size="icon" variant="ghost" className="h-7 w-7 text-amber-500 hover:bg-amber-100 rounded-lg" onClick={onPauseTimer}>
                      <Pause className="h-4 w-4 fill-current" />
                    </Button>
                  ) : (
                    <Button size="icon" variant="ghost" className="h-7 w-7 text-emerald-600 hover:bg-emerald-100 rounded-lg" onClick={onResumeTimer}>
                      <Play className="h-4 w-4 fill-current" />
                    </Button>
                  )}
                  <Button size="icon" variant="ghost" className="h-7 w-7 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg" onClick={onResetTimer}>
                    <RotateCcw className="h-3.5 w-3.5" />
                  </Button>
                </div>
              )}
            </div>
          </PopoverContent>
        </Popover>
      )}

      {/* EXPORT — sempre acessível */}
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              onClick={onExport}
              className="h-8 w-8 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-xl transition-all flex"
              title="Exportar Retrospectiva"
            >
              <Download className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="bg-slate-900 text-white rounded-xl text-[10px] font-black uppercase tracking-widest border-none">
            <p>Exportar Retrospectiva (PDF, Markdown, CSV)</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    </div>
  );
}
