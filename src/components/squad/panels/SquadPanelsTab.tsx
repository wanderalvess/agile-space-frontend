'use client';

// Painel único e adaptativo por papel (Squad Hub > Painéis). Junta o que era a aba "Meu painel" do hub e as páginas
// /squad/dashboards/*: uma visão por papel (Execução, Product Owner, Agile Master, People Lead, Tech Lead, Tribo),
// "Visão de liderança" para quem vê todas, filtro de sprint, unidade de estimativa e a aba de consultas JQL.
//
// O controle por papel é SÓ de interface: o servidor libera rollup, issues e membros a qualquer membro da squad.
//
// Uso no hub: <SquadPanelsTab papel={searchParams.get('papel')} onPapelChange={...} />. As duas props são opcionais:
// sem `papel` lê ?papel= da URL na montagem; sem `onPapelChange` troca ?papel= na própria URL (replaceState).
//
// Este arquivo só liga contexto e dados; a tela em si é SquadPanelsView.
import * as React from 'react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useUser } from '@/context/UserContext';
import { useSquadConfig } from '@/hooks/useSquadConfig';
import { useSquadDashboardData } from '@/hooks/useSquadDashboardData';
import { PANELS_PAPEL_PARAM, resolveActivePanelTab, resolvePanelsAccess, type DashboardTabId } from '@/lib/dashboard-roles';
import { SquadPanelsView } from './SquadPanelsView';
import { useTribeRollups } from './TriboView';

export interface SquadPanelsTabProps {
  /** Valor de ?papel= (o id da aba: member, product-owner, agile-master, people-lead, tech-lead, tribe-level, custom). */
  papel?: string | null;
  /** Avisa o hub quando a pessoa troca de aba. Sem isso, o painel troca ?papel= direto na URL. */
  onPapelChange?: (id: DashboardTabId) => void;
}

export default function SquadPanelsTab({ papel, onPapelChange }: SquadPanelsTabProps) {
  const router = useRouter();
  const { userProfile, isLeadership, isInitializing } = useUser();
  const data = useSquadDashboardData();
  const { config, loading: configLoading } = useSquadConfig(data.squadId || undefined);

  const role = userProfile?.role;
  const access = useMemo(() => resolvePanelsAccess(role, isLeadership), [role, isLeadership]);

  // Aba pedida: com a prop `papel` (o hub manda), vale ela; sem a prop, vale a URL, lida depois da montagem para
  // não divergir do HTML do servidor, e a escolha da pessoa.
  const controlled = papel !== undefined;
  const [fromUrl, setFromUrl] = useState<string | null>(null);
  useEffect(() => {
    if (controlled) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- lê a URL só no cliente, depois da hidratação
    setFromUrl(new URLSearchParams(window.location.search).get(PANELS_PAPEL_PARAM));
  }, [controlled]);
  const requested = controlled ? (papel ?? null) : fromUrl;

  const active = resolveActivePanelTab(requested, access);

  const selectTab = useCallback(
    (id: DashboardTabId) => {
      if (!controlled) setFromUrl(id);
      if (onPapelChange) {
        onPapelChange(id);
        return;
      }
      const url = new URL(window.location.href);
      url.searchParams.set(PANELS_PAPEL_PARAM, id);
      window.history.replaceState(window.history.state, '', url.toString());
    },
    [controlled, onPapelChange],
  );

  const tribe = useTribeRollups(active.tabId === 'tribe-level' && !active.denied);

  return (
    <SquadPanelsView
      roleLabel={role || 'Membro da squad'}
      userId={userProfile?.id || userProfile?.email || ''}
      userName={userProfile?.name || 'Membro da squad'}
      initializing={isInitializing || !userProfile}
      access={access}
      active={active}
      data={data}
      config={config}
      configLoading={configLoading}
      tribe={tribe}
      onSelectTab={selectTab}
      onBackToHub={() => router.replace('/squad')}
    />
  );
}
