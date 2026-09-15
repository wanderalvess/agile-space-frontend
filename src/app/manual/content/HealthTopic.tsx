import React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { ShieldCheck, HeartPulse, Sparkles, Activity, AlertCircle } from 'lucide-react';
import { ManualHero } from '../components/ManualHero';
import { getTopicById } from '../data/topics';

export function HealthTopic() {
  const meta = getTopicById('health')!;

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
        {/* Left Column: Radical Anonymity */}
        <div className="lg:col-span-4 space-y-6">
          <div className="p-8 bg-emerald-600 rounded-[2.5rem] text-white shadow-2xl shadow-emerald-500/20 space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-white/10 flex items-center justify-center">
              <ShieldCheck className="h-6 w-6 text-emerald-200" />
            </div>
            <h4 className="text-sm font-black uppercase tracking-wider text-emerald-100">
              Anonimato Radical & Blindagem
            </h4>
            <p className="text-xs text-emerald-100/90 leading-relaxed font-medium">
              Ninguém sabe quem votou em qual dimensão. O sistema agrupa e pondera as respostas apenas no encerramento coletivo para proteger a verdade e a integridade de opiniões sinceras.
            </p>
          </div>
        </div>

        {/* Right Column: Diagnostic Dimensions */}
        <div className="lg:col-span-8">
          <Card className="border-none bg-white dark:bg-slate-900 rounded-[2.5rem] shadow-xl shadow-slate-200/40 dark:shadow-none overflow-hidden">
            <CardHeader className="p-8 pb-4 border-b border-slate-100 dark:border-slate-800">
              <CardTitle className="text-xl font-black uppercase tracking-tight text-slate-900 dark:text-slate-100">
                Como Funciona o Diagnóstico
              </CardTitle>
              <CardDescription className="text-xs font-medium">
                Avaliação sem notas complexas: modelo de semáforo (Verde, Amarelo e Vermelho).
              </CardDescription>
            </CardHeader>
            <CardContent className="p-8 space-y-8">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="p-6 rounded-3xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800 space-y-3">
                  <h4 className="font-black uppercase tracking-widest text-[11px] text-emerald-700 dark:text-emerald-400 flex items-center gap-2">
                    <Activity className="h-4 w-4" /> 1. Dimensões de Saúde
                  </h4>
                  <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed font-medium">
                    A squad avalia 5 pilares universais: <strong>Qualidade do Código</strong>, <strong>Clareza de Missão</strong>, <strong>Processos & Ritos</strong>, <strong>Autonomia Técnica</strong> e <strong>Ambiente & Diversão</strong>.
                  </p>
                </div>

                <div className="p-6 rounded-3xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800 space-y-3">
                  <h4 className="font-black uppercase tracking-widest text-[11px] text-emerald-700 dark:text-emerald-400 flex items-center gap-2">
                    <Sparkles className="h-4 w-4" /> 2. Gráfico Radar
                  </h4>
                  <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed font-medium">
                    O encerramento plota o polígono de forças da squad. As pontas recolhidas denunciam os débitos de cultura ou processo que demandam ações imediatas no próximo ciclo.
                  </p>
                </div>
              </div>

              <div className="p-6 bg-emerald-50 dark:bg-emerald-950/20 rounded-3xl border border-emerald-100 dark:border-emerald-800/40 flex items-center gap-4">
                <div className="w-10 h-10 rounded-xl bg-emerald-500 text-white flex items-center justify-center shrink-0">
                  <HeartPulse className="h-5 w-5" />
                </div>
                <div>
                  <h5 className="text-xs font-black uppercase tracking-wider text-emerald-900 dark:text-emerald-300">
                    Dica de Evolução Temporal
                  </h5>
                  <p className="text-xs text-slate-600 dark:text-slate-400 font-medium">
                    Execute o Radar a cada 3 ou 4 Sprints e sobreponha os gráficos para comprovar visualmente a maturação do time para a liderança.
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
