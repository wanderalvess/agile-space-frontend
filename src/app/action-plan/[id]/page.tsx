'use client';

import React, { useEffect, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { actionPlanApi } from '../api';
import { ActionPlanBoard, ActionPlanTask } from '@/lib/types';
import { ErrorState, LoadingSkeleton, PageHeader, PageShell } from '@/components/page';
import { useToast } from '@/hooks/use-toast';
import { ActionPlanBoard as ActionPlanBoardComponent } from '@/components/action-plan/ActionPlanBoard';
import { Share2, HelpCircle, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useUserContext } from '@/context/UserContext';
import { ActionPlanGuide } from '@/components/action-plan/ActionPlanGuide';
import { ExportActionPlanDialog } from '@/components/action-plan/ExportActionPlanDialog';
import { CeremonyApiError } from '@/lib/ceremony-api';
import { copyToClipboard } from '@/lib/copy-to-clipboard';

/** Intervalo da atualização automática das ações (o plano não tem WebSocket: sem isso só se via a edição dos outros ao recarregar). */
const POLL_MS = 15000;

export default function ActionPlanSessionPage() {
  const params = useParams();
  const router = useRouter();
  const { toast } = useToast();
  const { isAuthenticated, isLoading } = useAuth();
  const { userProfile, requestIdentity, isInitializing } = useUserContext();

  const id = params.id as string;

  const [board, setBoard] = useState<ActionPlanBoard | null>(null);
  const [tasks, setTasks] = useState<ActionPlanTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isGuideOpen, setIsGuideOpen] = useState(false);
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
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
      setLoadError(null);
    } catch (e) {
      if (seq !== loadSeq.current) return;
      console.error("Erro ao buscar plano", e);
      // Só "não existe" e "sem acesso" mandam de volta ao início; queda de rede ou erro do servidor
      // mostram a falha na tela com opção de tentar de novo (antes qualquer erro virava "Plano não encontrado").
      if (e instanceof CeremonyApiError && (e.status === 404 || e.status === 403)) {
        toast({
          title: e.status === 404 ? "Plano não encontrado" : "Sem acesso a este plano",
          description: e.status === 404 ? "Este plano de ação não existe ou foi excluído." : e.message,
          variant: "destructive"
        });
        router.push('/action-plan');
        return;
      }
      setLoadError("Não foi possível carregar o plano de ação agora.");
    } finally {
      if (seq === loadSeq.current) setLoading(false);
    }
  }, [id, router, toast]);

  /** Atualização silenciosa só das ações; erro de rede aqui não atrapalha quem está editando. */
  const refreshTasks = React.useCallback(async () => {
    try {
      const tasksData = await actionPlanApi.listTasks(id);
      setTasks(tasksData);
    } catch (e) {
      console.warn("Falha ao atualizar as ações do plano", e);
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

  const crumbs = [{ label: 'Plano de ação', href: '/action-plan' }];

  if (loading) {
    return (
      <PageShell documentTitle="Plano de ação" width="wide">
        <PageHeader title="Plano de ação" module="action-plan" breadcrumb={[...crumbs, { label: 'Carregando' }]} />
        <LoadingSkeleton variant="table" label="Carregando o plano de ação" />
      </PageShell>
    );
  }

  const handleCopyLink = async () => {
    const ok = await copyToClipboard(window.location.href);
    toast(ok
      ? { title: "Link copiado!", description: "Você pode compartilhar o link deste plano de ação com sua equipe." }
      : { title: "Não foi possível copiar o link", variant: "destructive" });
  };

  if (loadError && !board) {
    return (
      <PageShell documentTitle="Plano de ação" width="wide">
        <PageHeader title="Plano de ação" module="action-plan" breadcrumb={[...crumbs, { label: 'Erro' }]} />
        <ErrorState
          description={loadError}
          onRetry={() => { setLoading(true); fetchBoardAndTasks(); }}
          retryLabel="Tentar novamente"
        />
      </PageShell>
    );
  }

  if (!board) return null;

  return (
    <PageShell documentTitle={board.title} feedbackName="Plano de ação" width="wide" contentClassName="gap-4">
      <PageHeader
        title={board.title}
        module="action-plan"
        breadcrumb={[...crumbs, { label: board.title }]}
        actions={
          <>
            <Button variant="outline" size="sm" onClick={() => setIsGuideOpen(true)} className="h-9 gap-1.5 rounded-xl text-xs font-semibold" aria-label="Como usar o plano de ação">
              <HelpCircle className="h-4 w-4" strokeWidth={1.5} /> Como usar
            </Button>
            <Button variant="outline" size="sm" onClick={handleCopyLink} className="h-9 gap-1.5 rounded-xl text-xs font-semibold" aria-label="Copiar link do plano">
              <Share2 className="h-4 w-4" strokeWidth={1.5} /> Compartilhar
            </Button>
            <Button size="sm" onClick={() => setIsExportModalOpen(true)} className="h-9 gap-1.5 rounded-xl text-xs font-semibold" title="Exportar">
              <Download className="h-4 w-4" strokeWidth={1.5} /> Exportar
            </Button>
          </>
        }
      />

      <div className="relative h-[max(36rem,calc(100dvh-14rem))] overflow-hidden rounded-2xl border border-border bg-background">
         <ActionPlanBoardComponent board={board} tasks={tasks} onRefresh={refreshTasks} />
      </div>

      <ActionPlanGuide open={isGuideOpen} onOpenChange={setIsGuideOpen} />

      <ExportActionPlanDialog
        isOpen={isExportModalOpen}
        onClose={() => setIsExportModalOpen(false)}
        boardData={board}
        tasks={tasks}
      />
    </PageShell>
  );
}
