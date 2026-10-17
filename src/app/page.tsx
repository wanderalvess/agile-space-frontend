"use client";

import { useCallback, useEffect, useMemo, useState } from 'react';
import { FeedbackWidget } from '@/components/feedback-widget';
import { AnnouncementBanner } from '@/components/home/AnnouncementBanner';
import { HomeHero } from '@/components/home/HomeHero';
import { HALO } from '@/components/home/home-ui';
import { LinkedTeamWelcome } from '@/components/home/LinkedTeamWelcome';
import { LiveNow } from '@/components/home/LiveNow';
import { ModuleGrid } from '@/components/home/ModuleGrid';
import { NewSquadWelcome } from '@/components/home/NewSquadWelcome';
import { RitualsSection } from '@/components/home/RitualsSection';
import { SquadsOverview } from '@/components/home/SquadsOverview';
import { AppFooter } from '@/components/layout/AppFooter';
import { PageShell } from '@/components/page';
import { useAuth } from '@/context/AuthContext';
import { useUserContext } from '@/context/UserContext';
import { useToast } from '@/hooks/use-toast';
import { useNextCeremony } from '@/hooks/useNextCeremony';
import { firstName, heroChips, liveCountBySquad, pickSquadsToQuery, sprintLabel, upcomingCeremonies, type UpcomingCeremony } from '@/hooks/home/derive';
import { useNow } from '@/hooks/home/useHomeResource';
import { useLiveSessions } from '@/hooks/home/useLiveSessions';
import { useMySquads } from '@/hooks/home/useMySquads';
import { useRitualHistory } from '@/hooks/home/useRitualHistory';
import { formatCountdown } from '@/lib/ceremony-countdown';
import { cn } from '@/lib/utils';

export default function Home() {
  const { userProfile } = useUserContext();
  const { session } = useAuth();
  const { toast } = useToast();
  const now = useNow();

  const { squads, activeId, activeSquad, isMulti, switchTo } = useMySquads();
  const [query, setQuery] = useState('');
  /** Squad escolhida para filtrar a Home; null = todas. */
  const [scope, setScope] = useState<string | null>(null);
  const [switchingTo, setSwitchingTo] = useState<string | null>(null);
  const [feedbackSignal, setFeedbackSignal] = useState<number | undefined>();

  useEffect(() => {
    document.title = 'Hub | Portal Tech V&D';
  }, []);

  const handleOpenFeedback = useCallback(() => setFeedbackSignal(Date.now()), []);

  // Escolha que deixou de existir (ou conta que passou a ter uma squad só) volta para "todas".
  const effectiveScope = isMulti && scope && squads.some((s) => s.id === scope) ? scope : null;
  const queried = useMemo(() => pickSquadsToQuery(squads, activeId, effectiveScope), [squads, activeId, effectiveScope]);

  const live = useLiveSessions(queried);
  const history = useRitualHistory(queried);
  const liveBySquad = useMemo(() => liveCountBySquad(live.data), [live.data]);

  const squadForCeremony = activeId && activeId !== 'Sem Time' ? activeId : '';
  const next = useNextCeremony(squadForCeremony, userProfile?.email || userProfile?.id || '');
  const upcoming = useMemo<UpcomingCeremony[]>(() => {
    if (next.mode === 'manual') return upcomingCeremonies(next.manualCeremonies, now, 2);
    return next.ceremony ? [{ title: next.ceremony.title, start: next.ceremony.start }] : [];
  }, [next.mode, next.manualCeremonies, next.ceremony, now]);

  const handlePickSquad = useCallback(
    async (squadId: string | null) => {
      const previous = scope;
      setScope(squadId);
      if (!squadId || squadId === activeId) return;
      setSwitchingTo(squadId);
      try {
        await switchTo(squadId);
      } catch (err) {
        setScope(previous);
        toast({
          variant: 'destructive',
          title: 'Não foi possível trocar de squad',
          description: err instanceof Error && err.message ? err.message : 'Tente novamente em instantes.',
        });
      } finally {
        setSwitchingTo(null);
      }
    },
    [scope, activeId, switchTo, toast],
  );

  const scopedSquad = effectiveScope ? squads.find((s) => s.id === effectiveScope) : undefined;
  const scopeLabel = isMulti ? (scopedSquad ? `Squad ${scopedSquad.name}` : 'Todas as squads') : activeSquad ? `Squad ${activeSquad.name}` : '';

  const chips = heroChips({
    squadCount: squads.length,
    liveCount: live.data.length,
    sprintText: activeSquad ? sprintLabel(activeSquad.sprintName, activeSquad.daysLeft) : undefined,
    // Com várias squads a próxima cerimônia lida é só da ativa: não vira chip da visão geral.
    nextCeremonyText: !isMulti && next.ceremony ? `${next.ceremony.title} · ${formatCountdown(next.ceremony.start, now).label}` : undefined,
  });

  return (
    <PageShell
      header={{
        squadControl: { squads, scope: effectiveScope, isMulti, switchingTo, onPick: handlePickSquad },
        search: { query, onQueryChange: setQuery },
      }}
      backdrop={<div aria-hidden="true" className={cn('pointer-events-none absolute inset-x-0 top-0 h-[460px]', HALO)} />}
      contentClassName="gap-7 pb-12 pt-7"
      footer={<AppFooter onOpenFeedback={handleOpenFeedback} />}
    >
      <AnnouncementBanner />
      <LinkedTeamWelcome />
      <NewSquadWelcome />

      <HomeHero firstName={firstName(userProfile?.name || session?.name)} chips={chips} />

      {isMulti && (
        <SquadsOverview
          squads={squads}
          scope={effectiveScope}
          liveBySquad={liveBySquad}
          switchingTo={switchingTo}
          now={now}
          onPick={handlePickSquad}
        />
      )}

      <LiveNow
        sessions={effectiveScope ? live.data.filter((s) => s.squadId === effectiveScope) : live.data}
        showSquad={isMulti}
        upcoming={upcoming}
        loading={live.loading}
        failed={live.failed}
        onRetry={live.refetch}
        now={now}
      />

      <RitualsSection history={history.data} loading={history.loading} failed={history.failed} onRetry={history.refetch} showSquad={isMulti} scopeLabel={scopeLabel} now={now} />

      <ModuleGrid query={query} />

      <FeedbackWidget toolName="Portal Tech V&D - Hub" triggerVariant="none" externalTriggerSignal={feedbackSignal} />
    </PageShell>
  );
}
