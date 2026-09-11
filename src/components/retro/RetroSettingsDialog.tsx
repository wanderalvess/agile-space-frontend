'use client';

import React, { useEffect, useRef, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Settings, User, Users, Clock, ThumbsUp, MessageCircleHeart } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { LucideIcon } from 'lucide-react';

export const DEFAULT_HEALTH_CHECK_QUESTION = 'Como você está chegando nessa retro?';

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
  healthCheckEnabled: boolean;
  onToggleHealthCheck: (value: boolean) => void;
  healthCheckQuestion: string;
  onHealthCheckQuestionChange: (value: string) => void;
}

const TOGGLE_ROW_ACCENTS = {
  indigo: { active: 'border-indigo-200 bg-indigo-50/50', icon: 'text-indigo-600', switch: 'data-[state=checked]:bg-indigo-600' },
  emerald: { active: 'border-emerald-200 bg-emerald-50/50', icon: 'text-emerald-600', switch: 'data-[state=checked]:bg-emerald-600' },
} as const;

export function ToggleRow({ icon: Icon, id, title, desc, checked, onChange, accent = 'indigo' }: {
  icon: LucideIcon; id: string; title: string; desc: string; checked: boolean; onChange: (v: boolean) => void;
  accent?: keyof typeof TOGGLE_ROW_ACCENTS;
}) {
  const styles = TOGGLE_ROW_ACCENTS[accent];
  return (
    <div className={cn(
      "p-4 rounded-2xl border flex items-center justify-between gap-3 transition-all",
      checked ? styles.active : "border-slate-100 bg-slate-50/50"
    )}>
      <div className="flex items-center gap-3 min-w-0">
        <div className="p-2 bg-white rounded-xl border border-slate-100 shrink-0">
          <Icon className={cn("h-4 w-4", styles.icon)} />
        </div>
        <div className="min-w-0">
          <Label htmlFor={id} className="text-[11px] font-black uppercase tracking-widest text-slate-700 cursor-pointer block truncate">{title}</Label>
          <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">{desc}</p>
        </div>
      </div>
      <Switch id={id} checked={checked} onCheckedChange={onChange} className={cn("shrink-0", styles.switch)} />
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
  healthCheckEnabled,
  onToggleHealthCheck,
  healthCheckQuestion,
  onHealthCheckQuestionChange,
}: RetroSettingsDialogProps) {
  // Buffer local: digitar não pode depender do round-trip do servidor pra
  // atualizar o campo (o value real só chega de volta via broadcast do board).
  // Debounce evita um saveOrUpdateBoard completo a cada tecla.
  const [localQuestion, setLocalQuestion] = useState(healthCheckQuestion);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    setLocalQuestion(healthCheckQuestion);
  }, [healthCheckQuestion]);

  const handleQuestionChange = (value: string) => {
    setLocalQuestion(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => onHealthCheckQuestionChange(value), 500);
  };

  useEffect(() => () => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
  }, []);

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

        <div className="space-y-5 py-4">
          <div className="space-y-2.5">
            <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 ml-1">Visibilidade e ritmo</p>
            <div className="space-y-2.5">
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

              <div className={cn(
                "p-4 rounded-2xl border transition-all",
                healthCheckEnabled ? "border-indigo-200 bg-indigo-50/50" : "border-slate-100 bg-slate-50/50"
              )}>
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="p-2 bg-white rounded-xl border border-slate-100 shrink-0">
                      <MessageCircleHeart className={cn("h-4 w-4", healthCheckEnabled ? "text-indigo-600" : "text-slate-400")} />
                    </div>
                    <div className="min-w-0">
                      <Label htmlFor="health-check-enabled" className="text-[11px] font-black uppercase tracking-widest text-slate-700 cursor-pointer block truncate">Check-in Inicial</Label>
                      <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">Pergunta antes de abrir o quadro</p>
                    </div>
                  </div>
                  <Switch
                    id="health-check-enabled"
                    checked={healthCheckEnabled}
                    onCheckedChange={onToggleHealthCheck}
                    className="shrink-0 data-[state=checked]:bg-indigo-600"
                  />
                </div>

                {healthCheckEnabled && (
                  <div className="mt-3 pt-3 border-t border-indigo-100/60 space-y-1.5">
                    <Label className="text-[9px] font-black uppercase tracking-widest text-indigo-600/80">Pergunta exibida</Label>
                    <Textarea
                      value={localQuestion}
                      onChange={(e) => handleQuestionChange(e.target.value)}
                      placeholder={DEFAULT_HEALTH_CHECK_QUESTION}
                      className="min-h-[54px] text-xs font-bold bg-white border-indigo-200 rounded-xl focus-visible:ring-indigo-500/20"
                    />
                    <p className="text-[9px] font-medium text-slate-400">vazio = usa a pergunta padrão. Some do fluxo se o switch acima ficar desligado.</p>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="space-y-2.5">
            <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 ml-1">Automação de fim de sessão</p>
            <div className="space-y-2.5">
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
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
