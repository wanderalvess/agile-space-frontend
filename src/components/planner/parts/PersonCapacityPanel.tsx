'use client';

import React, { useMemo } from 'react';
import { Users } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import type { PlannerTask } from '../types';
import { getTaskAssignments } from '../types';
import type { TeamMember } from './CapacityEngine';
import { computeMemberCapacityHours } from '../lib/capacity';

interface PersonCapacityPanelProps {
  tasks: PlannerTask[];
  sprintMembers: TeamMember[];
  workingDays: number;
}

export function PersonCapacityPanel({ tasks, sprintMembers, workingDays }: PersonCapacityPanelProps) {
  const allocatedByMember = useMemo(() => {
    const map = new Map<string, number>();
    tasks.flatMap(getTaskAssignments).forEach(a => {
      if (!a.assigneeId) return;
      map.set(a.assigneeId, (map.get(a.assigneeId) || 0) + a.hours);
    });
    return map;
  }, [tasks]);

  if (sprintMembers.length === 0) return null;

  return (
    <Card className="border border-white/60 dark:border-slate-800 bg-white/40 dark:bg-slate-900/40 backdrop-blur-xl shadow-xl shadow-violet-500/5 rounded-[2.5rem] overflow-hidden">
      <CardHeader className="pb-3 pt-5 px-6">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-2xl bg-fuchsia-600 text-white shadow-lg shadow-fuchsia-500/30">
            <Users className="h-4 w-4" />
          </div>
          <div>
            <CardTitle className="text-sm font-black uppercase tracking-tighter text-slate-800 dark:text-slate-100">Carga por Pessoa</CardTitle>
            <CardDescription className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-none mt-0.5">Alocado x Disponível</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="px-6 pb-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {sprintMembers.map(member => {
          const allocated = allocatedByMember.get(member.id) || 0;
          const available = computeMemberCapacityHours(member, workingDays);
          const pct = available > 0 ? (allocated / available) * 100 : (allocated > 0 ? 100 : 0);
          const overloaded = allocated > available;

          return (
            <div key={member.id} className="p-4 rounded-2xl bg-white/60 dark:bg-slate-900/60 border border-slate-100 dark:border-slate-800 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-black uppercase tracking-tight text-slate-800 dark:text-slate-100 truncate">
                  {member.name || 'Sem nome'}
                </span>
                {overloaded && (
                  <span className="text-[8px] font-black uppercase tracking-widest text-red-600 bg-red-50 dark:bg-red-950/40 px-1.5 py-0.5 rounded-md shrink-0">
                    Sobrecarregado
                  </span>
                )}
              </div>
              <div className="h-2 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                <div
                  className={cn('h-full rounded-full transition-all', overloaded ? 'bg-red-500' : 'bg-emerald-500')}
                  style={{ width: `${Math.min(pct, 100)}%` }}
                />
              </div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                {Math.round(allocated)}h / {Math.round(available)}h
              </p>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
