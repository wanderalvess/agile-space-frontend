'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Rocket,
  Users,
  RefreshCw,
  Sparkles,
  Loader2,
  ArrowRight,
  LayoutDashboard,
  Link as LinkIcon,
  CheckCircle2,
  FolderPlus,
  ArrowLeft,
  Crown,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/context/AuthContext';
import { useUserContext } from '@/context/UserContext';
import { projectService, type ProjectDetail, type ProjectMemberRoleItem } from '@/services/projectService';
import { Badge } from '@/components/ui/badge';
import { CONTRIBUTOR_ROLES, SQUAD_PEOPLE_ADMIN_ROLES } from '@/lib/types';
import { useJiraSettings } from '@/hooks/useJiraSettings';

function slugify(name: string) {
  return name
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .slice(0, 12);
}

export default function OnboardingPage() {
  const router = useRouter();
  const { toast } = useToast();
  const { session, createProject, joinProject, switchProject } = useAuth();
  const { mustOnboard, isInitializing, userProfile } = useUserContext();
  const { saveSettings: saveJiraSettings } = useJiraSettings();

  const [loadingAction, setLoadingAction] = useState<'create' | 'join' | 'jira' | 'confirm' | null>(null);

  // --- Criar do zero ---
  const [projectName, setProjectName] = useState('');
  const [projectKey, setProjectKey] = useState('');
  const [keyEdited, setKeyEdited] = useState(false);
  const [segmentName, setSegmentName] = useState('');
  const [tribeName, setTribeName] = useState('');

  // --- Entrar em existente ---
  const [allProjects, setAllProjects] = useState<ProjectDetail[]>([]);
  const [loadingProjects, setLoadingProjects] = useState(true);
  const [selectedProjectKey, setSelectedProjectKey] = useState('');
  const [joinRole, setJoinRole] = useState('');

  // --- Jira ---
  const [jiraDomain, setJiraDomain] = useState('');
  const [jiraKey, setJiraKey] = useState('');
  const [jiraToken, setJiraToken] = useState('');
  const [syncedProject, setSyncedProject] = useState<ProjectDetail | null>(null);

  // GUARDA DE ACESSO: Se o usuário já estiver configurado com projeto/squad, não permanece no onboarding.
  useEffect(() => {
    if (!isInitializing && !mustOnboard) {
      router.replace('/');
    }
  }, [isInitializing, mustOnboard, router]);

  useEffect(() => {
    projectService.getAllProjects()
      .then(setAllProjects)
      .catch(() => setAllProjects([]))
      .finally(() => setLoadingProjects(false));
  }, []);

  const hasExistingProjects = allProjects.length > 0;

  const handleNameChange = (value: string) => {
    setProjectName(value);
    if (!keyEdited) setProjectKey(slugify(value));
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!projectName.trim() || !projectKey.trim()) {
      toast({ title: 'Preencha nome e chave do projeto', variant: 'destructive' });
      return;
    }
    setLoadingAction('create');
    try {
      await createProject({
        id: projectKey.trim(),
        name: projectName.trim(),
        segmentName: segmentName.trim() || undefined,
        tribeName: tribeName.trim() || undefined,
      });
      toast({ title: 'Projeto criado com sucesso!', description: `Você é o Agile Master de ${projectKey.trim()}. Próximo passo: configurar as horas do time.` });
      router.push('/squad/roster?onboarding=1');
    } catch (err: any) {
      toast({ title: 'Não foi possível criar o projeto', description: err.message, variant: 'destructive' });
    } finally {
      setLoadingAction(null);
    }
  };

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProjectKey || !joinRole) {
      toast({ title: 'Escolha o projeto e o seu papel nele', variant: 'destructive' });
      return;
    }
    setLoadingAction('join');
    try {
      await joinProject(selectedProjectKey, joinRole);
      toast({ title: 'Pronto!', description: `Você entrou em ${selectedProjectKey} como ${joinRole}.` });
      router.push('/');
    } catch (err: any) {
      toast({ title: 'Não foi possível entrar no projeto', description: err.message, variant: 'destructive' });
    } finally {
      setLoadingAction(null);
    }
  };

  const handleJiraSync = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!jiraKey.trim() || !jiraToken.trim()) {
      toast({ title: 'Informe a chave do projeto e seu token do Jira', variant: 'destructive' });
      return;
    }
    setLoadingAction('jira');
    try {
      const key = jiraKey.trim().toUpperCase();
      const preview = await projectService.previewProjectProfields(key, jiraDomain.trim(), jiraToken.trim());
      setSyncedProject(preview);
      toast({ title: 'Dados encontrados no Jira', description: 'Nada foi gravado ainda. Confira e confirme pra importar.' });
    } catch (err: any) {
      toast({ title: 'Falha na sincronização', description: err.message, variant: 'destructive' });
    } finally {
      setLoadingAction(null);
    }
  };

  const handleConfirmSynced = async () => {
    if (!syncedProject) return;
    setLoadingAction('confirm');
    try {
      // Só agora grava projeto + membros no banco.
      await projectService.syncProjectProfields(syncedProject.id, jiraDomain.trim(), jiraToken.trim());
      await switchProject(syncedProject.id);
      // Guarda o PAT informado no onboarding pra sincronização do squad (roster/horas) já funcionar.
      if (jiraToken.trim()) {
        await saveJiraSettings({ domain: jiraDomain.trim(), token: jiraToken.trim() });
      }
      const leadsPeople = !!myMembership && (SQUAD_PEOPLE_ADMIN_ROLES as string[]).includes(myMembership.roleName);
      toast({
        title: 'Vinculado!',
        description: leadsPeople
          ? `Você entrou em ${syncedProject.id} como ${myMembership!.roleName}. Próximo passo: configurar as horas do time.`
          : `Você já aparece como membro de ${syncedProject.id}.`,
      });
      router.push(leadsPeople ? '/squad/roster?onboarding=1' : '/');
    } catch (err: any) {
      toast({ title: 'Não foi possível entrar no projeto', description: err.message, variant: 'destructive' });
    } finally {
      setLoadingAction(null);
    }
  };

  const handleDiscardSynced = () => setSyncedProject(null);

  const myEmail = (userProfile?.email || '').toLowerCase().trim();
  const isMe = (m: ProjectMemberRoleItem) =>
    (!!userProfile?.id && m.userId === userProfile.id) ||
    (!!myEmail && (m.email || '').toLowerCase().trim() === myEmail);
  const myMembership = syncedProject?.members.find(isMe);

  const selectedProjectLabel = useMemo(() => {
    const p = allProjects.find(p => p.id === selectedProjectKey);
    return p ? `${p.name} (${p.id})` : '';
  }, [allProjects, selectedProjectKey]);

  if (isInitializing) {
    return (
      <div className="min-h-dvh flex items-center justify-center p-6">
        <div className="flex items-center gap-3 text-muted-foreground text-sm font-medium">
          <Loader2 className="w-5 h-5 animate-spin text-primary" /> Carregando perfil...
        </div>
      </div>
    );
  }

  return (
    <div className="w-full bg-background text-foreground flex flex-col items-center pt-0 pb-6 px-4 sm:px-6 relative overflow-x-hidden">
      
      {/* Luzes decorativas de fundo (Glassmorphism ambient glow) */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden z-0">
        <div className="absolute -top-32 -left-32 w-[500px] h-[500px] rounded-full bg-primary/10 blur-[140px]" />
        <div className="absolute -bottom-32 -right-32 w-[400px] h-[400px] rounded-full bg-blue-600/10 blur-[120px]" />
      </div>

      <div className="z-10 w-full max-w-7xl flex flex-col items-center gap-4 sm:gap-5 pt-0 pb-2">

        {/* HEADER SECTION */}
        <div className="text-center space-y-2 max-w-2xl">
          <h1 className="text-3xl sm:text-4xl font-black tracking-tight font-headline text-foreground">
            Bem-vindo ao Espaço Ágil
          </h1>

          <p className="text-sm text-muted-foreground leading-relaxed">
            O seu centro de comando para engenharia de elite. Selecione o ponto de partida para configurar seu esquadrão e maximizar a entrega de valor.
          </p>
        </div>

        {/* REVISÃO PÓS-SYNC DO JIRA */}
        {syncedProject ? (
          <div className="w-full max-w-4xl bg-card/80 backdrop-blur-xl border border-border/60 rounded-3xl p-6 sm:p-7 shadow-lg flex flex-col gap-5">
            <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
              <div className="space-y-1">
                <span className="text-[10px] font-black tracking-wider text-purple-500 bg-purple-500/10 border border-purple-500/20 px-3 py-1 rounded-full uppercase inline-block">
                  Importado do Jira
                </span>
                <h2 className="text-xl font-extrabold font-headline text-foreground flex items-center gap-2">
                  <CheckCircle2 className="w-5 h-5 text-emerald-500" /> Confira o que importamos
                </h2>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Prévia do Profields de <span className="font-mono font-bold">{syncedProject.id}</span>. Nada foi gravado ainda: só ao confirmar o projeto e as pessoas entram no sistema.
                </p>
              </div>
              <Button variant="ghost" size="sm" onClick={handleDiscardSynced} disabled={loadingAction !== null} className="text-xs gap-1.5 shrink-0">
                <ArrowLeft className="w-3.5 h-3.5" /> Voltar
              </Button>
            </div>

            {/* Dados do projeto */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {[
                { label: 'Projeto', value: syncedProject.name },
                { label: 'Segmento', value: syncedProject.segmentName },
                { label: 'Tribo', value: syncedProject.tribeName },
                { label: 'Localidade', value: syncedProject.locality },
                { label: 'VP', value: syncedProject.vicePresident },
                { label: 'Área VP', value: syncedProject.vpArea },
                { label: 'Status', value: syncedProject.status },
                { label: 'Dev Team', value: syncedProject.devTeamSize ? `${syncedProject.devTeamSize} pessoas` : '' },
              ].map(f => (
                <div key={f.label} className="bg-muted/40 border border-border/40 rounded-xl px-3 py-2 min-w-0">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{f.label}</div>
                  <div className={`text-sm font-semibold truncate ${f.value ? 'text-foreground' : 'text-muted-foreground/60 italic'}`} title={f.value || undefined}>
                    {f.value || 'não informado'}
                  </div>
                </div>
              ))}
            </div>

            {/* Membros encontrados */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                  <Users className="w-3.5 h-3.5" /> Pessoas encontradas ({syncedProject.members.length})
                </Label>
              </div>
              {syncedProject.members.length === 0 ? (
                <div className="text-xs text-muted-foreground bg-muted/40 border border-border/40 rounded-xl p-4 text-center">
                  O Profields não retornou nenhuma pessoa cadastrada para este projeto.
                </div>
              ) : (
                <div className="border border-border/40 rounded-xl overflow-hidden">
                  <div className="max-h-72 overflow-y-auto divide-y divide-border/40">
                    {syncedProject.members.map((m, i) => {
                      const me = isMe(m);
                      return (
                        <div key={m.id || `${m.roleKey}-${m.email || m.displayName}-${i}`} className={`flex items-center gap-3 px-3 py-2 text-sm ${me ? 'bg-primary/5' : ''}`}>
                          <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center text-xs font-bold text-muted-foreground shrink-0 overflow-hidden">
                            {m.avatarUrl ? <img src={m.avatarUrl} alt="" className="w-full h-full object-cover" /> : (m.displayName || '?').slice(0, 2).toUpperCase()}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="font-semibold truncate flex items-center gap-2">
                              {m.displayName}
                              {me && <Badge className="text-[9px] px-1.5 py-0 h-4">Você</Badge>}
                            </div>
                            <div className="text-[11px] text-muted-foreground truncate">{m.email || 'sem e-mail'}</div>
                          </div>
                          <Badge variant="outline" className="text-[10px] shrink-0 gap-1">
                            {m.leadership && <Crown className="w-3 h-3 text-amber-500" />}
                            {m.roleName}
                          </Badge>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
              {myMembership ? (
                <p className="text-[11px] text-muted-foreground">
                  Você entrará como <span className="font-bold text-foreground">{myMembership.roleName}</span>.
                  {myMembership.roleKey === 'AGILE_MASTER' && ' Se você não é Agile Master deste projeto no Jira, esse vínculo foi automático (seu e-mail não bateu com ninguém do Profields). Peça a um administrador para ajustar depois.'}
                </p>
              ) : (
                <p className="text-[11px] text-amber-600 dark:text-amber-400">
                  Seu e-mail ({myEmail || 'sem e-mail'}) não apareceu entre as pessoas do Profields. Ao confirmar, você entrará no projeto sem papel definido.
                </p>
              )}
            </div>

            <div className="flex flex-col sm:flex-row gap-2 sm:justify-end">
              <Button variant="outline" onClick={handleDiscardSynced} disabled={loadingAction !== null} className="h-11 rounded-xl text-xs font-bold uppercase tracking-wider">
                Corrigir dados
              </Button>
              <Button onClick={handleConfirmSynced} disabled={loadingAction !== null} className="h-11 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white text-xs font-bold uppercase tracking-wider gap-2">
                {loadingAction === 'confirm' ? <Loader2 className="w-4 h-4 animate-spin" /> : <><span>Confirmar e importar</span><ArrowRight className="w-4 h-4" /></>}
              </Button>
            </div>
          </div>
        ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 w-full mt-0">

          {/* CARTÃO 1: CRIAR NOVO PROJETO */}
          <div className="bg-card/80 backdrop-blur-xl border border-border/60 rounded-3xl p-6 sm:p-7 flex flex-col h-full shadow-lg hover:border-primary/40 transition-all duration-300 relative group overflow-hidden">
            
            <div className="flex justify-between items-start mb-5">
              <div className="w-12 h-12 rounded-2xl bg-primary/10 text-primary flex items-center justify-center shadow-inner">
                <Rocket className="w-6 h-6" />
              </div>
              <span className="text-[10px] font-black tracking-wider text-primary bg-primary/10 border border-primary/20 px-3 py-1 rounded-full uppercase">
                DO ZERO
              </span>
            </div>

            <div className="mb-5 space-y-1">
              <h2 className="text-xl font-extrabold font-headline text-foreground flex items-center gap-2">
                Criar Novo Projeto
              </h2>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Inicie um novo esquadrão, configure cerimônias e defina seu backlog inicial. Ideal para novos produtos.
              </p>
            </div>

            <form onSubmit={handleCreate} className="flex-1 flex flex-col justify-between space-y-4">
              <div className="space-y-3">
                <div className="space-y-1">
                  <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Nome do Projeto</Label>
                  <Input
                    placeholder="Ex: Squad Fênix"
                    value={projectName}
                    onChange={(e) => handleNameChange(e.target.value)}
                    className="h-10 text-sm rounded-xl bg-background/50 border-border"
                  />
                </div>

                <div className="space-y-1">
                  <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Chave no Sistema</Label>
                  <Input
                    placeholder="Ex: FENIX"
                    value={projectKey}
                    onChange={(e) => { setKeyEdited(true); setProjectKey(slugify(e.target.value)); }}
                    className="h-10 text-sm font-mono uppercase rounded-xl bg-background/50 border-border"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <Label className="text-[11px] font-semibold text-muted-foreground">Segmento</Label>
                    <Input
                      placeholder="Ex: Varejo"
                      value={segmentName}
                      onChange={(e) => setSegmentName(e.target.value)}
                      className="h-9 text-xs rounded-lg bg-background/50"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[11px] font-semibold text-muted-foreground">Tribo</Label>
                    <Input
                      placeholder="Ex: Distribuição"
                      value={tribeName}
                      onChange={(e) => setTribeName(e.target.value)}
                      className="h-9 text-xs rounded-lg bg-background/50"
                    />
                  </div>
                </div>
              </div>

              <Button
                type="submit"
                disabled={loadingAction !== null}
                className="w-full h-11 bg-primary hover:bg-primary/90 text-primary-foreground font-bold rounded-xl shadow-md transition-all text-xs tracking-wider uppercase flex items-center justify-center gap-2 mt-auto"
              >
                {loadingAction === 'create' ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <>
                    <span>Começar</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </Button>
            </form>
          </div>

          {/* CARTÃO 2: ENTRAR EM PROJETO EXISTENTE */}
          <div className="bg-card/80 backdrop-blur-xl border border-border/60 rounded-3xl p-6 sm:p-7 flex flex-col h-full shadow-lg hover:border-primary/40 transition-all duration-300 relative group overflow-hidden">
            
            <div className="flex justify-between items-start mb-5">
              <div className="w-12 h-12 rounded-2xl bg-blue-500/10 text-blue-500 flex items-center justify-center shadow-inner">
                <Users className="w-6 h-6" />
              </div>
              <span className="text-[10px] font-black tracking-wider text-blue-500 bg-blue-500/10 border border-blue-500/20 px-3 py-1 rounded-full uppercase">
                CONVITE
              </span>
            </div>

            <div className="mb-5 space-y-1">
              <h2 className="text-xl font-extrabold font-headline text-foreground flex items-center gap-2">
                Entrar em Projeto Existente
              </h2>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Junte-se ao seu time atual selecionando o projeto já cadastrado e informando seu papel na squad.
              </p>
            </div>

            <form onSubmit={handleJoin} className="flex-1 flex flex-col justify-between space-y-4">
              <div className="space-y-3">
                {loadingProjects ? (
                  <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground py-8">
                    <Loader2 className="w-4 h-4 animate-spin text-primary" /> Carregando projetos do sistema...
                  </div>
                ) : !hasExistingProjects ? (
                  <div className="text-xs text-muted-foreground bg-muted/40 border border-border/40 rounded-xl p-4 text-center">
                    Nenhum projeto cadastrado ainda no sistema. Crie um novo no cartão ao lado ou sincronize via Jira.
                  </div>
                ) : (
                  <>
                    <div className="space-y-1">
                      <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Projeto</Label>
                      <Select value={selectedProjectKey} onValueChange={setSelectedProjectKey}>
                        <SelectTrigger className="h-10 text-sm rounded-xl bg-background/50 border-border">
                          <SelectValue placeholder="Selecione o projeto...">{selectedProjectLabel}</SelectValue>
                        </SelectTrigger>
                        <SelectContent>
                          {allProjects.map((p) => (
                            <SelectItem key={p.id} value={p.id}>{p.name} ({p.id})</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-1">
                      <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Seu Papel na Squad</Label>
                      <Select value={joinRole} onValueChange={setJoinRole}>
                        <SelectTrigger className="h-10 text-sm rounded-xl bg-background/50 border-border">
                          <SelectValue placeholder="Selecione seu papel..." />
                        </SelectTrigger>
                        <SelectContent>
                          {CONTRIBUTOR_ROLES.map((r) => (
                            <SelectItem key={r} value={r}>{r}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <p className="text-[11px] text-muted-foreground">
                        É Product Owner, Tech Lead ou outro papel de liderança? Use o cartão "Importar do Jira" ao lado com seu token, ou peça pra um administrador te vincular — liderança não é autodeclarável aqui.
                      </p>
                    </div>
                  </>
                )}
              </div>

              <Button
                type="submit"
                disabled={loadingAction !== null || !hasExistingProjects || loadingProjects}
                className="w-full h-11 bg-slate-900 hover:bg-slate-800 dark:bg-slate-100 dark:hover:bg-white dark:text-slate-900 text-white font-bold rounded-xl shadow-md transition-all text-xs tracking-wider uppercase flex items-center justify-center gap-2 mt-auto"
              >
                {loadingAction === 'join' ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <>
                    <span>Conectar</span>
                    <LinkIcon className="w-4 h-4" />
                  </>
                )}
              </Button>
            </form>
          </div>

          {/* CARTÃO 3: IMPORTAR DO JIRA */}
          <div className="bg-card/80 backdrop-blur-xl border border-border/60 rounded-3xl p-6 sm:p-7 flex flex-col h-full shadow-lg hover:border-primary/40 transition-all duration-300 relative group overflow-hidden">
            
            <div className="flex justify-between items-start mb-5">
              <div className="w-12 h-12 rounded-2xl bg-purple-500/10 text-purple-500 flex items-center justify-center shadow-inner">
                <RefreshCw className="w-6 h-6" />
              </div>
              <span className="text-[10px] font-black tracking-wider text-purple-500 bg-purple-500/10 border border-purple-500/20 px-3 py-1 rounded-full uppercase">
                MIGRAÇÃO
              </span>
            </div>

            <div className="mb-5 space-y-1">
              <h2 className="text-xl font-extrabold font-headline text-foreground flex items-center gap-2">
                Importar do Jira
              </h2>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Sincronize epics, sprints e cards diretamente do Jira. Elimine fricção burocrática e migre seu workspace.
              </p>
            </div>

            <form onSubmit={handleJiraSync} className="flex-1 flex flex-col justify-between space-y-4">
              <div className="space-y-3">
                <div className="space-y-1">
                  <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Domínio Jira</Label>
                  <Input
                    value={jiraDomain}
                    onChange={(e) => setJiraDomain(e.target.value)}
                    className="h-10 text-sm rounded-xl bg-background/50 border-border"
                  />
                </div>

                <div className="space-y-1">
                  <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Chave do Projeto Jira</Label>
                  <Input
                    placeholder="Ex: DDWMISSI"
                    value={jiraKey}
                    onChange={(e) => setJiraKey(e.target.value)}
                    className="h-10 text-sm font-mono uppercase rounded-xl bg-background/50 border-border"
                  />
                </div>

                <div className="space-y-1">
                  <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Token PAT (Personal Access Token)</Label>
                  <Input
                    type="password"
                    placeholder="Token de acesso do Jira"
                    value={jiraToken}
                    onChange={(e) => setJiraToken(e.target.value)}
                    className="h-10 text-sm font-mono rounded-xl bg-background/50 border-border"
                  />
                </div>
              </div>

              <Button
                type="submit"
                disabled={loadingAction !== null}
                className="w-full h-11 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white font-bold rounded-xl shadow-md transition-all text-xs tracking-wider uppercase flex items-center justify-center gap-2 mt-auto"
              >
                {loadingAction === 'jira' ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <>
                    <span>Configurar Integração</span>
                    <RefreshCw className="w-4 h-4" />
                  </>
                )}
              </Button>
            </form>
          </div>

        </div>
        )}

      </div>
    </div>
  );
}
