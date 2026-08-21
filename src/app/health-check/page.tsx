'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { 
  HeartPulse, 
  Zap, 
  Target, 
  Users, 
  ShieldCheck,
  TrendingUp,
  ArrowRight as ArrowRightIcon,
  Activity,
  Sparkles,
  BarChart3,
  History
} from 'lucide-react';
import { useFirebase } from '@/firebase';
import { healthCheckApi } from './api';
import { useToast } from '@/hooks/use-toast';
import { useUserContext } from '@/context/UserContext';
import { ToolHubLayout } from '@/components/shared/ToolHubLayout';
import { CreateHealthCheckDialog } from '@/components/health-check/CreateHealthCheckDialog';
import { HealthCheckDimension, HealthCheckScaleType } from '@/lib/types';

const ROOMS_META_KEY = 'agileSpace_rooms_meta';

export default function HealthCheckHubPage() {
  const router = useRouter();
  const { toast } = useToast();
  const { user } = useFirebase();
  const { userProfile, requestIdentity } = useUserContext();

  const [isSetupOpen, setIsSetupOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);

  const saveRoomMeta = (id: string, type: string, title: string, team: string) => {
    try {
      const saved = localStorage.getItem(ROOMS_META_KEY);
      const rooms = saved ? JSON.parse(saved) : [];
      const newMeta = {
        roomId: id,
        type,
        title,
        team,
        createdBy: user?.uid,
        createdAt: new Date().toISOString()
      };
      localStorage.setItem(ROOMS_META_KEY, JSON.stringify([...rooms, newMeta]));
    } catch (e) {
      console.error("Erro ao salvar metadados da sala", e);
    }
  };

  const handleCreate = async (dimensions: HealthCheckDimension[], sprintName: string, team: string, scaleType: HealthCheckScaleType) => {
    if (isCreating) return;

    if (!user || !user.uid) {
      console.error("[health-check] Criar board abortado: usuário sem ID.");
      toast({
        title: "Perfil Não Identificado",
        description: "Não foi possível carregar a sua identidade.",
        variant: "destructive"
      });
      return;
    }
    setIsCreating(true);
    
    const newHealthCheck = {
      creatorId: user.uid,
      status: 'collecting' as const,
      createdAt: new Date().toISOString(),
      dimensions,
      scaleType,
      sprintName: sprintName || '',
      team: team || userProfile?.squadId || userProfile?.team || 'Squad Geral',
      participantIds: [user.uid]
    };

    try {
      const created = await healthCheckApi.saveOrUpdateBoard(newHealthCheck);
      if (created && created.id) {
        saveRoomMeta(created.id, 'health', sprintName || 'Radar de Saúde', team || 'Squad');
        setIsSetupOpen(false);
        router.push(`/health-check/${created.id}`);
      } else {
        setIsCreating(false);
      }
    } catch (error) {
      console.error("Error creating health check: ", error);
      setIsCreating(false);
      toast({
        title: "Erro na Criação",
        description: "Não foi possível iniciar o radar no momento.",
        variant: "destructive"
      });
    }
  };

  const tips = [
    {
      title: "Sinceridade Radical",
      description: "O radar só é útil se as respostas forem honestas. Garanta que o time se sinta seguro para expressar a realidade.",
      icon: <Activity className="text-rose-500" />
    },
    {
      title: "Tendências Importam",
      description: "Compare os resultados com sessões anteriores. A direção do movimento é mais importante que o valor absoluto.",
      icon: <TrendingUp className="text-rose-500" />
    },
    {
      title: "Plano de Melhoria",
      description: "Identifique as dimensões no 'vermelho' e defina uma ação simples para atacar esse problema na próxima sprint.",
      icon: <Target className="text-rose-500" />
    }
  ];

  const referenceSections = [
    {
      title: "Sinceridade Radical",
      label: "Cultura",
      description: "Ninguém sabe quem votou. O sistema agrupa os resultados para garantir que a verdade apareça sem medo de julgamentos.",
      icon: <Activity className="text-rose-500" />
    },
    {
      title: "Dimensões do Sucesso",
      label: "KPIs Humanos",
      description: "Avaliamos pilares como Qualidade do Código, Missão da Squad, Processos e Diversão. O foco é saúde sustentável.",
      icon: <HeartPulse className="text-rose-500" />
    },
    {
      title: "Análise Radar",
      label: "Estratégia",
      description: "O gráfico radar revela graficamente onde o time está perdendo energia. Os 'furos' são os pontos prioritários de gestão.",
      icon: <BarChart3 className="text-rose-500" />
    },
    {
      title: "Evolução do Time",
      label: "Maturidade",
      description: "Compare os radares mensais. A direção do movimento é mais importante do que o valor absoluto de hoje.",
      icon: <History className="text-rose-500" />
    }
  ];

  return (
    <>
      <ToolHubLayout 
        title="Radar de Saúde"
        description="Diagnóstico 360º da saúde da squad. Meça o clima, confiança técnica e processos para evitar o burnout e otimizar o fluxo."
        icon={<HeartPulse />}
        themeColor="rose"
        toolType="health"
        tips={tips}
        referenceSections={referenceSections}
        onNewSession={() => {
          if (!user) {
            requestIdentity(() => setIsSetupOpen(true));
          } else {
            setIsSetupOpen(true);
          }
        }}
        onJoinSession={(id) => router.push(`/health-check/${id}`)}
        isCreating={isCreating}
      />

      <CreateHealthCheckDialog 
        open={isSetupOpen} 
        onOpenChange={setIsSetupOpen} 
        onCreateBoard={handleCreate} 
        isCreating={isCreating}
      />
    </>
  );
}
