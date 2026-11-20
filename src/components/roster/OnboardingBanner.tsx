'use client';

import { ChevronRight, Sparkles } from 'lucide-react';
import { ModalButton, BRAND_TEXT, BRAND_TINT } from '@/components/room-kit';
import { cn } from '@/lib/utils';
import { ICON_STROKE } from './styles';

/** Último passo do onboarding (`?onboarding=1`): definir as horas do time e seguir para o início. */
export function OnboardingBanner({ onSkip }: { onSkip: () => void }) {
  return (
    <section
      role="note"
      className={cn('flex flex-col justify-between gap-3 rounded-2xl border border-primary/40 px-[18px] py-3.5 sm:flex-row sm:items-center', BRAND_TINT)}
    >
      <div className="flex items-start gap-3">
        <Sparkles className={cn('mt-0.5 h-5 w-5 shrink-0', BRAND_TEXT)} strokeWidth={ICON_STROKE} aria-hidden="true" />
        <div className="flex flex-col">
          <span className="text-sm font-bold text-foreground">Último passo do onboarding: horas do time</span>
          <span className="text-[13px] text-muted-foreground">
            Defina quantas horas por dia cada pessoa dedica à squad. Isso alimenta o Sprint Planner e a capacidade. Você pode pular e voltar depois pela página da squad.
          </span>
        </div>
      </div>
      <ModalButton className="shrink-0" onClick={onSkip}>
        Pular por agora <ChevronRight className="h-3.5 w-3.5" strokeWidth={ICON_STROKE} aria-hidden="true" />
      </ModalButton>
    </section>
  );
}
