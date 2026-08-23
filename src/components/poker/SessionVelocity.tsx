'use client';

import { useEffect, useState } from 'react';
import { pokerApi } from '@/app/room/api';
import { Card, CardContent } from '@/components/ui/card';
import { TrendingUp, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';

const ROOMS_META_KEY = 'agileSpace_rooms_meta';

interface SessionRow {
  roomId: string;
  title: string;
  createdAt: string;
  totalPoints: number;
  totalTopics: number;
  durationStr: string;
  isCurrent: boolean;
}

/**
 * Velocity entre sessões: usa o histórico local de salas (localStorage) e lê o
 * `summary` de cada sala via REST (GET /api/poker/{id}). Mostra a tendência de
 * pontos/tarefas das últimas sessões do time. Sem listar a coleção completa
 * (que é admin-only). Aditivo/informativo — não altera o fluxo.
 */
export function SessionVelocity({ currentRoomId }: { currentRoomId: string }) {
  const [rows, setRows] = useState<SessionRow[] | null>(null);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      let metas: any[] = [];
      try {
        metas = JSON.parse(localStorage.getItem(ROOMS_META_KEY) || '[]');
      } catch { metas = []; }

      const pokerIds = metas
        .filter(m => m?.roomId && (m.type === 'poker' || !m.type))
        .slice(-8)
        .reverse()
        .map(m => m.roomId as string);
      // Garante que a sala atual entra mesmo se não estiver no histórico local.
      if (!pokerIds.includes(currentRoomId)) pokerIds.unshift(currentRoomId);

      const results = await Promise.all(pokerIds.map(async id => {
        try {
          const d: any = await pokerApi.getRoom(id);
          if (!d) return null;
          const s = d.summary?.stats;
          if (!s) return null;
          return {
            roomId: id,
            title: d.title || 'Sessão',
            createdAt: d.createdAt || '',
            totalPoints: Number(s.totalPoints) || 0,
            totalTopics: Number(s.totalTopics) || 0,
            durationStr: s.durationStr || '—',
            isCurrent: id === currentRoomId,
          } as SessionRow;
        } catch { return null; }
      }));

      if (!cancelled) {
        setRows(results.filter((r): r is SessionRow => r !== null));
      }
    })();

    return () => { cancelled = true; };
  }, [currentRoomId]);

  if (!rows || rows.length === 0) return null;

  const maxPoints = Math.max(1, ...rows.map(r => r.totalPoints));

  return (
    <Card className="border border-indigo-100/60 dark:border-indigo-900/30 bg-white/60 dark:bg-card/40 rounded-2xl">
      <CardContent className="p-5 space-y-4">
        <div className="flex items-center gap-2">
          <TrendingUp className="h-4 w-4 text-indigo-600" />
          <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-indigo-700 dark:text-indigo-400">Histórico do time</h3>
          <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">últimas sessões</span>
        </div>
        <div className="space-y-2">
          {rows.map(r => (
            <div key={r.roomId} className={cn("flex items-center gap-3", r.isCurrent && "font-black")}>
              <div className="w-28 shrink-0 truncate text-[11px] font-bold text-slate-600 dark:text-slate-300" title={r.title}>
                {r.title}{r.isCurrent && <span className="text-indigo-500"> (atual)</span>}
              </div>
              <div className="flex-1 h-4 bg-slate-100 dark:bg-slate-900 rounded-full overflow-hidden">
                <div
                  className={cn("h-full rounded-full", r.isCurrent ? "bg-indigo-600" : "bg-indigo-400/60")}
                  style={{ width: `${Math.round((r.totalPoints / maxPoints) * 100)}%` }}
                />
              </div>
              <div className="w-16 shrink-0 text-right text-[11px] font-black text-slate-800 dark:text-slate-100">{r.totalPoints} pts</div>
              <div className="w-20 shrink-0 flex items-center justify-end gap-1 text-[10px] font-bold text-slate-400">
                <Clock className="h-3 w-3" /> {r.durationStr}
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
