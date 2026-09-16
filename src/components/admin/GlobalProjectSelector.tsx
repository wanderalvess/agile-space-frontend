'use client';

import React, { useState } from 'react';
import { ChevronDown, FolderKanban, Loader2 } from 'lucide-react';
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
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/hooks/use-toast';

export function GlobalProjectSelector() {
  const { session, switchProject } = useAuth();
  const { toast } = useToast();
  const [switchingTo, setSwitchingTo] = useState<string | null>(null);

  const accessibleProjects = session?.accessibleProjects || [];
  if (!session || accessibleProjects.length <= 1) return null;

  const activeProject = accessibleProjects.find((p) => p.projectId === session.activeProjectId);
  const label = activeProject?.projectName || session.activeProjectId || 'Projeto';

  const handleSelect = async (projectId: string) => {
    if (projectId === session.activeProjectId || switchingTo) return;
    setSwitchingTo(projectId);
    try {
      await switchProject(projectId);
    } catch (err: any) {
      toast({
        variant: 'destructive',
        title: 'Não foi possível trocar de squad',
        description: err?.message || 'Tente novamente em instantes.',
      });
    } finally {
      setSwitchingTo(null);
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          disabled={!!switchingTo}
          className="h-7 rounded-xl text-[10px] font-black uppercase tracking-widest border-slate-300/80 dark:border-slate-700/80 bg-slate-100/80 dark:bg-slate-900 text-slate-800 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-800 gap-1.5 shadow-sm"
        >
          {switchingTo ? (
            <Loader2 className="h-3 w-3 text-primary animate-spin" />
          ) : (
            <FolderKanban className="h-3 w-3 text-primary" />
          )}
          <span className="max-w-[120px] truncate">{label}</span>
          <ChevronDown className="h-3 w-3 opacity-60" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="rounded-xl min-w-[220px] bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xl">
        <DropdownMenuLabel className="text-[9px] font-black uppercase tracking-widest text-slate-400">
          Suas Squads
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {accessibleProjects.map((p) => (
          <DropdownMenuItem
            key={p.projectId}
            onClick={() => handleSelect(p.projectId)}
            disabled={!!switchingTo}
            className="flex items-center justify-between gap-3 rounded-lg cursor-pointer"
          >
            <div className="flex flex-col min-w-0">
              <span className="text-[11px] font-bold truncate">{p.projectName || p.projectId}</span>
              {!p.directAssignment && (
                <span className="text-[8px] uppercase tracking-wide text-slate-400 truncate">
                  via {p.tribeName || p.segmentName || 'liderança'}
                </span>
              )}
            </div>
            {p.roleName && (
              <Badge className="text-[8px] font-black uppercase border-none bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-300 px-1.5 py-0 shrink-0">
                {p.roleName}
              </Badge>
            )}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
