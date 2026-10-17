'use client';

import { Check, Crown, Loader2, UserRound } from 'lucide-react';
import { ModalButton, RoleChip, StatusChip, TONES } from '@/components/room-kit';
import { linkKindLabel, squadBadge, type MyLink } from '@/lib/my-links';
import { cn } from '@/lib/utils';

export interface LinkCardProps {
  link: MyLink;
  /** Há mais de um vínculo: dá para trocar a squad ativa. */
  canSwitch: boolean;
  switching: boolean;
  /** Outra troca em andamento: bloqueia os botões. */
  busy: boolean;
  onActivate: (link: MyLink) => void;
}

/** Um vínculo (Pessoa × Squad × Papel): placa da squad, nome, chave, papel, tipo e a ação de tornar ativa. */
export function LinkCard({ link, canSwitch, switching, busy, onActivate }: LinkCardProps) {
  const meta = link.via ? `via ${link.via}` : [link.tribe, link.segment].filter(Boolean).join(' · ');
  return (
    <li
      aria-label={`${link.name}${link.active ? ', squad ativa' : ''}`}
      className={cn(
        'flex flex-wrap items-center gap-x-3.5 gap-y-3 rounded-2xl border p-3.5 sm:p-4',
        link.active ? 'border-primary/40 bg-primary/5' : 'border-border bg-card',
      )}
    >
      <span aria-hidden="true" className={cn('flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-sm font-bold', TONES.brand.tile)}>
        {squadBadge(link)}
      </span>

      <div className="flex min-w-0 flex-1 basis-56 flex-col gap-1.5">
        <div className="flex min-w-0 flex-wrap items-baseline gap-x-2">
          <span className="truncate text-[15px] font-semibold text-foreground">{link.name}</span>
          <span className="font-code text-xs text-muted-foreground">{link.id}</span>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          {link.role && <RoleChip category={link.role} label={link.role} className="max-w-full truncate" />}
          <StatusChip tone={link.leadership ? 'warn' : 'neutral'} className="gap-1">
            {link.leadership ? <Crown aria-hidden="true" className="h-3 w-3" strokeWidth={1.5} /> : <UserRound aria-hidden="true" className="h-3 w-3" strokeWidth={1.5} />}
            {linkKindLabel(link)}
          </StatusChip>
        </div>
        {meta && <span className="truncate text-xs text-muted-foreground">{meta}</span>}
      </div>

      {link.active ? (
        <StatusChip tone="success" className="gap-1">
          <Check aria-hidden="true" className="h-3 w-3" strokeWidth={2} />
          Squad ativa
        </StatusChip>
      ) : (
        canSwitch && (
          <ModalButton onClick={() => onActivate(link)} disabled={busy} aria-label={`Tornar ${link.name} a squad ativa`} className="gap-2 max-sm:h-11 max-sm:w-full">
            {switching && <Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" strokeWidth={1.5} aria-hidden="true" />}
            Tornar ativa
          </ModalButton>
        )
      )}
    </li>
  );
}
