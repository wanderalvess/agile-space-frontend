import React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Eye, Rocket, Presentation, MonitorPlay, Sparkles } from 'lucide-react';
import { ManualHero } from '../components/ManualHero';
import { getTopicById } from '../data/topics';

export function ShowcaseTopic() {
  const meta = getTopicById('showcase')!;

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
          <div className="p-8 bg-pink-600 rounded-[2.5rem] text-white shadow-2xl shadow-pink-500/20 space-y-4">
            <h4 className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-pink-100">
              <Rocket className="h-4 w-4" /> Go-to-Market Interno
            </h4>
            <p className="text-xs text-pink-100/90 leading-relaxed font-medium italic">
              &quot;Engenharia de valor é saber comunicar com clareza o que foi construído. O Showcase é seu principal aliado na hora da Sprint Review com stakeholders.&quot;
            </p>
          </div>
        </div>

        <div className="lg:col-span-8">
          <Card className="border-none bg-white dark:bg-slate-900 rounded-[2.5rem] shadow-xl shadow-slate-200/40 dark:shadow-none overflow-hidden">
            <CardHeader className="p-8 pb-4 border-b border-slate-100 dark:border-slate-800">
              <CardTitle className="text-xl font-black uppercase tracking-tight text-slate-900 dark:text-slate-100">
                Apresentação Executiva & Modo Teatro
              </CardTitle>
              <CardDescription className="text-xs font-medium">
                Transforme dados da entrega em slides visuais de alta qualidade.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-8 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="p-6 rounded-3xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800 space-y-2">
                  <div className="flex items-center gap-2">
                    <Presentation className="h-5 w-5 text-pink-500" />
                    <h4 className="text-xs font-black uppercase tracking-wider text-slate-900 dark:text-slate-100">
                      1. Geração de Slides
                    </h4>
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 font-medium leading-relaxed">
                    O sistema monta lâminas visuais com itens entregues, metas alcançadas e métricas técnicas da Sprint, sem exigir montagem manual no PowerPoint.
                  </p>
                </div>

                <div className="p-6 rounded-3xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800 space-y-2">
                  <div className="flex items-center gap-2">
                    <MonitorPlay className="h-5 w-5 text-pink-500" />
                    <h4 className="text-xs font-black uppercase tracking-wider text-slate-900 dark:text-slate-100">
                      2. Modo Teatro Imersivo
                    </h4>
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 font-medium leading-relaxed">
                    Experiência em tela cheia com navegação rápida pelo teclado (setas direcionais e barra de espaço) ideal para compartilhamento de tela em chamadas.
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
