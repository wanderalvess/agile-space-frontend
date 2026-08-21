'use client';

import React, { useState } from 'react';
import { JiraSyncPanel } from '@/components/admin/JiraSyncPanel';
import { ProjectSelectorCard } from '@/components/admin/ProjectSelectorCard';
import { SquadMembersTable } from '@/components/admin/SquadMembersTable';

export function GovernanceHub() {
  const [selectedSquadId, setSelectedSquadId] = useState<string | null>(null);

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-black uppercase tracking-tighter italic font-headline text-slate-900 dark:text-slate-100">
          Hub de Governança
        </h2>
        <p className="text-[11px] font-black uppercase tracking-widest text-slate-400 mt-1">
          Sincronize projetos Jira e gerencie membros da squad
        </p>
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
        <SquadMembersTable squadId={selectedSquadId} />
      )}
    </div>
  );
}
