'use client';

import React, { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { actionPlanApi } from '../api';
import { ActionPlanBoard, ActionPlanTask } from '@/lib/types';
import { RoomHeader } from '@/components/layout/RoomHeader';
import { useToast } from '@/hooks/use-toast';
import { ActionPlanBoard as ActionPlanBoardComponent } from '@/components/action-plan/ActionPlanBoard';
import { Loader2, Share2, HelpCircle, Download } from 'lucide-react';
import { useUserContext } from '@/context/UserContext';
import { ActionPlanGuide } from '@/components/action-plan/ActionPlanGuide';
import { ExportActionPlanDialog } from '@/components/action-plan/ExportActionPlanDialog';

export default function ActionPlanSessionPage() {
  const params = useParams();
  const router = useRouter();
  const { toast } = useToast();
  const { isAuthenticated, isLoading } = useAuth();
  const { userProfile, requestIdentity } = useUserContext();

  const id = params.id as string;

  const [board, setBoard] = useState<ActionPlanBoard | null>(null);
  const [tasks, setTasks] = useState<ActionPlanTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [isGuideOpen, setIsGuideOpen] = useState(false);
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);

  // --- Auth & Identity Logic ---
  useEffect(() => {
    if (!isLoading && !userProfile) {
      requestIdentity();
    }
  }, [isLoading, userProfile, requestIdentity]);

  const fetchBoardAndTasks = React.useCallback(async () => {
    try {
      const boardSnap = await actionPlanApi.getBoardById(id);
      setBoard(boardSnap);
      
      const tasksData = await actionPlanApi.listTasks(id);
      setTasks(tasksData);
    } catch (e) {
      console.error("Erro ao buscar plano", e);
      toast({
        title: "Plano não encontrado",
        description: "Este plano de ação não existe ou foi excluído.",
        variant: "destructive"
      });
      router.push('/action-plan');
    } finally {
      setLoading(false);
    }
  }, [id, router, toast]);

  // --- Board & Tasks Data Logic ---
  useEffect(() => {
    if (!isAuthenticated || !userProfile) return;
    fetchBoardAndTasks();
  }, [isAuthenticated, userProfile, fetchBoardAndTasks]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#fafafa] flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-fuchsia-500" />
      </div>
    );
  }

  const handleCopyLink = () => {
    navigator.clipboard.writeText(window.location.href);
    toast({
      title: "Link Copiado!",
      description: "Você pode compartilhar o link deste plano de ação com sua equipe.",
    });
  };

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
            >
              <HelpCircle className="h-4 w-4" />
            </button>
            <button
              onClick={handleCopyLink}
              className="flex items-center justify-center h-8 w-8 text-slate-400 hover:text-fuchsia-600 hover:bg-fuchsia-50 rounded-xl transition-all"
              title="Compartilhar Sessão"
            >
              <Share2 className="h-4 w-4" />
            </button>
            <button
              onClick={() => setIsExportModalOpen(true)}
              className="flex items-center justify-center h-8 px-3 text-[10px] font-black uppercase tracking-widest text-white bg-fuchsia-500 hover:bg-fuchsia-600 rounded-xl shadow-sm transition-all ml-1"
              title="Exportar"
            >
              <Download className="h-3 w-3 mr-1.5" />
              <span className="hidden sm:inline">Exportar</span>
            </button>
          </div>
        }
      />

      <div className="flex-1 relative overflow-hidden">
         <ActionPlanBoardComponent board={board} tasks={tasks} onRefresh={fetchBoardAndTasks} />
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
