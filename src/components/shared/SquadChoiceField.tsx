'use client';

import { useMemo } from 'react';
import { Lock } from 'lucide-react';
import { FIELD, SelectField } from '@/components/room-kit';
import { useActiveSquad } from '@/hooks/useActiveSquad';
import { useMyMemberships } from '@/hooks/useMyMemberships';
import { squadChoices } from '@/lib/health-check-lobby';
import { cn } from '@/lib/utils';

interface SquadChoiceFieldProps {
  id: string;
  /** Chave da squad escolhida ('' = ainda não escolhida: vale a ativa). */
  value: string;
  onChange: (squadId: string) => void;
  /** Para leitor de tela: "Squad da sala", "Squad da retro"... */
  ariaLabel?: string;
  className?: string;
}

/**
 * Campo "Squad" dos diálogos de nova sessão. Nunca é texto livre (a lista da squad filtra pela chave, então um nome
 * digitado fazia a sessão sumir): com mais de uma squad no vínculo vira seletor; com uma, fica travada na ativa.
 */
export function SquadChoiceField({ id, value, onChange, ariaLabel = 'Squad', className }: SquadChoiceFieldProps) {
  const { squadId: activeSquadId, squadName: activeSquadName } = useActiveSquad();
  const { memberships } = useMyMemberships();
  const squads = useMemo(
    () => squadChoices(memberships?.memberships, { squadId: activeSquadId, squadName: activeSquadName }),
    [memberships, activeSquadId, activeSquadName],
  );
  const current = squads.find((s) => s.value.toLowerCase() === (value || activeSquadId || '').toLowerCase())?.value ?? squads[0]?.value ?? '';

  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      <label htmlFor={id} className="text-[13px] font-semibold">Squad</label>
      {squads.length > 1 ? (
        <SelectField id={id} aria-label={ariaLabel} value={current} onChange={onChange} options={squads} className="h-10" />
      ) : (
        <div id={id} aria-label={ariaLabel} className={cn(FIELD, 'flex h-10 items-center justify-between gap-2 opacity-90')}>
          <span className="truncate">{squads[0]?.label ?? 'Sem squad'}</span>
          <Lock className="h-3.5 w-3.5 shrink-0 text-muted-foreground" strokeWidth={1.5} aria-hidden="true" />
        </div>
      )}
      <p className="m-0 text-xs text-muted-foreground">
        {squads.length === 0
          ? 'Você ainda não tem squad: a sessão não aparece em nenhuma lista, só por link.'
          : squads.length > 1
            ? 'As squads do seu vínculo. A sessão aparece na lista da squad escolhida.'
            : 'A squad ativa no cabeçalho. A sessão aparece na lista dela.'}
      </p>
    </div>
  );
}
