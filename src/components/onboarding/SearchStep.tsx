'use client';

import { ChevronRight, Crown, Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { OnboardingRoster } from '@/services/onboardingService';
import { MIN_SEARCH_LENGTH, type SearchPhase } from '@/lib/onboarding';
import { FOCUS_RING, TONES } from '@/components/room-kit/tokens';
import { cn } from '@/lib/utils';
import { BackButton, BRAND_LINK, InlineNotice, ListBox, SmallButton, Spinner, StepCard, StepHeading } from './ui';

interface Props {
  query: string;
  onQueryChange: (value: string) => void;
  phase: SearchPhase;
  results: OnboardingRoster[];
  /** Texto buscado, para a mensagem de "nenhuma squad". */
  searchedText: string;
  /** Chave da squad que está sendo aberta (a linha mostra o giro). */
  openingId: string | null;
  onOpen: (projectId: string) => void;
  onRetry: () => void;
  onLead: () => void;
  onBack: () => void;
}

/** Passo 3: busca por squad, projeto ou colega. Cada estado da busca tem sua própria mensagem. */
export function SearchStep({ query, onQueryChange, phase, results, searchedText, openingId, onOpen, onRetry, onLead, onBack }: Props) {
  const opening = openingId !== null;
  return (
    <StepCard>
      <StepHeading title="Qual é a sua squad?" subtitle="Busque pelo nome da squad, do projeto ou de alguém que trabalha com você." />

      <div className="flex flex-col gap-2">
        <Label htmlFor="busca" className="sr-only">
          Buscar squad, projeto ou pessoa
        </Label>
        <div className="relative">
          <Search aria-hidden="true" className="pointer-events-none absolute left-4 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-primary [.theme-totvs:not(.dark)_&]:text-foreground" strokeWidth={1.5} />
          <Input
            id="busca"
            value={query}
            onChange={(e) => onQueryChange(e.target.value)}
            placeholder="Ex: DDWMISSI, Missão Crítica ou o nome de um colega"
            autoComplete="off"
            autoFocus
            aria-describedby="busca-estado"
            className="h-[52px] rounded-2xl border-primary/50 bg-background pl-11 pr-10 text-[15px]"
          />
          {phase === 'loading' && <Spinner className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground" />}
        </div>

        <div id="busca-estado" aria-live="polite">
          {phase === 'idle' && <p className="text-[13px] text-muted-foreground">Digite ao menos {MIN_SEARCH_LENGTH} letras.</p>}
          {phase === 'empty' && (
            <p className="text-sm text-muted-foreground">Nenhuma squad encontrada com “{searchedText}”. Confira a grafia ou procure pelo nome de um colega.</p>
          )}
          {phase === 'error' && (
            <InlineNotice role="alert" tone="danger" actions={<SmallButton onClick={onRetry}>Tentar de novo</SmallButton>}>
              Não deu para buscar agora. Confira a conexão e tente de novo.
            </InlineNotice>
          )}
        </div>
      </div>

      {phase === 'ok' && (
        <div className="flex flex-col gap-2">
          <ListBox>
            {results.map((r) => (
              <button
                key={r.projectId}
                type="button"
                onClick={() => onOpen(r.projectId)}
                disabled={opening}
                className={cn('flex w-full items-center gap-3.5 px-4 py-3 text-left transition-colors hover:bg-muted/50 disabled:opacity-60', FOCUS_RING)}
              >
                <span aria-hidden="true" className={cn('flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-xs font-bold', TONES.brand.tile)}>
                  {r.projectId.slice(0, 2)}
                </span>
                <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span className="truncate text-sm font-bold">
                    {r.projectId} <span className="font-medium text-muted-foreground">· {r.projectName}</span>
                  </span>
                  <span className="truncate text-xs text-muted-foreground">
                    {[r.tribeName, `${r.memberCount} pessoas`, r.members.map((m) => m.displayName.split(' ')[0]).slice(0, 3).join(', ')].filter(Boolean).join(' · ')}
                  </span>
                </span>
                {openingId === r.projectId ? (
                  <Spinner className="shrink-0" />
                ) : (
                  <ChevronRight aria-hidden="true" className="h-4 w-4 shrink-0 text-muted-foreground" strokeWidth={1.5} />
                )}
              </button>
            ))}
          </ListBox>
          <span className="text-xs text-muted-foreground">Até 8 resultados.</span>
        </div>
      )}

      <div className="flex items-start gap-3 rounded-2xl border border-dashed border-border px-4 py-3.5">
        <Crown aria-hidden="true" className={cn('mt-0.5 h-[18px] w-[18px] shrink-0', TONES.warn.text)} strokeWidth={1.5} />
        <div className="flex min-w-0 flex-col items-start gap-1">
          <span className="text-sm font-bold">Sua squad não aparece?</span>
          <span className="text-[13px] leading-relaxed text-muted-foreground">Quem cadastra é o Agile Master ou o People Lead. Peça para importar ou mandar um convite.</span>
          <button type="button" onClick={onLead} className={BRAND_LINK}>
            Eu sou Agile Master ou People Lead
          </button>
        </div>
      </div>

      <BackButton onClick={onBack} />
    </StepCard>
  );
}
