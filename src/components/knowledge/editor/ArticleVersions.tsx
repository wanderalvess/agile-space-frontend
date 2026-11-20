'use client';

import * as React from 'react';
import Link from 'next/link';
import { History } from 'lucide-react';
import { knowledgeApi } from '@/app/knowledge/api';
import { formatVersionDate } from '@/components/knowledge/DocumentHistory';
import { latestVersions } from '@/lib/knowledge-editor';
import type { KnowledgeVersion } from '@/lib/knowledge-types';
import { FOCUS_RING } from '@/components/room-kit';
import { cn } from '@/lib/utils';

/** As 3 últimas versões do artigo (quem e quando), com atalho para o histórico completo na leitura. */
export function ArticleVersions({ documentId, refreshKey }: { documentId: string; refreshKey?: number }) {
  const [versions, setVersions] = React.useState<KnowledgeVersion[] | null>(null);
  const [failed, setFailed] = React.useState(false);

  React.useEffect(() => {
    let alive = true;
    knowledgeApi
      .listVersions(documentId)
      .then((list) => {
        if (!alive) return;
        setFailed(false);
        setVersions(list);
      })
      .catch(() => alive && setFailed(true));
    return () => {
      alive = false;
    };
  }, [documentId, refreshKey]);

  if (failed) return <p className="text-sm text-muted-foreground">Não foi possível carregar as versões agora.</p>;
  if (versions === null) return <p className="text-sm text-muted-foreground" role="status">Carregando versões…</p>;
  if (versions.length === 0) return <p className="text-sm text-muted-foreground">Este artigo ainda não tem versões registradas.</p>;

  return (
    <div className="flex flex-col gap-2">
      <ul className="flex flex-col gap-2" aria-label="Últimas versões do artigo">
        {latestVersions(versions).map((v) => (
          <li key={v.versionNumber} className="flex flex-col rounded-[10px] border border-border px-3 py-2">
            <span className="text-[13px] font-semibold text-foreground">
              Versão {v.versionNumber}
              {v.current ? ' · atual' : ''}
            </span>
            <span className="text-xs text-muted-foreground">
              {v.changedByName || v.changedBy || 'Autor desconhecido'} · {formatVersionDate(v.changedAt)}
            </span>
          </li>
        ))}
      </ul>
      <Link
        href={`/knowledge/kb?id=${documentId}`}
        className={cn('inline-flex items-center gap-1.5 self-start rounded-md text-[13px] font-semibold text-foreground underline underline-offset-2 hover:text-primary', FOCUS_RING)}
      >
        <History className="h-4 w-4" strokeWidth={1.5} aria-hidden="true" />
        Ver histórico
      </Link>
    </div>
  );
}
