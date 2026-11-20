'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { PAGE_CARD } from '@/components/page';
import { ModalButton } from '@/components/room-kit';
import { cn } from '@/lib/utils';
import { isMissingRoute, promptApi } from '@/app/prompt-hub/api';
import type { UsageWeek } from '@/app/prompt-hub/types';

const weekLabel = (iso: string) => {
  const date = new Date(`${iso.slice(0, 10)}T12:00:00`);
  return Number.isNaN(date.getTime()) ? iso : format(date, 'dd/MM', { locale: ptBR });
};

/** Barras simples (CSS) com o valor de cada semana; a tabela escondida repete os números para leitor de tela. */
export function UsageChart({ weeks }: { weeks: UsageWeek[] }) {
  const max = Math.max(1, ...weeks.map(w => w.uses));
  const totalUses = weeks.reduce((sum, w) => sum + w.uses, 0);
  const totalClones = weeks.reduce((sum, w) => sum + w.clones, 0);
  return (
    <figure className="flex flex-col gap-2.5">
      <div
        role="img"
        aria-label={`Cópias por semana nas últimas ${weeks.length} semanas: ${weeks.map(w => `semana de ${weekLabel(w.weekStart)}, ${w.uses}`).join('; ')}`}
        className="flex h-28 items-end gap-1.5"
      >
        {weeks.map((week, index) => {
          const last = index === weeks.length - 1;
          return (
            <div key={week.weekStart} className="flex h-full flex-1 flex-col items-center justify-end gap-1" title={`Semana de ${weekLabel(week.weekStart)}: ${week.uses} cópias, ${week.clones} duplicações`}>
              <span className="text-xs tabular-nums text-muted-foreground">{week.uses}</span>
              <span
                aria-hidden="true"
                className={cn('w-full rounded-t-[4px] bg-primary', last ? 'opacity-100' : 'opacity-60')}
                style={{ height: `${Math.max(3, Math.round((week.uses / max) * 72))}px` }}
              />
            </div>
          );
        })}
      </div>
      <div className="flex justify-between text-xs text-muted-foreground" aria-hidden="true">
        <span>{weeks.length > 0 ? `semana de ${weekLabel(weeks[0].weekStart)}` : ''}</span>
        <span>esta semana</span>
      </div>
      <figcaption className="text-[13px] text-muted-foreground">
        {totalUses.toLocaleString('pt-BR')} {totalUses === 1 ? 'cópia' : 'cópias'} e {totalClones.toLocaleString('pt-BR')}{' '}
        {totalClones === 1 ? 'duplicação' : 'duplicações'} no período.
      </figcaption>
      <table className="sr-only">
        <caption>Cópias e duplicações por semana</caption>
        <thead>
          <tr>
            <th scope="col">Semana</th>
            <th scope="col">Cópias</th>
            <th scope="col">Duplicações</th>
          </tr>
        </thead>
        <tbody>
          {weeks.map(week => (
            <tr key={week.weekStart}>
              <th scope="row">{weekLabel(week.weekStart)}</th>
              <td>{week.uses}</td>
              <td>{week.clones}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}

/**
 * Cartão "Uso nas últimas 8 semanas". Se o servidor ainda não tem a rota de uso, o cartão some
 * em vez de mostrar erro.
 */
export function UsageCard({ itemId, refreshKey }: { itemId: string; refreshKey?: number }) {
  const [weeks, setWeeks] = useState<UsageWeek[] | null>(null);
  const [state, setState] = useState<'loading' | 'ready' | 'error' | 'missing'>('loading');

  const load = useCallback(async () => {
    setState('loading');
    try {
      setWeeks(await promptApi.usage(itemId, 8));
      setState('ready');
    } catch (err) {
      setState(isMissingRoute(err) ? 'missing' : 'error');
    }
  }, [itemId]);

  useEffect(() => {
    void load();
  }, [load, refreshKey]);

  const ordered = useMemo(() => [...(weeks ?? [])].sort((a, b) => a.weekStart.localeCompare(b.weekStart)), [weeks]);

  if (state === 'missing') return null;
  return (
    <section aria-label="Uso nas últimas 8 semanas" className={cn(PAGE_CARD, 'flex flex-col gap-3 p-[18px]')}>
      <h2 className="text-base font-bold text-foreground">Uso nas últimas 8 semanas</h2>
      {state === 'loading' && <p className="text-sm text-muted-foreground">Carregando o uso…</p>}
      {state === 'error' && (
        <div role="alert" className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
          <span className="flex-1">Não foi possível carregar o uso.</span>
          <ModalButton onClick={() => void load()}>Tentar de novo</ModalButton>
        </div>
      )}
      {state === 'ready' && (ordered.length === 0 ? <p className="text-sm text-muted-foreground">Ainda não há uso registrado.</p> : <UsageChart weeks={ordered} />)}
    </section>
  );
}
