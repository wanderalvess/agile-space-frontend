'use client';

import React, { useState } from 'react';
import { 
  Plus, 
  ArrowRight, 
  Clock, 
  Trash2, 
  ChevronRight,
  Sparkles,
  Search,
  History,
  Target,
  Zap,
  CalendarDays,
  Users as UsersIcon
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { useToolHistory, RoomMeta } from '@/hooks/useToolHistory';
import { cn } from '@/lib/utils';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { motion, AnimatePresence, type Variants } from 'framer-motion';
import { RoomHeader } from '@/components/layout/RoomHeader';
import { FeedbackWidget } from '@/components/feedback-widget';

interface Tip {
  title: string;
  description: string;
  icon: React.ReactNode;
}

export interface ReferenceSection {
  title: string;
  description: string;
  icon: React.ReactNode;
  label?: string;
  /** Quando presente, o card vira um atalho clicável. Sem isso, segue informativo. */
  onClick?: () => void;
}

interface ToolHubLayoutProps {
  title: string;
  description: string;
  icon: React.ReactNode;
  themeColor: string;
  toolType?: RoomMeta['type'];
  tips: Tip[];
  referenceSections?: ReferenceSection[];
  onNewSession?: () => void;
  onSecondaryAction?: () => void;
  onJoinSession?: (id: string) => void;
  primaryActionLabel?: string;
  secondaryActionLabel?: string;
  hideHistory?: boolean;
  hideJoinAction?: boolean;
  isCreating?: boolean;
  maxWidthClass?: string;
  children?: React.ReactNode;
  onlyChildren?: boolean;
  actions?: React.ReactNode;
  badge?: React.ReactNode;
}

export function ToolHubLayout({
  title,
  description,
  icon,
  themeColor,
  toolType,
  tips,
  referenceSections = [],
  onNewSession,
  onSecondaryAction,
  onJoinSession,
  primaryActionLabel = "Nova Sessão",
  secondaryActionLabel,
  hideHistory = false,
  hideJoinAction = false,
  isCreating = false,
  maxWidthClass = "max-w-none w-full",
  children,
  onlyChildren = false,
  actions,
  badge
}: ToolHubLayoutProps) {
  const [joinId, setJoinId] = useState('');
  const [feedbackSignal, setFeedbackSignal] = useState<number | undefined>();
  const { history, loading, removeRoom } = useToolHistory(toolType || 'poker');

  const handleJoinClick = () => {
    if (joinId.trim() && onJoinSession) {
      onJoinSession(joinId.trim().toUpperCase());
    }
  };

  const getThemeClasses = (color: string) => {
    const maps: Record<string, string> = {
      amber: "bg-amber-500 hover:bg-amber-600 shadow-amber-500/20 text-white",
      emerald: "bg-emerald-600 hover:bg-emerald-700 shadow-emerald-600/20 text-white",
      rose: "bg-rose-500 hover:bg-rose-600 shadow-rose-500/20 text-white",
      violet: "bg-violet-600 hover:bg-violet-700 shadow-violet-600/20 text-white",
      blue: "bg-blue-600 hover:bg-blue-700 shadow-blue-600/20 text-white",
      indigo: "bg-indigo-600 hover:bg-indigo-700 shadow-indigo-600/20 text-white",
      fuchsia: "bg-fuchsia-600 hover:bg-fuchsia-700 shadow-fuchsia-600/20 text-white",
    };
    return maps[color] || maps.blue;
  };

  const getGlowClasses = (color: string) => {
    const maps: Record<string, string> = {
      amber: "bg-amber-500/10",
      emerald: "bg-emerald-500/10",
      rose: "bg-rose-500/10",
      violet: "bg-violet-500/10",
      blue: "bg-blue-500/10",
      indigo: "bg-indigo-500/10",
      fuchsia: "bg-fuchsia-500/10",
    };
    return maps[color] || maps.blue;
  };

  const getIconColor = (color: string) => {
    const maps: Record<string, string> = {
      amber: "text-amber-500 dark:text-amber-400",
      emerald: "text-emerald-600 dark:text-emerald-400",
      rose: "text-rose-500 dark:text-rose-400",
      violet: "text-violet-600 dark:text-violet-400",
      blue: "text-blue-600 dark:text-blue-400",
      indigo: "text-indigo-600 dark:text-indigo-400",
      fuchsia: "text-fuchsia-600 dark:text-fuchsia-400",
    };
    return maps[color] || maps.blue;
  };

  // Framer Motion staggered animations
  const containerVariants: Variants = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: {
        staggerChildren: 0.08,
      },
    },
  };

  const itemVariants: Variants = {
    hidden: { y: 20, opacity: 0 },
    show: { y: 0, opacity: 1, transition: { type: 'spring', stiffness: 100, damping: 15 } },
  };

  return (
    <div className={cn(
      "flex-1 w-full bg-[#fafafa] dark:bg-slate-950 font-sans selection:bg-slate-200 dark:selection:bg-slate-700 relative flex flex-col",
      onlyChildren ? "h-dvh overflow-hidden" : "min-h-dvh overflow-y-auto custom-scrollbar"
    )}>
      {/* PADRONIZAÇÃO DA BARRA SUPERIOR */}
      <RoomHeader
        title={title}
        toolIcon={React.isValidElement(icon) ? React.cloneElement(icon as React.ReactElement<{ className?: string }>, { className: "h-4 w-4" }) : icon}
        toolColorClass={getIconColor(themeColor)}
        onOpenFeedback={() => setFeedbackSignal(Date.now())}
        actions={actions}
        badge={badge}
      />

      {/* ELITE MESH GRADIENT BACKGROUND */}
      <div className="fixed top-0 left-0 w-full h-full -z-10 pointer-events-none overflow-hidden" aria-hidden="true">
        <div className={cn("absolute top-[-10%] left-[-10%] w-[70%] h-[70%] rounded-full blur-[160px] animate-pulse", getGlowClasses(themeColor).replace('/10', '/5'))} />
        <div className="absolute bottom-[-10%] right-[-10%] w-[60%] h-[60%] bg-slate-200/5 dark:bg-slate-800/10 rounded-full blur-[140px] animate-pulse" style={{ animationDelay: '2s' }} />
      </div>

      <div className={cn(
        "relative z-10 flex flex-col w-full flex-1 min-h-0",
        onlyChildren ? "p-0" : "pt-6 px-4 pb-8 md:px-8 lg:px-10"
      )}>
        <main className={cn("flex-1 w-full mx-auto flex flex-col min-h-0", maxWidthClass)}>
          {onlyChildren ? (
            <div className="w-full flex-1 flex flex-col min-h-0">
              {children}
            </div>
          ) : (
            <motion.div
              variants={containerVariants}
              initial="hidden"
              animate="show"
              className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-12 gap-6 items-stretch w-full text-left"
            >
              {/* CARD 1: WELCOME & INTEGRATED ACTIONS */}
              <motion.div variants={itemVariants} className="lg:col-span-8 col-span-1 flex">
                <Card className="group relative border border-slate-200 dark:border-slate-800 bg-white/70 dark:bg-slate-900/70 backdrop-blur-xl rounded-[2.5rem] p-8 shadow-xl flex flex-col justify-between w-full overflow-hidden min-h-[300px]">
                  <div className={cn("absolute top-[-20%] left-[-10%] w-64 h-64 rounded-full blur-3xl pointer-events-none", getGlowClasses(themeColor).replace('/10', '/15'))} />
                  
                  <div className="space-y-4 relative z-10">
                    <div className="flex items-center gap-2.5">
                      <div className={cn("w-9 h-9 rounded-xl flex items-center justify-center text-white shadow-md", getThemeClasses(themeColor).split(' ')[0])}>
                        {React.isValidElement(icon) ? React.cloneElement(icon as React.ReactElement<{ className?: string }>, { className: "h-4.5 w-4.5 text-white" }) : icon}
                      </div>
                      <span className={cn("text-[10px] font-black uppercase tracking-[0.25em] leading-none px-2.5 py-1 rounded-md border", getIconColor(themeColor).replace('text-', 'border-').replace('dark:text-', 'dark:border-'), getGlowClasses(themeColor))}>
                        {title}
                      </span>
                    </div>
                    
                    <div className="space-y-2">
                      <h2 className="text-4xl md:text-5xl font-black uppercase tracking-tight italic text-slate-900 dark:text-slate-50 leading-none">
                        {title.split(' ')[0]} <span className={cn("not-italic font-black", getIconColor(themeColor))}>{title.split(' ').slice(1).join(' ')}</span>
                      </h2>
                      <p className="text-sm font-medium text-slate-500 dark:text-slate-400 leading-relaxed max-w-2xl">
                        {description}
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-col sm:flex-row gap-4 items-stretch sm:items-center mt-6 pt-5 border-t border-slate-100 dark:border-slate-855/60 relative z-10">
                    {onNewSession && (
                      <Button
                        size="lg"
                        onClick={onNewSession}
                        disabled={isCreating}
                        className={cn("h-14 px-8 text-white font-black uppercase text-[10px] tracking-[0.2em] rounded-2xl shadow-xl gap-2 transition-all active:scale-95 shrink-0 border-none", getThemeClasses(themeColor))}
                      >
                        <Plus className="h-4 w-4" />
                        {primaryActionLabel}
                      </Button>
                    )}
                    
                    {onSecondaryAction && secondaryActionLabel && (
                      <Button 
                        size="lg"
                        variant="outline"
                        className="h-14 px-8 rounded-2xl border-2 border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-black uppercase text-[10px] tracking-[0.2em] hover:bg-slate-50 dark:hover:bg-slate-700 hover:text-slate-900 dark:hover:text-slate-100 hover:border-slate-300 dark:hover:border-slate-600 transition-all active:scale-95 shrink-0"
                        onClick={onSecondaryAction}
                      >
                        {secondaryActionLabel}
                      </Button>
                    )}

                    {onJoinSession && !hideJoinAction && (
                      <div className="relative group flex-1">
                        <Input
                          value={joinId}
                          onChange={(e) => setJoinId(e.target.value.toUpperCase())}
                          onKeyDown={(e) => e.key === 'Enter' && handleJoinClick()}
                          placeholder="ENTRAR COM ID DA SALA"
                          className="h-14 pl-6 pr-14 bg-slate-50 dark:bg-slate-950 border-2 border-slate-200 dark:border-slate-800/80 placeholder:text-slate-400 dark:placeholder:text-slate-600 font-bold text-xs text-slate-900 dark:text-slate-100 rounded-2xl focus-visible:ring-offset-0 focus-visible:ring-violet-500/20 focus-visible:border-violet-500 transition-all uppercase tracking-wider"
                        />
                        <button
                          onClick={handleJoinClick}
                          disabled={!joinId.trim()}
                          className={cn("absolute right-2.5 top-2.5 w-9 h-9 rounded-xl flex items-center justify-center text-white transition-all hover:scale-105 active:scale-95", getThemeClasses(themeColor).split(' ')[0])}
                        >
                          <ArrowRight className="h-4 w-4" />
                        </button>
                      </div>
                    )}
                  </div>
                </Card>
              </motion.div>

              {/* CARD 2: RECENT LOCAL SESSIONS */}
              <motion.div variants={itemVariants} className="lg:col-span-4 col-span-1 flex">
                <Card className="group relative border border-slate-200 dark:border-slate-800 bg-white/70 dark:bg-slate-900/70 backdrop-blur-xl rounded-[2.5rem] p-7 shadow-lg flex flex-col justify-between w-full overflow-hidden min-h-[300px]">
                  <div className="absolute top-0 right-0 w-32 h-32 bg-slate-500/5 dark:bg-slate-500/10 rounded-full blur-2xl pointer-events-none" />
                  
                  <div className="space-y-4 w-full flex-1 flex flex-col justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 bg-slate-100 dark:bg-slate-800 rounded-lg flex items-center justify-center border border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400">
                        <History className="h-4 w-4" />
                      </div>
                      <h3 className="text-[14px] font-black uppercase tracking-wider text-slate-950 dark:text-slate-50">Sessões Recentes</h3>
                    </div>

                    <div className="space-y-2.5 max-h-[160px] overflow-y-auto pr-1 flex-1 custom-scrollbar mt-3">
                      {loading ? (
                        <div className="space-y-2 py-2 animate-pulse">
                          <div className="h-12 bg-slate-100 dark:bg-slate-800 rounded-xl" />
                          <div className="h-12 bg-slate-100 dark:bg-slate-800 rounded-xl" />
                        </div>
                      ) : history.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-full text-center py-8">
                          <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">Ainda não há registros</p>
                        </div>
                      ) : (
                        history.slice(0, 3).map((room) => (
                          <div
                            key={room.roomId}
                            onClick={() => onJoinSession?.(room.roomId)}
                            className="group/item flex items-center justify-between p-3 rounded-xl border border-slate-100 dark:border-slate-850/60 bg-white/40 dark:bg-slate-950/40 hover:bg-white dark:hover:bg-slate-900 hover:border-slate-200 dark:hover:border-slate-800 hover:shadow-sm transition-all duration-200 cursor-pointer"
                          >
                            <div className="space-y-0.5 truncate flex-1 min-w-0 pr-2">
                              <h5 className="text-[12px] font-bold text-slate-800 dark:text-slate-200 group-item-hover:text-slate-950 dark:group-item-hover:text-white truncate">
                                {room.title}
                              </h5>
                              <p className="text-[9px] text-slate-400 truncate uppercase tracking-wider">
                                {room.team || 'Squad Geral'}
                              </p>
                            </div>
                            <ChevronRight className="h-4 w-4 text-slate-300 group-item-hover:text-slate-600 dark:group-item-hover:text-slate-400 group-item-hover:translate-x-0.5 transition-all shrink-0" />
                          </div>
                        ))
                      )}
                    </div>
                  </div>

                  <div className="text-[9px] font-black uppercase tracking-widest text-slate-400 mt-2 text-center border-t border-slate-100 dark:border-slate-800/80 pt-2 shrink-0">
                    Histórico Local
                  </div>
                </Card>
              </motion.div>

              {/* CARD 3: REFERENCE SECTIONS / MANUAL */}
              {referenceSections.length > 0 && (
                <motion.div variants={itemVariants} className="lg:col-span-8 col-span-1 flex">
                  <Card className="border border-slate-200 dark:border-slate-800 bg-white/70 dark:bg-slate-900/70 backdrop-blur-xl rounded-[2.5rem] p-7 shadow-lg flex flex-col justify-between w-full overflow-hidden min-h-[300px]">
                    <div className="space-y-4 w-full">
                      <div className="flex items-center gap-2">
                        <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center border text-slate-500", getGlowClasses(themeColor), getIconColor(themeColor).replace('text-', 'border-').replace('dark:text-', 'dark:border-'))}>
                          <Search className="h-4.5 w-4.5" />
                        </div>
                        <h3 className="text-[14px] font-black uppercase tracking-wider text-slate-950 dark:text-slate-50">Manual de Operação</h3>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-2">
                        {referenceSections.slice(0, 4).map((section, idx) => (
                          <div
                            key={idx}
                            onClick={section.onClick}
                            role={section.onClick ? 'button' : undefined}
                            tabIndex={section.onClick ? 0 : undefined}
                            onKeyDown={section.onClick ? (e) => {
                              if (e.key === 'Enter' || e.key === ' ') {
                                e.preventDefault();
                                section.onClick?.();
                              }
                            } : undefined}
                            className={cn(
                              "flex gap-3 items-start p-3 rounded-2xl bg-slate-50/50 dark:bg-slate-950/40 border border-slate-100 dark:border-slate-850/60",
                              section.onClick && "cursor-pointer transition-colors hover:border-slate-300 dark:hover:border-slate-700"
                            )}>
                            <div className={cn("w-9 h-9 rounded-xl flex items-center justify-center shrink-0 shadow-inner", getGlowClasses(themeColor))}>
                              {React.isValidElement(section.icon) ? React.cloneElement(section.icon as React.ReactElement<{ className?: string }>, { className: cn("h-4 w-4", getIconColor(themeColor)) }) : section.icon}
                            </div>
                            <div className="space-y-1">
                              <h4 className="text-xs font-black uppercase tracking-tight text-slate-800 dark:text-slate-200">{section.title}</h4>
                              <p className="text-[10px] text-slate-500 dark:text-slate-400 leading-normal line-clamp-2">{section.description}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </Card>
                </motion.div>
              )}

              {/* CARD 4: MANIFESTO / TIPS */}
              <motion.div variants={itemVariants} className="lg:col-span-4 col-span-1 flex">
                <Card className="border border-slate-200 dark:border-slate-800 bg-white/70 dark:bg-slate-900/70 backdrop-blur-xl rounded-[2.5rem] p-7 shadow-lg flex flex-col justify-between w-full overflow-hidden min-h-[300px]">
                  <div className="space-y-4 w-full flex-1 flex flex-col justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 bg-amber-500/10 rounded-lg flex items-center justify-center border border-amber-500/20 text-amber-500">
                        <Sparkles className="h-4 w-4" />
                      </div>
                      <h3 className="text-[14px] font-black uppercase tracking-wider text-slate-950 dark:text-slate-50">Manifesto Ágil</h3>
                    </div>

                    <div className="space-y-3 mt-3 flex-1">
                      {tips.slice(0, 3).map((tip, idx) => (
                        <div key={idx} className="flex gap-2.5 items-start">
                          <div className="w-6 h-6 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 flex items-center justify-center shrink-0">
                            {React.isValidElement(tip.icon) ? React.cloneElement(tip.icon as React.ReactElement<{ className?: string }>, { className: "h-3.5 w-3.5 text-amber-500" }) : tip.icon}
                          </div>
                          <div className="space-y-0.5">
                            <h4 className="text-[11px] font-black uppercase text-slate-800 dark:text-slate-200 tracking-tight">{tip.title}</h4>
                            <p className="text-[9px] text-slate-500 dark:text-slate-400 leading-snug line-clamp-2">{tip.description}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </Card>
              </motion.div>

              {/* CARD 5: CUSTOM CHILDREN / WIDGETS */}
              {children && (
                <motion.div variants={itemVariants} className="lg:col-span-12 col-span-1 w-full mt-4">
                  {children}
                </motion.div>
              )}
            </motion.div>
          )}
        </main>
      </div>

      {/* COMPACT FEEDBACK WIDGET */}
      <FeedbackWidget 
        toolName={`Espaço Ágil - ${title}`} 
        externalTriggerSignal={feedbackSignal} 
        triggerVariant="none" 
      />

      {!onlyChildren && (
        <footer className="py-8 text-center border-t border-slate-200/50 dark:border-slate-900 bg-white dark:bg-slate-950 mt-auto shrink-0 relative z-10">
           <p className="text-[10px] font-black uppercase tracking-[0.5em] text-slate-300 dark:text-slate-700 ml-[0.5em]">Espaço Ágil Control Hub</p>
        </footer>
      )}
    </div>
  );
}
