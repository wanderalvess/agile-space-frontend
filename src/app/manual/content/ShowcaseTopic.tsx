import React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Eye, Rocket, Presentation, MonitorPlay, Sparkles, CloudDownload, Users, ClipboardList, Wand2, PencilLine } from 'lucide-react';
import { ManualHero } from '../components/ManualHero';
import { getTopicById } from '../data/topics';

export function ShowcaseTopic() {
  const meta = getTopicById('showcase')!;

  const fluxo = [
    { title: '1. Importação', desc: 'O PO ou o Agile importa as issues do Jira pra dentro da sessão. Cada issue vira um card.', icon: CloudDownload },
    { title: '2. Preparação individual', desc: 'Cada integrante localiza os cards com o seu nome (busca ou filtro Dev/QA) e completa a evidência dos seus.', icon: Users },
    { title: '3. Prontidão', desc: 'Card com Problema, Solução e evidência completos pode ser marcado como "Pronta". O checklist de prontidão avisa o que falta.', icon: ClipboardList },
  ];

  const origem = [
    { title: 'Automático (Jira)', desc: 'Chave, título, tipo, prioridade, pontos, responsável e Critérios de Aceite. Problema e Solução são extraídos da descrição — ou do comentário da subtarefa de codificação quando a issue pai não tem — de forma tolerante a formatação inconsistente do time.', icon: Wand2 },
    { title: 'Manual (squad)', desc: 'Evidência (print ou link de vídeo) e, em cards de Métricas, os valores de impacto que geram o gráfico. Problema/Solução também podem ser corrigidos à mão quando o Jira não tiver o texto certo.', icon: PencilLine },
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
        <div className="lg:col-span-4 space-y-6">
          <div className="p-8 bg-slate-900 rounded-[2.5rem] text-white shadow-2xl shadow-slate-900/20 space-y-4">
            <h4 className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-slate-300">
              <Users className="h-4 w-4" /> Fluxo Colaborativo
            </h4>
            <p className="text-xs text-slate-300/90 leading-relaxed font-medium italic">
              &quot;Quem importa não é quem prepara. O PO ou Agile traz as issues pra sessão; cada dev/QA cuida só dos cards com o próprio nome.&quot;
            </p>
          </div>
        </div>

        <div className="lg:col-span-8">
          <Card className="border-none bg-white dark:bg-slate-900 rounded-[2.5rem] shadow-xl shadow-slate-200/40 dark:shadow-none overflow-hidden">
            <CardHeader className="p-8 pb-4 border-b border-slate-100 dark:border-slate-800">
              <CardTitle className="text-xl font-black uppercase tracking-tight text-slate-900 dark:text-slate-100">
                Como Funciona a Preparação
              </CardTitle>
              <CardDescription className="text-xs font-medium">
                Pra quem é novo no time: de onde vem cada informação do card e quem é responsável por completá-la.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-8 space-y-8">
              <div className="grid gap-3">
                {fluxo.map((step, idx) => (
                  <div key={idx} className="flex gap-4 p-4 bg-slate-50 dark:bg-slate-800/40 rounded-2xl border border-slate-100 dark:border-slate-800">
                    <div className="p-2.5 bg-white dark:bg-slate-900 rounded-xl h-fit shrink-0 shadow-sm border border-slate-100 dark:border-slate-800">
                      <step.icon className="h-4 w-4 text-pink-600" />
                    </div>
                    <div>
                      <p className="text-[11px] font-black uppercase tracking-tight leading-none mb-1.5 text-slate-800 dark:text-slate-100">{step.title}</p>
                      <p className="text-[10px] text-slate-500 dark:text-slate-400 leading-relaxed font-medium">{step.desc}</p>
                    </div>
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {origem.map((o, idx) => (
                  <div key={idx} className="p-6 rounded-3xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800 space-y-2">
                    <div className="flex items-center gap-2">
                      <o.icon className="h-5 w-5 text-pink-500" />
                      <h4 className="text-xs font-black uppercase tracking-wider text-slate-900 dark:text-slate-100">
                        {o.title}
                      </h4>
                    </div>
                    <p className="text-xs text-slate-500 dark:text-slate-400 font-medium leading-relaxed">
                      {o.desc}
                    </p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

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
