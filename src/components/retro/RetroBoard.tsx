'use client';

import React, { useMemo, useState } from 'react';
import { RetroBoard as RetroBoardType, RetroCard as RetroCardType, RetroColumnKey, RetroColumnDef, RetroColumnTheme, RETRO_TEMPLATES, TimerState, RetroParticipant } from '@/lib/types';
import { RetroColumn } from './RetroColumn';

// Referência estável reaproveitada por qualquer coluna vazia — evita criar
// uma array `[]` nova a cada render (o que também invalidaria o memo).
const EMPTY_CARDS: RetroCardType[] = [];
import { RetroControls } from './RetroControls';
import { Button } from '@/components/ui/button';
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, DragEndEvent } from '@dnd-kit/core';
import { sortableKeyboardCoordinates } from '@dnd-kit/sortable';
import { useToast } from '@/hooks/use-toast';
import { 
  Users, 
  ArrowLeft, 
  PanelRightClose, 
  LayoutDashboard, 
  HelpCircle, 
  BrainCircuit, 
  Trophy,
  Copy,
  CalendarDays,
  ShieldCheck,
  Eye,
  Unlock,
  Clock,
  Download,
  Settings
} from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { RetroParticipantList } from './RetroParticipantList';
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
}: RetroBoardProps) => {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [isExportOpen, setIsExportOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isFocusMode, setIsFocusMode] = useState(false);

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
        if (e.key === 'Escape') {
          setIsFocusMode(false);
        } else if ((e.key === 'ArrowRight' || e.key === 'ArrowLeft') && !navLockedRef.current) {
          const keys = columnsRef.current.map(c => c.id);
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
    <div className="flex flex-row flex-nowrap h-dvh w-full bg-[#fafafa] relative overflow-hidden font-sans min-h-0">
        {/* Mesh Gradient Background */}
        <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none -z-10">
          <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-emerald-200/30 blur-[120px] animate-pulse" />
          <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] rounded-full bg-teal-100/30 blur-[120px] animate-pulse" style={{ animationDelay: '2s' }} />
        </div>

        <div className={cn(
          "bg-transparent overflow-hidden flex flex-col h-full relative transition-all duration-500 flex-1 min-w-0"
        )}>
          
          {/* HEADER DE PONTA A PONTA */}
          {!isFocusMode && (
            <RoomHeader 
            title={boardData.title || "Quadro Retrospectivo"} 
            toolIcon={<LayoutDashboard className="h-4 w-4" />}
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
              <div className="flex items-center gap-1.5 font-sans">
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
                  onExport={() => setIsExportOpen(true)}
                  activeStage={activeStage}
                  onStageChange={onStageChange}
                  isSoundEnabled={isSoundEnabled}
                  onToggleSound={handleToggleSound}
                  autoRevealOnTimerEnd={boardData.autoRevealOnTimerEnd}
                />

                {boardData.creatorId === currentUserId && (
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setIsSettingsOpen(true)}
                    className="h-8 w-8 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-all"
                    title="Configurações da Retrospectiva"
                  >
                    <Settings className="h-4 w-4" />
                  </Button>
                )}

                <div className="w-px h-5 bg-slate-200 mx-1 hidden sm:block" />

                <Button
                  variant="ghost"
                  size="icon"
                  onClick={handleCopyLink}
                  className="h-8 w-8 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-xl transition-all"
                  title="Copiar Link"
                >
                  <Copy className="h-4 w-4" />
                </Button>

                <Sheet>
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <SheetTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-xl transition-all">
                            <HelpCircle className="h-4 w-4" />
                          </Button>
                        </SheetTrigger>
                      </TooltipTrigger>
                      <TooltipContent side="bottom" className="bg-slate-900 text-white rounded-xl text-[10px] font-black uppercase tracking-widest border-none">
                        <p>Guia de Retrospectiva</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>

                  <SheetContent className="sm:max-w-xl border-l-2 border-l-emerald-200 bg-white/95 backdrop-blur-xl flex flex-col p-0">
                    <SheetHeader className="shrink-0 border-b p-8 bg-emerald-50/30">
                      <div className="h-12 w-12 rounded-2xl bg-emerald-600 text-white flex items-center justify-center shadow-xl shadow-emerald-500/20 mb-4">
                        <BrainCircuit className="h-6 w-6" />
                      </div>
                      <SheetTitle className="text-2xl font-black uppercase tracking-tighter italic">Guia do Facilitador</SheetTitle>
                      <SheetDescription className="font-bold text-[10px] uppercase tracking-widest text-emerald-600/60">Manual Avançado de Facilitação</SheetDescription>
                    </SheetHeader>

                    <ScrollArea className="flex-1">
                      <div className="p-8 space-y-12">
                        {/* SEÇÃO 01: O FLUXO ÁGIL */}
                        <section className="space-y-6">
                          <header className="flex items-center gap-2 pb-2 border-b border-slate-100">
                            <LayoutDashboard className="h-4 w-4 text-emerald-600" />
                            <h3 className="font-black text-[11px] uppercase tracking-widest text-slate-800">01. O Ciclo de Debate</h3>
                          </header>
                          
                          <div className="space-y-4">
                            <div className="p-5 bg-slate-50 rounded-3xl border border-slate-100 space-y-2">
                              <p className="text-[11px] font-black text-emerald-600 uppercase">Fase I: Divergência Silenciosa</p>
                              <p className="text-[11px] text-slate-600 leading-relaxed font-medium">
                                No início, mantenha os <strong>Cards Ocultos</strong>. Isso garante um ambiente seguro (Safety) onde cada um expressa seus sentimentos reais sem sofrer influência ou viés de grupo (Groupthink).
                              </p>
                            </div>

                            <div className="p-5 bg-slate-50 rounded-3xl border border-slate-100 space-y-2">
                              <p className="text-[11px] font-black text-amber-600 uppercase">Fase II: Fusão e Priorização</p>
                              <p className="text-[11px] text-slate-600 leading-relaxed font-medium">
                                Revele os cards e use <strong>Fundir</strong> para combinar temas duplicados em um só card. Use a <strong>Votação</strong> para identificar quais temas o time considera mais críticos para discussão.
                              </p>
                            </div>

                            <div className="p-5 bg-slate-50 rounded-3xl border border-slate-100 space-y-2">
                              <p className="text-[11px] font-black text-indigo-600 uppercase">Fase III: Plano de Ação</p>
                              <p className="text-[11px] text-slate-600 leading-relaxed font-medium">
                                Uma retrospectiva que não gera mudanças é apenas uma reunião de desabafo. Utilize a coluna <strong>Ações</strong> para registrar comprometimentos práticos com responsáveis definidos.
                              </p>
                            </div>
                          </div>
                        </section>

                        {/* SEÇÃO 02: ARSENAL DO FACILITADOR */}
                        <section className="space-y-6">
                          <header className="flex items-center gap-2 pb-2 border-b border-slate-100">
                            <ShieldCheck className="h-4 w-4 text-amber-600" />
                            <h3 className="font-black text-[11px] uppercase tracking-widest text-slate-800">02. Arsenal do Facilitador</h3>
                          </header>

                          <div className="grid gap-3">
                            <div className="flex gap-4 items-start p-4 bg-white rounded-2xl border border-slate-100 shadow-sm">
                              <div className="p-2 bg-indigo-50 rounded-xl text-indigo-600">
                                <Eye className="h-4 w-4" />
                              </div>
                              <div className="space-y-1">
                                <p className="text-[10px] font-black uppercase text-slate-700">Visibilidade</p>
                                <p className="text-[10px] text-slate-500 font-medium leading-tight">Alterna entre exibir o conteúdo dos cards para todos ou mantê-los privados para o autor.</p>
                              </div>
                            </div>

                            <div className="flex gap-4 items-start p-4 bg-white rounded-2xl border border-slate-100 shadow-sm">
                              <div className="p-2 bg-amber-50 rounded-xl text-amber-600">
                                <Unlock className="h-4 w-4" />
                              </div>
                              <div className="space-y-1">
                                <p className="text-[10px] font-black uppercase text-slate-700">Identidade</p>
                                <p className="text-[10px] text-slate-500 font-medium leading-tight">Controla se nomes e avatares são exibidos. Recomendado para sessões onde a segurança psicológica ainda está sendo construída.</p>
                              </div>
                            </div>

                            <div className="flex gap-4 items-start p-4 bg-white rounded-2xl border border-slate-100 shadow-sm">
                              <div className="p-2 bg-emerald-50 rounded-xl text-emerald-600">
                                <Clock className="h-4 w-4" />
                              </div>
                              <div className="space-y-1">
                                <p className="text-[10px] font-black uppercase text-slate-700">Timer & Timebox</p>
                                <p className="text-[10px] text-slate-500 font-medium leading-tight">Discussões sobre o "BOM" tendem a se estender. Use janelas de 5 a 8 minutos por tema para manter a energia da sessão alta.</p>
                              </div>
                            </div>
                          </div>
                        </section>

                        {/* PRO TIPS SECTION */}
                        <div className="p-8 bg-zinc-900 rounded-[2.5rem] text-white space-y-4 relative overflow-hidden">
                          <Trophy className="absolute -bottom-4 -right-4 h-24 w-24 text-white/5 rotate-12" />
                          <div className="space-y-2">
                            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-emerald-200 mt-1">Status do Grupo</p>
                            <p className="text-sm font-bold leading-relaxed italic">
                              "Toda retrospectiva bem-sucedida deve terminar com a exportação do resumo e o compartilhamento dos Planos de Ação no canal de comunicação oficial da squad."
                            </p>
                          </div>
                          <div className="flex gap-2">
                             <div className="px-3 py-1 bg-white/10 rounded-full text-[8px] font-black uppercase border border-white/10">Agile Excellence</div>
                             <div className="px-3 py-1 bg-white/10 rounded-full text-[8px] font-black uppercase border border-white/10">Modo Facilitação</div>
                          </div>
                        </div>

                        {/* RODAPÉ DO GUIA */}
                        <div className="pt-8 text-center pb-8 opacity-50">
                           <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 flex items-center justify-center gap-2">
                              <Download className="h-3 w-3" /> Espaço Ágil v2.0
                           </p>
                        </div>

                      </div>
                    </ScrollArea>
                  </SheetContent>
                </Sheet>
                
                <div className="w-px h-5 bg-slate-200 mx-1 hidden sm:block" />

                <Button
                  variant={open ? "secondary" : "ghost"}
                  size="icon"
                  onClick={() => setOpen(!open)}
                  className={cn(
                    "h-8 w-8 rounded-xl transition-all",
                    open ? "bg-emerald-50 text-emerald-600 ring-1 ring-emerald-200" : "text-slate-400 hover:text-emerald-600 hover:bg-emerald-50"
                  )}
                  title="Participantes"
                >
                  <Users className="h-4 w-4" />
                </Button>
              </div>
            }
          />
        )}

        <div className="flex flex-col w-full h-full p-4 sm:p-6 overflow-hidden max-w-[1600px] mx-auto min-h-0">
          <main className="flex-1 flex flex-col min-h-0 overflow-hidden">
            <div className="flex-1 flex flex-row gap-6 min-h-0 overflow-hidden pb-4 pt-2">
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
          <SheetContent side="right" className="w-[300px] sm:w-[400px] border-l-2 border-emerald-200 p-0 flex flex-col bg-white/95 backdrop-blur-xl">
            <SheetHeader className="p-6 border-b bg-emerald-50/30">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center shadow-lg shadow-emerald-500/20">
                  <Users className="h-5 w-5" />
                </div>
                <div>
                  <SheetTitle className="text-lg font-black uppercase tracking-tighter italic">Squad Ativa</SheetTitle>
                  <SheetDescription className="text-[9px] font-bold uppercase tracking-widest text-emerald-600/60">
                    {participants.length} integrantes online
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
            <div className="p-4 border-t bg-white">
              <Button 
                onClick={handleCopyLink} 
                className="w-full h-12 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-black uppercase text-[10px] tracking-widest shadow-xl shadow-emerald-600/20 gap-2"
              >
                <Copy className="h-4 w-4" /> Convidar Time
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
        
        <ExportRetroDialog
          isOpen={isExportOpen}
          onClose={() => setIsExportOpen(false)}
          boardData={boardData}
          cards={cards}
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
        />

        {!isFocusMode && (
          <div className="fixed bottom-10 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 p-1.5 bg-white/80 backdrop-blur-3xl border border-white/40 shadow-[0_32px_80px_-16px_rgba(0,0,0,0.2)] rounded-full ring-1 ring-slate-900/5 animate-in fade-in slide-in-from-bottom-4 duration-700">
            {columns.map((col) => {
              const themeStyle = THEME_COLORS[col.theme] || THEME_COLORS.neutral;
              return (
                <Button
                  key={col.id}
                  variant="ghost"
                  onClick={() => onStageChange(col.id)}
                  disabled={boardData.syncStageEnabled && !isCurrentUserCreator}
                  className={cn(
                    "h-10 px-6 text-[10px] sm:text-xs font-black uppercase tracking-widest rounded-full transition-all border",
                    activeStage === col.id
                      ? `${themeStyle.bg} ${themeStyle.color} ${themeStyle.border} shadow-lg scale-105`
                      : "text-slate-400 border-transparent hover:text-slate-700 hover:bg-slate-100/50"
                  )}
                >
                  {col.title}
                </Button>
              );
            })}
          </div>
        )}
      </div>
  );
};

export const RetroBoard = React.memo(RetroBoardComponent);
