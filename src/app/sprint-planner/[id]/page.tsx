'use client';

import { use, Suspense } from 'react';
import { EliteSpinner } from '@/components/ui/EliteSpinner';
import { SprintPlannerContent } from '@/components/planner/SprintPlannerContent';

export default function SprintPlannerSessionPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  const roomId = resolvedParams.id;

  return (
    <Suspense fallback={
       <div className="h-screen w-full flex flex-col items-center justify-center bg-[#fafafa] gap-6">
         <EliteSpinner size="lg" />
         <p className="text-[10px] font-black uppercase tracking-[0.4em] ml-[0.4em] text-slate-400 animate-pulse">Sincronizando Sessão...</p>
       </div>
    }>
      <SprintPlannerContent initialPlannerId={roomId} />
    </Suspense>
  );
}
