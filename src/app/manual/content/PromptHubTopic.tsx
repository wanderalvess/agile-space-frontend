import React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { MessageSquare, GitFork, Sliders, Zap, Sparkles } from 'lucide-react';
import { ManualHero } from '../components/ManualHero';
import { ModuleApiToolSection } from '../components/ModuleApiToolSection';
import { getTopicById } from '../data/topics';

export function PromptHubTopic() {
  const meta = getTopicById('prompt-hub')!;

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
          <div className="p-8 bg-violet-600 rounded-[2.5rem] text-white shadow-2xl shadow-violet-500/20 space-y-4">
            <h4 className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-violet-100">
              <Zap className="h-4 w-4" /> Engenharia de Instrução
            </h4>
            <p className="text-xs text-violet-100/90 leading-relaxed font-medium italic">
              &quot;Um bom prompt economiza horas de código e refinamento. No Hub, transformamos intuição individual em ativos reutilizáveis para todo o time.&quot;
            </p>
          </div>
        </div>

        <div className="lg:col-span-8">
          <Card className="border-none bg-white dark:bg-slate-900 rounded-[2.5rem] shadow-xl shadow-slate-200/40 dark:shadow-none overflow-hidden">
            <CardHeader className="p-8 pb-4 border-b border-slate-100 dark:border-slate-800">
              <CardTitle className="text-xl font-black uppercase tracking-tight text-slate-900 dark:text-slate-100">
                Operação Social & Produtividade
              </CardTitle>
              <CardDescription className="text-xs font-medium">
                Como catalogar e rodar templates inteligentes de prompts.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-8 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="p-6 rounded-3xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800 space-y-2">
                  <div className="flex items-center gap-2">
                    <GitFork className="h-5 w-5 text-violet-500" />
                    <h4 className="text-xs font-black uppercase tracking-wider text-slate-900 dark:text-slate-100">
                      1. Fork & Coleção
                    </h4>
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 font-medium leading-relaxed">
                    Descubra instruções criadas por outras squads, faça um Fork para sua coleção privada e adapte as regras para seu projeto.
                  </p>
                </div>

                <div className="p-6 rounded-3xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800 space-y-2">
                  <div className="flex items-center gap-2">
                    <Sliders className="h-5 w-5 text-violet-500" />
                    <h4 className="text-xs font-black uppercase tracking-wider text-slate-900 dark:text-slate-100">
                      2. Variáveis Dinâmicas
                    </h4>
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 font-medium leading-relaxed">
                    Use marcações como <code>[CONTEXTO]</code> ou <code>[FRAMEWORK]</code> no corpo do prompt. O sistema solicita os inputs ao executar o template.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Seção Detalhada de API e MCP Tools */}
      <ModuleApiToolSection moduleId="prompt-hub" />
    </div>
  );
}
