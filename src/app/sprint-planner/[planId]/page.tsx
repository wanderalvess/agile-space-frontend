'use client';

import { Suspense, use } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { EmptyState, LoadingSkeleton, PageShell } from '@/components/page';
import { moduleLabel } from '@/lib/modules-registry';
import { PlanScreen } from '@/components/sprint-planner/PlanScreen';
import { useAuth } from '@/context/AuthContext';
import { useActiveSquad } from '@/hooks/useActiveSquad';
import { isStepId, type StepId } from '@/lib/sprint-planner/format';

function PlanRoute({ planId }: { planId: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const { isLoading } = useAuth();
  const { squadId } = useActiveSquad();
  const raw = params.get('etapa');
  const step: StepId = isStepId(raw) ? raw : 'capacidade';

  const onStepChange = (next: StepId) => {
    const q = new URLSearchParams(params.toString());
    if (next === 'capacidade') q.delete('etapa');
    else q.set('etapa', next);
    const qs = q.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  };

  if (isLoading) return <LoadingSkeleton variant="page" />;
  if (!squadId) {
    return <EmptyState title="Escolha uma squad" description="O planejamento é por squad. Escolha a squad ativa no cabeçalho." />;
  }
  return <PlanScreen key={`${squadId}-${planId}`} squadId={squadId} planId={planId} step={step} onStepChange={onStepChange} />;
}

export default function SprintPlanPage({ params }: { params: Promise<{ planId: string }> }) {
  const { planId } = use(params);
  return (
    <PageShell documentTitle={moduleLabel('sprint-planner')}>
      <Suspense fallback={<LoadingSkeleton variant="page" />}>
        <PlanRoute planId={planId} />
      </Suspense>
    </PageShell>
  );
}
