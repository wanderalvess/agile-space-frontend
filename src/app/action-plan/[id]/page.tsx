'use client';

import React, { useEffect, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { actionPlanApi } from '../api';
import { ActionPlanBoard, ActionPlanTask } from '@/lib/types';
import { RoomHeader } from '@/components/layout/RoomHeader';
import { useToast } from '@/hooks/use-toast';
import { ActionPlanBoard as ActionPlanBoardComponent } from '@/components/action-plan/ActionPlanBoard';
import { Loader2, Share2, HelpCircle, Download } from 'lucide-react';
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

  if (loading) {
    return (
      <div className="min-h-screen bg-[#fafafa] flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-fuchsia-500" />
      </div>
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
      <div className="min-h-screen bg-[#fafafa] flex flex-col items-center justify-center gap-4 text-center px-6">
        <p className="text-sm font-bold text-slate-600">{loadError}</p>
        <Button onClick={() => { setLoading(true); fetchBoardAndTasks(); }} className="bg-fuchsia-500 hover:bg-fuchsia-600 text-white font-black uppercase text-xs tracking-widest rounded-xl">
          Tentar novamente
        </Button>
      </div>
    );
  }

  if (!board) return null;

  return (
    <div className="flex flex-col flex-1 w-full h-full min-h-[calc(100vh-80px)] overflow-hidden bg-[#fafafa]">
      {/* FLAG (requer follow-up fora do escopo permitido): RoomHeader (src/components/layout/RoomHeader.tsx)
          NÃO aceita as props team/participantIds/themeColor/onLeave que esta página passava — elas já
          eram ignoradas em runtime. Para satisfazer o type-check preservando o comportamento atual,
          passamos apenas as props aceitas. toolIcon é obrigatório; undefined mantém o render atual
          (sem ícone, cor padrão). Restaurar botão de sair / time / tema exige editar RoomHeader ou
          redesenhar esta página. */}
      <RoomHeader
        title={board.title}
        toolIcon={undefined}
        actions={
          <div className="flex items-center gap-1">
            <button
              onClick={() => setIsGuideOpen(true)}
              className="flex items-center justify-center h-8 w-8 text-slate-400 hover:text-amber-500 hover:bg-amber-50 rounded-xl transition-all"
              title="Como Usar"
              aria-label="Como usar o plano de ação"
            >
              <HelpCircle className="h-4 w-4" />
            </button>
            <button
              onClick={handleCopyLink}
              className="flex items-center justify-center h-8 w-8 text-slate-400 hover:text-fuchsia-600 hover:bg-fuchsia-50 rounded-xl transition-all"
              title="Compartilhar Sessão"
              aria-label="Copiar link do plano"
            >
              <Share2 className="h-4 w-4" />
            </button>
            <Button
              onClick={() => setIsExportModalOpen(true)}
              className="h-8 px-3 text-[10px] font-black uppercase tracking-widest text-white bg-fuchsia-500 hover:bg-fuchsia-600 rounded-xl shadow-sm ml-1"
              title="Exportar"
            >
              <Download className="h-3 w-3 mr-1.5" />
              <span className="hidden sm:inline">Exportar</span>
            </Button>
          </div>
        }
      />

      <div className="flex-1 relative overflow-hidden">
         <ActionPlanBoardComponent board={board} tasks={tasks} onRefresh={refreshTasks} />
      </div>

      <ActionPlanGuide open={isGuideOpen} onOpenChange={setIsGuideOpen} />

      <ExportActionPlanDialog
        isOpen={isExportModalOpen}
        onClose={() => setIsExportModalOpen(false)}
        boardData={board}
        tasks={tasks}
      />
    </div>
  );
}
