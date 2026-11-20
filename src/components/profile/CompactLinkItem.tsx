'use client';

import { Check, Loader2 } from 'lucide-react';
import { ModalButton, StatusChip } from '@/components/room-kit';
import { compactOrigin, type MyLink } from '@/lib/my-links';
import { cn } from '@/lib/utils';

export interface CompactLinkItemProps {
  link: MyLink;
  /** Há mais de um vínculo: dá para trocar a squad ativa. */
  canSwitch: boolean;
  switching: boolean;
  /** Outra troca em andamento: bloqueia os botões. */
  busy: boolean;
  onActivate: (link: MyLink) => void;
}

/** Um vínculo numa linha só da ficha: nome e, abaixo, "CHAVE · Papel · origem"; à direita "Ativa" ou "Tornar ativa". */
export function CompactLinkItem({ link, canSwitch, switching, busy, onActivate }: CompactLinkItemProps) {
  const derived = link.scope !== 'SQUAD' && !!link.scopeLabel;
  const detail = [link.id, derived ? link.scopeLabel : link.role, derived ? null : compactOrigin(link)].filter(Boolean).join(' · ');
  return (
    <li
      aria-label={`${link.name}${link.active ? ', squad ativa' : ''}`}
      className={cn('flex items-center gap-3 rounded-[14px] border bg-card px-3.5 py-3', link.active ? 'border-primary/50' : 'border-border')}
    >
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="truncate text-sm font-bold text-foreground">{link.name}</span>
        <span className="truncate text-xs text-muted-foreground">{detail}</span>
      </div>
      {link.active ? (
        <StatusChip tone="success" className="shrink-0 gap-1">
          <Check aria-hidden="true" className="h-3.5 w-3.5" strokeWidth={1.5} />
          Ativa
        </StatusChip>
      ) : (
        canSwitch && (
          <ModalButton onClick={() => onActivate(link)} disabled={busy} aria-label={`Tornar ${link.name} a squad ativa`} className="h-11 shrink-0 gap-2">
            {switching && <Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" strokeWidth={1.5} aria-hidden="true" />}
            Tornar ativa
          </ModalButton>
        )
      )}
    </li>
  );
}
