'use client';

import { moduleIcon } from '@/lib/modules-registry';
import { ModuleIcon } from '@/components/brand/ModuleIcon';
import React, { useMemo, useState } from 'react';
import type { DeckType, Issue, Participant, Role, Vote, Room } from '@/lib/types';
import { getDeckCards } from '@/lib/poker-deck';
import { SEM_CARGO } from '@/lib/cargo';
import { buildDefaultSettingsPatch, calculateRoleEfforts, canParticipantVote, formatRoleForCopy, observerHintOf, votingCargosOf } from '@/lib/poker-utils';
import { summarizeRound } from '@/lib/poker-results';
import { VoteDistribution } from './VoteDistribution';
import { OutlierPrompt } from './OutlierPrompt';
import { CopyEstimateCard } from './Results';
import { Button } from '@/components/ui/button';
import { Download, Eye, RefreshCcw, ListChecks, Users, SlidersHorizontal, Link2, MessageSquareText, ChevronDown, CheckCircle2, ExternalLink, Trash2 } from 'lucide-react';
import { ExportDialog } from './ExportDialog';
import { ParticipantList } from './ParticipantList';
import { FacilitatorPanel } from './FacilitatorPanel';
import { formatExternalUrl, cn } from '@/lib/utils';
import { TopicQueue } from './TopicQueue';
import { ShareRoomDialog } from './ShareRoomDialog';
import { CeremonySettingsDialog } from './PokerDialogs';
import { useSaveRoomTemplate } from './TemplateDialogs';
import { DeckCard, FIELD, Modal, ModalButton, ResponsivePanel, RoomTopBar, StatusChip, VoteCard, type RoomTopBarAction, type RoomTopBarChip, type RoomTopBarMenuItem } from '@/components/room-kit';

interface AsyncPokerRoomProps {
  roomId: string;
  currentUser: Participant;
  participants: Participant[];
  votes: Vote[];
  deck: DeckType;
  revealedIssues: string[];
  onAsyncVote: (issueId: string, value: string) => void;
  onAsyncReveal: (issueId: string) => void;
  onAsyncClear: (issueId: string) => void;
  onSetDeck: (deck: DeckType) => void;
  onRemoveParticipant: (id: string) => void;
  onUpdateParticipantRole: (id: string, role: Role) => void;
  isCurrentUserFacilitator: boolean;
  roomTitle?: string;
  roomTeam?: string;
  issuesQueue: Issue[];
  onAddIssue: (title: string, jiraLink?: string) => void;
  onBulkAddIssues: (items: Partial<Issue>[]) => number | void;
  onDeleteIssue: (id: string) => void;
  onCompleteIssue: (issueId: string, points: string, devPoints?: string, qaPoints?: string, rolePoints?: Record<string, string>) => void;
  onLeaveRoom: () => void;
  isSoundEnabled: boolean;
  onSetIsSoundEnabled: (enabled: boolean) => void;
  onClaimFacilitator?: () => void;
  settings?: Room['settings'];
  onUpdateSettings?: (settings: Partial<NonNullable<Room['settings']>>) => void;
  onOpenFeedback: () => void;
  onOpenRetro?: () => void;
  onDeleteRoom?: () => void;
  creatorId: string;
}

const CARD = 'rounded-[14px] border border-border bg-card shadow-[0_8px_24px_rgba(15,23,42,0.06)] dark:shadow-[0_20px_50px_rgba(0,0,0,0.4)]';

const AsyncPokerRoomComponent = ({
  roomId,
  currentUser,
  participants,
  votes,
  deck,
  revealedIssues,
  onAsyncVote,
  onAsyncReveal,
  onAsyncClear,
  onRemoveParticipant,
  onUpdateParticipantRole,
  isCurrentUserFacilitator,
  roomTitle,
  roomTeam,
  issuesQueue,
  onAddIssue,
  onBulkAddIssues,
  onDeleteIssue,
  onCompleteIssue,
  onClaimFacilitator,
  settings,
  onUpdateSettings,
  onOpenFeedback,
  onOpenRetro,
  onDeleteRoom,
  onSetDeck,
}: AsyncPokerRoomProps) => {
  const [expandedIssues, setExpandedIssues] = useState<string[]>([]);
  const [isQueueOpen, setIsQueueOpen] = useState(false);
  const [isParticipantsOpen, setIsParticipantsOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isShareDialogOpen, setIsShareDialogOpen] = useState(false);
  const [isExportOpen, setIsExportOpen] = useState(false);
  const saveRoomTemplate = useSaveRoomTemplate({ roomTitle, deck, settings, issues: issuesQueue });
  // Quem vota: a política da sala (cargos), a mesma da sala ao vivo.
  const votingCargos = useMemo(() => votingCargosOf(settings), [settings]);
  const deckValues = useMemo(() => getDeckCards(deck, settings?.maxHours), [deck, settings?.maxHours]);
  const isDense = deckValues.length > 14;

  // Mesmo gate de room/[id]/page.tsx e Controls.tsx (poker-utils.canParticipantVote) —
  // a lista local antiga (MANAGEMENT_ROLES) divergia da centralizada, deixando o botão
  // de voto habilitado pra papéis (ex: People Lead) que o write-path já bloqueava.
  const canVote = canParticipantVote(currentUser, votingCargos);

  const toggleExpand = (id: string) => {
    setExpandedIssues(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
  };

  const pendingIssues = issuesQueue.filter(i => i.status !== 'completed');
  const completedIssues = issuesQueue.filter(i => i.status === 'completed');
  const unit = deck === 'hours' ? 'h' : deck === 'tshirt' ? '' : ' SP';

  const title = roomTitle || 'Scrum Poker assíncrono';
  const presencePeople = participants.map(p => ({ id: p.id, name: p.nickname }));
  const chips: RoomTopBarChip[] = [
    { id: 'mode', label: 'Assíncrono', tone: 'brand' },
    ...(roomTeam ? [{ id: 'team', label: roomTeam, secondary: true }] : []),
  ];
  const actions: RoomTopBarAction[] = [
    { id: 'queue', label: 'Fila de tarefas', icon: ListChecks, pressed: isQueueOpen, badge: pendingIssues.length, onClick: () => setIsQueueOpen(v => !v) },
    { id: 'share', label: 'Compartilhar sala', icon: Link2, onClick: () => setIsShareDialogOpen(true) },
    ...(isCurrentUserFacilitator
      ? [{ id: 'settings', label: 'Configurações da cerimônia', icon: SlidersHorizontal, tier: 'mid' as const, onClick: () => setIsSettingsOpen(true) }]
      : []),
    { id: 'export', label: 'Exportar resultados', icon: Download, tier: 'mid' as const, onClick: () => setIsExportOpen(true) },
  ];
  const menuItems: RoomTopBarMenuItem[] = [
    ...(onOpenRetro ? [{ id: 'retro', label: 'Abrir retro desta sprint', icon: MessageSquareText, onClick: onOpenRetro }] : []),
    ...(onDeleteRoom ? [{ id: 'delete-room', label: 'Excluir sala', icon: Trash2, onClick: onDeleteRoom }] : []),
  ];

  return (
    <>
      <div className="flex h-dvh w-full flex-col overflow-hidden bg-background text-foreground">
        <RoomTopBar
          toolName="Scrum Poker"
          toolIcon={moduleIcon('poker')}
          title={title}
          chips={chips}
          presence={{ people: presencePeople, open: isParticipantsOpen, onClick: () => setIsParticipantsOpen(v => !v), unknown: true }}
          actions={actions}
          menuItems={menuItems}
          onOpenFeedback={onOpenFeedback}
        />
        <ExportDialog
          roomTitle={title}
          roomTeam={roomTeam}
          issues={issuesQueue}
          participants={participants}
          deck={deck}
          open={isExportOpen}
          onOpenChange={setIsExportOpen}
          hideTrigger
        />

        <div className="relative flex min-h-0 flex-1">
          <ResponsivePanel side="left" open={isQueueOpen} onOpenChange={setIsQueueOpen} title="Fila" count={issuesQueue.length} icon={ListChecks} widthClass="w-80">
            <TopicQueue
              issues={issuesQueue}
              activeIssueId={null}
              isFacilitator={isCurrentUserFacilitator}
              onAddIssue={onAddIssue}
              onBulkAddIssues={onBulkAddIssues}
              onSelectIssue={() => {}}
              onDeleteIssue={onDeleteIssue}
              deck={deck}
              hideSelectButton={true}
            />
          </ResponsivePanel>

          <main className="mx-auto flex min-w-0 flex-1 flex-col gap-3 overflow-y-auto p-3 sm:p-5">
            <div className="mx-auto flex w-full max-w-5xl flex-col gap-3">
              {pendingIssues.length === 0 && completedIssues.length === 0 ? (
                <section className="flex flex-col items-center gap-5 py-24 text-center">
                  <span aria-hidden="true" className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 text-primary ring-1 ring-inset ring-primary/25 [.theme-totvs:not(.dark)_&]:text-foreground">
                    <ModuleIcon module="poker" className="h-8 w-8" />
                  </span>
                  <h2 className="m-0 text-3xl font-bold tracking-tight">Nenhuma tarefa ainda</h2>
                  <p className="m-0 max-w-md text-[15px] leading-relaxed text-muted-foreground">Cada pessoa vota no seu tempo. Comece adicionando as tarefas que o time deve estimar.</p>
                  <ModalButton variant="primary" onClick={() => setIsQueueOpen(true)} className="h-11 px-6">Abrir a fila de tarefas</ModalButton>
                </section>
              ) : (
                <>
                  {pendingIssues.map(issue => {
                    const isExpanded = expandedIssues.includes(issue.id);
                    const isRevealed = revealedIssues.includes(issue.id);
                    const issueVotes = votes.filter(v => v.issueId === issue.id);
                    const myVoteValue = issueVotes.find(v => v.participantId === currentUser.id)?.value || null;
                    const summary = isRevealed ? summarizeRound(issueVotes, participants, deck, { votingCargos, tshirtEquivalents: settings?.tshirtEquivalents }) : null;

                    return (
                      <article key={issue.id} className={cn(CARD, 'overflow-hidden transition-[border-color,box-shadow] duration-slow', isExpanded && 'border-primary/40')}>
                        <button
                          type="button"
                          onClick={() => toggleExpand(issue.id)}
                          aria-expanded={isExpanded}
                          className="flex w-full flex-wrap items-center justify-between gap-4 px-5 py-4 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
                        >
                          <span className="flex min-w-0 flex-1 flex-col gap-1.5">
                            <span className="flex items-center gap-2">
                              {issue.key && <span className="text-xs font-bold tabular-nums text-primary [.theme-totvs:not(.dark)_&]:text-foreground">{issue.key}</span>}
                              <span className="truncate text-base font-semibold">{issue.title}</span>
                              {myVoteValue && !isRevealed && <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" strokeWidth={1.75} aria-label="Você já votou" />}
                            </span>
                            <span className="flex flex-wrap items-center gap-2">
                              <StatusChip tone="neutral">{issueVotes.length} {issueVotes.length === 1 ? 'voto' : 'votos'}</StatusChip>
                              {isRevealed && <StatusChip tone="success">Revelado</StatusChip>}
                              {issue.jiraLink && (
                                <a
                                  href={formatExternalUrl(issue.jiraLink)}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  onClick={(e) => e.stopPropagation()}
                                  className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
                                >
                                  <ExternalLink className="h-3 w-3" strokeWidth={1.5} /> No Jira
                                </a>
                              )}
                            </span>
                          </span>
                          <span className={cn('inline-flex h-9 items-center gap-2 rounded-lg px-4 text-sm font-semibold', isExpanded ? 'bg-primary text-primary-foreground' : 'border border-border')}>
                            {isExpanded ? 'Recolher' : 'Votar agora'}
                            <ChevronDown className={cn('h-4 w-4 transition-transform duration-base', isExpanded && 'rotate-180')} strokeWidth={1.5} />
                          </span>
                        </button>

                        {isExpanded && (
                          <div className="room-rise flex flex-col gap-6 border-t border-border bg-muted/30 p-5">
                            {!isRevealed && currentUser.role !== 'spectator' && (
                              canVote ? (
                                <section aria-label="Seu voto" className="flex flex-col gap-3">
                                  <h3 className="m-0 text-[13px] font-semibold">Escolha sua estimativa</h3>
                                  <div role="radiogroup" aria-label="Cartas" className="flex flex-wrap gap-2.5 pt-2">
                                    {deckValues.map((val) => (
                                      <DeckCard key={val} value={val} dense={isDense} selected={myVoteValue === val} onSelect={() => onAsyncVote(issue.id, val)} />
                                    ))}
                                  </div>
                                </section>
                              ) : (
                                <section className="flex flex-col items-center gap-1 rounded-xl border border-dashed border-border p-6 text-center">
                                  <p className="m-0 flex items-center gap-2 text-sm font-semibold"><Eye className="h-4 w-4" strokeWidth={1.5} /> Você acompanha como observador</p>
                                  <p className="m-0 text-xs text-muted-foreground">
                                    {currentUser.globalRole?.trim() ? `O cargo ${currentUser.globalRole.trim()} não vota nesta sala.` : 'Você está sem cargo na administração, por isso entra como observador.'}
                                  </p>
                                </section>
                              )
                            )}

                            <section aria-label="Participação do time" className="flex flex-col gap-3">
                              <h3 className="m-0 text-[13px] font-semibold">Participação do time</h3>
                              <ul className="m-0 grid list-none grid-cols-3 gap-4 p-0 sm:grid-cols-4 md:grid-cols-6">
                                {participants.filter(p => p.role !== 'spectator').map(p => {
                                  const pVote = issueVotes.find(v => v.participantId === p.id);
                                  // Revelação anônima (opt-in): mantém a carta virada mesmo revelado.
                                  const showValue = !!pVote && isRevealed && !settings?.anonymousReveal;
                                  return (
                                    <li key={p.id} className="flex min-w-0 flex-col items-center gap-2">
                                      {!canParticipantVote(p, votingCargos) ? (
                                        <VoteCard state="observer" size="md" label={`${p.nickname}, observando: ${observerHintOf(p)}`} />
                                      ) : !pVote ? (
                                        <VoteCard state="thinking" size="md" label={`${p.nickname} ainda não votou`} />
                                      ) : showValue ? (
                                        <VoteCard state="revealed" size="md" value={pVote.value} unit={deck === 'hours' ? 'h' : undefined} tone="plain" label={`${p.nickname}: ${pVote.value}`} />
                                      ) : (
                                        <VoteCard state="hidden" size="md" label={`${p.nickname} votou`} />
                                      )}
                                      <span className="w-full truncate text-center text-xs font-semibold" title={p.nickname}>{p.nickname}</span>
                                      <span className="w-full truncate text-center text-xs text-muted-foreground" title={p.globalRole?.trim() || SEM_CARGO}>{p.globalRole?.trim() || SEM_CARGO}</span>
                                    </li>
                                  );
                                })}
                              </ul>
                            </section>

                            {isRevealed && summary && (
                              <div className="grid items-start gap-4 lg:grid-cols-2">
                                <CopyEstimateCard summary={summary} deck={deck} />
                                {settings?.outlierPrompt && (
                                  <OutlierPrompt votes={issueVotes} participants={participants} deck={deck} tshirtEquivalents={settings?.tshirtEquivalents} votingCargos={votingCargos} />
                                )}
                              </div>
                            )}
                            {isRevealed && settings?.showDistribution && (
                              <VoteDistribution votes={issueVotes} participants={participants} deck={deck} votingCargos={votingCargos} />
                            )}

                            {isCurrentUserFacilitator && (
                              <div className="flex flex-wrap items-center gap-3 rounded-xl border border-border bg-card p-4">
                                {!isRevealed ? (
                                  <ModalButton variant="primary" onClick={() => onAsyncReveal(issue.id)} className="gap-2"><Eye className="h-4 w-4" strokeWidth={1.5} /> Revelar resultados</ModalButton>
                                ) : (
                                  <ModalButton onClick={() => onAsyncClear(issue.id)} className="gap-2"><RefreshCcw className="h-4 w-4" strokeWidth={1.5} /> Reiniciar rodada</ModalButton>
                                )}
                                <span className="flex-1" />
                                <CompleteAsyncIssueDialog issueId={issue.id} isRevealed={isRevealed} deck={deck} issueVotes={issueVotes} participants={participants} onCompleteIssue={onCompleteIssue} />
                              </div>
                            )}
                          </div>
                        )}
                      </article>
                    );
                  })}

                  {completedIssues.length > 0 && (
                    <section aria-label="Votações finalizadas" className="mt-6 flex flex-col gap-3">
                      <h2 className="m-0 flex items-center gap-3 text-[13px] font-semibold text-emerald-700 dark:text-emerald-300">
                        <span className="h-px flex-1 bg-emerald-500/25" /> Votações finalizadas <span className="h-px flex-1 bg-emerald-500/25" />
                      </h2>
                      <ul className="m-0 grid list-none gap-2 p-0">
                        {completedIssues.map(issue => {
                          const rp = issue.rolePoints ?? { Developer: issue.devPoints ?? '', QA: issue.qaPoints ?? '' };
                          const roles = deck === 'hours' ? Object.entries(rp).filter(([, v]) => v && v !== '0') : [];
                          return (
                            <li key={issue.id} className={cn(CARD, 'flex flex-wrap items-center justify-between gap-3 px-5 py-4')}>
                              <span className="flex min-w-0 flex-1 items-center gap-3">
                                <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-600 dark:text-emerald-400" strokeWidth={1.5} aria-hidden="true" />
                                <span className="truncate text-[15px] font-semibold text-muted-foreground line-through">{issue.title}</span>
                              </span>
                              <span className="flex items-center gap-3">
                                {roles.length > 0 && (
                                  <span className="text-xs tabular-nums text-muted-foreground">
                                    {roles.map(([role, v]) => `${formatRoleForCopy(role)} ${v}h`).join(' · ')}
                                  </span>
                                )}
                                <StatusChip tone="success" className="h-7 px-3 text-sm tabular-nums">{issue.estimatedPoints}{unit}</StatusChip>
                              </span>
                            </li>
                          );
                        })}
                      </ul>
                    </section>
                  )}
                </>
              )}
            </div>
          </main>

          <ResponsivePanel side="right" open={isParticipantsOpen} onOpenChange={setIsParticipantsOpen} title="Participantes" count={participants.length} icon={Users} widthClass="w-80">
            <ParticipantList
              participants={participants}
              votes={votes}
              currentUserId={currentUser.id}
              isFacilitator={isCurrentUserFacilitator}
              onRemoveParticipant={onRemoveParticipant}
              onUpdateParticipantRole={onUpdateParticipantRole}
              onClaimFacilitator={onClaimFacilitator}
              votingCargos={votingCargos}
            />
          </ResponsivePanel>
        </div>
      </div>

      {isCurrentUserFacilitator && (
        <CeremonySettingsDialog open={isSettingsOpen} onOpenChange={setIsSettingsOpen} onRestoreDefaults={() => onUpdateSettings?.(buildDefaultSettingsPatch())} onSaveTemplate={saveRoomTemplate.openDialog}>
          <FacilitatorPanel
            deck={deck}
            onSetDeck={onSetDeck}
            votingCargos={votingCargos}
            autoReveal={settings?.autoReveal}
            outlierPrompt={settings?.outlierPrompt}
            confidenceVote={settings?.confidenceVote}
            showVelocity={settings?.showVelocity}
            anonymousReveal={settings?.anonymousReveal}
            turnNotification={settings?.turnNotification}
            showDistribution={settings?.showDistribution}
            decisionNotes={settings?.decisionNotes}
            perTopicTime={settings?.perTopicTime !== false}
            autoTimer={settings?.autoTimer}
            groomingFlag={settings?.groomingFlag}
            autoConsensus={settings?.autoConsensus}
            suggestRevote={settings?.suggestRevote}
            reactions={settings?.reactions}
            roundingMode={settings?.roundingMode}
            blindVotes={settings?.blindVotes}
            groupVotesByRole={settings?.groupVotesByRole}
            refinementNotes={settings?.refinementNotes}
            maxHours={settings?.maxHours}
            hasVotes={votes.length > 0}
            onSaveTemplate={saveRoomTemplate.openDialog}
            templatesVersion={saveRoomTemplate.version}
            divergenceThresholds={settings?.divergenceThresholds}
            tshirtEquivalents={settings?.tshirtEquivalents}
            onUpdateSettings={onUpdateSettings || (() => {})}
            showAutoReveal={false}
            showDivergence={false}
            showRoundFeatures={false}
          />
        </CeremonySettingsDialog>
      )}
      {isCurrentUserFacilitator && saveRoomTemplate.dialog}

      <ShareRoomDialog
        isOpen={isShareDialogOpen}
        onClose={() => setIsShareDialogOpen(false)}
        roomId={roomId}
        roomTitle={roomTitle}
        issues={issuesQueue}
      />
    </>
  );
};

export const AsyncPokerRoom = React.memo(AsyncPokerRoomComponent);

function CompleteAsyncIssueDialog({ issueId, isRevealed, deck, issueVotes, participants, onCompleteIssue }: { issueId: string, isRevealed: boolean, deck: DeckType, issueVotes: Vote[], participants: Participant[], onCompleteIssue: any }) {
  const [open, setOpen] = useState(false);
  const [points, setPoints] = useState('');
  const [rolePoints, setRolePoints] = useState<Record<string, string>>({});
  const [isSuggested, setIsSuggested] = useState(false);

  const handleOpenChange = (newOpen: boolean) => {
    setOpen(newOpen);
    if (!newOpen) {
      setPoints('');
      setRolePoints({});
      setIsSuggested(false);
      return;
    }

    if (issueVotes.length === 0) return;

    const values = issueVotes.map(v => v.value);
    const uniqueValues = Array.from(new Set(values));
    let suggestedValue = '';

    if (uniqueValues.length === 1) {
      suggestedValue = uniqueValues[0];
    } else {
      if (deck === 'tshirt') {
        const counts = values.reduce((acc, val) => { acc[val] = (acc[val] || 0) + 1; return acc; }, {} as Record<string, number>);
        suggestedValue = Object.keys(counts).reduce((a, b) => counts[a] > counts[b] ? a : b);
      } else {
        const numericValues = values.map(Number).filter(n => !isNaN(n));
        if (numericValues.length > 0) {
          suggestedValue = String(Math.ceil(numericValues.reduce((a, b) => a + b, 0) / numericValues.length));
        }
      }
    }

    setPoints(suggestedValue);
    setIsSuggested(true);

    if (deck === 'hours') {
      const result = calculateRoleEfforts(issueVotes, participants, deck);
      setRolePoints(result.rolePoints);
      if (result.totalPoints !== '0') {
        setPoints(result.totalPoints);
      }
    }
  };

  const submit = () => {
    onCompleteIssue(issueId, points, rolePoints['Developer'], rolePoints['QA'], rolePoints);
    setOpen(false);
    setPoints('');
    setRolePoints({});
  };

  const fieldCls = cn(FIELD, 'h-11 text-sm font-semibold tabular-nums');
  return (
    <>
      <Button
        size="sm"
        variant="outline"
        onClick={() => handleOpenChange(true)}
        className={cn('h-9 gap-2 rounded-[10px] px-4 text-sm font-medium', isRevealed && 'border-emerald-500/40 text-emerald-700 hover:bg-emerald-500/10 dark:text-emerald-300')}
      >
        <CheckCircle2 className="h-4 w-4" strokeWidth={1.5} /> Finalizar estimativa
      </Button>
      <Modal
        open={open}
        onOpenChange={handleOpenChange}
        size="sm"
        tone="success"
        icon={CheckCircle2}
        title="Finalizar tarefa"
        description="Salve as estimativas finais deste card na fila."
        footer={
          <>
            <ModalButton onClick={() => handleOpenChange(false)}>Cancelar</ModalButton>
            <ModalButton variant="primary" onClick={submit}>Salvar na fila</ModalButton>
          </>
        }
      >
        {deck === 'hours' ? (
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <label htmlFor="async-total" className="text-[13px] font-semibold">Estimativa total (horas)</label>
              <input id="async-total" value={points} onChange={(e) => setPoints(e.target.value)} type="number" placeholder="Total de horas" className={fieldCls} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              {Object.keys(rolePoints).length > 0 ? (
                Object.keys(rolePoints).map((role) => (
                  <div key={role} className="flex flex-col gap-1.5">
                    <label htmlFor={`async-role-${role}`} className="text-xs font-semibold text-muted-foreground">{formatRoleForCopy(role)}</label>
                    <input
                      id={`async-role-${role}`}
                      value={rolePoints[role] || ''}
                      onChange={(e) => setRolePoints((prev) => ({ ...prev, [role]: e.target.value }))}
                      type="number"
                      placeholder={`${formatRoleForCopy(role)} em horas`}
                      className={fieldCls}
                    />
                  </div>
                ))
              ) : (
                <p className="col-span-2 py-4 text-center text-sm text-muted-foreground">Nenhum voto técnico detectado.</p>
              )}
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            <label htmlFor="async-final" className="text-[13px] font-semibold">Estimativa final ({deck === 'fibonacci' ? 'pontos' : 'tamanho'})</label>
            <input id="async-final" value={points} onChange={(e) => { setPoints(e.target.value); setIsSuggested(false); }} className={fieldCls} />
            {isSuggested && points && <p className="text-xs font-medium text-emerald-700 dark:text-emerald-300">Valor sugerido pelo time</p>}
          </div>
        )}
      </Modal>
    </>
  );
}
