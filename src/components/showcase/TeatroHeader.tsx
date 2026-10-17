'use client';

import { motion, AnimatePresence } from 'framer-motion';
import {
  ChevronLeft, ChevronRight, X, Ban, AlertTriangle, Maximize2, Minimize2, Check, Lock, PanelLeftClose, PanelLeftOpen, Timer, Flag
} from 'lucide-react';
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
  /** Encerrar a apresentação sem finalizar a Review (ela continua "Ao vivo"). */
  onClose: () => void;
  /** Finalizar a Review: pede confirmação na sala e abre o resumo. Disponível em qualquer card. */
  onFinish: () => void;
  onApprove: (taskId: string) => void;
  onRequestFeedback: (decision: Decision) => void;
}

const DECISION_BUTTON_CONFIG = {
  approved: { l: 'Aprovar', c: 'bg-emerald-600 text-white', icon: Check },
  needs_adjustment: { l: 'Ajustar', c: 'bg-amber-600 text-white', icon: AlertTriangle },
  rejected: { l: 'Rejeitar', c: 'bg-red-600 text-white', icon: Ban },
} as const;

// Cor do segmento de progresso por decisão já registrada.
const SEGMENT_DECIDED: Record<string, string> = {
  approved: 'bg-emerald-500',
  needs_adjustment: 'bg-amber-500',
  rejected: 'bg-red-500',
};

const SORT_LABEL = { key: 'chave do Jira', type: 'tipo de issue', dev: 'desenvolvedor', qa: 'QA' } as const;

const FOCUS = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-transparent';

/**
 * Três zonas: navegação à esquerda, progresso no meio (ocupa o que sobra e nunca empurra o resto) e decisões
 * e utilitários à direita. Em tela estreita o progresso desce para uma linha própria.
 */
export function TeatroHeader({
  session, currentIndex, sortBy, isCover, isLight, canDecide, sessionTimeLabel,
  isFullscreen, sidebarCollapsed, onIndexChange, onToggleFullscreen, onToggleSidebar,
  onClose, onFinish, onApprove, onRequestFeedback,
}: TeatroHeaderProps) {
  const task = !isCover ? session.tasks[currentIndex] : null;
  const total = session.tasks.length;
  const isLast = currentIndex === total - 1;

  const subtle = isLight
    ? 'border-slate-200 bg-slate-100 text-slate-700 hover:bg-slate-200 hover:text-slate-900'
    : 'border-white/10 bg-white/[0.06] text-white/80 hover:bg-white/15 hover:text-white';
  const iconBtn = cn('inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border transition-colors max-sm:h-11 max-sm:w-11', subtle, FOCUS);

  return (
    <AnimatePresence>
      {!isCover && (
        <motion.header
          initial={{ y: -100 }}
          animate={{ y: 0 }}
          exit={{ y: -100 }}
          className={cn(
            'z-50 flex shrink-0 flex-wrap items-center gap-x-4 gap-y-2 border-b px-4 py-2 backdrop-blur-xl xl:gap-x-6 xl:px-6 lg:min-h-16 lg:flex-nowrap',
            isLight ? 'border-slate-200 bg-white/85' : 'border-white/10 bg-[#001824]/90'
          )}
        >
          {/* Navegação */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => onIndexChange(currentIndex - 1)}
              aria-label="Card anterior"
              title="Card anterior (←)"
              className={iconBtn}
            >
              <ChevronLeft className="h-4 w-4" strokeWidth={1.5} aria-hidden="true" />
            </button>
            <button
              type="button"
              onClick={() => onIndexChange(Math.min(total - 1, currentIndex + 1))}
              disabled={isLast}
              aria-label="Próximo card"
              title="Próximo card (→)"
              className={cn(
                'inline-flex h-9 items-center gap-1.5 rounded-xl bg-primary px-3 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-30 xl:px-4 max-sm:h-11',
                FOCUS
              )}
            >
              <span className="hidden lg:inline">Próxima</span> <ChevronRight className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />
            </button>
            <span className={cn('ml-1 whitespace-nowrap text-sm font-bold tabular-nums', isLight ? 'text-slate-900' : 'text-white')}>
              {currentIndex + 1}
              <span className={cn('font-medium', isLight ? 'text-slate-500' : 'text-white/50')}> / {total}</span>
            </span>
          </div>

          {/* Progresso: um segmento por card, que encolhe em vez de rolar */}
          <div className="order-last flex min-w-0 basis-full items-center gap-4 lg:order-none lg:basis-auto lg:flex-1">
            <nav
              aria-label="Progresso da apresentação"
              className="flex min-w-0 flex-1 items-center gap-1"
              title={sortBy ? `Ordem: ${SORT_LABEL[sortBy]}` : undefined}
            >
              {session.tasks.map((t, i) => {
                const isActive = i === currentIndex;
                const decided = t.decision && t.decision !== 'open' ? SEGMENT_DECIDED[t.decision] : null;
                return (
                  <button
                    key={t.id || i}
                    type="button"
                    onClick={() => onIndexChange(i)}
                    aria-label={`Ir para o card ${i + 1} de ${total}: ${t.key}`}
                    aria-current={isActive ? 'step' : undefined}
                    title={`${t.key}: ${t.title}${t.preparationStatus === 'done' ? '' : ' (preparação pendente)'}`}
                    className={cn(
                      'h-1.5 min-w-[4px] flex-1 rounded-full transition-all duration-300 max-sm:h-3',
                      isActive
                        ? 'h-2 bg-primary shadow-[0_0_12px_hsl(var(--primary)/0.6)] max-sm:h-3.5'
                        : decided ?? (isLight ? 'bg-slate-300 hover:bg-slate-400' : 'bg-white/20 hover:bg-white/40')
                    )}
                  />
                );
              })}
            </nav>
            <span className={cn('hidden items-center gap-1.5 whitespace-nowrap text-xs font-semibold tabular-nums sm:flex', isLight ? 'text-slate-600' : 'text-white/70')} title="Tempo de sessão">
              <Timer className="h-3.5 w-3.5" strokeWidth={1.5} aria-hidden="true" /> {sessionTimeLabel}
            </span>
          </div>

          {/* Decisões e utilitários */}
          <div className="ml-auto flex flex-wrap items-center justify-end gap-2">
            {task && (
              <div className="flex items-center gap-1.5" title={canDecide ? undefined : 'Somente PO ou SME pode registrar decisão.'}>
                {!canDecide && (
                  <span className={cn('hidden h-9 items-center gap-1.5 rounded-xl px-3 text-xs font-semibold xl:flex', isLight ? 'bg-slate-100 text-slate-500' : 'bg-white/5 text-white/50')}>
                    <Lock className="h-3 w-3" strokeWidth={1.5} aria-hidden="true" /> Somente PO/SME
                  </span>
                )}
                {(['approved', 'needs_adjustment', 'rejected'] as const).map(d => {
                  const config = DECISION_BUTTON_CONFIG[d];
                  const isSelected = task.decision === d;
                  const Icon = config.icon;
                  return (
                    <button
                      key={d}
                      type="button"
                      disabled={!canDecide}
                      aria-pressed={isSelected}
                      onClick={() => {
                        if (!canDecide) return;
                        if (d === 'approved') onApprove(task.id);
                        else onRequestFeedback(d);
                      }}
                      title={config.l}
                      aria-label={config.l}
                      className={cn(
                        'inline-flex h-9 items-center gap-2 rounded-xl border px-3 text-sm font-semibold transition-colors max-sm:h-11 xl:px-4',
                        !canDecide && 'cursor-not-allowed opacity-30',
                        isSelected ? `${config.c} border-transparent shadow-lg` : subtle,
                        FOCUS
                      )}
                    >
                      <Icon className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden="true" />
                      <span className="hidden xl:inline">{config.l}</span>
                    </button>
                  );
                })}
              </div>
            )}

            {/* Finalizar em qualquer card: a sala pede confirmação (e avisa se há cards sem decisão). */}
            <button
              type="button"
              onClick={onFinish}
              title="Finalizar a Review e abrir o resumo"
              className={cn(
                'inline-flex h-9 items-center gap-2 rounded-xl border px-3 text-sm font-semibold transition-colors max-sm:h-11',
                isLast ? 'border-transparent bg-primary text-primary-foreground hover:opacity-90' : subtle,
                FOCUS
              )}
            >
              <Flag className="h-3.5 w-3.5" strokeWidth={1.5} aria-hidden="true" /> Finalizar
            </button>

            <div className={cn('mx-1 hidden h-6 w-px sm:block', isLight ? 'bg-slate-200' : 'bg-white/15')} aria-hidden="true" />

            <button type="button" onClick={onToggleSidebar} title={sidebarCollapsed ? 'Mostrar painel lateral' : 'Recolher painel lateral'} aria-label={sidebarCollapsed ? 'Mostrar painel lateral' : 'Recolher painel lateral'} className={iconBtn}>
              {sidebarCollapsed ? <PanelLeftOpen className="h-4 w-4" strokeWidth={1.5} aria-hidden="true" /> : <PanelLeftClose className="h-4 w-4" strokeWidth={1.5} aria-hidden="true" />}
            </button>
            <button type="button" onClick={onToggleFullscreen} title={isFullscreen ? 'Sair da tela cheia' : 'Tela cheia'} aria-label={isFullscreen ? 'Sair da tela cheia' : 'Tela cheia'} className={iconBtn}>
              {isFullscreen ? <Minimize2 className="h-4 w-4" strokeWidth={1.5} aria-hidden="true" /> : <Maximize2 className="h-4 w-4" strokeWidth={1.5} aria-hidden="true" />}
            </button>
            <button
              type="button"
              onClick={onClose}
              title="Encerrar a apresentação (Esc). A Review continua ao vivo."
              aria-label="Encerrar apresentação"
              className={cn('inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-red-500/10 text-red-600 transition-colors hover:bg-red-600 hover:text-white max-sm:h-11 max-sm:w-11 dark:text-red-400', FOCUS)}
            >
              <X className="h-4 w-4" strokeWidth={1.5} aria-hidden="true" />
            </button>
          </div>
        </motion.header>
      )}
    </AnimatePresence>
  );
}
