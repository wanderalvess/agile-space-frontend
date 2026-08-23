'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { ChevronDown, FolderKanban } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useUserContext } from '@/context/UserContext';
import { authFetch } from '@/lib/auth-client';

const STORAGE_KEY = 'agileSpace_activeSquadId';

export function useActiveSquad(): string | null {
  const [squadId, setSquadId] = useState<string | null>(null);

  useEffect(() => {
    try {
      setSquadId(localStorage.getItem(STORAGE_KEY));
    } catch {}
  }, []);

  return squadId;
}

export function GlobalProjectSelector() {
  const { userSquads, isLeadership } = useUserContext();
  const [activeSquadId, setActiveSquadId] = useState<string | null>(null);
  const [allSquads, setAllSquads] = useState<any[]>([]);

  useEffect(() => {
    try {
      setActiveSquadId(localStorage.getItem(STORAGE_KEY));
    } catch {}
  }, []);

  useEffect(() => {
    if (isLeadership) {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8002/api';
      authFetch(`${apiUrl}/squads`)
        .then(r => r.ok ? r.json() : [])
        .then(data => {
          if (Array.isArray(data)) setAllSquads(data);
        })
        .catch(() => {});
    }
  }, [isLeadership]);

  const handleSelect = useCallback((squadId: string) => {
    setActiveSquadId(squadId);
    try {
      localStorage.setItem(STORAGE_KEY, squadId);
      window.dispatchEvent(new Event('storage'));
    } catch {}
  }, []);

  // Lista de squads a exibir: as do usuário ou todas (se liderança)
  const displaySquads = userSquads.length > 0 ? userSquads : allSquads.map(s => ({
    squadId: s.id || s.jiraProjectKey,
    role: 'Squad'
  }));

  if (displaySquads.length === 0 && !isLeadership) return null;

  const activeSquad = displaySquads.find((s) => s.squadId === activeSquadId);
  const label = activeSquad ? activeSquad.squadId : (activeSquadId || 'Projeto');

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="h-7 rounded-xl text-[10px] font-black uppercase tracking-widest border-slate-300/80 dark:border-slate-700/80 bg-slate-100/80 dark:bg-slate-900 text-slate-800 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-800 gap-1.5 shadow-sm"
        >
          <FolderKanban className="h-3 w-3 text-primary" />
          <span className="max-w-[120px] truncate">{label}</span>
          <ChevronDown className="h-3 w-3 opacity-60" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="rounded-xl min-w-[200px] bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xl">
        <DropdownMenuLabel className="text-[9px] font-black uppercase tracking-widest text-slate-400">
          {userSquads.length > 0 ? 'Suas Squads' : 'Projetos Disponíveis'}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {displaySquads.length === 0 ? (
          <DropdownMenuItem disabled className="text-[11px] text-slate-400">
            Nenhuma squad sincronizada
          </DropdownMenuItem>
        ) : (
          displaySquads.map((s) => (
            <DropdownMenuItem
              key={s.squadId}
              onClick={() => handleSelect(s.squadId)}
              className="flex items-center justify-between gap-3 rounded-lg cursor-pointer"
            >
              <span className="text-[11px] font-bold truncate">{s.squadId}</span>
              {s.role && (
                <Badge className="text-[8px] font-black uppercase border-none bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-300 px-1.5 py-0 shrink-0">
                  {s.role}
                </Badge>
              )}
            </DropdownMenuItem>
          ))
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
