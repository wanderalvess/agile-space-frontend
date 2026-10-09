'use client';

import { motion, AnimatePresence } from 'framer-motion';
import {
  ChevronLeft, ChevronRight, X, Ban, AlertTriangle, Maximize2, Minimize2, Check, Lock, PanelLeftClose, PanelLeftOpen, Timer
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { ShowcaseSession, Decision } from './types';

interface TeatroHeaderProps {
  session: ShowcaseSession;
  currentIndex: number;
  sortBy?: 'key' | 'type' | 'dev' | 'qa';
  isCover: boolean;
  isLight: boolean;
  canDecide: boolean;
  sessionTimeLabel: string;
  isFullscreen: boolean;
  sidebarCollapsed: boolean;
  onIndexChange: (i: number) => void;
  onToggleFullscreen: () => void;
  onToggleSidebar: () => void;
  onClose: () => void;
  onFinish: () => void;
  onApprove: (taskId: string) => void;
  onRequestFeedback: (decision: Decision) => void;
}

const DECISION_BUTTON_CONFIG = {
  approved: { l: 'Aprovar', c: 'bg-emerald-600 shadow-emerald-500/20', icon: Check },
  needs_adjustment: { l: 'Ajustar', c: 'bg-amber-600 shadow-amber-500/20', icon: AlertTriangle },
  rejected: { l: 'Rejeitar', c: 'bg-rose-600 shadow-rose-500/20', icon: Ban },
} as const;

// Cor do segmento de progresso por decisão já registrada.
const SEGMENT_DECIDED: Record<string, string> = {
  approved: 'bg-emerald-500',
  needs_adjustment: 'bg-amber-500',
  rejected: 'bg-rose-500',
};

const SORT_LABEL = { key: 'chave do Jira', type: 'tipo de issue', dev: 'desenvolvedor', qa: 'QA' } as const;

/**
 * Uma linha, três zonas: navegação à esquerda, progresso no meio (ocupa o que sobra e nunca
 * empurra o resto) e decisões e utilitários à direita. Antes os pontos de progresso ganhavam
 * uma barra de rolagem por baixo e os rótulos Progresso/Ordenação/Tempo ficavam em duas linhas.
 */
export function TeatroHeader({
  session, currentIndex, sortBy, isCover, isLight, canDecide, sessionTimeLabel,
  isFullscreen, sidebarCollapsed, onIndexChange, onToggleFullscreen, onToggleSidebar,
  onClose, onFinish, onApprove, onRequestFeedback,
}: TeatroHeaderProps) {
  const task = !isCover ? session.tasks[currentIndex] : null;
  const total = session.tasks.length;
  const isLast = currentIndex === total - 1;

  const subtleBtn = isLight
    ? 'bg-slate-100 text-slate-600 border-slate-200 hover:bg-slate-200 hover:text-slate-900'
    : 'bg-white/[0.06] text-white/75 border-white/10 hover:bg-white/15 hover:text-white';
  const iconBtn = isLight
    ? 'h-9 w-9 rounded-xl bg-slate-100 text-slate-600 hover:bg-slate-200'
    : 'h-9 w-9 rounded-xl bg-white/[0.06] text-white/80 hover:bg-white/15 hover:text-white';

  return (
    <AnimatePresence>
      {!isCover && (
        <motion.header
          initial={{ y: -100 }}
          animate={{ y: 0 }}
          exit={{ y: -100 }}
          className={cn(
            'h-16 grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-4 xl:gap-6 px-4 xl:px-6 border-b backdrop-blur-xl shrink-0 z-50',
            isLight ? 'bg-white/85 border-slate-200' : 'bg-[#0a0a18]/90 border-white/10'
          )}
        >
          {/* Navegação */}
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              onClick={() => onIndexChange(currentIndex - 1)}
              aria-label="Card anterior"
              title="Card anterior (←)"
              className={cn('h-9 w-9 p-0 rounded-xl border transition-all', subtleBtn)}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              onClick={() => onIndexChange(Math.min(total - 1, currentIndex + 1))}
              disabled={isLast}
              aria-label="Próximo card"
              title="Próximo card (→)"
              className="h-9 px-3 xl:px-4 rounded-xl font-bold text-xs gap-1.5 bg-violet-600 text-white hover:bg-violet-500 disabled:opacity-30 transition-all shadow-md shadow-violet-900/40"
            >
              <span className="hidden lg:inline">Próxima</span> <ChevronRight className="h-4 w-4" />
            </Button>
            <span className={cn('ml-1 text-sm font-black tabular-nums whitespace-nowrap', isLight ? 'text-slate-900' : 'text-white')}>
              {currentIndex + 1}
              <span className={cn('font-bold', isLight ? 'text-slate-400' : 'text-white/40')}> / {total}</span>
            </span>
          </div>

          {/* Progresso: um segmento por card, que encolhe em vez de rolar */}
          <div className="flex items-center gap-4 min-w-0">
            <nav
              aria-label="Progresso da apresentação"
              className="flex-1 min-w-0 flex items-center gap-1"
              title={sortBy ? `Ordem: ${SORT_LABEL[sortBy]}` : undefined}
            >
              {session.tasks.map((t, i) => {
                const isActive = i === currentIndex;
                const decided = t.decision && t.decision !== 'open' ? SEGMENT_DECIDED[t.decision] : null;
                return (
                  <button
                    key={t.id || i}
                    onClick={() => onIndexChange(i)}
                    aria-label={`Ir para o card ${i + 1} de ${total}: ${t.key}`}
                    aria-current={isActive ? 'step' : undefined}
                    title={`${t.key}: ${t.title}${t.preparationStatus === 'done' ? '' : ' (preparação pendente)'}`}
                    className={cn(
                      'h-1.5 flex-1 min-w-[4px] rounded-full transition-all duration-300',
                      isActive
                        ? 'h-2 bg-violet-500 shadow-[0_0_12px_rgba(139,92,246,0.7)]'
                        : decided ?? (isLight ? 'bg-slate-200 hover:bg-slate-400' : 'bg-white/15 hover:bg-white/35')
                    )}
                  />
                );
              })}
            </nav>
            <span className={cn('hidden lg:flex items-center gap-1.5 text-xs font-bold tabular-nums whitespace-nowrap', isLight ? 'text-slate-500' : 'text-white/60')} title="Tempo de sessão">
              <Timer className="h-3.5 w-3.5" /> {sessionTimeLabel}
            </span>
          </div>

          {/* Decisões e utilitários */}
          <div className="flex items-center gap-2">
            {task && (
              <div className="flex items-center gap-1.5" title={canDecide ? undefined : 'Somente PO ou SME pode registrar decisão.'}>
                {!canDecide && (
                  <span className={cn('hidden xl:flex items-center gap-1.5 h-9 px-3 rounded-xl text-[11px] font-bold uppercase tracking-wide', isLight ? 'bg-slate-100 text-slate-400' : 'bg-white/5 text-white/40')}>
                    <Lock className="h-3 w-3" /> Somente PO/SME
                  </span>
                )}
                {(['approved', 'needs_adjustment', 'rejected'] as const).map(d => {
                  const config = DECISION_BUTTON_CONFIG[d];
                  const isSelected = task.decision === d;
                  const Icon = config.icon;
                  return (
                    <motion.button
                      key={d}
                      disabled={!canDecide}
                      whileHover={canDecide ? { y: -1 } : undefined}
                      whileTap={canDecide ? { scale: 0.97 } : undefined}
                      onClick={() => {
                        if (!canDecide) return;
                        if (d === 'approved') onApprove(task.id);
                        else onRequestFeedback(d);
                      }}
                      title={config.l}
                      aria-label={config.l}
                      className={cn(
                        'flex items-center gap-2 h-9 px-3 xl:px-4 rounded-xl font-bold text-xs transition-all border',
                        !canDecide && 'opacity-30 cursor-not-allowed',
                        isSelected ? `${config.c} text-white border-transparent shadow-lg` : subtleBtn
                      )}
                    >
                      <Icon className="h-3.5 w-3.5" />
                      <span className="hidden xl:inline">{config.l}</span>
                    </motion.button>
                  );
                })}
              </div>
            )}

            {isLast && (
              <Button onClick={onFinish} className="h-9 px-4 rounded-xl bg-violet-600 hover:bg-violet-700 text-white font-bold text-xs shadow-lg shadow-violet-600/20">
                Finalizar
              </Button>
            )}

            <div className={cn('h-6 w-px mx-1', isLight ? 'bg-slate-200' : 'bg-white/15')} aria-hidden="true" />

            <Button variant="ghost" size="icon" onClick={onToggleSidebar} title={sidebarCollapsed ? 'Mostrar painel lateral' : 'Recolher painel lateral'} className={iconBtn}>
              {sidebarCollapsed ? <PanelLeftOpen className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
            </Button>
            <Button variant="ghost" size="icon" onClick={onToggleFullscreen} title={isFullscreen ? 'Sair da tela cheia' : 'Tela cheia'} className={iconBtn}>
              {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
            </Button>
            <Button variant="ghost" size="icon" onClick={onClose} title="Sair da apresentação" className="h-9 w-9 rounded-xl bg-rose-500/10 text-rose-500 hover:bg-rose-500 hover:text-white">
              <X className="h-4 w-4" />
            </Button>
          </div>
        </motion.header>
      )}
    </AnimatePresence>
  );
}
