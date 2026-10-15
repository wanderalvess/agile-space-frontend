import {
  BookOpen,
  CalendarDays,
  HeartPulse,
  LayoutDashboard,
  LayoutGrid,
  Lightbulb,
  ListChecks,
  ShieldCheck,
  Sparkles,
  Terminal,
  TestTube,
  Wrench,
  type LucideIcon,
} from 'lucide-react';

export interface HomeModule {
  id: string;
  title: string;
  description: string;
  icon: LucideIcon;
  href: string;
  /** Módulo ainda não liberado: o link leva à página "Em breve". */
  soon?: boolean;
  /** Atalhos extras do módulo (Políticas e ajuda). */
  links?: { label: string; href: string }[];
}

export interface HomeModuleGroup {
  id: string;
  label: string;
  items: HomeModule[];
}

/** Os 12 módulos do portal, com as mesmas rotas de sempre. */
export const MODULE_GROUPS: HomeModuleGroup[] = [
  {
    id: 'quality',
    label: 'Qualidade e ferramentas',
    items: [
      { id: 'jolt', title: 'Jolt', description: 'Layouts e especificações', icon: Terminal, href: '/jolt' },
      { id: 'devtools', title: 'DevTools', description: 'JSON, Base64, JWT, Regex, Diff e mais', icon: Wrench, href: '/devtools' },
      { id: 'qa', title: 'Central de Qualidade', description: 'Zephyr, massa de dados, BDD, automação e mocks', icon: TestTube, href: '/qa' },
    ],
  },
  {
    id: 'flow',
    label: 'Fluxo e entregas',
    items: [
      { id: 'painel', title: 'Painel do Time', description: 'Sprint, board e movimentos da squad', icon: LayoutDashboard, href: '/painel' },
      { id: 'workspace', title: 'Meu Quadro', description: 'Kanban pessoal, tarefas e agendas', icon: LayoutGrid, href: '/workspace' },
      { id: 'planner', title: 'Planejador', description: 'Capacidade e planejamento da sprint', icon: CalendarDays, href: '/sprint-planner', soon: true },
    ],
  },
  {
    id: 'collab',
    label: 'Colaboração e clima',
    items: [
      { id: 'health', title: 'Radar de Clima', description: 'Pesquisas rápidas e anônimas do time', icon: HeartPulse, href: '/health-check' },
      { id: 'ideas', title: 'Painel de Ideias', description: 'Quadros de brainstorming', icon: Lightbulb, href: '/brainstorming' },
      { id: 'action-plan', title: 'Plano de Ação', description: 'Matrizes 5W2H', icon: ListChecks, href: '/action-plan' },
    ],
  },
  {
    id: 'support',
    label: 'Utilidades e suporte',
    items: [
      { id: 'knowledge', title: 'Conhecimento', description: 'Wiki e base técnica', icon: BookOpen, href: '/knowledge/kb' },
      { id: 'prompt-hub', title: 'Biblioteca de IA', description: 'Prompts, skills, agentes e Gems', icon: Sparkles, href: '/prompt-hub' },
      {
        id: 'help',
        title: 'Políticas e ajuda',
        description: 'Segurança, novidades, manual e chamados',
        icon: ShieldCheck,
        href: '/support',
        links: [
          { label: 'Segurança', href: '/governance' },
          { label: 'Novidades', href: '/changelog' },
          { label: 'Manual', href: '/manual' },
          { label: 'Chamados', href: '/support' },
        ],
      },
    ],
  },
];

export const MODULE_COUNT = MODULE_GROUPS.reduce((n, g) => n + g.items.length, 0);
