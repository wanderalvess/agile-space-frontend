'use client';

// A tela do painel único, sem ler contexto nem chamar API: tudo chega por props (quem monta é SquadPanelsTab).
// Assim a tela se testa e se confere sem login.
import * as React from 'react';
import { useMemo } from 'react';
import { SelectField, StatusChip } from '@/components/room-kit';
import { PAGE_CARD } from '@/components/page/styles';
import { estimationUnitLabel } from '@/components/ui/DashboardFilters';
import type { SquadDashboardData } from '@/hooks/useSquadDashboardData';
import type { ActivePanelTab, DashboardTabId, PanelsAccess } from '@/lib/dashboard-roles';
import type { SquadConfig } from '@/lib/types';
import { cn } from '@/lib/utils';
import { JqlPanelsSection } from './jql/JqlPanelsSection';
import { EstimationChip, PanelAccessDenied, PanelDataNotice, PanelRoleTabs, PanelSkeleton, pickNotice } from './PanelChrome';
import { computeSprintCore } from './panel-model';
import { AgileMasterView, ExecutionView, PeopleLeadView, ProductOwnerView, TechLeadView } from './RoleViews';
import { TriboView, type TribeState } from './TriboView';

export interface SquadPanelsViewProps {
  /** Papel no cadastro ("Product Owner", "Developer"...). */
  roleLabel: string;
  userId: string;
  userName: string;
  /** O perfil ainda está carregando. */
  initializing: boolean;
  access: PanelsAccess;
  active: ActivePanelTab;
  data: SquadDashboardData;
  config: SquadConfig | null;
  configLoading: boolean;
  tribe: TribeState;
  onSelectTab: (id: DashboardTabId) => void;
  onBackToHub: () => void;
}

const PANEL_ID = 'painel-panel';

export function SquadPanelsView({
  roleLabel,
  userId,
  userName,
  initializing,
  access,
  active,
  data,
  config,
  configLoading,
  tribe,
  onSelectTab,
  onBackToHub,
}: SquadPanelsViewProps) {
  const core = useMemo(() => computeSprintCore(data.rollup, data.issues), [data.rollup, data.issues]);
  const unitLabel =
    config?.estimationUnit && ['SP', 'HOURS', 'TSHIRT', 'COUNT'].includes(config.estimationUnit) ? estimationUnitLabel(config.estimationUnit) : null;

  const isTribe = active.tabId === 'tribe-level';
  const isJql = active.tabId === 'custom';
  const pastSprint = data.selectedSprint !== 'current' && data.selectedSprint !== data.sprintOptions[0]?.value;
  const noticeKind = pickNotice({
    hasSquad: data.hasSquad,
    loading: data.loading,
    error: data.error,
    hasData: core.hasData,
    configMissing: data.hasSquad && !configLoading && config === null,
    pastSprint,
  });
  const firstLoad = data.hasSquad && data.loading && !core.hasData;
  const view = { data, core, unitLabel, config, configLoading };

  let content: React.ReactNode;
  if (initializing) {
    content = <PanelSkeleton />;
  } else if (active.denied) {
    content = <PanelAccessDenied role={roleLabel} onBackToHub={onBackToHub} onOpenMine={() => onSelectTab(access.defaultTabId)} />;
  } else if (isJql) {
    content = <JqlPanelsSection squadId={data.squadId} userId={userId} userName={userName} squadIssues={data.issues} issuesReady={!data.loading} />;
  } else if (isTribe) {
    content = <TriboView tribe={tribe} />;
  } else if (firstLoad) {
    content = <PanelSkeleton />;
  } else {
    switch (active.tabId) {
      case 'product-owner':
        content = <ProductOwnerView {...view} />;
        break;
      case 'agile-master':
        content = <AgileMasterView {...view} />;
        break;
      case 'people-lead':
        content = <PeopleLeadView {...view} />;
        break;
      case 'tech-lead':
        content = <TechLeadView {...view} />;
        break;
      default:
        content = <ExecutionView {...view} />;
    }
  }

  // A sprint só filtra as visões por papel; as consultas e a tribo têm o que mostram por conta própria.
  const showSprintFilter = !isTribe && !isJql && !active.denied;
  const showNotice = !isTribe && !isJql && !active.denied && !initializing;

  return (
    <div className="flex flex-col gap-5">
      <section className={cn(PAGE_CARD, 'flex flex-wrap items-center justify-between gap-4 rounded-3xl px-6 py-5')}>
        <div className="flex min-w-0 flex-col gap-1.5">
          <StatusChip className="h-6 self-start px-2.5 font-bold">{roleLabel}</StatusChip>
          <h2 className="text-[28px] font-bold leading-tight tracking-tight text-foreground">Meu painel</h2>
          <p className="max-w-[640px] text-sm leading-relaxed text-muted-foreground">
            Os números da sprint que importam para o seu papel, vindos do Jira. Use as abas para ver o painel de outros papéis.
          </p>
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <EstimationChip unitLabel={unitLabel} />
          {showSprintFilter && (
            <div className="flex flex-col gap-1">
              <label htmlFor="painel-sprint" className="text-xs font-bold text-muted-foreground">
                Sprint
              </label>
              <SelectField
                id="painel-sprint"
                value={data.selectedSprint}
                onChange={data.setSelectedSprint}
                options={data.sprintOptions}
                className="h-10 w-[220px] max-w-full"
              />
            </div>
          )}
        </div>
      </section>

      <PanelRoleTabs tabs={access.tabs} activeId={active.denied ? null : active.tabId} onChange={onSelectTab} showLeadershipTag={access.isLeadershipView} />

      {showNotice && <PanelDataNotice kind={noticeKind} error={data.error} onRetry={data.error ? () => void data.refresh() : undefined} />}

      <div
        id={PANEL_ID}
        role="tabpanel"
        aria-labelledby={active.denied ? undefined : `painel-tab-${active.tabId}`}
        className="flex flex-col gap-5 motion-safe:animate-in motion-safe:fade-in-0 motion-safe:duration-300"
      >
        {content}
      </div>
    </div>
  );
}
