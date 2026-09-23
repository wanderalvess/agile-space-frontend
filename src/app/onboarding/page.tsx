'use client';

/**
 * /onboarding — reconhecer antes de perguntar.
 *
 * A versão anterior abria com três formulários lado a lado (criar / entrar /
 * importar do Jira), 12 campos e um aviso explicando que o e-mail do Jira podia
 * ser diferente do login. Ou seja: pedia pra pessoa digitar o que o sistema já
 * sabia, e pedia PAT do Jira na primeira tela.
 *
 * Aqui o fluxo é uma decisão por tela, do mais provável pro menos:
 *   1. "É você?"        — casamento por nome contra o roster do Profields (1 clique)
 *   2. "Qual seu time?" — busca por time OU por pessoa
 *   3. Roster           — a pessoa se marca na lista ("sou eu" = claim)
 *   4. Papel            — só pra quem não está na lista, em 3 opções de linguagem comum
 *   5. Criar time       — 1 campo
 *   6. Jira             — caminho avançado, com o PAT pedido só na hora certa
 *
 * Quem chega aqui é justamente quem o vínculo automático por e-mail não pegou
 * (ver UserProjectResolverService no backend) — o claim é o que resolve isso.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Rocket,
  Users,
  RefreshCw,
  Loader2,
  ArrowRight,
  ArrowLeft,
  Search,
  Crown,
  CheckCircle2,
  Code2,
  PenTool,
  Eye,
  Link as LinkIcon,
  Sparkles,
  ExternalLink,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { useDebounce } from '@/hooks/use-debounce';
import { useAuth } from '@/context/AuthContext';
import { useUserContext } from '@/context/UserContext';
import { projectService, type ProjectDetail, type ProjectMemberRoleItem } from '@/services/projectService';
import { onboardingService, type OnboardingCandidate, type OnboardingRoster } from '@/services/onboardingService';
import { SQUAD_PEOPLE_ADMIN_ROLES } from '@/lib/types';
import { useJiraSettings } from '@/hooks/useJiraSettings';
import { cn } from '@/lib/utils';

type Step = 'suggestion' | 'search' | 'roster' | 'role' | 'create' | 'jira';

/** Destino de todo caminho concluído: o time por dentro, sem tarefa no meio. */
const DONE_ROUTE = '/painel';

function slugify(name: string) {
  return name
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .slice(0, 12);
}

function initials(name?: string) {
  const clean = (name || '').trim();
  if (!clean) return '??';
  const parts = clean.split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

/**
 * Papéis em linguagem de gente. O valor é um papel de CONTRIBUTOR_ROLES — os de
 * liderança não estão aqui de propósito: o backend recusa autodeclaração deles
 * (JiraProfieldsService.SELF_SERVICE_JOIN_ROLE_NAMES).
 */
const ROLE_CHOICES = [
  {
    role: 'Developer',
    icon: Code2,
    title: 'Eu construo',
    description: 'Dev, QA, mobile, dados. Pega card, estima, entrega.',
    hint: 'Entra no poker, na daily e no board',
  },
  {
    role: 'Designer',
    icon: PenTool,
    title: 'Eu desenho',
    description: 'Design, UX, pesquisa. Trabalha com o time, não no backlog.',
    hint: 'Entra no brainstorming e no showcase',
  },
  {
    role: 'Stakeholder / Observador',
    icon: Eye,
    title: 'Eu acompanho',
    description: 'Stakeholder, SME, gestão. Quer ver o andamento, sem ruído.',
    hint: 'Vê o painel e os showcases',
  },
] as const;

export default function OnboardingPage() {
  const router = useRouter();
  const { toast } = useToast();
  const { createProject, joinProject, claimRosterMember, switchProject } = useAuth();
  const { mustOnboard, isInitializing, userProfile, updateProfile, setIsPublicExploration } = useUserContext();
  const { settings: jiraSettings, saveSettings: saveJiraSettings } = useJiraSettings();

  const [step, setStep] = useState<Step>('suggestion');
  const [busy, setBusy] = useState<string | null>(null);
  const doneRef = useRef(false);

  // Passo 1 — reconhecimento
  const [suggestions, setSuggestions] = useState<OnboardingRoster[]>([]);
  const [loadingSuggestions, setLoadingSuggestions] = useState(true);

  // Passo 2 — busca
  const [query, setQuery] = useState('');
  const debouncedQuery = useDebounce(query, 350);
  const [results, setResults] = useState<OnboardingRoster[]>([]);
  const [searching, setSearching] = useState(false);

  // Passo 3 — roster do time escolhido
  const [roster, setRoster] = useState<OnboardingRoster | null>(null);

  // Passo 5 — criar time
  const [projectName, setProjectName] = useState('');
  const [projectKey, setProjectKey] = useState('');
  const [keyEdited, setKeyEdited] = useState(false);

  // Passo 6 — Jira
  const [jiraDomain, setJiraDomain] = useState('');
  const [jiraKey, setJiraKey] = useState('');
  const [jiraToken, setJiraToken] = useState('');
  const [syncedProject, setSyncedProject] = useState<ProjectDetail | null>(null);

  // Convite colado à mão
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteValue, setInviteValue] = useState('');

  // Guarda de acesso: com projeto/squad já definidos, não fica no onboarding.
  // O doneRef existe porque concluir um passo TAMBÉM tira o mustOnboard — sem ele,
  // essa guarda correria com o push pro painel e jogaria a pessoa na home.
  useEffect(() => {
    if (!isInitializing && !mustOnboard && !doneRef.current) {
      router.replace('/');
    }
  }, [isInitializing, mustOnboard, router]);

  useEffect(() => {
    onboardingService.suggestions()
      .then(found => {
        setSuggestions(found);
        if (found.length === 0) setStep('search');
      })
      .catch(() => {
        setSuggestions([]);
        setStep('search');
      })
      .finally(() => setLoadingSuggestions(false));
  }, []);

  useEffect(() => {
    if (jiraSettings) {
      if (jiraSettings.domain && !jiraDomain) setJiraDomain(jiraSettings.domain);
      if (jiraSettings.token && !jiraToken) setJiraToken(jiraSettings.token);
    }
  }, [jiraSettings]);

  useEffect(() => {
    if (step !== 'search') return;
    const q = debouncedQuery.trim();
    if (q.length < 2) {
      setResults([]);
      return;
    }
    setSearching(true);
    onboardingService.search(q)
      .then(setResults)
      .catch(() => setResults([]))
      .finally(() => setSearching(false));
  }, [debouncedQuery, step]);

  const firstSuggestion = suggestions[0];
  const firstCandidate = firstSuggestion?.members?.[0];

  const finish = useCallback((title: string, description: string) => {
    doneRef.current = true;
    toast({ title, description });
    router.push(DONE_ROUTE);
  }, [router, toast]);

  /** "Sou eu" — liga a conta à linha do roster e entra no time com o papel do Jira. */
  const handleClaim = useCallback(async (candidate: OnboardingCandidate, projectId: string) => {
    setBusy(candidate.memberId);
    try {
      await claimRosterMember(candidate.memberId);
      finish('Pronto, você está na ' + projectId, `Entrou como ${candidate.roleName}.`);
    } catch (err: any) {
      toast({ title: 'Não foi possível concluir o vínculo', description: err.message, variant: 'destructive' });
    } finally {
      setBusy(null);
    }
  }, [claimRosterMember, finish, toast]);

  const openRoster = useCallback(async (projectId: string) => {
    setBusy(projectId);
    try {
      const full = await onboardingService.roster(projectId);
      setRoster(full);
      setStep('roster');
    } catch (err: any) {
      toast({ title: 'Não consegui abrir o time', description: err.message, variant: 'destructive' });
    } finally {
      setBusy(null);
    }
  }, [toast]);

  const handleJoinAs = useCallback(async (roleName: string) => {
    if (!roster) return;
    setBusy(roleName);
    try {
      await joinProject(roster.projectId, roleName);
      await updateProfile({ squadId: roster.projectId });
      finish(`Você entrou em ${roster.projectId}`, `Como ${roleName}. Seu time pode ajustar isso depois.`);
    } catch (err: any) {
      toast({ title: 'Não foi possível entrar no time', description: err.message, variant: 'destructive' });
    } finally {
      setBusy(null);
    }
  }, [roster, joinProject, updateProfile, finish, toast]);

  const handleCreate = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    const name = projectName.trim();
    const key = (projectKey || slugify(name)).trim();
    if (!name || !key) {
      toast({ title: 'Dê um nome pro time', variant: 'destructive' });
      return;
    }
    setBusy('create');
    try {
      await createProject({ id: key, name });
      await updateProfile({ squadId: key });
      finish('Time criado', `${name} (${key}). Você é o Agile Master e pode passar isso pra outra pessoa depois.`);
    } catch (err: any) {
      toast({ title: 'Não foi possível criar o time', description: err.message, variant: 'destructive' });
    } finally {
      setBusy(null);
    }
  }, [projectName, projectKey, createProject, updateProfile, finish, toast]);

  const handleJiraPreview = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (!jiraKey.trim() || !jiraToken.trim()) {
      toast({ title: 'Informe a chave do projeto e seu token do Jira', variant: 'destructive' });
      return;
    }
    setBusy('jira');
    try {
      const preview = await projectService.previewProjectProfields(
        jiraKey.trim().toUpperCase(), jiraDomain.trim(), jiraToken.trim()
      );
      setSyncedProject(preview);
      toast({ title: 'Dados encontrados no Jira', description: 'Nada foi gravado ainda. Confira e confirme pra importar.' });
    } catch (err: any) {
      toast({ title: 'Falha na sincronização', description: err.message, variant: 'destructive' });
    } finally {
      setBusy(null);
    }
  }, [jiraDomain, jiraKey, jiraToken, toast]);

  const myEmail = (userProfile?.email || '').toLowerCase().trim();
  const isMe = (m: ProjectMemberRoleItem) =>
    (!!userProfile?.id && m.userId === userProfile.id) ||
    (!!myEmail && (m.email || '').toLowerCase().trim() === myEmail);
  const myMembership = syncedProject?.members.find(isMe);

  const handleConfirmSynced = useCallback(async () => {
    if (!syncedProject) return;
    setBusy('confirm');
    try {
      await projectService.syncProjectProfields(syncedProject.id, jiraDomain.trim(), jiraToken.trim());
      await switchProject(syncedProject.id);
      if (jiraToken.trim()) {
        await saveJiraSettings({ domain: jiraDomain.trim(), token: jiraToken.trim() });
      }
      const leadsPeople = !!myMembership && (SQUAD_PEOPLE_ADMIN_ROLES as string[]).includes(myMembership.roleName);
      finish(
        `${syncedProject.id} importado`,
        leadsPeople
          ? `Você entrou como ${myMembership!.roleName}.`
          : 'O time e os papéis vieram do Jira junto.'
      );
    } catch (err: any) {
      toast({ title: 'Não foi possível importar', description: err.message, variant: 'destructive' });
    } finally {
      setBusy(null);
    }
  }, [syncedProject, jiraDomain, jiraToken, switchProject, saveJiraSettings, myMembership, finish, toast]);

  const handleInvite = useCallback(() => {
    const raw = inviteValue.trim();
    if (!raw) return;
    // Aceita o link inteiro ou só o token.
    const token = raw.includes('/invite/') ? raw.split('/invite/')[1].split(/[?#]/)[0] : raw;
    if (!token) return;
    router.push(`/invite/${token}`);
  }, [inviteValue, router]);

  const explorePublicly = useCallback(() => {
    setIsPublicExploration(true);
    router.push('/');
  }, [router, setIsPublicExploration]);

  const projectLabel = useMemo(
    () => (roster ? `${roster.projectName} (${roster.projectId})` : ''),
    [roster]
  );

  if (isInitializing || (loadingSuggestions && step === 'suggestion')) {
    return (
      <div className="min-h-dvh flex items-center justify-center p-6">
        <div className="flex items-center gap-3 text-muted-foreground text-sm font-medium">
          <Loader2 className="w-5 h-5 animate-spin text-primary" /> Procurando você nos times...
        </div>
      </div>
    );
  }

  return (
    <div className="w-full min-h-dvh bg-background text-foreground flex flex-col items-center px-4 sm:px-6 py-8 relative overflow-x-hidden">
      <div className="absolute inset-0 pointer-events-none overflow-hidden z-0">
        <div className="absolute -top-32 -left-32 w-[500px] h-[500px] rounded-full bg-primary/10 blur-[140px]" />
        <div className="absolute -bottom-32 -right-32 w-[400px] h-[400px] rounded-full bg-blue-600/10 blur-[120px]" />
      </div>

      <div className="z-10 w-full max-w-3xl flex flex-col items-center gap-6 flex-1">

        {/* PASSO 1 — É VOCÊ? */}
        {step === 'suggestion' && firstSuggestion && firstCandidate && (
          <>
            <Header
              title={`Oi, ${(userProfile?.name || '').split(' ')[0] || 'tudo bem'}.`}
              subtitle={<>Achamos você no time <strong className="text-foreground font-bold">{firstSuggestion.projectId}</strong>. Confirma que é você e a gente já te coloca lá dentro.</>}
            />

            <div className="w-full max-w-xl bg-card/80 backdrop-blur-xl border border-border/60 rounded-3xl p-6 shadow-lg flex flex-col gap-5">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-full bg-primary/10 border border-primary/30 text-primary flex items-center justify-center font-black text-lg shrink-0">
                  {initials(firstCandidate.displayName)}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-lg font-extrabold font-headline truncate">{firstCandidate.displayName}</div>
                  {!!firstCandidate.emailHint && (
                    <div className="text-xs text-muted-foreground truncate">{firstCandidate.emailHint}</div>
                  )}
                </div>
                <Badge variant="outline" className="shrink-0 text-[10px] font-bold uppercase tracking-wider">
                  {firstCandidate.roleName}
                </Badge>
              </div>

              <div className="grid grid-cols-3 gap-2">
                <Fact label="Projeto" value={firstSuggestion.projectName} />
                <Fact label="Tribo" value={firstSuggestion.tribeName || '—'} />
                <Fact label="Pessoas" value={`${firstSuggestion.memberCount}`} />
              </div>

              <p className="text-[11px] text-muted-foreground leading-relaxed">
                Reconhecemos você pela lista que o time importou do Jira. Nada foi alterado ainda.
              </p>

              <div className="flex flex-col gap-2">
                <Button
                  onClick={() => handleClaim(firstCandidate, firstSuggestion.projectId)}
                  disabled={busy !== null}
                  className="h-12 rounded-xl font-bold gap-2"
                >
                  {busy === firstCandidate.memberId
                    ? <Loader2 className="w-4 h-4 animate-spin" />
                    : <>Sim, sou eu — entrar no time <ArrowRight className="w-4 h-4" /></>}
                </Button>
                <Button variant="outline" onClick={() => setStep('search')} disabled={busy !== null} className="h-11 rounded-xl text-sm font-semibold">
                  Não sou eu / quero outro time
                </Button>
              </div>
            </div>

            {suggestions.length > 1 && (
              <div className="w-full max-w-xl flex flex-col gap-2">
                <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Também achamos você em</span>
                {suggestions.slice(1).map(s => (
                  <button
                    key={s.projectId}
                    type="button"
                    onClick={() => s.members[0] && handleClaim(s.members[0], s.projectId)}
                    disabled={busy !== null}
                    className="flex items-center gap-3 rounded-2xl border border-border/60 bg-card/60 px-4 py-3 text-left hover:border-primary/40 transition-colors"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-bold truncate">{s.projectId} · {s.projectName}</div>
                      <div className="text-xs text-muted-foreground truncate">{s.members[0]?.roleName}</div>
                    </div>
                    <ArrowRight className="w-4 h-4 text-muted-foreground shrink-0" />
                  </button>
                ))}
              </div>
            )}
          </>
        )}

        {/* PASSO 2 — BUSCA */}
        {step === 'search' && (
          <>
            <Header
              title="Qual é o seu time?"
              subtitle="Busque pelo nome do time, do projeto ou de alguém que trabalha com você."
            />

            <div className="w-full max-w-xl flex flex-col gap-3">
              <div className="space-y-1">
                <Label htmlFor="busca" className="sr-only">Buscar time, projeto ou pessoa</Label>
                <div className="relative">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-primary pointer-events-none" />
                  <Input
                    id="busca"
                    value={query}
                    onChange={e => setQuery(e.target.value)}
                    placeholder="Ex: DDWMISSI, Missão Crítica ou o nome de um colega"
                    autoComplete="off"
                    autoFocus
                    className="h-14 pl-11 text-base rounded-2xl bg-card/70"
                  />
                  {searching && <Loader2 className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin text-muted-foreground" />}
                </div>
              </div>

              {results.length > 0 && (
                <div className="border border-border/60 rounded-2xl overflow-hidden bg-card/70 backdrop-blur-xl divide-y divide-border/40">
                  {results.map(r => (
                    <button
                      key={r.projectId}
                      type="button"
                      onClick={() => openRoster(r.projectId)}
                      disabled={busy !== null}
                      className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-muted/40 transition-colors"
                    >
                      <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/20 text-primary flex items-center justify-center text-xs font-black shrink-0">
                        {r.projectId.slice(0, 2)}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-bold truncate">
                          {r.projectId} <span className="text-muted-foreground font-medium">· {r.projectName}</span>
                        </div>
                        <div className="text-xs text-muted-foreground truncate">
                          {[r.tribeName, `${r.memberCount} pessoas`, r.members.map(m => m.displayName.split(' ')[0]).slice(0, 3).join(', ')]
                            .filter(Boolean).join(' · ')}
                        </div>
                      </div>
                      {busy === r.projectId
                        ? <Loader2 className="w-4 h-4 animate-spin shrink-0" />
                        : <ArrowRight className="w-4 h-4 text-muted-foreground shrink-0" />}
                    </button>
                  ))}
                </div>
              )}

              {debouncedQuery.trim().length >= 2 && !searching && results.length === 0 && (
                <p className="text-sm text-muted-foreground px-1">
                  Nenhum time encontrado com “{debouncedQuery.trim()}”.
                </p>
              )}

              <div className="flex items-center justify-between gap-4 rounded-2xl border border-dashed border-border/70 px-4 py-3">
                <div className="min-w-0">
                  <div className="text-sm font-bold">Meu time ainda não está aqui</div>
                  <div className="text-xs text-muted-foreground">Cria em 15 segundos — só o nome, o resto vem depois.</div>
                </div>
                <Button variant="outline" onClick={() => setStep('create')} className="shrink-0 rounded-xl text-xs font-bold gap-2">
                  Criar meu time <ArrowRight className="w-3.5 h-3.5" />
                </Button>
              </div>

              {suggestions.length > 0 && (
                <Button variant="ghost" onClick={() => setStep('suggestion')} className="self-start text-xs gap-1.5">
                  <ArrowLeft className="w-3.5 h-3.5" /> Voltar
                </Button>
              )}
            </div>
          </>
        )}

        {/* PASSO 3 — ROSTER */}
        {step === 'roster' && roster && (
          <>
            <Header
              title={`Quem é você na ${roster.projectId}?`}
              subtitle={`${roster.projectName}${roster.tribeName ? ` · Tribo ${roster.tribeName}` : ''} · ${roster.memberCount} pessoas`}
            />

            <div className="w-full max-w-xl flex flex-col gap-3">
              <div className="flex items-start gap-2.5 rounded-2xl border border-sky-500/25 bg-sky-500/5 px-4 py-3">
                <Sparkles className="w-4 h-4 text-sky-500 shrink-0 mt-0.5" />
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Essa lista veio do Jira do time. Se o e-mail que você usa lá é diferente do seu login aqui,
                  é só se marcar — a gente liga as duas contas e o seu papel vem junto.
                </p>
              </div>

              <div className="border border-border/60 rounded-2xl overflow-hidden bg-card/70 backdrop-blur-xl">
                <div className="max-h-[380px] overflow-y-auto divide-y divide-border/40">
                  {roster.members.map(m => (
                    <div key={m.memberId} className="flex items-center gap-3 px-4 py-2.5">
                      <div className="w-9 h-9 rounded-full bg-muted flex items-center justify-center text-[11px] font-bold text-muted-foreground shrink-0">
                        {initials(m.displayName)}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-bold truncate">{m.displayName}</div>
                        <div className="text-[11px] text-muted-foreground truncate">
                          {m.claimed ? (m.claimedByMe ? 'já é você' : 'já está no Espaço Ágil') : (m.emailHint || 'ainda não entrou')}
                        </div>
                      </div>
                      <Badge variant="outline" className="shrink-0 text-[10px] gap-1 hidden sm:inline-flex">
                        {m.leadership && <Crown className="w-3 h-3 text-amber-500" />}
                        {m.roleName}
                      </Badge>
                      {m.claimable ? (
                        <Button
                          size="sm"
                          onClick={() => handleClaim(m, roster.projectId)}
                          disabled={busy !== null}
                          className="h-9 rounded-xl text-xs font-bold shrink-0"
                        >
                          {busy === m.memberId ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Sou eu'}
                        </Button>
                      ) : (
                        <span className="text-[10px] text-muted-foreground shrink-0 w-[86px] text-right leading-tight">
                          {m.leadership ? 'entra por convite' : 'vinculada'}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              <p className="text-[11px] text-muted-foreground leading-relaxed">
                Papéis de liderança (coroa) dão governança da squad, então não podem ser autodeclarados —
                peça um link de convite a quem já lidera o time.
              </p>

              <div className="flex items-center justify-between gap-3">
                <Button variant="ghost" onClick={() => setStep('search')} disabled={busy !== null} className="text-xs gap-1.5">
                  <ArrowLeft className="w-3.5 h-3.5" /> Trocar de time
                </Button>
                <Button variant="outline" onClick={() => setStep('role')} disabled={busy !== null} className="rounded-xl text-xs font-bold gap-2">
                  Não estou na lista <ArrowRight className="w-3.5 h-3.5" />
                </Button>
              </div>
            </div>
          </>
        )}

        {/* PASSO 4 — PAPEL */}
        {step === 'role' && roster && (
          <>
            <Header
              title={`Como você participa da ${roster.projectId}?`}
              subtitle="Só pra saber o que te mostrar primeiro. Seu time pode ajustar isso depois."
            />

            <div className="w-full grid grid-cols-1 sm:grid-cols-3 gap-3">
              {ROLE_CHOICES.map(choice => {
                const Icon = choice.icon;
                return (
                  <button
                    key={choice.role}
                    type="button"
                    onClick={() => handleJoinAs(choice.role)}
                    disabled={busy !== null}
                    className="flex flex-col gap-3 p-5 text-left rounded-2xl border border-border/60 bg-card/70 backdrop-blur-xl hover:border-primary/50 transition-colors disabled:opacity-60"
                  >
                    <div className="w-11 h-11 rounded-xl bg-primary/10 border border-primary/20 text-primary flex items-center justify-center">
                      {busy === choice.role ? <Loader2 className="w-5 h-5 animate-spin" /> : <Icon className="w-5 h-5" />}
                    </div>
                    <div className="text-base font-extrabold font-headline">{choice.title}</div>
                    <p className="text-xs text-muted-foreground leading-relaxed">{choice.description}</p>
                    <div className="mt-auto pt-2 text-[11px] text-muted-foreground/80">{choice.hint}</div>
                  </button>
                );
              })}
            </div>

            <div className="w-full max-w-xl flex items-start gap-3 rounded-2xl border border-amber-500/25 bg-amber-500/5 px-4 py-3">
              <Crown className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
              <p className="text-xs text-muted-foreground leading-relaxed">
                É PO, Tech Lead ou Agile Master da squad? Esses papéis mexem na governança do time e vêm do Jira
                ou de um convite direto — entre como participante agora e peça o ajuste a quem lidera a {roster.projectId}.
              </p>
            </div>

            <Button variant="ghost" onClick={() => setStep('roster')} disabled={busy !== null} className="text-xs gap-1.5">
              <ArrowLeft className="w-3.5 h-3.5" /> Voltar pra lista
            </Button>
          </>
        )}

        {/* PASSO 5 — CRIAR TIME */}
        {step === 'create' && (
          <>
            <Header
              title="Vamos criar o espaço do seu time."
              subtitle="Uma pergunta só. O resto a gente monta pra você."
            />

            <form onSubmit={handleCreate} className="w-full max-w-xl bg-card/80 backdrop-blur-xl border border-border/60 rounded-3xl p-6 shadow-lg flex flex-col gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="nome-time" className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                  Nome do time
                </Label>
                <Input
                  id="nome-time"
                  value={projectName}
                  onChange={e => {
                    setProjectName(e.target.value);
                    if (!keyEdited) setProjectKey(slugify(e.target.value));
                  }}
                  placeholder="Ex: Squad Fênix"
                  autoComplete="off"
                  autoFocus
                  className="h-14 text-lg font-semibold rounded-2xl"
                />
              </div>

              {!!projectKey && (
                <div className="flex items-center gap-2.5 rounded-xl border border-border/60 bg-muted/40 px-4 py-2.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                  <div className="text-xs text-muted-foreground flex-1">
                    Chave gerada: <strong className="text-foreground font-code tracking-wider">{projectKey}</strong>
                  </div>
                  <Input
                    aria-label="Chave do time"
                    value={projectKey}
                    onChange={e => { setKeyEdited(true); setProjectKey(slugify(e.target.value)); }}
                    className="h-8 w-28 text-xs font-code uppercase rounded-lg"
                  />
                </div>
              )}

              <Button type="submit" disabled={busy !== null} className="h-12 rounded-xl font-bold gap-2">
                {busy === 'create' ? <Loader2 className="w-4 h-4 animate-spin" /> : <>Criar e entrar <ArrowRight className="w-4 h-4" /></>}
              </Button>

              <p className="text-[11px] text-muted-foreground text-center leading-relaxed">
                Segmento, tribo e horas do time a gente pergunta lá dentro, quando fizer diferença.
                Você entra como Agile Master e pode passar isso pra outra pessoa.
              </p>
            </form>

            <div className="w-full max-w-xl flex items-center justify-between gap-4 rounded-2xl border border-dashed border-border/70 px-4 py-3">
              <div className="min-w-0">
                <div className="text-sm font-bold">Seu time já existe no Jira?</div>
                <div className="text-xs text-muted-foreground">Importe e traga as pessoas e os papéis prontos.</div>
              </div>
              <Button variant="outline" onClick={() => setStep('jira')} className="shrink-0 rounded-xl text-xs font-bold gap-2">
                <RefreshCw className="w-3.5 h-3.5" /> Importar do Jira
              </Button>
            </div>

            <Button variant="ghost" onClick={() => setStep('search')} className="text-xs gap-1.5">
              <ArrowLeft className="w-3.5 h-3.5" /> Procurar um time existente
            </Button>
          </>
        )}

        {/* PASSO 6 — JIRA (avançado) */}
        {step === 'jira' && !syncedProject && (
          <>
            <Header
              title="Importar um time do Jira"
              subtitle="Traz projeto, pessoas e papéis do Profields de uma vez. Quem já usa o Espaço Ágil é reconhecido automaticamente."
              badge="Caminho avançado"
            />

            <div className="w-full grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_320px] gap-4">
              <form onSubmit={handleJiraPreview} className="bg-card/80 backdrop-blur-xl border border-border/60 rounded-3xl p-6 flex flex-col gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="jira-dominio" className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Domínio</Label>
                  <Input id="jira-dominio" value={jiraDomain} onChange={e => setJiraDomain(e.target.value)}
                    placeholder="empresa.atlassian.net" autoComplete="off" className="h-11 rounded-xl" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="jira-chave" className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Projeto no Jira</Label>
                  <Input id="jira-chave" name="jiraProjectKey" value={jiraKey} onChange={e => setJiraKey(e.target.value)}
                    placeholder="Ex: DDWMISSI" autoComplete="off" data-lpignore="true"
                    className="h-11 font-code uppercase rounded-xl" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="jira-token" className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Seu token do Jira</Label>
                  <Input id="jira-token" name="jiraPersonalAccessToken" type="password" value={jiraToken}
                    onChange={e => setJiraToken(e.target.value)} autoComplete="new-password" data-lpignore="true"
                    placeholder="Token de acesso do Jira" className="h-11 font-code rounded-xl" />
                </div>
                <Button type="submit" disabled={busy !== null} className="h-12 rounded-xl font-bold gap-2">
                  {busy === 'jira' ? <Loader2 className="w-4 h-4 animate-spin" /> : <>Ver o que vai ser importado <ArrowRight className="w-4 h-4" /></>}
                </Button>
                <p className="text-[11px] text-muted-foreground leading-relaxed">
                  O token fica guardado na sua conta e nada é gravado até você conferir a prévia.
                </p>
              </form>

              <aside className="bg-card/50 border border-border/50 rounded-3xl p-5 flex flex-col gap-3">
                <div className="text-sm font-extrabold font-headline">Não tem um token? Leva 30 segundos.</div>
                {[
                  'Abra a página de tokens da Atlassian (o botão abaixo abre em outra aba).',
                  'Clique em Create API token e dê o nome Espaço Ágil.',
                  'Copie e cole aqui. A gente guarda pra você não precisar de novo.',
                ].map((text, i) => (
                  <div key={i} className="flex gap-2.5">
                    <div className="w-5 h-5 rounded-full bg-primary/10 border border-primary/25 text-primary flex items-center justify-center text-[10px] font-bold shrink-0">
                      {i + 1}
                    </div>
                    <p className="text-xs text-muted-foreground leading-relaxed">{text}</p>
                  </div>
                ))}
                <Button asChild variant="outline" className="rounded-xl text-xs font-bold gap-2 mt-1">
                  <a href="https://id.atlassian.com/manage-profile/security/api-tokens" target="_blank" rel="noopener noreferrer">
                    Abrir página de tokens <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                </Button>
                <p className="text-[11px] text-muted-foreground leading-relaxed mt-auto pt-3 border-t border-border/50">
                  Sem token e sem paciência? Dá pra criar o time na mão agora e importar do Jira depois, sem perder nada.
                </p>
                <Button variant="ghost" onClick={() => setStep('create')} className="text-xs font-bold self-start px-0">
                  Criar o time sem o Jira
                </Button>
              </aside>
            </div>
          </>
        )}

        {/* PASSO 6b — CONFERIR O QUE VEIO DO JIRA */}
        {step === 'jira' && syncedProject && (
          <>
            <Header
              title="Confira o que importamos"
              subtitle={<>Prévia do Profields de <span className="font-code font-bold">{syncedProject.id}</span>. Nada foi gravado ainda: só ao confirmar o projeto e as pessoas entram no sistema.</>}
            />

            <div className="w-full bg-card/80 backdrop-blur-xl border border-border/60 rounded-3xl p-6 flex flex-col gap-5">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5">
                {[
                  { label: 'Projeto', value: syncedProject.name },
                  { label: 'Segmento', value: syncedProject.segmentName },
                  { label: 'Tribo', value: syncedProject.tribeName },
                  { label: 'Localidade', value: syncedProject.locality },
                  { label: 'VP', value: syncedProject.vicePresident },
                  { label: 'Área VP', value: syncedProject.vpArea },
                  { label: 'Status', value: syncedProject.status },
                  { label: 'Dev Team', value: syncedProject.devTeamSize ? `${syncedProject.devTeamSize} pessoas` : '' },
                ].map(f => <Fact key={f.label} label={f.label} value={f.value} />)}
              </div>

              <div className="space-y-2">
                <Label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                  <Users className="w-3.5 h-3.5" /> Pessoas encontradas ({syncedProject.members.length})
                </Label>
                {syncedProject.members.length === 0 ? (
                  <div className="text-xs text-muted-foreground bg-muted/40 border border-border/40 rounded-xl p-4 text-center">
                    O Profields não retornou nenhuma pessoa cadastrada para este projeto.
                  </div>
                ) : (
                  <div className="border border-border/40 rounded-xl overflow-hidden">
                    <div className="max-h-64 overflow-y-auto divide-y divide-border/40">
                      {syncedProject.members.map((m, i) => (
                        <div key={m.id || `${m.roleKey}-${m.email || m.displayName}-${i}`}
                          className={cn('flex items-center gap-3 px-3 py-2 text-sm', isMe(m) && 'bg-primary/5')}>
                          <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center text-[10px] font-bold text-muted-foreground shrink-0">
                            {initials(m.displayName)}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="font-semibold truncate flex items-center gap-2">
                              {m.displayName}
                              {isMe(m) && <Badge className="text-[9px] px-1.5 py-0 h-4">Você</Badge>}
                            </div>
                          </div>
                          <Badge variant="outline" className="text-[10px] shrink-0 gap-1">
                            {m.leadership && <Crown className="w-3 h-3 text-amber-500" />}
                            {m.roleName}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {!myMembership && (
                  <p className="text-[11px] text-amber-600 dark:text-amber-400 leading-relaxed">
                    Seu e-mail não apareceu entre as pessoas do Profields. Depois de importar, você se marca na lista
                    do time — é o mesmo "sou eu" do passo anterior.
                  </p>
                )}
              </div>

              <div className="flex flex-col sm:flex-row gap-2 sm:justify-end">
                <Button variant="outline" onClick={() => setSyncedProject(null)} disabled={busy !== null} className="h-11 rounded-xl text-xs font-bold">
                  Corrigir dados
                </Button>
                <Button onClick={handleConfirmSynced} disabled={busy !== null} className="h-11 rounded-xl text-xs font-bold gap-2">
                  {busy === 'confirm' ? <Loader2 className="w-4 h-4 animate-spin" /> : <>Confirmar e importar <ArrowRight className="w-4 h-4" /></>}
                </Button>
              </div>
            </div>
          </>
        )}

        {/* RODAPÉ — saídas sempre disponíveis */}
        <div className="mt-auto pt-6 w-full max-w-xl flex flex-col items-center gap-3">
          {inviteOpen ? (
            <div className="w-full flex items-center gap-2">
              <Input
                value={inviteValue}
                onChange={e => setInviteValue(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') handleInvite(); }}
                placeholder="Cole aqui o link do convite"
                autoFocus
                className="h-10 rounded-xl text-sm"
              />
              <Button onClick={handleInvite} className="h-10 rounded-xl text-xs font-bold shrink-0">Abrir</Button>
              <Button variant="ghost" onClick={() => setInviteOpen(false)} className="h-10 text-xs shrink-0">Cancelar</Button>
            </div>
          ) : (
            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              <button type="button" onClick={() => setInviteOpen(true)} className="font-semibold hover:text-foreground transition-colors inline-flex items-center gap-1.5">
                <LinkIcon className="w-3.5 h-3.5" /> Tenho um link de convite
              </button>
              <span aria-hidden="true">·</span>
              <button type="button" onClick={explorePublicly} className="font-semibold hover:text-foreground transition-colors">
                Só quero dar uma olhada
              </button>
              <span aria-hidden="true">·</span>
              <span>Dá pra trocar de time depois</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Header({ title, subtitle, badge }: { title: string; subtitle?: React.ReactNode; badge?: string }) {
  return (
    <div className="text-center space-y-2 max-w-2xl">
      {!!badge && (
        <Badge variant="outline" className="text-[10px] font-bold uppercase tracking-widest">{badge}</Badge>
      )}
      <h1 className="text-3xl sm:text-4xl font-black tracking-tight font-headline flex items-center justify-center gap-2.5">
        <Rocket className="w-7 h-7 text-primary hidden sm:block" aria-hidden="true" />
        {title}
      </h1>
      {!!subtitle && <p className="text-sm text-muted-foreground leading-relaxed">{subtitle}</p>}
    </div>
  );
}

function Fact({ label, value }: { label: string; value?: string }) {
  return (
    <div className="bg-muted/40 border border-border/40 rounded-xl px-3 py-2 min-w-0">
      <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className={cn('text-sm font-semibold truncate', !value && 'text-muted-foreground/60 italic')} title={value || undefined}>
        {value || 'não informado'}
      </div>
    </div>
  );
}
