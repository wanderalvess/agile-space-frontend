'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import { sortableKeyboardCoordinates } from '@dnd-kit/sortable';
import { ChevronLeft, ChevronRight, LogOut, Users, Volume2, VolumeX } from 'lucide-react';
import {
  ConfirmDialog,
  IconButton,
  ModalButton,
  PresentationBar,
  ResponsivePanel,
  RoomTimer,
  SelectField,
  StageNav,
  useRoomPreference,
} from '@/components/room-kit';
import { copyToClipboard } from '@/lib/copy-to-clipboard';
import { useToast } from '@/hooks/use-toast';
import type {
  RetroBoard,
  RetroCard as RetroCardType,
  RetroColumnKey,
  RetroParticipant,
  RetroReactionType,
  TimerState,
} from '@/lib/types';
import { TeamChat } from '../poker/team-chat/TeamChat';
import type { ChatMessage, ChatMessageKind } from '../poker/team-chat/chatChannels';
import { ExportRetroDialog } from './ExportRetroDialog';
import { RetroActionImportDialog, type RetroImportEntry } from './RetroActionImportDialog';
import { RetroColumn, type RetroColumnView } from './RetroColumn';
import { RetroControlBar, RetroPhaseActions, type RetroLayoutMode } from './RetroControlBar';
import { RetroCheckinNotes } from './RetroCheckinNotes';
import { RetroGuide } from './RetroGuide';
import { RetroLiveStrip } from './RetroLiveStrip';
import { RetroParticipantList } from './RetroParticipantList';
import { RetroRoomBar } from './RetroRoomBar';
import { RetroSettingsDialog } from './RetroSettingsDialog';
import { RetroWelcome } from './RetroWelcome';
import { presenceOnlineOf } from '@/lib/room-presence';
import { toChatParticipant } from './retro-chat';
import { useStableColumnCards } from './useStableColumnCards';
import {
  TIMER_LATE_GRACE_MS,
  contributionSummary,
  isStageNavLocked,
  neighborStage,
  resolveColumns,
  voteLimitOptions,
} from './retro-room-logic';

const EMPTY_CARDS: RetroCardType[] = [];

export interface RetroRoomProps {
  boardId: string;
  boardData: RetroBoard;
  cards: RetroCardType[];
  participants: RetroParticipant[];
  /** Contas com a sala aberta agora. `null`/ausente = o servidor não informa: só o total, sem ponto de online. */
  onlineIds?: ReadonlySet<string> | null;
  currentUserId: string;
  currentParticipant: RetroParticipant;
  isCurrentUserCreator: boolean;
  timer: TimerState;
  activeStage: RetroColumnKey;
  mergingSourceId: string | null;
  /** O check-in inicial ainda está na frente: as boas-vindas esperam. */
  needsHealthCheck?: boolean;
  chatMessagesByChannel: Record<string, ChatMessage[]>;

  onAddCard: (content: string, column: RetroColumnKey, assignee?: string, dueDate?: string) => Promise<boolean> | void;
  onDeleteCard: (cardId: string) => void;
  onUpdateCard: (cardId: string, content: string, assignee?: string, dueDate?: string) => void;
  onToggleVote: (cardId: string, currentVotes: string[]) => void;
  onToggleReaction: (cardId: string, type: RetroReactionType, currentUserIds: string[]) => void;
  onToggleDone: (cardId: string, isDone: boolean) => void;
  onImportActions: (entries: RetroImportEntry[]) => void;
  onToggleCardsRevealed: () => void;
  onSetVotingStatus: (status: 'disabled' | 'active' | 'finished') => void;
  onSetMaxVotesPerParticipant: (max: number) => void;
  onStartTimer: (duration: number) => void;
  onPauseTimer: () => void;
  onResumeTimer: () => void;
  onResetTimer: () => void;
  onSetTimerDuration: (duration: number) => void;
  /** O tempo zerou com a tela aberta; só o facilitador age (auto-revelar e encerrar o timer). */
  onTimerExpire: (info: { late: boolean }) => void;
  onToggleShowAuthors: (value: boolean) => void;
  onToggleSyncStage: (value: boolean) => void;
  onToggleAutoRevealOnTimerEnd: (value: boolean) => void;
  onToggleAutoSortOnVoteEnd: (value: boolean) => void;
  onToggleHealthCheck: (value: boolean) => void;
  onHealthCheckQuestionChange: (value: string) => void;
  onToggleColumnSort: (columnKey: string, isSorted: boolean) => void;
  onRenameColumn: (columnId: string, title: string) => void;
  onSyncSummary: () => void;
  onDragEnd: (event: DragEndEvent) => void;
  onRemoveParticipant: (id: string) => void;
  onClaimCreator?: () => void;
  onLeaveBoard: () => void;
  onStageChange: (stage: RetroColumnKey) => void;
  onStartMerge: (cardId: string | null) => void;
  onExecuteMerge: (targetId: string) => void;
  onOpenFeedback: () => void;
  onOpenStats?: () => void;
  onSendChatMessage: (text: string, kind: ChatMessageKind, channelId: string) => void;
  onDeleteChatMessage: (messageId: string, channelId: string) => void;

  // ---- Backend novo (todos opcionais; sem eles a sala é a de sempre) ----
  /** Retro encerrada pelo facilitador. */
  isFinished?: boolean;
  /** Encerrada e esta pessoa não é facilitador/ADMIN: a sala fica somente leitura, com aviso. */
  readOnly?: boolean;
  onFinishRetro?: () => void | Promise<void>;
  onReopenRetro?: () => void | Promise<void>;
  lifecycleBusy?: boolean;
  /** "Fulana está escrevendo…" de uma coluna. */
  typingLabelForColumn?: (columnKey: string) => string | null;
  typingLabelForChannel?: (channelId: string) => string | null;
  onTypingCard?: (columnKey: string) => void;
  onTypingChat?: (channelId: string) => void;
}

const isTypingTarget = (t: EventTarget | null) => {
  const el = t as HTMLElement | null;
  return !!el && (el.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName));
};

/** Há uma janela, menu ou lista aberta por cima? Então Esc é dela, não da apresentação. */
const hasOverlayOpen = () => !!document.querySelector('[role="dialog"], [role="alertdialog"], [role="menu"], [role="listbox"]');

function RetroRoomComponent(props: RetroRoomProps) {
  const {
    boardId,
    boardData,
    cards,
    participants,
    onlineIds = null,
    currentUserId,
    currentParticipant,
    isCurrentUserCreator,
    timer,
    activeStage,
    mergingSourceId,
    needsHealthCheck = false,
    chatMessagesByChannel,
    isFinished = false,
    readOnly = false,
    typingLabelForColumn,
    onStageChange,
    onSetVotingStatus,
    onToggleCardsRevealed,
  } = props;
  const { toast } = useToast();

  // Visão e som são preferências pessoais do navegador.
  const [layoutMode, setLayoutMode] = useRoomPreference<RetroLayoutMode>('agile_retro_layout_mode', 'board', (raw) => (raw === 'board' || raw === 'focus' ? raw : undefined));
  const [soundEnabled, setSoundEnabled] = useRoomPreference<boolean>('retro_sound_enabled', true, (raw) => raw !== 'false');

  const [presenting, setPresenting] = useState(false);
  const [onlyVoted, setOnlyVoted] = useState(false);
  const [participantsOpen, setParticipantsOpen] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const [chatUnread, setChatUnread] = useState(0);
  const [guideOpen, setGuideOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [leaveOpen, setLeaveOpen] = useState(false);

  const columns = useMemo(() => resolveColumns(boardData), [boardData]);
  const navLocked = isStageNavLocked(boardData, isCurrentUserCreator);
  const syncOn = !!boardData.syncStageEnabled;

  const cardsByColumn = useStableColumnCards(cards);

  const summary = useMemo(() => contributionSummary(cards, columns, participants, currentUserId), [cards, columns, participants, currentUserId]);
  const people = useMemo(() => participants.map((p) => ({ id: p.id, name: p.nickname, online: presenceOnlineOf(onlineIds, p.id) })), [participants, onlineIds]);
  const chatParticipants = useMemo(() => participants.map(toChatParticipant), [participants]);
  const chatUser = useMemo(() => toChatParticipant(currentParticipant), [currentParticipant]);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const handleCopyLink = useCallback(async () => {
    const ok = await copyToClipboard(window.location.href);
    toast(ok
      ? { title: 'Link copiado', description: 'Compartilhe com a squad para todo mundo entrar na retro.' }
      : { title: 'Não foi possível copiar', description: 'Copie o endereço direto da barra do navegador.', variant: 'destructive' });
  }, [toast]);

  const handleExport = () => {
    if (!boardData.isCardsRevealed && !isCurrentUserCreator) {
      toast({ title: 'Exportar depois da revelação', description: 'Os cartões dos outros ficam ocultos até o facilitador revelar.' });
      return;
    }
    setExportOpen(true);
  };

  const toggleParticipants = () => {
    setParticipantsOpen((v) => !v);
    setChatOpen(false);
  };
  const toggleChat = () => {
    setChatOpen((v) => !v);
    setParticipantsOpen(false);
  };

  // Atalhos da apresentação: setas trocam de coluna (menos com a navegação travada pelo facilitador) e Esc sai.
  useEffect(() => {
    if (!presenting) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (isTypingTarget(e.target)) return;
      if (e.key === 'Escape') {
        if (!hasOverlayOpen()) setPresenting(false);
      } else if ((e.key === 'ArrowRight' || e.key === 'ArrowLeft') && !navLocked) {
        onStageChange(neighborStage(columns, activeStage, e.key === 'ArrowRight' ? 1 : -1));
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [presenting, navLocked, columns, activeStage, onStageChange]);

  // Quem fica sem a coluna ativa (apresentação com uma só coluna visível) cai na primeira.
  const stageExists = columns.some((c) => c.id === activeStage);
  const stage = stageExists ? activeStage : columns[0]?.id ?? '';

  const handleFocusColumn = useCallback((id: string) => onStageChange(id), [onStageChange]);
  const handleToggleOnlyVoted = useCallback(() => setOnlyVoted((v) => !v), []);
  const handleOpenImport = useCallback(() => setImportOpen(true), []);

  const view: RetroColumnView = presenting ? 'present' : layoutMode === 'focus' ? 'focus' : 'board';
  const shownColumns = view === 'focus' ? columns.filter((c) => c.id === stage) : columns;
  const showStageNav = !presenting && (layoutMode === 'focus' || syncOn);

  const columnNodes = shownColumns.map((col) => (
    <RetroColumn
      key={col.id}
      column={col}
      cards={cardsByColumn[col.id] || EMPTY_CARDS}
      boardData={boardData}
      currentUserId={currentUserId}
      participants={participants}
      isCreator={isCurrentUserCreator}
      view={view}
      isActiveStage={stage === col.id}
      highlightStage={syncOn || presenting}
      isNavLocked={navLocked}
      onlyVoted={onlyVoted}
      onToggleOnlyVoted={handleToggleOnlyVoted}
      mergingSourceId={mergingSourceId}
      onFocus={handleFocusColumn}
      onAddCard={props.onAddCard}
      onDeleteCard={props.onDeleteCard}
      onUpdateCard={props.onUpdateCard}
      onToggleVote={props.onToggleVote}
      onToggleReaction={props.onToggleReaction}
      onToggleDone={props.onToggleDone}
      onToggleColumnSort={props.onToggleColumnSort}
      onRenameColumn={props.onRenameColumn}
      onSyncSummary={props.onSyncSummary}
      onOpenImport={handleOpenImport}
      onStartMerge={props.onStartMerge}
      onExecuteMerge={props.onExecuteMerge}
      readOnly={readOnly}
      typingLabel={typingLabelForColumn?.(col.id) ?? null}
      onTyping={props.onTypingCard}
    />
  ));

  return (
    <div className="flex h-dvh w-full flex-col overflow-hidden bg-background text-foreground">
      {presenting ? (
        <PresentationBar title={boardData.title || 'Retrospectiva'} onExit={() => setPresenting(false)}>
          <RoomTimer
            timer={timer}
            isFacilitator={isCurrentUserCreator}
            onStart={props.onStartTimer}
            onPause={props.onPauseTimer}
            onResume={props.onResumeTimer}
            onReset={props.onResetTimer}
            onSetDuration={props.onSetTimerDuration}
            isSoundEnabled={soundEnabled}
            onExpire={props.onTimerExpire}
            lateGraceMs={TIMER_LATE_GRACE_MS}
          />
          {isCurrentUserCreator && (
            <>
              <IconButton
                label={soundEnabled ? 'Desligar o som do timer' : 'Ligar o som do timer'}
                icon={soundEnabled ? Volume2 : VolumeX}
                onClick={() => setSoundEnabled(!soundEnabled)}
              />
              <SelectField
                aria-label="Votos por painel"
                value={String(boardData.maxVotesPerParticipant || 0)}
                onChange={(v) => props.onSetMaxVotesPerParticipant(Number(v))}
                options={voteLimitOptions(boardData.maxVotesPerParticipant || 0)}
                className="h-9 w-[7.5rem]"
              />
              <RetroPhaseActions boardData={boardData} onToggleCardsRevealed={onToggleCardsRevealed} onSetVotingStatus={onSetVotingStatus} />
            </>
          )}
          <div className="flex items-center gap-1.5">
            <ModalButton className="gap-1.5 px-3" disabled={navLocked} onClick={() => onStageChange(neighborStage(columns, stage, -1))}>
              <ChevronLeft className="h-4 w-4" strokeWidth={1.5} aria-hidden="true" /> Anterior
            </ModalButton>
            <ModalButton className="gap-1.5 px-3" disabled={navLocked} onClick={() => onStageChange(neighborStage(columns, stage, 1))}>
              Próxima coluna <ChevronRight className="h-4 w-4" strokeWidth={1.5} aria-hidden="true" />
            </ModalButton>
          </div>
        </PresentationBar>
      ) : (
        <>
          <RetroRoomBar
            boardData={boardData}
            isFacilitator={isCurrentUserCreator}
            people={people}
            isParticipantsOpen={participantsOpen}
            onToggleParticipants={toggleParticipants}
            isChatOpen={chatOpen}
            chatUnread={chatUnread}
            onToggleChat={toggleChat}
            onShare={() => void handleCopyLink()}
            onExport={handleExport}
            onOpenGuide={() => setGuideOpen(true)}
            onOpenSettings={() => setSettingsOpen(true)}
            onOpenStats={props.onOpenStats}
            isSoundEnabled={soundEnabled}
            onToggleSound={() => setSoundEnabled(!soundEnabled)}
            onLeave={() => setLeaveOpen(true)}
            onOpenFeedback={props.onOpenFeedback}
            isFinished={isFinished}
          />
          <RetroControlBar
            boardData={boardData}
            isFacilitator={isCurrentUserCreator}
            timer={timer}
            isSoundEnabled={soundEnabled}
            onToggleCardsRevealed={onToggleCardsRevealed}
            onSetVotingStatus={onSetVotingStatus}
            onSetMaxVotesPerParticipant={props.onSetMaxVotesPerParticipant}
            onStartTimer={props.onStartTimer}
            onPauseTimer={props.onPauseTimer}
            onResumeTimer={props.onResumeTimer}
            onResetTimer={props.onResetTimer}
            onSetTimerDuration={props.onSetTimerDuration}
            onTimerExpire={props.onTimerExpire}
            layoutMode={layoutMode}
            onLayoutModeChange={setLayoutMode}
            onPresent={() => setPresenting(true)}
            isFinished={isFinished}
            onFinishRetro={props.onFinishRetro}
            onReopenRetro={props.onReopenRetro}
            lifecycleBusy={props.lifecycleBusy}
            readOnly={readOnly}
          />
          <RetroLiveStrip summary={summary} currentUserId={currentUserId} authorsRevealed={boardData.isAuthorsRevealed === true} />
        </>
      )}

      <div className="relative flex min-h-0 flex-1">
        <main className="relative isolate flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
          <div aria-hidden="true" className="room-halo pointer-events-none absolute inset-x-0 top-0 -z-10 h-[420px]" />

          <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-3 lg:px-5 [&>*]:shrink-0">
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={props.onDragEnd}>
              {view === 'board' && <div className="flex snap-x snap-mandatory items-start gap-3.5 overflow-x-auto pb-2 sm:snap-none">{columnNodes}</div>}
              {view === 'focus' && <div className="mx-auto flex w-full max-w-[1680px] flex-col">{columnNodes}</div>}
              {view === 'present' && (
                <div
                  className="grid items-start gap-3.5 overflow-x-auto pb-2"
                  style={{ gridTemplateColumns: `repeat(${columns.length}, minmax(min(86vw, 300px), 1fr))` }}
                >
                  {columnNodes}
                </div>
              )}
            </DndContext>

            {showStageNav && (
              <StageNav
                label="Colunas da retro"
                items={columns.map((c) => ({ id: c.id, label: c.title, count: (cardsByColumn[c.id] || EMPTY_CARDS).length }))}
                value={stage}
                onChange={onStageChange}
                locked={navLocked}
              />
            )}
          </div>
        </main>

        {!presenting && (
          <ResponsivePanel
            side="right"
            open={participantsOpen}
            onOpenChange={setParticipantsOpen}
            sheetBelow={1024}
            widthClass="w-80"
            title="Participantes"
            icon={Users}
            count={participants.length}
            footer={
              <ModalButton className="h-9 w-full gap-2" onClick={() => void handleCopyLink()}>
                Convidar o time
              </ModalButton>
            }
          >
            {isCurrentUserCreator && <RetroCheckinNotes participants={participants} />}
            <RetroParticipantList
              participants={participants}
              onlineIds={onlineIds}
              currentUserId={currentUserId}
              isCreator={isCurrentUserCreator}
              onRemoveParticipant={props.onRemoveParticipant}
              onClaimCreator={props.onClaimCreator}
            />
          </ResponsivePanel>
        )}
      </div>

      <TeamChat
        roomId={boardId}
        title="Chat da Retro"
        currentUser={chatUser}
        participants={chatParticipants}
        onlineIds={onlineIds}
        canModerate={isCurrentUserCreator}
        isOpen={chatOpen && !presenting}
        onClose={() => setChatOpen(false)}
        onUnreadChange={setChatUnread}
        messagesByChannel={chatMessagesByChannel}
        onSendMessage={props.onSendChatMessage}
        onDeleteMessage={props.onDeleteChatMessage}
        onTyping={props.onTypingChat}
        typingLabelFor={props.typingLabelForChannel}
      />

      {cards.length === 0 && (
        <RetroWelcome title={boardData.title || 'Retrospectiva'} isFacilitator={isCurrentUserCreator} disabled={needsHealthCheck || presenting || readOnly} />
      )}

      <RetroGuide open={guideOpen} onOpenChange={setGuideOpen} />

      <ExportRetroDialog isOpen={exportOpen} onClose={() => setExportOpen(false)} boardData={boardData} cards={cards} participants={participants} />

      {isCurrentUserCreator && (
        <RetroSettingsDialog
          isOpen={settingsOpen}
          onClose={() => setSettingsOpen(false)}
          isAuthorsRevealed={boardData.isAuthorsRevealed === true}
          onToggleAuthorsRevealed={props.onToggleShowAuthors}
          syncStageEnabled={syncOn}
          onToggleSyncStage={props.onToggleSyncStage}
          autoRevealOnTimerEnd={!!boardData.autoRevealOnTimerEnd}
          onToggleAutoRevealOnTimerEnd={props.onToggleAutoRevealOnTimerEnd}
          autoSortOnVoteEnd={!!boardData.autoSortOnVoteEnd}
          onToggleAutoSortOnVoteEnd={props.onToggleAutoSortOnVoteEnd}
          healthCheckEnabled={!!boardData.healthCheckEnabled}
          onToggleHealthCheck={props.onToggleHealthCheck}
          healthCheckQuestion={boardData.healthCheckQuestion || ''}
          onHealthCheckQuestionChange={props.onHealthCheckQuestionChange}
        />
      )}

      <RetroActionImportDialog
        isOpen={importOpen}
        onClose={() => setImportOpen(false)}
        team={boardData.team || ''}
        squadId={boardData.squadId}
        currentBoardId={boardId}
        onImport={props.onImportActions}
      />

      <ConfirmDialog
        open={leaveOpen}
        onOpenChange={setLeaveOpen}
        tone="warn"
        icon={LogOut}
        title="Sair da retro?"
        description="Você sai da lista de participantes e volta para a página inicial. Os cartões que você escreveu continuam no quadro."
        cancelLabel="Ficar"
        confirmLabel="Sair da retro"
        onConfirm={props.onLeaveBoard}
      />
    </div>
  );
}

export const RetroRoom = React.memo(RetroRoomComponent);
