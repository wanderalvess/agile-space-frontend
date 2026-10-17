'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { HelpCircle, Lock, Settings, Share2, Download, SearchX, ShieldAlert } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { actionPlanApi } from '../api';
import { squadApi } from '@/app/squad/api';
import { ActionPlanBoard, ActionPlanTask } from '@/lib/types';
import { EmptyState, ErrorState, LoadingSkeleton, PageHeader, PageShell } from '@/components/page';
import { IconButton, ModalButton, ShareDialog, StatusChip } from '@/components/room-kit';
import { useToast } from '@/hooks/use-toast';
import { ActionPlanBoard as ActionPlanBoardComponent, type RefreshStatus } from '@/components/action-plan/ActionPlanBoard';
import { useUserContext } from '@/context/UserContext';
import { useMyMemberships } from '@/hooks/useMyMemberships';
import { ActionPlanGuide } from '@/components/action-plan/ActionPlanGuide';
import { ExportActionPlanDialog } from '@/components/action-plan/ExportActionPlanDialog';
import { PlanOriginBanner } from '@/components/action-plan/PlanOriginBanner';
import { PlanSettingsDialog } from '@/components/action-plan/PlanSettingsDialog';
import { CeremonyApiError } from '@/lib/ceremony-api';
import { boardIsPublic, inviteText, planUrl, toPlanPeople } from '@/lib/action-plan';
import { boardOrigin } from '@/lib/action-plan-origin';
import { findMembership } from '@/lib/memberships';
import type { SquadMember } from '@/lib/types';

/** Intervalo da atualização automática das ações (o plano não tem WebSocket: sem isso só se via a edição dos outros ao recarregar). */
const POLL_MS = 15000;
/** Com que frequência o texto "Atualizado há N s" se renova. */
const CLOCK_MS = 5000;

type LoadFailure = 'notfound' | 'noaccess' | 'error';

export default function ActionPlanSessionPage() {
  const params = useParams();
  const router = useRouter();
  const { toast } = useToast();
  const { isAuthenticated, isLoading, session } = useAuth();
  const { userProfile, requestIdentity, isInitializing } = useUserContext();
  const { memberships } = useMyMemberships();

  const id = params.id as string;

  const [board, setBoard] = useState<ActionPlanBoard | null>(null);
  const [tasks, setTasks] = useState<ActionPlanTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [failure, setFailure] = useState<{ kind: LoadFailure; message: string } | null>(null);
  const [isGuideOpen, setIsGuideOpen] = useState(false);
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [isShareOpen, setIsShareOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [inviteDraft, setInviteDraft] = useState('');
  const [refresh, setRefresh] = useState<RefreshStatus>({ phase: 'idle', lastOkAt: null });
  const [now, setNow] = useState(() => Date.now());
  const [members, setMembers] = useState<SquadMember[]>([]);
  const loadSeq = useRef(0);

  // --- Auth & Identity Logic ---
  useEffect(() => {
    // isInitializing precisa estar false também, senão requestIdentity() dispara
    // à toa numa janela em que userProfile ainda não terminou de carregar do
    // UserContext (mesma causa do modal de perfil abrindo sozinho no retro).
    if (!isLoading && !isInitializing && !userProfile) {
      requestIdentity();
    }
  }, [isLoading, isInitializing, userProfile, requestIdentity]);

  const fetchBoardAndTasks = React.useCallback(async () => {
    const seq = ++loadSeq.current;
    try {
      const boardSnap = await actionPlanApi.getBoardById(id);
      const tasksData = await actionPlanApi.listTasks(id);
      if (seq !== loadSeq.current) return;
      setBoard(boardSnap);
      setTasks(tasksData);
      setFailure(null);
      setRefresh({ phase: 'idle', lastOkAt: Date.now() });
    } catch (e) {
      if (seq !== loadSeq.current) return;
      console.error("Erro ao buscar plano", e);
      // "Não existe" (404, ou 400 de ID que nem é um UUID) e "sem acesso" (403) viram estados da página, com o
      // caminho de volta; queda de rede ou erro do servidor mostram a falha com "Tentar novamente".
      if (e instanceof CeremonyApiError && (e.status === 404 || e.status === 400)) {
        setFailure({ kind: 'notfound', message: 'Este plano não existe ou foi excluído. Confira o endereço ou volte para a lista de planos da squad.' });
      } else if (e instanceof CeremonyApiError && e.status === 403) {
        setFailure({ kind: 'noaccess', message: e.message });
      } else {
        setFailure({ kind: 'error', message: 'Não foi possível carregar o plano de ação agora.' });
      }
    } finally {
      if (seq === loadSeq.current) setLoading(false);
    }
  }, [id]);

  /** Atualização das ações. A automática é silenciosa; a manual ("Tentar agora") mostra "Atualizando…". */
  const refreshTasks = React.useCallback(async (manual = false) => {
    if (manual) setRefresh((r) => ({ ...r, phase: 'loading' }));
    try {
      const tasksData = await actionPlanApi.listTasks(id);
      setTasks(tasksData);
      setRefresh({ phase: 'idle', lastOkAt: Date.now() });
    } catch (e) {
      console.warn("Falha ao atualizar as ações do plano", e);
      setRefresh((r) => ({ ...r, phase: 'error' }));
    }
  }, [id]);

  // --- Board & Tasks Data Logic ---
  useEffect(() => {
    if (!isAuthenticated || !userProfile) return;
    setLoading(true);
    fetchBoardAndTasks();
  }, [isAuthenticated, userProfile, fetchBoardAndTasks]);

  // Atualização automática: a cada 15 s com a aba visível e ao voltar para a aba.
  useEffect(() => {
    if (!isAuthenticated || !userProfile || !board) return;
    const tick = () => {
      if (!document.hidden) refreshTasks();
    };
    const timer = setInterval(tick, POLL_MS);
    document.addEventListener('visibilitychange', tick);
    return () => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', tick);
    };
  }, [isAuthenticated, userProfile, board, refreshTasks]);

  // Relógio do texto "Atualizado há N s".
  useEffect(() => {
    if (!board) return;
    const timer = setInterval(() => setNow(Date.now()), CLOCK_MS);
    return () => clearInterval(timer);
  }, [board]);

  // Pessoas da squad do plano (campo "Quem" e convites). Se não vier, o campo segue como texto livre.
  const planSquadId = board?.squadId || '';
  useEffect(() => {
    if (!planSquadId) return;
    let alive = true;
    squadApi
      .getMembers(planSquadId)
      .then((list) => alive && setMembers(list))
      .catch(() => alive && setMembers([]));
    return () => {
      alive = false;
    };
  }, [planSquadId]);

  const people = useMemo(() => (planSquadId ? toPlanPeople(members) : []), [members, planSquadId]);

  const crumbs = [{ label: 'Plano de ação', href: '/action-plan' }];

  if (loading) {
    return (
      <PageShell documentTitle="Plano de ação" width="wide">
        <PageHeader title="Plano de ação" module="action-plan" breadcrumb={[...crumbs, { label: 'Carregando' }]} />
        <LoadingSkeleton variant="table" label="Carregando o plano de ação" />
      </PageShell>
    );
  }

  if (failure && !board) {
    const back = (
      <Link
        href="/action-plan"
        className="inline-flex h-10 items-center rounded-[10px] border border-border px-4 text-sm font-medium text-foreground hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        Voltar para o Plano de ação
      </Link>
    );
    return (
      <PageShell documentTitle="Plano de ação" width="wide">
        <PageHeader
          title="Plano de ação"
          module="action-plan"
          breadcrumb={[...crumbs, { label: failure.kind === 'notfound' ? 'Não encontrado' : failure.kind === 'noaccess' ? 'Sem acesso' : 'Erro' }]}
        />
        {failure.kind === 'error' ? (
          <div className="flex flex-col items-center gap-3">
            <ErrorState
              description={failure.message}
              onRetry={() => { setLoading(true); fetchBoardAndTasks(); }}
              retryLabel="Tentar novamente"
              className="w-full"
            />
            {back}
          </div>
        ) : (
          <EmptyState
            icon={failure.kind === 'notfound' ? SearchX : ShieldAlert}
            title={failure.kind === 'notfound' ? 'Plano de ação não encontrado' : 'Sem acesso a este plano'}
            description={
              failure.kind === 'noaccess'
                ? `${failure.message} Peça a quem criou o plano para adicionar você.`
                : failure.message
            }
            actions={back}
          />
        )}
      </PageShell>
    );
  }

  if (!board) return null;

  const isPublic = boardIsPublic(board);
  const myId = userProfile?.id || session?.id;
  const isAdmin = session?.role?.toLowerCase() === 'admin' || userProfile?.role === 'admin';
  // O servidor só deixa o criador ou um administrador mexer no plano em si.
  const canManage = isAdmin || (!!myId && board.creatorId === myId);
  const url = typeof window !== 'undefined' ? planUrl(window.location.origin, board.id) : `/action-plan/${board.id}`;
  const squadName = findMembership(memberships, board.squadId)?.projectName;

  const openShare = () => {
    setInviteDraft(inviteText({ title: board.title, squadName, total: tasks.length, url }));
    setIsShareOpen(true);
  };

  return (
    <PageShell documentTitle={board.title} feedbackName="Plano de ação" width="wide" contentClassName="gap-4">
      <PageHeader
        title={board.title}
        module="action-plan"
        breadcrumb={[...crumbs, { label: board.title }]}
        badges={
          !isPublic ? (
            <StatusChip tone="warn" className="h-7 gap-1.5 px-3 text-[13px]">
              <Lock className="h-3.5 w-3.5" strokeWidth={1.5} aria-hidden="true" /> Só convidados
            </StatusChip>
          ) : undefined
        }
        actions={
          <>
            <ModalButton onClick={() => setIsGuideOpen(true)} className="gap-2" aria-label="Como usar o plano de ação">
              <HelpCircle className="h-4 w-4" strokeWidth={1.5} aria-hidden="true" /> Como usar
            </ModalButton>
            <ModalButton onClick={openShare} className="gap-2" aria-label="Compartilhar o plano">
              <Share2 className="h-4 w-4" strokeWidth={1.5} aria-hidden="true" /> Compartilhar
            </ModalButton>
            <ModalButton onClick={() => setIsExportModalOpen(true)} className="gap-2" aria-label="Exportar o plano">
              <Download className="h-4 w-4" strokeWidth={1.5} aria-hidden="true" /> Exportar
            </ModalButton>
            {canManage && (
              <IconButton label="Configurações do plano" icon={Settings} className="h-10 w-10 rounded-[10px]" onClick={() => setIsSettingsOpen(true)} />
            )}
          </>
        }
      />

      <PlanOriginBanner origin={boardOrigin(board)} />

      <ActionPlanBoardComponent
        board={board}
        tasks={tasks}
        onRefresh={() => void refreshTasks()}
        people={people}
        refreshStatus={refresh}
        onRefreshNow={() => void refreshTasks(true)}
        now={now}
      />

      <ActionPlanGuide open={isGuideOpen} onOpenChange={setIsGuideOpen} />

      <ExportActionPlanDialog
        isOpen={isExportModalOpen}
        onClose={() => setIsExportModalOpen(false)}
        boardData={board}
        tasks={tasks}
      />

      <ShareDialog
        open={isShareOpen}
        onOpenChange={setIsShareOpen}
        title="Compartilhar o plano"
        description={board.title}
        url={url}
        note={isPublic ? 'Quem receber o link e estiver logado lê e edita as ações.' : 'Plano privado: só quem foi convidado abre o link.'}
        inviteText={inviteDraft}
        onInviteTextChange={setInviteDraft}
      />

      {isSettingsOpen && canManage && (
        <PlanSettingsDialog
          open
          onOpenChange={setIsSettingsOpen}
          board={board}
          taskCount={tasks.length}
          people={people}
          myUserId={myId}
          onUpdated={setBoard}
          onDeleted={() => {
            setIsSettingsOpen(false);
            toast({ title: 'Plano apagado', description: 'O plano e as ações foram removidos.' });
            router.push('/action-plan');
          }}
        />
      )}
    </PageShell>
  );
}
