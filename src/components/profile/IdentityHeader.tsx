'use client';

import { Crown, MapPin, ShieldCheck } from 'lucide-react';
import { InitialsAvatar } from '@/components/common/InitialsAvatar';
import { RoleChip, StatusChip } from '@/components/room-kit';
import type { MyLink } from '@/lib/my-links';

export interface IdentityHeaderProps {
  name: string;
  email?: string;
  photo?: string;
  onPhotoError: (url: string) => void;
  jiraConnected: boolean;
  isAdmin: boolean;
  /** Papel na squad ativa. */
  role?: string;
  activeSquad?: MyLink;
}

/** Cabeçalho da identidade: avatar grande, nome, e-mail e os chips de estado (Jira, papel, squad ativa). */
export function IdentityHeader({ name, email, photo, onPhotoError, jiraConnected, isAdmin, role, activeSquad }: IdentityHeaderProps) {
  const shown = name.trim();
  return (
    <div className="flex items-center gap-4 border-y border-border bg-muted/30 px-6 py-4 max-sm:px-4 sm:gap-5">
      <InitialsAvatar
        name={shown}
        email={email}
        src={photo}
        onPhotoError={onPhotoError}
        title={shown || undefined}
        className="h-16 w-16 border border-border text-xl ring-2 ring-primary/25 ring-offset-2 ring-offset-card sm:h-[72px] sm:w-[72px] sm:text-2xl"
      />
      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <div className="flex min-w-0 flex-col">
          <p className="truncate text-lg font-bold leading-tight text-foreground sm:text-xl">{shown || 'Seu nome'}</p>
          {email && <p className="truncate text-[13px] text-muted-foreground">{email}</p>}
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          {jiraConnected && <StatusChip tone="success">Jira conectado</StatusChip>}
          {isAdmin && (
            <StatusChip tone="neutral" className="gap-1">
              <ShieldCheck aria-hidden="true" className="h-3 w-3" strokeWidth={1.5} />
              Administrador
            </StatusChip>
          )}
          {role && <RoleChip category={role} label={role} className="max-w-[200px] truncate" />}
          {activeSquad && (
            <StatusChip tone="brand" className="gap-1">
              {activeSquad.leadership ? <Crown aria-hidden="true" className="h-3 w-3" strokeWidth={1.5} /> : <MapPin aria-hidden="true" className="h-3 w-3" strokeWidth={1.5} />}
              <span className="max-w-[160px] truncate">{activeSquad.id}</span>
            </StatusChip>
          )}
        </div>
      </div>
    </div>
  );
}
