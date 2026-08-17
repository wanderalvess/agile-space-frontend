'use client';

import { useRouter } from 'next/navigation';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  LayoutGrid,
  Target,
  HeartPulse,
  Lightbulb,
  ListChecks,
  ChevronRight,
  LifeBuoy,
  ShieldCheck,
  History,
  GitBranch,
  BookOpen
} from 'lucide-react';

export function SecondaryGrid() {
  const router = useRouter();

  const planningTools = [
    {
      title: 'Meu Quadro',
      description: 'Kanban pessoal, backlog e agenda de tarefas integradas.',
      icon: LayoutGrid,
      color: 'text-primary bg-primary/10',
      borderColor: 'hover:border-primary/30',
      route: '/workspace',
      actionLabel: 'Abrir Quadro'
    },
    {
      title: 'Planejador de Entregas',
      description: 'Calcule a capacidade real de foco e planeje sprints equilibradas.',
      icon: Target,
      color: 'text-blue-600 bg-blue-500/10 dark:text-blue-400 dark:bg-blue-950/30',
      borderColor: 'hover:border-blue-500/30',
      route: '/sprint-planner',
      actionLabel: 'Planejar Sprint'
    },
    {
      title: 'Painel de Ideias',
      description: 'Quadros colaborativos rápidos para sessões de brainstorming.',
      icon: Lightbulb,
      color: 'text-amber-500 bg-amber-500/10 dark:text-amber-400 dark:bg-amber-950/30',
      borderColor: 'hover:border-amber-500/30',
      route: '/brainstorming',
      actionLabel: 'Nova Ideia'
    },
    {
      title: 'Plano de Ação',
      description: 'Mapeie responsabilidades da squad com matrizes de priorização.',
      icon: ListChecks,
      color: 'text-fuchsia-500 bg-fuchsia-500/10 dark:text-fuchsia-400 dark:bg-fuchsia-950/30',
      borderColor: 'hover:border-fuchsia-500/30',
      route: '/action-plan',
      actionLabel: 'Criar Plano'
    }
  ];

  const helperTools = [
    {
      title: 'Radar de Clima',
      description: 'Pesquisas anônimas síncronas sobre saúde e cultura da equipe.',
      icon: HeartPulse,
      color: 'text-rose-500 bg-rose-500/10 dark:text-rose-450 dark:bg-rose-950/30',
      borderColor: 'hover:border-rose-500/30',
      route: '/health-check',
      actionLabel: 'Ver Radar'
    },
    {
      title: 'Evolução da Plataforma',
      description: 'Changelog, histórico de releases e novidades do time.',
      icon: History,
      color: 'text-violet-500 bg-violet-500/10 dark:text-violet-400 dark:bg-violet-950/30',
      borderColor: 'hover:border-violet-500/30',
      route: '/changelog',
      actionLabel: 'Changelog'
    },
    {
      title: 'Segurança & Governança',
      description: 'Regras de compliance, políticas de dados e acessos.',
      icon: ShieldCheck,
      color: 'text-emerald-500 bg-emerald-500/10 dark:text-emerald-400 dark:bg-emerald-950/30',
      borderColor: 'hover:border-emerald-500/30',
      route: '/governance',
      actionLabel: 'Políticas'
    },
    {
      title: 'Suporte & Manual',
      description: 'Manual de uso da plataforma e abertura de chamados técnicos.',
      icon: LifeBuoy,
      color: 'text-cyan-500 bg-cyan-500/10 dark:text-cyan-450 dark:bg-cyan-950/30',
      borderColor: 'hover:border-cyan-500/30',
      route: '/manual',
      actionLabel: 'Ajuda'
    }
  ];

  return (
    <section className="space-y-10 pt-8 border-t border-slate-200/60 dark:border-slate-800/60 mt-10">
      
      {/* SEÇÃO 1: Planejamento */}
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 dark:text-slate-500">Fluxos Complementares</span>
          <span className="w-1.5 h-1.5 rounded-full bg-slate-300 dark:bg-slate-600" />
        </div>
        <h3 className="text-lg font-black uppercase text-slate-900 dark:text-slate-100 tracking-tight leading-none mb-4">Planejamento e Organização</h3>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
          {planningTools.map((tool, idx) => {
            const Icon = tool.icon;
            return (
              <Card 
                key={idx}
                className={`group border border-slate-200 dark:border-slate-800 bg-white/40 dark:bg-slate-900/40 backdrop-blur-xl rounded-[2rem] p-6 shadow-sm hover:shadow-md transition-all duration-300 flex flex-col justify-between h-full ${tool.borderColor}`}
              >
                <div>
                  <div className="flex items-center gap-3 mb-3">
                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform duration-300 ${tool.color}`}>
                      <Icon className="h-4.5 w-4.5" />
                    </div>
                    <h4 className="text-[13px] font-black uppercase text-slate-950 dark:text-slate-50 tracking-wider">{tool.title}</h4>
                  </div>
                  <p className="text-[12px] font-medium text-slate-500 dark:text-slate-400 leading-relaxed mb-4">
                    {tool.description}
                  </p>
                </div>
                <Button
                  onClick={() => router.push(tool.route)}
                  variant="ghost"
                  className="w-full h-9 justify-between text-[10px] font-black uppercase tracking-wider text-slate-600 dark:text-slate-400 hover:text-primary dark:hover:text-primary hover:bg-slate-50 dark:hover:bg-slate-950 rounded-xl transition-all border border-slate-200/60 dark:border-slate-800/60 hover:border-primary/20 dark:hover:border-primary/20"
                >
                  <span>{tool.actionLabel}</span>
                  <ChevronRight className="h-3.5 w-3.5 group-hover:translate-x-0.5 transition-transform" />
                </Button>
              </Card>
            );
          })}
        </div>
      </div>

      {/* SEÇÃO 2: Clima, Changelog & Suporte */}
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 dark:text-slate-500">Cultura e Suporte</span>
          <span className="w-1.5 h-1.5 rounded-full bg-slate-300 dark:bg-slate-600" />
        </div>
        <h3 className="text-lg font-black uppercase text-slate-900 dark:text-slate-100 tracking-tight leading-none mb-4">Métricas do Time e Documentação</h3>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
          {helperTools.map((tool, idx) => {
            const Icon = tool.icon;
            return (
              <Card 
                key={idx}
                className={`group border border-slate-200 dark:border-slate-800 bg-white/40 dark:bg-slate-900/40 backdrop-blur-xl rounded-[2rem] p-6 shadow-sm hover:shadow-md transition-all duration-300 flex flex-col justify-between h-full ${tool.borderColor}`}
              >
                <div>
                  <div className="flex items-center gap-3 mb-3">
                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform duration-300 ${tool.color}`}>
                      <Icon className="h-4.5 w-4.5" />
                    </div>
                    <h4 className="text-[13px] font-black uppercase text-slate-950 dark:text-slate-50 tracking-wider">{tool.title}</h4>
                  </div>
                  <p className="text-[12px] font-medium text-slate-500 dark:text-slate-400 leading-relaxed mb-4">
                    {tool.description}
                  </p>
                </div>
                <Button
                  onClick={() => router.push(tool.route)}
                  variant="ghost"
                  className="w-full h-9 justify-between text-[10px] font-black uppercase tracking-wider text-slate-600 dark:text-slate-400 hover:text-primary dark:hover:text-primary hover:bg-slate-50 dark:hover:bg-slate-950 rounded-xl transition-all border border-slate-200/60 dark:border-slate-800/60 hover:border-primary/20 dark:hover:border-primary/20"
                >
                  <span>{tool.actionLabel}</span>
                  <ChevronRight className="h-3.5 w-3.5 group-hover:translate-x-0.5 transition-transform" />
                </Button>
              </Card>
            );
          })}
        </div>
      </div>

    </section>
  );
}
