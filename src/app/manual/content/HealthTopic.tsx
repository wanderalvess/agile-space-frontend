import React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { ShieldCheck, HeartPulse, Sparkles, Activity, AlertCircle } from 'lucide-react';
import { ManualHero } from '../components/ManualHero';
import { getTopicById } from '../data/topics';

export function HealthTopic() {
  const meta = getTopicById('health')!;

  return (
    <div className="space-y-10">
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
          <div className="p-8 bg-primary rounded-2xl text-primary-foreground shadow-sm space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-primary-foreground/10 flex items-center justify-center">
              <ShieldCheck className="h-6 w-6 text-primary-foreground" />
            </div>
            <h4 className="text-sm font-bold tracking-normal text-primary-foreground">
              Anonimato Radical & Blindagem
            </h4>
            <p className="text-xs text-primary-foreground/90 leading-relaxed font-medium">
              Ninguém sabe quem votou em qual dimensão. O sistema agrupa e pondera as respostas apenas no encerramento coletivo para proteger a verdade e a integridade de opiniões sinceras.
            </p>
          </div>
        </div>

        {/* Right Column: Diagnostic Dimensions */}
        <div className="lg:col-span-8">
          <Card className="border-none bg-card rounded-2xl shadow-xl shadow-black/10 dark:shadow-none overflow-hidden">
            <CardHeader className="p-8 pb-4 border-b border-border">
              <CardTitle className="text-xl font-bold tracking-tight text-foreground">
                Como Funciona o Diagnóstico
              </CardTitle>
              <CardDescription className="text-xs font-medium">
                Avaliação sem notas complexas: modelo de semáforo (Verde, Amarelo e Vermelho).
              </CardDescription>
            </CardHeader>
            <CardContent className="p-8 space-y-8">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="p-6 rounded-3xl bg-muted/40 border border-border space-y-3">
                  <h4 className="font-bold tracking-normal text-xs text-emerald-700 dark:text-emerald-400 flex items-center gap-2">
                    <Activity className="h-4 w-4" /> 1. Dimensões de Saúde
                  </h4>
                  <p className="text-xs text-muted-foreground leading-relaxed font-medium">
                    A squad avalia 5 pilares universais: <strong>Qualidade do Código</strong>, <strong>Clareza de Missão</strong>, <strong>Processos & Ritos</strong>, <strong>Autonomia Técnica</strong> e <strong>Ambiente & Diversão</strong>.
                  </p>
                </div>

                <div className="p-6 rounded-3xl bg-muted/40 border border-border space-y-3">
                  <h4 className="font-bold tracking-normal text-xs text-emerald-700 dark:text-emerald-400 flex items-center gap-2">
                    <Sparkles className="h-4 w-4" /> 2. Gráfico Radar
                  </h4>
                  <p className="text-xs text-muted-foreground leading-relaxed font-medium">
                    O encerramento plota o polígono de forças da squad. As pontas recolhidas denunciam os débitos de cultura ou processo que demandam ações imediatas no próximo ciclo.
                  </p>
                </div>
              </div>

              <div className="p-6 bg-emerald-50 dark:bg-emerald-950/20 rounded-3xl border border-emerald-100 dark:border-emerald-800/40 flex items-center gap-4">
                <div className="w-10 h-10 rounded-xl bg-primary text-primary-foreground flex items-center justify-center shrink-0">
                  <HeartPulse className="h-5 w-5" />
                </div>
                <div>
                  <h5 className="text-xs font-bold tracking-normal text-emerald-900 dark:text-emerald-300">
                    Dica de Evolução Temporal
                  </h5>
                  <p className="text-xs text-muted-foreground font-medium">
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
