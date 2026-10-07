'use client';

import { Frown, Annoyed, Meh, Smile, Laugh, MessageCircleHeart } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { HealthCheckAnswer } from '@/lib/types';
import { DEFAULT_HEALTH_CHECK_QUESTION } from './RetroSettingsDialog';

const SCALE: { key: HealthCheckAnswer; label: string; icon: typeof Frown }[] = [
  { key: 'exhausted', label: 'Exausto', icon: Frown },
  { key: 'tired', label: 'Cansado', icon: Annoyed },
  { key: 'neutral', label: 'Neutro', icon: Meh },
  { key: 'good', label: 'Bem', icon: Smile },
  { key: 'great', label: 'Ótimo', icon: Laugh },
];

interface RetroHealthCheckGateProps {
  question?: string;
  onAnswer: (answer: HealthCheckAnswer) => void;
}

/**
 * Tela mostrada uma vez, antes do quadro, quando o facilitador liga o
 * check-in inicial em RetroSettingsDialog. Resposta some assim que enviada —
 * currentUser.healthCheckAnswer passa a existir e retro/[id]/page.tsx para de renderizar isto.
 */
export function RetroHealthCheckGate({ question, onAnswer }: RetroHealthCheckGateProps) {
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/60 backdrop-blur-sm p-4">
      <div className="w-full max-w-md bg-card text-card-foreground border border-border rounded-[2rem] shadow-2xl p-8 sm:p-10 text-center relative overflow-hidden">
        <div className="absolute -top-16 -left-16 w-40 h-40 rounded-full bg-emerald-500/10" />
        <div className="absolute -bottom-20 -right-14 w-40 h-40 rounded-full bg-emerald-500/5" />

        <div className="relative">
          <div className="w-14 h-14 rounded-2xl bg-emerald-600 shadow-lg shadow-emerald-600/25 flex items-center justify-center mx-auto mb-5">
            <MessageCircleHeart className="h-7 w-7 text-white" />
          </div>
          <h2 className="text-xl font-black text-foreground leading-snug mb-2">
            {question?.trim() || DEFAULT_HEALTH_CHECK_QUESTION}
          </h2>
          <p className="text-sm text-muted-foreground mb-8">
            Responda rápido. O histórico da retro mostra só a média do time.
          </p>

          <div className="flex justify-center gap-3 mb-2">
            {SCALE.map(({ key, label, icon: Icon }) => (
              <button
                key={key}
                type="button"
                onClick={() => onAnswer(key)}
                className={cn(
                  "flex flex-col items-center gap-1.5 group",
                )}
              >
                <div className="w-12 h-12 rounded-2xl border-2 border-border bg-muted/40 flex items-center justify-center text-muted-foreground transition-all group-hover:border-emerald-500 group-hover:bg-emerald-500/10 group-hover:text-emerald-500 group-hover:scale-105">
                  <Icon className="h-6 w-6" />
                </div>
                <span className="text-xs font-semibold text-muted-foreground group-hover:text-emerald-500">{label}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
