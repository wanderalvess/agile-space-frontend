'use client';

import React, { useState } from 'react';
import type { DeckType, Issue, Participant, Role, Vote, Room } from '@/lib/types';
import { calculateRoleEfforts, canParticipantVote } from '@/lib/poker-utils';
import { VoteDistribution } from './VoteDistribution';
import { OutlierPrompt } from './OutlierPrompt';
import { DECKS } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Logo } from '@/components/Logo';
import { ExportDialog } from './ExportDialog';
import { ParticipantList } from './ParticipantList';
import { FacilitatorPanel } from './FacilitatorPanel';
import { 
  ArrowLeft, Copy, Eye, Play, StopCircle, RefreshCcw, 
  HelpCircle, MoreVertical, Plus, CheckCircle2, ListChecks,
  LayoutGrid, PanelLeftClose, Users, Rocket, Sparkles
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { formatExternalUrl, cn } from '@/lib/utils';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription, DialogTrigger } from "@/components/ui/dialog";
import { TopicQueue } from './TopicQueue';
import { RoomHeader } from '@/components/layout/RoomHeader';
import { ShareRoomDialog } from './ShareRoomDialog';


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
  onBulkAddIssues: (items: Partial<Issue>[]) => void;
  onDeleteIssue: (id: string) => void;
  onCompleteIssue: (issueId: string, points: string, devPoints?: string, qaPoints?: string, rolePoints?: Record<string, string>) => void;
  onLeaveRoom: () => void;
  isSoundEnabled: boolean;
  onSetIsSoundEnabled: (enabled: boolean) => void;
  onClaimFacilitator?: () => void;
  settings?: Room['settings'];
  onUpdateSettings?: (settings: Partial<NonNullable<Room['settings']>>) => void;
  onOpenFeedback: () => void;
  creatorId: string;
}

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
  onSetDeck,
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
  onLeaveRoom,
  isSoundEnabled,
  onSetIsSoundEnabled,
  onClaimFacilitator,
  settings,
  onUpdateSettings,
  onOpenFeedback,
  creatorId
}: AsyncPokerRoomProps) => {
  const { toast } = useToast();
  const [expandedIssues, setExpandedIssues] = useState<string[]>([]);
  const [isQueueOpen, setIsQueueOpen] = useState(false);
  const [isParticipantsOpen, setIsParticipantsOpen] = useState(false);
  const deckValues = DECKS[deck];

  // Mesmo gate de room/[id]/page.tsx e Controls.tsx (poker-utils.canParticipantVote) —
  // a lista local antiga (MANAGEMENT_ROLES) divergia da centralizada, deixando o botão
  // de voto habilitado pra papéis (ex: People Lead) que o write-path já bloqueava.
  const canVote = canParticipantVote(currentUser, settings?.allowManagementToVote);

  const [isShareDialogOpen, setIsShareDialogOpen] = useState(false);

  const handleCopyLink = () => {
    setIsShareDialogOpen(true);
  };


  const toggleExpand = (id: string) => {
    setExpandedIssues(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
  };

  const pendingIssues = issuesQueue.filter(i => i.status !== 'completed');
  const completedIssues = issuesQueue.filter(i => i.status === 'completed');

  return (
    <>
      <div className="flex h-screen w-full bg-[#f8fafc] overflow-hidden font-sans">
      {/* BARRA LATERAL ESQUERDA: TAREFAS */}
      <aside
        className={cn(
          "hidden lg:flex flex-col border-r border-slate-200/60 shadow-sm bg-white/80 backdrop-blur-xl transition-all duration-500 ease-in-out overflow-hidden relative",
          isQueueOpen ? "w-80 opacity-100" : "w-0 opacity-0 border-none"
        )}
      >
        <div className="w-80 flex flex-col h-full shrink-0">
          <header className='p-6 border-b border-slate-100 shrink-0 flex items-center justify-between bg-white/50'>
            <div className="flex items-center gap-3">
              <div className="p-2 bg-indigo-50 rounded-xl">
                <ListChecks className="h-4 w-4 text-indigo-600" />
              </div>
              <div>
                <h2 className="text-[10px] font-black tracking-[0.2em] uppercase text-slate-400 leading-none mb-1">Backlog</h2>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold text-slate-800 italic">Fila de Tarefas</span>
                  <span className="bg-indigo-600 text-white text-[9px] font-black px-2 py-0.5 rounded-full">{issuesQueue.length}</span>
                </div>
              </div>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setIsQueueOpen(false)}
              className="h-8 w-8 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-[0.8rem]"
            >
              <PanelLeftClose className="h-4.5 w-4.5" />
            </Button>
          </header>
          <div className='p-0 flex-1 flex flex-col min-h-0'>
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
          </div>
        </div>
      </aside>

      <div className="flex flex-col flex-1 min-w-0 transition-all duration-300">
        <div className="p-3 sm:p-5 pb-0 flex-1 flex flex-col h-full max-w-6xl mx-auto w-full">
          {/* Room Header Unified */}
          <div className="mb-4 delay-100 animate-in fade-in slide-in-from-top-4 duration-500">
            <RoomHeader 
              title={roomTitle || "Scrum Poker Assíncrono"} 
              toolIcon={<Rocket className="h-4 w-4" />}
              toolColorClass="text-indigo-600"
              onOpenFeedback={onOpenFeedback}
              badge={<Badge variant="outline" className="text-[8px] font-black uppercase tracking-[0.2em] bg-indigo-50 text-indigo-600 border-indigo-100 px-3 py-1 rounded-full shadow-sm">ASSÍNCRONO</Badge>}
              actions={
                <div className="flex items-center gap-2">
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    onClick={() => setIsQueueOpen(!isQueueOpen)} 
                    className={cn("h-10 w-10 rounded-[1rem] transition-all", isQueueOpen ? "text-indigo-600 bg-indigo-50 shadow-sm shadow-indigo-200/20" : "text-slate-400 hover:bg-slate-50")}
                    title="Fila de Tarefas"
                  >
                    <ListChecks className="h-5 w-5" />
                  </Button>

                  <Button 
                    variant="ghost" 
                    size="icon" 
                    onClick={() => setIsParticipantsOpen(!isParticipantsOpen)} 
                    className={cn("h-10 w-10 rounded-[1rem] transition-all", isParticipantsOpen ? "text-violet-600 bg-violet-50 shadow-sm shadow-violet-200/20" : "text-slate-400 hover:bg-slate-50")}
                    title="Time Ativo"
                  >
                    <Users className="h-5 w-5" />
                  </Button>
                  
                  <div className="w-px h-5 bg-slate-200 mx-1" />

                  <ExportDialog 
                    roomTitle={roomTitle || "Scrum Poker Assíncrono"}
                    roomTeam={roomTeam}
                    issues={issuesQueue}
                    participants={participants}
                    deck={deck}
                  />

                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={handleCopyLink} 
                    className="h-10 px-5 text-[10px] font-black uppercase tracking-[0.2em] border-slate-200 text-slate-600 hover:bg-white hover:border-indigo-200 hover:text-indigo-600 bg-white rounded-[1rem] gap-2 transition-all active:scale-95 shadow-sm"
                  >
                    <Copy className="h-3.5 w-3.5" />
                    COPIAR LINK
                  </Button>
                </div>
              }
            />
          </div>

          <div className="flex-1 overflow-y-auto pr-3 pb-20 space-y-4 custom-scrollbar">
             {/* Feed de Tarefas */}
             {pendingIssues.length === 0 && completedIssues.length === 0 ? (
               <div className="flex flex-col items-center justify-center py-32 text-center space-y-10 animate-in fade-in zoom-in-95 duration-700">
                  <div className="w-32 h-32 bg-indigo-500/10 rounded-[3rem] flex items-center justify-center text-indigo-600 shadow-inner relative group">
                    <Rocket className="w-16 h-16 group-hover:-translate-y-2 transition-transform duration-500" />
                    <Sparkles className="absolute -top-2 -right-2 h-8 w-8 text-indigo-400 opacity-50 animate-pulse" />
                  </div>
                  <div className="max-w-md space-y-4">
                    <h2 className="text-4xl font-black italic tracking-tighter uppercase text-slate-900 leading-none">Vazio & Planejado.</h2>
                    <p className="text-slate-500 text-base font-medium leading-relaxed">
                      Este é o ambiente assíncrono. Comece adicionando as tarefas que o time deve estimar no seu próprio tempo.
                    </p>
                  </div>
                  <Button 
                    size="lg"
                    onClick={() => setIsQueueOpen(true)}
                    className="bg-indigo-600 hover:bg-indigo-700 text-white font-black uppercase tracking-widest px-10 h-14 rounded-[1.2rem] shadow-2xl shadow-indigo-600/30 transition-all active:scale-95"
                  >
                    Abrir Fila de Tarefas
                  </Button>
               </div>
             ) : (
               <>
                 {pendingIssues.map(issue => {
                   const isExpanded = expandedIssues.includes(issue.id);
                   const isRevealed = revealedIssues.includes(issue.id);
                   const issueVotes = votes.filter(v => v.issueId === issue.id);
                   const myVoteObj = issueVotes.find(v => v.participantId === currentUser.id);
                   const myVoteValue = myVoteObj?.value || null;

                   return (
                     <Card key={issue.id} className={`overflow-hidden transition-all duration-500 border rounded-[2rem] ${isExpanded ? 'border-indigo-500/30 bg-white shadow-[0_32px_64px_-16px_rgba(79,70,229,0.15)] ring-1 ring-indigo-500/10' : 'border-slate-100 hover:border-indigo-500/20 bg-white hover:shadow-[0_20px_40px_-15px_rgba(0,0,0,0.05)]'}`}>
                       <div className="p-5 sm:p-7 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6 cursor-pointer group" onClick={() => toggleExpand(issue.id)}>
                          <div className="flex flex-col gap-1.5 flex-1 min-w-0">
                            <div className="flex items-center gap-3">
                              <h3 className="font-bold text-lg text-slate-800 leading-tight tracking-tight truncate group-hover:text-indigo-600 transition-colors italic">{issue.title}</h3>
                              {myVoteValue && !isRevealed && <CheckCircle2 className="h-5 w-5 text-emerald-500 drop-shadow-[0_0_8px_rgba(16,185,129,0.4)]" />}
                            </div>
                            {issue.jiraLink && (
                              <a href={formatExternalUrl(issue.jiraLink)} target="_blank" rel="noopener noreferrer" className="text-[11px] font-black uppercase tracking-widest text-indigo-400 hover:text-indigo-600 inline-flex items-center gap-1.5 w-fit" onClick={(e) => e.stopPropagation()}>
                                <Plus className="h-3 w-3 rotate-45" /> {issue.jiraLink}
                              </a>
                            )}
                            <div className="flex items-center gap-3 mt-3">
                              <Badge variant="outline" className="text-[9px] uppercase tracking-[0.2em] font-black text-slate-400 bg-slate-50 border-slate-100 px-3 py-1">
                                {issueVotes.length} {issueVotes.length === 1 ? 'voto' : 'votos'}
                              </Badge>
                              {isRevealed && (
                                <Badge variant="outline" className="text-[9px] uppercase tracking-[0.2em] font-black text-white bg-red-500 border-none px-3 py-1 shadow-lg shadow-red-500/20">
                                  REVELADO
                                </Badge>
                              )}
                            </div>
                          </div>
                          <div className="shrink-0 flex items-center gap-3">
                             <div className={cn("px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-[0.2em] transition-all", isExpanded ? "bg-indigo-600 text-white" : "bg-slate-50 text-slate-400 group-hover:bg-indigo-50 group-hover:text-indigo-600")}>
                               {isExpanded ? 'Recolher' : 'Votar Agora'}
                             </div>
                          </div>
                       </div>

                       {/* Área Expandida (Cartas e Resultados) */}
                       {isExpanded && (
                         <div className="border-t border-slate-100 bg-[#fbfdff] p-5 sm:p-8 animate-in slide-in-from-top-2 duration-300">
                            
                            {/* Se não for espectador e a votação não estiver encerrada/revelada, mostra seu deck */}
                            {!isRevealed && currentUser.role !== 'spectator' && (
                              <div className="mb-10">
                                {!canVote ? (
                                  <div className="p-8 bg-indigo-50/50 border border-dashed border-indigo-200 rounded-3xl text-center space-y-3">
                                    <p className="text-[11px] font-black uppercase tracking-[0.2em] text-indigo-500 leading-tight">
                                      👁️ Modo Observador Ativo
                                    </p>
                                    <p className="text-xs font-medium text-slate-400 italic leading-snug max-w-sm mx-auto">
                                      Você é o facilitador e não está participando desta votação. (Altere isso no Painel de Controle)
                                    </p>
                                  </div>
                                ) : (
                                  <>
                                    <div className="flex items-center gap-3 mb-5">
                                      <div className="w-1 h-3.5 bg-indigo-500 rounded-full"></div>
                                      <h4 className="text-[10px] uppercase font-black tracking-[0.2em] text-slate-400">Escolha sua Estimativa</h4>
                                    </div>
                                    <div className="flex flex-wrap gap-3">
                                      {deckValues.map((val) => {
                                        const isSelected = myVoteValue === val;
                                        return (
                                          <button 
                                            key={val}
                                            onClick={(e) => { e.stopPropagation(); onAsyncVote(issue.id, val); }}
                                            className={cn(
                                              "h-16 w-14 sm:h-20 sm:w-16 rounded-2xl font-black text-xl transition-all relative overflow-hidden italic",
                                              isSelected 
                                                ? 'bg-indigo-600 text-white shadow-xl shadow-indigo-600/30 ring-2 ring-indigo-400 ring-offset-2' 
                                                : 'bg-white text-slate-700 border border-slate-200 hover:border-indigo-400 hover:text-indigo-600 hover:shadow-md'
                                            )}
                                          >
                                            {val}
                                            {isSelected && (
                                              <Sparkles className="absolute top-1 right-1 h-3 w-3 text-indigo-300 opacity-60" />
                                            )}
                                          </button>
                                        );
                                      })}
                                    </div>
                                  </>
                                )}
                              </div>
                            )}

                            {/* Lista de Votos Renderizados */}
                            <div className="space-y-5 mb-8">
                              <div className="flex items-center gap-3">
                                <div className="w-1 h-3.5 bg-violet-500 rounded-full"></div>
                                <h4 className="text-[10px] uppercase font-black tracking-[0.2em] text-slate-400">Participação do Time</h4>
                              </div>
                              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
                                {participants.filter(p => !p.role || p.role !== 'spectator').map(p => {
                                  const pVote = issueVotes.find(v => v.participantId === p.id);
                                  const hasVoted = !!pVote;
                                  let displayContent = '-';
                                  if (pVote) {
                                    // Revelação anônima (opt-in): mantém o "✓" mesmo revelado,
                                    // escondendo quem votou o quê (a distribuição fica acima).
                                    displayContent = (isRevealed && !settings?.anonymousReveal) ? pVote.value : '✓';
                                  }

                                  return (
                                    <div key={p.id} className={cn(
                                      "flex flex-col items-center justify-center p-4 rounded-[1.8rem] border transition-all",
                                      hasVoted ? 'bg-white border-indigo-200 shadow-sm' : 'bg-slate-50 border-slate-100 opacity-60'
                                    )}>
                                      <div className={cn(
                                        "text-2xl font-black mb-1 italic",
                                        isRevealed && hasVoted ? 'text-indigo-600' : hasVoted ? 'text-emerald-500' : 'text-slate-300'
                                      )}>
                                        {displayContent}
                                      </div>
                                      <span className="text-[10px] font-black uppercase tracking-widest text-slate-500 truncate w-full text-center px-2">{p.nickname}</span>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>

                            {/* Insights de revelação (paridade com o síncrono, opt-in) */}
                            {isRevealed && (settings?.showDistribution || settings?.outlierPrompt) && (
                              <div className="space-y-3 mb-4">
                                {settings?.showDistribution && (
                                  <VoteDistribution votes={issueVotes} participants={participants} deck={deck} allowManagementToVote={settings?.allowManagementToVote} />
                                )}
                                {settings?.outlierPrompt && (
                                  <OutlierPrompt votes={issueVotes} participants={participants} deck={deck} tshirtEquivalents={settings?.tshirtEquivalents} />
                                )}
                              </div>
                            )}

                            {/* Facilitator Controls for this Issue */}
                            {isCurrentUserFacilitator && (
                              <div className="flex flex-wrap items-center gap-4 p-6 bg-white border border-slate-100 rounded-[2rem] shadow-sm">
                                 {!isRevealed ? (
                                   <Button size="lg" onClick={() => onAsyncReveal(issue.id)} className="h-12 px-8 font-black text-[11px] uppercase tracking-widest bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl shadow-lg shadow-indigo-600/30">
                                     <Eye className="h-4 w-4 mr-2" /> Revelar Resultados
                                   </Button>
                                 ) : (
                                   <Button size="lg" onClick={() => onAsyncClear(issue.id)} variant="outline" className="h-12 px-8 font-black text-[11px] uppercase tracking-widest rounded-xl border-2 border-slate-100 text-slate-400 hover:bg-red-50 hover:text-red-500 hover:border-red-200 transition-all">
                                     <RefreshCcw className="h-4 w-4 mr-2" /> Reiniciar Rodada
                                   </Button>
                                 )}
                                 <div className="flex-1" />
                                 <CompleteAsyncIssueDialog issueId={issue.id} isRevealed={isRevealed} deck={deck} issueVotes={issueVotes} participants={participants} onCompleteIssue={onCompleteIssue} />
                              </div>
                            )}
                         </div>
                       )}
                     </Card>
                   );
                 })}

                 {completedIssues.length > 0 && (
                   <div className="mt-16 animate-in fade-in slide-in-from-bottom-4 duration-1000">
                      <div className="flex items-center gap-4 mb-8">
                        <div className="h-px flex-1 bg-emerald-500/20"></div>
                        <h2 className="text-[11px] font-black uppercase tracking-[0.4em] text-emerald-500 italic">Votações Finalizadas</h2>
                        <div className="h-px flex-1 bg-emerald-500/20"></div>
                      </div>
                      <div className="grid gap-3">
                        {completedIssues.map(issue => (
                          <div key={issue.id} className="group flex flex-col sm:flex-row items-start sm:items-center justify-between p-6 bg-white border border-emerald-100 rounded-[2rem] hover:shadow-lg hover:shadow-emerald-500/5 transition-all">
                            <div className="flex items-center gap-4 flex-1 min-w-0">
                              <div className="h-10 w-10 rounded-xl bg-emerald-50 flex items-center justify-center text-emerald-500">
                                <CheckCircle2 className="h-5 w-5" />
                              </div>
                              <p className="font-bold text-base text-slate-800 italic opacity-60 line-through truncate">{issue.title}</p>
                            </div>
                            <div className="flex items-center gap-6 mt-4 sm:mt-0">
                               {deck === 'hours' && (issue.devPoints || issue.qaPoints) && (
                                  <div className="flex items-center gap-4 text-[10px] font-black uppercase text-emerald-600/50 tracking-widest italic">
                                    {issue.devPoints && <span>Dev: {issue.devPoints}h</span>}
                                    {issue.qaPoints && <span>QA: {issue.qaPoints}h</span>}
                                  </div>
                               )}
                               <div className="flex flex-col items-end">
                                 <span className="text-[8px] font-black uppercase tracking-widest text-emerald-400 mb-1">CONCORDADO</span>
                                 <span className="inline-flex items-center justify-center px-6 py-2 bg-emerald-500 text-white font-black text-sm rounded-xl uppercase tracking-widest shadow-lg shadow-emerald-500/20 italic">
                                   {issue.estimatedPoints} {deck === 'hours' ? 'H' : deck === 'tshirt' ? '' : 'SP'}
                                 </span>
                               </div>
                            </div>
                          </div>
                        ))}
                      </div>
                   </div>
                 )}
               </>
             )}
          </div>
        </div>
      </div>

      {/* SIDEBAR DIREITA: TIME */}
      <div className={cn(
        "hidden lg:flex flex-col bg-white border-l border-slate-200/60 transition-all duration-500 ease-in-out overflow-hidden relative z-10",
        isParticipantsOpen ? "w-88 opacity-100 shadow-2xl" : "w-0 opacity-0 border-none"
      )}>
        <div className="w-88 flex flex-col h-full shrink-0">
        <header className='p-6 border-b border-slate-100 shrink-0 flex items-center justify-between bg-[#fbfdff]'>
          <div className="flex items-center gap-3">
            <div className="p-2 bg-violet-50 rounded-xl">
              <Users className="h-4 w-4 text-violet-600" />
            </div>
            <div>
              <h2 className="text-[10px] font-black tracking-[0.2em] uppercase text-slate-400 leading-none mb-1">Squad</h2>
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold text-slate-800 italic">Time Ativo</span>
                <span className="bg-violet-600 text-white text-[9px] font-black px-2 py-0.5 rounded-full">{participants.length}</span>
              </div>
            </div>
          </div>
        </header>
        
        {isCurrentUserFacilitator && (
          <div className="p-4 border-b border-slate-100 shrink-0 bg-slate-50/50">
            <FacilitatorPanel
               deck={deck}
               allowManagementToVote={settings?.allowManagementToVote}
               onUpdateSettings={onUpdateSettings || (() => {})}
               showAutoReveal={false}
               showDivergence={false}
               showRoundFeatures={false}
               isEmbeddedInSheet={true}
            />
          </div>
        )}
        
        <div className="flex-1 flex flex-col min-h-0 overflow-y-auto custom-scrollbar">
          <ParticipantList
              participants={participants}
              votes={votes}
              currentUserId={currentUser.id}
              isFacilitator={isCurrentUserFacilitator}
              onRemoveParticipant={onRemoveParticipant}
              onUpdateParticipantRole={onUpdateParticipantRole}
              onClaimFacilitator={onClaimFacilitator}
          />
        </div>
      </div>
    </div>
    </div>
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

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline" className={`h-9 px-6 font-black text-[10px] uppercase tracking-widest rounded-xl border-2 ${isRevealed ? 'text-emerald-500 hover:bg-emerald-500/10 hover:border-emerald-500/30' : ''}`}>
           <CheckCircle2 className="h-3.5 w-3.5 mr-2" /> Finalizar Estimativa
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px] border border-white/20 shadow-[0_8px_30px_rgb(0,0,0,0.2)] bg-card/60 backdrop-blur-3xl rounded-[2.5rem] overflow-hidden p-0">
        <DialogHeader className="p-8 pb-4">
          <DialogTitle className="text-2xl font-black uppercase tracking-tighter italic text-indigo-500">Finalizar Tarefa</DialogTitle>
          <DialogDescription className="font-semibold text-xs text-muted-foreground/80">
            Consolide e salve as estimativas finais deste card na fila.
          </DialogDescription>
        </DialogHeader>
        <div className="px-8 py-4 space-y-4">
           {deck === 'hours' ? (
             <div className="space-y-4">
               <div>
                  <label className="text-[10px] font-black uppercase tracking-widest text-indigo-400 ml-1 mb-1.5 block">Estimativa Total (Horas)</label>
                  <input value={points} onChange={(e) => setPoints(e.target.value)} type="number" placeholder="Total horas" className="flex h-12 w-full rounded-2xl border-2 border-indigo-500/20 bg-background/50 px-4 py-2 text-sm font-black shadow-inner focus-visible:outline-none focus-visible:border-indigo-500 transition-colors" />
               </div>
               <div className="grid grid-cols-2 gap-4">
                 {Object.keys(rolePoints).length > 0 ? (
                   Object.keys(rolePoints).map(role => (
                     <div key={role} className="space-y-1.5">
                       <label className="text-[9px] font-black uppercase tracking-tight text-slate-400 ml-1 block">{role}</label>
                       <input 
                         value={rolePoints[role] || ''} 
                         onChange={(e) => setRolePoints(prev => ({...prev, [role]: e.target.value}))} 
                         type="number" 
                         placeholder={`${role} h`} 
                         className="flex h-12 w-full rounded-2xl border border-input bg-background/50 px-4 py-2 text-sm font-black shadow-inner focus-visible:outline-none focus-visible:border-indigo-500 transition-colors" 
                       />
                     </div>
                   ))
                 ) : (
                   <p className="col-span-2 text-center text-[10px] font-black text-slate-400 uppercase py-4">Nenhum voto técnico detectado</p>
                 )}
               </div>
             </div>
           ) : (
             <div>
               <input value={points} onChange={(e) => {setPoints(e.target.value); setIsSuggested(false);}} placeholder={`Estimativa final (${deck === 'fibonacci' ? 'Pontos' : 'Tamanho'})`} className="flex h-14 w-full rounded-2xl border-2 border-indigo-500/20 bg-background/50 px-4 py-2 text-base font-black shadow-inner focus-visible:outline-none focus-visible:border-indigo-500 transition-colors" />
               {isSuggested && points && <p className="text-[10px] mt-2 ml-1 font-black uppercase tracking-widest text-emerald-500">✓ Valor sugerido pelo time</p>}
             </div>
           )}
        </div>
        <DialogFooter className="p-8 pt-4">
          <Button onClick={submit} className="w-full h-14 font-black uppercase tracking-widest text-xs rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white shadow-lg shadow-indigo-600/30 transition-all active:scale-[0.98]">
            Salvar & Fila de Concluídos
          </Button>
        </DialogFooter>
      </DialogContent>
      </Dialog>
  );
}
