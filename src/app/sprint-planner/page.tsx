'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { CalendarDays } from 'lucide-react';
import { EmptyState, LoadingSkeleton, PageShell } from '@/components/page';
import { moduleLabel } from '@/lib/modules-registry';
import { CreatePlanDialog } from '@/components/sprint-planner/CreatePlanDialog';
import { PlannerLobby } from '@/components/sprint-planner/PlannerLobby';
import { useAuth } from '@/context/AuthContext';
import { useUserContext } from '@/context/UserContext';
import { useActiveSquad } from '@/hooks/useActiveSquad';

export default function SprintPlannerPage() {
  const router = useRouter();
  const { isLoading } = useAuth();
  const { userProfile } = useUserContext();
  const { squadId, membership } = useActiveSquad();
  const [creating, setCreating] = useState(false);
  const isAdmin = userProfile?.role?.toLowerCase() === 'admin';
  const canCreate = !!membership?.leadership || isAdmin;

  return (
    <PageShell documentTitle={moduleLabel('sprint-planner')}>
      {isLoading ? (
        <LoadingSkeleton variant="cards" rows={3} />
      ) : !squadId ? (
        <EmptyState
          icon={CalendarDays}
          title="Escolha uma squad"
          description="O planejamento é por squad. Entre numa squad ou escolha a squad ativa no cabeçalho."
        />
      ) : (
        <>
          <PlannerLobby key={squadId} squadId={squadId} canCreate={canCreate} onCreate={() => setCreating(true)} />
          <CreatePlanDialog
            open={creating}
            onOpenChange={setCreating}
            squadId={squadId}
            onCreated={(plan) => {
              setCreating(false);
              router.push(`/sprint-planner/${encodeURIComponent(plan.id)}`);
            }}
          />
        </>
      )}
    </PageShell>
  );
}
