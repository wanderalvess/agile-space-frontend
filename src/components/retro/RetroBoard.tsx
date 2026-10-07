'use client';

import React, { useMemo, useState } from 'react';
import { RetroBoard as RetroBoardType, RetroCard as RetroCardType, RetroColumnKey, RetroColumnDef, RetroColumnTheme, RETRO_TEMPLATES, TimerState, RetroParticipant, RetroReactionType } from '@/lib/types';
import { RetroColumn, THEME_CONFIG } from './RetroColumn';

// Referência estável reaproveitada por qualquer coluna vazia — evita criar
// uma array `[]` nova a cada render (o que também invalidaria o memo).
const EMPTY_CARDS: RetroCardType[] = [];
import { RetroControls } from './RetroControls';
import { Button } from '@/components/ui/button';
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, DragEndEvent } from '@dnd-kit/core';
import { sortableKeyboardCoordinates } from '@dnd-kit/sortable';
import { useToast } from '@/hooks/use-toast';
import { Users, ArrowLeft, PanelRightClose, LayoutDashboard, HelpCircle, BrainCircuit, Trophy, Copy, CalendarDays, ShieldCheck, Eye, Unlock, Clock, Download, Settings, BarChart3, CheckCircle2, Lock, MoreHorizontal, Minimize2, MessagesSquare, Flame } from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { RetroParticipantList } from './RetroParticipantList';
import { RetroWelcome } from './RetroWelcome';
import { TeamChat } from '../poker/team-chat/TeamChat';
import type { ChatMessage, ChatMessageKind } from '../poker/team-chat/chatChannels';
import { toChatParticipant } from './retro-chat';
import { cn } from '@/lib/utils';
import { EliteSidebar } from '../shared/EliteSidebar';
import { Card, CardContent } from '@/components/ui/card';
import { ExportRetroDialog } from './ExportRetroDialog';
import { RetroSettingsDialog } from './RetroSettingsDialog';
import { RoomHeader } from '@/components/layout/RoomHeader';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';

interface RetroBoardProps {
  boardId: string;
  boardData: RetroBoardType;
  cards: RetroCardType[];
  participants: RetroParticipant[];
  currentUserId: string;
  timer: TimerState;
  onAddCard: (content: string, column: RetroColumnKey, assignee?: string, dueDate?: string) => void;
  onDeleteCard: (cardId: string) => void;
  onUpdateCard: (cardId: string, content: string, assignee?: string, dueDate?: string) => void;
  onToggleVote: (cardId: string, currentVotes: string[]) => void;
  onToggleReaction: (cardId: string, type: RetroReactionType, currentUserIds: string[]) => void;
  onToggleDone: (cardId: string, isDone: boolean) => void;
  onImportActions: (board: RetroBoardType, pendingCards: RetroCardType[]) => void;
  onToggleCardsRevealed: () => void;
  onSetVotingStatus: (status: 'open' | 'closed') => void;
  onStartTimer: (duration: number) => void;
  onPauseTimer: () => void;
  onResumeTimer: () => void;
  onResetTimer: () => void;
  onSetTimerDuration: (duration: number) => void;
  onLeaveBoard: () => void;
  onRemoveParticipant: (id: string) => void;
  onDragEnd: (event: DragEndEvent) => void;
  isAuthorsRevealed: boolean;
  onToggleShowAuthors: (value: boolean) => void;
  onToggleSyncStage: (value: boolean) => void;
  onToggleAutoRevealOnTimerEnd: (value: boolean) => void;
  onToggleAutoSortOnVoteEnd: (value: boolean) => void;
  onSetMaxVotesPerParticipant: (max: number) => void;
  onToggleHealthCheck: (value: boolean) => void;
  onHealthCheckQuestionChange: (value: string) => void;
  onToggleColumnSort: (columnKey: string, isSorted: boolean) => void;
  currentUser: any;
  currentParticipant: any;
  isCurrentUserCreator: boolean;
  onClaimCreator?: () => void;
  activeStage: RetroColumnKey;
  onStageChange: (stage: RetroColumnKey) => void;
  mergingSourceId: string | null;
  onStartMerge: (cardId: string | null) => void;
  onExecuteMerge: (targetId: string) => void;
  onOpenFeedback: () => void;
  onOpenStats?: () => void;
  chatMessagesByChannel: Record<string, ChatMessage[]>;
  onSendChatMessage: (text: string, kind: ChatMessageKind, channelId: string) => void;
  onDeleteChatMessage: (messageId: string, channelId: string) => void;
}

const RetroBoardComponent = ({
  boardId,
  boardData,
  cards,
  participants,
  currentUserId,
  timer,
  onAddCard,
  onDeleteCard,
  onUpdateCard,
  onToggleVote,
  onToggleReaction,
  onToggleDone,
  onImportActions,
  onToggleCardsRevealed,
  onSetVotingStatus,
  onStartTimer,
  onPauseTimer,
  onResumeTimer,
  onResetTimer,
  onSetTimerDuration,
  onLeaveBoard,
  onRemoveParticipant,
  onDragEnd,
  isAuthorsRevealed,
  onToggleShowAuthors,
  onToggleSyncStage,
  onToggleAutoRevealOnTimerEnd,
  onToggleAutoSortOnVoteEnd,
  onSetMaxVotesPerParticipant,
  onToggleHealthCheck,
  onHealthCheckQuestionChange,
  onToggleColumnSort,
  currentUser,
  currentParticipant,
  isCurrentUserCreator,
  onClaimCreator,
  activeStage,
  onStageChange,
  mergingSourceId,
  onStartMerge,
  onExecuteMerge,
  onOpenFeedback,
  onOpenStats,
  chatMessagesByChannel,
  onSendChatMessage,
  onDeleteChatMessage,
}: RetroBoardProps) => {
  const { toast } = useToast();
  const votesUsed = useMemo(
    () => cards.filter(c => c.votes.includes(currentUserId)).length,
    [cards, currentUserId]
  );
  const [open, setOpen] = useState(false);
  const [isExportOpen, setIsExportOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isGuideOpen, setIsGuideOpen] = useState(false);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [chatUnread, setChatUnread] = useState(0);
  const chatParticipants = useMemo(() => participants.map(toChatParticipant), [participants]);
  const chatUser = useMemo(() => toChatParticipant(currentParticipant), [currentParticipant]);
  const [isFocusMode, setIsFocusMode] = useState(false);
  const [layoutMode, setLayoutMode] = useState<'board' | 'focus'>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('agile_retro_layout_mode');
      if (saved === 'board' || saved === 'focus') return saved;
    }
    return 'board';
  });

  const handleToggleLayoutMode = (mode: 'board' | 'focus') => {
    setLayoutMode(mode);
    if (typeof window !== 'undefined') {
      localStorage.setItem('agile_retro_layout_mode', mode);
    }
  };

  // Use refs to avoid dependency array size changes and unnecessary listener re-registrations
  const activeStageRef = React.useRef(activeStage);
  activeStageRef.current = activeStage;
  const onStageChangeRef = React.useRef(onStageChange);
  onStageChangeRef.current = onStageChange;
  // Navegação sincronizada: quando o facilitador ativa "Sincronizar Coluna",
  // só ele pode trocar de coluna — as setas do teclado dos demais ficam mudas.
  const navLockedRef = React.useRef(false);
  navLockedRef.current = !!(boardData.syncStageEnabled && !isCurrentUserCreator);

  // Derive columns from board data, with backward-compatible fallback
  const columns: RetroColumnDef[] = useMemo(() => {
    if (boardData.columns && boardData.columns.length > 0) {
      return [...boardData.columns].sort((a, b) => a.order - b.order);
    }
    // Fallback for boards created before the flex-retro feature
    return RETRO_TEMPLATES.classic;
  }, [boardData.columns]);

  const columnsRef = React.useRef(columns);
  columnsRef.current = columns;

  // `cards.filter(...)` era chamado direto no .map() de colunas — uma nova
  // array a cada render pra TODA coluna, mesmo pra colunas cujo conteúdo não
  // mudou. Isso invalidava o React.memo do RetroColumn e forçava re-render
  // de todas as colunas a cada edição/voto/drag de UM único card. Aqui
  // recalcula o agrupamento uma vez e reaproveita a MESMA array de uma
  // coluna se o conteúdo dela (por id) não mudou entre renders.
  const cardsByColumnRef = React.useRef<Record<string, RetroCardType[]>>({});
  const cardsByColumn = useMemo(() => {
    const grouped: Record<string, RetroCardType[]> = {};
    for (const card of cards) {
      (grouped[card.columnKey] ||= []).push(card);
    }
    const prev = cardsByColumnRef.current;
    const stable: Record<string, RetroCardType[]> = {};
    for (const key of Object.keys(grouped)) {
      const next = grouped[key];
      const prevArr = prev[key];
      const unchanged = !!prevArr && prevArr.length === next.length && prevArr.every((c, i) => c === next[i]);
      stable[key] = unchanged ? prevArr : next;
    }
    cardsByColumnRef.current = stable;
    return stable;
  }, [cards]);

  // Theme color mapping for dynamic rendering
  const THEME_COLORS: Record<RetroColumnTheme, { bg: string; color: string; border: string }> = {
    success: { bg: 'bg-emerald-50', color: 'text-emerald-700', border: 'border-emerald-200' },
    warning: { bg: 'bg-amber-50', color: 'text-amber-700', border: 'border-amber-200' },
    action: { bg: 'bg-indigo-50', color: 'text-indigo-700', border: 'border-indigo-200' },
    neutral: { bg: 'bg-slate-50', color: 'text-slate-700', border: 'border-slate-200' },
    purple: { bg: 'bg-violet-50', color: 'text-violet-700', border: 'border-violet-200' },
    pink: { bg: 'bg-pink-50', color: 'text-pink-700', border: 'border-pink-200' },
    cyan: { bg: 'bg-cyan-50', color: 'text-cyan-700', border: 'border-cyan-200' },
  };

  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (isFocusMode) {
        // Digitando (chat, notas, qualquer campo): as setas movem o cursor e o Esc fecha o próprio campo.
        const t = e.target as HTMLElement | null;
        if (t && (t.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(t.tagName))) return;
        if (e.key === 'Escape') {
          setIsFocusMode(false);
        } else if ((e.key === 'ArrowRight' || e.key === 'ArrowLeft') && !navLockedRef.current) {
          const keys = columnsRef.current.map(c => c.id);
          if (keys.length === 0) return;
          const currentIndex = keys.indexOf(activeStageRef.current);
          
          if (e.key === 'ArrowRight') {
            const nextIndex = (currentIndex + 1) % keys.length;
            onStageChangeRef.current(keys[nextIndex]);
          } else {
            const prevIndex = (currentIndex - 1 + keys.length) % keys.length;
            onStageChangeRef.current(keys[prevIndex]);
          }
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isFocusMode]);
  
  const [isSoundEnabled, setIsSoundEnabled] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('retro_sound_enabled') !== 'false';
    }
    return true;
  });

  const handleToggleSound = (enabled: boolean) => {
    setIsSoundEnabled(enabled);
    localStorage.setItem('retro_sound_enabled', String(enabled));
  };
  
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );


  const handleCopyLink = () => {
    navigator.clipboard.writeText(window.location.href);
    toast({
      title: "Link Copiado!",
      description: "Você pode compartilhar este link com sua equipe.",
    });
  };

  return (
    <div className="flex flex-row flex-nowrap h-dvh w-full bg-[#fafafa] relative overflow-hidden min-h-0">
        {/* Mesh Gradient Background */}
        <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none -z-10">
          <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-emerald-200/30 dark:bg-emerald-500/20 blur-[120px] animate-pulse" />
          <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] rounded-full bg-teal-100/30 dark:bg-teal-400/20 blur-[120px] animate-pulse" style={{ animationDelay: '2s' }} />
        </div>

        <div className={cn(
          "bg-transparent overflow-hidden flex flex-col h-full relative transition-all duration-500 flex-1 min-w-0"
        )}>
          
          {/* HEADER DE PONTA A PONTA */}
          {!isFocusMode && (
            <RoomHeader 
            title={boardData.title || "Quadro Retrospectivo"} 
            toolIcon={<Flame className="h-4 w-4" />}
            toolColorClass="text-emerald-600 bg-emerald-50"
            onOpenFeedback={onOpenFeedback}
            badge={
              boardData.team && (
                <Badge className="h-4 px-1.5 text-[7px] font-black uppercase bg-emerald-50 text-emerald-600 border-emerald-200 shrink-0">
                  {boardData.team}
                </Badge>
              )
            }
            actions={
              <div className="flex items-center gap-1.5">
                {/* 🎛️ CONTROLES DA RETRO INJETADOS NO CABEÇALHO */}
                <RetroControls
                  isCardsRevealed={boardData.isCardsRevealed}
                  onToggleCardsRevealed={onToggleCardsRevealed}
                  votingStatus={boardData.votingStatus}
                  onSetVotingStatus={onSetVotingStatus as any}
                  timer={timer}
                  onStartTimer={onStartTimer}
                  onPauseTimer={onPauseTimer}
                  onResumeTimer={onResumeTimer}
                  onResetTimer={onResetTimer}
                  onSetTimerDuration={onSetTimerDuration}
                  isFacilitator={boardData.creatorId === currentUserId}
                  onPresent={() => setIsFocusMode(true)}
                  isSoundEnabled={isSoundEnabled}
                  onToggleSound={handleToggleSound}
                  autoRevealOnTimerEnd={boardData.autoRevealOnTimerEnd}
                  layoutMode={layoutMode}
                  onToggleLayoutMode={handleToggleLayoutMode}
                  maxVotesPerParticipant={boardData.maxVotesPerParticipant}
                  onSetMaxVotesPerParticipant={onSetMaxVotesPerParticipant}
                  votesUsed={votesUsed}
                />

                <div className="w-px h-5 bg-slate-200 dark:bg-slate-700 mx-0.5 hidden sm:block" />

                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-xl transition-all data-[state=open]:bg-emerald-50 data-[state=open]:text-emerald-600"
                      title="Mais ações"
                      aria-label="Mais ações"
                    >
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-56 rounded-2xl p-1.5 text-[11px] font-bold">
                    <DropdownMenuItem onClick={() => setIsExportOpen(true)} className="rounded-xl gap-2.5 py-2 cursor-pointer">
                      <Download className="h-4 w-4 text-slate-400" /> Exportar retrospectiva
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={handleCopyLink} className="rounded-xl gap-2.5 py-2 cursor-pointer">
                      <Copy className="h-4 w-4 text-slate-400" /> Copiar link do quadro
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setIsGuideOpen(true)} className="rounded-xl gap-2.5 py-2 cursor-pointer">
                      <HelpCircle className="h-4 w-4 text-slate-400" /> Guia do facilitador
                    </DropdownMenuItem>
                    {onOpenStats && (
                      <DropdownMenuItem onClick={onOpenStats} className="rounded-xl gap-2.5 py-2 cursor-pointer">
                        <BarChart3 className="h-4 w-4 text-slate-400" /> Estatísticas da sprint
                      </DropdownMenuItem>
                    )}
                    {boardData.creatorId === currentUserId && (
                      <>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={() => setIsSettingsOpen(true)} className="rounded-xl gap-2.5 py-2 cursor-pointer">
                          <Settings className="h-4 w-4 text-slate-400" /> Configurações da retro
                        </DropdownMenuItem>
                      </>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>

                <Sheet open={isGuideOpen} onOpenChange={setIsGuideOpen}>
                  <SheetContent className="sm:max-w-xl border-l border-border bg-card text-card-foreground flex flex-col p-0">
                    <SheetHeader className="shrink-0 border-b border-border p-6 pr-12 text-left">
                      <div className="h-10 w-10 rounded-2xl bg-emerald-600 text-white flex items-center justify-center shadow-lg shadow-emerald-600/25 mb-3">
                        <BrainCircuit className="h-5 w-5" />
                      </div>
                      <SheetTitle className="text-2xl font-black tracking-tight text-foreground">Como conduzir a retro</SheetTitle>
                      <SheetDescription className="text-sm text-muted-foreground">Um roteiro curto para o facilitador, do primeiro card ao plano de ação.</SheetDescription>
                    </SheetHeader>

                    <ScrollArea className="flex-1">
                      <div className="p-6 space-y-8">
                        <section className="space-y-3">
                          <h3 className="flex items-center gap-2 text-sm font-bold text-foreground">
                            <LayoutDashboard className="h-4 w-4 text-emerald-500" /> Em 3 etapas
                          </h3>
                          <ol className="space-y-3">
                            {[
                              { n: 1, t: 'Escrever em silêncio', d: 'Deixe os cards escondidos e peça para cada pessoa escrever sem ver o que os outros colocam. Assim ninguém copia a opinião de quem falou primeiro.' },
                              { n: 2, t: 'Revelar, agrupar e votar', d: 'Clique em Revelar cards. Use Fundir para juntar cards repetidos e abra a votação para o time escolher o que mais importa discutir.' },
                              { n: 3, t: 'Definir ações', d: 'Transforme os temas mais votados em ações na última coluna, cada uma com um responsável. Retro sem ação vira só desabafo.' },
                            ].map((step) => (
                              <li key={step.n} className="flex gap-3 rounded-2xl border border-border bg-muted/30 p-4">
                                <span className="h-6 w-6 shrink-0 rounded-full bg-emerald-600/15 text-emerald-500 text-xs font-bold flex items-center justify-center">{step.n}</span>
                                <div className="space-y-1">
                                  <p className="text-sm font-bold text-foreground">{step.t}</p>
                                  <p className="text-sm text-muted-foreground leading-relaxed">{step.d}</p>
                                </div>
                              </li>
                            ))}
                          </ol>
                        </section>

                        <section className="space-y-3">
                          <h3 className="flex items-center gap-2 text-sm font-bold text-foreground">
                            <ShieldCheck className="h-4 w-4 text-emerald-500" /> Ferramentas do facilitador
                          </h3>
                          <div className="grid gap-2.5">
                            {[
                              { icon: Eye, t: 'Revelar cards', d: 'Mostra o conteúdo dos cards para todos. Antes disso, cada pessoa vê só os próprios.' },
                              { icon: Unlock, t: 'Mostrar quem escreveu', d: 'Em Configurações. Desligado, os cards ficam anônimos, o que ajuda quando o time ainda não se sente à vontade.' },
                              { icon: Clock, t: 'Timer', d: 'Dê de 5 a 8 minutos por tema. Conversas sobre o que deu certo costumam se alongar.' },
                            ].map(({ icon: Icon, t, d }) => (
                              <div key={t} className="flex gap-3 items-start rounded-2xl border border-border p-4">
                                <div className="p-2 rounded-xl bg-emerald-600/10 text-emerald-500 shrink-0">
                                  <Icon className="h-4 w-4" />
                                </div>
                                <div className="space-y-0.5">
                                  <p className="text-sm font-bold text-foreground">{t}</p>
                                  <p className="text-sm text-muted-foreground leading-snug">{d}</p>
                                </div>
                              </div>
                            ))}
                          </div>
                        </section>

                        <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/5 p-4">
                          <p className="text-sm font-bold text-foreground mb-1">Antes de encerrar</p>
                          <p className="text-sm text-muted-foreground leading-relaxed">
                            Exporte o resumo pelo menu Mais ações e compartilhe as ações combinadas no canal da squad.
                          </p>
                        </div>
                      </div>
                    </ScrollArea>
                  </SheetContent>
                </Sheet>
                
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => { setIsChatOpen(v => !v); setOpen(false); }}
                  className={cn(
                    "relative h-8 w-8 rounded-xl transition-all",
                    isChatOpen ? "bg-emerald-50 text-emerald-600 ring-1 ring-emerald-200" : "text-slate-400 hover:text-emerald-600 hover:bg-emerald-50"
                  )}
                  title="Chat do time"
                  aria-label="Chat do time"
                >
                  <MessagesSquare className="h-4 w-4" />
                  {chatUnread > 0 && !isChatOpen && (
                    <span className="absolute -top-1 -right-1 min-w-[16px] h-4 px-1 rounded-full bg-rose-500 text-white text-[9px] font-black flex items-center justify-center shadow-sm">
                      {chatUnread > 9 ? '9+' : chatUnread}
                    </span>
                  )}
                </Button>

                <Button
                  variant={open ? "secondary" : "ghost"}
                  onClick={() => { setOpen(!open); setIsChatOpen(false); }}
                  className={cn(
                    "h-8 px-2.5 rounded-xl transition-all gap-1.5",
                    open ? "bg-emerald-50 text-emerald-600 ring-1 ring-emerald-200" : "text-slate-400 hover:text-emerald-600 hover:bg-emerald-50"
                  )}
                  title="Participantes"
                >
                  <Users className="h-4 w-4" />
                  <span className="text-[10px] font-black tabular-nums">{participants.length}</span>
                </Button>
              </div>
            }
          />
        )}

        {/* BARRA DE ABAS: navega entre colunas durante a apresentação (isFocusMode) */}
        {isFocusMode && (
          <div className="fixed top-0 inset-x-0 z-[110] h-14 flex items-center gap-2 px-4 sm:px-6 bg-white/70 dark:!bg-slate-900/70 backdrop-blur-2xl border-b border-white/60 dark:!border-slate-700/50 shadow-sm">
            {/* Abas rolam sozinhas em telas estreitas; controles e Sair ficam sempre visíveis */}
            <div className="flex-1 min-w-0 flex items-center gap-2 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {columns.map((col) => {
              const config = THEME_CONFIG[col.theme] || THEME_CONFIG.neutral;
              const Icon = config.icon;
              const isActive = activeStage === col.id;
              const count = cardsByColumn[col.id]?.length || 0;
              return (
                <Button
                  key={col.id}
                  variant="ghost"
                  onClick={() => onStageChange(col.id)}
                  disabled={boardData.syncStageEnabled && !isCurrentUserCreator}
                  title={`${col.title} (${count})`}
                  aria-label={`${col.title}, ${count} cards`}
                  className={cn(
                    "h-10 px-3.5 sm:px-4 rounded-xl gap-2 shrink-0 font-bold text-xs transition-all border",
                    isActive
                      ? cn("text-white shadow-lg scale-[1.03] border-transparent", config.color)
                      : "bg-white/40 dark:!bg-slate-800/50 text-slate-500 dark:!text-slate-400 border-white/70 dark:!border-slate-600/50 hover:bg-white/70 dark:hover:!bg-slate-800/80"
                  )}
                >
                  <Icon className="h-3.5 w-3.5 shrink-0" />
                  <span className={cn("whitespace-nowrap", !isActive && "hidden xl:inline")}>{col.title}</span>
                  <span className={cn(
                    "h-[18px] min-w-[18px] px-1 rounded-full text-[9px] flex items-center justify-center shrink-0",
                    isActive ? "bg-white/25" : "bg-slate-900/10 dark:!bg-white/10"
                  )}>
                    {count}
                  </span>
                </Button>
              );
            })}
            </div>
            <div className="flex items-center gap-2 shrink-0">
            {boardData.syncStageEnabled && !isCurrentUserCreator && (
              <span title="Navegação controlada pelo facilitador" className="shrink-0 text-slate-400">
                <Lock className="h-4 w-4" />
              </span>
            )}
            {/* Mantém timer, status e controles do facilitador vivos durante a apresentação */}
            <RetroControls
              compact
              isCardsRevealed={boardData.isCardsRevealed}
              onToggleCardsRevealed={onToggleCardsRevealed}
              votingStatus={boardData.votingStatus}
              onSetVotingStatus={onSetVotingStatus as any}
              timer={timer}
              onStartTimer={onStartTimer}
              onPauseTimer={onPauseTimer}
              onResumeTimer={onResumeTimer}
              onResetTimer={onResetTimer}
              onSetTimerDuration={onSetTimerDuration}
              isFacilitator={boardData.creatorId === currentUserId}
              isSoundEnabled={isSoundEnabled}
              onToggleSound={handleToggleSound}
              autoRevealOnTimerEnd={boardData.autoRevealOnTimerEnd}
              maxVotesPerParticipant={boardData.maxVotesPerParticipant}
              onSetMaxVotesPerParticipant={onSetMaxVotesPerParticipant}
              votesUsed={votesUsed}
            />
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsFocusMode(false)}
              className="h-9 px-3.5 shrink-0 rounded-xl text-xs font-bold gap-1.5 border border-border bg-muted/40 text-foreground hover:bg-muted"
              title="Sair da apresentação (Esc)"
            >
              <Minimize2 className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Sair</span>
            </Button>
            </div>
          </div>
        )}

        <div className="flex flex-col w-full h-full p-3 sm:p-4 lg:p-6 overflow-hidden w-full max-w-[2400px] 2xl:max-w-none mx-auto min-h-0">
          <main className="flex-1 flex flex-col min-h-0 overflow-hidden">
            {cards.length === 0 && !isFocusMode && (
              <RetroWelcome isFacilitator={boardData.creatorId === currentUserId} />
            )}
            <div className={cn(
              "flex-1 flex flex-row min-h-0 pb-3 pt-1 transition-all",
              layoutMode === 'board'
                ? "gap-4 xl:gap-5 overflow-x-auto custom-scrollbar"
                : "gap-4 xl:gap-6 overflow-hidden"
            )}>
              <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
              {columns.map((col) => (
                  <RetroColumn
                    key={col.id}
                    columnKey={col.id}
                    title={col.title}
                    theme={col.theme}
                    cards={cardsByColumn[col.id] || EMPTY_CARDS}
                    allCards={cards}
                    boardId={boardId}
                    boardData={boardData}
                    currentUser={currentUser}
                    isCreator={boardData.creatorId === currentUserId}
                    isCardsRevealed={boardData.isCardsRevealed}
                    onAddCard={onAddCard}
                    onDeleteCard={onDeleteCard}
                    onUpdateCard={onUpdateCard}
                    onToggleVote={onToggleVote as any}
                    onToggleReaction={onToggleReaction}
                    onToggleDone={onToggleDone}
                    onImportActions={onImportActions}
                    votingStatus={boardData.votingStatus}
                    participants={participants}
                    isAuthorsRevealed={isAuthorsRevealed}
                    onToggleColumnSort={onToggleColumnSort}
                    mergingSourceId={mergingSourceId}
                    onStartMerge={onStartMerge}
                    onExecuteMerge={onExecuteMerge}
                    isFocused={activeStage === col.id}
                    onFocus={() => onStageChange(col.id)}
                    isFocusMode={isFocusMode}
                    onToggleFocusMode={setIsFocusMode}
                    columns={columns}
                    layoutMode={layoutMode}
                  />
                ))}
              </DndContext>
            </div>
          </main>
        </div>
      </div>

      {/* Mobile Sidebar (Sheet) - Only rendered on mobile to avoid overlay conflicts on desktop */}
      <div className="md:hidden">
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetContent side="right" className="w-[300px] sm:w-[400px] border-l border-border p-0 flex flex-col bg-card text-card-foreground">
            <SheetHeader className="p-6 border-b border-border text-left">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center shadow-lg shadow-emerald-500/20">
                  <Users className="h-5 w-5" />
                </div>
                <div>
                  <SheetTitle className="text-lg font-black tracking-tight">Participantes</SheetTitle>
                  <SheetDescription className="text-sm text-muted-foreground">
                    {participants.length} {participants.length === 1 ? 'pessoa na retro' : 'pessoas na retro'}
                  </SheetDescription>
                </div>
              </div>
            </SheetHeader>
            <div className="flex-1 overflow-hidden">
              <RetroParticipantList
                participants={participants}
                currentUserId={currentUserId}
                isCreator={boardData.creatorId === currentUserId}
                onRemoveParticipant={onRemoveParticipant}
                onClaimCreator={onClaimCreator}
              />
            </div>
            <div className="p-4 border-t border-border">
              <Button 
                onClick={handleCopyLink} 
                className="w-full h-12 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm shadow-lg shadow-emerald-600/25 gap-2"
              >
                <Copy className="h-4 w-4" /> Copiar link de convite
              </Button>
            </div>
          </SheetContent>
        </Sheet>
      </div>

      <EliteSidebar
          isOpen={open}
          onClose={() => setOpen(false)}
          participantsCount={participants.length}
          onCopyLink={handleCopyLink}
          isTheaterMode={isFocusMode}
          title="Squad Ativa"
          badgeContent={participants.length}
        >
          <RetroParticipantList
            participants={participants}
            currentUserId={currentUserId}
            isCreator={boardData.creatorId === currentUserId}
            onRemoveParticipant={onRemoveParticipant}
            onClaimCreator={onClaimCreator}
          />
        </EliteSidebar>
        
        <TeamChat
          roomId={boardId}
          title="Chat da Retro"
          currentUser={chatUser}
          participants={chatParticipants}
          canModerate={isCurrentUserCreator}
          isOpen={isChatOpen}
          onClose={() => setIsChatOpen(false)}
          onUnreadChange={setChatUnread}
          messagesByChannel={chatMessagesByChannel}
          onSendMessage={onSendChatMessage}
          onDeleteMessage={onDeleteChatMessage}
        />

        <ExportRetroDialog
          isOpen={isExportOpen}
          onClose={() => setIsExportOpen(false)}
          boardData={boardData}
          cards={cards}
          participants={participants}
        />

        <RetroSettingsDialog
          isOpen={isSettingsOpen}
          onClose={() => setIsSettingsOpen(false)}
          isAuthorsRevealed={isAuthorsRevealed}
          onToggleAuthorsRevealed={onToggleShowAuthors}
          syncStageEnabled={!!boardData.syncStageEnabled}
          onToggleSyncStage={onToggleSyncStage}
          autoRevealOnTimerEnd={!!boardData.autoRevealOnTimerEnd}
          onToggleAutoRevealOnTimerEnd={onToggleAutoRevealOnTimerEnd}
          autoSortOnVoteEnd={!!boardData.autoSortOnVoteEnd}
          onToggleAutoSortOnVoteEnd={onToggleAutoSortOnVoteEnd}
          healthCheckEnabled={!!boardData.healthCheckEnabled}
          onToggleHealthCheck={onToggleHealthCheck}
          healthCheckQuestion={boardData.healthCheckQuestion || ''}
          onHealthCheckQuestionChange={onHealthCheckQuestionChange}
        />

        {!isFocusMode && (layoutMode === 'focus' || boardData.syncStageEnabled) && (
          <div className="fixed bottom-10 left-1/2 -translate-x-1/2 z-50 flex items-center gap-1 p-1.5 bg-white/80 dark:!bg-slate-900/80 backdrop-blur-3xl border border-white/40 dark:!border-slate-700/50 shadow-[0_32px_80px_-16px_rgba(0,0,0,0.2)] rounded-full ring-1 ring-slate-900/5 dark:ring-white/5 animate-in fade-in slide-in-from-bottom-4 duration-700">
            {columns.map((col, idx) => {
              const themeStyle = THEME_COLORS[col.theme] || THEME_COLORS.neutral;
              const activeIdx = columns.findIndex(c => c.id === activeStage);
              const isDone = activeIdx >= 0 && idx < activeIdx;
              const isActive = activeStage === col.id;
              return (
                <React.Fragment key={col.id}>
                  {idx > 0 && (
                    <div className={cn("w-3 h-px shrink-0", isDone ? "bg-emerald-300" : "bg-slate-200")} />
                  )}
                  <Button
                    variant="ghost"
                    onClick={() => onStageChange(col.id)}
                    disabled={boardData.syncStageEnabled && !isCurrentUserCreator}
                    className={cn(
                      "h-10 px-5 text-[10px] sm:text-xs font-black uppercase tracking-widest rounded-full transition-all border gap-1.5",
                      isActive
                        ? `${themeStyle.bg} ${themeStyle.color} ${themeStyle.border} shadow-lg scale-105`
                        : isDone
                          ? "text-emerald-600 border-transparent hover:bg-emerald-50/50"
                          : "text-slate-400 border-transparent hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100/50 dark:hover:bg-slate-800/50"
                    )}
                  >
                    {isDone && <CheckCircle2 className="h-3 w-3 shrink-0" />}
                    {col.title}
                  </Button>
                </React.Fragment>
              );
            })}
          </div>
        )}
      </div>
  );
};

export const RetroBoard = React.memo(RetroBoardComponent);
