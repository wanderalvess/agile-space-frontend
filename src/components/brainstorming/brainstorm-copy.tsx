import { BrainCircuit, Columns3, LayoutGrid, Layers, ListChecks, Network, Target, ThumbsUp, Zap, type LucideIcon } from 'lucide-react';
import type { BrainstormingPhase } from '@/lib/types';

/** O que cada etapa faz, em uma ou duas frases. Fonte do hub e do guia da sala. */
export const STAGE_COPY: Record<BrainstormingPhase, { title: string; icon: LucideIcon; hub: string; guide: string }> = {
  ideation: {
    title: 'Mural',
    icon: LayoutGrid,
    hub: 'Cada pessoa lança ideias. O facilitador pode ocultar o texto até a revelação e esconder os autores, para ninguém ancorar nas ideias dos outros. Para juntar ideias repetidas, use o botão de fusão no cartão: textos e votos se combinam.',
    guide: 'Lance ideias, vote e junte as repetidas. O facilitador pode ocultar o texto e os autores.',
  },
  diagram: {
    title: 'Teia',
    icon: Network,
    hub: 'As ideias viram nós que se ligam: arraste para organizar e ligue uma ideia a outra para mostrar o que puxa o quê.',
    guide: 'Arraste as ideias e ligue uma à outra para mostrar o que puxa o quê.',
  },
  grouping: {
    title: 'Grupos',
    icon: Columns3,
    hub: 'Crie grupos e arraste as ideias para dentro, ou use "Mover para" no cartão. O objetivo é reduzir a repetição e achar os grandes temas.',
    guide: 'Crie grupos e arraste as ideias para dentro, ou use "Mover para" no cartão.',
  },
  prioritization: {
    title: 'Matriz',
    icon: Target,
    hub: 'Arraste as ideias para Quick wins, Estratégico, Secundários ou Descartar, pelo retorno e pelo esforço. A prioridade vai para o que dá retorno rápido.',
    guide: 'Quick wins, Estratégico, Secundários ou Descartar: retorno contra esforço.',
  },
  actions: {
    title: 'Plano',
    icon: ListChecks,
    hub: 'As melhores ideias viram um plano de ação 5W2H da squad, com quem faz o quê e até quando.',
    guide: 'As melhores ideias viram um plano de ação 5W2H da squad.',
  },
};

export interface ReferenceItem {
  title: string;
  description: string;
  icon: LucideIcon;
}

/** "Como funciona" do hub: as cinco etapas reais e o jeito de votar. */
export const BRAIN_REFERENCE: readonly ReferenceItem[] = [
  ...(['ideation', 'diagram', 'grouping', 'prioritization', 'actions'] as const).map((phase, i) => ({
    title: `${i + 1}. ${STAGE_COPY[phase].title}`,
    description: STAGE_COPY[phase].hub,
    icon: STAGE_COPY[phase].icon,
  })),
  {
    title: 'Votos o tempo todo',
    description: 'Nas etapas Mural, Teia e Grupos qualquer pessoa vota em quantas ideias quiser (um voto por ideia; votar de novo tira o voto). Não existe uma etapa só de votação.',
    icon: ThumbsUp,
  },
];

/** Dicas do hub. */
export const BRAIN_TIPS: readonly ReferenceItem[] = [
  { title: 'Zero julgamento', description: 'Na hora de lançar ideias nenhuma é ruim. O foco é volume e criatividade, sem críticas antes da hora.', icon: BrainCircuit },
  { title: 'Construa sobre os outros', description: 'Use as ideias dos colegas como trampolim. "Sim, e..." rende mais que "Não, mas...".', icon: Layers },
  { title: 'Foco em quantidade', description: 'Quanto mais ideias, maior a chance de achar uma boa solução.', icon: Zap },
];
