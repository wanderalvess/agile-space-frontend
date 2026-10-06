'use client';

import React from 'react';
import { RoomHeader } from '@/components/layout/RoomHeader';
import { Footer } from '@/components/layout/Footer';
import { DevToolsHub } from '@/components/devtools/DevToolsHub';

interface DevToolsHubPageProps {
  title: string;
  heading: string;
  subtitle: string;
  icon: React.ReactNode;
  collection?: 'qa';
}

// Página de hub: DevTools e Central de Qualidade compartilham a mesma estrutura.
export function DevToolsHubPage({ title, heading, subtitle, icon, collection }: DevToolsHubPageProps) {
  return (
    <div className="relative min-h-dvh bg-[#fafafa] text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden" aria-hidden>
        <div className="absolute left-[-10%] top-[-10%] h-[60%] w-[60%] rounded-full bg-primary/5 blur-[160px]" />
        <div className="absolute bottom-[-10%] right-[-10%] h-[50%] w-[50%] rounded-full bg-blue-500/5 blur-[140px]" />
      </div>
      <RoomHeader title={title} toolIcon={icon} />
      <main className="mx-auto w-full max-w-[1500px] space-y-6 px-4 py-6 md:px-8">
        <div className="space-y-1">
          <h1 className="font-headline text-3xl font-black uppercase tracking-tight sm:text-4xl">{heading}</h1>
          <p className="max-w-2xl text-sm font-medium text-muted-foreground">{subtitle}</p>
        </div>
        <DevToolsHub collection={collection} />
      </main>
      <Footer />
    </div>
  );
}
