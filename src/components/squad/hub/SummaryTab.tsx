'use client';

/**
 * Aba Resumo do hub da squad (era a página /painel + a "Visão geral"): a leitura de 3 segundos do que a squad
 * está entregando agora, com link para o detalhe nas outras abas.
 *
 * Todo número vem de dado real (useSquadDashboardData -> rollup + issues + members). Sem mock: quando a squad
 * ainda não sincronizou, a tela diz isso.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { CircleAlert, Clock, RefreshCw, Users } from 'lucide-react';
import { LinkedTeamWelcome } from '@/components/home/LinkedTeamWelcome';
import { Notice } from '@/components/home/Notice';
import { EmptyState, LoadingSkeleton, PageColumns } from '@/components/page';
import { ModalButton } from '@/components/room-kit';
import { JiraProfieldsImport } from '@/components/jira/JiraProfieldsImport';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { invalidateTeamAvatars, useTeamAvatars } from '@/hooks/useTeamAvatars';
import type { SquadDashboardData } from '@/hooks/useSquadDashboardData';
import { buildAttention, boardColumns, byUpdatedDesc, isCapacityMissing, sprintStats } from '@/lib/squad-summary';
import { latestSyncAt, mergeTeamPeople } from '@/lib/team-people';
import { cn } from '@/lib/utils';
import { NextCeremonyCard } from './NextCeremonyCard';
import { SprintBoard } from './SprintBoard';
import { SprintCard } from './SprintCard';
import { AttentionSection, ExploreSection, MovementsSection, TeamSection } from './SummaryAside';
import { SummaryWelcome, type JiraSyncState } from './SummaryWelcome';

const capacityKey = (squadId: string) => `agileSpace_painel_capacityNotice_${squadId}`;

export interface SummaryTabProps {
  data: SquadDashboardData;
  /** Chave de quem lê (e-mail ou id): a agenda do Google é pessoal. */
  userKey: string;
  userEmail?: string;
  userName?: string;
  userRole?: string;
  sync: { syncState: JiraSyncState; syncError: string | null; runJiraSync: () => Promise<void> };
  /** Gerencia o time (mesma regra do roster): vê "Configurar" no aviso de capacidade. */
  canManageTeam: boolean;
  /** Pode reimportar o time do Jira (o servidor só aceita liderança do projeto/admin): é quem vê "Importar do Jira". */
  canImportJira: boolean;
  /** Pode abrir a tela de Pessoas (SQUAD_PEOPLE_ADMIN_ROLES). */
  canOpenPeople: boolean;
  /** Sincronização do cabeçalho em andamento ou sprint histórica em tela: some o convite para sincronizar. */
  canSyncNow: boolean;
  onSyncNow: () => void;
}

export function SummaryTab({
  data,
  userKey,
  userEmail,
  userName,
  userRole,
  sync,
  canManageTeam,
  canImportJira,
  canOpenPeople,
  canSyncNow,
  onSyncNow,
}: SummaryTabProps) {
  const router = useRouter();
  const { toast } = useToast();
  const { squadId, hasSquad, loading, error, rollup, issues, members, myIssues, sprintName, refresh } = data;
  const { avatarFor, members: rosterMembers } = useTeamAvatars(squadId);
  // Uma única contagem de pessoas: Jira + cadastro do projeto, sem repetir ninguém (ver lib/team-people).
  const people = useMemo(() => mergeTeamPeople(members, rosterMembers), [members, rosterMembers]);

  const [isRefreshing, setIsRefreshing] = useState(false);
  const [jiraImportOpen, setJiraImportOpen] = useState(false);
  const [dismissedError, setDismissedError] = useState<string | null>(null);
  const [capacityDismissed, setCapacityDismissed] = useState(true);

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    try {
      await refresh();
    } finally {
      setIsRefreshing(false);
    }
  }, [refresh]);

  const stats = useMemo(() => sprintStats(rollup, issues), [rollup, issues]);
  const myKeys = useMemo(() => new Set(myIssues.map((i) => i.key)), [myIssues]);
  const columns = useMemo(() => boardColumns(issues), [issues]);
  const movements = useMemo(() => [...issues].sort(byUpdatedDesc).slice(0, 5), [issues]);
  const lastSync = useMemo(() => latestSyncAt(...issues.map((i) => i.syncedAt), rollup?.computedAt), [issues, rollup]);

  const myRole = useMemo(() => {
    const email = (userEmail || '').toLowerCase().trim();
    const name = (userName || '').toLowerCase().trim();
    const me = members.find(
      (m) => (!!email && (m.email || '').toLowerCase().trim() === email) || (!!name && (m.displayName || '').toLowerCase().trim() === name)
    );
    return me?.role || userRole || '';
  }, [members, userEmail, userName, userRole]);

  const hasData = issues.length > 0 || !!rollup;

  // Capacidade: ninguém do time tem hora/dia definida (nem manual, nem calculada) — a sprint até aparece,
  // mas a capacidade sai torta. É um aviso dispensável de propósito: não é tarefa obrigatória de onboarding.
  const capacityMissing = useMemo(() => isCapacityMissing(members), [members]);

  useEffect(() => {
    if (!squadId) return;
    try {
      setCapacityDismissed(localStorage.getItem(capacityKey(squadId)) === '1');
    } catch {
      setCapacityDismissed(false);
    }
  }, [squadId]);

  const dismissCapacity = useCallback(() => {
    setCapacityDismissed(true);
    try {
      localStorage.setItem(capacityKey(squadId), '1');
    } catch {
      /* modo privado / storage bloqueado: some só nesta sessão */
    }
  }, [squadId]);

  const attention = useMemo(
    () =>
      buildAttention({
        overdue: rollup?.overdueIssues ?? 0,
        stale: rollup?.staleIssues ?? 0,
        hasRollup: !!rollup,
        peopleCount: people.length,
        canSync: canSyncNow,
        canOpenPeople,
      }),
    [rollup, people.length, canSyncNow, canOpenPeople]
  );

  if (!hasSquad) {
    return (
      <EmptyState
        title="Você ainda não está em uma squad"
        description="Entre em um time para ver sprint, board e movimentos aqui."
        actions={
          <ModalButton variant="primary" onClick={() => router.push('/onboarding')}>
            Escolher meu time
          </ModalButton>
        }
      />
    );
  }

  if (loading) return <LoadingSkeleton variant="cards" rows={3} label="Carregando o resumo da squad" />;

  const staleDataVisible = !!error && error !== dismissedError;

  return (
    <div className="flex flex-col gap-5">
      <LinkedTeamWelcome showPainelLink={false} />

      <div className="flex flex-wrap items-center justify-end gap-2">
        {canImportJira && (
          <ModalButton
            onClick={() => setJiraImportOpen(true)}
            disabled={!hasSquad}
            className="h-9 gap-2 px-3 text-[13px] max-sm:min-h-11"
            title="Importar ou atualizar pessoas, cargos e fotos a partir do Jira"
          >
            <Users className="h-4 w-4" strokeWidth={1.5} aria-hidden="true" /> Importar do Jira
          </ModalButton>
        )}
        <ModalButton
          onClick={handleRefresh}
          disabled={isRefreshing || !hasSquad}
          className="h-9 gap-2 px-3 text-[13px] max-sm:min-h-11"
          title="Recarregar os dados da squad"
        >
          <RefreshCw className={cn('h-4 w-4', isRefreshing && 'animate-spin motion-reduce:animate-none')} strokeWidth={1.5} aria-hidden="true" /> Atualizar
        </ModalButton>
      </div>

      {!hasData ? (
        <SummaryWelcome
          squadId={squadId}
          syncState={sync.syncState}
          syncError={sync.syncError ?? error}
          myRole={myRole}
          squadMembers={members}
          onRetry={sync.runJiraSync}
          onConnectJira={() => setJiraImportOpen(true)}
        />
      ) : (
        <>
          {staleDataVisible && (
            <Notice
              compact
              variant="important"
              icon={CircleAlert}
              title="Alguns dados podem estar defasados:"
              text={error ?? undefined}
              dismissLabel="Dispensar aviso de dados defasados"
              onDismiss={() => setDismissedError(error)}
            />
          )}

          {capacityMissing && !capacityDismissed && (
            <Notice
              compact
              variant="important"
              icon={Clock}
              title="A capacidade da sprint fica mais precisa com as horas do time."
              text={canManageTeam ? 'Leva 1 minuto e não precisa ser agora.' : 'Quem gerencia o time pode preencher.'}
              action={canManageTeam ? { label: 'Configurar', href: '/squad/roster' } : undefined}
              dismissLabel="Dispensar aviso de capacidade"
              onDismiss={dismissCapacity}
            />
          )}

          <PageColumns
            asideWidth={400}
            aside={
              <>
                <NextCeremonyCard squadId={squadId} userKey={userKey} />
                <AttentionSection items={attention} onSync={onSyncNow} />
                <TeamSection people={people} myRole={myRole} avatarFor={avatarFor} canOpenPeople={canOpenPeople} />
                <MovementsSection items={movements} avatarFor={avatarFor} />
                <ExploreSection />
              </>
            }
          >
            <SprintCard sprintName={sprintName} rollup={rollup} stats={stats} lastSync={lastSync} />
            <SprintBoard columns={columns} myKeys={myKeys} />
          </PageColumns>
        </>
      )}

      {/* Importação do Jira: disponível sempre, para refazer a prévia (nova foto, pessoas, cargos). */}
      <Dialog open={jiraImportOpen} onOpenChange={setJiraImportOpen}>
        <DialogContent className="max-h-[90dvh] max-w-4xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Importar a {squadId} do Jira</DialogTitle>
            <DialogDescription>Traz projeto, pessoas e papéis do Profields. Nada é gravado até você conferir a prévia.</DialogDescription>
          </DialogHeader>
          <JiraProfieldsImport
            initialProjectKey={squadId}
            onImported={({ project }) => {
              setJiraImportOpen(false);
              toast({ title: `${project.id} importado`, description: 'Pessoas e papéis vieram do Jira.' });
              invalidateTeamAvatars(project.id);
              void sync.runJiraSync();
            }}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}
