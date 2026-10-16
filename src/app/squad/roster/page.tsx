'use client';

import React, { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Trash2 } from 'lucide-react';

import { useUserContext } from '@/context/UserContext';
import { getJiraCredentials } from '@/hooks/useJiraSettings';
import { useSquadStore } from '@/store/useSquadStore';
import { useToast } from '@/hooks/use-toast';
import type { SquadMember } from '@/lib/types';
import { SQUAD_PEOPLE_ADMIN_ROLES } from '@/lib/types';
import { DEFAULT_DAILY_HOURS } from '@/lib/roster/constants';
import { filterMembers, rosterKpis, type RosterFilters } from '@/lib/roster/calc';

import { ConfirmDialog } from '@/components/room-kit';
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

  // Gestão de horas/capacidade é dado sensível de pessoas: mesma política de SQUAD_PEOPLE_ADMIN_ROLES do botão em /squad.
  // Sem isso, qualquer usuário logado que soubesse a URL editava a capacidade alheia.
  useEffect(() => {
    if (!isInitializing && userProfile && !isPeopleAdmin) {
      const timer = setTimeout(() => router.replace('/squad'), 100);
      return () => clearTimeout(timer);
    }
  }, [isInitializing, userProfile, isPeopleAdmin, router]);

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

  // Convite: o servidor aceita admin/LEAD, liderança da própria squad e liderança de roster. O que a tela sabe:
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
    return <main className="mx-auto max-w-[1360px] px-4 py-7 sm:px-8"><RosterSkeleton /></main>;
  }

  if (userProfile && !isPeopleAdmin) {
    return <main className="mx-auto max-w-[1360px] px-4 sm:px-8"><NoAccess role={userProfile.role} onBack={() => router.replace('/squad')} /></main>;
  }

  const empty = phase === 'ready' && members.length === 0;
  const noResults = phase === 'ready' && members.length > 0 && filtered.length === 0;

  return (
    <main className="mx-auto flex w-full max-w-[1360px] flex-col gap-5 px-4 pb-14 pt-6 sm:px-8 sm:pt-7">
      <RosterHeader
        squadId={squadId}
        canManageTeam={canManageTeam}
        canInvite={invites.canInvite}
        onBack={() => router.push('/squad')}
        onExport={exportCsv}
        onImport={importer.pickFile}
        onAddMember={() => addForm.setOpen(true)}
        onInvite={() => setInviteOpen(true)}
      />
      <input ref={importInputRef} type="file" accept=".csv,.txt" hidden onChange={importer.onFileChange} data-testid="import-file" />

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
    </main>
  );
}

export default function RosterPage() {
  return (
    <Suspense fallback={<main className="mx-auto max-w-[1360px] px-4 py-7 sm:px-8"><RosterSkeleton /></main>}>
      <RosterContent />
    </Suspense>
  );
}
