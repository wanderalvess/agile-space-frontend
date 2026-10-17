'use client';

import React, { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Trash2 } from 'lucide-react';

import { useAuth } from '@/context/AuthContext';
import { useUserContext } from '@/context/UserContext';
import { getJiraCredentials } from '@/hooks/useJiraSettings';
import { useSquadStore } from '@/store/useSquadStore';
import { useToast } from '@/hooks/use-toast';
import type { SquadMember } from '@/lib/types';
import { SQUAD_PEOPLE_ADMIN_ROLES } from '@/lib/types';
import { DEFAULT_DAILY_HOURS } from '@/lib/roster/constants';
import { filterMembers, rosterKpis, type RosterFilters } from '@/lib/roster/calc';

import { PageHeader, PageShell } from '@/components/page';
import { ConfirmDialog, TabBar } from '@/components/room-kit';
import { SquadRequestsPanel } from '@/components/approvals/SquadRequestsPanel';
import { ROSTER_TAB_PEDIDOS, resolveRosterTab, type RosterTabId } from '@/components/approvals/squad-requests-utils';
import { useApprovalAccess, useSquadLinkRequests } from '@/components/approvals/useSquadLinkRequests';
import { AddMemberDialog } from '@/components/roster/AddMemberDialog';
import { ImportDialog } from '@/components/roster/ImportDialog';
import { InviteDialog } from '@/components/roster/InviteDialog';
import { OnboardingBanner } from '@/components/roster/OnboardingBanner';
import { PendingInvites } from '@/components/roster/PendingInvites';
import { RosterHeader } from '@/components/roster/RosterHeader';
import { RosterKpis } from '@/components/roster/RosterKpis';
import { RosterTable } from '@/components/roster/RosterTable';
import { RosterToolbar } from '@/components/roster/RosterToolbar';
import { EmptyTeam, NoAccess, NoResults, RosterLoadError, RosterSkeleton } from '@/components/roster/RosterStates';
import { RuleSheet } from '@/components/roster/RuleSheet';
import { useAddMember } from '@/components/roster/hooks/useAddMember';
import { useMemberEdits } from '@/components/roster/hooks/useMemberEdits';
import { usePersonConfig } from '@/components/roster/hooks/usePersonConfig';
import { useCanManageTeam, useRosterData } from '@/components/roster/hooks/useRosterData';
import { useRosterExport } from '@/components/roster/hooks/useRosterExport';
import { useRosterImport } from '@/components/roster/hooks/useRosterImport';
import { useRosterInvites } from '@/components/roster/hooks/useRosterInvites';
import { useRosterRule } from '@/components/roster/hooks/useRosterRule';

const NO_FILTERS: RosterFilters = { search: '', role: 'ALL', source: 'ALL' };

function RosterContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const cameFromOnboarding = searchParams.get('onboarding') === '1';
  const { userProfile, isInitializing } = useUserContext();
  const { toast } = useToast();

  const role = userProfile?.role as string | undefined;
  const isPeopleAdmin = !!role && (SQUAD_PEOPLE_ADMIN_ROLES as string[]).includes(role);
  const isAdminRole = role === 'admin';
  const squadId = searchParams.get('squadId') || userProfile?.squadId || '';

  // O cabeçalho do portal troca a squad ativa. Se a troca acontece com ?squadId= na URL, a página seguiria na
  // squad antiga com o cabeçalho mostrando a nova: solta o parâmetro e a página acompanha a squad ativa.
  const { session } = useAuth();
  const activeProjectId = session?.activeProjectId;
  const lastActiveProject = useRef(activeProjectId);
  const hasSquadParam = !!searchParams.get('squadId');
  useEffect(() => {
    const previous = lastActiveProject.current;
    lastActiveProject.current = activeProjectId;
    if (previous && activeProjectId && previous !== activeProjectId && hasSquadParam) router.replace('/squad/roster');
  }, [activeProjectId, hasSquadParam, router]);

  // Pedidos de vínculo da squad: a aba só existe para quem o servidor diz que aprova (404 ou falha = sem aba).
  const approvals = useApprovalAccess(squadId || undefined);
  const canApprove = approvals.access.canApprove;
  const requests = useSquadLinkRequests(squadId || undefined, canApprove);
  const tabParam = searchParams.get('tab');
  const tab: RosterTabId | null = resolveRosterTab(tabParam, approvals.access, approvals.loaded);

  const goToTab = useCallback(
    (next: RosterTabId) => {
      const params = new URLSearchParams(searchParams.toString());
      if (next === 'pedidos') params.set('tab', ROSTER_TAB_PEDIDOS);
      else params.delete('tab');
      const query = params.toString();
      router.replace(query ? `/squad/roster?${query}` : '/squad/roster', { scroll: false });
    },
    [router, searchParams],
  );

  // ?tab=pedidos para quem não pode (mais) aprovar: abre o Time e solta o parâmetro, sem erro.
  useEffect(() => {
    if (tabParam === ROSTER_TAB_PEDIDOS && tab === 'time') goToTab('time');
  }, [tabParam, tab, goToTab]);

  // Gestão de horas/capacidade é dado sensível de pessoas: mesma política de SQUAD_PEOPLE_ADMIN_ROLES do botão em /squad.
  // Sem isso, qualquer usuário logado que soubesse a URL editava a capacidade alheia. Quem aprova pedidos da squad
  // sem estar nessa lista (papel só na squad) fica só com a aba Pedidos.
  const approverOnly = !isPeopleAdmin && canApprove;
  useEffect(() => {
    if (!isInitializing && userProfile && !isPeopleAdmin && approvals.loaded && !canApprove) {
      const timer = setTimeout(() => router.replace('/squad'), 100);
      return () => clearTimeout(timer);
    }
  }, [isInitializing, userProfile, isPeopleAdmin, approvals.loaded, canApprove, router]);

  const { config, members, phase, reload, refreshMembers } = useRosterData(squadId);
  const { canManageTeam, permissionLoaded } = useCanManageTeam(squadId);
  const isSyncing = useSquadStore((s) => s.isSyncing);
  const syncSquad = useSquadStore((s) => s.syncSquad);
  const deleteMember = useSquadStore((s) => s.deleteMember);

  const rule = useRosterRule(squadId, config, members);
  const refresh = useCallback(() => refreshMembers(), [refreshMembers]);
  const edits = useMemberEdits({ squadId, rule: rule.rule, canManageTeam, refreshMembers: refresh });
  const person = usePersonConfig(squadId, config?.activeSprintId || undefined);
  const importInputRef = useRef<HTMLInputElement>(null);
  const importer = useRosterImport({ squadId, members, rule: rule.rule, inputRef: importInputRef });
  const addForm = useAddMember({ squadId, canManageTeam, refreshMembers: refresh });
  const exportCsv = useRosterExport({ squadId, members, rule: rule.rule, draftOf: edits.draftOf });

  // Convite: o servidor aceita admin, liderança da própria squad e liderança de roster. O que a tela sabe:
  // admin, gestão do time e "esta é a minha squad". Um 403 do servidor esconde a ação de vez.
  const isOwnSquad = !!squadId && (userProfile?.squadId || '').toLowerCase() === squadId.toLowerCase();
  const inviteEligible = permissionLoaded && (isAdminRole || canManageTeam || (isPeopleAdmin && isOwnSquad));
  const invites = useRosterInvites(squadId, inviteEligible);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [ruleOpen, setRuleOpen] = useState(false);

  const [filters, setFilters] = useState<RosterFilters>(NO_FILTERS);
  const baseHours = rule.rule.baseHours || DEFAULT_DAILY_HOURS;
  const filtered = useMemo(() => filterMembers(members, filters, baseHours), [members, filters, baseHours]);
  const kpis = useMemo(() => rosterKpis(members, rule.rule), [members, rule.rule]);

  const [removeTarget, setRemoveTarget] = useState<SquadMember | null>(null);
  const [removing, setRemoving] = useState(false);

  const confirmRemove = async () => {
    const target = removeTarget;
    if (!target || !squadId) return;
    setRemoving(true);
    try {
      await deleteMember(squadId, target.jiraAccountId);
      toast({ title: 'Integrante removido', description: `${target.displayName} foi removido da squad.` });
    } catch (err: unknown) {
      toast({ title: 'Erro ao remover', description: (err as Error)?.message || 'Tente novamente.', variant: 'destructive' });
    } finally {
      setRemoving(false);
      setRemoveTarget(null);
    }
  };

  const syncFromJira = async () => {
    const userIdentifier = userProfile?.id || userProfile?.email;
    if (!userIdentifier || !squadId) return;
    const creds = await getJiraCredentials(userIdentifier);
    if (!creds?.token) {
      toast({
        title: 'Token Jira não encontrado',
        description: 'Informe o token (PAT) nas configurações da squad antes de sincronizar.',
        variant: 'destructive',
      });
      router.push('/squad');
      return;
    }
    try {
      await syncSquad(userIdentifier, squadId);
      await refreshMembers({ email: userProfile?.email, jiraAccountId: userProfile?.jiraAccountId, name: userProfile?.name }, userIdentifier);
      toast({ title: 'Sincronizado', description: 'Integrantes carregados a partir do Jira.' });
    } catch (err: unknown) {
      toast({ title: 'Erro ao sincronizar', description: (err as Error)?.message || 'Tente novamente.', variant: 'destructive' });
    }
  };

  if (isInitializing) {
    return <PageShell documentTitle="Time da squad"><RosterSkeleton /></PageShell>;
  }

  if (userProfile && !isPeopleAdmin) {
    if (!approvals.loaded) return <PageShell documentTitle="Time da squad"><RosterSkeleton /></PageShell>;
    if (!canApprove) {
      return <PageShell documentTitle="Time da squad"><NoAccess role={userProfile.role} onBack={() => router.replace('/squad')} /></PageShell>;
    }
  }

  const requestsPanel = <SquadRequestsPanel requests={requests} access={approvals.access} currentUserId={userProfile?.id} />;

  if (approverOnly) {
    return (
      <PageShell documentTitle="Pedidos de vínculo">
        <PageHeader title="Pedidos de vínculo" breadcrumb={[{ label: 'Squad', href: '/squad' }, { label: 'Pedidos de vínculo' }]} />
        {requestsPanel}
      </PageShell>
    );
  }

  const empty = phase === 'ready' && members.length === 0;
  const noResults = phase === 'ready' && members.length > 0 && filtered.length === 0;

  return (
    <PageShell documentTitle="Time da squad">
      <RosterHeader
        canManageTeam={canManageTeam}
        canInvite={invites.canInvite}
        onExport={exportCsv}
        onImport={importer.pickFile}
        onAddMember={() => addForm.setOpen(true)}
        onInvite={() => setInviteOpen(true)}
      />
      <input ref={importInputRef} type="file" accept=".csv,.txt" hidden onChange={importer.onFileChange} data-testid="import-file" />

      {canApprove && (
        <TabBar
          tabs={[
            { id: 'time', label: 'Time' },
            { id: 'pedidos', label: 'Pedidos', count: requests.pendingCount ?? 0 },
          ]}
          value={tab ?? 'pedidos'}
          onChange={goToTab}
          label="Seções do time da squad"
          idPrefix="roster"
          className="px-0"
          tabClassName="max-sm:h-11"
        />
      )}

      {tab === null ? (
        <RosterSkeleton />
      ) : tab === 'pedidos' ? (
        <div role="tabpanel" id="roster-panel-pedidos" aria-labelledby="roster-tab-pedidos">
          {requestsPanel}
        </div>
      ) : (
        <div role={canApprove ? 'tabpanel' : undefined} id="roster-panel-time" aria-labelledby={canApprove ? 'roster-tab-time' : undefined} className="flex flex-col gap-5">
        <PendingInvites
          state={invites.state}
          invites={invites.pending}
          error={invites.error}
          onCopy={invites.copyLink}
          onRevoke={invites.revoke}
          onRetry={invites.refresh}
        />

        {cameFromOnboarding && <OnboardingBanner onSkip={() => router.push('/')} />}

        {phase === 'loading' && <RosterSkeleton />}
        {phase === 'error' && <RosterLoadError onRetry={reload} />}

        {phase === 'ready' && (
          <>
            <RosterKpis kpis={kpis} method={rule.method} />
            <RosterToolbar
              filters={filters}
              onChange={setFilters}
              shown={filtered.length}
              total={members.length}
              onOpenRule={() => setRuleOpen(true)}
            />
            <RosterTable
              members={filtered}
              rule={rule.rule}
              isAdmin={isAdminRole}
              canManageTeam={canManageTeam}
              edits={edits}
              person={person}
              sprintId={config?.activeSprintId || undefined}
              onRemove={setRemoveTarget}
              footer={
                empty ? (
                  <EmptyTeam syncing={isSyncing} canManageTeam={canManageTeam} onSync={syncFromJira} onAdd={() => addForm.setOpen(true)} />
                ) : noResults ? (
                  <NoResults onClear={() => setFilters(NO_FILTERS)} />
                ) : undefined
              }
            />
          </>
        )}
        </div>
      )}

      <RuleSheet open={ruleOpen} onOpenChange={setRuleOpen} rule={rule} jqlPlaceholder={`project = ${config?.jiraProjectKey || squadId} AND worklogDate >= -30d`} />
      <ImportDialog importer={importer} />
      <AddMemberDialog form={addForm} isAdmin={isAdminRole} />
      <InviteDialog
        open={inviteOpen}
        onOpenChange={setInviteOpen}
        squadId={squadId}
        create={invites.create}
        copyLink={invites.copyLink}
        onCreated={invites.refresh}
      />
      <ConfirmDialog
        open={!!removeTarget}
        onOpenChange={(o) => { if (!o) setRemoveTarget(null); }}
        tone="danger"
        icon={Trash2}
        title={`Remover ${removeTarget?.displayName ?? ''} da squad ${squadId}?`}
        cancelLabel="Manter"
        confirmLabel="Remover da squad"
        loading={removing}
        loadingLabel="Removendo…"
        keepOpenOnConfirm
        onConfirm={confirmRemove}
      />
    </PageShell>
  );
}

export default function RosterPage() {
  return (
    <Suspense fallback={<PageShell documentTitle="Time da squad"><RosterSkeleton /></PageShell>}>
      <RosterContent />
    </Suspense>
  );
}
