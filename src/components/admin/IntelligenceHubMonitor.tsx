'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { Cpu, Database, UsersRound, Zap } from 'lucide-react';
import { knowledgeChatApi, type KnowledgeTokenUsageDTO } from '@/app/knowledge/chat/api';
import { knowledgeApi } from '@/app/knowledge/api';
import { InitialsAvatar } from '@/components/common/InitialsAvatar';
import { EmptyState, ErrorState, KpiCard, KpiRow, LoadingSkeleton, PAGE_CARD } from '@/components/page';
import { IconTile } from '@/components/room-kit';
import { cn } from '@/lib/utils';

export function IntelligenceHubMonitor() {
  const [usageData, setUsageData] = useState<KnowledgeTokenUsageDTO[]>([]);
  /** `null` quando só a contagem de documentos falhou: o cartão mostra "—" em vez de um zero falso. */
  const [totalDocs, setTotalDocs] = useState<number | null>(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  // Sem realtime aqui por decisão de produto: busca única ao montar, sem onSnapshot/polling.
  const loadData = useCallback(async (isCancelled: () => boolean = () => false) => {
    setLoading(true);
    setError(false);
    const [usage, docs] = await Promise.allSettled([
      knowledgeChatApi.getTopTokenUsage(),
      knowledgeApi.listDocuments(undefined, undefined, 0, 1),
    ]);
    if (isCancelled()) return;
    if (usage.status === 'rejected') {
      console.error('Erro ao carregar o consumo de tokens do Centro de Conhecimento:', usage.reason);
      setError(true);
    } else {
      setUsageData(usage.value);
      if (docs.status === 'fulfilled') {
        setTotalDocs(docs.value.totalElements);
      } else {
        console.error('Erro ao contar os documentos da Base de Conhecimento:', docs.reason);
        setTotalDocs(null);
      }
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    let cancelled = false;
    loadData(() => cancelled);
    return () => {
      cancelled = true;
    };
  }, [loadData]);

  const totalTokens = usageData.reduce((acc, curr) => acc + (curr.totalTokens || 0), 0);

  if (loading) return <LoadingSkeleton variant="page" rows={4} label="Sincronizando com o Centro de Conhecimento" />;
  if (error) {
    return <ErrorState title="Não foi possível carregar os dados do motor" onRetry={() => loadData()} />;
  }

  return (
    <div className="flex flex-col gap-5">
      <KpiRow columns={3}>
        <KpiCard label="Base de conhecimento" value={totalDocs == null ? '—' : totalDocs.toLocaleString('pt-BR')} hint="Documentos indexados" icon={Database} />
        <KpiCard label="Tokens consumidos" value={totalTokens.toLocaleString('pt-BR')} hint={usageData.length === 0 ? 'Soma das pessoas do ranking' : `Soma ${usageData.length === 1 ? 'da pessoa' : `das ${usageData.length} pessoas`} do ranking`} icon={Cpu} />
        <KpiCard label="Pessoas no ranking" value={usageData.length} hint="As que mais consultaram" icon={UsersRound} />
      </KpiRow>

      <section className={cn(PAGE_CARD, 'overflow-clip')} aria-label="Consumo por usuário">
        <header className="flex items-center gap-3.5 border-b border-border px-6 py-4">
          <IconTile icon={Zap} />
          <div className="flex min-w-0 flex-col">
            <h2 className="text-lg font-bold tracking-tight text-foreground">Consumo por usuário</h2>
            <p className="text-[13px] text-muted-foreground">As 10 pessoas que mais consultaram o assistente</p>
          </div>
        </header>
        {usageData.length === 0 ? (
          <EmptyState embedded icon={UsersRound} title="Ninguém consultou o assistente ainda" />
        ) : (
          <ol className="flex flex-col gap-2.5 p-5">
            {usageData.map((u, idx) => (
              <li key={u.userId} className="flex items-center justify-between gap-4 rounded-2xl border border-border bg-muted/30 px-4 py-3 transition-colors hover:bg-muted/50">
                <div className="flex min-w-0 items-center gap-3.5">
                  <span className="w-7 text-[13px] font-semibold tabular-nums text-muted-foreground">#{String(idx + 1).padStart(2, '0')}</span>
                  <InitialsAvatar name={u.userName || u.userId} className="h-10 w-10 text-sm" />
                  <div className="flex min-w-0 flex-col">
                    <p className="truncate text-sm font-semibold text-foreground" title={u.userName || u.userId}>{u.userName || u.userId}</p>
                    <p className="text-xs text-muted-foreground">
                      Último uso: {u.updatedAt ? new Date(u.updatedAt).toLocaleDateString('pt-BR') : 'Recentemente'}
                    </p>
                  </div>
                </div>
                <div className="shrink-0 text-right">
                  <p className="text-lg font-bold tabular-nums leading-none text-foreground">{(u.totalTokens || 0).toLocaleString('pt-BR')}</p>
                  <p className="mt-1 text-xs text-muted-foreground">tokens</p>
                </div>
              </li>
            ))}
          </ol>
        )}
      </section>
    </div>
  );
}
