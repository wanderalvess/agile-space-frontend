'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { Card } from '@/components/ui/card';
import { 
  Terminal, 
  Workflow, 
  ArrowRight,
  Code2,
  FileJson,
  Zap,
  Network
} from 'lucide-react';
import { ToolHubLayout } from '@/components/shared/ToolHubLayout';

export default function JoltHubDashboard() {
  const router = useRouter();

  const tips = [
    {
      title: "Transformação Declarativa",
      description: "O Jolt permite escrever especificações JSON para transformar a estrutura de outro JSON. A lógica fica na especificação, não no código Java/JavaScript.",
      icon: <FileJson className="text-blue-500" />
    },
    {
      title: "Teste no Sandbox",
      description: "Use o modo Sandbox para experimentar em tempo real. Veja o input, a especificação JLT e o output final lado a lado para depuração rápida.",
      icon: <Zap className="text-blue-500" />
    },
    {
      title: "Design Visual (ReactFlow)",
      description: "Se a especificação JLT for complexa de escrever, use o Mapeador Visual para ligar a origem e destino e gerar as regras de forma automática.",
      icon: <Network className="text-blue-500" />
    }
  ];

  const referenceSections = [
    {
      title: "1. Shift",
      label: "Operação Principal",
      description: "A operação mais comum. Navega pela árvore de entrada e copia os valores para a árvore de saída, renomeando ou reestruturando campos.",
      icon: <ArrowRight />
    },
    {
      title: "2. Default",
      label: "Valores Padrão",
      description: "Adiciona valores hardcoded ao JSON de saída caso eles não existam no JSON de entrada. Ótimo para preencher buracos ou inicializar flags.",
      icon: <Code2 />
    },
    {
      title: "3. Remove",
      label: "Filtragem",
      description: "Exclui partes indesejadas do JSON. Você especifica as propriedades a serem removidas da árvore original.",
      icon: <Terminal />
    },
    {
      title: "4. Sort",
      label: "Padronização",
      description: "Ordena recursivamente todas as chaves de mapas no JSON. Normalmente usado no último passo para garantir consistência visual ou em testes.",
      icon: <Workflow />
    }
  ];

  return (
    <ToolHubLayout
      title="Jolt Hub"
      description="A ferramenta definitiva para transformação e mapeamento de estruturas JSON. Escolha o seu fluxo ideal de produtividade."
      icon={<Terminal />}
      themeColor="blue"
      tips={tips}
      referenceSections={referenceSections}
      hideJoinAction={true}
      hideHistory={true}
      primaryActionLabel="Jolt Sandbox"
      onNewSession={() => router.push('/jolt/sandbox')}
      secondaryActionLabel="Mapeador Visual"
      onSecondaryAction={() => router.push('/jolt/visual')}
    />
  );
}
