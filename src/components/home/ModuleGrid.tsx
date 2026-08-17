'use client';

import { useRouter } from 'next/navigation';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Rocket,
  LayoutGrid,
  Target,
  LayoutDashboard,
  HeartPulse,
  Lightbulb,
  ListChecks,
  TestTube,
  LifeBuoy,
  Sparkles,
  BookOpen,
  FileText,
  Library,
  ShieldCheck,
  ChevronRight,
  ArrowUpRight
} from 'lucide-react';

export function ModuleGrid() {
  const router = useRouter();

  return (
    <section className="space-y-8 pt-8 border-t border-slate-200/60 dark:border-slate-800/60 mt-10 animate-in fade-in slide-in-from-bottom-8 duration-1000" style={{ animationDelay: '0.2s' }}>

      {/* GROUP 1: Gestão de Fluxo e Entregas */}
      <div className="space-y-4">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-orange-500/10 flex items-center justify-center shrink-0">
            <Rocket className="h-4 w-4 text-primary" />
          </div>
          <h3 className="text-lg font-extrabold uppercase tracking-tight text-slate-900 dark:text-slate-100">Gestão de Fluxo e Entregas</h3>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">

          {/* CARD 1: Workspace */}
          <Card
            onClick={() => router.push('/workspace')}
            className="group relative border border-slate-200 dark:border-slate-800 bg-white/60 dark:bg-slate-900/60 backdrop-blur-xl rounded-[2.5rem] p-7 shadow-lg hover:shadow-2xl dark:shadow-none hover:border-primary/40 dark:hover:border-primary/40 transition-all duration-500 cursor-pointer flex flex-col justify-between h-full min-h-[260px] overflow-hidden"
          >
            {/* Card Glow */}
            <div className="absolute top-0 right-0 w-32 h-32 bg-orange-500/5 dark:bg-orange-500/10 rounded-full blur-2xl group-hover:scale-125 transition-transform duration-700 pointer-events-none" />

            <div>
              <div className="flex items-center justify-between mb-4 relative z-10">
                <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center shrink-0 border border-primary/20 group-hover:scale-110 transition-transform duration-300">
                  <LayoutGrid className="h-5 w-5 text-primary" />
                </div>
                <span className="text-[9px] font-black text-slate-500 dark:text-slate-500 uppercase tracking-widest bg-slate-50 dark:bg-slate-950 px-2.5 py-1 rounded-full border border-slate-200 dark:border-slate-800/80">Kanban</span>
              </div>
              <h4 className="text-xl font-black uppercase tracking-tight text-slate-950 dark:text-slate-50 mb-2 group-hover:text-primary transition-colors flex items-center gap-1.5 relative z-10">
                Meu Quadro <ArrowUpRight className="h-4 w-4 opacity-0 group-hover:opacity-100 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-all duration-300 text-primary" />
              </h4>
              <p className="text-[13px] font-medium text-slate-500 dark:text-slate-400 leading-relaxed relative z-10">
                Sua área de trabalho com Kanban pessoal, tarefas e agendas integradas de forma simples.
              </p>
            </div>
            <Button
              size="sm"
              className="w-full h-10 bg-primary hover:bg-orange-600 text-white font-extrabold uppercase text-[10px] tracking-wider rounded-xl transition-all border-none mt-5 relative z-10"
            >
              Acessar Quadro
            </Button>
          </Card>

          {/* CARD 2: Planejador de Entregas */}
          <Card
            onClick={() => router.push('/sprint-planner')}
            className="group relative border border-slate-200 dark:border-slate-800 bg-white/60 dark:bg-slate-900/60 backdrop-blur-xl rounded-[2.5rem] p-7 shadow-lg hover:shadow-2xl dark:shadow-none hover:border-blue-500/40 dark:hover:border-blue-500/40 transition-all duration-500 cursor-pointer flex flex-col justify-between h-full min-h-[260px] overflow-hidden"
          >
            {/* Card Glow */}
            <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/5 dark:bg-blue-500/10 rounded-full blur-2xl group-hover:scale-125 transition-transform duration-700 pointer-events-none" />

            <div>
              <div className="flex items-center justify-between mb-4 relative z-10">
                <div className="w-10 h-10 bg-blue-50 dark:bg-blue-950/30 rounded-xl flex items-center justify-center shrink-0 border border-blue-500/20 group-hover:scale-110 transition-transform duration-300">
                  <Target className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                </div>
                <span className="text-[9px] font-black text-slate-500 dark:text-slate-500 uppercase tracking-widest bg-slate-50 dark:bg-slate-950 px-2.5 py-1 rounded-full border border-slate-200 dark:border-slate-800/80">Sprint</span>
              </div>
              <h4 className="text-xl font-black uppercase tracking-tight text-slate-950 dark:text-slate-50 mb-2 group-hover:text-blue-600 dark:group-hover:text-blue-450 transition-colors flex items-center gap-1.5 relative z-10">
                Planejador <ArrowUpRight className="h-4 w-4 opacity-0 group-hover:opacity-100 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-all duration-300 text-blue-600 dark:text-blue-450" />
              </h4>
              <p className="text-[13px] font-medium text-slate-500 dark:text-slate-400 leading-relaxed relative z-10">
                Calcule a capacidade do time e planeje a carga de trabalho de forma realista.
              </p>
            </div>
            <Button
              size="sm"
              className="w-full h-10 bg-blue-600 hover:bg-blue-700 text-white font-extrabold uppercase text-[10px] tracking-wider rounded-xl transition-all border-none mt-5 relative z-10"
            >
              Explorar Planner
            </Button>
          </Card>

          {/* CARD 3: Zephyr QA Bridge */}
          <Card
            onClick={() => router.push('/devtools/xlsx-to-csv')}
            className="group relative border border-slate-200 dark:border-slate-800 bg-white/60 dark:bg-slate-900/60 backdrop-blur-xl rounded-[2.5rem] p-7 shadow-lg hover:shadow-2xl dark:shadow-none hover:border-cyan-500/40 dark:hover:border-cyan-500/40 transition-all duration-500 cursor-pointer flex flex-col justify-between h-full min-h-[260px] overflow-hidden"
          >
            {/* Card Glow */}
            <div className="absolute top-0 right-0 w-32 h-32 bg-cyan-500/5 dark:bg-cyan-500/10 rounded-full blur-2xl group-hover:scale-125 transition-transform duration-700 pointer-events-none" />

            <div>
              <div className="flex items-center justify-between mb-4 relative z-10">
                <div className="w-10 h-10 bg-cyan-50 dark:bg-cyan-950/30 rounded-xl flex items-center justify-center shrink-0 border border-cyan-500/20 group-hover:scale-110 transition-transform duration-300">
                  <TestTube className="h-5 w-5 text-cyan-600 dark:text-cyan-400" />
                </div>
                <span className="text-[9px] font-black text-slate-500 dark:text-slate-500 uppercase tracking-widest bg-slate-50 dark:bg-slate-950 px-2.5 py-1 rounded-full border border-slate-200 dark:border-slate-800/80">Qualidade</span>
              </div>
              <h4 className="text-xl font-black uppercase tracking-tight text-slate-950 dark:text-slate-50 mb-2 group-hover:text-cyan-600 dark:group-hover:text-cyan-400 transition-colors flex items-center gap-1.5 relative z-10">
                Zephyr Bridge <ArrowUpRight className="h-4 w-4 opacity-0 group-hover:opacity-100 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-all duration-300 text-cyan-600 dark:text-cyan-400" />
              </h4>
              <p className="text-[13px] font-medium text-slate-500 dark:text-slate-400 leading-relaxed relative z-10">
                Converta e integre planilhas de testes (Test Cases) diretamente com a API do Zephyr.
              </p>
            </div>
            <Button
              size="sm"
              className="w-full h-10 bg-cyan-500 hover:bg-cyan-600 text-white font-extrabold uppercase text-[10px] tracking-wider rounded-xl transition-all border-none mt-5 relative z-10"
            >
              Abrir Bridge
            </Button>
          </Card>
        </div>
      </div>

      {/* GROUP 2: Colaboração & Clima do Time */}
      <div className="space-y-4">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-emerald-500/10 flex items-center justify-center shrink-0">
            <LayoutDashboard className="h-4 w-4 text-emerald-600" />
          </div>
          <h3 className="text-lg font-extrabold uppercase tracking-tight text-slate-900 dark:text-slate-100">Colaboração & Clima do Time</h3>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">

          {/* CARD 4: Radar de Clima */}
          <Card
            onClick={() => router.push('/health-check')}
            className="group relative border border-slate-200 dark:border-slate-800 bg-white/60 dark:bg-slate-900/60 backdrop-blur-xl rounded-[2.5rem] p-7 shadow-lg hover:shadow-2xl dark:shadow-none hover:border-rose-500/40 dark:hover:border-rose-500/40 transition-all duration-500 cursor-pointer flex flex-col justify-between h-full min-h-[260px] overflow-hidden"
          >
            {/* Card Glow */}
            <div className="absolute top-0 right-0 w-32 h-32 bg-rose-500/5 dark:bg-rose-500/10 rounded-full blur-2xl group-hover:scale-125 transition-transform duration-700 pointer-events-none" />

            <div>
              <div className="flex items-center justify-between mb-4 relative z-10">
                <div className="w-10 h-10 bg-rose-50 dark:bg-rose-950/30 rounded-xl flex items-center justify-center shrink-0 border border-rose-500/20 group-hover:scale-110 transition-transform duration-300">
                  <HeartPulse className="h-5 w-5 text-rose-500 dark:text-rose-400" />
                </div>
                <span className="text-[9px] font-black text-slate-500 dark:text-slate-500 uppercase tracking-widest bg-slate-50 dark:bg-slate-950 px-2.5 py-1 rounded-full border border-slate-200 dark:border-slate-800/80">Clima</span>
              </div>
              <h4 className="text-xl font-black uppercase tracking-tight text-slate-950 dark:text-slate-50 mb-2 group-hover:text-rose-500 dark:group-hover:text-rose-400 transition-colors flex items-center gap-1.5 relative z-10">
                Radar de Clima <ArrowUpRight className="h-4 w-4 opacity-0 group-hover:opacity-100 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-all duration-300 text-rose-500 dark:text-rose-400" />
              </h4>
              <p className="text-[13px] font-medium text-slate-500 dark:text-slate-400 leading-relaxed relative z-10">
                Participe de pesquisas rápidas e anônimas sobre a satisfação e saúde do time.
              </p>
            </div>
            <Button
              size="sm"
              className="w-full h-10 bg-rose-500 hover:bg-rose-600 text-white font-extrabold uppercase text-[10px] tracking-wider rounded-xl transition-all border-none mt-5 relative z-10"
            >
              Ver Radar
            </Button>
          </Card>

          {/* CARD 5: Painel de Ideias */}
          <Card
            onClick={() => router.push('/brainstorming')}
            className="group relative border border-slate-200 dark:border-slate-800 bg-white/60 dark:bg-slate-900/60 backdrop-blur-xl rounded-[2.5rem] p-7 shadow-lg hover:shadow-2xl dark:shadow-none hover:border-amber-500/40 dark:hover:border-amber-500/40 transition-all duration-500 cursor-pointer flex flex-col justify-between h-full min-h-[260px] overflow-hidden"
          >
            {/* Card Glow */}
            <div className="absolute top-0 right-0 w-32 h-32 bg-amber-500/5 dark:bg-amber-500/10 rounded-full blur-2xl group-hover:scale-125 transition-transform duration-700 pointer-events-none" />

            <div>
              <div className="flex items-center justify-between mb-4 relative z-10">
                <div className="w-10 h-10 bg-amber-50 dark:bg-amber-950/30 rounded-xl flex items-center justify-center shrink-0 border border-amber-500/20 group-hover:scale-110 transition-transform duration-300">
                  <Lightbulb className="h-5 w-5 text-amber-500 dark:text-amber-400" />
                </div>
                <span className="text-[9px] font-black text-slate-500 dark:text-slate-500 uppercase tracking-widest bg-slate-50 dark:bg-slate-950 px-2.5 py-1 rounded-full border border-slate-200 dark:border-slate-800/80">Ideias</span>
              </div>
              <h4 className="text-xl font-black uppercase tracking-tight text-slate-950 dark:text-slate-50 mb-2 group-hover:text-amber-500 dark:group-hover:text-amber-400 transition-colors flex items-center gap-1.5 relative z-10">
                Painel de Ideias <ArrowUpRight className="h-4 w-4 opacity-0 group-hover:opacity-100 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-all duration-300 text-amber-500 dark:text-amber-400" />
              </h4>
              <p className="text-[13px] font-medium text-slate-500 dark:text-slate-400 leading-relaxed relative z-10">
                Crie quadros de ideias e faça sessões criativas de brainstorming com o grupo.
              </p>
            </div>
            <Button
              size="sm"
              className="w-full h-10 bg-amber-500 hover:bg-amber-600 text-white font-extrabold uppercase text-[10px] tracking-wider rounded-xl transition-all border-none mt-5 relative z-10"
            >
              Abrir Módulo
            </Button>
          </Card>

          {/* CARD 6: Plano de Ação */}
          <Card
            onClick={() => router.push('/action-plan')}
            className="group relative border border-slate-200 dark:border-slate-800 bg-white/60 dark:bg-slate-900/60 backdrop-blur-xl rounded-[2.5rem] p-7 shadow-lg hover:shadow-2xl dark:shadow-none hover:border-fuchsia-500/40 dark:hover:border-fuchsia-500/40 transition-all duration-500 cursor-pointer flex flex-col justify-between h-full min-h-[260px] overflow-hidden"
          >
            {/* Card Glow */}
            <div className="absolute top-0 right-0 w-32 h-32 bg-fuchsia-500/5 dark:bg-fuchsia-500/10 rounded-full blur-2xl group-hover:scale-125 transition-transform duration-700 pointer-events-none" />

            <div>
              <div className="flex items-center justify-between mb-4 relative z-10">
                <div className="w-10 h-10 bg-fuchsia-50 dark:bg-fuchsia-950/30 rounded-xl flex items-center justify-center shrink-0 border border-fuchsia-500/20 group-hover:scale-110 transition-transform duration-300">
                  <ListChecks className="h-5 w-5 text-fuchsia-500 dark:text-fuchsia-400" />
                </div>
                <span className="text-[9px] font-black text-slate-500 dark:text-slate-500 uppercase tracking-widest bg-slate-50 dark:bg-slate-950 px-2.5 py-1 rounded-full border border-slate-200 dark:border-slate-800/80">Ações</span>
              </div>
              <h4 className="text-xl font-black uppercase tracking-tight text-slate-950 dark:text-slate-50 mb-2 group-hover:text-fuchsia-500 dark:group-hover:text-fuchsia-400 transition-colors flex items-center gap-1.5 relative z-10">
                Plano de Ação <ArrowUpRight className="h-4 w-4 opacity-0 group-hover:opacity-100 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-all duration-300 text-fuchsia-500 dark:text-fuchsia-400" />
              </h4>
              <p className="text-[13px] font-medium text-slate-600 dark:text-slate-400 leading-relaxed relative z-10">
                Organize tarefas e responsabilidades utilizando matrizes de planejamento.
              </p>
            </div>
            <Button
              size="sm"
              className="w-full h-10 bg-fuchsia-500 hover:bg-fuchsia-600 text-white font-extrabold uppercase text-[10px] tracking-wider rounded-xl transition-all border-none mt-5 relative z-10"
            >
              Criar Matriz
            </Button>
          </Card>
        </div>
      </div>

      {/* GROUP 3: Utilidades & Suporte */}
      <div className="space-y-4">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-blue-500/10 flex items-center justify-center shrink-0">
            <LifeBuoy className="h-4 w-4 text-blue-500" />
          </div>
          <h3 className="text-lg font-extrabold uppercase tracking-tight text-slate-900 dark:text-slate-100">Utilidades & Suporte</h3>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">

          {/* CARD 7: Guia de Conhecimento */}
          <Card
            onClick={() => router.push('/knowledge/kb')}
            className="group relative border border-slate-200 dark:border-slate-800 bg-white/60 dark:bg-slate-900/60 backdrop-blur-xl rounded-[2.5rem] p-7 shadow-lg hover:shadow-2xl dark:shadow-none hover:border-cyan-500/40 dark:hover:border-cyan-500/40 transition-all duration-500 cursor-pointer flex flex-col justify-between h-full min-h-[260px] overflow-hidden"
          >
            {/* Card Glow */}
            <div className="absolute top-0 right-0 w-32 h-32 bg-cyan-500/5 dark:bg-cyan-500/10 rounded-full blur-2xl group-hover:scale-125 transition-transform duration-700 pointer-events-none" />

            <div>
              <div className="flex items-center justify-between mb-4 relative z-10">
                <div className="w-10 h-10 bg-cyan-50 dark:bg-cyan-950/30 rounded-xl flex items-center justify-center shrink-0 border border-cyan-500/20 group-hover:scale-110 transition-transform duration-300">
                  <BookOpen className="h-5 w-5 text-cyan-600 dark:text-cyan-400" />
                </div>
                <span className="text-[9px] font-black text-slate-500 dark:text-slate-500 uppercase tracking-widest bg-slate-50 dark:bg-slate-950 px-2.5 py-1 rounded-full border border-slate-200 dark:border-slate-800/80">Wiki</span>
              </div>
              <h4 className="text-xl font-black uppercase tracking-tight text-slate-950 dark:text-slate-50 mb-2 group-hover:text-cyan-600 dark:group-hover:text-cyan-400 transition-colors flex items-center gap-1.5 relative z-10">
                Conhecimento <ArrowUpRight className="h-4 w-4 opacity-0 group-hover:opacity-100 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-all duration-300 text-cyan-600 dark:text-cyan-400" />
              </h4>
              <p className="text-[13px] font-medium text-slate-600 dark:text-slate-400 leading-relaxed relative z-10">
                Wiki interna com manuais, documentação técnica de sistemas e guias práticos da squad.
              </p>
            </div>
            <Button
              size="sm"
              className="w-full h-10 bg-cyan-500 hover:bg-cyan-600 text-white font-extrabold uppercase text-[10px] tracking-wider rounded-xl transition-all border-none mt-5 relative z-10"
            >
              Acessar Wiki
            </Button>
          </Card>

          {/* CARD 8: Modelos de Texto */}
          <Card
            onClick={() => router.push('/prompt-hub')}
            className="group relative border border-slate-200 dark:border-slate-800 bg-white/60 dark:bg-slate-900/60 backdrop-blur-xl rounded-[2.5rem] p-7 shadow-lg hover:shadow-2xl dark:shadow-none hover:border-blue-500/40 dark:hover:border-blue-500/40 transition-all duration-500 cursor-pointer flex flex-col justify-between h-full min-h-[260px] overflow-hidden"
          >
            {/* Card Glow */}
            <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/5 dark:bg-blue-500/10 rounded-full blur-2xl group-hover:scale-125 transition-transform duration-700 pointer-events-none" />

            <div>
              <div className="flex items-center justify-between mb-4 relative z-10">
                <div className="w-10 h-10 bg-blue-50 dark:bg-blue-950/30 rounded-xl flex items-center justify-center shrink-0 border border-blue-500/20 group-hover:scale-110 transition-transform duration-300">
                  <Library className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                </div>
                <span className="text-[9px] font-black text-slate-500 dark:text-slate-500 uppercase tracking-widest bg-slate-50 dark:bg-slate-950 px-2.5 py-1 rounded-full border border-slate-200 dark:border-slate-800/80">Biblioteca</span>
              </div>
              <h4 className="text-xl font-black uppercase tracking-tight text-slate-950 dark:text-slate-50 mb-2 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors flex items-center gap-1.5 relative z-10">
                Biblioteca de IA <ArrowUpRight className="h-4 w-4 opacity-0 group-hover:opacity-100 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-all duration-300 text-blue-600 dark:text-blue-400" />
              </h4>
              <p className="text-[13px] font-medium text-slate-600 dark:text-slate-400 leading-relaxed relative z-10">
                Prompts, skills, agentes, Gems e iniciativas de IA da empresa — em um lugar só.
              </p>
            </div>
            <Button
              size="sm"
              className="w-full h-10 bg-blue-600 hover:bg-blue-750 text-white font-extrabold uppercase text-[10px] tracking-wider rounded-xl transition-all border-none mt-5 relative z-10"
            >
              Abrir biblioteca
            </Button>
          </Card>

          {/* CARD 9: Políticas & Ajuda */}
          <Card className="group relative border border-slate-200 dark:border-slate-800 bg-white/60 dark:bg-slate-900/60 backdrop-blur-xl rounded-[2.5rem] p-7 shadow-lg hover:shadow-2xl dark:shadow-none transition-all duration-500 flex flex-col justify-between h-full min-h-[260px] overflow-hidden">
            {/* Card Glow */}
            <div className="absolute top-0 right-0 w-32 h-32 bg-slate-500/5 dark:bg-slate-500/10 rounded-full blur-2xl group-hover:scale-125 transition-transform duration-700 pointer-events-none" />

            <div>
              <div className="flex items-center justify-between mb-4 relative z-10">
                <div className="w-10 h-10 bg-slate-900 dark:bg-slate-850 rounded-xl flex items-center justify-center shrink-0 border border-slate-700">
                  <ShieldCheck className="h-5 w-5 text-white" />
                </div>
                <span className="text-[9px] font-black text-slate-500 dark:text-slate-500 uppercase tracking-widest bg-slate-50 dark:bg-slate-950 px-2.5 py-1 rounded-full border border-slate-200 dark:border-slate-800/80">Suporte</span>
              </div>

              <div className="space-y-2.5 relative z-10">
                <button
                  onClick={() => router.push('/governance')}
                  className="w-full flex items-center justify-between text-[12px] font-semibold text-slate-700 dark:text-slate-350 hover:text-primary transition-colors py-1.5 border-b border-slate-100 dark:border-slate-800/80"
                >
                  <span>Diretrizes de Segurança</span>
                  <ChevronRight className="h-3.5 w-3.5 text-slate-400" />
                </button>
                <button
                  onClick={() => router.push('/changelog')}
                  className="w-full flex items-center justify-between text-[12px] font-semibold text-slate-700 dark:text-slate-350 hover:text-primary transition-colors py-1.5 border-b border-slate-100 dark:border-slate-800/80"
                >
                  <span>Evolução da Plataforma</span>
                  <ChevronRight className="h-3.5 w-3.5 text-slate-400" />
                </button>
                <button
                  onClick={() => router.push('/manual')}
                  className="w-full flex items-center justify-between text-[12px] font-semibold text-slate-700 dark:text-slate-350 hover:text-primary transition-colors py-1.5 border-b border-slate-100 dark:border-slate-800/80"
                >
                  <span>Manual do Usuário</span>
                  <ChevronRight className="h-3.5 w-3.5 text-slate-400" />
                </button>
                <button
                  onClick={() => router.push('/support')}
                  className="w-full flex items-center justify-between text-[12px] font-semibold text-slate-700 dark:text-slate-350 hover:text-primary transition-colors py-1.5"
                >
                  <span>Suporte & Chamados</span>
                  <ChevronRight className="h-3.5 w-3.5 text-slate-400" />
                </button>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </section>
  );
}
