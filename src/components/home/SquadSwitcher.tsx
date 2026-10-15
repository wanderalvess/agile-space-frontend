'use client';

import { ChevronDown, Loader2, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import type { SquadSummary } from '@/hooks/home/types';
import { TINT_TEXT } from './home-ui';

const ALL = '__all__';

interface Props {
  squads: SquadSummary[];
  /** null = todas as squads. */
  scope: string | null;
  isMulti: boolean;
  /** Squad em processo de troca (desabilita o menu). */
  switchingTo: string | null;
  onPick: (squadId: string | null) => void;
}

/** Squad atual no cabeçalho. Só vira menu quando a pessoa tem acesso a mais de uma. */
export function SquadSwitcher({ squads, scope, isMulti, switchingTo, onPick }: Props) {
  const active = squads.find((s) => s.isActive) ?? squads[0];
  if (!active) return null;

  const current = scope ? squads.find((s) => s.id === scope) : undefined;
  const label = isMulti ? (current ? current.name : 'Todas as squads') : active.name;

  const body = (
    <>
      {switchingTo ? (
        <Loader2 aria-hidden="true" className={`h-4 w-4 animate-spin ${TINT_TEXT}`} strokeWidth={1.5} />
      ) : (
        <Users aria-hidden="true" className={`h-4 w-4 ${TINT_TEXT}`} strokeWidth={1.5} />
      )}
      <span className="max-w-[160px] truncate">{label}</span>
      {isMulti && <ChevronDown aria-hidden="true" className="h-3.5 w-3.5 text-muted-foreground" strokeWidth={1.5} />}
    </>
  );

  const triggerClass =
    'h-9 gap-2 rounded-[10px] border border-border bg-muted/40 px-2.5 text-[13px] font-semibold text-foreground';

  if (!isMulti) {
    return (
      <span className={`inline-flex items-center ${triggerClass}`} aria-label={`Squad atual: ${active.name}`}>
        {body}
      </span>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" aria-label="Squad atual" disabled={!!switchingTo} className={`${triggerClass} hover:bg-muted/70`}>
          {body}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-64 rounded-xl p-1.5">
        <DropdownMenuRadioGroup value={scope ?? ALL} onValueChange={(v) => onPick(v === ALL ? null : v)}>
          <DropdownMenuRadioItem value={ALL} className="cursor-pointer rounded-lg py-2 text-[13px]">
            <span className="flex-1">Todas as squads</span>
            <span className="text-[11px] text-muted-foreground">{squads.length}</span>
          </DropdownMenuRadioItem>
          {squads.map((s) => (
            <DropdownMenuRadioItem key={s.id} value={s.id} className="cursor-pointer rounded-lg py-2 text-[13px]">
              <span className="min-w-0 flex-1 truncate">{s.name}</span>
              {s.roleName && <span className="ml-2 shrink-0 text-[11px] text-muted-foreground">{s.roleName}</span>}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
