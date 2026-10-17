'use client';

import React, { useState, useEffect, useCallback, useMemo, use } from 'react';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { AlertTriangle, Flag, Loader2, RefreshCw, RotateCcw } from 'lucide-react';
import { ConfirmDialog, IconTile, ModalButton, ShareDialog } from '@/components/room-kit';
import { useAuth } from '@/context/AuthContext';
import { useUserContext } from '@/context/UserContext';
import { useActiveSquad } from '@/hooks/useActiveSquad';
import { useMyMemberships } from '@/hooks/useMyMemberships';
import { useToast } from '@/hooks/use-toast';
import { copyToClipboard } from '@/lib/copy-to-clipboard';
import { JiraIssue } from '@/services/jiraService';

import { ShowcaseSession, ShowcaseTask, Decision } from '@/components/showcase/types';
import { FeedbackWidget } from '@/components/feedback-widget';
import { JiraImportDialog } from '@/components/shared/JiraImportDialog';
import { TeatroMode } from '@/components/showcase/TeatroMode';
import { SessionSettingsDialog } from '@/components/showcase/SessionSettingsDialog';
import { SummaryDialog } from '@/components/showcase/SummaryDialog';
import { PrintSlidesView } from '@/components/showcase/PrintSlidesView';
import { ShowcaseTour, TOUR_STORAGE_KEY } from '@/components/showcase/ShowcaseTour';
import { ReviewRoomBar } from '@/components/showcase/ReviewRoomBar';
import { ReviewPrepBar } from '@/components/showcase/ReviewPrepBar';
import { ReviewCardsView } from '@/components/showcase/ReviewCardsView';
import { ReviewEmptyRoom } from '@/components/showcase/ReviewEmptyRoom';
import { ReviewGuide } from '@/components/showcase/ReviewGuide';
import { ReviewConflictBar } from '@/components/showcase/ReviewConflictBar';
import { PresenterChip } from '@/components/showcase/PresenterChip';
import { isOtherPresenter } from '@/components/showcase/presenter-sync';
import { useShowcasePresenter } from '@/components/showcase/useShowcasePresenter';
import { ReviewExportDialog } from '@/components/showcase/ReviewExportDialog';
import { useShowcaseRoom } from '@/components/showcase/useShowcaseRoom';
import {
  EMPTY_FILTERS,
  FINISHED_STATUS,
  PRESENTING_STATUS,
  REOPENED_STATUS,
  buildInviteText,
  canDecide as canDecideInReview,
  cleanRoomUrl,
  clearAllFilters,
  clearFilterChip,
  effortTotals,
  filterTasks,
  isReviewSort,
  normalizeReviewStatus,
  openDecisionCount,
  readinessOf,
  sortTasks,
  squadLabel,
  squadOptions,
  type ReviewFilters,
  type ReviewSort,
} from '@/components/showcase/review-room-logic';
import { squadApi } from '@/app/squad/api';
import { openOrCreateRetro } from '@/lib/sprintCycleNav';

// ─────────────────────────────────────────────
// Sala da Review
// ─────────────────────────────────────────────
export default function ShowcaseRoomPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { session: authSession } = useAuth();
  const { userProfile } = useUserContext();
  const { squadId: activeSquadId, squadName: activeSquadName } = useActiveSquad();
  const { memberships, stale: staleMemberships } = useMyMemberships();
  const { toast } = useToast();

  const room = useShowcaseRoom(id);
  const { session, loading, loadError, connection, onlineIds, saveState, persist, updateTask, addTasks, addManualTask, removeTask, uploadTaskFile, deleteTaskFile, reload, retryLoad, conflicts, resolveConflict, lastFailure, presenter, setPresenter } = room;

  const [isPresenting, setIsPresenting] = useState(false);
  // Acompanhando o apresentador: o card do Teatro segue o dele (ligado pelo chip "Acompanhar").
  const [following, setFollowing] = useState(false);
  const presenterCtl = useShowcasePresenter({ sessionId: id, meId: authSession?.id, presenter, setPresenter });
  const [currentIndex, setCurrentIndexState] = useState(-1);
  const [isJiraOpen, setIsJiraOpen] = useState(false);
  const [isSummaryOpen, setIsSummaryOpen] = useState(false);
  const [isExportOpen, setIsExportOpen] = useState(false);
  const [isGuideOpen, setIsGuideOpen] = useState(false);
  const [isTourOpen, setIsTourOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isShareOpen, setIsShareOpen] = useState(false);
  const [finishAsk, setFinishAsk] = useState(false);
  const [reopenAsk, setReopenAsk] = useState(false);
  const [inviteDraft, setInviteDraft] = useState<string | null>(null);
  const [feedbackSignal, setFeedbackSignal] = useState<number | undefined>();
  // Evita reabrir o aviso a cada clique em "Apresentar" nesta visita: a primeira vez avisa; se a pessoa ignorar
  // e clicar de novo, apresenta.
  const [presentWarningShown, setPresentWarningShown] = useState(false);
  const [settingsWarningActive, setSettingsWarningActive] = useState(false);
  // Sprint ativa da squad (id do Jira) para a predefinição "Review da sprint atual" do Importar do Jira.
  const [jiraSprint, setJiraSprint] = useState<{ squad: string; sprintId?: string } | null>(null);

  const [filters, setFilters] = useState<ReviewFilters>(EMPTY_FILTERS);
  const [sortBy, setSortBy] = useState<ReviewSort>('key');

  const isMounted = React.useRef(false);
  const timeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const orderedTasksRef = React.useRef<ShowcaseTask[]>([]);
  // O slide em foco é lembrado pelo id do card: a lista muda sob os pés (outra pessoa adiciona, remove ou
  // reordena) e o índice sozinho passaria a apontar para outro card.
  const currentTaskIdRef = React.useRef<string | null>(null);

  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  const followingRef = React.useRef(false);
  followingRef.current = following;

  const goToIndex = useCallback((i: number) => {
    setCurrentIndexState(i);
    currentTaskIdRef.current = i >= 0 ? orderedTasksRef.current[i]?.id ?? null : null;
  }, []);

  const baseSort: ReviewSort = isReviewSort(session?.defaultSort) ? session!.defaultSort! : 'key';
  useEffect(() => {
    if (isReviewSort(session?.defaultSort)) setSortBy(session!.defaultSort!);
  }, [session?.defaultSort, session]);

  useEffect(() => {
    const moduleName = 'Review';
    const baseTitle = 'Portal Tech V&D';
    const sessionName = session?.sprintName || session?.name;
    document.title = sessionName ? `${sessionName} | ${moduleName} | ${baseTitle}` : `${moduleName} | ${baseTitle}`;
  }, [session?.sprintName, session?.name]);

  const status = normalizeReviewStatus(session?.status, session?.updatedAt);
  const tasks = useMemo(() => session?.tasks ?? [], [session?.tasks]);

  // Quem registra veredito e feedback: a mesma regra do servidor (administrador, liderança da squad, PO/SME por vínculo;
  // Review sem squad: administrador e criador). Sem dados de vínculos, o cargo do perfil, como antes.
  const canDecide = useMemo(
    () => canDecideInReview({
      role: userProfile?.role,
      isAdmin: userProfile?.role === 'admin',
      memberships: memberships ?? staleMemberships,
      squadId: session?.squadName,
      isCreator: !!authSession?.id && !!session?.createdBy && session.createdBy === authSession.id,
    }),
    [userProfile?.role, memberships, staleMemberships, session?.squadName, session?.createdBy, authSession?.id]
  );

  const squadOpts = useMemo(
    () => squadOptions(memberships?.memberships, { squadId: activeSquadId, squadName: activeSquadName }, session?.squadName),
    [memberships, activeSquadId, activeSquadName, session?.squadName]
  );

  // Sprint ativa da squad, lida só quando o Importar do Jira abre (falha em silêncio: a predefinição cai em "sprints abertas").
  useEffect(() => {
    const squad = session?.squadName?.trim();
    if (!isJiraOpen || !squad || jiraSprint?.squad === squad) return;
    let cancelled = false;
    squadApi.getSquad(squad)
      .then((s) => { if (!cancelled) setJiraSprint({ squad, sprintId: s?.activeSprintId || undefined }); })
      .catch(() => { if (!cancelled) setJiraSprint({ squad }); });
    return () => { cancelled = true; };
  }, [isJiraOpen, session?.squadName, jiraSprint?.squad]);

  // ── Nome e cópia do link ─────────────────────────────────────────────────────
  const rename = useCallback((name: string) => {
    if (name.trim() && name !== session?.name) void persist({ name });
  }, [persist, session?.name]);

  const copyLink = useCallback(async () => {
    const url = cleanRoomUrl(window.location.href);
    const ok = await copyToClipboard(url);
    if (ok) {
      toast({ title: 'Link copiado!', description: 'Compartilhe com sua squad para prepararem a sessão juntos.' });
    } else {
      toast({ title: 'Não foi possível copiar o link', description: url, variant: 'destructive' });
    }
  }, [toast]);

  const handleOpenRetro = async () => {
    const firstTaskKey = session?.tasks?.[0]?.key;
    const issueProjectKey = firstTaskKey?.includes('-') ? firstTaskKey.split('-')[0].toUpperCase() : '';
    const squadId = session?.squadName || issueProjectKey || activeSquadId;
    if (!squadId) {
      toast({ title: 'Squad não identificada', description: 'Não foi possível resolver a squad desta Review.', variant: 'destructive' });
      return;
    }
    try {
      const squad = await squadApi.getSquad(squadId);
      const sprintId = squad?.activeSprintId;
      if (!sprintId) {
        toast({ title: 'Sem sprint ativa', description: 'Essa squad não tem sprint ativa configurada.', variant: 'destructive' });
        return;
      }
      openOrCreateRetro(router, sprintId, squadId);
    } catch (err) {
      console.error('[Showcase] Falha ao resolver sprint ativa da squad:', err);
      toast({ title: 'Erro', description: 'Não foi possível abrir a retrospectiva.', variant: 'destructive' });
    }
  };

  // Primeira vez da pessoa nesta Review com cards: o tour abre sozinho, sem exigir que alguém procure um botão de ajuda.
  useEffect(() => {
    if (loading || tasks.length === 0) return;
    try {
      if (localStorage.getItem(TOUR_STORAGE_KEY)) return;
    } catch { return; }
    const t = setTimeout(() => setIsTourOpen(true), 600);
    return () => clearTimeout(t);
  }, [loading, tasks.length]);

  // Review recém-criada (?setup=1, posto pela tela de criação): abre a configuração de cara em vez de deixá-la
  // escondida atrás do ícone, porque sem isso ninguém preenchia objetivos, capa e squad antes de apresentar.
  useEffect(() => {
    if (searchParams.get('setup') === '1') {
      setIsSettingsOpen(true);
      router.replace(pathname, { scroll: false });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ?resumo=1 (hub: "Ver resumo" de uma Review finalizada): abre o resumo assim que a Review carrega.
  const [resumoHandled, setResumoHandled] = useState(false);
  useEffect(() => {
    if (resumoHandled || loading || !session) return;
    if (searchParams.get('resumo') !== '1') return;
    setResumoHandled(true);
    setIsSummaryOpen(true);
    router.replace(pathname, { scroll: false });
  }, [resumoHandled, loading, session, searchParams, router, pathname]);

  // ── Lista: ordem, busca e filtros ───────────────────────────────────────────
  // Ordem da lista e da apresentação (chave em ordem natural: PROJ-2 antes de PROJ-10).
  const orderedTasks = useMemo(() => sortTasks(tasks, sortBy), [tasks, sortBy]);
  orderedTasksRef.current = orderedTasks;
  const filteredTasks = useMemo(() => filterTasks(orderedTasks, filters), [orderedTasks, filters]);

  // Se o card em foco mudou de posição (ou saiu da Review) enquanto se apresenta, o slide o acompanha.
  useEffect(() => {
    if (!isPresenting || currentIndex < 0) return;
    const wantedId = currentTaskIdRef.current;
    if (!wantedId || orderedTasks[currentIndex]?.id === wantedId) return;
    const movedTo = orderedTasks.findIndex((t) => t.id === wantedId);
    if (movedTo >= 0) {
      setCurrentIndexState(movedTo);
      return;
    }
    const clamped = Math.min(currentIndex, orderedTasks.length - 1);
    setCurrentIndexState(clamped);
    currentTaskIdRef.current = clamped >= 0 ? orderedTasks[clamped].id : null;
    toast({ title: 'O card em foco saiu da Review', description: 'Mostrando o card que ocupa o lugar dele.' });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderedTasks, isPresenting, currentIndex]);

  const isFiltered = filteredTasks.length !== tasks.length;
  const readiness = useMemo(() => readinessOf(filteredTasks), [filteredTasks]);
  const effort = useMemo(() => effortTotals(tasks), [tasks]);

  const clearAll = () => {
    const cleared = clearAllFilters(baseSort);
    setFilters(cleared.filters);
    setSortBy(cleared.sortBy);
  };
  const removeChip = (chip: Parameters<typeof clearFilterChip>[2]) => {
    const next = clearFilterChip(filters, sortBy, chip, baseSort);
    setFilters(next.filters);
    setSortBy(next.sortBy);
  };

  // ── Apresentar e finalizar ──────────────────────────────────────────────────
  const beginPresenting = useCallback((opts: { follower?: boolean } = {}) => {
    setIsPresenting(true);
    goToIndex(-1);
    // Apresentar grava "Ao vivo": é o que o servidor e a Home entendem como em andamento. Sair sem finalizar deixa assim.
    // Quem só entra para acompanhar não grava nada: a Review já está ao vivo.
    if (status !== 'finished' && !opts.follower) void persist({ status: PRESENTING_STATUS });
  }, [goToIndex, persist, status]);

  // Fechou o Teatro (ou finalizou): para de acompanhar e, se eu apresentava, encerra a apresentação.
  const stopPresenter = presenterCtl.stop;
  useEffect(() => {
    if (isPresenting) return;
    setFollowing(false);
    stopPresenter();
  }, [isPresenting, stopPresenter]);

  const followFromRoom = () => {
    setFollowing(true);
    void presenterCtl.refresh();
    beginPresenting({ follower: true });
  };
  const toggleFollowing = (on: boolean) => {
    setFollowing(on);
    if (on) void presenterCtl.refresh();
  };

  const startPresenting = () => {
    // A capa já nasce com a imagem padrão: o aviso cobra só os objetivos.
    const missingSetup = !session?.description?.trim();
    if (missingSetup && !presentWarningShown) {
      setPresentWarningShown(true);
      setSettingsWarningActive(true);
      setIsSettingsOpen(true);
      return;
    }
    beginPresenting();
  };

  const handleDecision = async (taskId: string, decision: Decision, feedback = '') => {
    const now = new Date().toISOString();
    const ok = await updateTask(taskId, {
      decision,
      feedback,
      approvedAt: decision === 'approved' ? now : undefined,
      decidedAt: now,
      decidedBy: authSession?.id || '',
      decidedByName: userProfile?.name || authSession?.name || authSession?.email || '',
    });
    if (!ok) {
      // Não avança: quem apresenta precisa saber que a decisão não foi gravada. Restrição e conflito a sala já explicou.
      const explained = lastFailure();
      if (explained !== 'restricted' && explained !== 'conflict') {
        toast({ title: 'A decisão não foi gravada', description: 'Confira a conexão e decida de novo neste card.', variant: 'destructive' });
      }
      return;
    }
    const decidedIndex = orderedTasksRef.current.findIndex((t) => t.id === taskId);
    if (decidedIndex >= 0 && decidedIndex < orderedTasksRef.current.length - 1) {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      timeoutRef.current = setTimeout(() => {
        // Só avança se a pessoa não navegou para outro card nesse meio-tempo. Quem acompanha o apresentador
        // não avança sozinho: quem apresenta é quem muda de card.
        if (isMounted.current && currentTaskIdRef.current === taskId && !followingRef.current) goToIndex(decidedIndex + 1);
      }, 600);
    }
  };

  const confirmFinish = () => {
    setIsPresenting(false);
    void persist({ status: FINISHED_STATUS });
    setIsSummaryOpen(true);
  };

  const confirmReopen = () => {
    void persist({ status: REOPENED_STATUS });
    toast({ title: 'Review reaberta', description: 'Ela voltou para "Em preparação". As decisões já registradas ficaram como estão.' });
  };

  // Imprimir slides: o PrintSlidesView já está na página e só aparece no @media print. Fecha as janelas e dá um
  // respiro para o navegador pintar antes de abrir a impressão.
  const printSlides = () => {
    setIsSummaryOpen(false);
    setIsExportOpen(false);
    setTimeout(() => window.print(), 250);
  };

  const openFeedback = () => setFeedbackSignal(Date.now());

  // ── Estados da página ───────────────────────────────────────────────────────
  if (loading) return (
    <div className="flex min-h-dvh flex-1 items-center justify-center bg-background p-6 text-foreground">
      <div role="status" aria-label="Carregando a Review" className="flex flex-col items-center gap-4 text-muted-foreground">
        <Loader2 className="h-10 w-10 motion-safe:animate-spin" strokeWidth={1.5} aria-hidden="true" />
        <p className="m-0 text-[15px] font-semibold">Carregando a Review…</p>
      </div>
    </div>
  );

  if (!session) return (
    <div className="flex min-h-dvh flex-1 items-center justify-center bg-background p-6 text-foreground">
      <div className="flex max-w-md flex-col items-center gap-3 text-center">
        <IconTile icon={AlertTriangle} tone="warn" size="lg" className="h-14 w-14 rounded-2xl" />
        <h2 className="m-0 text-[22px] font-bold">
          {loadError === 'notfound' ? 'Review não encontrada' : 'Não foi possível carregar a Review'}
        </h2>
        <p className="m-0 text-sm leading-relaxed text-muted-foreground">
          {loadError === 'notfound'
            ? 'O link pode estar incompleto ou a Review foi removida. Confira o endereço ou volte para a lista.'
            : 'Houve um problema de conexão com o servidor. Tente de novo em instantes.'}
        </p>
        <div className="mt-1 flex flex-wrap items-center justify-center gap-2">
          {loadError !== 'notfound' && (
            <ModalButton variant="primary" className="gap-2" onClick={retryLoad}>
              <RefreshCw className="h-4 w-4" strokeWidth={1.5} aria-hidden="true" /> Tentar de novo
            </ModalButton>
          )}
          <ModalButton onClick={() => router.push('/showcase')}>Voltar para as Reviews</ModalButton>
        </div>
      </div>
    </div>
  );

  const openDecisions = openDecisionCount(tasks);
  const shareUrl = typeof window !== 'undefined' ? cleanRoomUrl(window.location.href) : '';
  const inviteText = inviteDraft ?? buildInviteText({ name: session.name, squadName: squadLabel(session.squadName, squadOpts), cardCount: tasks.length, url: shareUrl });

  // O contêiner raiz não é posicionado de propósito: o PrintSlidesView usa position:absolute e, sem um
  // ancestral posicionado ou com overflow, imprime todas as páginas em vez de ser cortado na altura da janela.
  return (
    <div className="flex h-dvh w-full flex-col overflow-hidden bg-background text-foreground">
      {!isPresenting && (
        <ReviewRoomBar
          session={session}
          status={status}
          squadLabel={squadLabel(session.squadName, squadOpts)}
          presenting={isPresenting}
          onRename={rename}
          onStartPresenting={startPresenting}
          onShare={() => { setInviteDraft(null); setIsShareOpen(true); }}
          onSettings={() => { setSettingsWarningActive(false); setIsSettingsOpen(true); }}
          onGuide={() => setIsGuideOpen(true)}
          onOpenRetro={handleOpenRetro}
          onOpenSummary={() => setIsSummaryOpen(true)}
          onPrint={printSlides}
          onReopen={status === 'finished' ? () => setReopenAsk(true) : undefined}
          onOpenFeedback={openFeedback}
        />
      )}

      {!isPresenting && isOtherPresenter(presenter, authSession?.id) && status !== 'finished' && (
        <div className="flex shrink-0 px-3 pt-3 sm:px-4 xl:px-6">
          <PresenterChip presenter={presenter} following={false} onToggle={followFromRoom} />
        </div>
      )}
      {!isPresenting && <ReviewConflictBar conflicts={conflicts} onResolve={(conflictId, action) => { void resolveConflict(conflictId, action); }} />}

      <main id="conteudo" className="flex min-h-0 flex-1 flex-col overflow-y-auto scroll-smooth">
        {tasks.length === 0 ? (
          <ReviewEmptyRoom onOpenJira={() => setIsJiraOpen(true)} onAddManualTask={addManualTask} />
        ) : (
          <>
            <ReviewPrepBar
              readiness={readiness}
              isFiltered={isFiltered}
              sessionTotal={tasks.length}
              effort={effort}
              connection={connection}
              onlineCount={onlineIds ? onlineIds.size : null}
              saveState={saveState}
              onToggleTaskStatus={(taskId, markAsDone) => { void updateTask(taskId, { preparationStatus: markAsDone ? 'done' : 'todo' }); }}
              onAddManualTask={addManualTask}
              onOpenJira={() => setIsJiraOpen(true)}
              onRetrySave={reload}
            />
            <ReviewCardsView
              allTasks={tasks}
              filteredTasks={filteredTasks}
              filters={filters}
              sortBy={sortBy}
              baseSort={baseSort}
              onFiltersChange={setFilters}
              onSortChange={setSortBy}
              onClearAll={clearAll}
              onRemoveChip={removeChip}
              members={session.members || []}
              onUpdateTask={updateTask}
              onRemoveTask={removeTask}
              sessionId={session.id}
              onUploadFile={uploadTaskFile}
              onDeleteFile={deleteTaskFile}
              canDecide={canDecide}
            />
          </>
        )}
      </main>

      <PrintSlidesView session={{ ...session, tasks: orderedTasks }} />

      {isPresenting && (
        <TeatroMode
          session={{ ...session, tasks: orderedTasks }}
          currentIndex={currentIndex}
          sortBy={sortBy}
          onIndexChange={goToIndex}
          onDecision={handleDecision}
          onClose={() => setIsPresenting(false)}
          onFinish={() => setFinishAsk(true)}
          keysDisabled={finishAsk}
          canDecide={canDecide}
          presenter={presenter}
          meId={authSession?.id}
          following={following}
          onFollowingChange={toggleFollowing}
          onPublishPresenter={presenterCtl.publish}
        />
      )}

      <JiraImportDialog
        open={isJiraOpen}
        onClose={() => setIsJiraOpen(false)}
        onImport={(issues: JiraIssue[]) => { void addTasks(issues); }}
        existingKeys={tasks.map((t) => t.key)}
        squadKey={session.squadName || undefined}
        sprintId={jiraSprint?.squad === session.squadName?.trim() ? jiraSprint?.sprintId : undefined}
        squadJql={session.squadName?.trim() ? { squadId: session.squadName.trim(), label: squadLabel(session.squadName, squadOpts) } : undefined}
      />

      <SessionSettingsDialog
        open={isSettingsOpen}
        onClose={() => { setSettingsWarningActive(false); setIsSettingsOpen(false); }}
        session={session}
        onUpdate={(updates: Partial<ShowcaseSession>) => { void persist(updates); }}
        presentWarning={settingsWarningActive}
        taskCount={tasks.length}
        onOpenJira={() => setIsJiraOpen(true)}
        onAddManualTask={addManualTask}
        onCopyLink={copyLink}
        onPresentAnyway={() => {
          setSettingsWarningActive(false);
          setIsSettingsOpen(false);
          beginPresenting();
        }}
      />

      <SummaryDialog
        open={isSummaryOpen}
        onClose={() => setIsSummaryOpen(false)}
        tasks={tasks}
        sessionName={session.name || ''}
        session={session}
        onExport={() => setIsExportOpen(true)}
        onPrint={printSlides}
      />

      <ReviewExportDialog
        open={isExportOpen}
        onOpenChange={setIsExportOpen}
        session={session}
        tasks={tasks}
        sessionName={session.name || ''}
        onPrint={printSlides}
      />

      <ShareDialog
        open={isShareOpen}
        onOpenChange={setIsShareOpen}
        title="Compartilhar a Review"
        description="Link, QR code e convite com a pauta."
        url={shareUrl}
        note="Quem receber o link e estiver logado entra e edita. Não há bloqueio por squad, por decisão de produto."
        inviteText={inviteText}
        onInviteTextChange={setInviteDraft}
      />

      <ReviewGuide open={isGuideOpen} onOpenChange={setIsGuideOpen} onRedoTour={() => setIsTourOpen(true)} />

      <ShowcaseTour open={isTourOpen} onClose={() => setIsTourOpen(false)} />

      <ConfirmDialog
        open={finishAsk}
        onOpenChange={setFinishAsk}
        tone="warn"
        icon={openDecisions > 0 ? AlertTriangle : Flag}
        title={openDecisions > 0 ? 'Finalizar a Review com cards sem decisão?' : 'Finalizar a Review?'}
        description={
          openDecisions > 0
            ? `Ainda há ${openDecisions} ${openDecisions === 1 ? 'card sem decisão' : 'cards sem decisão'}. Finalizar marca a Review como finalizada e abre o resumo.`
            : 'Finalizar marca a Review como finalizada e abre o resumo. Você pode reabri-la depois pelo menu Mais.'
        }
        cancelLabel="Continuar apresentando"
        confirmLabel={openDecisions > 0 ? 'Finalizar mesmo assim' : 'Finalizar'}
        onConfirm={confirmFinish}
      />

      <FeedbackWidget toolName={`Review: ${session.name || 'Review'}`} triggerVariant="none" externalTriggerSignal={feedbackSignal} />

      <ConfirmDialog
        open={reopenAsk}
        onOpenChange={setReopenAsk}
        tone="warn"
        icon={RotateCcw}
        title="Reabrir a Review?"
        description={'A Review volta para "Em preparação" e a apresentação pode recomeçar. As decisões já registradas ficam como estão.'}
        confirmLabel="Reabrir"
        onConfirm={confirmReopen}
      />
    </div>
  );
}
