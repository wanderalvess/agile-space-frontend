'use client';

import { ChevronDown, Code, RotateCcw, Users } from 'lucide-react';
import { formatRoleForCopy } from '@/lib/poker-utils';
import { cn } from '@/lib/utils';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { FOCUS_RING } from '@/components/room-kit';

export interface RevoteControlProps {
  /** `disabled`: votação aberta, ainda não há resultado para revotar (o botão avisa por quê). */
  mode: 'enabled' | 'disabled';
  /** Papéis técnicos presentes na sala (revotação só de um papel). */
  presentCategories: readonly string[];
  onRevoteAll: () => void;
  onSelectiveRevote: (category: string) => void;
}

const SHELL = 'inline-flex overflow-hidden rounded-lg border max-sm:w-full';
const ENABLED = 'border-amber-500/60 bg-amber-500/10 text-amber-900 dark:text-amber-200';
const DISABLED = 'border-border bg-transparent text-muted-foreground';
const BUTTON = 'inline-flex h-9 items-center gap-2 whitespace-nowrap px-3 text-sm font-semibold max-sm:h-11 max-sm:flex-1 max-sm:justify-center';

/**
 * Revotar, junto do Salvar/Revelar no cabeçalho da sala (quem facilita olha para um canto só). O botão grande
 * revota todos; a seta abre "só um papel". Antes de revelar fica desligado e diz por quê, em vez de sumir.
 */
export function RevoteControl({ mode, presentCategories, onRevoteAll, onSelectiveRevote }: RevoteControlProps) {
  if (mode === 'disabled') {
    return (
      <button
        type="button"
        disabled
        title="Disponível depois de revelar os votos"
        className={cn(SHELL, DISABLED, BUTTON, 'cursor-not-allowed')}
      >
        <RotateCcw className="h-4 w-4" strokeWidth={1.5} aria-hidden="true" /> Revotar
      </button>
    );
  }
  return (
    <div className={cn(SHELL, ENABLED)}>
      <button type="button" onClick={onRevoteAll} className={cn(BUTTON, 'hover:bg-amber-500/20', FOCUS_RING)}>
        <RotateCcw className="h-4 w-4" strokeWidth={1.5} aria-hidden="true" /> Revotar
      </button>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            aria-label="Revotar só um papel"
            className={cn('flex h-9 w-9 items-center justify-center border-l border-amber-500/60 hover:bg-amber-500/20 max-sm:h-11', FOCUS_RING)}
          >
            <ChevronDown className="h-4 w-4" strokeWidth={1.5} aria-hidden="true" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-60">
          <DropdownMenuLabel className="text-xs font-semibold text-muted-foreground">O que revotar</DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={onRevoteAll} className="flex-col items-start gap-0.5">
            <span className="text-sm font-semibold">Todos os papéis</span>
            <span className="text-xs text-muted-foreground">Apaga os votos e reabre a rodada</span>
          </DropdownMenuItem>
          {presentCategories.length === 0 && <div className="px-2 py-2 text-xs text-muted-foreground">Nenhum papel técnico presente</div>}
          {presentCategories.map(cat => (
            <DropdownMenuItem key={cat} onClick={() => onSelectiveRevote(cat)} className="gap-2">
              {cat === 'Developer' ? <Code className="h-4 w-4" strokeWidth={1.5} aria-hidden="true" /> : <Users className="h-4 w-4" strokeWidth={1.5} aria-hidden="true" />}
              Só {formatRoleForCopy(cat)}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
