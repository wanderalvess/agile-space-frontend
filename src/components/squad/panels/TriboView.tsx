'use client';

// Painel da Tribo: o resumo de cada squad vem do que foi sincronizado do Jira. Squad sem sincronização aparece como
// "Sem dados". Velocidade, clima e rituais por squad ainda não têm fonte aqui e não são mostrados.
//
// Hoje isto faz 1 chamada por squad (N+1: lista os projetos e busca o rollup de cada um). Um endpoint agregado de
// rollups da tribo, no backend, trocaria isso por uma chamada só.
import * as React from 'react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { projectService } from '@/services/projectService';
import { squadApi, SquadApiError } from '@/app/squad/api';
import { cn } from '@/lib/utils';
import { ErrorState } from '@/components/page/States';
import { INK, PanelCard } from './PanelWidgets';
import {
  predictability,
  predictabilityTone,
  sortTribeRows,
  summarizeTribe,
  type TribeRow,
} from './panel-model';

export interface TribeState {
  rows: TribeRow[];
  loading: boolean;
  error: string | null;
  reload: () => void;
}

export function useTribeRollups(enabled: boolean): TribeState {
  const [rows, setRows] = useState<TribeRow[]>([]);
  const [loading, setLoading] = useState(enabled);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!enabled) return;
    let alive = true;
    /* eslint-disable react-hooks/set-state-in-effect -- início da carga (mostra "carregando" e limpa o erro) */
    setLoading(true);
    setError(null);
    /* eslint-enable react-hooks/set-state-in-effect */
    projectService
      .getAllProjects()
      .then((projects) =>
        Promise.all(
          projects.map(async (p): Promise<TribeRow> => {
            let restricted = false;
            const rollup = await squadApi.getRollup(p.id).catch((e) => {
              restricted = e instanceof SquadApiError && e.status === 403;
              return null;
            });
            return { id: p.id, name: p.name && p.name !== p.id ? `${p.id} · ${p.name}` : p.id, rollup, restricted };
          }),
        ),
      )
      .then((result) => alive && setRows(sortTribeRows(result)))
      .catch((e) => {
        if (!alive) return;
        setRows([]);
        setError(e?.message || 'Não foi possível carregar as squads agora.');
      })
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [enabled, tick]);

  const reload = useCallback(() => setTick((t) => t + 1), []);
  return { rows, loading, error, reload };
}

function TribeKpi({ label, value, hint, danger }: { label: string; value: string; hint?: string; danger?: boolean }) {
  return (
    <section className="flex flex-col gap-1.5 rounded-2xl border border-border bg-card p-5 shadow-[0_8px_24px_rgba(15,23,42,0.06)] dark:shadow-[0_20px_50px_rgba(0,0,0,0.4)]">
      <h3 className="text-sm font-semibold text-muted-foreground">{label}</h3>
      <span className={cn('text-[32px] font-bold leading-tight tabular-nums', danger ? INK.danger : 'text-foreground')}>{value}</span>
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </section>
  );
}

export function TriboView({ tribe }: { tribe: TribeState }) {
  const { rows, loading, error } = tribe;
  const summary = useMemo(() => summarizeTribe(rows), [rows]);
  const dash = (v: string) => (loading ? '…' : v);

  return (
    <div className="flex flex-col gap-5">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <TribeKpi label="Squads com dados" value={dash(`${summary.withData} de ${summary.squads}`)} />
        <TribeKpi
          label="Previsibilidade média"
          value={dash(summary.avgPredictability === null ? '—' : `${summary.avgPredictability}%`)}
          hint="Média das squads com dados."
        />
        <TribeKpi label="Itens concluídos" value={dash(summary.total === 0 ? '—' : `${summary.done} de ${summary.total}`)} />
        <TribeKpi
          label="Itens atrasados"
          value={dash(summary.total === 0 ? '—' : String(summary.overdue))}
          hint="Prazo vencido e ainda não concluídos."
          danger={summary.overdue > 0}
        />
      </div>

      <PanelCard title="Comparação entre squads">
        <p className="text-sm text-muted-foreground">Previsibilidade é a parte dos itens da sprint que já foi concluída.</p>
        {error && !loading ? (
          <ErrorState
            embedded
            title="Não foi possível carregar as squads"
            description={error}
            onRetry={tribe.reload}
          />
        ) : (
          <div className="overflow-x-auto rounded-[14px] border border-border">
            <table className="w-full min-w-[640px] text-left text-sm">
              <caption className="sr-only">Comparação entre squads: sprint, concluídos, previsibilidade e atrasados</caption>
              <thead>
                <tr className="bg-muted/40 text-[13px] font-bold text-muted-foreground">
                  <th scope="col" className="px-4 py-2.5">Squad</th>
                  <th scope="col" className="px-3 py-2.5">Sprint</th>
                  <th scope="col" className="px-3 py-2.5">Concluídos</th>
                  <th scope="col" className="px-3 py-2.5">Previsibilidade</th>
                  <th scope="col" className="px-3 py-2.5">Atrasados</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((sq) => {
                  const pred = predictability(sq.rollup);
                  return (
                    <tr key={sq.id} className="border-t border-border transition-colors duration-fast hover:bg-muted/40">
                      <th scope="row" className="px-4 py-3.5 font-bold text-foreground">{sq.name}</th>
                      {pred === null ? (
                        <td colSpan={4} className="px-3 py-3.5 text-muted-foreground">
                          {sq.restricted ? 'Sem acesso a esta squad (fora da sua tribo)' : 'Sem dados desta squad ainda'}
                        </td>
                      ) : (
                        <>
                          <td className="px-3 py-3.5 text-muted-foreground">{sq.rollup?.sprintName || '—'}</td>
                          <td className="px-3 py-3.5 font-mono text-foreground">{sq.rollup?.doneIssues} de {sq.rollup?.totalIssues}</td>
                          <td className="px-3 py-3.5">
                            <div className="flex items-center gap-2.5">
                              <span className="w-10 font-mono text-foreground">{pred}%</span>
                              <span aria-hidden="true" className="h-2 w-28 overflow-hidden rounded-md bg-border">
                                <span className={cn('block h-full rounded-md bg-current', INK[predictabilityTone(pred)])} style={{ width: `${pred}%` }} />
                              </span>
                            </div>
                          </td>
                          <td className={cn('px-3 py-3.5 font-mono', (sq.rollup?.overdueIssues ?? 0) > 0 ? cn('font-bold', INK.danger) : 'text-muted-foreground')}>
                            {sq.rollup?.overdueIssues ?? 0}
                          </td>
                        </>
                      )}
                    </tr>
                  );
                })}
                {!loading && rows.length === 0 && (
                  <tr className="border-t border-border">
                    <td colSpan={5} className="px-4 py-4 text-muted-foreground">Nenhuma squad encontrada.</td>
                  </tr>
                )}
                {loading && rows.length === 0 && (
                  <tr className="border-t border-border">
                    <td colSpan={5} className="px-4 py-4 text-muted-foreground">Carregando as squads…</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
        <p className="text-[13px] text-muted-foreground">
          Clima do time e participação nos rituais por squad ainda não aparecem aqui. Para o clima, use o Health Check de cada squad.
        </p>
      </PanelCard>
    </div>
  );
}
