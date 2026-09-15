import React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Trophy, CheckCircle2, ShieldAlert, Sparkles, MessageSquareHeart } from 'lucide-react';
import { ManualHero } from '../components/ManualHero';
import { getTopicById } from '../data/topics';

export function RetroTopic() {
  const meta = getTopicById('retro')!;

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
        {/* Left Column: Psychological Safety */}
        <div className="lg:col-span-4 space-y-6">
          <div className="p-8 bg-orange-600 rounded-[2.5rem] text-white shadow-2xl shadow-orange-500/20 space-y-6">
            <h4 className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-orange-100">
              <MessageSquareHeart className="h-4 w-4" /> Princípios Não-Negociáveis
            </h4>
            <div className="space-y-5">
              <div className="space-y-1.5">
                <p className="text-xs font-black uppercase tracking-wider text-orange-100">Segurança Psicológica</p>
                <p className="text-xs text-white/90 leading-relaxed font-medium">
                  Todos assumem que os colegas agiram com as melhores intenções e com as informações disponíveis no momento. Sem caça às bruxas.
                </p>
              </div>
              <div className="space-y-1.5">
                <p className="text-xs font-black uppercase tracking-wider text-orange-100">Filtro de Ruído</p>
                <p className="text-xs text-white/90 leading-relaxed font-medium">
                  A votação por pontos garante que a squad debata os tópicos sistêmicos mais impactantes, em vez de focar apenas no desabafo recente.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Columns & Workflow */}
        <div className="lg:col-span-8">
          <Card className="border-none bg-white dark:bg-slate-900 rounded-[2.5rem] shadow-xl shadow-slate-200/40 dark:shadow-none overflow-hidden">
            <CardHeader className="p-8 pb-4 border-b border-slate-100 dark:border-slate-800">
              <CardTitle className="text-xl font-black uppercase tracking-tight text-slate-900 dark:text-slate-100">
                O Ciclo de Melhoria Contínua
              </CardTitle>
              <CardDescription className="text-xs font-medium">
                Estrutura das três colunas táticas da retrospectiva.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-8 space-y-8">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="p-5 rounded-2xl bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-100 dark:border-emerald-800/40 space-y-2">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-5 bg-emerald-500 rounded-full" />
                    <h4 className="font-black uppercase tracking-wider text-xs text-emerald-900 dark:text-emerald-300">
                      O que foi bom
                    </h4>
                  </div>
                  <p className="text-xs text-slate-600 dark:text-slate-400 font-medium leading-relaxed">
                    Vitórias celebradas, acordos de trabalho que funcionaram bem e práticas para manter.
                  </p>
                </div>

                <div className="p-5 rounded-2xl bg-rose-50/50 dark:bg-rose-950/20 border border-rose-100 dark:border-rose-800/40 space-y-2">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-5 bg-rose-500 rounded-full" />
                    <h4 className="font-black uppercase tracking-wider text-xs text-rose-900 dark:text-rose-300">
                      O que melhorar
                    </h4>
                  </div>
                  <p className="text-xs text-slate-600 dark:text-slate-400 font-medium leading-relaxed">
                    Gargalos operacionais, quebras de expectativa, falhas de comunicação e débitos técnicos.
                  </p>
                </div>

                <div className="p-5 rounded-2xl bg-blue-50/50 dark:bg-blue-950/20 border border-blue-100 dark:border-blue-800/40 space-y-2">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-5 bg-blue-500 rounded-full" />
                    <h4 className="font-black uppercase tracking-wider text-xs text-blue-900 dark:text-blue-300">
                      Ações Práticas
                    </h4>
                  </div>
                  <p className="text-xs text-slate-600 dark:text-slate-400 font-medium leading-relaxed">
                    Compromissos firmes com prazo e dono para serem executados na próxima Sprint.
                  </p>
                </div>
              </div>

              {/* Facilitator powers */}
              <div className="p-6 bg-slate-900 rounded-3xl text-white flex flex-col md:flex-row gap-6 items-center">
                <div className="w-12 h-12 bg-white/10 rounded-2xl flex items-center justify-center shrink-0">
                  <Trophy className="h-6 w-6 text-orange-400" />
                </div>
                <div className="space-y-1">
                  <h4 className="font-black uppercase tracking-widest text-xs text-orange-400">
                    Facilitação Turbinada
                  </h4>
                  <p className="text-xs text-slate-300 font-medium leading-relaxed">
                    O facilitador pode &quot;Revelar Cards&quot; no momento ideal, agrupar sentimentos duplicados, zerar votos para desempates rápidos e importar planos de ação da sessão anterior para aferir se os combinados foram cumpridos.
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
