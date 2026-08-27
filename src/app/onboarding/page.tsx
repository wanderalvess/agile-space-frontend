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
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/context/AuthContext';
import { useUserContext } from '@/context/UserContext';
import { projectService, type ProjectDetail } from '@/services/projectService';
import { CONTRIBUTOR_ROLES } from '@/lib/types';

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
  const { mustOnboard, isInitializing } = useUserContext();

  const [loadingAction, setLoadingAction] = useState<'create' | 'join' | 'jira' | null>(null);

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
      toast({ title: 'Projeto criado com sucesso!', description: `Você é o Agile Master de ${projectKey.trim()}.` });
      router.push('/');
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
      await projectService.syncProjectProfields(key, jiraDomain.trim(), jiraToken.trim());
      try {
        await switchProject(key);
        toast({ title: 'Sincronizado e vinculado!', description: `Você já aparece como membro de ${key}.` });
        router.push('/');
      } catch {
        toast({
          title: 'Projeto sincronizado',
          description: 'Seu e-mail não apareceu entre os membros do Jira. Selecione-o manualmente no cartão "Entrar em Projeto".',
        });
        const fresh = await projectService.getAllProjects();
        setAllProjects(fresh);
        setSelectedProjectKey(key);
      }
    } catch (err: any) {
      toast({ title: 'Falha na sincronização', description: err.message, variant: 'destructive' });
    } finally {
      setLoadingAction(null);
    }
  };

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

        {/* BENTO GRID - 3 CARTÕES */}
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

      </div>
    </div>
  );
}
