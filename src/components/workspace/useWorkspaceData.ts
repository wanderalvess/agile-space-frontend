'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { workspaceApi, type QuickLink } from '@/app/workspace/api';
import { pokerApi } from '@/app/room/api';
import { retroApi } from '@/app/retro/api';
import { healthCheckApi } from '@/app/health-check/api';
import { useToast } from '@/hooks/use-toast';
import { mergeHistory, onlyMine, type RawSession } from './history-utils';
import type { HistoryItem, KanbanCardData, KanbanCardPatch, KanbanPriority, KanbanStatus, StickyNote } from './types';

/** Os dados do Meu espaço e as ações que os alteram. Tudo que a tela mostra passa por aqui. */
export function useWorkspaceData(userId: string, squadId: string | undefined) {
  const { toast } = useToast();

  const [cards, setCards] = useState<KanbanCardData[]>([]);
  const [notes, setNotes] = useState<StickyNote[]>([]);
  const [links, setLinks] = useState<QuickLink[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);

  // Históricos colaborativos: busca as listas completas via REST e filtra no cliente pelas salas/quadros em que
  // a pessoa é participante ou criadora — mesmo padrão de "minhas sessões" de src/app/room/page.tsx.
  const [pokerHistory, setPokerHistory] = useState<RawSession[]>([]);
  const [retroHistory, setRetroHistory] = useState<RawSession[]>([]);
  const [healthHistory, setHealthHistory] = useState<RawSession[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(true);
  const [historyError, setHistoryError] = useState(false);
  const [historyNonce, setHistoryNonce] = useState(0);

  // --- Indicador "Salvando…" (some em 1,5 s) ---
  const [isSaving, setIsSaving] = useState(false);
  const savingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const markSaving = useCallback(() => {
    setIsSaving(true);
    if (savingTimer.current) clearTimeout(savingTimer.current);
    savingTimer.current = setTimeout(() => setIsSaving(false), 1500);
  }, []);
  useEffect(() => () => { if (savingTimer.current) clearTimeout(savingTimer.current); }, []);

  const reportError = useCallback((title: string, e: unknown) => {
    console.error(e);
    toast({ title, description: e instanceof Error ? e.message : 'Tente novamente.', variant: 'destructive' });
  }, [toast]);

  const load = useCallback(async () => {
    if (!userId) return;
    try {
      const [cardsList, notesList, linksList] = await Promise.all([
        workspaceApi.getKanbanCards(userId),
        workspaceApi.getStickyNotes(userId),
        workspaceApi.getQuickLinks(userId),
      ]);
      setCards(cardsList || []);
      setNotes(notesList || []);
      setLinks(linksList || []);
      setLoadError(false);
    } catch (e) {
      console.error(e);
      setLoadError(true);
      toast({ title: 'Não foi possível carregar o seu espaço', description: 'Verifique a conexão e recarregue a página.', variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  }, [userId, toast]);

  useEffect(() => {
    if (userId) load();
  }, [userId]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!userId) return;
    if (!squadId) {
      // Sem equipe não há o que buscar: sem isto a aba Histórico ficava carregando para sempre.
      setIsLoadingHistory(false);
      return;
    }
    let cancelled = false;
    (async () => {
      setIsLoadingHistory(true);
      setHistoryError(false);
      try {
        const [rooms, retros, healths] = await Promise.all([
          pokerApi.listRooms(squadId),
          retroApi.listBoards({ squadId }),
          healthCheckApi.listBoards(squadId),
        ]);
        if (cancelled) return;
        setPokerHistory(onlyMine(rooms, userId));
        setRetroHistory(onlyMine(retros, userId));
        setHealthHistory(onlyMine(healths, userId));
      } catch (e) {
        console.error(e);
        if (!cancelled) {
          setHistoryError(true);
          toast({ title: 'Não foi possível carregar o histórico', description: 'Tente recarregar a página.', variant: 'destructive' });
        }
      } finally {
        if (!cancelled) setIsLoadingHistory(false);
      }
    })();
    return () => { cancelled = true; };
  }, [userId, squadId, historyNonce]); // eslint-disable-line react-hooks/exhaustive-deps

  const history: HistoryItem[] | null = useMemo(
    () => (isLoadingHistory ? null : mergeHistory(pokerHistory, retroHistory, healthHistory)),
    [pokerHistory, retroHistory, healthHistory, isLoadingHistory],
  );

  const retryHistory = useCallback(() => setHistoryNonce((n) => n + 1), []);

  // --- Kanban ---
  const moveCard = useCallback(async (id: string, status: KanbanStatus) => {
    if (!userId) return;
    markSaving();
    setCards((prev) => prev.map((c) => (c.id === id ? { ...c, status } : c))); // otimista
    try {
      // Escrita parcial: só o status muda (antes ia um card incompleto e o servidor recusava).
      await workspaceApi.patchKanbanCard(id, { status });
    } catch (e) {
      reportError('Não foi possível mover a tarefa', e);
      load();
    }
  }, [userId, markSaving, reportError, load]);

  const createCard = useCallback(async (card: { title: string; description: string; status: KanbanStatus; priority: KanbanPriority; tag: string; dueDate?: string }) => {
    if (!userId) return false;
    markSaving();
    try {
      await workspaceApi.saveKanbanCard(userId, card);
      await load();
      return true;
    } catch (e) {
      // Mantém o diálogo aberto: o que foi digitado não se perde.
      reportError('Não foi possível salvar a tarefa', e);
      return false;
    }
  }, [userId, markSaving, reportError, load]);

  const patchCard = useCallback(async (id: string, changes: KanbanCardPatch) => {
    markSaving();
    try {
      await workspaceApi.patchKanbanCard(id, changes);
      await load();
      return true;
    } catch (e) {
      reportError('Não foi possível salvar a tarefa', e);
      return false;
    }
  }, [markSaving, reportError, load]);

  const deleteCard = useCallback(async (id: string) => {
    markSaving();
    try {
      await workspaceApi.deleteKanbanCard(id);
      await load();
      return true;
    } catch (e) {
      reportError('Não foi possível excluir a tarefa', e);
      return false;
    }
  }, [markSaving, reportError, load]);

  // --- Notas ---
  const addNote = useCallback(async () => {
    if (!userId) return;
    markSaving();
    try {
      await workspaceApi.saveStickyNote(userId, { content: '', color: 'bg-amber-50 border-amber-200/60 text-amber-900', isPinned: false });
      await load();
    } catch (e) {
      reportError('Não foi possível criar a nota', e);
    }
  }, [userId, markSaving, reportError, load]);

  const updateNote = useCallback(async (id: string, updates: Partial<StickyNote>) => {
    if (!userId) return;
    markSaving();
    setNotes((prev) => prev.map((n) => (n.id === id ? { ...n, ...updates } : n))); // otimista
    try {
      await workspaceApi.patchStickyNote(id, updates);
    } catch (e) {
      reportError('Não foi possível salvar a nota', e);
      load();
    }
  }, [userId, markSaving, reportError, load]);

  const deleteNote = useCallback(async (id: string) => {
    markSaving();
    setNotes((prev) => prev.filter((n) => n.id !== id)); // otimista
    try {
      await workspaceApi.deleteStickyNote(id);
    } catch (e) {
      reportError('Não foi possível excluir a nota', e);
      load();
    }
  }, [markSaving, reportError, load]);

  const promoteNote = useCallback(async (note: StickyNote) => {
    if (!userId) return;
    markSaving();
    const lines = note.content.split('\n');
    const title = lines[0].trim() || 'Rascunho de Nota';
    const description = lines.slice(1).join('\n').trim();
    try {
      await workspaceApi.saveKanbanCard(userId, {
        title,
        description: description || undefined,
        status: 'todo',
        priority: 'media',
        tag: 'Nota Rápida',
      });
      await workspaceApi.deleteStickyNote(note.id);
      await load();
      toast({ title: 'Nota promovida!', description: 'Convertida em tarefa no Kanban.' });
    } catch (e) {
      reportError('Não foi possível promover a nota', e);
      load();
    }
  }, [userId, markSaving, reportError, load, toast]);

  // --- Atalhos ---
  const saveLink = useCallback(async (link: Partial<QuickLink>): Promise<boolean> => {
    if (!userId) return false;
    markSaving();
    try {
      await workspaceApi.saveQuickLink(userId, link);
      await load();
      return true;
    } catch (e) {
      reportError('Não foi possível salvar o atalho', e);
      return false;
    }
  }, [userId, markSaving, reportError, load]);

  const deleteLink = useCallback(async (id: string) => {
    markSaving();
    try {
      await workspaceApi.deleteQuickLink(id);
      await load();
    } catch (e) {
      reportError('Não foi possível excluir o atalho', e);
    }
  }, [markSaving, load, reportError]);

  return {
    cards, notes, links,
    isLoading, loadError, reload: load,
    history, isLoadingHistory, historyError, retryHistory,
    isSaving, markSaving,
    moveCard, createCard, patchCard, deleteCard,
    addNote, updateNote, deleteNote, promoteNote,
    saveLink, deleteLink,
  };
}
