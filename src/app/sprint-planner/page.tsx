'use client';

import { Suspense, useEffect } from 'react';
import { AgileSpinner } from '@/components/ui/AgileSpinner';
import { SprintPlannerContent } from '@/components/planner/SprintPlannerContent';

export default function SprintPlannerPage() {
  useEffect(() => {
    document.title = `Sprint Planner | Espaço Ágil`;
  }, []);

  return (
    <Suspense fallback={
      <div className="h-screen w-full flex flex-col items-center justify-center bg-[#fafafa] gap-6">
        <AgileSpinner size="lg" />
        <p className="text-[10px] font-black uppercase tracking-[0.4em] ml-[0.4em] text-slate-400 animate-pulse">Iniciando Planejamento...</p>
      </div>
    }>
      <SprintPlannerContent />
    </Suspense>
  );
}
