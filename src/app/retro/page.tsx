'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { CreateRetroDialog } from '@/components/retro/CreateRetroDialog';
import { RetroLobbyView, type RetroLobbyDetail } from '@/components/retro/RetroLobbyView';
import { useUserContext } from '@/context/UserContext';
import { useActiveSquad } from '@/hooks/useActiveSquad';
import { useToolHistory } from '@/hooks/useToolHistory';
import { mergeLobbyRows, pendingActionsOf, summarizeRetroBoard } from '@/lib/retro-lobby';
import { listTemplates, type RetroTemplate } from '@/lib/retro-templates';
import type { RetroBoard } from '@/lib/types';
import { retroApi } from './api';

/** Quantas retros recentes têm os cartões lidos para mostrar contagens e ações em aberto (uma leitura por retro). */
const DETAIL_LIMIT = 8;

export default function RetroHubPage() {
  const router = useRouter();
  const { userProfile, requestIdentity } = useUserContext();
  const { squadId: activeSquadId, squadName } = useActiveSquad();
  const { history: localHistory, removeRoom: removeLocalRoom } = useToolHistory('retro');

  const [isSetupOpen, setIsSetupOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [presetFormatId, setPresetFormatId] = useState<string | undefined>();

  const [boards, setBoards] = useState<RetroBoard[]>([]);
  const [loadingBoards, setLoadingBoards] = useState(true);
  const [boardsFailed, setBoardsFailed] = useState(false);
  const [details, setDetails] = useState<Record<string, RetroLobbyDetail>>({});
  const [savedFormats, setSavedFormats] = useState<RetroTemplate[]>([]);

  // Os formatos salvos vivem no navegador; relê ao abrir/fechar o "Nova retro" (a criação pode ter salvo um).
  useEffect(() => { setSavedFormats(listTemplates()); }, [isSetupOpen]);

  const loadBoards = useCallback(async () => {
    if (!activeSquadId) {
      // Sem squad não há o que listar: sem isto o esqueleto ficava para sempre.
      setBoards([]);
      setLoadingBoards(false);
      return;
    }
    setLoadingBoards(true);
    try {
      setBoards(await retroApi.listBoards({ squadId: activeSquadId }));
      setBoardsFailed(false);
    } catch (err) {
      console.error('Erro ao listar retros', err);
      setBoardsFailed(true);
    } finally {
      setLoadingBoards(false);
    }
  }, [activeSquadId]);

  useEffect(() => { void loadBoards(); }, [loadBoards]);

  const rows = useMemo(
    () => mergeLobbyRows(boards, localHistory.map((h) => ({ roomId: h.roomId, title: h.title, team: h.team, createdAt: h.createdAt }))),
    [boards, localHistory]
  );

  // Atalhos deste navegador que o servidor não lista: confere cada um uma vez e tira da lista o que já foi apagado (404).
  const checkedLocalRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    if (loadingBoards || boardsFailed) return;
    const pending = rows.filter((r) => !r.board && !checkedLocalRef.current.has(r.id)).slice(0, 10);
    if (pending.length === 0) return;
    pending.forEach((r) => checkedLocalRef.current.add(r.id));
    void Promise.allSettled(pending.map((r) => retroApi.getBoard(r.id))).then((settled) => {
      settled.forEach((result, i) => {
        if (result.status === 'rejected' && (result.reason as { status?: number } | undefined)?.status === 404) removeLocalRoom(pending[i].id);
      });
    });
  }, [rows, loadingBoards, boardsFailed, removeLocalRoom]);

  // Contagens e ações em aberto: lê os cartões das retros mais recentes (falha de uma não derruba as outras).
  useEffect(() => {
    const recent = rows.filter((r) => r.board).slice(0, DETAIL_LIMIT);
    if (recent.length === 0) return;
    let cancelled = false;
    Promise.allSettled(recent.map(async (r) => ({ id: r.id, board: r.board!, cards: await retroApi.getCards(r.id) }))).then((settled) => {
      if (cancelled) return;
      const next: Record<string, RetroLobbyDetail> = {};
      for (const s of settled) {
        if (s.status !== 'fulfilled') continue;
        const { id, board, cards } = s.value;
        next[id] = { summary: summarizeRetroBoard(board, cards), open: pendingActionsOf(board, cards) };
      }
      setDetails(next);
    });
    return () => { cancelled = true; };
  }, [rows]);

  const openNew = (formatId?: string) => {
    setPresetFormatId(formatId);
    if (!userProfile) requestIdentity(() => setIsSetupOpen(true));
    else setIsSetupOpen(true);
  };

  // ?nova=1 (atalho da Home): abre o diálogo de criar assim que o perfil carrega e tira o parâmetro da URL.
  const [novaHandled, setNovaHandled] = useState(false);
  useEffect(() => {
    if (novaHandled || !userProfile) return;
    const params = new URLSearchParams(window.location.search);
    if (params.get('nova') !== '1') return;
    setNovaHandled(true);
    setIsSetupOpen(true);
    params.delete('nova');
    const qs = params.toString();
    window.history.replaceState(null, '', window.location.pathname + (qs ? `?${qs}` : ''));
  }, [userProfile, novaHandled]);

  return (
    <RetroLobbyView
      squadName={squadName}
      rows={rows}
      loading={loadingBoards}
      failed={boardsFailed}
      onRetry={() => void loadBoards()}
      details={details}
      savedFormats={savedFormats}
      isCreating={isCreating}
      onNew={openNew}
      onJoin={(code) => router.push(`/retro/${code}`)}
      onOpenBoard={(id) => router.push(`/retro/${id}`)}
    >
      <CreateRetroDialog open={isSetupOpen} onOpenChange={setIsSetupOpen} onCreatingChange={setIsCreating} presetFormatId={presetFormatId} />
    </RetroLobbyView>
  );
}
