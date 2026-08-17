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
    if (isOpen) {
      fetchPending();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  const fetchPending = async () => {
    setLoading(true);
    try {
      const allBoards = await retroApi.listBoards();

      const candidates = allBoards
        .filter(b => b.id !== currentBoardId && b.team === team);

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
      <DialogContent className="sm:max-w-[600px] border-none shadow-2xl bg-white/95 backdrop-blur-xl rounded-[2rem] p-0 overflow-hidden">
        <DialogHeader className="p-8 pb-4 bg-indigo-50/50">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2.5 bg-indigo-100 rounded-xl text-indigo-600">
              <ListTodo className="h-6 w-6" />
            </div>
            <div>
              <DialogTitle className="text-2xl font-black uppercase tracking-tight italic text-slate-800">Ações Pendentes</DialogTitle>
              <DialogDescription className="font-medium text-slate-500">
                Retros anteriores do squad <strong>{team}</strong> com itens ainda não concluídos.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="px-8 py-4">
          <ScrollArea className="h-[350px] pr-4">
            {loading ? (
              <div className="h-full flex flex-col items-center justify-center space-y-6 opacity-70">
                <AgileSpinner size="lg" />
                <p className="text-[10px] font-black uppercase tracking-[0.4em] ml-[0.4em] animate-pulse text-slate-400">Buscando Histórico...</p>
              </div>
            ) : groups.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center space-y-4 opacity-30 py-10 text-center">
                <History className="h-12 w-12" />
                <p className="text-sm font-bold uppercase tracking-tight">Nenhuma pendência encontrada para este squad</p>
              </div>
            ) : (
              <div className="space-y-3">
                {groups.map(({ board, pendingCards }) => (
                  <div
                    key={board.id}
                    onClick={() => { onImport(board, pendingCards); onClose(); }}
                    className="group p-4 rounded-2xl border-2 border-slate-100 bg-white hover:border-indigo-200 hover:bg-indigo-50/30 transition-all cursor-pointer"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <h4 className="font-black text-sm text-slate-800 truncate uppercase tracking-tight">
                          {board.title || 'Retrospectiva sem título'}
                        </h4>
                        <div className="flex items-center gap-4 text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1.5">
                          <span className="flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            {formatDate(board.createdAt)}
                          </span>
                          <Badge className="bg-indigo-50 text-indigo-600 border-indigo-100 text-[9px] font-black uppercase px-2">
                            {pendingCards.length} pendência{pendingCards.length > 1 ? 's' : ''}
                          </Badge>
                        </div>
                      </div>
                      <div className="shrink-0 pt-1">
                        <div className="h-8 w-8 rounded-full border-2 border-slate-200 flex items-center justify-center group-hover:border-indigo-400 group-hover:bg-indigo-600 group-hover:text-white transition-all">
                          <ArrowRight className="h-4 w-4" />
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>
        </div>

        <DialogFooter className="p-6 bg-slate-50/50 border-t flex sm:justify-center">
          <Button variant="ghost" onClick={onClose} className="font-bold uppercase tracking-widest text-[10px]">
            Fechar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
