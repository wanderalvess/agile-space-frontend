'use client';

import { useEffect, useMemo, useState } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { TrendingUp, AlertTriangle, CheckCircle2, History } from 'lucide-react';
import { WidgetCard } from '@/components/ui/WidgetCard';
import { retroApi } from '@/app/retro/api';
import type { RetroBoard, RetroCard, RetroParticipant, HealthCheckAnswer } from '@/lib/types';

const MOOD_SCORE: Record<HealthCheckAnswer, number> = {
  exhausted: 1,
  tired: 2,
  neutral: 3,
  good: 4,
  great: 5,
};

const MAX_BOARDS = 12;

interface BoardSummary {
  board: RetroBoard;
  moodAvg: number | null;
  moodCount: number;
  actionsDone: number;
  actionsTotal: number;
}

interface RecurringAction {
  carriedFromBoardId: string;
  carriedFromBoardTitle: string;
  content: string;
  carryCount: number;
  isDone: boolean;
}

export function RetroHistoryPanel({ squadId }: { squadId?: string | null }) {
  const [summaries, setSummaries] = useState<BoardSummary[]>([]);
  const [recurring, setRecurring] = useState<RecurringAction[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const filterKey = squadId?.trim();

  useEffect(() => {
    if (!filterKey) {
      setSummaries([]);
      setRecurring([]);
      return;
    }

    let cancelled = false;
    setIsLoading(true);

    (async () => {
      try {
        const boards = await retroApi.listBoards({ squadId: filterKey });
        const recentBoards = boards.slice(0, MAX_BOARDS);

        const perBoard = await Promise.all(recentBoards.map(async (board) => {
          const [cards, participants] = await Promise.all([
            retroApi.getCards(board.id).catch(() => [] as RetroCard[]),
            retroApi.getParticipants(board.id).catch(() => [] as RetroParticipant[]),
          ]);
          return { board, cards, participants };
        }));

        if (cancelled) return;

        const actionColumnIds = new Set(
          recentBoards.flatMap(b => (b.columns || []).filter(c => c.theme === 'action').map(c => c.id))
        );

        const boardSummaries: BoardSummary[] = perBoard.map(({ board, cards, participants }) => {
          const moodValues = participants
            .map(p => p.healthCheckAnswer && MOOD_SCORE[p.healthCheckAnswer])
            .filter((v): v is number => typeof v === 'number');
          const actionCards = cards.filter(c => actionColumnIds.has(c.columnKey));

          return {
            board,
            moodAvg: moodValues.length > 0 ? moodValues.reduce((a, b) => a + b, 0) / moodValues.length : null,
            moodCount: moodValues.length,
            actionsDone: actionCards.filter(c => c.isDone).length,
            actionsTotal: actionCards.length,
          };
        }).sort((a, b) => new Date(a.board.createdAt).getTime() - new Date(b.board.createdAt).getTime());

        // Recorrência: cards com carryCount > 1, dedupe pela raiz da cadeia (carriedFromBoardId)
        const recurringMap = new Map<string, RecurringAction>();
        for (const { cards } of perBoard) {
          for (const card of cards) {
            if ((card.carryCount || 0) > 1 && card.carriedFromBoardId) {
              const existing = recurringMap.get(card.carriedFromBoardId);
              if (!existing || (card.carryCount || 0) > existing.carryCount) {
                recurringMap.set(card.carriedFromBoardId, {
                  carriedFromBoardId: card.carriedFromBoardId,
                  carriedFromBoardTitle: card.carriedFromBoardTitle || 'Retro anterior',
                  content: card.content,
                  carryCount: card.carryCount || 0,
                  isDone: !!card.isDone,
                });
              }
            }
          }
        }

        if (cancelled) return;
        setSummaries(boardSummaries);
        setRecurring(Array.from(recurringMap.values()).sort((a, b) => b.carryCount - a.carryCount).slice(0, 5));
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [filterKey]);

  const moodChartData = useMemo(() => summaries
    .filter(s => s.moodAvg !== null)
    .map(s => ({
      name: s.board.title || new Date(s.board.createdAt).toLocaleDateString('pt-BR'),
      mood: Number(s.moodAvg!.toFixed(2)),
    })), [summaries]);

  const overallActionsDone = summaries.reduce((a, s) => a + s.actionsDone, 0);
  const overallActionsTotal = summaries.reduce((a, s) => a + s.actionsTotal, 0);
  const completionRate = overallActionsTotal > 0 ? Math.round((overallActionsDone / overallActionsTotal) * 100) : null;

  if (!filterKey) return null;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <WidgetCard title="Tendência de Check-in" headerIcon={<TrendingUp className="h-4 w-4" />}>
        {isLoading ? (
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest py-8 text-center">Carregando...</p>
        ) : moodChartData.length < 2 ? (
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest py-8 text-center">
            Precisa de 2+ retros com check-in respondido pra mostrar tendência.
          </p>
        ) : (
          <ResponsiveContainer width="100%" height={180}>
            <LineChart data={moodChartData} margin={{ top: 8, right: 12, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
              <XAxis dataKey="name" tick={{ fontSize: 9 }} />
              <YAxis domain={[1, 5]} tick={{ fontSize: 9 }} allowDecimals={false} />
              <Tooltip formatter={(v: number) => v.toFixed(2)} />
              <Line type="monotone" dataKey="mood" stroke="#6366f1" strokeWidth={2} dot={{ r: 3 }} />
            </LineChart>
          </ResponsiveContainer>
        )}
      </WidgetCard>

      <WidgetCard title="Ações: Concluídas vs. Recorrentes" headerIcon={<History className="h-4 w-4" />}>
        {isLoading ? (
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest py-8 text-center">Carregando...</p>
        ) : overallActionsTotal === 0 ? (
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest py-8 text-center">
            Sem itens de ação nas últimas retros dessa squad.
          </p>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-emerald-50 rounded-xl border border-emerald-100">
                <CheckCircle2 className="h-4 w-4 text-emerald-600" />
              </div>
              <div>
                <p className="text-lg font-black text-slate-800 leading-none">{completionRate}%</p>
                <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">
                  {overallActionsDone} de {overallActionsTotal} ações concluídas ({summaries.length} retros)
                </p>
              </div>
            </div>

            {recurring.length > 0 && (
              <div className="space-y-1.5 pt-3 border-t border-slate-100">
                <p className="text-[9px] font-black uppercase tracking-widest text-amber-600 flex items-center gap-1">
                  <AlertTriangle className="h-3 w-3" /> Temas recorrentes
                </p>
                {recurring.map(r => (
                  <div key={r.carriedFromBoardId} className="flex items-center justify-between gap-2 text-[10px]">
                    <span className="truncate font-bold text-slate-600">{r.content}</span>
                    <span className="shrink-0 font-black text-amber-600">{r.carryCount}x</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </WidgetCard>
    </div>
  );
}
