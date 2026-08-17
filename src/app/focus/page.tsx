'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Timer, Cloud, CloudDownload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { AgileSpinner } from '@/components/ui/AgileSpinner';
import { useFirebase } from '@/firebase';
import { FocusTimer } from '@/components/workspace/FocusTimer';
import { KanbanCardData } from '@/components/workspace/types';
import { ToolHubLayout } from '@/components/shared/ToolHubLayout';
import { JiraImportDialog } from '@/components/shared/JiraImportDialog';
import { JiraIssue } from '@/services/jiraService';
import { useToast } from '@/hooks/use-toast';
import { workspaceApi } from '@/app/workspace/api';
import { focusApi, FocusSessionData } from '@/app/focus/api';

export default function FocusPage() {
  const router = useRouter();
  const { user } = useFirebase();
  const { toast } = useToast();
  const [isJiraModalOpen, setIsJiraModalOpen] = useState(false);

  const [cards, setCards] = useState<KanbanCardData[]>([]);
  const [isKanbanLoading, setIsKanbanLoading] = useState(true);
  const [dbSessions, setDbSessions] = useState<FocusSessionData[]>([]);

  const loadFocusData = async () => {
    if (!user) return;
    try {
      const [cardsList, sessionsList] = await Promise.all([
        workspaceApi.getKanbanCards(user.uid),
        focusApi.getSessions(user.uid)
      ]);
      setCards(cardsList);
      setDbSessions(sessionsList);
    } catch (e) {
      console.error(e);
    } finally {
      setIsKanbanLoading(false);
    }
  };

  useEffect(() => {
    if (user) {
      loadFocusData();
    }
  }, [user]);

  const handleImportJira = async (issues: JiraIssue[]) => {
    if (!user) return;

    const mapJiraToFocusCategory = (type: string, title: string): string => {
      const t = type.toLowerCase();
      const s = title.toLowerCase();
      
      if (t.includes('bug') || t.includes('defeito') || s.includes('defeito') || s.includes('bug') || s.includes('erro') || s.includes('falha')) {
        return '🐛 Defeito';
      }
      if (t.includes('spike') || s.includes('spike') || s.includes('pesquisa') || s.includes('estudo')) {
        return '🔍 Spike';
      }
      if (s.includes('teste sistemico') || s.includes('teste') || s.includes('sistêmico') || s.includes('qa') || s.includes('validação')) {
        return '🧪 Teste Sistêmico';
      }
      if (t.includes('task') || t.includes('story') || t.includes('codificação') || s.includes('codificação') || s.includes('desenvolvimento') || s.includes('criar') || s.includes('implementar')) {
        return '💻 Codificação';
      }
      return '💻 Codificação';
    };

    try {
      let importedCount = 0;
      for (const issue of issues) {
        const category = mapJiraToFocusCategory(issue.type || '', issue.title || '');
        await workspaceApi.saveKanbanCard(user.uid, {
          id: issue.key,
          title: issue.title,
          status: 'todo',
          tag: category,
          originLink: issue.key
        });
        importedCount++;
      }
      loadFocusData();
      toast({ title: 'Sucesso', description: `${importedCount} issues importadas para sua área.` });
    } catch (e) {
      console.error('Error importing Jira', e);
      toast({ title: 'Erro', description: 'Ocorreu um erro ao importar as issues.', variant: 'destructive' });
    }
  };

  const handleSessionComplete = async (taskId: string | null, durationMinutes: number, title: string, category: string) => {
    if (!user) return;
    try {
      await focusApi.saveSession(user.uid, {
        durationMinutes,
        taskCategory: category
      });
      loadFocusData();
      toast({ title: 'Progresso Gravado', description: `${durationMinutes}m registrados com sucesso!` });
    } catch (e) {
      console.error("Error saving focus session", e);
    }
  };

  const handleClearHistory = async () => {
    // Para simplificar, o clear history de hoje não fará deleção em batch no Postgres
    // a menos que seja estritamente necessário. Podemos deixar em branco ou implementar no futuro.
    toast({ title: 'Aviso', description: 'Função simplificada na versão PostgreSQL.' });
  };

  const handleAddTask = async (title: string) => {
    if (!user) return;
    try {
      await workspaceApi.saveKanbanCard(user.uid, {
        title,
        status: 'todo',
        tag: 'Manual'
      });
      loadFocusData();
      toast({ title: 'Tarefa Adicionada', description: `A tarefa "${title}" foi criada.` });
    } catch (e) {
      console.error('Error adding manual task', e);
      toast({ title: 'Erro', description: 'Não foi possível adicionar a tarefa manual.', variant: 'destructive' });
    }
  };

  const handleDeleteTask = async (taskId: string) => {
    try {
      await workspaceApi.deleteKanbanCard(taskId);
      loadFocusData();
      toast({ title: 'Tarefa Excluída', description: 'A tarefa foi removida com sucesso.' });
    } catch (e) {
      console.error('Error deleting task', e);
      toast({ title: 'Erro', description: 'Não foi possível excluir a tarefa.', variant: 'destructive' });
    }
  };

  const handleEditTask = async (taskId: string, currentTitle: string) => {
    if (!user) return;
    const newTitle = window.prompt("Editar título da tarefa:", currentTitle);
    if (newTitle === null || !newTitle.trim()) return;
    
    try {
      await workspaceApi.saveKanbanCard(user.uid, {
        id: taskId,
        title: newTitle.trim()
      });
      loadFocusData();
      toast({ title: 'Tarefa Atualizada', description: 'O título foi alterado com sucesso.' });
    } catch (e) {
      console.error('Error editing task', e);
      toast({ title: 'Erro', description: 'Não foi possível editar a tarefa.', variant: 'destructive' });
    }
  };

  return (
    <ToolHubLayout
      title="Sala de Foco"
      description="Pomodoro integrado ao Kanban e sincronização em tempo real com o Jira para foco total na squad."
      icon={<Timer className="h-5 w-5" />}
      themeColor="rose"
      tips={[]}
      onlyChildren={true}
      badge={
        <div className="flex items-center gap-1.5 text-[8px] font-black text-slate-400 uppercase tracking-[0.2em] leading-none ml-2 bg-slate-100 px-2 py-1 rounded-md">
          <Cloud className="h-2.5 w-2.5 text-emerald-500 animate-pulse" />
          <span className="hidden sm:inline">Espaço Ágil</span>
        </div>
      }
      actions={
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            onClick={() => setIsJiraModalOpen(true)}
            className="hidden md:flex h-8 px-3 rounded-full border-indigo-200 text-indigo-600 bg-indigo-50 hover:bg-indigo-100 text-[9px] font-black uppercase tracking-widest gap-2 transition-all"
          >
            <CloudDownload className="h-3.5 w-3.5" />
            Importar Jira
          </Button>
          <div className="flex items-center gap-2 px-3 h-8 rounded-full bg-slate-50 border border-slate-100 text-[9px] font-black uppercase tracking-widest text-rose-500 border-rose-500/20 shadow-sm transition-all duration-500">
             {isKanbanLoading ? <AgileSpinner size="sm" /> : <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]" />}
             {isKanbanLoading ? "Sincronizando..." : <span className="hidden sm:inline">Sincronizado</span>}
          </div>
        </div>
      }
    >
      <main className="flex-1 flex flex-col overflow-hidden w-full px-4 pb-4 md:px-8 md:pb-8">
        <FocusTimer
          tasks={cards || []}
          dbSessions={dbSessions || []}
          onSessionComplete={handleSessionComplete} 
          onAddTask={handleAddTask} 
          onDeleteTask={handleDeleteTask}
          onEditTask={handleEditTask}
          onClearHistory={handleClearHistory}
        />
      </main>

      <JiraImportDialog
        open={isJiraModalOpen}
        onClose={() => setIsJiraModalOpen(false)}
        onImport={handleImportJira}
        title="Importar para Foco"
        description="Selecione as issues do Jira que você deseja trabalhar. Elas serão salvas no seu Kanban e ficarão disponíveis para o Pomodoro."
      />
    </ToolHubLayout>
  );
}
