'use client';

import { useState } from 'react';
import { ChevronRight, Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useSquadSearch } from '@/hooks/useSquadSearch';
import { MIN_SEARCH_LENGTH } from '@/lib/onboarding';
import type { CreatedLinkRequest } from '@/lib/link-requests-api';
import { FOCUS_RING, TONES } from '@/components/room-kit/tokens';
import { RequestLinkStep } from '@/components/onboarding/RequestLinkStep';
import { BackButton, InlineNotice, ListBox, SmallButton, Spinner } from '@/components/onboarding/ui';
import { cn } from '@/lib/utils';

interface Props {
  /** E-mail do login, sugerido no pedido. */
  defaultEmail: string;
  /** Chaves das squads onde a pessoa já tem vínculo (ficam marcadas e sem clique). */
  linkedIds: string[];
  onBack: () => void;
  onSent: (created: CreatedLinkRequest) => void;
}

/**
 * Pedir vínculo de dentro do perfil: acha a squad (mesma busca do onboarding) e abre o pedido
 * (`RequestLinkStep`, o mesmo do onboarding). Quem lidera a squad (ou um admin) confirma e o vínculo aparece na lista.
 */
export function LinkRequestFlow({ defaultEmail, linkedIds, onBack, onSent }: Props) {
  const [projectKey, setProjectKey] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const search = useSquadSearch(projectKey === null);

  if (projectKey) {
    return (
      <RequestLinkStep
        target={{ projectKey }}
        defaultEmail={defaultEmail}
        // Depois de enviado, "Voltar" leva à lista de vínculos (onde o pedido aparece); antes, à busca.
        onBack={() => (sent ? onBack() : setProjectKey(null))}
        onSent={(created) => {
          setSent(true);
          onSent(created);
        }}
      />
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <BackButton onClick={onBack}>Meus vínculos</BackButton>
      <div className="flex flex-col gap-1">
        <h3 className="text-lg font-bold leading-tight text-foreground">Pedir vínculo</h3>
        <p className="text-[13px] text-muted-foreground">Ache a squad e quem a lidera confirma que você faz parte.</p>
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="identity-busca" className="sr-only">
          Buscar squad, projeto ou pessoa
        </Label>
        <div className="relative">
          <Search aria-hidden="true" className="pointer-events-none absolute left-3.5 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-muted-foreground" strokeWidth={1.5} />
          <Input
            id="identity-busca"
            value={search.query}
            onChange={(e) => search.setQuery(e.target.value)}
            placeholder="Nome ou chave da squad"
            autoComplete="off"
            autoFocus
            aria-describedby="identity-busca-estado"
            className="h-11 rounded-[10px] bg-muted/40 pl-10 pr-10 text-sm"
          />
          {search.phase === 'loading' && <Spinner className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />}
        </div>
        <div id="identity-busca-estado" aria-live="polite">
          {search.phase === 'idle' && <p className="text-xs text-muted-foreground">Digite ao menos {MIN_SEARCH_LENGTH} letras.</p>}
          {search.phase === 'empty' && <p className="text-[13px] text-muted-foreground">Nenhuma squad com “{search.searchedText}”.</p>}
          {search.phase === 'error' && (
            <InlineNotice role="alert" tone="danger" actions={<SmallButton onClick={search.retry}>Tentar de novo</SmallButton>}>
              Não deu para buscar agora.
            </InlineNotice>
          )}
        </div>
      </div>

      {search.phase === 'ok' && (
        <ListBox className="bg-card">
          {search.results.map((r) => {
            const linked = linkedIds.includes(r.projectId);
            return (
              <button
                key={r.projectId}
                type="button"
                disabled={linked}
                onClick={() => setProjectKey(r.projectId)}
                className={cn('flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/50 disabled:cursor-default disabled:opacity-60 disabled:hover:bg-transparent max-sm:min-h-14', FOCUS_RING)}
              >
                <span aria-hidden="true" className={cn('flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-xs font-bold', TONES.brand.tile)}>
                  {r.projectId.slice(0, 2).toUpperCase()}
                </span>
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate text-sm font-semibold">
                    {r.projectId} <span className="font-medium text-muted-foreground">· {r.projectName}</span>
                  </span>
                  <span className="truncate text-xs text-muted-foreground">{[r.tribeName, `${r.memberCount} pessoas`].filter(Boolean).join(' · ')}</span>
                </span>
                {linked ? (
                  <span className="text-xs font-medium text-muted-foreground">Já é sua</span>
                ) : (
                  <ChevronRight aria-hidden="true" className="h-4 w-4 shrink-0 text-muted-foreground" strokeWidth={1.5} />
                )}
              </button>
            );
          })}
        </ListBox>
      )}
    </div>
  );
}
