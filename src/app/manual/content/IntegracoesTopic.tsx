import React from 'react';
import { IntegrationsSection } from '@/components/manual/IntegrationsSection';
import { ManualHero } from '../components/ManualHero';
import { getTopicById } from '../data/topics';

export function IntegracoesTopic() {
  const meta = getTopicById('integracoes')!;

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
      />

      <div className="bg-white dark:bg-slate-900 rounded-[2.5rem] p-6 md:p-8 border border-slate-200/80 dark:border-slate-800 shadow-xl shadow-slate-200/40 dark:shadow-none">
        <IntegrationsSection />
      </div>
    </div>
  );
}
