import {
  WalletCards,
  Lightbulb,
  LayoutDashboard,
  CalendarDays,
  HeartPulse,
  Zap,
  LayoutGrid,
  FileJson,
  Network,
  Sparkles,
  MessageSquare,
  Eye,
  Shield,
  ShieldCheck,
  LucideIcon
} from 'lucide-react';

export interface ManualTopic {
  id: string;
  title: string;
  subtitle: string;
  description: string;
  category: 'agile' | 'engineering' | 'intelligence' | 'governance';
  icon: LucideIcon;
  color: string;
  badgeBg: string;
  badgeBorder: string;
  badgeText: string;
  heroBg: string;
  actionUrl?: string;
  actionLabel?: string;
}

export interface ManualCategory {
  id: 'agile' | 'engineering' | 'intelligence' | 'governance';
  label: string;
  description: string;
}

export const MANUAL_CATEGORIES: ManualCategory[] = [
  {
    id: 'agile',
    label: 'Cerimônias & Fluxo Ágil',
    description: 'Ferramentas de facilitação, estimativa, alinhamento e retrospectiva contínua.'
  },
  {
    id: 'engineering',
    label: 'Engenharia & Toolkit',
    description: 'Suíte técnica para transformação de dados, utilitários e integração.'
  },
  {
    id: 'intelligence',
    label: 'Inteligência & Apresentação',
    description: 'Bases de conhecimento, engenharia de prompt e demonstrações executivas.'
  },
  {
    id: 'governance',
    label: 'Diretrizes & Governança',
    description: 'Políticas de privacidade, arquitetura e manifesto de boas práticas.'
  }
];

export const MANUAL_TOPICS: ManualTopic[] = [
  // Categoria Ágil
  {
    id: 'poker',
    title: 'Scrum Poker',
    subtitle: 'Estimativas Ágeis & Consenso',
    description: 'O padrão ouro para estimativas ágeis. Projetado para eliminar o "Efeito Manada" e garantir que todos os riscos técnicos sejam discutidos.',
    category: 'agile',
    icon: WalletCards,
    color: 'text-blue-600 dark:text-blue-400',
    badgeBg: 'bg-blue-500/10 dark:bg-blue-500/20',
    badgeBorder: 'border-blue-500/20',
    badgeText: 'text-blue-600 dark:text-blue-400',
    heroBg: 'from-blue-600 to-indigo-700',
    actionUrl: '/room',
    actionLabel: 'Criar Sessão de Poker'
  },
  {
    id: 'brainstorming',
    title: 'Brainstorming Alpha',
    subtitle: 'Da Ideação ao Plano de Ação',
    description: 'A ferramenta de ideação mais completa do ecossistema. Vai do caos criativo ao plano de execução estruturado em 5 passos.',
    category: 'agile',
    icon: Lightbulb,
    color: 'text-amber-600 dark:text-amber-400',
    badgeBg: 'bg-amber-500/10 dark:bg-amber-500/20',
    badgeBorder: 'border-amber-500/20',
    badgeText: 'text-amber-600 dark:text-amber-400',
    heroBg: 'from-amber-500 to-orange-600',
    actionUrl: '/brainstorming',
    actionLabel: 'Abrir Brainstorming'
  },
  {
    id: 'retro',
    title: 'Retrospectiva Ágil',
    subtitle: 'Melhoria Contínua & Kaizen',
    description: 'A base da melhoria contínua. Uma interface panorâmica projetada para clareza visual, segurança psicológica e planos de ação.',
    category: 'agile',
    icon: LayoutDashboard,
    color: 'text-orange-600 dark:text-orange-400',
    badgeBg: 'bg-orange-500/10 dark:bg-orange-500/20',
    badgeBorder: 'border-orange-500/20',
    badgeText: 'text-orange-600 dark:text-orange-400',
    heroBg: 'from-orange-500 to-rose-600',
    actionUrl: '/retro',
    actionLabel: 'Abrir Retrospectiva'
  },
  {
    id: 'planner',
    title: 'Sprint Planner',
    subtitle: 'Capacidade Real & Refinamento',
    description: 'Cansado de errar o tamanho da Sprint? O Planner calcula a capacidade real baseada na vida real da squad, feriados e foco.',
    category: 'agile',
    icon: CalendarDays,
    color: 'text-indigo-600 dark:text-indigo-400',
    badgeBg: 'bg-indigo-500/10 dark:bg-indigo-500/20',
    badgeBorder: 'border-indigo-500/20',
    badgeText: 'text-indigo-600 dark:text-indigo-400',
    heroBg: 'from-indigo-600 to-purple-700',
    actionUrl: '/sprint-planner',
    actionLabel: 'Abrir Sprint Planner'
  },
  {
    id: 'health',
    title: 'Radar de Saúde',
    subtitle: 'Maturidade & Diagnóstico de Squad',
    description: 'O diagnóstico sincero da squad. Focado em encontrar temas latentes com anonimato radical e acompanhamento evolutivo.',
    category: 'agile',
    icon: HeartPulse,
    color: 'text-emerald-600 dark:text-emerald-400',
    badgeBg: 'bg-emerald-500/10 dark:bg-emerald-500/20',
    badgeBorder: 'border-emerald-500/20',
    badgeText: 'text-emerald-600 dark:text-emerald-400',
    heroBg: 'from-emerald-600 to-teal-700',
    actionUrl: '/health-check',
    actionLabel: 'Abrir Radar de Saúde'
  },
  {
    id: 'daily-flow',
    title: 'Daily Flow',
    subtitle: 'Check-in Assíncrono & Bloqueios',
    description: 'Sincronização assíncrona para squads de alta performance. Elimine reuniões redundantes e sinalize bloqueios instantaneamente.',
    category: 'agile',
    icon: Zap,
    color: 'text-indigo-600 dark:text-indigo-400',
    badgeBg: 'bg-indigo-500/10 dark:bg-indigo-500/20',
    badgeBorder: 'border-indigo-500/20',
    badgeText: 'text-indigo-600 dark:text-indigo-400',
    heroBg: 'from-indigo-600 to-blue-700',
    actionUrl: '/daily-flow',
    actionLabel: 'Abrir Daily Flow'
  },

  // Categoria Engenharia
  {
    id: 'workspace',
    title: 'Meu Espaço',
    subtitle: 'Central de Produtividade Individual',
    description: 'Ferramentas projetadas para acelerar o fluxo solo de engenharia: Daily Helper, repositório privado de snippets e anotações.',
    category: 'engineering',
    icon: LayoutGrid,
    color: 'text-slate-900 dark:text-slate-100',
    badgeBg: 'bg-slate-500/10 dark:bg-slate-500/20',
    badgeBorder: 'border-slate-500/20',
    badgeText: 'text-slate-900 dark:text-slate-100',
    heroBg: 'from-slate-800 to-slate-950',
    actionUrl: '/workspace',
    actionLabel: 'Acessar Meu Espaço'
  },
  {
    id: 'jolt',
    title: 'Jolt Hub',
    subtitle: 'Motor de Transformação JSON',
    description: 'A suíte definitiva para manipulações estruturais JSON complexas utilizando a engine Apache Jolt e mapeador visual.',
    category: 'engineering',
    icon: FileJson,
    color: 'text-blue-500 dark:text-blue-400',
    badgeBg: 'bg-blue-500/10 dark:bg-blue-500/20',
    badgeBorder: 'border-blue-500/20',
    badgeText: 'text-blue-500 dark:text-blue-400',
    heroBg: 'from-blue-600 to-cyan-700',
    actionUrl: '/jolt',
    actionLabel: 'Abrir Jolt Hub'
  },
  {
    id: 'integracoes',
    title: 'Integrações & API',
    subtitle: 'Catálogo de APIs e Endpoints',
    description: 'Documentação completa de integração do Espaço Ágil via REST, autenticação por Bearer Token e catálogo OpenAPI.',
    category: 'engineering',
    icon: Network,
    color: 'text-cyan-600 dark:text-cyan-400',
    badgeBg: 'bg-cyan-500/10 dark:bg-cyan-500/20',
    badgeBorder: 'border-cyan-500/20',
    badgeText: 'text-cyan-600 dark:text-cyan-400',
    heroBg: 'from-cyan-600 to-blue-700'
  },

  // Categoria Inteligência & Apresentação
  {
    id: 'knowledge',
    title: 'Knowledge Hub',
    subtitle: 'Base de Conhecimento & Assistente',
    description: 'A central de conhecimento da sua squad. Repositório organizado para manuais técnicos, guias e assistente inteligente integrado.',
    category: 'intelligence',
    icon: Sparkles,
    color: 'text-cyan-600 dark:text-cyan-400',
    badgeBg: 'bg-cyan-500/10 dark:bg-cyan-500/20',
    badgeBorder: 'border-cyan-500/20',
    badgeText: 'text-cyan-600 dark:text-cyan-400',
    heroBg: 'from-cyan-600 to-teal-700',
    actionUrl: '/knowledge/kb',
    actionLabel: 'Abrir Knowledge Hub'
  },
  {
    id: 'prompt-hub',
    title: 'Prompt Hub',
    subtitle: 'Engenharia de Instruções & Social',
    description: 'A arte de estruturar prompts de alta performance. Gerencie, compartilhe, versione e colabore em instruções reutilizáveis.',
    category: 'intelligence',
    icon: MessageSquare,
    color: 'text-violet-600 dark:text-violet-400',
    badgeBg: 'bg-violet-500/10 dark:bg-violet-500/20',
    badgeBorder: 'border-violet-500/20',
    badgeText: 'text-violet-600 dark:text-violet-400',
    heroBg: 'from-violet-600 to-purple-800',
    actionUrl: '/prompt-hub',
    actionLabel: 'Abrir Prompt Hub'
  },
  {
    id: 'showcase',
    title: 'Sprint Showcase',
    subtitle: 'Apresentações & Modo Teatro',
    description: 'O palco das suas entregas. Transforme dados de Sprint em slides executivos profissionais com visual imersivo para stakeholders.',
    category: 'intelligence',
    icon: Eye,
    color: 'text-pink-600 dark:text-pink-400',
    badgeBg: 'bg-pink-500/10 dark:bg-pink-500/20',
    badgeBorder: 'border-pink-500/20',
    badgeText: 'text-pink-600 dark:text-pink-400',
    heroBg: 'from-pink-600 to-rose-700',
    actionUrl: '/showcase',
    actionLabel: 'Abrir Showcase'
  },

  // Categoria Governança
  {
    id: 'manifesto',
    title: 'Manifesto Espaço Ágil',
    subtitle: 'Nossos Princípios & Padrões',
    description: 'Nossas diretrizes de design, fluxo e arquitetura para garantir a melhor experiência de colaboração ágil com privacidade radical.',
    category: 'governance',
    icon: ShieldCheck,
    color: 'text-primary',
    badgeBg: 'bg-primary/10',
    badgeBorder: 'border-primary/20',
    badgeText: 'text-primary',
    heroBg: 'from-slate-900 to-indigo-950'
  },
  {
    id: 'governance',
    title: 'Governança & Segurança',
    subtitle: 'Compliance, LGPD & Privacidade',
    description: 'Transparência total sobre armazenamento de dados, conformidade técnica, isolamento multi-tenant e segurança em nuvem.',
    category: 'governance',
    icon: Shield,
    color: 'text-emerald-600 dark:text-emerald-400',
    badgeBg: 'bg-emerald-500/10 dark:bg-emerald-500/20',
    badgeBorder: 'border-emerald-500/20',
    badgeText: 'text-emerald-600 dark:text-emerald-400',
    heroBg: 'from-emerald-700 to-slate-900',
    actionUrl: '/governance',
    actionLabel: 'Ver Painel de Governança'
  }
];

export function getTopicById(id: string): ManualTopic | undefined {
  return MANUAL_TOPICS.find((t) => t.id === id);
}
