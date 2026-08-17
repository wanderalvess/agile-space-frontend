'use client';

import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Settings, User, Users, Clock, ThumbsUp } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { LucideIcon } from 'lucide-react';

interface RetroSettingsDialogProps {
  isOpen: boolean;
  onClose: () => void;
  isAuthorsRevealed: boolean;
  onToggleAuthorsRevealed: (value: boolean) => void;
  syncStageEnabled: boolean;
  onToggleSyncStage: (value: boolean) => void;
  autoRevealOnTimerEnd: boolean;
  onToggleAutoRevealOnTimerEnd: (value: boolean) => void;
  autoSortOnVoteEnd: boolean;
  onToggleAutoSortOnVoteEnd: (value: boolean) => void;
}

function ToggleRow({ icon: Icon, id, title, desc, checked, onChange }: {
  icon: LucideIcon; id: string; title: string; desc: string; checked: boolean; onChange: (v: boolean) => void;
}) {
  return (
    <div className={cn(
      "p-4 rounded-2xl border flex items-center justify-between gap-3 transition-all",
      checked ? "border-indigo-200 bg-indigo-50/50" : "border-slate-100 bg-slate-50/50"
    )}>
      <div className="flex items-center gap-3 min-w-0">
        <div className="p-2 bg-white rounded-xl border border-slate-100 shrink-0">
          <Icon className="h-4 w-4 text-indigo-600" />
        </div>
        <div className="min-w-0">
          <Label htmlFor={id} className="text-[11px] font-black uppercase tracking-widest text-slate-700 cursor-pointer block truncate">{title}</Label>
          <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">{desc}</p>
        </div>
      </div>
      <Switch id={id} checked={checked} onCheckedChange={onChange} className="shrink-0 data-[state=checked]:bg-indigo-600" />
    </div>
  );
}

export function RetroSettingsDialog({
  isOpen,
  onClose,
  isAuthorsRevealed,
  onToggleAuthorsRevealed,
  syncStageEnabled,
  onToggleSyncStage,
  autoRevealOnTimerEnd,
  onToggleAutoRevealOnTimerEnd,
  autoSortOnVoteEnd,
  onToggleAutoSortOnVoteEnd,
}: RetroSettingsDialogProps) {
  return (
    <Dialog open={isOpen} onOpenChange={(val) => !val && onClose()}>
      <DialogContent className="sm:max-w-[500px] rounded-[3rem] border-none shadow-2xl bg-white/95 backdrop-blur-xl">
        <DialogHeader>
          <div className="w-12 h-12 rounded-2xl bg-indigo-600 flex items-center justify-center mb-4 shadow-lg shadow-indigo-600/20 text-white">
            <Settings className="h-6 w-6" />
          </div>
          <DialogTitle className="text-3xl font-black uppercase tracking-tighter text-slate-800 leading-none">Configurações</DialogTitle>
          <DialogDescription className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-2">Ajustes da cerimônia — só o facilitador vê isso</DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-4 font-sans">
          <ToggleRow
            icon={User}
            id="authors-revealed"
            title="Autores Abertos"
            desc="Mostra quem escreveu cada card"
            checked={isAuthorsRevealed}
            onChange={onToggleAuthorsRevealed}
          />
          <ToggleRow
            icon={Users}
            id="sync-stage"
            title="Sincronizar Coluna Ativa"
            desc="Todos veem a coluna que você está focando"
            checked={syncStageEnabled}
            onChange={onToggleSyncStage}
          />
          <ToggleRow
            icon={Clock}
            id="auto-reveal-timer"
            title="Auto-revelar ao fim do timer"
            desc="Revela os cards sozinho quando o tempo zera"
            checked={autoRevealOnTimerEnd}
            onChange={onToggleAutoRevealOnTimerEnd}
          />
          <ToggleRow
            icon={ThumbsUp}
            id="auto-sort-vote"
            title="Ordenar por votos ao encerrar"
            desc="Aplica em todas as colunas de feedback"
            checked={autoSortOnVoteEnd}
            onChange={onToggleAutoSortOnVoteEnd}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}
