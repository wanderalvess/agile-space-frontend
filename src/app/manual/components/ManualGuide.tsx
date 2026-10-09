import React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { ManualHero } from './ManualHero';
import { getTopicById } from '../data/topics';

export interface GuideItem {
  title: string;
  text: React.ReactNode;
}

export interface GuideSection {
  title: string;
  description?: string;
  items: GuideItem[];
  columns?: 1 | 2;
}

export interface ManualGuideProps {
  topicId: string;
  /** Classe de fundo do cartão lateral (ex.: bg-orange-600). */
  accentClass: string;
  quoteTitle: string;
  quote: string;
  sections: GuideSection[];
  /** Avisos curtos de "o que mudou" ou limites que o usuário precisa saber. */
  notes?: { title: string; text: React.ReactNode }[];
  children?: React.ReactNode;
}

/**
 * Estrutura padrão de uma página do manual: cabeçalho do tópico, cartão lateral com a ideia central,
 * seções em cartões numerados e avisos. Os textos ficam nos arquivos de cada tópico; o que a tela
 * faz hoje deve ser conferido em docs/fluxos antes de editar.
 */
export function ManualGuide({ topicId, accentClass, quoteTitle, quote, sections, notes, children }: ManualGuideProps) {
  const meta = getTopicById(topicId)!;

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
          <div className={`p-8 ${accentClass} rounded-[2.5rem] text-white shadow-2xl space-y-4`}>
            <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-white/80">{quoteTitle}</h4>
            <p className="text-xs text-white/90 leading-relaxed font-medium italic">&ldquo;{quote}&rdquo;</p>
          </div>
          {notes?.map((note) => (
            <div key={note.title} className="p-6 bg-slate-50 dark:bg-slate-900 rounded-[2rem] border border-slate-200/80 dark:border-slate-800 space-y-2">
              <h5 className="text-[11px] font-black uppercase tracking-widest text-slate-900 dark:text-slate-100">{note.title}</h5>
              <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed font-medium">{note.text}</p>
            </div>
          ))}
        </div>

        <div className="lg:col-span-8 space-y-8">
          {sections.map((section) => (
            <Card key={section.title} className="border-none bg-white dark:bg-slate-900 rounded-[2.5rem] shadow-xl shadow-slate-200/40 dark:shadow-none overflow-hidden">
              <CardHeader className="p-8 pb-4 border-b border-slate-100 dark:border-slate-800">
                <CardTitle className="text-xl font-black uppercase tracking-tight text-slate-900 dark:text-slate-100">
                  {section.title}
                </CardTitle>
                {section.description && (
                  <CardDescription className="text-xs font-medium">{section.description}</CardDescription>
                )}
              </CardHeader>
              <CardContent className="p-8">
                <div className={section.columns === 1 ? 'grid grid-cols-1 gap-4' : 'grid grid-cols-1 md:grid-cols-2 gap-4'}>
                  {section.items.map((item, idx) => (
                    <div key={item.title} className="p-5 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 space-y-2">
                      <h4 className="flex items-center gap-2 font-black uppercase tracking-widest text-xs text-slate-900 dark:text-slate-100">
                        <span className="w-6 h-6 rounded-lg bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 flex items-center justify-center text-[10px] shrink-0">
                          {idx + 1}
                        </span>
                        {item.title}
                      </h4>
                      <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed font-medium">{item.text}</p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {children}
    </div>
  );
}
