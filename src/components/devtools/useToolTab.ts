'use client';

import { useCallback, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { getDevTool, normalizeTab } from '@/lib/devtools/registry';

/**
 * Aba de uma ferramenta fundida, guardada em `?aba=` (as rotas antigas redirecionam para cá).
 * Valor desconhecido ou ausente cai na primeira aba. Trocar de aba atualiza a URL sem navegar.
 * Precisa de um <Suspense> acima (usa useSearchParams).
 */
export function useToolTab(toolId: string): readonly [string, (tab: string) => void, URLSearchParams] {
  const params = useSearchParams();
  const tool = getDevTool(toolId);
  const [tab, setTabState] = useState<string>(() => normalizeTab(tool, params.get('aba')) ?? '');

  const setTab = useCallback((next: string) => {
    setTabState(next);
    try {
      const url = new URL(window.location.href);
      url.searchParams.set('aba', next);
      window.history.replaceState(null, '', `${url.pathname}${url.search}`);
    } catch {
      /* sem history: a aba vale só nesta visita */
    }
  }, []);

  return [tab, setTab, params] as const;
}
