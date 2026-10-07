'use client';

import React, { useState, useEffect } from 'react';
import { retroApi } from '../../app/retro/api';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import {
  ListTodo,
  Calendar,
  History,
  ArrowRight,
} from 'lucide-react';
import { AgileSpinner } from '@/components/ui/AgileSpinner';
import type { RetroBoard, RetroCard } from '@/lib/types';
import { RETRO_TEMPLATES } from '@/lib/types';

interface PendingGroup {
  board: RetroBoard;
  pendingCards: RetroCard[];
}

interface RetroActionImportDialogProps {
  isOpen: boolean;
  onClose: () => void;
  team: string;
  currentBoardId: string;
  onImport: (board: RetroBoard, pendingCards: RetroCard[]) => void;
}

export function RetroActionImportDialog({ isOpen, onClose, team, currentBoardId, onImport }: RetroActionImportDialogProps) {
  const [groups, setGroups] = useState<PendingGroup[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen && team) {
      fetchPending();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, team]);

  const fetchPending = async () => {
    setLoading(true);
    try {
      const allBoards = await retroApi.listBoards({ team });

      const candidates = allBoards
        .filter(b => b.id !== currentBoardId);

      const results = await Promise.all(candidates.map(async (board) => {
        const cardsList = await retroApi.getCards(board.id);
        const cols = board.columns && board.columns.length > 0 ? board.columns : RETRO_TEMPLATES.classic;
        const actionColumnIds = new Set(cols.filter(c => c.theme === 'action').map(c => c.id));
        const pendingCards = cardsList
          .filter(c => actionColumnIds.has(c.columnKey) && c.isDone !== true && c.content?.trim());
        return { board, pendingCards };
      }));

      const sorted = results
        .filter(g => g.pendingCards.length > 0)
        .sort((a, b) => (b.board.createdAt || '').localeCompare(a.board.createdAt || ''));

      setGroups(sorted);
    } catch (error) {
      console.error("Erro ao buscar ações pendentes:", error);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return '';
    return new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(date);
  };

  return (
    <Dialog open={isOpen} onOpenChange={(val) => !val && onClose()}>
      <DialogContent className="sm:max-w-[600px] rounded-[2rem] border border-border bg-card text-card-foreground shadow-2xl p-6 gap-3">
        <DialogHeader className="text-left space-y-1.5">
          <DialogTitle className="text-2xl font-black tracking-tight leading-none flex items-center gap-2.5">
            <ListTodo className="h-5 w-5 text-emerald-500" /> Ações pendentes
          </DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground">
            Retros anteriores de <strong className="text-foreground">{team}</strong> com ações que ainda não foram concluídas. Escolha uma para trazer essas ações para este quadro.
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="h-[340px] pr-3">
          {loading ? (
            <div className="h-full flex flex-col items-center justify-center space-y-4 py-10">
              <AgileSpinner size="lg" />
              <p className="text-sm text-muted-foreground">Buscando retros anteriores…</p>
            </div>
          ) : groups.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center gap-3 py-10 text-center">
              <History className="h-10 w-10 text-muted-foreground/50" />
              <p className="text-sm font-semibold text-foreground">Nenhuma ação pendente</p>
              <p className="text-sm text-muted-foreground max-w-xs">As retros anteriores deste time não têm ações em aberto.</p>
            </div>
          ) : (
            <div className="space-y-2.5">
              {groups.map(({ board, pendingCards }) => (
                <button
                  type="button"
                  key={board.id}
                  onClick={() => { onImport(board, pendingCards); onClose(); }}
                  className="group w-full text-left p-4 rounded-2xl border border-border bg-muted/20 hover:border-emerald-500/50 hover:bg-emerald-500/5 transition-all"
                >
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <h4 className="font-bold text-sm text-foreground truncate">
                        {board.title || 'Retrospectiva sem título'}
                      </h4>
                      <div className="flex items-center gap-3 text-xs text-muted-foreground mt-1.5">
                        <span className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          {formatDate(board.createdAt)}
                        </span>
                        <Badge variant="secondary" className="text-xs font-semibold px-2">
                          {pendingCards.length} {pendingCards.length > 1 ? 'ações pendentes' : 'ação pendente'}
                        </Badge>
                      </div>
                    </div>
                    <div className="h-8 w-8 shrink-0 rounded-full border border-border flex items-center justify-center group-hover:border-emerald-500 group-hover:bg-emerald-600 group-hover:text-white transition-all">
                      <ArrowRight className="h-4 w-4" />
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </ScrollArea>

        <DialogFooter className="sm:justify-end">
          <Button variant="ghost" onClick={onClose} className="font-bold text-sm text-muted-foreground hover:text-foreground">
            Fechar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
