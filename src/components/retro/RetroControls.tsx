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
  MonitorPlay,
  Volume2,
  VolumeX,
  LayoutGrid,
  Maximize2,
  Clock,
  SlidersHorizontal,
  Star,
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
  /** Chamado só no facilitador quando o timer chega a zero, para encerrar o timer no servidor. */
  onTimerExpired?: () => void;
  // Modo apresentação: botão no grupo de visão (omitido no modo compact)
  onPresent?: () => void;
  // compact: versão enxuta para a barra de apresentação — só status e controles
  // do facilitador (sem layout/apresentar), mas mantém o timer rodando.
  compact?: boolean;
  // Audio Props
  isSoundEnabled: boolean;
  onToggleSound: (enabled: boolean) => void;
  // Auto-revelar ao fim do timer (config. em RetroSettingsDialog)
  autoRevealOnTimerEnd?: boolean;
  // Layout Mode Props (Quadro completo vs Foco na coluna)
  layoutMode?: 'board' | 'focus';
  onToggleLayoutMode?: (mode: 'board' | 'focus') => void;
  // Limite de votos por pessoa (dot-voting) — 0/undefined = sem limite
  maxVotesPerParticipant?: number;
  onSetMaxVotesPerParticipant?: (max: number) => void;
}

const DURATION_OPTIONS = [120, 180, 240, 300]; // 2, 3, 4, 5 mins
const VOTE_LIMIT_OPTIONS = [0, 3, 5, 10]; // 0 = sem limite

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
  onTimerExpired,
  onPresent,
  compact = false,
  isSoundEnabled,
  onToggleSound,
  autoRevealOnTimerEnd,
  layoutMode = 'board',
  onToggleLayoutMode,
  maxVotesPerParticipant = 0,
  onSetMaxVotesPerParticipant,
}: RetroControlsProps) {
  const [remainingTime, setRemainingTime] = useState(timer?.initialDuration ?? 300);
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  // Valores que o fim do timer lê sem reiniciar o intervalo: o efeito abaixo só depende do relógio em si.
  const latestRef = useRef({ isSoundEnabled, autoRevealOnTimerEnd, isFacilitator, isCardsRevealed, onToggleCardsRevealed, onTimerExpired });
  latestRef.current = { isSoundEnabled, autoRevealOnTimerEnd, isFacilitator, isCardsRevealed, onToggleCardsRevealed, onTimerExpired };
  // endTime do último timer cujo fim já foi tratado (alarme, auto-revelar): cada fim dispara uma única vez.
  const firedForEndTimeRef = useRef<number | null>(null);

  const timerStatus = timer?.status;
  const timerEndTime = timer?.endTime ?? null;
  const timerPausedLeft = timer?.remainingOnPause;
  const timerInitial = timer?.initialDuration;

  useEffect(() => {
    if (timerStatus === 'paused') {
      setRemainingTime(timerPausedLeft ?? timerInitial ?? 300);
      return;
    }
    if (timerStatus !== 'running' || !timerEndTime) {
      setRemainingTime(timerInitial ?? 300);
      return;
    }

    // Quem abre ou recarrega a página bem depois do fim não ouve o alarme de novo: o fim já passou.
    if (timerEndTime - Date.now() <= -3000 && firedForEndTimeRef.current !== timerEndTime) {
      firedForEndTimeRef.current = timerEndTime;
      if (latestRef.current.isFacilitator) latestRef.current.onTimerExpired?.();
    }

    const tick = () => {
      const remaining = Math.max(0, Math.ceil((timerEndTime - Date.now()) / 1000));
      setRemainingTime(remaining);
      if (remaining > 0 || firedForEndTimeRef.current === timerEndTime) return;

      firedForEndTimeRef.current = timerEndTime;
      const latest = latestRef.current;
      if (latest.isSoundEnabled) {
        const audio = new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3');
        audio.play().catch(e => console.warn("Audio play failed:", e));
      }
      if (latest.isFacilitator) {
        if (latest.autoRevealOnTimerEnd && !latest.isCardsRevealed) latest.onToggleCardsRevealed();
        latest.onTimerExpired?.();
      }
    };

    tick(); // primeiro valor já na hora, sem mostrar a duração cheia por 1 segundo
    const interval = setInterval(tick, 500);
    return () => clearInterval(interval);
  }, [timerStatus, timerEndTime, timerPausedLeft, timerInitial]);

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
      <div className={cn(
        "items-center gap-2 px-2.5 py-1 bg-slate-50/50 rounded-xl border border-slate-200/30",
        (votingStatus !== 'disabled' || hasActiveTimer) ? "flex" : "hidden sm:flex"
      )}>
        <div className={cn(
          "p-1 rounded-lg transition-all hidden sm:block",
          isCardsRevealed ? "bg-emerald-600 text-white" : "bg-slate-200 text-slate-400"
        )}>
          {isCardsRevealed ? <Eye className="h-3 w-3" /> : <EyeOff className="h-3 w-3" />}
        </div>
        {votingStatus !== 'disabled' && (
          <span className={cn(
            "text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded-md",
            votingStatus === 'active' ? "bg-emerald-600 text-white animate-pulse" : "bg-slate-200 text-slate-500"
          )}>
            {votingStatus === 'active' ? 'Votando' : 'Votos'}
          </span>
        )}
        {hasActiveTimer && (
          <span className={cn(
            "flex items-center gap-1 font-code text-xs font-black tabular-nums",
            isRunning && remainingTime <= 30 ? "text-red-500" : "text-slate-600"
          )}>
            <Clock className="h-3 w-3" />
            {formatTime(remainingTime)}
          </span>
        )}
        {!!maxVotesPerParticipant && (
          <span
            className={cn(
              "hidden sm:flex items-center gap-1 font-code text-xs font-black tabular-nums text-slate-600"
            )}
            title="Cada painel é uma votação separada: este é o limite de votos por pessoa em cada painel"
          >
            <Star className="h-3 w-3" />
            {maxVotesPerParticipant} por painel
          </span>
        )}
      </div>

      {/* LAYOUT: preferência pessoal de visualização — sempre visível */}
      {!compact && onToggleLayoutMode && (
        <div className="flex items-center p-0.5 bg-slate-100/70 dark:bg-slate-800/60 rounded-xl border border-slate-200/40 dark:border-slate-600/40">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onToggleLayoutMode('board')}
                  aria-label="Visão quadro: todas as colunas lado a lado"
                  className={cn(
                    "h-7 px-2.5 text-[10px] font-bold uppercase tracking-wide rounded-lg transition-all gap-1.5",
                    layoutMode === 'board'
                      ? "bg-white text-slate-800 dark:!bg-slate-700 dark:!text-white shadow-sm border border-slate-200/50 dark:border-slate-600/50"
                      : "text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                  )}
                >
                  <LayoutGrid className="h-3.5 w-3.5" />
                  <span className="hidden 2xl:inline">Quadro</span>
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
                  aria-label="Visão foco: uma coluna por vez"
                  className={cn(
                    "h-7 px-2.5 text-[10px] font-bold uppercase tracking-wide rounded-lg transition-all gap-1.5",
                    layoutMode === 'focus'
                      ? "bg-white text-slate-800 dark:!bg-slate-700 dark:!text-white shadow-sm border border-slate-200/50 dark:border-slate-600/50"
                      : "text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                  )}
                >
                  <Maximize2 className="h-3.5 w-3.5" />
                  <span className="hidden 2xl:inline">Foco</span>
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="bg-slate-900 text-white rounded-xl text-[10px] font-black uppercase tracking-widest border-none">
                <p>Visão Foco: foco na coluna ativa</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      )}

      {!compact && onPresent && (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                onClick={onPresent}
                aria-label="Apresentar a retrospectiva em tela cheia"
                className="h-8 px-3 rounded-xl border border-slate-200/60 dark:border-slate-600/40 bg-slate-50/50 dark:bg-slate-800/50 text-slate-500 hover:bg-emerald-50 hover:text-emerald-600 hover:border-emerald-200 transition-all gap-1.5"
              >
                <MonitorPlay className="h-3.5 w-3.5" />
                <span className="text-[10px] font-bold uppercase tracking-wide hidden 2xl:inline">Apresentar</span>
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="bg-slate-900 text-white rounded-xl text-[10px] font-black uppercase tracking-widest border-none">
              <p>Modo apresentação · tela cheia por coluna</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      )}

      {/* AÇÕES PRINCIPAIS DO FACILITADOR — sempre visíveis no header */}
      {isFacilitator && (
        <div className="flex items-center gap-1.5">
          <Button
            variant="ghost"
            size="sm"
            onClick={onToggleCardsRevealed}
            title={isCardsRevealed ? "Ocultar os cards do time" : "Revelar os cards do time"}
            className={cn(
              "h-8 px-3 rounded-xl border transition-all gap-1.5",
              isCardsRevealed
                ? "bg-emerald-600 text-white border-emerald-600 hover:bg-emerald-700 hover:text-white shadow-md shadow-emerald-600/20"
                : "text-slate-600 dark:text-slate-300 border-slate-200/70 dark:border-slate-600/50 bg-slate-50/60 dark:bg-slate-800/50 hover:bg-emerald-50 dark:hover:bg-emerald-950/30 hover:text-emerald-600 hover:border-emerald-200"
            )}
          >
            {isCardsRevealed ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
            <span className="text-[10px] font-bold uppercase tracking-wide hidden md:inline">
              {isCardsRevealed ? "Cards visíveis" : "Revelar cards"}
            </span>
          </Button>

          {votingStatus === 'disabled' ? (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="inline-block">
                    <Button
                      size="sm"
                      onClick={() => onSetVotingStatus('active')}
                      disabled={!isCardsRevealed}
                      className="h-8 px-3 rounded-xl gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white shadow-md shadow-emerald-600/20 disabled:opacity-40 disabled:shadow-none"
                    >
                      <Vote className="h-3.5 w-3.5" />
                      <span className="text-[10px] font-bold uppercase tracking-wide hidden md:inline">Iniciar votação</span>
                    </Button>
                  </div>
                </TooltipTrigger>
                {!isCardsRevealed && (
                  <TooltipContent side="bottom" className={cn("bg-slate-900 text-white border-none rounded-xl p-2 text-xs font-medium", compact && "z-[130]")}>
                    Revele os cards primeiro
                  </TooltipContent>
                )}
              </Tooltip>
            </TooltipProvider>
          ) : votingStatus === 'active' ? (
            <Button
              variant="destructive"
              size="sm"
              onClick={() => onSetVotingStatus('finished')}
              className="h-8 px-3 rounded-xl gap-1.5 animate-pulse"
            >
              <SquareCheck className="h-3.5 w-3.5" />
              <span className="text-[10px] font-bold uppercase tracking-wide hidden md:inline">Encerrar votação</span>
            </Button>
          ) : (
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                if (typeof window === 'undefined' || window.confirm('Resetar a votação apaga todos os votos desta rodada. Continuar?')) {
                  onSetVotingStatus('disabled');
                }
              }}
              className="h-8 px-3 rounded-xl gap-1.5 border-border text-muted-foreground bg-transparent hover:bg-muted hover:text-foreground"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              <span className="text-[10px] font-bold uppercase tracking-wide hidden md:inline">Resetar votação</span>
            </Button>
          )}
        </div>
      )}

      {/* CONTROLES DO FACILITADOR — agrupados num único menu */}
      {isFacilitator && (
        <Popover open={isMenuOpen} onOpenChange={setIsMenuOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              title="Controles da sessão"
              aria-label="Controles da sessão"
              className={cn(
                "h-8 px-3 rounded-xl border transition-all gap-1.5",
                isMenuOpen
                  ? "bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600 border-emerald-200"
                  : "text-slate-500 border-slate-200/60 bg-slate-50/50 hover:bg-emerald-50 dark:hover:bg-emerald-950/30 hover:text-emerald-600"
              )}
            >
              <SlidersHorizontal className="h-3.5 w-3.5" />
              <span className="text-[10px] font-bold uppercase tracking-wide hidden 2xl:inline">Controles</span>
            </Button>
          </PopoverTrigger>
          {/* Na barra de apresentação (z-[110]) e com a coluna em tela cheia (z-[100]), o z-50 padrão ficaria por baixo */}
          <PopoverContent align="end" className={cn("w-[300px] rounded-2xl border-border shadow-2xl p-3 space-y-2 bg-card text-card-foreground", compact && "z-[130]")}>
            {/* Limite de votos por pessoa */}
            {onSetMaxVotesPerParticipant && (
              <div className="flex items-center justify-between gap-3 p-2.5 rounded-xl bg-muted/40 border border-border">
                <Label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                  <Star className="h-3 w-3" /> Votos por pessoa, por painel
                </Label>
                <div className="flex items-center gap-1">
                  {VOTE_LIMIT_OPTIONS.map(n => (
                    <Button
                      key={n}
                      variant="ghost"
                      size="sm"
                      onClick={() => onSetMaxVotesPerParticipant(n)}
                      title={n === 0 ? 'Sem limite de votos' : `${n} votos por pessoa em cada painel`}
                      className={cn(
                        "h-7 min-w-7 px-1.5 text-xs font-bold rounded-md transition-all",
                        maxVotesPerParticipant === n ? "bg-emerald-600 text-white shadow-sm border border-emerald-600" : "text-slate-400 hover:text-slate-600"
                      )}
                    >
                      {n === 0 ? '∞' : n}
                    </Button>
                  ))}
                </div>
              </div>
            )}

            {/* Timer */}
            <div className="p-2.5 rounded-xl bg-muted/40 border border-border space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                  <Clock className="h-3 w-3" /> Timer
                </Label>
                <div className="flex items-center gap-2">
                  <span className={cn(
                    "font-code text-sm font-black tabular-nums",
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
                          "h-7 min-w-7 px-1.5 text-xs font-bold rounded-md transition-all",
                          timer?.initialDuration === d ? "bg-emerald-600 text-white shadow-sm border border-emerald-600" : "text-slate-400 hover:text-slate-600"
                        )}
                      >
                        {d / 60}m
                      </Button>
                    ))}
                  </div>
                  <Button size="icon" variant="ghost" aria-label="Iniciar timer" className="h-7 w-7 text-emerald-600 hover:bg-emerald-100 rounded-lg" onClick={() => onStartTimer(timer?.initialDuration ?? 300)}>
                    <Play className="h-4 w-4 fill-current" />
                  </Button>
                </div>
              ) : (
                <div className="flex items-center justify-end gap-1">
                  {isRunning ? (
                    <Button size="icon" variant="ghost" aria-label="Pausar timer" className="h-7 w-7 text-amber-500 hover:bg-amber-100 rounded-lg" onClick={onPauseTimer}>
                      <Pause className="h-4 w-4 fill-current" />
                    </Button>
                  ) : (
                    <Button size="icon" variant="ghost" aria-label="Retomar timer" className="h-7 w-7 text-emerald-600 hover:bg-emerald-100 rounded-lg" onClick={onResumeTimer}>
                      <Play className="h-4 w-4 fill-current" />
                    </Button>
                  )}
                  <Button size="icon" variant="ghost" aria-label="Zerar timer" className="h-7 w-7 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg" onClick={onResetTimer}>
                    <RotateCcw className="h-3.5 w-3.5" />
                  </Button>
                </div>
              )}
            </div>
          </PopoverContent>
        </Popover>
      )}

    </div>
  );
}
