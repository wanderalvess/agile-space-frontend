"use client";

import { useState, useCallback, useEffect } from 'react';
import { BentoGrid } from '@/components/home/BentoGrid';
import { ModuleGrid } from '@/components/home/ModuleGrid';
import { FeedbackWidget } from '@/components/feedback-widget';
import { Footer } from '@/components/layout/Footer';

export default function Home() {
  const [feedbackSignal, setFeedbackSignal] = useState<number | undefined>();

  // Title effect
  useEffect(() => {
    if (typeof document !== 'undefined') {
      document.title = `Hub | Espaço Ágil`;
    }
  }, []);

  const handleOpenFeedback = useCallback(() => {
    setFeedbackSignal(Date.now());
  }, []);

  return (
    <div className="relative flex-1 w-full overflow-x-hidden bg-[#fafafa] dark:bg-slate-950 min-h-dvh font-sans selection:bg-primary/30 text-slate-900 dark:text-slate-100">
      {/* ELITE MESH GRADIENT BACKGROUND */}
      <div className="fixed top-0 left-0 w-full h-full -z-10 pointer-events-none overflow-hidden">
        <div className="absolute top-[-10%] left-[-10%] w-[70%] h-[70%] bg-primary/5 rounded-full blur-[160px] animate-pulse"></div>
        <div className="absolute bottom-[-10%] right-[-10%] w-[60%] h-[60%] bg-blue-500/5 rounded-full blur-[140px] animate-pulse" style={{ animationDelay: '2s' }}></div>
      </div>

      <div className="relative z-10 flex flex-col w-full min-h-dvh pt-4">
        {/* MAIN BODY CONTAINER */}
        <main className="flex-1 px-4 pb-8 md:px-8 lg:px-10 space-y-4 max-w-full w-full mx-auto">
          
          {/* BENTO GRID DASHBOARD */}
          <BentoGrid />

          {/* ALL PLATFORM MODULES GRID */}
          <ModuleGrid />
        </main>

        <Footer onOpenFeedback={handleOpenFeedback} />
      </div>

      <FeedbackWidget toolName="Espaço Ágil - Hub" triggerVariant="none" externalTriggerSignal={feedbackSignal} />
    </div>
  );
}

