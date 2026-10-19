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
  /** Mantido por compatibilidade: o cartão lateral sempre usa a cor de destaque do tema. */
  accentClass?: string;
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
export function ManualGuide({ topicId, quoteTitle, quote, sections, notes, children }: ManualGuideProps) {
  const meta = getTopicById(topicId)!;

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
        <div className="lg:col-span-4 space-y-6">
          <div className="p-8 bg-primary rounded-2xl text-primary-foreground shadow-sm space-y-4">
            <h4 className="text-sm font-bold tracking-normal text-primary-foreground">{quoteTitle}</h4>
            <p className="text-sm text-primary-foreground leading-relaxed font-medium">&ldquo;{quote}&rdquo;</p>
          </div>
          {notes?.map((note) => (
            <div key={note.title} className="p-6 bg-background rounded-2xl border border-border/80 space-y-2">
              <h5 className="text-xs font-bold tracking-normal text-foreground">{note.title}</h5>
              <p className="text-xs text-muted-foreground leading-relaxed font-medium">{note.text}</p>
            </div>
          ))}
        </div>

        <div className="lg:col-span-8 space-y-8">
          {sections.map((section) => (
            <Card key={section.title} className="border-none bg-card rounded-2xl shadow-xl shadow-black/10 dark:shadow-none overflow-hidden">
              <CardHeader className="p-8 pb-4 border-b border-border">
                <CardTitle className="text-xl font-bold tracking-tight text-foreground">
                  {section.title}
                </CardTitle>
                {section.description && (
                  <CardDescription className="text-xs font-medium">{section.description}</CardDescription>
                )}
              </CardHeader>
              <CardContent className="p-8">
                <div className={section.columns === 1 ? 'grid grid-cols-1 gap-4' : 'grid grid-cols-1 md:grid-cols-2 gap-4'}>
                  {section.items.map((item, idx) => (
                    <div key={item.title} className="p-5 rounded-2xl bg-background border border-border space-y-2">
                      <h4 className="flex items-center gap-2 font-bold tracking-normal text-xs text-foreground">
                        <span className="w-6 h-6 rounded-lg bg-card dark:bg-muted/60 text-foreground flex items-center justify-center text-xs shrink-0">
                          {idx + 1}
                        </span>
                        {item.title}
                      </h4>
                      <p className="text-xs text-muted-foreground leading-relaxed font-medium">{item.text}</p>
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
