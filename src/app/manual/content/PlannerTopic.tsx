import React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Calculator, Users, ListPlus, Zap, ArrowRight, ShieldCheck } from 'lucide-react';
import { ManualHero } from '../components/ManualHero';
import { getTopicById } from '../data/topics';
import Link from 'next/link';
import { Button } from '@/components/ui/button';

export function PlannerTopic() {
  const meta = getTopicById('planner')!;

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
        {/* Formula Engine */}
        <div className="lg:col-span-4 space-y-6">
          <div className="p-8 bg-indigo-600 rounded-[2.5rem] text-white shadow-2xl shadow-indigo-500/20 space-y-6">
            <h4 className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-indigo-100">
              <Calculator className="h-4 w-4" /> Algoritmo de Capacidade Real
            </h4>
            <p className="text-xs text-indigo-100/90 leading-relaxed font-medium">
              Elimine o otimismo cego no planejamento. O cálculo desconta cerimônias, ausências programadas e dispersão natural:
            </p>
            <div className="p-4 bg-white/10 rounded-2xl font-mono text-[11px] border border-white/20 text-white font-bold leading-relaxed">
              Capacidade = (Dias Úteis × Horas Diárias × Fator de Foco) − Ausências & Feriados
            </div>
          </div>
        </div>

        {/* Configuration Steps */}
        <div className="lg:col-span-8">
          <Card className="border-none bg-white dark:bg-slate-900 rounded-[2.5rem] shadow-xl shadow-slate-200/40 dark:shadow-none overflow-hidden">
            <CardHeader className="p-8 pb-4 border-b border-slate-100 dark:border-slate-800">
              <CardTitle className="text-xl font-black uppercase tracking-tight text-slate-900 dark:text-slate-100">
                Guia de Refinamento de Capacidade
              </CardTitle>
              <CardDescription className="text-xs font-medium">
                Passo a passo para dimensionar o compromisso da Sprint.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-8 space-y-8">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="p-6 rounded-3xl bg-indigo-50/50 dark:bg-indigo-950/20 border border-indigo-100 dark:border-indigo-800/40 space-y-3">
                  <h4 className="font-black uppercase tracking-widest text-[11px] text-indigo-700 dark:text-indigo-300 flex items-center gap-2">
                    <Users className="h-4 w-4" /> 1. Parâmetros de Squad
                  </h4>
                  <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed font-medium">
                    Configure individualmente cada membro (DEV ou QA), seus dias de férias ou feriados municipais, e o <strong>Fator de Foco</strong> (ex: 0.7 para quem participa de muitas reuniões de suporte).
                  </p>
                </div>

                <div className="p-6 rounded-3xl bg-indigo-50/50 dark:bg-indigo-950/20 border border-indigo-100 dark:border-indigo-800/40 space-y-3">
                  <h4 className="font-black uppercase tracking-widest text-[11px] text-indigo-700 dark:text-indigo-300 flex items-center gap-2">
                    <ListPlus className="h-4 w-4" /> 2. Escopo & Termômetro
                  </h4>
                  <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed font-medium">
                    À medida que as tarefas são selecionadas, o <strong>Termômetro de Carga</strong> indica em tempo real se a Sprint está saudável, no limite ou em estado de sobrecarga (Overload).
                  </p>
                </div>
              </div>

              {/* Seamless Poker Import Highlight */}
              <div className="p-6 bg-slate-900 rounded-3xl text-white flex flex-col md:flex-row gap-6 items-center">
                <div className="w-12 h-12 bg-white/10 rounded-2xl flex items-center justify-center shrink-0">
                  <Zap className="h-6 w-6 text-indigo-400" />
                </div>
                <div className="space-y-1">
                  <h4 className="font-black uppercase tracking-widest text-xs text-indigo-400">
                    Importação Direta do Scrum Poker
                  </h4>
                  <p className="text-xs text-slate-300 font-medium leading-relaxed">
                    Zero retrabalho: você pode puxar todo o conjunto de tarefas estimadas em uma sala de Poker recém-finalizada, trazendo os títulos, links de Jira e valores de consenso com um único clique.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
