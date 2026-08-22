'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Sparkles, FolderPlus, Users, RefreshCw, Loader2, ArrowRight } from 'lucide-react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/context/AuthContext';
import { projectService, type ProjectDetail } from '@/services/projectService';
import { ROLES } from '@/lib/types';

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

  const [activeTab, setActiveTab] = useState<'create' | 'join' | 'jira'>('create');
  const [loading, setLoading] = useState(false);

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
  const [jiraDomain, setJiraDomain] = useState('jiraproducao.totvs.com.br');
  const [jiraKey, setJiraKey] = useState('');
  const [jiraToken, setJiraToken] = useState('');

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

  const handleCreate = async () => {
    if (!projectName.trim() || !projectKey.trim()) {
      toast({ title: 'Preencha nome e chave do projeto', variant: 'destructive' });
      return;
    }
    setLoading(true);
    try {
      await createProject({
        id: projectKey.trim(),
        name: projectName.trim(),
        segmentName: segmentName.trim() || undefined,
        tribeName: tribeName.trim() || undefined,
      });
      toast({ title: 'Projeto criado!', description: `Você é o Agile Master de ${projectKey}.` });
      router.push('/');
    } catch (err: any) {
      toast({ title: 'Não foi possível criar o projeto', description: err.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const handleJoin = async () => {
    if (!selectedProjectKey || !joinRole) {
      toast({ title: 'Escolha o projeto e o seu papel nele', variant: 'destructive' });
      return;
    }
    setLoading(true);
    try {
      await joinProject(selectedProjectKey, joinRole);
      toast({ title: 'Pronto!', description: `Você entrou em ${selectedProjectKey} como ${joinRole}.` });
      router.push('/');
    } catch (err: any) {
      toast({ title: 'Não foi possível entrar no projeto', description: err.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const handleJiraSync = async () => {
    if (!jiraKey.trim() || !jiraToken.trim()) {
      toast({ title: 'Informe a chave do projeto e seu token do Jira', variant: 'destructive' });
      return;
    }
    setLoading(true);
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
          description: 'Mas seu e-mail não apareceu entre os membros do Jira. Use a aba "Entrar em um projeto" pra se vincular manualmente.',
        });
        const fresh = await projectService.getAllProjects();
        setAllProjects(fresh);
        setSelectedProjectKey(key);
        setActiveTab('join');
      }
    } catch (err: any) {
      toast({ title: 'Falha na sincronização', description: err.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const selectedProjectLabel = useMemo(() => {
    const p = allProjects.find(p => p.id === selectedProjectKey);
    return p ? `${p.name} (${p.id})` : '';
  }, [allProjects, selectedProjectKey]);

  return (
    <div className="min-h-dvh flex items-center justify-center p-4 md:p-8">
      <div className="w-full max-w-2xl space-y-6">

        <div className="text-center space-y-2">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 border border-primary/20 text-primary text-xs font-semibold">
            <Sparkles className="w-3.5 h-3.5" /> Última etapa
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight font-headline">
            Olá, {session?.name?.split(' ')[0] || 'tudo bem'}! Qual projeto é o seu?
          </h1>
          <p className="text-sm text-muted-foreground max-w-md mx-auto">
            Sem isso o sistema não sabe em qual squad te colocar. Escolha uma das três opções abaixo — leva menos de um minuto.
          </p>
        </div>

        <Card className="border border-border bg-card shadow-xl rounded-2xl overflow-hidden">
          <CardHeader className="pb-4 pt-6 px-6 border-b border-border/50 bg-muted/20">
            <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)} className="w-full">
              <TabsList className="grid grid-cols-3 bg-muted/60 p-1 rounded-xl">
                <TabsTrigger value="create" className="text-[11px] font-bold data-[state=active]:bg-background data-[state=active]:shadow-sm rounded-lg py-2 gap-1.5">
                  <FolderPlus className="w-3.5 h-3.5" /> Criar novo
                </TabsTrigger>
                <TabsTrigger value="join" className="text-[11px] font-bold data-[state=active]:bg-background data-[state=active]:shadow-sm rounded-lg py-2 gap-1.5">
                  <Users className="w-3.5 h-3.5" /> Já existe
                </TabsTrigger>
                <TabsTrigger value="jira" className="text-[11px] font-bold data-[state=active]:bg-background data-[state=active]:shadow-sm rounded-lg py-2 gap-1.5">
                  <RefreshCw className="w-3.5 h-3.5" /> Sincronizar
                </TabsTrigger>
              </TabsList>
            </Tabs>
          </CardHeader>

          <CardContent className="p-6 space-y-5">

            {activeTab === 'create' && (
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  Não usa Jira, ou quer começar do zero? Cria um projeto vazio agora — você vira o Agile Master dele e pode convidar o resto do time depois.
                </p>
                <div className="space-y-1.5">
                  <Label>Nome do projeto</Label>
                  <Input placeholder="Ex: Squad Fênix" value={projectName} onChange={(e) => handleNameChange(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label>Chave <span className="text-muted-foreground font-normal">— identifica o projeto no sistema, não dá pra mudar depois</span></Label>
                  <Input
                    placeholder="Ex: FENIX"
                    value={projectKey}
                    onChange={(e) => { setKeyEdited(true); setProjectKey(slugify(e.target.value)); }}
                    className="font-mono uppercase"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label>Segmento <span className="text-muted-foreground font-normal">(opcional)</span></Label>
                    <Input placeholder="Ex: Varejo" value={segmentName} onChange={(e) => setSegmentName(e.target.value)} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Tribo <span className="text-muted-foreground font-normal">(opcional)</span></Label>
                    <Input placeholder="Ex: Distribuição" value={tribeName} onChange={(e) => setTribeName(e.target.value)} />
                  </div>
                </div>
                <Button onClick={handleCreate} disabled={loading} className="w-full h-11 rounded-xl font-bold gap-2">
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowRight className="w-4 h-4" />}
                  Criar projeto e continuar
                </Button>
              </div>
            )}

            {activeTab === 'join' && (
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  Alguém do seu time já configurou o projeto no sistema. Escolha ele na lista e diga qual é o seu papel — isso te dá acesso imediato às cerimônias da squad.
                </p>
                {loadingProjects ? (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground py-4">
                    <Loader2 className="w-4 h-4 animate-spin" /> Carregando projetos...
                  </div>
                ) : !hasExistingProjects ? (
                  <p className="text-sm text-muted-foreground bg-muted/40 rounded-xl p-4">
                    Nenhum projeto cadastrado ainda no sistema. Use a aba "Criar novo" ou "Sincronizar".
                  </p>
                ) : (
                  <>
                    <div className="space-y-1.5">
                      <Label>Projeto</Label>
                      <Select value={selectedProjectKey} onValueChange={setSelectedProjectKey}>
                        <SelectTrigger className="h-11 rounded-xl">
                          <SelectValue placeholder="Selecione o projeto...">{selectedProjectLabel}</SelectValue>
                        </SelectTrigger>
                        <SelectContent>
                          {allProjects.map((p) => (
                            <SelectItem key={p.id} value={p.id}>{p.name} ({p.id})</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5">
                      <Label>Seu papel na squad</Label>
                      <Select value={joinRole} onValueChange={setJoinRole}>
                        <SelectTrigger className="h-11 rounded-xl">
                          <SelectValue placeholder="Selecione seu papel..." />
                        </SelectTrigger>
                        <SelectContent>
                          {ROLES.map((r) => (
                            <SelectItem key={r} value={r}>{r}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <p className="text-xs text-muted-foreground">Papéis de liderança (PO, Tech Lead, Agile Master...) dão acesso à governança da squad.</p>
                    </div>
                    <Button onClick={handleJoin} disabled={loading} className="w-full h-11 rounded-xl font-bold gap-2">
                      {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowRight className="w-4 h-4" />}
                      Entrar no projeto
                    </Button>
                  </>
                )}
              </div>
            )}

            {activeTab === 'jira' && (
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  Puxa os dados oficiais do projeto direto do Jira Profields (segmento, tribo, membros e cargos). Precisa de um Personal Access Token do Jira.
                </p>
                <div className="space-y-1.5">
                  <Label>Domínio Jira</Label>
                  <Input value={jiraDomain} onChange={(e) => setJiraDomain(e.target.value)} className="h-11 rounded-xl" />
                </div>
                <div className="space-y-1.5">
                  <Label>Chave do projeto</Label>
                  <Input placeholder="Ex: DDWMISSI" value={jiraKey} onChange={(e) => setJiraKey(e.target.value)} className="h-11 rounded-xl font-mono uppercase" />
                </div>
                <div className="space-y-1.5">
                  <Label>Token de Acesso (PAT)</Label>
                  <Input type="password" placeholder="Cole seu Personal Access Token" value={jiraToken} onChange={(e) => setJiraToken(e.target.value)} className="h-11 rounded-xl font-mono" />
                </div>
                <Button onClick={handleJiraSync} disabled={loading} className="w-full h-11 rounded-xl font-bold gap-2">
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                  Sincronizar e continuar
                </Button>
              </div>
            )}

          </CardContent>
        </Card>
      </div>
    </div>
  );
}
