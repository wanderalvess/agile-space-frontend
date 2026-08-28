'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { 
  Lightbulb, 
  Zap, 
  Target, 
  Users, 
  AlertCircle,
  BrainCircuit,
  Sparkles,
  ArrowRight as ArrowRightIcon,
  Network,
  BarChart3,
  ListTodo
} from 'lucide-react';
import { brainstormingApi } from './api';
import { useToast } from '@/hooks/use-toast';
import { useUserContext } from '@/context/UserContext';
import { ToolHubLayout } from '@/components/shared/ToolHubLayout';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';

const ROOMS_META_KEY = 'agileSpace_rooms_meta';

export default function BrainstormingHubPage() {
  const router = useRouter();
  const { toast } = useToast();
  const { userProfile, requestIdentity } = useUserContext();

  const [isSetupOpen, setIsSetupOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [title, setTitle] = useState('');
  const [team, setTeam] = useState('');

  // Preenche o squad com o time do usuário assim que o perfil carregar (chega
  // async) — só enquanto o campo estiver vazio, para não sobrescrever uma edição manual.
  useEffect(() => {
    if (team) return;
    const userTeam = userProfile?.squadId || userProfile?.team;
    if (userTeam) setTeam(userTeam);
  }, [userProfile, team]);

  const saveRoomMeta = (id: string, type: string, title: string, team: string) => {
    try {
      const saved = localStorage.getItem(ROOMS_META_KEY);
      const rooms = saved ? JSON.parse(saved) : [];
      const newMeta = {
        roomId: id,
        type,
        title,
        team,
        createdBy: userProfile?.id,
        createdAt: new Date().toISOString()
      };
      localStorage.setItem(ROOMS_META_KEY, JSON.stringify([...rooms, newMeta]));
    } catch (e) {
      console.error("Erro ao salvar metadados da sala", e);
    }
  };

  const handleCreate = async () => {
    if (isCreating) return;

    if (!userProfile || !userProfile.id) {
      console.error("[brainstorming] Criar sala abortado: usuário sem ID.");
      toast({
        title: "Perfil Não Identificado",
        description: "Não foi possível carregar a sua identidade.",
        variant: "destructive"
      });
      return;
    }

    if (!title.trim()) {
      toast({
        title: "Título Obrigatório",
        description: "Dê um nome ao seu brainstorming antes de iniciar.",
        variant: "destructive"
      });
      return;
    }

    setIsCreating(true);

    const newBoard = {
      creatorId: userProfile.id,
      title: title.trim(),
      team: team.trim() || 'Squad Geral',
      createdAt: new Date().toISOString(),
      phase: 'ideation' as const,
      settings: { isAnonymous: false },
      timer: { status: 'stopped' as const, endTime: null, initialDuration: 600, remainingOnPause: 600 },
      participantIds: [userProfile.id]
    };

    try {
      const created = await brainstormingApi.saveOrUpdateBoard(newBoard);
      if (created && created.id) {
        saveRoomMeta(created.id, 'brainstorming', title.trim(), team.trim() || 'Squad');
        setIsSetupOpen(false);
        router.push(`/brainstorming/${created.id}`);
      } else {
        setIsCreating(false);
      }
    } catch (error) {
      console.error("Error creating brainstorming board: ", error);
      setIsCreating(false);
      toast({
        title: "Erro na Criação",
        description: "Não foi possível iniciar o brainstorming no momento.",
        variant: "destructive"
      });
    }
  };


  const tips = [
    {
      title: "Zero Julgamento",
      description: "Na fase de ideação, nenhuma ideia é ruim. O foco é volume e criatividade pura, sem críticas prematuras.",
      icon: <BrainCircuit className="text-amber-500" />
    },
    {
      title: "Construa sobre Outros",
      description: "Use as ideias dos colegas como trampolim. 'Sim, e...' é muio mais poderoso do que 'Não, mas...'.",
      icon: <Target className="text-amber-500" />
    },
    {
      title: "Foco em Quantidade",
      description: "Quanto mais ideias gerarmos, maior a chance de encontrarmos uma solução disruptiva e inovadora.",
      icon: <Zap className="text-amber-500" />
    }
  ];

  const referenceSections = [
    {
      title: "1. Ideação (Individual)",
      label: "Modo Mural",
      description: "O time escreve ideias de forma anônima. Ninguém vê o que o outro escreveu até a revelação. Isso evita que ideias tímidas sejam perdidas.",
      icon: <BrainCircuit />
    },
    {
      title: "2. Clusterização (Agrupamento)",
      label: "Organização",
      description: "Arraste uma ideia sobre a outra para criar 'Clusters'. O objetivo é reduzir a repetição e encontrar grandes temas estratégicos.",
      icon: <Network />
    },
    {
      title: "3. Votação (Voz do Time)",
      label: "Decisão",
      description: "Cada participante possui 5 votos para distribuir livremente entre ideias ou agrupamentos. A democracia aplicada à estratégia.",
      icon: <Target />
    },
    {
      title: "4. Matriz ROI (Prioridade)",
      label: "Estratégia",
      description: "O facilitador posiciona as ideias mais votadas no gráfico de Impacto vs Esforço. Priorizamos o que dá 'Rápido Retorno'.",
      icon: <BarChart3 />
    },
    {
      title: "5. Ações (Execution)",
      label: "Comprometimento",
      description: "Selecionamos as ideias vencedoras e definimos quem fará o quê. O fim do brainstorming é o começo da execução real.",
      icon: <ListTodo />
    }
  ];

  return (
    <>
      <ToolHubLayout 
        title="Brainstorming"
        description="Espaço criativo para geração de ideias e soluções em squad. Transforme insights em backlog acionável."
        icon={<Lightbulb />}
        themeColor="amber"
        toolType="brainstorming"
        tips={tips}
        referenceSections={referenceSections}
        onNewSession={() => {
          if (!userProfile) {
            requestIdentity(() => setIsSetupOpen(true));
          } else {
            setIsSetupOpen(true);
          }
        }}
        onJoinSession={(id) => router.push(`/brainstorming/${id}`)}
        isCreating={isCreating}
      />

      <Dialog open={isSetupOpen} onOpenChange={setIsSetupOpen}>
        <DialogContent className="sm:max-w-[480px] rounded-[2.5rem] border-none shadow-2xl bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl">
          <DialogHeader>
            <div className="w-12 h-12 rounded-2xl bg-amber-500 flex items-center justify-center mb-4 shadow-lg shadow-amber-500/20 text-white">
               <Sparkles className="h-6 w-6" />
            </div>
            <DialogTitle className="text-2xl font-black uppercase tracking-tighter text-slate-800 dark:text-slate-100 leading-none">Iniciar Brainstorming</DialogTitle>
            <DialogDescription className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-2">Configure os detalhes da sua sessão criativa</DialogDescription>
          </DialogHeader>

          <div className="space-y-6 py-6 font-sans">
            <div className="space-y-2">
              <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Título da Sessão</Label>
              <Input 
                placeholder="Ex: Refatoração do Dashboard" 
                value={title}
                onChange={e => setTitle(e.target.value)}
                className="h-12 rounded-xl border-slate-200 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 focus:border-amber-500 font-bold"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Squad / Time (Opcional)</Label>
              <Input 
                placeholder="Ex: Flight Core" 
                value={team}
                onChange={e => setTeam(e.target.value)}
                className="h-12 rounded-xl border-slate-200 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 focus:border-amber-500 font-bold"
              />
            </div>
          </div>

          <DialogFooter className="pt-4 border-t border-slate-100 dark:border-slate-700 flex-col gap-3">
             <Button 
               disabled={isCreating}
               onClick={handleCreate}
               className="w-full h-14 bg-amber-500 hover:bg-amber-600 text-white font-black uppercase tracking-widest text-xs rounded-2xl shadow-xl shadow-amber-500/10 gap-3"
             >
               {isCreating ? 'Sincronizando...' : 'Iniciar Jornada'}
               <ArrowRightIcon className="h-4 w-4" />
             </Button>
             <Button
               type="button"
               variant="ghost"
               onClick={() => setIsSetupOpen(false)}
               className="h-auto px-2 py-1 text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
             >
                Talvez depois
             </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
