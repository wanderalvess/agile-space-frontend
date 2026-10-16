"use client";

import { useMemo, useState } from 'react';
import { Check, Copy, Trophy } from 'lucide-react';
import type { DeckType } from '@/lib/types';
import { TSHIRT_UNIT_LABELS } from '@/lib/types';
import { formatEstimateCopy, formatRoleForCopy } from '@/lib/poker-utils';
import { copyUnitSuffix, type RoundSummary } from '@/lib/poker-results';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { ROLE_STYLES, RoleChip, roleToneOf } from '@/components/room-kit';
import type { TshirtEquivalent } from '@/lib/types';

const CARD = 'rounded-[14px] border border-border bg-card shadow-[0_8px_24px_rgba(15,23,42,0.06)] dark:shadow-[0_20px_50px_rgba(0,0,0,0.4)]';

/** Rótulo da métrica principal conforme o baralho. */
function headlineOf(deck: DeckType, summary: RoundSummary): { label: string; value: string; unit: string } {
  if (summary.consensus) {
    return { label: 'Consenso pleno', value: deck === 'hours' ? summary.totalHours : summary.avg, unit: deck === 'hours' || summary.tshirtNumeric ? 'h' : '' };
  }
  if (deck === 'hours') return { label: 'Estimativa total', value: summary.totalHours, unit: 'h' };
  if (deck === 'tshirt' && !summary.tshirtNumeric) return { label: 'Resultado predominante', value: summary.avg, unit: '' };
  return { label: 'Média calculada', value: summary.avg, unit: summary.tshirtNumeric ? 'h' : '' };
}

/**
 * Centro da mesa revelada: estimativa total em destaque, chips por papel
 * (DEV 10h, QA 4h, UX 2h) e o aviso de divergência quando houver.
 */
export function RoundCenter({
  summary,
  deck,
  tshirtEquivalents,
  divergenceLabel,
  large = false,
}: {
  summary: RoundSummary;
  deck: DeckType;
  tshirtEquivalents?: Partial<Record<string, TshirtEquivalent>>;
  /** Ex.: "Divergência crítica no DEV · 6h a 16h". */
  divergenceLabel?: string;
  large?: boolean;
}) {
  const h = headlineOf(deck, summary);
  const eq = deck === 'tshirt' && !summary.tshirtNumeric ? tshirtEquivalents?.[summary.avg] : undefined;
  const unit = copyUnitSuffix(deck, summary.tshirtNumeric);
  return (
    <div className="room-rise flex flex-wrap items-center justify-center gap-x-6 gap-y-3" style={{ animationDelay: '650ms' }}>
      <div className="flex flex-col items-center">
        <span className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-muted-foreground">
          {summary.consensus && <Trophy className="h-3.5 w-3.5 text-amber-500" strokeWidth={1.5} aria-hidden="true" />}
          {h.label}
        </span>
        <span className={cn('font-bold tabular-nums leading-none', large ? 'text-6xl' : 'text-4xl')}>
          {h.value}{h.unit}
        </span>
        {eq && <span className="mt-1 text-xs text-muted-foreground">≈ {eq.value} {TSHIRT_UNIT_LABELS[eq.unit]}</span>}
      </div>
      {summary.activeRoles.length > 0 && (
        <>
          <span aria-hidden="true" className="hidden h-12 w-px bg-border sm:block" />
          <div className="flex flex-col items-center gap-2 sm:items-start">
            <div className="flex flex-wrap justify-center gap-1.5">
              {summary.activeRoles.map(role => (
                <span key={role} className={cn('inline-flex h-[26px] items-center rounded-lg px-2.5 text-[13px] font-bold tabular-nums', ROLE_STYLES[roleToneOf(role)].chip)}>
                  {formatRoleForCopy(role)} {summary.byRole[role]!.resultValue}{unit}
                </span>
              ))}
            </div>
            {divergenceLabel && (
              <span className="inline-flex h-6 items-center rounded-full bg-red-500/10 px-2.5 text-xs font-bold text-red-700 dark:text-red-300">{divergenceLabel}</span>
            )}
          </div>
        </>
      )}
    </div>
  );
}

/**
 * Resultado por papel: um cartão por papel que votou, com média, resultado e,
 * quando "Histograma de votos" está ligado, as barras por valor.
 */
export function RoleBreakdown({
  summary,
  deck,
  showBars,
}: {
  summary: RoundSummary;
  deck: DeckType;
  showBars: boolean;
}) {
  const suffix = deck === 'hours' || summary.tshirtNumeric ? 'h' : '';
  if (summary.activeRoles.length === 0) {
    return (
      <p className={cn(CARD, 'm-0 p-5 text-center text-sm text-muted-foreground')}>Sem votos técnicos nesta rodada.</p>
    );
  }
  return (
    <section aria-label="Resultado por papel" className={cn('grid gap-4', summary.activeRoles.length >= 3 ? 'md:grid-cols-3' : summary.activeRoles.length === 2 ? 'md:grid-cols-2' : 'md:grid-cols-1')}>
      {summary.activeRoles.map(role => {
        const data = summary.byRole[role]!;
        const nums = data.votes.map(Number).filter(n => !isNaN(n));
        const avg = nums.length ? (nums.reduce((a, b) => a + b, 0) / nums.length) : null;
        // Barras por valor, na ordem do menor para o maior.
        const counts = new Map<string, number>();
        data.votes.forEach(v => counts.set(v, (counts.get(v) || 0) + 1));
        const values = [...counts.keys()].sort((a, b) => (Number(a) - Number(b)) || a.localeCompare(b));
        const max = Math.max(...counts.values(), 1);
        const top = Math.max(...counts.values());
        return (
          <div key={role} className={cn(CARD, 'flex flex-col gap-2.5 px-5 py-4')}>
            <div className="flex items-center gap-2.5">
              <RoleChip category={role} label={formatRoleForCopy(role)} />
              <span className="text-[13px] text-muted-foreground">
                {data.votes.length} {data.votes.length === 1 ? 'voto' : 'votos'}
                {avg !== null && deck !== 'tshirt' ? ` · média ${Number.isInteger(avg) ? avg : avg.toFixed(1).replace('.', ',')}${suffix}` : ''}
              </span>
              <span className="ml-auto text-[22px] font-bold tabular-nums" title={data.resultLabel.toLowerCase()}>{data.resultValue}{!isNaN(Number(data.resultValue)) ? suffix : ''}</span>
            </div>
            {showBars && values.map((v, i) => {
              const n = counts.get(v) || 0;
              return (
                <div key={v} className="grid grid-cols-[40px_minmax(0,1fr)_24px] items-center gap-2.5">
                  <span className="text-right text-[13px] font-bold tabular-nums">{v === '☕' ? 'café' : v}{!isNaN(Number(v)) ? suffix : ''}</span>
                  <div className="h-[18px] overflow-hidden rounded-[5px] bg-muted/60">
                    <div
                      className={cn('room-grow h-[18px] rounded-[5px]', n === top ? 'bg-primary shadow-[0_0_12px_hsl(var(--primary)/0.35)] [.theme-leitura_&]:shadow-none' : 'bg-border')}
                      style={{ width: `${Math.round((n / max) * 100)}%`, animationDelay: `${700 + i * 70}ms` }}
                    />
                  </div>
                  <span className="text-xs tabular-nums text-muted-foreground">{n}</span>
                </div>
              );
            })}
          </div>
        );
      })}
    </section>
  );
}

/**
 * Card "Copiar estimativa": mostra o texto que vai para a issue pai do Jira,
 * por papel — "(DEV 10h / QA 4h / UX 2h)" — e copia com um clique. Aceita
 * valores ajustados pelo facilitador (`values`), que valem no lugar da média.
 */
export function CopyEstimateCard({
  summary,
  deck,
  values,
}: {
  summary: RoundSummary;
  deck: DeckType;
  /** Valor final por papel (padrão: o resultado da rodada). */
  values?: Record<string, string>;
}) {
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);
  const suffix = copyUnitSuffix(deck, summary.tshirtNumeric);
  const text = useMemo(
    () => formatEstimateCopy(summary.activeRoles.map(role => ({ role, value: values?.[role] ?? summary.byRole[role]!.resultValue })), suffix),
    [summary, values, suffix]
  );

  const copy = async () => {
    if (!text) {
      toast({ title: 'Nada para copiar', description: 'Não há estimativas calculadas.', variant: 'destructive' });
      return;
    }
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      toast({ title: 'Estimativa copiada', description: text });
      setTimeout(() => setCopied(false), 2500);
    } catch {
      toast({ title: 'Não foi possível copiar', description: 'Selecione o texto e copie manualmente.', variant: 'destructive' });
    }
  };

  const total = deck === 'hours' || summary.tshirtNumeric
    ? summary.activeRoles.reduce((acc, r) => acc + (Number(values?.[r] ?? summary.byRole[r]!.resultValue) || 0), 0)
    : null;

  return (
    <section
      aria-label="Copiar estimativa"
      className={cn(CARD, 'room-rise flex flex-wrap items-center gap-x-3 gap-y-2 px-4 py-2.5')}
      style={{ animationDelay: '850ms' }}
    >
      <span className="text-xs font-medium text-muted-foreground">Estimativa para a issue pai</span>
      <code className="min-w-0 flex-1 break-words rounded-md bg-muted/50 px-2.5 py-1 text-sm font-semibold tabular-nums text-foreground">{text || 'Sem estimativa'}</code>
      {total !== null && <span className="text-xs tabular-nums text-muted-foreground">total {total}h</span>}
      <button
        type="button"
        onClick={copy}
        className={cn(
          'inline-flex h-8 items-center justify-center gap-1.5 rounded-lg border px-3 text-[13px] font-semibold transition-colors duration-base',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
          copied
            ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
            : 'border-border bg-transparent text-foreground hover:bg-accent/50'
        )}
      >
        {copied ? <Check className="room-pop h-3.5 w-3.5" strokeWidth={1.75} aria-hidden="true" /> : <Copy className="h-3.5 w-3.5" strokeWidth={1.5} aria-hidden="true" />}
        {copied ? 'Copiado' : 'Copiar'}
      </button>
    </section>
  );
}
