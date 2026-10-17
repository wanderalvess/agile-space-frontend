'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Eye, EyeOff, Ghost, Monitor, Trash2, UserX, Users, WifiOff } from 'lucide-react';
import {
  ConfirmDialog,
  ModalButton,
  PresentationBar,
  ResponsivePanel,
  RoomTimer,
  ShareDialog,
  StageNav,
  StatusChip,
  useRoomPreference,
  type TopBarPerson,
} from '@/components/room-kit';
import { useToast } from '@/hooks/use-toast';
import { copyToClipboard } from '@/lib/copy-to-clipboard';
import type { BrainstormingBoard, BrainstormingGroup, BrainstormingIdea, BrainstormingPhase, Participant } from '@/lib/types';
import { cn } from '@/lib/utils';
import { ActionsPhase } from './ActionsPhase';
import { BrainstormGuide } from './BrainstormGuide';
import { BrainstormParticipants } from './BrainstormParticipants';
import { BrainstormRoomBar } from './BrainstormRoomBar';
import { BrainstormSettingsDialog } from './BrainstormSettingsDialog';
import { IdeaViewProvider, type IdeaViewValue } from './brainstorm-context';
import {
  BRAIN_STAGES,
  BRAIN_TIMER_PRESETS,
  TIMER_LATE_GRACE_MS,
  buildInviteText,
  canExportImage,
  isStageNavLocked,
  isTimeUp,
  normalizeStage,
  participantNames,
  type RoomConnectionStatus,
} from './brainstorm-room-logic';
import { DiagramPhase } from './DiagramPhase';
import { ExportBrainstormingDialog } from './ExportDialog';
import { GroupingPhase } from './GroupingPhase';
import { MuralPhase } from './MuralPhase';
import { PrioritizationPhase } from './PrioritizationPhase';

export interface BrainstormRoomProps {
  boardId: string;
  boardData: BrainstormingBoard;
  ideas: BrainstormingIdea[];
  groups: BrainstormingGroup[];
  participants: Participant[];
  currentUserId: string;
  isFacilitator: boolean;
  mergingSourceId: string | null;
  connection: RoomConnectionStatus;
  /** Nome da squad para o chip e o convite (o vínculo dá o nome; sem ele, a chave). */
  squadLabel: string;

  onAddIdea: (content: string) => Promise<boolean>;
  onDeleteIdea: (ideaId: string) => void;
  onUpdateIdea: (ideaId: string, content: string) => Promise<boolean | void> | boolean | void;
  onVoteIdea: (ideaId: string) => void;
  onStartMerge: (ideaId: string | null) => void;
  onExecuteMerge: (sourceId: string, targetId: string) => void;
  onUpdateIdeaPosition: (ideaId: string, x: number, y: number) => void;
  onConnectIdeas: (sourceId: string, targetId: string) => void;
  onDisconnectIdea: (ideaId: string) => void;
  onMoveIdeaToGroup: (ideaId: string, groupId: string | null) => void;
  onUpdateIdeaQualifiers: (ideaId: string, qualifiers: { roi: number; effort: number }) => void;
  onAddGroup: (title: string) => Promise<boolean>;
  onDeleteGroup: (groupId: string) => void;

  onPhaseChange: (phase: BrainstormingPhase) => void;
  onRename: (title: string) => void;
  onToggleAnonymous: () => void;
  onToggleReveal: () => void;
  onTogglePresentation: () => void;
  onStartTimer: (duration: number) => void;
  onPauseTimer: () => void;
  onResumeTimer: () => void;
  onResetTimer: () => void;
  onSetTimerDuration: (duration: number) => void;

  onRemoveParticipant: (participantId: string) => void;
  onDeleteBoard: () => void;
  onOpenFeedback: () => void;
}

const isTypingTarget = (t: EventTarget | null) => {
  const el = t as HTMLElement | null;
  return !!el && (el.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName));
};

/** Há uma janela, menu ou lista aberta por cima? Então Esc é dela, não da apresentação. */
const hasOverlayOpen = () => !!document.querySelector('[role="dialog"], [role="alertdialog"], [role="menu"], [role="listbox"]');

function Notice({ icon: Icon, children }: { icon: React.ElementType; children: React.ReactNode }) {
  return (
    <div role="status" className="flex items-center gap-2 border-b border-border bg-muted/40 px-3 py-2 text-[13px] text-muted-foreground sm:px-4 xl:px-6">
      <Icon className="h-4 w-4 shrink-0" strokeWidth={1.5} aria-hidden="true" />
      <span className="min-w-0">{children}</span>
    </div>
  );
}

/**
 * Sala do Brainstorming (view): cabeçalho do kit, avisos da sessão, a etapa atual, a navegação entre etapas (só o
 * facilitador troca), o painel de participantes e as janelas (guia, configurações, compartilhar, exportar e as
 * confirmações). Os dados e as chamadas ao servidor ficam na página; aqui só se desenha e se pergunta.
 */
function BrainstormRoomComponent(props: BrainstormRoomProps) {
  const { boardId, boardData, ideas, groups, participants, currentUserId, isFacilitator, mergingSourceId, connection, squadLabel } = props;
  const { toast } = useToast();

  const phase = normalizeStage(boardData.phase);
  const settings = boardData.settings;
  const ideasHidden = settings.isRevealed === false;
  const anonymous = !!settings.isAnonymous;
  const presentationMode = !!settings.isPresentationMode;
  // O modo apresentação é da sala inteira (esconde o campo de lançar); a faixa "Apresentando" é de quem projeta.
  const presenting = isFacilitator && presentationMode;

  const [soundEnabled, setSoundEnabled] = useRoomPreference<boolean>('brainstorming-sound-enabled', false, (raw) => (raw === 'true' ? true : raw === 'false' ? false : undefined));

  const [participantsOpen, setParticipantsOpen] = useState(false);
  const [guideOpen, setGuideOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [deleteBoardOpen, setDeleteBoardOpen] = useState(false);
  const [ideaToDelete, setIdeaToDelete] = useState<BrainstormingIdea | null>(null);
  const [personToRemove, setPersonToRemove] = useState<Participant | null>(null);
  const [imageRequest, setImageRequest] = useState(0);
  const [expiredEnd, setExpiredEnd] = useState<number | null>(null);
  const [inviteText, setInviteText] = useState('');

  const names = useMemo(() => participantNames(participants), [participants]);
  const people = useMemo<TopBarPerson[]>(() => participants.map((p) => ({ id: p.id, name: p.nickname || 'Participante', online: false })), [participants]);
  const viewValue = useMemo<IdeaViewValue>(
    () => ({ currentUserId, isFacilitator, anonymous, revealed: settings.isRevealed, names }),
    [currentUserId, isFacilitator, anonymous, settings.isRevealed, names]
  );

  const roomUrl = typeof window === 'undefined' ? '' : `${window.location.origin}/brainstorming/${boardId}`;

  const handleCopyLink = useCallback(async () => {
    const ok = await copyToClipboard(window.location.href);
    toast(ok ? { title: 'Link copiado!', description: 'Convide seu time para a sessão.' } : { title: 'Não foi possível copiar o link', variant: 'destructive' });
  }, [toast]);

  const openShare = () => {
    setInviteText(buildInviteText({ title: boardData.title, squad: squadLabel, url: roomUrl }));
    setShareOpen(true);
  };

  // Com as ideias ocultas, exportar mostraria o texto de todo mundo: só o facilitador exporta.
  const openExport = () => {
    if (ideasHidden && !isFacilitator) {
      toast({ title: 'Exportar depois da revelação', description: 'As ideias dos outros ficam ocultas até o facilitador revelar.' });
      return;
    }
    setExportOpen(true);
  };

  // Esc sai do modo apresentação (se não houver janela ou menu aberto por cima).
  useEffect(() => {
    if (!presenting) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isTypingTarget(e.target) && !hasOverlayOpen()) props.onTogglePresentation();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [presenting, props.onTogglePresentation]);

  const timer = boardData.timer;
  const timeUp = isTimeUp(timer, expiredEnd);
  const timerNode = (
    <>
      <RoomTimer
        timer={timer}
        isFacilitator={isFacilitator}
        onStart={props.onStartTimer}
        onPause={props.onPauseTimer}
        onResume={props.onResumeTimer}
        onReset={props.onResetTimer}
        onSetDuration={props.onSetTimerDuration}
        isSoundEnabled={soundEnabled}
        onExpire={({ late }) => {
          if (!late) setExpiredEnd(timer?.endTime ?? null);
        }}
        lateGraceMs={TIMER_LATE_GRACE_MS}
        presets={BRAIN_TIMER_PRESETS}
      />
      {timeUp && (
        <StatusChip tone="warn" className="h-8 px-3 text-[13px]">
          <span role="status">Tempo esgotado</span>
        </StatusChip>
      )}
    </>
  );

  const handleImageDone = useCallback(
    (ok: boolean) => {
      if (!ok) toast({ title: 'Não foi possível gerar a imagem', description: 'Tente de novo ou use o resumo em Markdown.', variant: 'destructive' });
    },
    [toast]
  );

  const stage = (() => {
    switch (phase) {
      case 'diagram':
        return (
          <DiagramPhase
            ideas={ideas}
            boardId={boardId}
            onVoteIdea={props.onVoteIdea}
            onUpdateIdea={props.onUpdateIdea}
            onUpdatePosition={props.onUpdateIdeaPosition}
            onConnectIdeas={props.onConnectIdeas}
            onDisconnectIdea={props.onDisconnectIdea}
            exportRequest={imageRequest}
            onExportDone={handleImageDone}
          />
        );
      case 'grouping':
        return (
          <GroupingPhase
            ideas={ideas}
            groups={groups}
            onAddGroup={props.onAddGroup}
            onDeleteGroup={props.onDeleteGroup}
            onMoveIdeaToGroup={props.onMoveIdeaToGroup}
            onVoteIdea={props.onVoteIdea}
          />
        );
      case 'prioritization':
        return <PrioritizationPhase ideas={ideas} groups={groups} onUpdateQualifiers={props.onUpdateIdeaQualifiers} />;
      case 'actions':
        return <ActionsPhase ideas={ideas} groups={groups} boardData={boardData} onUpdateIdea={props.onUpdateIdea} onMoveIdea={props.onMoveIdeaToGroup} />;
      default:
        return (
          <MuralPhase
            ideas={ideas}
            onAddIdea={props.onAddIdea}
            onDeleteIdea={setIdeaToDelete}
            onUpdateIdea={props.onUpdateIdea}
            onVoteIdea={props.onVoteIdea}
            onStartMerge={props.onStartMerge}
            onExecuteMerge={props.onExecuteMerge}
            mergingSourceId={mergingSourceId}
            isPresentationMode={presentationMode}
            exportRequest={imageRequest}
            onExportDone={handleImageDone}
          />
        );
    }
  })();

  return (
    <IdeaViewProvider value={viewValue}>
      <div className="flex h-dvh w-full flex-col overflow-hidden bg-background text-foreground">
        {presenting ? (
          <PresentationBar title={boardData.title || 'Brainstorming'} onExit={props.onTogglePresentation}>
            {timerNode}
            {ideasHidden && (
              <ModalButton variant="primary" className="gap-2" onClick={props.onToggleReveal}>
                <Eye className="h-4 w-4" strokeWidth={1.5} aria-hidden="true" /> Revelar ideias
              </ModalButton>
            )}
          </PresentationBar>
        ) : (
          <>
            <BrainstormRoomBar
              boardData={boardData}
              squadLabel={squadLabel}
              isFacilitator={isFacilitator}
              people={people}
              isParticipantsOpen={participantsOpen}
              onToggleParticipants={() => setParticipantsOpen((v) => !v)}
              connection={connection}
              timer={timerNode}
              onRename={props.onRename}
              onShare={openShare}
              onCopyLink={() => void handleCopyLink()}
              onExport={openExport}
              onOpenGuide={() => setGuideOpen(true)}
              onOpenSettings={() => setSettingsOpen(true)}
              onToggleAnonymous={props.onToggleAnonymous}
              onToggleReveal={props.onToggleReveal}
              onTogglePresentation={props.onTogglePresentation}
              isSoundEnabled={soundEnabled}
              onToggleSound={() => setSoundEnabled(!soundEnabled)}
              onDeleteBoard={() => setDeleteBoardOpen(true)}
              onOpenFeedback={props.onOpenFeedback}
            />
            {connection === 'offline' && <Notice icon={WifiOff}><strong className="font-semibold text-foreground">Sem conexão:</strong> as mudanças não serão salvas. Tentando reconectar.</Notice>}
            {ideasHidden && isFacilitator && <Notice icon={EyeOff}><strong className="font-semibold text-foreground">Ideias ocultas para a sala.</strong> Só você, como facilitador, vê o texto de todas. Revele quando a escrita terminar.</Notice>}
            {ideasHidden && !isFacilitator && <Notice icon={EyeOff}><strong className="font-semibold text-foreground">As ideias estão ocultas.</strong> Você vê só as suas até o facilitador revelar. Votar e juntar ficam bloqueados.</Notice>}
            {anonymous && <Notice icon={Ghost}><strong className="font-semibold text-foreground">Autores anônimos.</strong> {isFacilitator ? 'Ninguém vê quem lançou cada ideia, nem você.' : 'Ninguém vê quem lançou cada ideia, nem o facilitador.'}</Notice>}
            {presentationMode && !isFacilitator && <Notice icon={Monitor}>O facilitador está apresentando o mural.</Notice>}
          </>
        )}

        <div className="relative flex min-h-0 flex-1">
          <main className="relative isolate flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
            <div aria-hidden="true" className="room-halo pointer-events-none absolute inset-x-0 top-0 -z-10 h-[420px]" />
            <div className={cn('min-h-0 flex-1 p-3 lg:px-5', phase === 'diagram' ? 'overflow-hidden' : 'overflow-y-auto')}>{stage}</div>
            <div className="flex shrink-0 justify-center px-3 pb-3 pt-1">
              <StageNav
                label="Etapas do brainstorming"
                items={BRAIN_STAGES}
                value={phase}
                onChange={(id) => props.onPhaseChange(id as BrainstormingPhase)}
                locked={isStageNavLocked(isFacilitator)}
              />
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
              footer={<ModalButton className="h-9 w-full gap-2" onClick={openShare}>Convidar pelo link</ModalButton>}
            >
              <BrainstormParticipants
                participants={participants}
                creatorId={boardData.creatorId}
                currentUserId={currentUserId}
                isFacilitator={isFacilitator}
                onRequestRemove={setPersonToRemove}
              />
            </ResponsivePanel>
          )}
        </div>

        <BrainstormGuide open={guideOpen} onOpenChange={setGuideOpen} />

        <BrainstormSettingsDialog
          open={settingsOpen}
          onOpenChange={setSettingsOpen}
          isFacilitator={isFacilitator}
          title={boardData.title}
          anonymous={anonymous}
          ideasHidden={ideasHidden}
          presentation={presentationMode}
          soundEnabled={soundEnabled}
          onToggleAnonymous={props.onToggleAnonymous}
          onToggleReveal={props.onToggleReveal}
          onTogglePresentation={props.onTogglePresentation}
          onRename={props.onRename}
          onSoundChange={setSoundEnabled}
        />

        <ShareDialog
          open={shareOpen}
          onOpenChange={setShareOpen}
          title="Compartilhar o brainstorming"
          description="Quem receber o link e estiver logado entra e lança ideias."
          url={roomUrl}
          note="O link dá acesso: qualquer pessoa logada entra como participante, sem checar a squad."
          inviteText={inviteText}
          onInviteTextChange={setInviteText}
        />

        <ExportBrainstormingDialog
          open={exportOpen}
          onOpenChange={setExportOpen}
          title={boardData.title}
          ideas={ideas}
          groups={groups}
          canExportImage={canExportImage(phase)}
          onExportImage={() => setImageRequest((n) => n + 1)}
        />

        <ConfirmDialog
          open={!!ideaToDelete}
          onOpenChange={(next) => { if (!next) setIdeaToDelete(null); }}
          tone="danger"
          icon={Trash2}
          title="Excluir esta ideia?"
          description={
            <>
              {ideaToDelete && <q className="mb-2 block max-h-24 overflow-hidden text-foreground">{ideaToDelete.content}</q>}
              A ideia some do mural e as ligadas a ela perdem só a ligação. Não dá para desfazer.
            </>
          }
          cancelLabel="Cancelar"
          confirmLabel="Excluir ideia"
          onConfirm={() => {
            if (ideaToDelete) props.onDeleteIdea(ideaToDelete.id);
          }}
        />

        <ConfirmDialog
          open={!!personToRemove}
          onOpenChange={(next) => { if (!next) setPersonToRemove(null); }}
          tone="warn"
          icon={UserX}
          title={`Remover ${personToRemove?.nickname || 'esta pessoa'} da sessão?`}
          description="Ela sai da lista de participantes. As ideias dela continuam no mural, e quem tem o link pode voltar a entrar."
          cancelLabel="Cancelar"
          confirmLabel="Remover pessoa"
          onConfirm={() => {
            if (personToRemove) props.onRemoveParticipant(personToRemove.id);
          }}
        />

        <ConfirmDialog
          open={deleteBoardOpen}
          onOpenChange={setDeleteBoardOpen}
          tone="danger"
          icon={Trash2}
          title="Apagar este brainstorming?"
          description="O mural, as ideias, os grupos e a lista de participantes são apagados para todos. Quem estiver na sala é avisado. Não dá para desfazer."
          cancelLabel="Cancelar"
          confirmLabel="Apagar brainstorming"
          onConfirm={props.onDeleteBoard}
        />
      </div>
    </IdeaViewProvider>
  );
}

export const BrainstormRoom = React.memo(BrainstormRoomComponent);
