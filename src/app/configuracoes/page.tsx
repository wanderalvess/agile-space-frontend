'use client';

import { Check } from 'lucide-react';
import { PageHeader, PageShell } from '@/components/page';
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

export default function ConfiguracoesPage() {
  const { mode, resolvedMode, variant, setMode, setVariant } = useTheme();

  return (
    <PageShell documentTitle="Configurações" width="narrow" contentClassName="gap-6">
      <PageHeader
        title="Configurações"
        module="settings"
        breadcrumb={[{ label: 'Home', href: '/' }, { label: 'Configurações' }]}
        subtitle="Preferências da sua conta."
      />

      <section aria-labelledby="cfg-aparencia" className="flex flex-col gap-6 rounded-2xl border border-border bg-card p-5 text-card-foreground sm:p-6">
        <div className="flex flex-col gap-1">
          <h2 id="cfg-aparencia" className="text-lg font-bold">
            Aparência
          </h2>
          <p className="text-sm text-muted-foreground">A escolha é sua: não muda a aparência para o resto da squad e fica salva neste navegador.</p>
        </div>

        <div className="flex flex-col gap-2.5">
          <h3 id="cfg-modo" className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
            Modo
          </h3>
          <div role="radiogroup" aria-labelledby="cfg-modo" className="grid grid-cols-3 gap-2">
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
                    'flex h-11 items-center justify-center gap-2 rounded-[10px] border text-sm font-semibold transition-colors',
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

        <div className="flex flex-col gap-2.5">
          <h3 id="cfg-tema" className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
            Tema
          </h3>
          <div role="radiogroup" aria-labelledby="cfg-tema" className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {THEME_VARIANTS.map((t) => {
              const active = variant === t.id;
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
      </section>
    </PageShell>
  );
}
