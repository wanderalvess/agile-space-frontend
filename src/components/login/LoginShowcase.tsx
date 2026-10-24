'use client';

import { useEffect, useMemo, useState } from 'react';
import { BrandWordmark } from '@/components/layout/BrandWordmark';
import { cn } from '@/lib/utils';
import packageInfo from '../../../package.json';
import { FOCUS_RING, TINT_TEXT } from './login-fields';
import { LoginBackdrop } from './LoginBackdrop';
import { LOGIN_MODULES, ROTATION_INTERVAL_MS } from './login-modules';
import { nextIndex } from './login-utils';
import { ModuleMiniature } from './ModuleMiniature';
import { usePrefersReducedMotion } from './usePrefersReducedMotion';

/** Passa os módulos sozinho a cada poucos segundos. Parado com "reduzir movimento" e enquanto a pessoa está sobre a vitrine. */
function useRotation(total: number, paused: boolean) {
  const reduce = usePrefersReducedMotion();
  const [index, setIndex] = useState(0);
  const [tick, setTick] = useState(0);
  const stopped = paused || reduce;

  useEffect(() => {
    if (stopped) return;
    const timer = setTimeout(() => setIndex((i) => nextIndex(i, total)), ROTATION_INTERVAL_MS);
    return () => clearTimeout(timer);
  }, [stopped, index, tick, total]);

  return {
    index,
    // Escolha manual reinicia a contagem do tempo.
    pick: (i: number) => {
      setIndex(i);
      setTick((t) => t + 1);
    },
  };
}

/**
 * Painel de apresentação do login (só em telas largas): o que o portal é e os módulos, um de cada vez.
 * Fundo com o token de página e um halo bem discreto, que some no tema "leitura".
 */
export function LoginShowcase({ className }: { className?: string }) {
  const [paused, setPaused] = useState(false);
  const { index, pick } = useRotation(LOGIN_MODULES.length, paused);
  const current = LOGIN_MODULES[index];
  const Icon = current.icon;
  const year = useMemo(() => new Date().getFullYear(), []);

  return (
    <section
      aria-label="Portal Tech V&D"
      className={cn('relative flex-col gap-6 overflow-hidden border-r border-border bg-background px-10 py-9 [@media(max-height:760px)]:gap-4 [@media(max-height:760px)]:py-7', className)}
    >
      <LoginBackdrop />

      <BrandWordmark className="relative [&>span:first-child]:text-lg" />

      <div className="relative mt-auto space-y-3">
        <h2 className="text-[32px] font-bold leading-[1.12] tracking-tight text-foreground [@media(max-height:760px)]:text-[28px]">
          Do refinamento à entrega, num só lugar.
        </h2>
        <p className="text-sm leading-relaxed text-muted-foreground">
          Scrum Poker, retrospectivas, clima do time e o conhecimento das squads de Varejo e Distribuição.
        </p>
      </div>

      <div
        role="group"
        aria-roledescription="carrossel"
        aria-label="Módulos do portal"
        onMouseEnter={() => setPaused(true)}
        onMouseLeave={() => setPaused(false)}
        onFocus={() => setPaused(true)}
        onBlur={() => setPaused(false)}
        className="relative flex flex-col gap-3 rounded-2xl border border-border bg-card/70 p-4 shadow-sm"
      >
        <div className="flex items-center justify-between gap-2">
          <span className="flex items-center gap-2 text-xs font-semibold text-foreground">
            <Icon aria-hidden="true" strokeWidth={1.5} className={cn('h-4 w-4', TINT_TEXT)} />
            {current.name}
          </span>
          <span className="text-xs text-muted-foreground">Exemplo</span>
        </div>

        <ModuleMiniature key={current.key} module={current.key} />

        <div className="flex items-center justify-between gap-3">
          <span className="text-xs text-muted-foreground" aria-live="off">
            {current.caption}
          </span>
          <div role="tablist" aria-label="Escolher módulo" className="flex shrink-0 items-center gap-1">
            {LOGIN_MODULES.map((m, i) => (
              <button
                key={m.key}
                type="button"
                role="tab"
                aria-selected={i === index}
                aria-label={m.name}
                onClick={() => pick(i)}
                className={cn(
                  'flex h-6 items-center justify-center rounded-full px-[3px]',
                  FOCUS_RING,
                )}
              >
                <span
                  className={cn(
                    'h-1.5 rounded-full transition-all motion-reduce:transition-none',
                    i === index ? 'w-[18px] bg-primary' : 'w-1.5 bg-border hover:bg-muted-foreground/50',
                  )}
                />
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="relative flex justify-between text-xs tabular-nums text-muted-foreground">
        <span>v{packageInfo.version}</span>
        <span>© {year}</span>
      </div>
    </section>
  );
}
