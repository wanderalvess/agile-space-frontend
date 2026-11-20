'use client';

import React, { useEffect, useState } from 'react';
import { BarChart3, Loader2 } from 'lucide-react';
import { workItemsApi } from '@/app/work-items-api';
import { useActiveSquad } from '@/hooks/useActiveSquad';
import { useProjectEstimationUnit, type EstimationUnit } from '@/components/ui/DashboardFilters';
import { Modal, ModalButton } from '@/components/room-kit';

interface SprintStatsDialogProps {
  open: boolean;
  onClose: () => void;
  squadId?: string;
  sprintId?: string;
}

// Sufixo curto da unidade que a squad configurou (antes era sempre "pts").
const UNIT_SUFFIX: Record<EstimationUnit, string> = {
  SP: 'pts',
  HOURS: 'h',
  TSHIRT: 'tamanhos',
  COUNT: 'itens',
};

/** Número que o servidor mandou, ou `null`: campo ausente (backend antigo) não vira zero. */
export function statNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

/** Os quatro números novos do Jira (itens, concluídos, bugs, pontos que ficaram), só os que vieram. */
export function jiraExtras(stats: Record<string, unknown> | null | undefined, suffix: string): { key: string; value: number; suffix?: string; label: string }[] {
  if (!stats) return [];
  const total = statNumber(stats.totalItens);
  const done = statNumber(stats.concluidosJira);
  const bugs = statNumber(stats.bugs);
  const carryPoints = statNumber(stats.carryOverPontos);
  return [
    ...(total !== null ? [{ key: 'totalItens', value: total, label: 'Itens na sprint' }] : []),
    ...(done !== null ? [{ key: 'concluidosJira', value: done, label: 'Concluídos no Jira' }] : []),
    ...(bugs !== null ? [{ key: 'bugs', value: bugs, label: 'Bugs na sprint' }] : []),
    ...(carryPoints !== null ? [{ key: 'carryOverPontos', value: carryPoints, suffix: suffix || undefined, label: 'Pontos que ficaram para a próxima' }] : []),
  ];
}

function Stat({ value, suffix, label }: { value: React.ReactNode; suffix?: string; label: string }) {
  return (
    <div className="rounded-xl border border-border bg-muted/40 p-3.5">
      <div className="text-2xl font-bold tabular-nums text-foreground">
        {value} {suffix && <span className="text-sm font-medium text-muted-foreground">{suffix}</span>}
      </div>
      <div className="text-xs text-muted-foreground">{label}</div>
    </div>
  );
}

/** Números da sprint (Jira) para levar à conversa da retro: entregue, previsto e o que ficou para a próxima. */
export function SprintStatsDialog({ open, onClose, squadId, sprintId }: SprintStatsDialogProps) {
  const { squadId: activeSquadId } = useActiveSquad();
  const { unit, isConfigured } = useProjectEstimationUnit();
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const activeSquad = squadId || activeSquadId;
  const activeSprint = sprintId || 'active';
  // Sem unidade configurada pela squad, não assume "pts": mostra só o número.
  const suffix = isConfigured ? UNIT_SUFFIX[unit] : '';

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    setStats(null); // não mostrar os números da squad/sprint anterior enquanto carrega ou se falhar
    let cancelled = false;
    workItemsApi.getSprintStats(activeSquad, activeSprint)
      .then((result) => { if (!cancelled) setStats(result); })
      .catch(console.error)
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [open, activeSquad, activeSprint]);

  const delivered = stats ? (stats.entregue ?? stats.velocityReal ?? 0) : 0;
  const planned = stats?.previsto || 0;
  const extras = jiraExtras(stats, suffix);
  const hasAnyData = !!stats && (delivered > 0 || planned > 0 || (stats.carryOvers || 0) > 0 || extras.some((e) => e.value > 0));

  return (
    <Modal
      open={open}
      onOpenChange={(next) => { if (!next) onClose(); }}
      size="md"
      className="sm:max-w-[620px]"
      icon={BarChart3}
      title="Números da sprint"
      description={<>Squad <span className="font-semibold text-foreground">{activeSquad}</span> · dados do Jira</>}
      footer={<ModalButton onClick={onClose}>Fechar</ModalButton>}
    >
      {loading ? (
        <div role="status" className="flex flex-col items-center justify-center gap-3 py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary [.theme-totvs:not(.dark)_&]:text-foreground" strokeWidth={1.5} aria-hidden="true" />
          <p className="m-0 text-sm text-muted-foreground">Carregando os números da sprint…</p>
        </div>
      ) : stats ? (
        <div className="flex flex-col gap-4 pt-2">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <Stat value={delivered} suffix={suffix} label="Entregue na sprint" />
            <Stat value={delivered} suffix={`de ${planned}`} label="Entregue do previsto" />
            <Stat value={stats.carryOvers || 0} suffix={suffix} label="Ficou para a próxima" />
          </div>

          {extras.length > 0 && (
            <div aria-label="Itens da sprint no Jira" role="group" className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {extras.map((e) => <Stat key={e.key} value={e.value} suffix={e.suffix} label={e.label} />)}
            </div>
          )}

          {planned > 0 && (
            <div className="flex items-center justify-between rounded-xl border border-border bg-muted/40 px-3.5 py-3 text-sm">
              <span className="text-muted-foreground">Cumprimento do planejado</span>
              <span className="font-bold tabular-nums">{Math.round((delivered / (planned || 1)) * 100)}%</span>
            </div>
          )}

          {!hasAnyData && (
            <p className="m-0 rounded-xl border border-dashed border-border p-3.5 text-sm text-muted-foreground">
              Ainda não há dados desta sprint. Conecte o Jira e sincronize a squad no Resumo da squad para os números aparecerem aqui.
            </p>
          )}
        </div>
      ) : (
        <p className="m-0 py-6 text-center text-sm text-red-700 dark:text-red-300">Não foi possível carregar os números desta sprint. Tente de novo em instantes.</p>
      )}
    </Modal>
  );
}
