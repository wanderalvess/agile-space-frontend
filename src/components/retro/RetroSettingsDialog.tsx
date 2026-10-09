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
  indigo: { active: 'border-emerald-500/40 bg-emerald-500/5', icon: 'text-emerald-500', switch: 'data-[state=checked]:bg-emerald-600' },
  emerald: { active: 'border-emerald-500/40 bg-emerald-500/5', icon: 'text-emerald-500', switch: 'data-[state=checked]:bg-emerald-600' },
} as const;

export function ToggleRow({ icon: Icon, id, title, desc, checked, onChange, accent = 'indigo' }: {
  icon: LucideIcon; id: string; title: string; desc: string; checked: boolean; onChange: (v: boolean) => void;
  accent?: keyof typeof TOGGLE_ROW_ACCENTS;
}) {
  const styles = TOGGLE_ROW_ACCENTS[accent];
  return (
    <div className={cn(
      "p-4 rounded-2xl border flex items-center justify-between gap-3 transition-all",
      checked ? styles.active : "border-border bg-muted/30"
    )}>
      <div className="flex items-center gap-3 min-w-0">
        <div className="p-2 bg-card rounded-xl border border-border shrink-0">
          <Icon className={cn("h-4 w-4", checked ? styles.icon : "text-muted-foreground")} />
        </div>
        <div className="min-w-0">
          <Label htmlFor={id} className="text-sm font-semibold text-foreground cursor-pointer block">{title}</Label>
          <p className="text-xs text-muted-foreground mt-0.5 leading-snug">{desc}</p>
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
  // Enquanto há texto digitado ainda não enviado, o eco do servidor (valor mais antigo) não pode sobrescrever o campo.
  const hasUnsentRef = useRef(false);

  useEffect(() => {
    if (hasUnsentRef.current) return;
    setLocalQuestion(healthCheckQuestion);
  }, [healthCheckQuestion]);

  const handleQuestionChange = (value: string) => {
    setLocalQuestion(value);
    hasUnsentRef.current = true;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      hasUnsentRef.current = false;
      onHealthCheckQuestionChange(value);
    }, 500);
  };

  useEffect(() => () => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
  }, []);

  return (
    <Dialog open={isOpen} onOpenChange={(val) => !val && onClose()}>
      <DialogContent className="sm:max-w-[560px] rounded-[2rem] border border-border shadow-2xl bg-card text-card-foreground">
        <DialogHeader>
          <DialogTitle className="text-2xl font-black tracking-tight text-foreground leading-none flex items-center gap-2.5"><Settings className="h-5 w-5 text-emerald-500" /> Configurações da Retro</DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground mt-1.5">Ajustes da cerimônia. Só o facilitador vê esta tela, e as mudanças valem para todo o time na hora.</DialogDescription>
        </DialogHeader>

        <div className="space-y-5 py-4">
          <div className="space-y-2.5">
            <p className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground ml-1">Durante a retro</p>
            <div className="space-y-2.5">
              <ToggleRow
                icon={User}
                id="authors-revealed"
                title="Mostrar quem escreveu cada card"
                desc="Desligado, os cards ficam anônimos para o time."
                checked={isAuthorsRevealed}
                onChange={onToggleAuthorsRevealed}
              />
              <ToggleRow
                icon={Users}
                id="sync-stage"
                title="Todos acompanham a coluna do facilitador"
                desc="A tela de cada pessoa vai para a coluna que você abrir."
                checked={syncStageEnabled}
                onChange={onToggleSyncStage}
              />

              <div className={cn(
                "p-4 rounded-2xl border transition-all",
                healthCheckEnabled ? "border-emerald-500/40 bg-emerald-500/5" : "border-border bg-muted/30"
              )}>
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="p-2 bg-card rounded-xl border border-border shrink-0">
                      <MessageCircleHeart className={cn("h-4 w-4", healthCheckEnabled ? "text-emerald-500" : "text-muted-foreground")} />
                    </div>
                    <div className="min-w-0">
                      <Label htmlFor="health-check-enabled" className="text-sm font-semibold text-foreground cursor-pointer block">Pergunta de humor antes de entrar</Label>
                      <p className="text-xs text-muted-foreground mt-0.5 leading-snug">Cada pessoa responde rapidinho antes de ver o quadro.</p>
                    </div>
                  </div>
                  <Switch
                    id="health-check-enabled"
                    checked={healthCheckEnabled}
                    onCheckedChange={onToggleHealthCheck}
                    className="shrink-0 data-[state=checked]:bg-emerald-600"
                  />
                </div>

                {healthCheckEnabled && (
                  <div className="mt-3 pt-3 border-t border-border space-y-1.5">
                    <Label className="text-xs font-semibold text-muted-foreground">Pergunta exibida</Label>
                    <Textarea
                      value={localQuestion}
                      onChange={(e) => handleQuestionChange(e.target.value)}
                      placeholder={DEFAULT_HEALTH_CHECK_QUESTION}
                      className="min-h-[54px] text-sm font-medium bg-background border-border rounded-xl focus-visible:ring-emerald-500/30"
                    />
                    <p className="text-xs text-muted-foreground">Deixe em branco para usar a pergunta padrão.</p>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="space-y-2.5">
            <p className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground ml-1">Automações</p>
            <div className="space-y-2.5">
              <ToggleRow
                icon={Clock}
                id="auto-reveal-timer"
                title="Revelar os cards quando o tempo acabar"
                desc="Ao zerar o timer, os cards escondidos aparecem sozinhos."
                checked={autoRevealOnTimerEnd}
                onChange={onToggleAutoRevealOnTimerEnd}
              />
              <ToggleRow
                icon={ThumbsUp}
                id="auto-sort-vote"
                title="Ordenar por votos ao encerrar a votação"
                desc="Os cards mais votados sobem ao topo de cada coluna."
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
