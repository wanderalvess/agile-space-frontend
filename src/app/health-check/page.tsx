'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { CreateHealthCheckDialog, type CreateHealthCheckInput } from '@/components/health-check/CreateHealthCheckDialog';
import { HealthLobbyView, type HealthHubState } from '@/components/health-check/HealthLobbyView';
import { useToast } from '@/hooks/use-toast';
import { useToolHistory } from '@/hooks/useToolHistory';
import { useActiveSquad } from '@/hooks/useActiveSquad';
import { useUserContext } from '@/context/UserContext';
import { answersFromSummary, mergeHealthRows, removeLocalRoomMeta } from '@/lib/health-check-lobby';
import { ritualsApi } from '@/lib/home-api';
import { healthCheckApi } from './api';
import type { HealthCheckBoard } from '@/lib/types';

const ROOMS_META_KEY = 'agileSpace_rooms_meta';
/** Quantos radares recentes a lista busca (a contagem de respostas vem do histórico da Home). */
const HISTORY_LIMIT = 50;

export default function HealthCheckHubPage() {
  const router = useRouter();
  const { toast } = useToast();
  const { userProfile, requestIdentity } = useUserContext();
  const { squadId: activeSquadId } = useActiveSquad();
  const { history: localHistory } = useToolHistory('health');

  const [isSetupOpen, setIsSetupOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [boards, setBoards] = useState<HealthCheckBoard[]>([]);
  const [answers, setAnswers] = useState<Map<string, number>>(new Map());
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  const saveRoomMeta = (id: string, title: string, team: string) => {
    try {
      const saved = localStorage.getItem(ROOMS_META_KEY);
      const rooms = saved ? JSON.parse(saved) : [];
      rooms.push({ roomId: id, type: 'health', title, team, createdBy: userProfile?.id, createdAt: new Date().toISOString() });
      localStorage.setItem(ROOMS_META_KEY, JSON.stringify(rooms));
    } catch (e) {
      console.error('Erro ao salvar metadados da sala', e);
    }
  };

  const loadBoards = useCallback(async () => {
    if (!activeSquadId) {
      // Sem squad não há o que listar: sem isto o esqueleto ficava para sempre.
      setBoards([]);
      setFailed(false);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const list = await healthCheckApi.listBoards(activeSquadId);
      setBoards(list);
      setFailed(false);
      // Respostas por radar: vêm do histórico da Home. Se falhar, a lista segue sem a coluna (nada é inventado).
      ritualsApi
        .history('HEALTH_CHECK', { squadId: activeSquadId, limit: HISTORY_LIMIT })
        .then((history) => {
          const map = new Map<string, number>();
          for (const h of history) {
            const n = answersFromSummary(h.summary);
            if (n !== null) map.set(h.id, n);
          }
          setAnswers(map);
        })
        .catch(() => setAnswers(new Map()));
    } catch (e) {
      console.error('Erro ao listar radares', e);
      setFailed(true);
    } finally {
      setLoading(false);
    }
  }, [activeSquadId]);

  useEffect(() => { void loadBoards(); }, [loadBoards]);

  // As salas abertas neste navegador entram como atalho, mas só as da squad ativa (ou sem squad).
  const rows = useMemo(() => {
    const squad = activeSquadId.toLowerCase();
    const local = localHistory.filter((h) => !h.team || h.team.toLowerCase() === squad);
    return mergeHealthRows(boards, local.map((h) => ({ roomId: h.roomId, title: h.title, team: h.team, createdAt: h.createdAt })), answers);
  }, [boards, localHistory, answers, activeSquadId]);

  const state: HealthHubState = !activeSquadId ? 'no-squad' : loading && boards.length === 0 ? 'loading' : failed ? 'error' : 'ready';

  const openNew = () => {
    if (!userProfile) requestIdentity(() => setIsSetupOpen(true));
    else setIsSetupOpen(true);
  };

  const handleCreate = async ({ dimensions, title, team, scaleType }: CreateHealthCheckInput) => {
    if (isCreating) return;
    if (!userProfile || !userProfile.id) {
      console.error('[health-check] Criar radar abortado: usuário sem ID.');
      throw new Error('Não foi possível carregar a sua identidade. Atualize a página e tente de novo.');
    }
    setIsCreating(true);
    try {
      // O servidor ignora creatorId, status e participantIds do corpo (usa o login); seguem aqui pelo contrato.
      const created = await healthCheckApi.saveOrUpdateBoard({
        creatorId: userProfile.id,
        status: 'collecting' as const,
        createdAt: new Date().toISOString(),
        dimensions,
        scaleType,
        sprintName: title,
        team,
        participantIds: [userProfile.id],
      });
      if (!created || !created.id) throw new Error('O servidor não devolveu o radar criado.');
      saveRoomMeta(created.id, title, team);
      setIsSetupOpen(false);
      router.push(`/health-check/${created.id}`);
    } finally {
      setIsCreating(false);
    }
  };

  const handleDelete = async (id: string) => {
    await healthCheckApi.deleteBoard(id);
    setBoards((prev) => prev.filter((b) => b.id !== id));
    // Tira também do atalho local (senão a sala apagada continuaria na lista deste navegador).
    removeLocalRoomMeta(id, window.localStorage);
    window.dispatchEvent(new Event('storage'));
    toast({ title: 'Pesquisa apagada' });
  };

  return (
    <HealthLobbyView
      rows={rows}
      state={state}
      onRetry={() => void loadBoards()}
      onNew={openNew}
      isCreating={isCreating}
      onJoin={(id) => router.push(`/health-check/${encodeURIComponent(id)}`)}
      onOpen={(id) => router.push(`/health-check/${encodeURIComponent(id)}`)}
      currentUserId={userProfile?.id}
      onDelete={handleDelete}
    >
      <CreateHealthCheckDialog open={isSetupOpen} onOpenChange={setIsSetupOpen} onCreateBoard={handleCreate} isCreating={isCreating} />
    </HealthLobbyView>
  );
}
