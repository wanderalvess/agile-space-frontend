'use client';

import { useEffect, useState } from 'react';
import { pokerApi } from '@/app/room/api';
import { ritualsApi } from '@/lib/home-api';
import { pickVelocityRoomIds, VELOCITY_MAX_SESSIONS } from '@/lib/poker-velocity';
import { TrendingUp, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';

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
 * Velocity entre sessões: pega as últimas sessões de Poker DA SQUAD no servidor (`/rituals/poker/history`) e lê o
 * `summary` de cada sala via REST (GET /api/poker/{id}). Mostra a tendência de pontos/tarefas das últimas sessões do
 * time. Todo mundo da squad vê o mesmo histórico (antes vinha do localStorage de quem abria o relatório). Sem squad
 * na sala, ou com o servidor sem o recurso, mostra só a sessão atual. Aditivo/informativo — não altera o fluxo.
 */
export function SessionVelocity({ currentRoomId, squadId }: { currentRoomId: string; squadId?: string }) {
  const [rows, setRows] = useState<SessionRow[] | null>(null);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      let history: Array<{ id?: string | null }> = [];
      if (squadId) {
        try {
          history = await ritualsApi.history('POKER', { squadId, limit: VELOCITY_MAX_SESSIONS });
        } catch { history = []; }
      }
      const pokerIds = pickVelocityRoomIds(currentRoomId, history);

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
  }, [currentRoomId, squadId]);

  if (!rows || rows.length === 0) return null;

  const maxPoints = Math.max(1, ...rows.map(r => r.totalPoints));

  return (
    <section aria-label="Histórico do time" className="flex flex-col gap-3 rounded-[14px] border border-border bg-card p-5 shadow-[0_8px_24px_rgba(15,23,42,0.06)] dark:shadow-[0_20px_50px_rgba(0,0,0,0.4)]">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="flex items-center gap-2 text-base font-bold">
          <TrendingUp className="h-4 w-4 text-muted-foreground" strokeWidth={1.5} aria-hidden="true" /> Histórico do time
        </h2>
        <span className="text-xs text-muted-foreground">últimas sessões</span>
      </div>
      <div className="flex flex-col gap-2">
        {rows.map((r, idx) => (
          <div key={r.roomId} className="grid grid-cols-[minmax(0,7rem)_minmax(0,1fr)_4rem_5rem] items-center gap-3">
            <span className={cn('truncate text-xs', r.isCurrent ? 'font-bold text-foreground' : 'text-muted-foreground')} title={r.title}>
              {r.title}{r.isCurrent && <span className="text-primary [.theme-totvs:not(.dark)_&]:text-foreground"> (atual)</span>}
            </span>
            <div className="h-[22px] overflow-hidden rounded-md bg-muted/60">
              <div
                className={cn('room-grow h-full rounded-md', r.isCurrent ? 'bg-primary' : 'bg-primary/45')}
                style={{ width: `${Math.round((r.totalPoints / maxPoints) * 100)}%`, animationDelay: `${idx * 60}ms` }}
              />
            </div>
            <span className="text-right text-xs font-bold tabular-nums">{r.totalPoints}</span>
            <span className="flex items-center justify-end gap-1 text-xs tabular-nums text-muted-foreground">
              <Clock className="h-3 w-3" strokeWidth={1.5} aria-hidden="true" /> {r.durationStr}
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}
