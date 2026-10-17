'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AlertCircle, Gauge, ListChecks, Loader2, MessageSquareText, RefreshCw, Target, TrendingUp, Undo2, CheckCircle2 } from 'lucide-react';
import { workItemsApi } from '@/app/work-items-api';
import { authFetch } from '@/lib/auth-client';
import { openOrCreateRetro, openOrCreateActionPlan } from '@/lib/sprintCycleNav';
import { useUserContext } from '@/context/UserContext';
import { useAuth } from '@/context/AuthContext';
import { EmptyState, ErrorState, KpiCard, KpiRow, LoadingSkeleton, PAGE_CARD } from '@/components/page';
import { FIELD, IconTile, ModalButton, SelectField } from '@/components/room-kit';
import { cn } from '@/lib/utils';
import { FIELD_LABEL } from './AdminOpsParts';
import { isEmptySprint, sprintNumbers, type SprintStatsLike } from './admin-platform-utils';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8002/api';

interface SquadOption {
  id: string;
  name: string;
  activeSprintId?: string | null;
}

export function CeremoniesDashboard() {
  const router = useRouter();
  const { userProfile } = useUserContext();
  const { session } = useAuth();
  const [squads, setSquads] = useState<SquadOption[]>([]);
  const [squadsLoading, setSquadsLoading] = useState(true);
  const [squadsError, setSquadsError] = useState(false);
  const [selectedSquadId, setSelectedSquadId] = useState('');
  /** ID de sprint digitado/preenchido. Vazio = a squad não tem sprint ativa (o servidor resolve "active"). */
  const [sprintId, setSprintId] = useState('');
  const [stats, setStats] = useState<SprintStatsLike | null>(null);
  const [loading, setLoading] = useState(false);
  const [statsError, setStatsError] = useState<string | null>(null);
  const [isNavigatingTo, setIsNavigatingTo] = useState<'retro' | 'action-plan' | null>(null);

  // "active" só vale como marcador para o servidor buscar a sprint ativa da squad: nunca vira o
  // sprintId real de um board novo, senão todas as squads sem sprint colidem no mesmo valor.
  const typed = sprintId.trim();
  const realSprintId = typed && typed.toLowerCase() !== 'active' ? typed : undefined;

  const loadSquads = useCallback(async () => {
    setSquadsLoading(true);
    setSquadsError(false);
    try {
      const res = await authFetch(`${API_BASE}/squads`);
      if (!res.ok) throw new Error(`Erro ${res.status}`);
      const data: SquadOption[] = await res.json();
      setSquads(data);
      if (data.length > 0) {
        const userActiveId = userProfile?.squadId || session?.activeProjectId;
        const matched = data.find((s) => s.id === userActiveId) || data[0];
        setSelectedSquadId(matched.id);
        setSprintId(matched.activeSprintId || '');
      }
    } catch (e) {
      console.error('Erro ao listar as squads:', e);
      setSquadsError(true);
    } finally {
      setSquadsLoading(false);
    }
  }, [userProfile?.squadId, session?.activeProjectId]);

  useEffect(() => {
    loadSquads();
  }, [loadSquads]);

  const requestRef = useRef(0);
  const fetchStats = useCallback(async () => {
    if (!selectedSquadId) return;
    const mine = ++requestRef.current;
    setLoading(true);
    setStatsError(null);
    try {
      const data = await workItemsApi.getSprintStats(selectedSquadId, realSprintId ?? 'active');
      if (mine !== requestRef.current) return;
      setStats(data);
    } catch (e) {
      if (mine !== requestRef.current) return;
      console.error('Erro ao carregar os dados da sprint:', e);
      setStats(null);
      setStatsError((e as Error)?.message || 'Tente de novo em instantes.');
    } finally {
      if (mine === requestRef.current) setLoading(false);
    }
  }, [selectedSquadId, realSprintId]);

  // Troca de squad ou de sprint: busca de novo (com uma pausa curta enquanto a pessoa digita o ID).
  useEffect(() => {
    if (!selectedSquadId) return;
    setLoading(true);
    const t = setTimeout(fetchStats, 400);
    return () => clearTimeout(t);
  }, [selectedSquadId, fetchStats]);

  const go = async (target: 'retro' | 'action-plan') => {
    if (!realSprintId) return;
    setIsNavigatingTo(target);
    try {
      if (target === 'retro') await openOrCreateRetro(router, realSprintId, selectedSquadId);
      else await openOrCreateActionPlan(router, realSprintId, selectedSquadId);
    } finally {
      setIsNavigatingTo(null);
    }
  };

  if (squadsLoading) return <LoadingSkeleton variant="kpis" label="Carregando as squads" />;
  if (squadsError) return <ErrorState title="Não foi possível carregar as squads" onRetry={loadSquads} />;

  const noSquads = squads.length === 0;
  const nums = stats ? sprintNumbers(stats) : null;
  const navDisabled = noSquads || !realSprintId || isNavigatingTo !== null;

  return (
    <div className="flex flex-col gap-5">
      <section className={cn(PAGE_CARD, 'overflow-clip')} aria-label="Squad e sprint">
        <header className="flex items-center gap-3.5 border-b border-border px-6 py-4">
          <IconTile icon={Target} />
          <div className="flex min-w-0 flex-col">
            <h2 className="text-lg font-bold tracking-tight text-foreground">Squad e sprint</h2>
            <p className="text-[13px] text-muted-foreground">Dados consolidados da sprint</p>
          </div>
        </header>

        <div className="flex flex-col gap-4 p-5 md:p-6">
          <div className="flex flex-wrap items-end gap-3">
            <div className="flex w-full flex-col gap-1.5 sm:w-[280px]">
              <label htmlFor="cer-squad" className={FIELD_LABEL}>Squad</label>
              {noSquads ? (
                <div className={cn(FIELD, 'flex h-10 items-center text-muted-foreground')}>Nenhuma squad encontrada</div>
              ) : (
                <SelectField
                  id="cer-squad"
                  aria-label="Squad"
                  value={selectedSquadId}
                  onChange={(val) => {
                    setSelectedSquadId(val);
                    setSprintId(squads.find((s) => s.id === val)?.activeSprintId || '');
                  }}
                  options={squads.map((s) => ({ value: s.id, label: `${s.name} (${s.id})` }))}
                  className="h-10"
                />
              )}
            </div>

            <div className="flex w-full flex-col gap-1.5 sm:w-[200px]">
              <label htmlFor="cer-sprint" className={FIELD_LABEL}>Sprint</label>
              <input
                id="cer-sprint"
                value={sprintId}
                onChange={(e) => setSprintId(e.target.value)}
                placeholder="ID da sprint (ex.: 1045)"
                disabled={noSquads}
                className={cn(FIELD, 'h-10')}
              />
            </div>

            <ModalButton variant="secondary" onClick={fetchStats} disabled={noSquads || loading} className="gap-2">
              {loading ? <Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" strokeWidth={1.5} aria-hidden="true" /> : <RefreshCw className="h-4 w-4" strokeWidth={1.5} aria-hidden="true" />}
              Atualizar
            </ModalButton>

            <ModalButton variant="secondary" onClick={() => go('retro')} disabled={navDisabled} className="gap-2">
              {isNavigatingTo === 'retro' ? <Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" strokeWidth={1.5} aria-hidden="true" /> : <MessageSquareText className="h-4 w-4" strokeWidth={1.5} aria-hidden="true" />}
              Abrir retro desta sprint
            </ModalButton>

            <ModalButton variant="secondary" onClick={() => go('action-plan')} disabled={navDisabled} className="gap-2">
              {isNavigatingTo === 'action-plan' ? <Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" strokeWidth={1.5} aria-hidden="true" /> : <ListChecks className="h-4 w-4" strokeWidth={1.5} aria-hidden="true" />}
              Abrir plano de ação
            </ModalButton>
          </div>

          {!noSquads && !realSprintId && (
            <p role="note" className="flex items-start gap-2 rounded-xl border border-amber-500/40 bg-amber-500/10 px-3.5 py-2.5 text-[13px] text-amber-800 dark:text-amber-200">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" strokeWidth={1.5} aria-hidden="true" />
              Esta squad não tem sprint ativa. Informe o ID da sprint para abrir a retro e o plano de ação.
            </p>
          )}
        </div>
      </section>

      {noSquads ? (
        <EmptyState
          icon={Target}
          title="Nenhum dado registrado para esta sprint"
          description="Sincronize o projeto em Sincronização Jira ou faça as cerimônias ligadas à sprint."
        />
      ) : loading ? (
        <LoadingSkeleton variant="kpis" label="Carregando os dados da sprint" />
      ) : statsError ? (
        <ErrorState title="Não foi possível carregar os dados da sprint" description={statsError} onRetry={fetchStats} />
      ) : isEmptySprint(stats) || !nums ? (
        <EmptyState
          icon={Target}
          title="Nenhum dado registrado para esta sprint"
          description="Sincronize o projeto em Sincronização Jira ou faça as cerimônias ligadas à sprint."
        />
      ) : (
        <KpiRow columns={4}>
          <KpiCard label="Velocity real entregue" value={`${nums.delivered} pts`} icon={TrendingUp} />
          <KpiCard label="Comprometido no Planner" value={`${nums.committed} pts`} icon={Gauge} tone="neutral" />
          <KpiCard
            label="Carry-overs / débitos"
            value={`${nums.carryOvers} ${nums.carryOvers === 1 ? 'item' : 'itens'}`}
            hint="Itens que ficaram para a próxima sprint"
            icon={Undo2}
            tone="warn"
          />
          <KpiCard
            label="Say/Do"
            value={nums.sayDo == null ? '—' : `${nums.sayDo}%`}
            hint={nums.sayDo == null ? 'Nada comprometido na sprint' : 'Entregue ÷ comprometido'}
            icon={CheckCircle2}
            tone="success"
          />
        </KpiRow>
      )}
    </div>
  );
}
