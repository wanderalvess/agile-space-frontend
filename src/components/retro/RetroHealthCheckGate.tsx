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
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/40 backdrop-blur-sm p-4">
      <div className="w-full max-w-md bg-white rounded-[2rem] shadow-2xl p-10 text-center relative overflow-hidden">
        <div className="absolute -top-16 -left-16 w-40 h-40 rounded-full bg-emerald-50" />
        <div className="absolute -bottom-20 -right-14 w-40 h-40 rounded-full bg-indigo-50" />

        <div className="relative">
          <div className="w-14 h-14 rounded-2xl bg-slate-900 flex items-center justify-center mx-auto mb-5">
            <MessageCircleHeart className="h-7 w-7 text-white" />
          </div>
          <h2 className="text-xl font-black text-slate-900 leading-snug mb-2">
            {question?.trim() || DEFAULT_HEALTH_CHECK_QUESTION}
          </h2>
          <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-8">
            Só o time vê o resultado agregado
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
                <div className="w-12 h-12 rounded-2xl border-2 border-slate-200 bg-slate-50 flex items-center justify-center text-slate-400 transition-all group-hover:border-indigo-500 group-hover:bg-indigo-50 group-hover:text-indigo-600 group-hover:scale-105">
                  <Icon className="h-6 w-6" />
                </div>
                <span className="text-[8px] font-black uppercase tracking-widest text-slate-400 group-hover:text-indigo-600">{label}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
