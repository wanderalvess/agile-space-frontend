'use client';

/**
 * /onboarding — reconhecer antes de perguntar.
 *
 * Quem chega aqui é quem o vínculo automático por e-mail não pegou (UserProjectResolverService, no backend).
 * O fluxo é uma decisão por tela, do mais provável para o menos:
 *   1. Sugestão   — casamento por nome contra o roster do Profields (1 clique); as outras squads pedem confirmação
 *   2. Intenção   — separa quem cadastra squads (Agile Master / People Lead) de quem participa
 *   3. Busca      — por squad, projeto ou colega (participante)
 *   4. Lista      — "Sou eu" liga a conta à linha; liderança e linhas livres pedem vínculo (admin aprova)
 *   5. Papel      — só para quem não está na lista; 403 leva ao convite ou ao pedido de vínculo
 *   6. Criar      — 1 campo (só AM/PL; o backend recusa os demais)
 *   7. Jira       — importação em lote, com prévia por squad, e a tela de resultado
 * Em qualquer passo: "Tenho um link de convite" (rodapé).
 *
 * Este componente só guarda o passo e os dados que atravessam telas; cada tela mora em seu arquivo.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/context/AuthContext';
import { useUserContext } from '@/context/UserContext';
import { useSquadSearch } from '@/hooks/useSquadSearch';
import { useMyLinkRequests } from '@/hooks/useMyLinkRequests';
import { onboardingService, type OnboardingCandidate, type OnboardingRoster } from '@/services/onboardingService';
import { JiraProfieldsImport, type JiraImportResult } from '@/components/jira/JiraProfieldsImport';
import { httpStatusOf } from '@/lib/api-error';
import { firstNameOf, isAccessRefused, MSG_CLAIM_REFUSED, MSG_CREATE_REFUSED, MSG_JOIN_REFUSED, parseInviteToken, refusalMessage } from '@/lib/onboarding';
import type { ImportIssue } from '@/lib/import-result';
import { HALO } from '@/components/home/home-ui';
import { cn } from '@/lib/utils';
import { CreateSquadStep } from './CreateSquadStep';
import { ImportResultStep } from './ImportResultStep';
import { IntentStep } from './IntentStep';
import { InviteFooter } from './InviteFooter';
import { MyRequests } from './MyRequests';
import { OnboardingRail, type OnboardingStep } from './OnboardingRail';
import { RequestLinkStep, type LinkRequestTarget } from './RequestLinkStep';
import { RoleStep } from './RoleStep';
import { RosterStep } from './RosterStep';
import { SearchStep } from './SearchStep';
import { SuggestionStep } from './SuggestionStep';
import { Spinner, StepCard, StepHeading } from './ui';

/** Destino de todo caminho concluído: a squad por dentro, sem tarefa no meio. */
export const DONE_ROUTE = '/squad?tab=resumo';

export function OnboardingFlow() {
  const router = useRouter();
  const { toast } = useToast();
  const { createProject, joinProject, claimRosterMember } = useAuth();
  const { mustOnboard, isInitializing, userProfile, updateProfile } = useUserContext();

  const [step, setStep] = useState<OnboardingStep>('suggestion');
  /** Durante a prévia da importação a tela precisa de largura: some a trilha e o conteúdo ocupa tudo. */
  const [wideImport, setWideImport] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);

  // Passo 1 — reconhecimento
  const [suggestions, setSuggestions] = useState<OnboardingRoster[]>([]);
  const [loadingSuggestions, setLoadingSuggestions] = useState(true);
  const [otherPick, setOtherPick] = useState<OnboardingRoster | null>(null);

  // Passos 3 e 4 — busca e lista
  const search = useSquadSearch(step === 'search');
  const [roster, setRoster] = useState<OnboardingRoster | null>(null);

  // Passo 5 — papel
  const [accessRefused, setAccessRefused] = useState(false);

  // Pedido de vínculo
  const [requestTarget, setRequestTarget] = useState<LinkRequestTarget | null>(null);
  const [requestBack, setRequestBack] = useState<OnboardingStep>('roster');
  const { requests, reload: reloadRequests } = useMyLinkRequests();

  // Importação do Jira
  const [importResult, setImportResult] = useState<JiraImportResult | null>(null);
  const [importSeed, setImportSeed] = useState({ id: 0, key: '' });

  // Convite colado à mão
  const [inviteOpen, setInviteOpen] = useState(false);

  // Guarda de acesso: com squad já definida, não fica no onboarding. Vale só na chegada — concluir um passo
  // (entrar, criar, importar) também tira o mustOnboard, e isso não pode jogar a pessoa na home no meio do fluxo.
  const guardedRef = useRef(false);
  useEffect(() => {
    if (isInitializing || guardedRef.current) return;
    guardedRef.current = true;
    if (!mustOnboard) router.replace('/');
  }, [isInitializing, mustOnboard, router]);

  useEffect(() => {
    onboardingService
      .suggestions()
      .then((found) => {
        setSuggestions(found);
        if (found.length === 0) setStep('intent');
      })
      .catch(() => {
        setSuggestions([]);
        setStep('intent');
      })
      .finally(() => setLoadingSuggestions(false));
  }, []);

  // Cada passo novo começa no topo da página (o título recebe o foco).
  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [step]);

  const firstSuggestion = suggestions[0];
  const firstCandidate = firstSuggestion?.members?.[0];

  const finish = useCallback(
    (title: string, description: string, route: string = DONE_ROUTE) => {
      toast({ title, description });
      router.push(route);
    },
    [router, toast],
  );

  /** "Sou eu" — liga a conta à linha da lista e entra na squad com o papel do Jira. */
  const handleClaim = useCallback(
    async (candidate: OnboardingCandidate, projectId: string) => {
      setBusy(candidate.memberId);
      try {
        await claimRosterMember(candidate.memberId);
        finish(`Pronto, você está na ${projectId}`, `Entrou como ${candidate.roleName}.`);
      } catch (err: any) {
        toast({
          title: 'Não foi possível concluir o vínculo',
          description: refusalMessage(httpStatusOf(err), err?.message, MSG_CLAIM_REFUSED),
          variant: 'destructive',
        });
      } finally {
        setBusy(null);
      }
    },
    [claimRosterMember, finish, toast],
  );

  const openRoster = useCallback(
    async (projectId: string) => {
      setBusy(projectId);
      try {
        const full = await onboardingService.roster(projectId);
        setRoster(full);
        setAccessRefused(false);
        setStep('roster');
      } catch (err: any) {
        toast({ title: 'Não consegui abrir a squad', description: err.message, variant: 'destructive' });
      } finally {
        setBusy(null);
      }
    },
    [toast],
  );

  const handleJoinAs = useCallback(
    async (roleName: string) => {
      if (!roster) return;
      setBusy(roleName);
      setAccessRefused(false);
      try {
        await joinProject(roster.projectId, roleName);
        await updateProfile({ squadId: roster.projectId });
        finish(`Você entrou em ${roster.projectId}`, `Como ${roleName}. A squad pode ajustar isso depois.`);
      } catch (err: any) {
        const status = httpStatusOf(err);
        if (isAccessRefused(status)) setAccessRefused(true);
        toast({
          title: 'Não foi possível entrar na squad',
          description: refusalMessage(status, err?.message, MSG_JOIN_REFUSED),
          variant: 'destructive',
        });
      } finally {
        setBusy(null);
      }
    },
    [roster, joinProject, updateProfile, finish, toast],
  );

  const handleCreate = useCallback(
    async ({ name, key }: { name: string; key: string }) => {
      setBusy('create');
      try {
        await createProject({ id: key, name });
        await updateProfile({ squadId: key });
        try {
          localStorage.setItem(`agileSpace_newSquad_${key}`, '1');
        } catch {
          /* sem storage: só não mostra o aviso */
        }
        // Squad recém-criada não tem dados do Jira: o painel estaria vazio. A home, com as ferramentas
        // (Poker, Retro...), é o destino útil.
        finish('Squad criada', `${name} (${key}). Você entrou com o seu papel; as demais pessoas entram pelo Jira ou por convite.`, '/');
      } catch (err: any) {
        toast({
          title: 'Não foi possível criar a squad',
          description: refusalMessage(httpStatusOf(err), err?.message, MSG_CREATE_REFUSED),
          variant: 'destructive',
        });
      } finally {
        setBusy(null);
      }
    },
    [createProject, updateProfile, finish, toast],
  );

  const handleInvite = useCallback(
    (raw: string) => {
      const token = parseInviteToken(raw);
      if (!token) {
        toast({ title: 'Link de convite inválido', description: 'Cole o link completo ou só o código do convite.', variant: 'destructive' });
        return;
      }
      router.push(`/invite/${token}`);
    },
    [router, toast],
  );

  const openRequest = useCallback((target: LinkRequestTarget, back: OnboardingStep) => {
    setRequestTarget(target);
    setRequestBack(back);
    setStep('request');
  }, []);

  const requestForCandidate = useCallback(
    (m: OnboardingCandidate) => {
      if (!roster) return;
      openRequest(
        { projectKey: roster.projectId, member: { memberId: m.memberId, displayName: m.displayName, roleName: m.roleName, emailHint: m.emailHint, avatarUrl: m.avatarUrl } },
        'roster',
      );
    },
    [roster, openRequest],
  );

  const handleImported = useCallback(
    (result: JiraImportResult) => {
      const { importedProjects, project, myRoleName, leadsPeople } = result;
      toast(
        importedProjects.length > 1
          ? {
              title: `${importedProjects.length} squads importadas`,
              description: `${importedProjects.map((p) => p.id).join(', ')}. Você começa em ${project.id} e troca de squad pelo seletor.`,
            }
          : { title: `${project.id} importada`, description: leadsPeople ? `Você entrou como ${myRoleName}.` : 'A squad e os papéis vieram do Jira junto.' },
      );
      setImportResult(result);
      setStep('result');
    },
    [toast],
  );

  const handleIssueAction = useCallback(
    (issue: ImportIssue) => {
      if (issue.action.kind === 'invite') {
        router.push('/squad/roster');
      } else if (issue.action.kind === 'import') {
        setImportSeed((s) => ({ id: s.id + 1, key: issue.projectKey ?? '' }));
        setStep('jira');
      } else if (issue.projectKey) {
        const squad = importResult?.importedProjects.find((p) => p.id === issue.projectKey);
        const member = issue.memberId ? squad?.members.find((m) => m.id === issue.memberId) : undefined;
        openRequest(
          {
            projectKey: issue.projectKey,
            member: member?.id ? { memberId: member.id, displayName: member.displayName, roleName: member.roleName, avatarUrl: member.avatarUrl } : undefined,
          },
          'result',
        );
      }
    },
    [router, importResult, openRequest],
  );

  if (isInitializing || (loadingSuggestions && step === 'suggestion')) {
    return (
      <div className="flex min-h-[60dvh] flex-1 items-center justify-center p-6">
        <div role="status" className="flex items-center gap-3 text-sm font-medium text-muted-foreground">
          <Spinner className="h-5 w-5 text-primary [.theme-totvs:not(.dark)_&]:text-foreground" /> Procurando você nas squads…
        </div>
      </div>
    );
  }

  const showRequests = step !== 'result' && step !== 'request' && !wideImport;

  return (
    <div className="relative flex w-full flex-1 justify-center overflow-x-clip bg-background px-4 pb-10 pt-6 text-foreground sm:px-8 sm:pt-8">
      <div aria-hidden="true" className={cn('pointer-events-none absolute inset-x-0 top-0 h-[420px]', HALO)} />

      <div className={cn('relative z-10 grid w-full gap-x-12', wideImport ? 'max-w-[1400px] grid-cols-1' : 'max-w-6xl grid-cols-1 items-start lg:grid-cols-[340px_minmax(0,1fr)]')}>
        {!wideImport && <OnboardingRail step={step} />}

        <div className="flex min-w-0 flex-col items-center gap-6 lg:min-h-[calc(100dvh-8rem)]">
          {step === 'suggestion' && firstSuggestion && firstCandidate && (
            <SuggestionStep
              variant="first"
              firstName={firstNameOf(userProfile?.name)}
              suggestion={firstSuggestion}
              candidate={firstCandidate}
              others={suggestions.slice(1)}
              busyMemberId={busy}
              onConfirm={handleClaim}
              onReject={() => setStep('intent')}
              onPickOther={(s) => {
                if (!s.members[0]) return;
                setOtherPick(s);
                setStep('confirmOther');
              }}
            />
          )}

          {step === 'confirmOther' && otherPick?.members[0] && (
            <SuggestionStep
              variant="other"
              firstName=""
              suggestion={otherPick}
              candidate={otherPick.members[0]}
              busyMemberId={busy}
              onConfirm={handleClaim}
              onReject={() => setStep('suggestion')}
            />
          )}

          {step === 'intent' && (
            <IntentStep canGoBack={suggestions.length > 0} onLead={() => setStep('jira')} onParticipate={() => setStep('search')} onBack={() => setStep('suggestion')} />
          )}

          {step === 'search' && (
            <SearchStep
              query={search.query}
              onQueryChange={search.setQuery}
              phase={search.phase}
              results={search.results}
              searchedText={search.searchedText}
              openingId={busy}
              onOpen={openRoster}
              onRetry={search.retry}
              onLead={() => setStep('jira')}
              onBack={() => setStep('intent')}
            />
          )}

          {step === 'roster' && roster && (
            <RosterStep
              roster={roster}
              busyMemberId={busy}
              onClaim={handleClaim}
              onRequestLink={requestForCandidate}
              onNotListed={() => setStep('role')}
              onBack={() => setStep('search')}
            />
          )}

          {step === 'role' && roster && (
            <RoleStep
              projectId={roster.projectId}
              joiningRole={busy}
              refused={accessRefused}
              onPick={handleJoinAs}
              onOpenInvite={() => setInviteOpen(true)}
              onRequestLink={() => openRequest({ projectKey: roster.projectId }, 'role')}
              onBack={() => setStep('roster')}
            />
          )}

          {step === 'request' && requestTarget && (
            <RequestLinkStep
              target={requestTarget}
              defaultEmail={userProfile?.email || ''}
              onBack={() => setStep(requestBack)}
              onSent={() => void reloadRequests()}
            />
          )}

          {step === 'create' && (
            <CreateSquadStep
              busy={busy === 'create'}
              onSubmit={handleCreate}
              onEmptyName={() => toast({ title: 'Dê um nome pra squad', variant: 'destructive' })}
              onImport={() => setStep('jira')}
              onBack={() => setStep('intent')}
            />
          )}

          {step === 'jira' && (
            <StepCard className={wideImport ? 'p-5 sm:p-7' : undefined}>
              {!wideImport && (
                <StepHeading
                  pill="Agile Master / People Lead"
                  title="Importe suas squads do Jira"
                  subtitle="Cole as chaves das squads que você cuida. Cada uma traz projeto, pessoas e papéis do Profields, com prévia antes de gravar."
                />
              )}
              <JiraProfieldsImport
                key={importSeed.id}
                initialProjectKey={importSeed.key}
                onPreviewChange={setWideImport}
                onImported={handleImported}
                onBack={() => setStep('intent')}
                skipHint="Sem token? Dá pra criar uma squad na mão agora e importar do Jira depois, sem perder nada."
                skipAction={{ label: 'Criar uma squad sem o Jira', onClick: () => setStep('create') }}
              />
            </StepCard>
          )}

          {step === 'result' && importResult && <ImportResultStep result={importResult} onGoToPanel={() => router.push(DONE_ROUTE)} onIssueAction={handleIssueAction} />}

          {showRequests && <MyRequests requests={requests} />}

          <InviteFooter open={inviteOpen} onOpenChange={setInviteOpen} onSubmit={handleInvite} />
        </div>
      </div>
    </div>
  );
}
