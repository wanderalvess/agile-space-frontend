'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { 
  ListChecks,
  CheckCircle2,
  Clock,
  User,
  Zap,
  Target,
  Sparkles,
  ArrowRightIcon
} from 'lucide-react';
import { actionPlanApi } from './api';
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

export default function ActionPlanHubPage() {
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
      console.error("[action-plan] Criar plano abortado: usuário sem ID.");
      toast({
        title: "Perfil Não Identificado",
        description: "Não foi possível identificar seu perfil.",
        variant: "destructive"
      });
      return;
    }

    if (!title.trim()) {
      toast({
        title: "Título Obrigatório",
        description: "Dê um nome ao seu plano de ação.",
        variant: "destructive"
      });
      return;
    }

    setIsCreating(true);

    const newPlan = {
      creatorId: userProfile.id,
      title: title.trim(),
      team: team.trim() || 'Squad Geral',
      settings: { isPublic: true },
      participantIds: [userProfile.id]
    };

    try {
      const doc = await actionPlanApi.createBoard(newPlan);
      if (doc) {
        saveRoomMeta(doc.id, 'action_plan', title.trim(), team.trim() || 'Squad');
        setIsSetupOpen(false);
        router.push(`/action-plan/${doc.id}`);
      } else {
        setIsCreating(false);
      }
    } catch (error) {
      console.error("Error creating action plan: ", error);
      setIsCreating(false);
      toast({
        title: "Erro na Criação",
        description: "Não foi possível iniciar a sessão no momento.",
        variant: "destructive"
      });
    }
  };

  const tips = [
    {
      title: "Clareza Acima de Tudo",
      description: "Um bom plano de ação não deixa margem para dúvidas. A Matriz 5W2H força o detalhamento essencial.",
      icon: <Target className="text-fuchsia-500" />
    },
    {
      title: "Responsabilidade Única",
      description: "Cada ação deve ter um e apenas um dono claro (Who). Se é de todo mundo, não é de ninguém.",
      icon: <User className="text-fuchsia-500" />
    },
    {
      title: "Prazos Realistas",
      description: "Defina datas (When) que sejam alcançáveis para manter a motivação e credibilidade do time.",
      icon: <Clock className="text-fuchsia-500" />
    }
  ];

  const referenceSections = [
    {
      title: "What (O quê)",
      label: "Ação",
      description: "O que será feito? Descreva a tarefa de forma clara, preferencialmente começando com um verbo de ação.",
      icon: <Target />
    },
    {
      title: "Why (Por quê)",
      label: "Justificativa",
      description: "Qual o propósito dessa ação? Se não há um bom 'Por quê', talvez a ação não devesse existir.",
      icon: <Zap />
    },
    {
      title: "Where (Onde)",
      label: "Local",
      description: "Onde será feito? (Ex: Ambiente de Produção, Sistema XPTO, Módulo de Vendas).",
      icon: <ListChecks />
    },
    {
      title: "When (Quando)",
      label: "Prazo",
      description: "Qual o cronograma ou data limite para conclusão? É crucial para manter o ritmo.",
      icon: <Clock />
    },
    {
      title: "Who (Quem)",
      label: "Responsável",
      description: "Quem é a pessoa focal responsável por garantir que essa ação aconteça?",
      icon: <User />
    },
    {
      title: "How (Como)",
      label: "Método",
      description: "Quais os passos ou método para realizar a ação? Um mini-guia de execução.",
      icon: <Sparkles />
    },
    {
      title: "How Much (Quanto)",
      label: "Custo/Esforço",
      description: "Qual o custo financeiro ou esforço estimado (em horas ou story points)?",
      icon: <CheckCircle2 />
    }
  ];

  return (
    <>
      <ToolHubLayout 
        title="Plano de Ação (5W2H)"
        description="Estruture a execução de qualquer projeto ou demanda. Transforme ideias em tarefas detalhadas, com donos e prazos claros."
        icon={<ListChecks />}
        themeColor="fuchsia"
        // FLAG: o union toolType (RoomMeta['type'] em src/lib/types.ts) não inclui 'action_plan'.
        // Cast mantém o valor 'action_plan' em runtime (usado como chave de histórico em ToolHubLayout),
        // preservando o comportamento. Correção definitiva: adicionar 'action_plan' a RoomMeta['type']
        // (arquivo fora do escopo permitido).
        toolType={'action_plan' as unknown as React.ComponentProps<typeof ToolHubLayout>['toolType']}
        tips={tips}
        referenceSections={referenceSections}
        onNewSession={() => {
          if (!userProfile) {
            requestIdentity(() => setIsSetupOpen(true));
          } else {
            setIsSetupOpen(true);
          }
        }}
        onJoinSession={(id) => router.push(`/action-plan/${id}`)}
        isCreating={isCreating}
      />

      <Dialog open={isSetupOpen} onOpenChange={setIsSetupOpen}>
        <DialogContent className="sm:max-w-[480px] rounded-[2.5rem] border-none shadow-2xl bg-white/95 backdrop-blur-xl">
          <DialogHeader>
            <div className="w-12 h-12 rounded-2xl bg-fuchsia-500 flex items-center justify-center mb-4 shadow-lg shadow-fuchsia-500/20 text-white">
               <Sparkles className="h-6 w-6" />
            </div>
            <DialogTitle className="text-2xl font-black uppercase tracking-tighter text-slate-800 leading-none">Criar Plano de Ação</DialogTitle>
            <DialogDescription className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-2">Configure o título da sua Matriz 5W2H</DialogDescription>
          </DialogHeader>

          <div className="space-y-6 py-6 font-sans">
            <div className="space-y-2">
              <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Título do Plano</Label>
              <Input 
                placeholder="Ex: Execução do Novo Checkout" 
                value={title}
                onChange={e => setTitle(e.target.value)}
                className="h-12 rounded-xl border-slate-200 focus:border-fuchsia-500 font-bold"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Squad / Time (Opcional)</Label>
              <Input 
                placeholder="Ex: Squad de Pagamentos" 
                value={team}
                onChange={e => setTeam(e.target.value)}
                className="h-12 rounded-xl border-slate-200 focus:border-fuchsia-500 font-bold"
              />
            </div>
          </div>

          <DialogFooter className="pt-4 border-t border-slate-100 flex-col gap-3">
             <Button 
               disabled={isCreating}
               onClick={handleCreate}
               className="w-full h-14 bg-fuchsia-500 hover:bg-fuchsia-600 text-white font-black uppercase tracking-widest text-xs rounded-2xl shadow-xl shadow-fuchsia-500/10 gap-3"
             >
               {isCreating ? 'Preparando...' : 'Iniciar Matriz'}
               <ArrowRightIcon className="h-4 w-4" />
             </Button>
             <Button
               type="button"
               variant="ghost"
               onClick={() => setIsSetupOpen(false)}
               className="h-auto px-2 py-1 text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-slate-600"
             >
                Talvez depois
             </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
