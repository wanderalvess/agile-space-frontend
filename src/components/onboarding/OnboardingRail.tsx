'use client';

import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import { TONES } from '@/components/room-kit/tokens';

export type OnboardingStep =
  | 'suggestion'
  | 'confirmOther'
  | 'intent'
  | 'search'
  | 'roster'
  | 'role'
  | 'create'
  | 'jira'
  | 'request'
  | 'result';

const ITEMS = [
  { title: 'Diga como você usa o Portal', text: 'Agile Master e People Lead cadastram squads; os demais entram numa.' },
  { title: 'Importe ou encontre a squad', text: 'AM/PL importam do Jira de uma vez. Quem participa busca pelo nome.' },
  { title: 'Comece as cerimônias', text: 'Poker, Review e Retro com a squad já dentro.' },
] as const;

/** Em qual item da trilha cada passo está. */
export function railIndexOf(step: OnboardingStep): number {
  switch (step) {
    case 'suggestion':
    case 'confirmOther':
    case 'intent':
      return 0;
    case 'result':
      return 2;
    default:
      return 1;
  }
}

/** Trilha lateral (telas largas): o caminho inteiro, com o passo atual marcado e os anteriores concluídos. */
export function OnboardingRail({ step }: { step: OnboardingStep }) {
  const current = railIndexOf(step);
  return (
    <aside className="sticky top-24 hidden flex-col gap-6 pt-6 lg:flex" aria-label="Seu caminho até a primeira cerimônia">
      <div className="flex flex-col gap-2">
        <h2 className="text-[22px] font-bold leading-tight tracking-tight">Sua squad conectada em poucos passos</h2>
        <p className="text-sm leading-relaxed text-muted-foreground">Depois disso, Poker, Review e Retro já abrem com a sua squad no lugar.</p>
      </div>
      <ol className="flex flex-col gap-2.5">
        {ITEMS.map((item, i) => {
          const done = i < current;
          const active = i === current;
          return (
            <li
              key={item.title}
              aria-current={active ? 'step' : undefined}
              className={cn(
                'flex gap-3 rounded-2xl border p-3.5 transition-colors duration-200',
                active ? 'border-primary/50 bg-primary/5' : 'border-border bg-card',
                !active && !done && 'opacity-80',
              )}
            >
              <span
                aria-hidden="true"
                className={cn(
                  'flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold',
                  active ? 'bg-primary text-primary-foreground' : done ? TONES.success.chip : TONES.brand.chip,
                )}
              >
                {done ? <Check className="h-3.5 w-3.5" strokeWidth={1.5} /> : i + 1}
              </span>
              <span className="flex min-w-0 flex-col gap-0.5">
                <span className="text-sm font-bold">
                  {item.title}
                  {done && <span className="sr-only"> (concluído)</span>}
                  {active && <span className="sr-only"> (passo atual)</span>}
                </span>
                <span className="text-xs leading-relaxed text-muted-foreground">{item.text}</span>
              </span>
            </li>
          );
        })}
      </ol>
    </aside>
  );
}
