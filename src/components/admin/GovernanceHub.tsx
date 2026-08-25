'use client';

import React, { useState, useEffect } from 'react';
import { JiraSyncPanel } from '@/components/admin/JiraSyncPanel';
import { ProjectSelectorCard } from '@/components/admin/ProjectSelectorCard';
import { SquadMembersTable } from '@/components/admin/SquadMembersTable';
import { ShieldCheck } from 'lucide-react';
import { useUserContext } from '@/context/UserContext';
import { useAuth } from '@/context/AuthContext';

export function GovernanceHub() {
  const { userProfile } = useUserContext();
  const { session } = useAuth();
  const activeProjectId = userProfile?.squadId || session?.activeProjectId || null;
  const [selectedSquadId, setSelectedSquadId] = useState<string | null>(activeProjectId);

  useEffect(() => {
    if (activeProjectId && (!selectedSquadId || selectedSquadId === '')) {
      setSelectedSquadId(activeProjectId);
    }
  }, [activeProjectId, selectedSquadId]);

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex items-center gap-3">
        <div className="p-2.5 bg-primary/10 rounded-2xl border border-primary/20">
          <ShieldCheck className="h-6 w-6 text-primary" />
        </div>
        <div>
          <h2 className="text-2xl font-black uppercase tracking-tighter italic font-headline text-slate-900 dark:text-slate-100">
            Hub de Governança
          </h2>
          <p className="text-[11px] font-black uppercase tracking-widest text-slate-500 mt-0.5">
            Sincronize projetos Jira e gerencie membros da squad com governança ágil
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <JiraSyncPanel onSyncSuccess={(squadId) => setSelectedSquadId(squadId)} />
        </div>
        <div className="lg:col-span-1">
          <ProjectSelectorCard
            selectedSquadId={selectedSquadId}
            onSelectSquad={setSelectedSquadId}
          />
        </div>
      </div>

      {selectedSquadId && (
        <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
          <SquadMembersTable squadId={selectedSquadId} />
        </div>
      )}
    </div>
  );
}
