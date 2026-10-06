'use client';

import { useRouter } from 'next/navigation';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  ArrowUpRight,
  BookOpen,
  ChevronRight,
  Hourglass,
  HeartPulse,
  LayoutDashboard,
  LayoutGrid,
  Library,
  Lightbulb,
  ListChecks,
  Rocket,
  ShieldCheck,
  Target,
  Terminal,
  TestTube,
  Users,
  Wrench,
  type LucideIcon,
} from 'lucide-react';
import { cn } from '@/lib/utils';

type Accent = 'primary' | 'blue' | 'rose' | 'amber' | 'fuchsia' | 'cyan' | 'slate';

// Um único conjunto de classes por cor de destaque: todos os cards da home têm o mesmo tamanho e a mesma anatomia.
const ACCENTS: Record<Accent, { glow: string; icon: string; hoverText: string; cta: string }> = {
  primary: { glow: 'bg-primary/5 dark:bg-primary/10', icon: 'bg-primary/10 border-primary/20 text-primary', hoverText: 'group-hover:text-primary', cta: 'bg-primary hover:bg-orange-600 text-white' },
  blue: { glow: 'bg-blue-500/5 dark:bg-blue-500/10', icon: 'bg-blue-500/10 border-blue-500/20 text-blue-600 dark:text-blue-400', hoverText: 'group-hover:text-blue-600 dark:group-hover:text-blue-400', cta: 'bg-blue-600 hover:bg-blue-700 text-white' },
  rose: { glow: 'bg-rose-500/5 dark:bg-rose-500/10', icon: 'bg-rose-500/10 border-rose-500/20 text-rose-500', hoverText: 'group-hover:text-rose-500', cta: 'bg-rose-500 hover:bg-rose-600 text-white' },
  amber: { glow: 'bg-amber-500/5 dark:bg-amber-500/10', icon: 'bg-amber-500/10 border-amber-500/20 text-amber-500', hoverText: 'group-hover:text-amber-500', cta: 'bg-amber-500 hover:bg-amber-600 text-white' },
  fuchsia: { glow: 'bg-fuchsia-500/5 dark:bg-fuchsia-500/10', icon: 'bg-fuchsia-500/10 border-fuchsia-500/20 text-fuchsia-500', hoverText: 'group-hover:text-fuchsia-500', cta: 'bg-fuchsia-600 hover:bg-fuchsia-700 text-white' },
  cyan: { glow: 'bg-cyan-500/5 dark:bg-cyan-500/10', icon: 'bg-cyan-500/10 border-cyan-500/20 text-cyan-600 dark:text-cyan-400', hoverText: 'group-hover:text-cyan-600 dark:group-hover:text-cyan-400', cta: 'bg-cyan-600 hover:bg-cyan-700 text-white' },
  slate: { glow: 'bg-slate-500/5 dark:bg-slate-500/10', icon: 'bg-slate-900 dark:bg-slate-800 border-slate-700 text-white', hoverText: 'group-hover:text-primary', cta: 'bg-slate-900 hover:bg-slate-800 text-white' },
};

interface ModuleItem {
  title: string;
  tag: string;
  description: string;
  icon: LucideIcon;
  accent: Accent;
  route?: string;
  cta?: string;
  /** Módulo ainda não liberado: o card leva à página "Em breve" e o botão fica neutro. */
  soon?: boolean;
  /** Variante de atalhos: em vez de um botão, lista links. */
  links?: { label: string; route: string }[];
}

interface ModuleGroup {
  title: string;
  icon: LucideIcon;
  items: ModuleItem[];
}

const GROUPS: ModuleGroup[] = [
  {
    title: 'Ferramentas de Engenharia',
    icon: Wrench,
    items: [
      {
        title: 'Jolt',
        tag: 'JSON',
        description: 'Transforme payloads JSON: escreva a spec na Sandbox ou desenhe o mapeamento no Mapeador Visual.',
        icon: Terminal,
        accent: 'blue',
        route: '/jolt',
        cta: 'Escolher modo',
      },
      {
        title: 'DevTools',
        tag: 'Utilitários',
        description: 'JSON, Base64, JWT, Regex, Diff, Cron e mais: utilitários que rodam no navegador, sem enviar seus dados.',
        icon: Wrench,
        accent: 'primary',
        route: '/devtools',
        cta: 'Abrir DevTools',
      },
      {
        title: 'Central de Qualidade',
        tag: 'Qualidade & Testes',
        description: 'As ferramentas de teste do DevTools num só lugar: Zephyr, massa de dados, BDD, automação e mocks.',
        icon: TestTube,
        accent: 'primary',
        route: '/qa',
        cta: 'Acessar Qualidade',
      },
    ],
  },
  {
    title: 'Gestão de Fluxo e Entregas',
    icon: Rocket,
    items: [
      {
        title: 'Painel do Time',
        tag: 'Squad',
        description: 'Sprint, board e movimentos da sua squad numa leitura só: o que está em jogo agora.',
        icon: LayoutDashboard,
        accent: 'primary',
        route: '/painel',
        cta: 'Abrir painel',
      },
      {
        title: 'Meu Quadro',
        tag: 'Kanban',
        description: 'Sua área de trabalho com Kanban pessoal, tarefas e agendas integradas de forma simples.',
        icon: LayoutGrid,
        accent: 'primary',
        route: '/workspace',
        cta: 'Acessar Quadro',
      },
      {
        title: 'Planejador',
        tag: 'Em breve',
        description: 'Capacidade do time e planejamento da sprint, depois do Scrum Poker. Em redesenho para o novo padrão.',
        icon: Target,
        accent: 'blue',
        route: '/sprint-planner',
        cta: 'Em breve',
        soon: true,
      },
    ],
  },
  {
    title: 'Colaboração & Clima do Time',
    icon: Users,
    items: [
      {
        title: 'Radar de Clima',
        tag: 'Clima',
        description: 'Participe de pesquisas rápidas e anônimas sobre a satisfação e a saúde do time.',
        icon: HeartPulse,
        accent: 'rose',
        route: '/health-check',
        cta: 'Ver Radar',
      },
      {
        title: 'Painel de Ideias',
        tag: 'Ideias',
        description: 'Crie quadros de ideias e faça sessões criativas de brainstorming com o grupo.',
        icon: Lightbulb,
        accent: 'amber',
        route: '/brainstorming',
        cta: 'Abrir módulo',
      },
      {
        title: 'Plano de Ação',
        tag: 'Ações',
        description: 'Organize tarefas e responsabilidades utilizando matrizes de planejamento 5W2H.',
        icon: ListChecks,
        accent: 'fuchsia',
        route: '/action-plan',
        cta: 'Criar matriz',
      },
    ],
  },
  {
    title: 'Utilidades & Suporte',
    icon: BookOpen,
    items: [
      {
        title: 'Conhecimento',
        tag: 'Wiki',
        description: 'Wiki interna com manuais, documentação técnica de sistemas e guias práticos da squad.',
        icon: BookOpen,
        accent: 'cyan',
        route: '/knowledge/kb',
        cta: 'Acessar Wiki',
      },
      {
        title: 'Biblioteca de IA',
        tag: 'Biblioteca',
        description: 'Prompts, skills, agentes, Gems e iniciativas de IA da empresa em um lugar só.',
        icon: Library,
        accent: 'blue',
        route: '/prompt-hub',
        cta: 'Abrir biblioteca',
      },
      {
        title: 'Políticas & Ajuda',
        tag: 'Suporte',
        description: 'Segurança, novidades da plataforma, manual e abertura de chamados.',
        icon: ShieldCheck,
        accent: 'slate',
        links: [
          { label: 'Diretrizes de Segurança', route: '/governance' },
          { label: 'Evolução da Plataforma', route: '/changelog' },
          { label: 'Manual do Usuário', route: '/manual' },
          { label: 'Suporte & Chamados', route: '/support' },
        ],
      },
    ],
  },
];

function ModuleCard({ item }: { item: ModuleItem }) {
  const router = useRouter();
  const a = ACCENTS[item.accent];
  const Icon = item.icon;
  const clickable = !!item.route;

  return (
    <Card
      onClick={clickable ? () => router.push(item.route!) : undefined}
      className={cn(
        'group relative flex h-full min-h-[276px] flex-col justify-between overflow-hidden rounded-[2.5rem] border border-slate-200 bg-white/60 p-7 shadow-lg backdrop-blur-xl transition-all duration-500 dark:border-slate-800 dark:bg-slate-900/60 dark:shadow-none',
        clickable && 'cursor-pointer hover:border-primary/40 hover:shadow-2xl dark:hover:border-primary/40',
        item.soon && 'opacity-80',
      )}
    >
      <div className={cn('pointer-events-none absolute right-0 top-0 h-32 w-32 rounded-full blur-2xl transition-transform duration-700 group-hover:scale-125', a.glow)} />

      <div className="relative z-10">
        <div className="mb-4 flex items-center justify-between">
          <div className={cn('flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border transition-transform duration-300 group-hover:scale-110', a.icon)}>
            <Icon className="h-5 w-5" />
          </div>
          <span
            className={cn(
              'inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[9px] font-black uppercase tracking-widest',
              item.soon
                ? 'border-primary/20 bg-primary/10 text-primary'
                : 'border-slate-200 bg-slate-50 text-slate-500 dark:border-slate-800/80 dark:bg-slate-950',
            )}
          >
            {item.soon && <Hourglass className="h-3 w-3" />} {item.tag}
          </span>
        </div>
        <h4 className={cn('mb-2 flex items-center gap-1.5 font-headline text-xl font-black uppercase tracking-tight text-slate-950 transition-colors dark:text-slate-50', a.hoverText)}>
          {item.title}
          {clickable && !item.soon && (
            <ArrowUpRight className="h-4 w-4 text-primary opacity-0 transition-all duration-300 group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:opacity-100" />
          )}
        </h4>
        {!item.links && <p className="text-[13px] font-medium leading-relaxed text-slate-500 dark:text-slate-400">{item.description}</p>}
      </div>

      {item.links ? (
        <ul className="relative z-10 space-y-0.5">
          {item.links.map(link => (
            <li key={link.route}>
              <button
                type="button"
                onClick={() => router.push(link.route)}
                className="flex w-full items-center justify-between border-b border-slate-100 py-1.5 text-[12px] font-semibold text-slate-700 transition-colors last:border-0 hover:text-primary dark:border-slate-800 dark:text-slate-300"
              >
                <span>{link.label}</span>
                <ChevronRight className="h-3.5 w-3.5 text-slate-400" />
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <Button
          size="sm"
          className={cn(
            'relative z-10 mt-5 h-10 w-full rounded-xl border-none text-[10px] font-extrabold uppercase tracking-wider transition-all',
            item.soon ? 'bg-slate-200 text-slate-600 hover:bg-slate-300 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700' : a.cta,
          )}
        >
          {item.cta}
        </Button>
      )}
    </Card>
  );
}

export function ModuleGrid() {
  return (
    <section
      className="mt-10 space-y-8 border-t border-slate-200/60 pt-8 animate-in fade-in slide-in-from-bottom-8 duration-1000 dark:border-slate-800/60"
      style={{ animationFillMode: 'both', animationDelay: '300ms' }}
    >
      {GROUPS.map(group => {
        const GroupIcon = group.icon;
        return (
          <div key={group.title} className="space-y-4">
            <div className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-primary/10">
                <GroupIcon className="h-4 w-4 text-primary" />
              </div>
              <h3 className="text-lg font-extrabold uppercase tracking-tight text-slate-900 dark:text-slate-100">{group.title}</h3>
            </div>
            {/* Mesma grade em todos os grupos: 3 colunas iguais e linhas de mesma altura. */}
            <div className="grid auto-rows-fr grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {group.items.map(item => (
                <ModuleCard key={item.title} item={item} />
              ))}
            </div>
          </div>
        );
      })}
    </section>
  );
}
