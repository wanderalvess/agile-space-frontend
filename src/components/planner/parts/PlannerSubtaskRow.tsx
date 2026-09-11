'use client';

import React from 'react';
import { Trash2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { PlannerDatePicker } from './PlannerDatePicker';
import type { PlannerSubtask } from '../types';
import type { TeamMember } from './CapacityEngine';
import { cn } from '@/lib/utils';

interface PlannerSubtaskRowProps {
  subtask: PlannerSubtask;
  sprintMembers: TeamMember[];
  sprintStartDate: string;
  isReadOnly?: boolean;
  onUpdate: (updates: Partial<PlannerSubtask>) => void;
  onRemove: () => void;
}

export function PlannerSubtaskRow({
  subtask,
  sprintMembers,
  sprintStartDate,
  isReadOnly = false,
  onUpdate,
  onRemove,
}: PlannerSubtaskRowProps) {
  const hasRoster = sprintMembers.length > 0;

  return (
    <div className="p-3 rounded-2xl bg-white/60 dark:bg-slate-900/60 border border-slate-100 dark:border-slate-800 space-y-2.5">
      <div className="flex items-center gap-2">
        <Input
          value={subtask.name}
          onChange={e => onUpdate({ name: e.target.value })}
          placeholder="Nome da subtarefa..."
          disabled={isReadOnly}
          className="h-9 flex-1 text-xs font-bold bg-slate-50 dark:bg-slate-950/60 border-none rounded-xl"
        />
        {!isReadOnly && (
          <Button
            variant="ghost"
            size="icon"
            onClick={onRemove}
            className="h-9 w-9 shrink-0 text-slate-300 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 rounded-xl"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        )}
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
        <div className="space-y-1">
          <span className="text-[8px] font-black uppercase tracking-widest text-slate-400 pl-1">Papel</span>
          <Select value={subtask.role || 'dev'} onValueChange={(val) => onUpdate({ role: val as 'dev' | 'qa' })} disabled={isReadOnly}>
            <SelectTrigger className="h-9 text-[10px] font-black uppercase bg-slate-50 dark:bg-slate-950/60 border-none rounded-xl">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="dev">Dev</SelectItem>
              <SelectItem value="qa">QA</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1">
          <span className="text-[8px] font-black uppercase tracking-widest text-slate-400 pl-1">Responsável</span>
          <Select
            value={subtask.assigneeId || ''}
            onValueChange={(val) => {
              const member = sprintMembers.find(m => m.id === val);
              onUpdate({ assigneeId: val, role: member?.role || subtask.role });
            }}
            disabled={isReadOnly || !hasRoster}
          >
            <SelectTrigger className={cn("h-9 text-[10px] font-bold bg-slate-50 dark:bg-slate-950/60 border-none rounded-xl", !hasRoster && "text-slate-400")}>
              <SelectValue placeholder={hasRoster ? 'Selecionar...' : 'Sem roster'} />
            </SelectTrigger>
            <SelectContent>
              {sprintMembers.map(m => (
                <SelectItem key={m.id} value={m.id}>{m.name || 'Sem nome'}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1">
          <span className="text-[8px] font-black uppercase tracking-widest text-slate-400 pl-1">Horas</span>
          <Input
            type="number"
            value={subtask.hours}
            onChange={e => onUpdate({ hours: Number(e.target.value) || 0 })}
            min={0}
            disabled={isReadOnly}
            className="h-9 text-xs font-black text-center bg-slate-50 dark:bg-slate-950/60 border-none rounded-xl"
          />
        </div>

        <div className="space-y-1">
          <span className="text-[8px] font-black uppercase tracking-widest text-slate-400 pl-1">Início</span>
          <PlannerDatePicker
            value={subtask.startDate}
            onChange={(val) => onUpdate({ startDate: val })}
            min={sprintStartDate}
            placeholder="Início"
            disabled={isReadOnly}
          />
        </div>

        <div className="space-y-1">
          <span className="text-[8px] font-black uppercase tracking-widest text-slate-400 pl-1">Fim</span>
          <PlannerDatePicker
            value={subtask.endDate}
            onChange={(val) => onUpdate({ endDate: val })}
            min={subtask.startDate || sprintStartDate}
            placeholder="Fim"
            disabled={isReadOnly}
          />
        </div>
      </div>
    </div>
  );
}
