import React from 'react';
import { IntegrationsSection } from '@/components/manual/IntegrationsSection';
import { ManualHero } from '../components/ManualHero';
import { getTopicById } from '../data/topics';

export function IntegracoesTopic() {
  const meta = getTopicById('integracoes')!;

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
      />

      <div className="bg-card rounded-2xl p-6 md:p-8 border border-border/80 dark:border-border shadow-xl shadow-black/10 dark:shadow-none">
        <IntegrationsSection />
      </div>
    </div>
  );
}
