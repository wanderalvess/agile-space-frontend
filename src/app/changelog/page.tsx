'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { BookOpen } from 'lucide-react';
import { PageHeader, PageShell } from '@/components/page';
import { ModalButton } from '@/components/room-kit';
import { changelogApi, type AppReleaseItem } from '@/services/changelogApi';
import { RUNNING_TAG, restoreVersionsSeen, useNewVersion } from '@/lib/new-version';
import rawVersions from './versions.json';
import { mergeReleases } from './merge';
import { releasesFromFile, sortEntries, toEntry, type ChangelogEntry, type RawVersion } from './releases';
import { ChangelogView, type ChangelogLoadState } from './ChangelogView';

const LOCAL_RELEASES: AppReleaseItem[] = releasesFromFile(rawVersions as RawVersion[]);

export default function ChangelogPage() {
  const [entries, setEntries] = useState<ChangelogEntry[]>([]);
  const [state, setState] = useState<ChangelogLoadState>('carregando');
  const [serverError, setServerError] = useState(false);
  const [justRead, setJustRead] = useState(false);
  const previousSeen = useRef<{ seen: string | null; seenAt: string | null } | null>(null);
  const { userId, seen, seenAt, serverAhead, latest, markRead } = useNewVersion();

  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let alive = true;
    (async () => {
      let next: AppReleaseItem[];
      let failed = false;
      try {
        // O backend guarda o que foi cadastrado no admin; as versões geradas a cada entrega ficam em versions.json.
        // Mostra as duas, sem repetir a tag.
        const remote = await changelogApi.getPublishedReleases();
        next = mergeReleases(remote ?? [], LOCAL_RELEASES);
      } catch {
        next = mergeReleases([], LOCAL_RELEASES);
        failed = true;
      }
      if (!alive) return;
      setEntries(sortEntries(next.map(toEntry)));
      setServerError(failed);
      setState('pronto');
    })();
    return () => {
      alive = false;
    };
  }, [reloadKey]);

  const retry = useCallback(() => {
    setState('carregando');
    setReloadKey((k) => k + 1);
  }, []);

  return (
    <PageShell documentTitle="Versões">
      <PageHeader
        title="Versões"
        module="changelog"
        subtitle="O que mudou no portal, da mais nova para a mais antiga."
        breadcrumb={[{ label: 'Home', href: '/' }, { label: 'Versões' }]}
        actions={
          <ModalButton asChild className="gap-2">
            <Link href="/manual">
              <BookOpen aria-hidden="true" className="h-4 w-4" strokeWidth={1.5} />
              Ver no Manual
            </Link>
          </ModalButton>
        }
      />
      <ChangelogView
        entries={entries}
        state={state}
        serverError={serverError}
        onRetry={retry}
        runningTag={RUNNING_TAG}
        signedIn={!!userId}
        seenTag={seen}
        seenAt={seenAt}
        serverAhead={serverAhead}
        justRead={justRead}
        onMarkAllRead={() => {
          previousSeen.current = markRead(latest);
          setJustRead(true);
        }}
        onUndoRead={() => {
          if (previousSeen.current) restoreVersionsSeen(previousSeen.current);
          previousSeen.current = null;
          setJustRead(false);
        }}
        onReload={() => window.location.reload()}
      />
    </PageShell>
  );
}
