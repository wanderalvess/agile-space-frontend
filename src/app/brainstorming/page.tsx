'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { BrainstormLobbyView, type BrainstormLastDetail, type BrainstormLobbyState } from '@/components/brainstorming/BrainstormLobbyView';
import { CreateBrainstormDialog } from '@/components/brainstorming/CreateBrainstormDialog';
import { useToast } from '@/hooks/use-toast';
import { useActiveSquad } from '@/hooks/useActiveSquad';
import { useToolHistory } from '@/hooks/useToolHistory';
import { useUserContext } from '@/context/UserContext';
import { errorMessage } from '@/lib/ceremony-api';
import { mergeBrainstormRows, type BrainstormLobbyRow, type HistoryRowLike } from '@/lib/brainstorming-lobby';
import { ritualsApi } from '@/lib/home-api';
import type { BrainstormingBoard } from '@/lib/types';
import { brainstormingApi } from './api';

/** Quantas sessões o histórico da squad devolve (a tabela mostra todas as que vierem). */
const HISTORY_LIMIT = 50;

export default function BrainstormingHubPage() {
  const router = useRouter();
  const { toast } = useToast();
  const { userProfile, requestIdentity } = useUserContext();
  const { squadId: activeSquadId } = useActiveSquad();
  const { history: localHistory, removeRoom } = useToolHistory('brainstorming');

  const [isSetupOpen, setIsSetupOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);

  const [boards, setBoards] = useState<BrainstormingBoard[]>([]);
  const [history, setHistory] = useState<HistoryRowLike[]>([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [lastDetail, setLastDetail] = useState<BrainstormLastDetail | undefined>();
  const loadSeq = useRef(0);

  const loadBoards = useCallback(async () => {
    const seq = ++loadSeq.current;
    if (!activeSquadId) {
      // Sem squad não há o que listar: sem isto o esqueleto ficava para sempre.
      setBoards([]);
      setHistory([]);
      setFailed(false);
      setLoading(false);
      return;
    }
    setLoading(true);
    setFailed(false);
    try {
      const [list, ritual] = await Promise.all([
        brainstormingApi.listBoards(activeSquadId),
        // As contagens vêm do histórico da squad; se ele falhar a lista aparece do mesmo jeito, sem os números.
        ritualsApi.history('BRAINSTORMING', { squadId: activeSquadId, limit: HISTORY_LIMIT }).catch(() => []),
      ]);
      if (seq !== loadSeq.current) return;
      setBoards(list);
      setHistory(ritual.map((r) => ({ id: r.id, participantsCount: r.participantsCount, summary: r.summary, status: r.status })));
    } catch (error) {
      if (seq !== loadSeq.current) return;
      console.error('Erro ao listar brainstormings', error);
      setFailed(true);
    } finally {
      if (seq === loadSeq.current) setLoading(false);
    }
  }, [activeSquadId]);

  useEffect(() => {
    void loadBoards();
  }, [loadBoards]);

  const rows = useMemo(
    () => mergeBrainstormRows(boards, history, localHistory.map((h) => ({ roomId: h.roomId, title: h.title, team: h.team, createdAt: h.createdAt }))),
    [boards, history, localHistory]
  );

  // Contagens da sessão mais recente da squad: uma leitura de ideias, grupos e pessoas (falha de uma não derruba as outras).
  const lastId = rows.find((r) => !r.localOnly)?.id;
  useEffect(() => {
    setLastDetail(undefined);
    if (!lastId) return;
    let cancelled = false;
    Promise.allSettled([brainstormingApi.getIdeas(lastId), brainstormingApi.getGroups(lastId), brainstormingApi.getParticipants(lastId)]).then(([ideas, groups, people]) => {
      if (cancelled) return;
      if (ideas.status !== 'fulfilled' && groups.status !== 'fulfilled' && people.status !== 'fulfilled') return;
      setLastDetail({
        ideas: ideas.status === 'fulfilled' ? ideas.value.length : undefined,
        groups: groups.status === 'fulfilled' ? groups.value.length : undefined,
        people: people.status === 'fulfilled' ? people.value.length : undefined,
      });
    });
    return () => {
      cancelled = true;
    };
  }, [lastId]);

  const openNew = () => {
    if (!userProfile) requestIdentity(() => setIsSetupOpen(true));
    else setIsSetupOpen(true);
  };

  const handleDelete = useCallback(
    async (row: BrainstormLobbyRow) => {
      try {
        await brainstormingApi.deleteBoard(row.id);
        setBoards((prev) => prev.filter((b) => b.id !== row.id));
        removeRoom(row.id);
        toast({ title: 'Brainstorming apagado', description: row.title });
      } catch (error) {
        console.error('Erro ao apagar o brainstorming', error);
        toast({ title: 'Não foi possível apagar o brainstorming', description: errorMessage(error, 'Tente novamente.'), variant: 'destructive' });
      }
    },
    [removeRoom, toast]
  );

  const state: BrainstormLobbyState = !activeSquadId ? 'no-squad' : loading ? 'loading' : failed ? 'error' : 'ready';

  return (
    <BrainstormLobbyView
      state={state}
      rows={rows}
      lastDetail={lastDetail}
      currentUserId={userProfile?.id}
      isCreating={isCreating}
      onRetry={() => void loadBoards()}
      onNew={openNew}
      onJoin={(id) => router.push(`/brainstorming/${id}`)}
      onOpen={(id) => router.push(`/brainstorming/${id}`)}
      onDelete={handleDelete}
    >
      <CreateBrainstormDialog
        open={isSetupOpen}
        onOpenChange={setIsSetupOpen}
        onCreatingChange={setIsCreating}
        onCreated={(board) => router.push(`/brainstorming/${board.id}`)}
      />
    </BrainstormLobbyView>
  );
}
