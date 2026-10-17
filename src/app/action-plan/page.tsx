'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { actionPlanApi } from './api';
import { ActionPlanLobbyView, type LatestPlan } from '@/components/action-plan/ActionPlanLobbyView';
import { NewPlanDialog, type NewPlanValues } from '@/components/action-plan/NewPlanDialog';
import { useUserContext } from '@/context/UserContext';
import { useActiveSquad } from '@/hooks/useActiveSquad';
import { useMyMemberships } from '@/hooks/useMyMemberships';
import { useToolHistory } from '@/hooks/useToolHistory';
import { mergePlanRows, planPath, summarizeTasks, type TaskSummary } from '@/lib/action-plan';
import { errorMessage } from '@/lib/ceremony-api';
import type { ActionPlanBoard } from '@/lib/types';

const ROOMS_META_KEY = 'agileSpace_rooms_meta';

/** Lê um parâmetro da URL (o ciclo da sprint abre o hub com ?squad= e ?sprintId=); no servidor não há URL. */
function readQueryParam(name: string): string {
  if (typeof window === 'undefined') return '';
  return new URLSearchParams(window.location.search).get(name) ?? '';
}

const timeOf = (iso: string) => {
  const t = new Date(iso).getTime();
  return Number.isNaN(t) ? 0 : t;
};

/** Hub do Plano de ação (`/action-plan`): busca os planos da squad e liga os callbacks da tela. */
export default function ActionPlanHubPage() {
  const router = useRouter();
  const { userProfile, requestIdentity } = useUserContext();
  const { squadId: activeSquadId, squadName } = useActiveSquad();
  const { memberships } = useMyMemberships();
  const { history } = useToolHistory('action_plan');

  const [isSetupOpen, setIsSetupOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  // O ciclo da sprint abre o hub com ?squad= e ?sprintId= (lib/sprintCycleNav.ts)
  const [urlSquad] = useState(() => readQueryParam('squad'));
  const [urlSprint] = useState(() => readQueryParam('sprintId'));

  // O resultado guarda de qual squad é: trocar de squad volta para "carregando" sem limpar nada no efeito.
  const [result, setResult] = useState<{ squadId: string; boards: ActionPlanBoard[]; failed: boolean } | null>(null);
  const [reloadTick, setReloadTick] = useState(0);
  const [latestSummary, setLatestSummary] = useState<{ id: string; summary: TaskSummary } | null>(null);

  useEffect(() => {
    if (!activeSquadId) return;
    let alive = true;
    actionPlanApi
      .listBoardsBySquad(activeSquadId)
      .then((list) => {
        if (alive) setResult({ squadId: activeSquadId, boards: [...list].sort((a, b) => timeOf(b.createdAt) - timeOf(a.createdAt)), failed: false });
      })
      .catch((e) => {
        console.error('[action-plan] falha ao listar os planos da squad', e);
        if (alive) setResult({ squadId: activeSquadId, boards: [], failed: true });
      });
    return () => {
      alive = false;
    };
  }, [activeSquadId, reloadTick]);

  const current = result && result.squadId === activeSquadId ? result : null;
  const boards = useMemo(() => current?.boards ?? [], [current]);
  const loading = !!activeSquadId && !current;
  const failed = !!current?.failed;
  const retry = () => {
    setResult(null);
    setReloadTick((t) => t + 1);
  };

  // A lista não traz as ações: só o último plano ganha a contagem, com uma leitura própria.
  const latestId = boards[0]?.id;
  useEffect(() => {
    if (!latestId) return;
    let alive = true;
    actionPlanApi
      .listTasks(latestId)
      .then((tasks) => alive && setLatestSummary({ id: latestId, summary: summarizeTasks(tasks) }))
      .catch(() => { /* o cartão segue sem a contagem */ });
    return () => {
      alive = false;
    };
  }, [latestId]);

  const rows = useMemo(
    () => mergePlanRows(boards, history.map((h) => ({ roomId: h.roomId, title: h.title, createdAt: h.createdAt }))),
    [boards, history],
  );

  const latest: LatestPlan | null = useMemo(() => {
    const first = boards[0];
    if (!first) return null;
    const row = rows.find((r) => r.id === first.id);
    if (!row) return null;
    return { row, summary: latestSummary?.id === first.id ? latestSummary.summary : null };
  }, [boards, rows, latestSummary]);

  const squads = useMemo(() => {
    const list = memberships?.memberships.map((m) => ({ id: m.projectId, name: m.projectName || m.projectId })) ?? [];
    if (list.length === 0 && activeSquadId) return [{ id: activeSquadId, name: squadName || activeSquadId }];
    return list;
  }, [memberships, activeSquadId, squadName]);

  const saveRoomMeta = (id: string, title: string, team: string) => {
    try {
      const saved = localStorage.getItem(ROOMS_META_KEY);
      const rooms = saved ? JSON.parse(saved) : [];
      const newMeta = { roomId: id, type: 'action_plan', title, team, createdBy: userProfile?.id, createdAt: new Date().toISOString() };
      localStorage.setItem(ROOMS_META_KEY, JSON.stringify([...rooms, newMeta]));
    } catch (e) {
      console.error('Erro ao salvar metadados da sala', e);
    }
  };

  const handleNew = () => {
    setCreateError(null);
    if (!userProfile) {
      requestIdentity(() => setIsSetupOpen(true));
    } else {
      setIsSetupOpen(true);
    }
  };

  const handleCreate = async (values: NewPlanValues) => {
    if (isCreating) return;
    if (!userProfile || !userProfile.id) {
      console.error('[action-plan] Criar plano abortado: usuário sem ID.');
      setCreateError('Não foi possível identificar seu perfil.');
      return;
    }
    setIsCreating(true);
    setCreateError(null);
    try {
      // O servidor só liga o plano à squad pelo ID: `squadId` e `team` levam o mesmo valor. Criador, id e datas
      // são definidos por ele a partir do login.
      const doc = await actionPlanApi.createBoard({
        title: values.title,
        team: values.squadId || 'Squad Geral',
        squadId: values.squadId || undefined,
        sprintId: values.sprintId || undefined,
        isPublic: !values.isPrivate,
        participantIds: [userProfile.id],
      });
      if (doc) {
        const name = squads.find((s) => s.id === values.squadId)?.name ?? (values.squadId || 'Squad');
        saveRoomMeta(doc.id, values.title, name);
        setIsSetupOpen(false);
        router.push(planPath(doc.id));
      } else {
        setIsCreating(false);
      }
    } catch (error) {
      console.error('Error creating action plan: ', error);
      setIsCreating(false);
      setCreateError(errorMessage(error, 'Confira a conexão e tente de novo.'));
    }
  };

  return (
    <ActionPlanLobbyView
      hasSquad={!!activeSquadId}
      rows={rows}
      loading={loading}
      failed={failed}
      onRetry={retry}
      latest={latest}
      isCreating={isCreating}
      onNew={handleNew}
      onOpen={(id) => router.push(planPath(id))}
      onSquads={() => router.push('/workspace')}
    >
      {isSetupOpen && (
        <NewPlanDialog
          open
          onOpenChange={(open) => {
            if (!open) {
              setIsSetupOpen(false);
              setCreateError(null);
            }
          }}
          squads={squads}
          defaultSquadId={urlSquad || activeSquadId}
          initialSprintId={urlSprint}
          busy={isCreating}
          error={createError}
          onSubmit={handleCreate}
        />
      )}
    </ActionPlanLobbyView>
  );
}
