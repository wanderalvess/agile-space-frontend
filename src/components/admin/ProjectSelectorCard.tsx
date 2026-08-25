'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { authFetch } from '@/lib/auth-client';

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
      const res = await authFetch(`${API_BASE}/squads`);
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
    <Card className="rounded-[2rem] border border-slate-200/50 dark:border-slate-800/50 bg-white/60 dark:bg-slate-900/40 backdrop-blur-xl shadow-sm h-full flex flex-col">
      <CardHeader className="pb-4 border-b border-slate-100 dark:border-slate-800/60 bg-slate-50/30 dark:bg-slate-950/20 rounded-t-[2rem]">
        <div className="flex items-center gap-2">
          <CardTitle className="text-sm font-black uppercase tracking-widest text-slate-900 dark:text-slate-100">
            Projetos Sincronizados
          </CardTitle>
          <Badge className="bg-primary/10 text-primary border-none text-[9px] px-1.5 py-0 uppercase tracking-widest">
            {squads.length}
          </Badge>
        </div>
        <CardDescription className="text-[11px] text-slate-500 font-medium mt-1">
          Selecione um projeto para ver os membros
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-2 p-4 flex-1 overflow-y-auto min-h-[300px] no-scrollbar">
        {loading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-[72px] rounded-2xl bg-slate-100/80 dark:bg-slate-800/50 animate-pulse border border-slate-200/50 dark:border-slate-700/50" />
          ))
        ) : squads.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center space-y-3 opacity-60">
            <div className="h-10 w-10 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
              <span className="text-xl">🗂️</span>
            </div>
            <p className="text-[11px] font-black uppercase tracking-widest text-slate-400">
              Nenhum projeto sincronizado.
            </p>
          </div>
        ) : (
          squads.map((squad) => (
            <button
              key={squad.id}
              onClick={() => onSelectSquad(squad.id)}
              className={cn(
                'w-full text-left p-3.5 rounded-2xl border transition-all duration-300 group',
                selectedSquadId === squad.id
                  ? 'border-primary/50 bg-primary/5 dark:bg-primary/10 shadow-sm ring-1 ring-primary/20'
                  : 'border-slate-200/60 dark:border-slate-700/40 bg-white/40 dark:bg-slate-800/30 hover:border-primary/30 hover:bg-slate-50 dark:hover:bg-slate-800/60'
              )}
            >
              <div className="flex items-start justify-between gap-2 mb-1.5">
                <span className={cn(
                  "text-[12px] font-black uppercase tracking-wider truncate transition-colors",
                  selectedSquadId === squad.id ? "text-primary" : "text-slate-800 dark:text-slate-200 group-hover:text-primary/80"
                )}>
                  {squad.name}
                </span>
                <Badge className={cn(
                  "text-[9px] font-black uppercase shrink-0 border-none transition-colors",
                  selectedSquadId === squad.id 
                    ? "bg-primary/20 text-primary" 
                    : "bg-slate-100 dark:bg-slate-700/50 text-slate-600 dark:text-slate-300 group-hover:bg-primary/10 group-hover:text-primary/70"
                )}>
                  {squad.id}
                </Badge>
              </div>
              
              <div className="flex flex-col gap-1.5">
                {squad.jiraProjectKey && (
                  <div className="flex items-center gap-1.5 text-[10px] text-slate-500 font-mono bg-slate-50 dark:bg-slate-900/50 px-2 py-0.5 rounded w-fit">
                    <span className="opacity-70">KEY:</span>
                    <span className="font-bold">{squad.jiraProjectKey}</span>
                  </div>
                )}
                
                <div className="flex items-center justify-between mt-1">
                  {squad.lastSyncAt ? (
                    <span className="text-[9px] text-slate-400 font-medium">
                      Atualizado em {new Date(squad.lastSyncAt).toLocaleDateString('pt-BR')}
                    </span>
                  ) : (
                    <span className="text-[9px] text-slate-400 italic">Nunca sincronizado</span>
                  )}
                  {squad.lastSyncStatus && (
                    <Badge
                      className={cn(
                        'text-[8px] font-black uppercase tracking-widest border-none px-1.5 py-0',
                        squad.lastSyncStatus === 'success'
                          ? 'bg-emerald-500/10 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-400'
                          : 'bg-rose-500/10 text-rose-600 dark:bg-rose-500/20 dark:text-rose-400'
                      )}
                    >
                      {squad.lastSyncStatus}
                    </Badge>
                  )}
                </div>
              </div>
            </button>
          ))
        )}
      </CardContent>
    </Card>
  );
}
