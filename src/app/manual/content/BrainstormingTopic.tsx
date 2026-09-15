import React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { BrainCircuit, Network, Target, BarChart3, ListTodo, Zap, Lightbulb } from 'lucide-react';
import { ManualHero } from '../components/ManualHero';
import { getTopicById } from '../data/topics';

export function BrainstormingTopic() {
  const meta = getTopicById('brainstorming')!;

  const phases = [
    { 
      title: "1. Ideação Silenciosa (Mural Livre)", 
      icon: BrainCircuit, 
      desc: "Cada participante escreve suas ideias em modo anônimo. Ninguém vê o conteúdo alheio até o momento da revelação coletiva, encorajando ideias arrojadas sem receio de julgamento precoce.",
      label: "Criatividade Solo",
      badgeColor: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300"
    },
    { 
      title: "2. Clusterização Visual", 
      icon: Network, 
      desc: "Arraste notas correlatas umas sobre as outras para formar Clusters temáticos. O grupo nomeia cada cluster para sintetizar tópicos comuns e erradicar ideias duplicadas.",
      label: "Organização",
      badgeColor: "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300"
    },
    { 
      title: "3. Votação Democrática (Dot-Voting)", 
      icon: Target, 
      desc: "Cada membro da squad recebe 5 pontos/votos para distribuir livremente entre ideias isoladas ou clusters inteiros. Revela instantaneamente a prioridade orgânica do time.",
      label: "Priorização",
      badgeColor: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300"
    },
    { 
      title: "4. Matriz ROI (Impacto vs Esforço)", 
      icon: BarChart3, 
      desc: "O facilitador projeta os cards mais votados na matriz 2x2. Prioriza-se o quadrante 'Quick Wins' (Alto Impacto, Baixo Esforço) e mapeiam-se apostas estratégicas.",
      label: "Estratégia",
      badgeColor: "bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300"
    },
    { 
      title: "5. Plano de Ação (Execution Items)", 
      icon: ListTodo, 
      desc: "A sessão não termina em ideias no ar: cada iniciativa aprovada gera um item de ação com responsável direto (Owner), prazo e link de rastreamento.",
      label: "Accountability",
      badgeColor: "bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-300"
    }
  ];

  return (
    <div className="space-y-10 animate-in fade-in duration-500">
      <ManualHero
        title={meta.title}
        subtitle={meta.subtitle}
        description={meta.description}
        icon={meta.icon}
        color={meta.color}
        badgeBg={meta.badgeBg}
        badgeBorder={meta.badgeBorder}
        badgeText={meta.badgeText}
        actionUrl={meta.actionUrl}
        actionLabel={meta.actionLabel}
      />

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Value Pitch */}
        <div className="lg:col-span-4 space-y-6">
          <div className="p-8 bg-slate-900 rounded-[2.5rem] text-white shadow-2xl space-y-6">
            <h4 className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-amber-400">
              <Zap className="h-4 w-4" /> Fluxo de Alto Rendimento
            </h4>
            <div className="space-y-4">
              {[
                { f: "Ideação sem viés", d: "Cards ocultos previnem ancoragem pelo membro mais sênior." },
                { f: "Agrupamento natural", d: "Sintetiza dezenas de insights em 3 a 5 eixos claros." },
                { f: "Decisão objetiva", d: "A Matriz de ROI elimina debates intermináveis." }
              ].map((item, i) => (
                <div key={i} className="flex gap-3 items-start">
                  <div className="w-2 h-2 rounded-full bg-amber-400 mt-1.5 shrink-0" />
                  <div>
                    <p className="text-xs font-black uppercase tracking-wider text-slate-100">{item.f}</p>
                    <p className="text-[11px] text-slate-400 font-medium leading-relaxed">{item.d}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* 5 Stages Card */}
        <div className="lg:col-span-8">
          <Card className="border-none bg-white dark:bg-slate-900 rounded-[2.5rem] shadow-xl shadow-slate-200/40 dark:shadow-none overflow-hidden">
            <CardHeader className="p-8 pb-4 border-b border-slate-100 dark:border-slate-800">
              <CardTitle className="text-xl font-black uppercase tracking-tight text-slate-900 dark:text-slate-100">
                As 5 Fases da Dinâmica
              </CardTitle>
              <CardDescription className="text-xs font-medium">
                Conduza o grupo da ideação à entrega prática com clareza total de papéis.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0 divide-y divide-slate-100 dark:divide-slate-800">
              {phases.map((phase, i) => (
                <div key={i} className="p-6 md:p-8 hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors group">
                  <div className="flex flex-col md:flex-row gap-5 items-start">
                    <div className="w-12 h-12 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center shrink-0 group-hover:bg-amber-100 group-hover:text-amber-700 dark:group-hover:bg-amber-900/40 dark:group-hover:text-amber-300 transition-all">
                      <phase.icon className="h-6 w-6" />
                    </div>
                    <div className="space-y-1.5 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h4 className="text-sm font-black uppercase tracking-wider text-slate-900 dark:text-slate-100">
                          {phase.title}
                        </h4>
                        <span className={`px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider ${phase.badgeColor}`}>
                          {phase.label}
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 dark:text-slate-400 font-medium leading-relaxed">
                        {phase.desc}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
