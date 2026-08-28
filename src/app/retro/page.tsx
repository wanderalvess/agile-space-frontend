'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  LayoutDashboard,
  Zap,
  Target,
  ShieldCheck,
  TrendingUp,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  ListTodo,
} from 'lucide-react';
import { retroApi } from './api';
import { useToast } from '@/hooks/use-toast';
import { useUserContext } from '@/context/UserContext';
import { ToolHubLayout } from '@/components/shared/ToolHubLayout';
import { RETRO_TEMPLATES, RetroTemplateKey, RetroColumnDef, RetroColumnTheme } from '@/lib/types';
import { CreateRetroDialog, DEFAULT_SETUP_SETTINGS, SetupSettings } from '@/components/retro/CreateRetroDialog';

const ROOMS_META_KEY = 'agileSpace_rooms_meta';

export default function RetroHubPage() {
  const router = useRouter();
  const { toast } = useToast();
  const { userProfile, requestIdentity } = useUserContext();

  const [isSetupOpen, setIsSetupOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  
  // Setup State
  const [title, setTitle] = useState('');
  const [team, setTeam] = useState('');
  const [template, setTemplate] = useState<RetroTemplateKey>('classic');
  const [customColumns, setCustomColumns] = useState<{ title: string; theme: RetroColumnTheme }[]>([
    { title: '', theme: 'success' },
    { title: '', theme: 'warning' },
    { title: '', theme: 'action' },
  ]);
  const [setupSettings, setSetupSettings] = useState<SetupSettings>(DEFAULT_SETUP_SETTINGS);

  // Preenche o squad com o time do usuário assim que o perfil carregar (chega
  // async) — só enquanto o campo estiver vazio, para não sobrescrever nem uma
  // edição manual nem um valor já preenchido por uma resolução anterior.
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
      console.error("[retro] Tentativa de criação de quadro abortada: usuário nulo ou sem ID.");
      toast({
        title: "Perfil Não Identificado",
        description: "Não foi possível carregar a sua identidade. Por favor, defina seu perfil e tente novamente.",
        variant: "destructive"
      });
      return;
    }

    if (!title.trim()) {
      toast({
        title: "Título Obrigatório",
        description: "Dê um nome ao seu quadro antes de iniciar.",
        variant: "destructive"
      });
      return;
    }

    setIsCreating(true);

    // Resolve columns
    let columns: RetroColumnDef[];
    if (template === 'custom') {
      columns = customColumns
        .filter(c => c.title.trim())
        .map((c, i) => ({
          id: `custom_${i}_${Date.now()}`,
          title: c.title.trim(),
          theme: c.theme as any,
          order: i
        }));
    } else {
      // Sincronização garantida com RETRO_TEMPLATES do lib/types
      columns = RETRO_TEMPLATES[template as Exclude<RetroTemplateKey, 'custom'>] || RETRO_TEMPLATES.classic;
    }

    if (!columns || columns.length === 0) {
      toast({
        title: "Erro de Configuração",
        description: "O template selecionado não pôde ser carregado corretamente.",
        variant: "destructive"
      });
      setIsCreating(false);
      return;
    }

    const resolvedTeam = team.trim() || 'Squad Geral';

    const newBoard = {
      id: crypto.randomUUID(),
      creatorId: userProfile.id,
      isCardsRevealed: false,
      votingStatus: 'disabled' as const,
      ...setupSettings,
      timer: { status: 'stopped' as const, endTime: null, initialDuration: 300, remainingOnPause: 300 },
      title: title.trim(),
      team: resolvedTeam,
      createdAt: new Date().toISOString(),
      participantIds: [userProfile.id],
      columns,
      templateKey: template,
    };

    try {
      const docRef = await retroApi.saveOrUpdateBoard(newBoard);
      if (docRef && docRef.id) {
        saveRoomMeta(docRef.id, 'retro', title.trim(), resolvedTeam);
        setIsSetupOpen(false);
        router.push(`/retro/${docRef.id}`);
      } else {
        console.error("[retro] Resposta da API ao criar quadro não veio com ID válido:", docRef);
        setIsCreating(false);
        toast({
          title: "Erro na Criação",
          description: "O servidor não retornou um ID para o novo quadro.",
          variant: "destructive"
        });
      }
    } catch (error: any) {
      console.error("Error creating retro board: ", error);
      setIsCreating(false);
      toast({
        title: "Erro na Criação",
        description: error?.message || "Não foi possível iniciar o quadro no momento.",
        variant: "destructive"
      });
    }
  };

  const tips = [
    {
      title: "Segurança Psicológica",
      description: "A retro é um espaço seguro. O foco deve estar no processo e no sistema, nunca em apontar culpados.",
      icon: <ShieldCheck className="text-emerald-600" />
    },
    {
      title: "Ações Concretas",
      description: "Uma boa retrospectiva termina com itens de ação claros, com responsáveis e prazos definidos.",
      icon: <Target className="text-emerald-600" />
    },
    {
      title: "Melhoria Contínua",
      description: "Pequenos ajustes incrementais a cada ciclo geram resultados massivos no longo prazo.",
      icon: <TrendingUp className="text-emerald-600" />
    }
  ];

  const referenceSections = [
    {
      title: "O que foi bom",
      label: "Celebração",
      description: "Momento de reconhecer vitórias, elogiar o time e garantir que processos eficientes sejam mantidos e replicados.",
      icon: <CheckCircle2 className="text-emerald-500" />
    },
    {
      title: "O que melhorar",
      label: "Gargalos",
      description: "Identificação honesta de falhas de comunicação, débitos técnicos ou processos que estão travando a squad.",
      icon: <AlertCircle className="text-rose-500" />
    },
    {
      title: "Plano de Ação",
      label: "Execução",
      description: "Comprometimento real. Cada item de melhoria deve gerar uma ação prática com responsável definido para a próxima sprint.",
      icon: <ListTodo className="text-blue-500" />
    },
    {
      title: "Poderes do Facilitador",
      label: "Gestão",
      description: "O facilitador pode revelar cards em massa, limpar votos para recalibrar o foco e exportar o relatório final consolidado.",
      icon: <Zap className="text-amber-500" />
    }
  ];

  return (
    <>
      <ToolHubLayout 
        title="Retrospectiva"
        description="Feedbacks colaborativos e planos de ação para melhoria contínua. Olhe para trás para acelerar para frente."
        icon={<LayoutDashboard />}
        themeColor="emerald"
        toolType="retro"
        tips={tips}
        referenceSections={referenceSections}
        onNewSession={() => {
          if (!userProfile) {
            requestIdentity(() => setIsSetupOpen(true));
          } else {
            setIsSetupOpen(true);
          }
        }}
        onJoinSession={(id) => router.push(`/retro/${id}`)}
        isCreating={isCreating}
      />

      <CreateRetroDialog
        open={isSetupOpen}
        onOpenChange={setIsSetupOpen}
        title={title}
        onTitleChange={setTitle}
        team={team}
        onTeamChange={setTeam}
        template={template}
        onTemplateChange={setTemplate}
        customColumns={customColumns}
        onCustomColumnsChange={setCustomColumns}
        setupSettings={setupSettings}
        onSetupSettingsChange={setSetupSettings}
        isCreating={isCreating}
        onCreate={handleCreate}
        onCancel={() => {
          setIsSetupOpen(false);
          setSetupSettings(DEFAULT_SETUP_SETTINGS);
        }}
      />
    </>
  );
}
