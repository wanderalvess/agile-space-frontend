'use client';

import { ArrowRight, Crown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { InitialsAvatar } from '@/components/common/InitialsAvatar';
import type { OnboardingCandidate, OnboardingRoster } from '@/services/onboardingService';
import { rosterRowAction, rosterRowHint } from '@/lib/onboarding';
import { TONES } from '@/components/room-kit/tokens';
import { cn } from '@/lib/utils';
import { BackButton, SmallButton, Spinner, StepCard, StepHeading } from './ui';

interface Props {
  roster: OnboardingRoster;
  busyMemberId: string | null;
  onClaim: (candidate: OnboardingCandidate, projectId: string) => void;
  /** "Pedir vínculo" sobre uma linha da lista. */
  onRequestLink: (candidate: OnboardingCandidate) => void;
  onNotListed: () => void;
  onBack: () => void;
}

function RowAction({ m, busy, disabled, onClaim, onRequestLink }: { m: OnboardingCandidate; busy: boolean; disabled: boolean; onClaim: () => void; onRequestLink: () => void }) {
  switch (rosterRowAction(m)) {
    case 'claim':
      return (
        <Button size="sm" onClick={onClaim} disabled={disabled} className="h-8 rounded-[10px] px-3 text-[13px] font-bold" aria-label={`Sou eu: ${m.displayName}`}>
          {busy ? <Spinner className="h-3.5 w-3.5" /> : 'Sou eu'}
        </Button>
      );
    case 'request':
      return (
        <SmallButton onClick={onRequestLink} disabled={disabled} aria-label={`Pedir vínculo: ${m.displayName}`}>
          Pedir vínculo
        </SmallButton>
      );
    case 'not-you':
      return (
        <span className="flex flex-wrap items-center justify-end gap-x-2 gap-y-1">
          <span className="text-[11px] leading-tight text-muted-foreground">não é você</span>
          <SmallButton onClick={onRequestLink} disabled={disabled} className="h-7 px-2.5 text-xs" aria-label={`Pedir vínculo: ${m.displayName}`}>
            Pedir vínculo
          </SmallButton>
        </span>
      );
    case 'mine':
      return <span className="text-[11px] leading-tight text-muted-foreground">já é você</span>;
    default:
      return <span className="text-[11px] leading-tight text-muted-foreground">vinculada</span>;
  }
}

/** Passo 4: quem é você na squad. "Sou eu" liga a conta à linha; liderança e linhas livres pedem vínculo. */
export function RosterStep({ roster, busyMemberId, onClaim, onRequestLink, onNotListed, onBack }: Props) {
  const busy = busyMemberId !== null;
  return (
    <StepCard>
      <StepHeading
        title={`Quem é você na ${roster.projectId}?`}
        subtitle={`${roster.projectName}${roster.tribeName ? ` · Tribo ${roster.tribeName}` : ''} · ${roster.memberCount} pessoas`}
      />

      <ul className="max-h-[380px] divide-y divide-border overflow-y-auto rounded-2xl border border-border" aria-label="Pessoas da squad">
        {roster.members.map((m) => (
          <li key={m.memberId} className="flex flex-wrap items-center gap-x-3 gap-y-2 px-4 py-2.5 sm:flex-nowrap">
            <InitialsAvatar name={m.displayName} src={m.avatarUrl} className="h-9 w-9 text-xs" />
            <span className="flex min-w-0 flex-1 basis-40 flex-col">
              <span className="truncate text-sm font-bold">{m.displayName}</span>
              <span className="truncate text-xs text-muted-foreground">
                <span className="sm:hidden">{m.roleName} · </span>
                {rosterRowHint(m)}
              </span>
            </span>
            <span className="hidden h-[22px] shrink-0 items-center gap-1.5 rounded-full border border-border px-2.5 text-xs font-semibold text-muted-foreground sm:inline-flex">
              {m.leadership && <Crown aria-label="Liderança" className={cn('h-3 w-3', TONES.warn.text)} strokeWidth={1.5} />}
              {m.roleName}
            </span>
            <span className="flex shrink-0 items-center justify-end sm:w-[176px]">
              <RowAction m={m} busy={busyMemberId === m.memberId} disabled={busy} onClaim={() => onClaim(m, roster.projectId)} onRequestLink={() => onRequestLink(m)} />
            </span>
          </li>
        ))}
      </ul>

      <p className="rounded-xl border border-border bg-muted/40 px-3.5 py-2.5 text-xs leading-relaxed text-muted-foreground">
        Liderança (coroa) não se autodeclara: o papel dá governança da squad.
      </p>

      <div className="flex items-center justify-between gap-3 border-t border-border pt-4">
        <BackButton onClick={onBack} disabled={busy}>
          Trocar de squad
        </BackButton>
        <Button type="button" variant="outline" onClick={onNotListed} disabled={busy} className="h-10 gap-2 rounded-[10px] text-[13px] font-semibold">
          Não estou na lista <ArrowRight aria-hidden="true" className="h-3.5 w-3.5" strokeWidth={1.5} />
        </Button>
      </div>
    </StepCard>
  );
}
