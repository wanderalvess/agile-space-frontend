'use client';

import { Check } from 'lucide-react';
import { useTheme, type ThemeVariant } from '@/context/ThemeContext';
import { THEME_MODES, THEME_SWATCHES, THEME_VARIANTS } from '@/lib/theme-options';
import { cn } from '@/lib/utils';

const FOCUS_RING =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background';

/** Miniatura do tema: fundo, cartão, texto e botão, com a paleta do modo que está valendo. */
function ThemePreview({ variant, dark }: { variant: ThemeVariant; dark: boolean }) {
  const s = THEME_SWATCHES[variant][dark ? 'dark' : 'light'];
  const hsl = (v: string, a = 1) => `hsl(${v} / ${a})`;
  return (
    <div
      aria-hidden="true"
      className="flex h-[76px] flex-col gap-1.5 rounded-lg border p-2"
      style={{ background: hsl(s.background), borderColor: hsl(s.foreground, 0.14) }}
    >
      <div className="flex flex-1 flex-col justify-center gap-1 rounded-md p-1.5" style={{ background: hsl(s.card), border: `1px solid ${hsl(s.foreground, 0.12)}` }}>
        <span className="h-1.5 w-2/3 rounded-full" style={{ background: hsl(s.foreground, 0.85) }} />
        <span className="h-1.5 w-1/2 rounded-full" style={{ background: hsl(s.foreground, 0.35) }} />
      </div>
      <span className="h-3.5 w-1/2 rounded-[5px]" style={{ background: hsl(s.primary) }} />
    </div>
  );
}

/**
 * Controles de aparência (modo claro/escuro/sistema e variantes de tema), usados em Configurações e em
 * "Minha identidade". Aplica na hora pelo ThemeContext; a escolha fica neste navegador, sem botão Salvar.
 * `compact` (ficha de identidade): modo num controle segmentado e temas em chips de uma linha (dois pontos de
 * cor + nome), duas colunas; a lógica de aplicar é a mesma.
 */
export function ThemeSettings({ idPrefix = 'theme', compact = false }: { idPrefix?: string; compact?: boolean }) {
  const { mode, resolvedMode, variant, setMode, setVariant } = useTheme();

  const headingClass = compact ? 'text-xs font-semibold text-muted-foreground' : 'text-xs font-bold uppercase tracking-wider text-muted-foreground';

  return (
    <div className={cn('flex flex-col', compact ? 'gap-4' : 'gap-6')}>
      <div className={cn('flex flex-col', compact ? 'gap-2' : 'gap-2.5')}>
        <h3 id={`${idPrefix}-modo`} className={headingClass}>
          Modo
        </h3>
        <div
          role="radiogroup"
          aria-labelledby={`${idPrefix}-modo`}
          className={cn('grid grid-cols-3', compact ? 'gap-1.5 rounded-[14px] border border-border bg-background p-1' : 'gap-2')}
        >
          {THEME_MODES.map((m) => {
            const Icon = m.icon;
            const active = mode === m.id;
            return (
              <button
                key={m.id}
                type="button"
                role="radio"
                aria-checked={active}
                onClick={() => setMode(m.id)}
                className={cn(
                  'flex h-11 items-center justify-center gap-2 rounded-[10px] border text-sm font-semibold transition-colors max-sm:px-1',
                  compact && !active && 'border-transparent',
                  active ? 'border-primary bg-primary/10 text-foreground' : 'border-border text-muted-foreground hover:bg-muted/60 hover:text-foreground',
                  FOCUS_RING,
                )}
              >
                <Icon aria-hidden="true" className="h-4 w-4" strokeWidth={1.5} />
                {m.name}
              </button>
            );
          })}
        </div>
      </div>

      <div className={cn('flex flex-col', compact ? 'gap-2' : 'gap-2.5')}>
        <h3 id={`${idPrefix}-tema`} className={headingClass}>
          Tema
        </h3>
        <div
          role="radiogroup"
          aria-labelledby={`${idPrefix}-tema`}
          className={cn('grid gap-3', compact ? 'grid-cols-2 gap-2' : 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3')}
        >
          {THEME_VARIANTS.map((t, i) => {
            const active = variant === t.id;
            if (compact) {
              const sw = THEME_SWATCHES[t.id][resolvedMode === 'dark' ? 'dark' : 'light'];
              const lastOdd = i === THEME_VARIANTS.length - 1 && THEME_VARIANTS.length % 2 === 1;
              return (
                <button
                  key={t.id}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  onClick={() => setVariant(t.id)}
                  className={cn(
                    'flex h-11 min-w-0 items-center gap-2.5 rounded-xl border px-3 text-left text-[13px] transition-colors',
                    lastOdd && 'col-span-2',
                    active ? 'border-primary bg-primary/10 font-semibold text-foreground' : 'border-border font-medium text-muted-foreground hover:bg-muted/50 hover:text-foreground',
                    FOCUS_RING,
                  )}
                >
                  <span aria-hidden="true" className="flex shrink-0 gap-0.5">
                    <span className="h-3 w-3 rounded-full border border-muted-foreground" style={{ background: `hsl(${sw.background})` }} />
                    <span className="h-3 w-3 rounded-full" style={{ background: `hsl(${sw.primary})` }} />
                  </span>
                  <span className="truncate">{t.name}</span>
                </button>
              );
            }
            return (
              <button
                key={t.id}
                type="button"
                role="radio"
                aria-checked={active}
                onClick={() => setVariant(t.id)}
                className={cn(
                  'flex flex-col gap-2.5 rounded-xl border p-2.5 text-left transition-colors',
                  active ? 'border-primary bg-primary/5' : 'border-border hover:bg-muted/50',
                  FOCUS_RING,
                )}
              >
                <ThemePreview variant={t.id} dark={resolvedMode === 'dark'} />
                <span className="flex items-center justify-between gap-2 px-0.5 text-sm font-semibold">
                  {t.name}
                  {active && <Check aria-hidden="true" className="h-4 w-4 text-primary [.theme-totvs:not(.dark)_&]:text-foreground" strokeWidth={1.75} />}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
