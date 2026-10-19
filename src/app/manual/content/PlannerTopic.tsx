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
        {/* Formula Engine */}
        <div className="lg:col-span-4 space-y-6">
          <div className="p-8 bg-primary rounded-2xl text-primary-foreground shadow-2xl shadow-primary/20 space-y-6">
            <h4 className="flex items-center gap-2 text-xs font-bold tracking-normal text-primary [.theme-totvs:not(.dark)_&]:text-foreground">
              <Calculator className="h-4 w-4" /> Algoritmo de Capacidade Real
            </h4>
            <p className="text-xs text-primary [.theme-totvs:not(.dark)_&]:text-foreground leading-relaxed font-medium">
              Elimine o otimismo cego no planejamento. O cálculo desconta cerimônias, ausências programadas e dispersão natural:
            </p>
            <div className="p-4 bg-card/10 rounded-2xl font-mono text-xs border border-border/20 text-foreground font-bold leading-relaxed">
              Capacidade = (Dias Úteis × Horas Diárias × Fator de Foco) − Ausências & Feriados
            </div>
          </div>
        </div>

        {/* Configuration Steps */}
        <div className="lg:col-span-8">
          <Card className="border-none bg-card rounded-2xl shadow-xl shadow-black/10 dark:shadow-none overflow-hidden">
            <CardHeader className="p-8 pb-4 border-b border-border">
              <CardTitle className="text-xl font-bold tracking-tight text-foreground">
                Guia de Refinamento de Capacidade
              </CardTitle>
              <CardDescription className="text-xs font-medium">
                Passo a passo para dimensionar o compromisso da Sprint.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-8 space-y-8">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="p-6 rounded-3xl bg-primary/10 dark:bg-primary/20 border border-primary/30 dark:border-primary/40 space-y-3">
                  <h4 className="font-bold tracking-normal text-xs text-primary [.theme-totvs:not(.dark)_&]:text-foreground flex items-center gap-2">
                    <Users className="h-4 w-4" /> 1. Parâmetros de Squad
                  </h4>
                  <p className="text-xs text-muted-foreground leading-relaxed font-medium">
                    Configure individualmente cada membro (DEV ou QA), seus dias de férias ou feriados municipais, e o <strong>Fator de Foco</strong> (ex: 0.7 para quem participa de muitas reuniões de suporte).
                  </p>
                </div>

                <div className="p-6 rounded-3xl bg-primary/10 dark:bg-primary/20 border border-primary/30 dark:border-primary/40 space-y-3">
                  <h4 className="font-bold tracking-normal text-xs text-primary [.theme-totvs:not(.dark)_&]:text-foreground flex items-center gap-2">
                    <ListPlus className="h-4 w-4" /> 2. Escopo & Termômetro
                  </h4>
                  <p className="text-xs text-muted-foreground leading-relaxed font-medium">
                    À medida que as tarefas são selecionadas, o <strong>Termômetro de Carga</strong> indica em tempo real se a Sprint está saudável, no limite ou em estado de sobrecarga.
                  </p>
                </div>
              </div>

              {/* Seamless Poker Import Highlight */}
              <div className="p-6 bg-card rounded-3xl text-foreground flex flex-col md:flex-row gap-6 items-center">
                <div className="w-12 h-12 bg-card/10 rounded-2xl flex items-center justify-center shrink-0">
                  <Zap className="h-6 w-6 text-primary [.theme-totvs:not(.dark)_&]:text-foreground" />
                </div>
                <div className="space-y-1">
                  <h4 className="font-bold tracking-normal text-xs text-primary [.theme-totvs:not(.dark)_&]:text-foreground">
                    Importação Direta do Scrum Poker
                  </h4>
                  <p className="text-xs text-muted-foreground font-medium leading-relaxed">
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
