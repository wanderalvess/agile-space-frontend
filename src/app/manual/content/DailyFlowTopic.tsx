import React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Zap, Users, AlertCircle, Clock, ShieldCheck } from 'lucide-react';
import { ManualHero } from '../components/ManualHero';
import { getTopicById } from '../data/topics';

export function DailyFlowTopic() {
  const meta = getTopicById('daily-flow')!;

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
        <div className="lg:col-span-4 space-y-6">
          <div className="p-8 bg-indigo-600 rounded-[2.5rem] text-white shadow-2xl shadow-indigo-500/20 space-y-6">
            <h4 className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-indigo-200">
              <Zap className="h-4 w-4" /> Filosofia Assíncrona
            </h4>
            <p className="text-xs text-indigo-100/90 leading-relaxed font-medium">
              Daily meetings síncronas de 30 minutos cortam o foco de engenharia. O Daily Flow foi desenhado para sincronização rápida em texto, mantendo a reunião síncrona de 5 a 10 minutos exclusivamente focada nos impedimentos.
            </p>
          </div>
        </div>

        <div className="lg:col-span-8">
          <Card className="border-none bg-white dark:bg-slate-900 rounded-[2.5rem] shadow-xl shadow-slate-200/40 dark:shadow-none overflow-hidden">
            <CardHeader className="p-8 pb-4 border-b border-slate-100 dark:border-slate-800">
              <CardTitle className="text-xl font-black uppercase tracking-tight text-slate-900 dark:text-slate-100">
                Como Operar o Daily Flow
              </CardTitle>
              <CardDescription className="text-xs font-medium">
                Check-in diário de 2 minutos para cada desenvolvedor e QA.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-8 space-y-8">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="p-6 rounded-3xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800 space-y-3">
                  <h4 className="font-black uppercase tracking-widest text-[11px] text-indigo-700 dark:text-indigo-400 flex items-center gap-2">
                    <Clock className="h-4 w-4" /> 1. Ontem & Hoje
                  </h4>
                  <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed font-medium">
                    Preencha o que concluiu e qual o foco cirúrgico do dia. Textos objetivos facilitam a leitura panorâmica da squad inteira em menos de 1 minuto.
                  </p>
                </div>

                <div className="p-6 rounded-3xl bg-rose-50/60 dark:bg-rose-950/20 border border-rose-100 dark:border-rose-900/40 space-y-3">
                  <h4 className="font-black uppercase tracking-widest text-[11px] text-rose-700 dark:text-rose-400 flex items-center gap-2">
                    <AlertCircle className="h-4 w-4" /> 2. Alerta de Bloqueio (Red Glow)
                  </h4>
                  <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed font-medium">
                    Se estiver travado por credencial, API externa ou dependência de terceiros, ative a flag de bloqueio. O card ganha destaque visual vermelho imediato no mural.
                  </p>
                </div>
              </div>

              <div className="p-6 bg-slate-900 rounded-3xl text-white flex items-center gap-4">
                <Users className="h-8 w-8 text-indigo-400 shrink-0" />
                <div className="space-y-1">
                  <h5 className="text-xs font-black uppercase tracking-wider text-indigo-400">
                    Segmentação Automática por Squad
                  </h5>
                  <p className="text-xs text-slate-300 font-medium">
                    O painel sincroniza dinamicamente apenas os membros da sua squad ativa, evitando sobrecarga com dados de outros times.
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
