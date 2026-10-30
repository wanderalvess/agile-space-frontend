'use client';

import { ArrowRight, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { InitialsAvatar } from '@/components/common/InitialsAvatar';
import type { OnboardingCandidate, OnboardingRoster } from '@/services/onboardingService';
import { cn } from '@/lib/utils';
import { FOCUS_RING } from '@/components/room-kit/tokens';
import { Caption, ListBox, Spinner, StepCard, StepHeading, WIDE_CTA } from './ui';

function Fact({ label, value }: { label: string; value?: string }) {
  return (
    <div className="min-w-0 rounded-xl border border-border bg-muted/40 px-3 py-2">
      <Caption className="text-xs">{label}</Caption>
      <div className={cn('truncate text-sm font-semibold', !value && 'text-muted-foreground')} title={value || undefined}>
        {value || 'não informado'}
      </div>
    </div>
  );
}

interface Props {
  /** "first": a sugestão principal, com as outras abaixo. "other": confirmação de uma das outras antes do vínculo. */
  variant: 'first' | 'other';
  firstName: string;
  suggestion: OnboardingRoster;
  candidate: OnboardingCandidate;
  others?: OnboardingRoster[];
  busyMemberId: string | null;
  onConfirm: (candidate: OnboardingCandidate, projectId: string) => void;
  /** "Não sou eu": na principal vai para a escolha de perfil; na confirmação volta para a principal. */
  onReject: () => void;
  onPickOther?: (roster: OnboardingRoster) => void;
}

/** Passo 1 (e confirmação de "Também achamos você em"): reconhece a pessoa pelo nome e pede um clique. */
export function SuggestionStep({ variant, firstName, suggestion, candidate, others = [], busyMemberId, onConfirm, onReject, onPickOther }: Props) {
  const busy = busyMemberId !== null;
  const isFirst = variant === 'first';
  return (
    <StepCard>
      <StepHeading
        title={isFirst ? `Oi, ${firstName || 'tudo bem'}.` : `É você na ${suggestion.projectId}?`}
        subtitle={
          isFirst ? (
            <>
              Achamos você na squad <strong className="font-bold text-foreground">{suggestion.projectId}</strong>. Confirma que é você e a gente já te coloca lá dentro.
            </>
          ) : (
            <>
              Achamos você também na squad <strong className="font-bold text-foreground">{suggestion.projectId}</strong>
              {suggestion.projectName && suggestion.projectName !== suggestion.projectId ? ` (${suggestion.projectName})` : ''}. Confirma antes de entrar.
            </>
          )
        }
      />

      <div className="flex items-center gap-4 rounded-2xl border border-primary/25 bg-primary/5 p-4">
        <InitialsAvatar name={candidate.displayName} src={candidate.avatarUrl} className="h-14 w-14 text-lg" />
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="truncate text-[17px] font-bold">{candidate.displayName}</span>
          {!!candidate.emailHint && <span className="truncate text-[13px] text-muted-foreground">{candidate.emailHint}</span>}
        </div>
        <span className="hidden shrink-0 rounded-full border border-border px-2.5 py-0.5 text-xs font-bold uppercase tracking-wider text-muted-foreground sm:inline-flex">
          {candidate.roleName}
        </span>
      </div>

      <div className="grid grid-cols-3 gap-2">
        <Fact label="Projeto" value={suggestion.projectName} />
        <Fact label="Tribo" value={suggestion.tribeName} />
        <Fact label="Pessoas" value={`${suggestion.memberCount}`} />
      </div>

      <p className="text-xs leading-relaxed text-muted-foreground">Reconhecemos você pela lista que a squad importou do Jira. Nada foi alterado ainda.</p>

      <div className="flex flex-col gap-2">
        <Button onClick={() => onConfirm(candidate, suggestion.projectId)} disabled={busy} className={WIDE_CTA}>
          {busyMemberId === candidate.memberId ? (
            <Spinner />
          ) : (
            <>
              Sim, sou eu — entrar na squad <ArrowRight aria-hidden="true" className="h-4 w-4" strokeWidth={1.5} />
            </>
          )}
        </Button>
        <Button type="button" variant="outline" onClick={onReject} disabled={busy} className="h-11 w-full rounded-[10px] text-sm font-semibold">
          {isFirst ? 'Não sou eu / quero outra squad' : 'Não sou eu'}
        </Button>
      </div>

      {isFirst && others.length > 0 && onPickOther && (
        <div className="flex flex-col gap-2 border-t border-border pt-4">
          <Caption>Também achamos você em</Caption>
          <ListBox className="rounded-2xl">
            {others.map((s) => (
              <button
                key={s.projectId}
                type="button"
                onClick={() => onPickOther(s)}
                disabled={busy}
                className={cn('flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/50 disabled:opacity-60', FOCUS_RING)}
              >
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate text-sm font-bold">
                    {s.projectId} · {s.projectName}
                  </span>
                  <span className="truncate text-xs text-muted-foreground">{s.members[0]?.roleName}</span>
                </span>
                <ChevronRight aria-hidden="true" className="h-4 w-4 shrink-0 text-muted-foreground" strokeWidth={1.5} />
              </button>
            ))}
          </ListBox>
        </div>
      )}

    </StepCard>
  );
}
