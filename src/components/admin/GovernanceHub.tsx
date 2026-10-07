'use client';

import React from 'react';
import { JiraSyncPanel } from '@/components/admin/JiraSyncPanel';
import { ShieldCheck } from 'lucide-react';

// Gestão de roster/membros de squad mudou de casa: agora vive em /squad/roster,
// com gate de negócio (Agile Master/Tech Lead/etc), não mais atrás do admin de
// sistema. Aqui fica só o setup Jira org-wide (PAT/project key), que é mesmo
// tarefa de sysadmin.
export function GovernanceHub() {
  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex items-center gap-3">
        <div className="p-2.5 bg-primary/10 rounded-2xl border border-primary/20">
          <ShieldCheck className="h-6 w-6 text-primary" />
        </div>
        <div>
          <h2 className="text-2xl font-black uppercase tracking-tighter italic font-headline text-slate-900 dark:text-slate-100">
            Sincronização Jira
          </h2>
          <p className="text-[11px] font-black uppercase tracking-widest text-slate-500 mt-0.5">
            Setup de credencial e projeto Jira pra toda a organização
          </p>
        </div>
      </div>

      <JiraSyncPanel onSyncSuccess={() => {}} />
    </div>
  );
}
