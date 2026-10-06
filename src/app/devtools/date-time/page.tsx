'use client';

import { useEffect, useMemo, useState } from 'react';
import { Copy, Globe } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { DevToolPage } from '@/components/devtools/DevToolPage';
import { useToast } from '@/hooks/use-toast';
import { ZONES, describePeriod, formatInZone, parseMoment, relativeTime } from './logic';

// Linha "rótulo — valor" que copia o valor ao clicar.
function CopyRow({ label, value }: { label: string; value: string }) {
  const { toast } = useToast();
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      toast({ title: 'Copiado!' });
    } catch {
      toast({ title: 'Não foi possível copiar', variant: 'destructive' });
    }
  };
  return (
    <button
      type="button"
      onClick={copy}
      className="group flex w-full items-center justify-between gap-3 rounded-lg border border-border bg-background px-3 py-1.5 text-left transition-colors hover:border-primary/40"
    >
      <span className="shrink-0 text-[10px] font-black uppercase tracking-widest text-muted-foreground">{label}</span>
      <span className="min-w-0 truncate font-code text-xs font-bold">{value}</span>
      <Copy className="h-3 w-3 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
    </button>
  );
}

const panel = 'flex min-h-0 flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-sm';
const panelTitle = 'text-[10px] font-black uppercase tracking-widest text-muted-foreground';

export default function DateTimePage() {
  // `now` só existe no cliente (evita divergência de hidratação do relógio).
  const [now, setNow] = useState<Date | null>(null);
  const [query, setQuery] = useState('');
  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');

  useEffect(() => {
    setNow(new Date());
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const parsed = useMemo(() => parseMoment(query), [query]);
  const period = useMemo(() => (start && end ? describePeriod(new Date(start), new Date(end)) : null), [start, end]);
  const nowSec = now ? Math.floor(now.getTime() / 1000) : 0;

  return (
    <DevToolPage toolId="date-time">
      <div className="grid h-full grid-cols-1 gap-3 md:grid-cols-2 md:gap-4">
        {/* Coluna esquerda: relógio ao vivo + calculador de período */}
        <div className="flex min-h-0 flex-col gap-3 overflow-y-auto">
          <section className={panel}>
            <header className="flex shrink-0 items-center justify-between border-b border-border/60 px-3 py-2">
              <h2 className={panelTitle}>Agora</h2>
              <span className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                <Globe className="h-3 w-3" /> {Intl.DateTimeFormat().resolvedOptions().timeZone}
              </span>
            </header>
            <div className="space-y-3 p-4">
              <p className="font-headline text-5xl font-black tabular-nums tracking-tight">
                {now ? now.toLocaleTimeString('pt-BR') : '--:--:--'}
              </p>
              <p className="text-sm font-bold capitalize text-primary">
                {now ? now.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' }) : ' '}
              </p>
              {now && (
                <div className="space-y-1.5">
                  <CopyRow label="Unix (s)" value={String(nowSec)} />
                  <CopyRow label="Unix (ms)" value={String(now.getTime())} />
                  <CopyRow label="ISO 8601" value={now.toISOString()} />
                </div>
              )}
            </div>
          </section>

          <section className={panel}>
            <header className="shrink-0 border-b border-border/60 px-3 py-2">
              <h2 className={panelTitle}>Calculador de período</h2>
            </header>
            <div className="space-y-3 p-4">
              <label className="block space-y-1">
                <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Início</span>
                <Input type="datetime-local" value={start} onChange={e => setStart(e.target.value)} className="h-9 rounded-lg" />
              </label>
              <label className="block space-y-1">
                <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Fim</span>
                <Input type="datetime-local" value={end} onChange={e => setEnd(e.target.value)} className="h-9 rounded-lg" />
              </label>
              {period && (
                <div className="rounded-xl border border-primary/20 bg-primary/5 p-3 text-center">
                  <p className="text-[10px] font-black uppercase tracking-widest text-primary">Intervalo</p>
                  <p className="font-headline text-lg font-black">{period.text}</p>
                  <p className="text-[11px] font-semibold text-muted-foreground">≈ {period.totalDays.toFixed(2)} dias no total</p>
                </div>
              )}
            </div>
          </section>
        </div>

        {/* Coluna direita: conversor de timestamp / data */}
        <section className={panel}>
          <header className="shrink-0 border-b border-border/60 px-3 py-2">
            <h2 className={panelTitle}>Conversor de timestamp e data</h2>
          </header>
          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4">
            <div className="flex gap-2">
              <Input
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder="1767225600, 1767225600000 ou 2026-01-01T12:00:00Z"
                spellCheck={false}
                aria-label="Timestamp ou data"
                className="h-9 rounded-lg font-code text-sm"
              />
              <Button type="button" variant="outline" className="h-9 rounded-lg text-[10px] font-black uppercase tracking-wider" onClick={() => now && setQuery(String(nowSec))} disabled={!now}>
                Agora
              </Button>
            </div>
            {query.trim() && !parsed && (
              <p className="rounded-xl border border-destructive/30 bg-destructive/5 p-3 text-xs font-semibold text-destructive">
                Não reconheci esse valor. Use um timestamp Unix (segundos ou milissegundos) ou uma data ISO.
              </p>
            )}
            {parsed && now && (
              <div className="space-y-1.5">
                <CopyRow label="Unix (s)" value={String(Math.floor(parsed.getTime() / 1000))} />
                <CopyRow label="Unix (ms)" value={String(parsed.getTime())} />
                <CopyRow label="ISO 8601" value={parsed.toISOString()} />
                <CopyRow label="Relativo" value={relativeTime(parsed, now)} />
                <p className="pt-2 text-[10px] font-black uppercase tracking-widest text-muted-foreground">Por fuso horário</p>
                {ZONES.map(z => <CopyRow key={z.id} label={z.label} value={formatInZone(parsed, z.id)} />)}
              </div>
            )}
            {!query.trim() && (
              <p className="py-8 text-center text-xs font-semibold text-muted-foreground">Digite um timestamp ou uma data para ver as conversões.</p>
            )}
          </div>
        </section>
      </div>
    </DevToolPage>
  );
}
