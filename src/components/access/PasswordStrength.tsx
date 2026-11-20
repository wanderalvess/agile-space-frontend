'use client';

import { cn } from '@/lib/utils';
import { passwordStrength, type StrengthTone } from '@/components/login/login-utils';

const TONE_BAR: Record<StrengthTone, string> = {
  weak: 'bg-destructive',
  fair: 'bg-amber-500',
  good: 'bg-emerald-500',
};

/**
 * Medidor de força da nova senha. Usa só a função pura do cadastro (`passwordStrength`), então a régua é a mesma
 * do login; o desenho é o desta tela. Só aparece depois de digitar.
 */
export function PasswordStrength({ id, password }: { id: string; password: string }) {
  if (!password) return null;
  const { score, label, tone } = passwordStrength(password);
  return (
    <div id={id} aria-live="polite" className="flex items-center gap-3">
      <div className="grid flex-1 grid-cols-4 gap-1" aria-hidden="true">
        {[1, 2, 3, 4].map((n) => (
          <span key={n} className={cn('h-1.5 rounded-full transition-colors', n <= score ? TONE_BAR[tone] : 'bg-border')} />
        ))}
      </div>
      <span className="min-w-[72px] text-right text-xs font-bold text-foreground">{label}</span>
    </div>
  );
}
