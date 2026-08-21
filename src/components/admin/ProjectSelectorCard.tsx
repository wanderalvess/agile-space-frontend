'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8002/api';

interface Squad {
  id: string;
  name: string;
  jiraProjectKey?: string;
  lastSyncAt?: string;
  lastSyncStatus?: string;
}

interface ProjectSelectorCardProps {
  selectedSquadId: string | null;
  onSelectSquad: (squadId: string) => void;
}

export function ProjectSelectorCard({ selectedSquadId, onSelectSquad }: ProjectSelectorCardProps) {
  const [squads, setSquads] = useState<Squad[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchSquads = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/squads`);
      if (res.ok) {
        const data = await res.json();
        setSquads(data);
      }
    } catch {
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSquads();
  }, [fetchSquads]);

  return (
    <Card className="rounded-xl border-slate-200 dark:border-slate-800/60 bg-white dark:bg-slate-900 shadow-sm">
      <CardHeader className="pb-4">
        <CardTitle className="text-sm font-black uppercase tracking-widest text-slate-900 dark:text-slate-100">
          Projetos Sincronizados
        </CardTitle>
        <CardDescription className="text-[11px] text-slate-500">
          Selecione um projeto para ver os membros
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-2">
        {loading ? (
          Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-16 rounded-xl bg-slate-100 dark:bg-slate-800 animate-pulse" />
          ))
        ) : squads.length === 0 ? (
          <p className="text-center text-[11px] font-black uppercase tracking-widest text-slate-400 py-6">
            Nenhum projeto sincronizado.
          </p>
        ) : (
          squads.map((squad) => (
            <button
              key={squad.id}
              onClick={() => onSelectSquad(squad.id)}
              className={cn(
                'w-full text-left p-3 rounded-xl border transition-all hover:border-primary/50',
                selectedSquadId === squad.id
                  ? 'border-primary bg-primary/5 dark:bg-primary/10'
                  : 'border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40'
              )}
            >
              <div className="flex items-center justify-between gap-2 mb-1">
                <span className="text-[11px] font-black uppercase tracking-wider text-slate-800 dark:text-slate-200 truncate">
                  {squad.name}
                </span>
                <Badge className="text-[9px] font-black uppercase shrink-0 bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 border-none">
                  {squad.id}
                </Badge>
              </div>
              {squad.jiraProjectKey && (
                <p className="text-[10px] text-slate-500 font-mono">{squad.jiraProjectKey}</p>
              )}
              <div className="flex items-center gap-2 mt-1">
                {squad.lastSyncAt && (
                  <span className="text-[9px] text-slate-400">
                    {new Date(squad.lastSyncAt).toLocaleDateString('pt-BR')}
                  </span>
                )}
                {squad.lastSyncStatus && (
                  <Badge
                    className={cn(
                      'text-[9px] font-black uppercase border-none px-1.5 py-0',
                      squad.lastSyncStatus === 'success'
                        ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400'
                        : 'bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-400'
                    )}
                  >
                    {squad.lastSyncStatus}
                  </Badge>
                )}
              </div>
            </button>
          ))
        )}
      </CardContent>
    </Card>
  );
}
