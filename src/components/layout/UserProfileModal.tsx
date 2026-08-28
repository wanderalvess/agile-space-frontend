'use client';

import { useState, useEffect } from 'react';
import { useUserContext } from '@/context/UserContext';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { 
  Tabs, 
  TabsContent, 
  TabsList, 
  TabsTrigger 
} from "@/components/ui/tabs";
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select';
import { 
  ShieldCheck, 
  Fingerprint, 
  Sparkles, 
  ChevronRight, 
  ArrowLeft, 
  Check,
  User,
  Users,
  Settings,
  Shield,
  Loader2,
  RefreshCw,
  Key,
  Globe,
  CheckCircle2,
  Building2
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Separator } from '@/components/ui/separator';
import { ROLES, SQUADS, AVATAR_SEEDS, PREDEFINED_AVATARS, normalizeRole } from '@/lib/types';
import type { GlobalRole, SquadMember } from '@/lib/types';
import { cn } from '@/lib/utils';
import NiceAvatar, { genConfig } from 'react-nice-avatar';
import { userApi } from '@/app/users/api';
import { Badge } from '@/components/ui/badge';
import { authFetch } from '@/lib/auth-client';

export function UserProfileModal() {
  const {
    userProfile,
    userSquads,
    setGuestProfile,
    updateProfile,
    isEditProfileOpen,
    setIsEditProfileOpen,
    mustOnboard,
    isInitializing,
    isIdentityRequested,
    setIsIdentityRequested,
    loginWithGoogle,
    isPublicExploration,
    setIsPublicExploration
  } = useUserContext();
  
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState('profile');
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [isSyncingJira, setIsSyncingJira] = useState(false);

  const [name, setName] = useState('');
  const [role, setRole] = useState<GlobalRole | ''>('');
  
  // Projeto e Squad separados
  const [projectId, setProjectId] = useState('');
  const [customProject, setCustomProject] = useState('');
  const [isCustomProject, setIsCustomProject] = useState(false);

  const [squadId, setSquadId] = useState('');
  const [customSquad, setCustomSquad] = useState('');
  const [isCustomSquad, setIsCustomSquad] = useState(false);
  
  const [email, setEmail] = useState('');
  const [avatarSeed, setAvatarSeed] = useState(AVATAR_SEEDS[0]);
  const [step, setStep] = useState(0); // 0 = auth, 1 = profile

  // Jira PAT Token & Domain
  const [jiraDomain, setJiraDomain] = useState('');
  const [jiraToken, setJiraToken] = useState('');
  const [jiraAccountDetails, setJiraAccountDetails] = useState<any | null>(null);
  
  interface RawSquad {
    id: string;
    name: string;
    jiraProjectKey: string;
  }
  interface DbProject {
    id: string;
    name: string;
  }
  const [rawSquads, setRawSquads] = useState<RawSquad[]>([]);
  const [dbProjects, setDbProjects] = useState<DbProject[]>([]);
  const [userDbProjectIds, setUserDbProjectIds] = useState<string[]>([]);
  const [isSquadsLoaded, setIsSquadsLoaded] = useState(false);

  const isOpen = isEditProfileOpen || (isIdentityRequested && !isPublicExploration);
  const isNewUser = !userProfile || userProfile.isGuest || !userProfile.name;

  // Carrega projetos (tabela projects) e squads (tabela squads) da API
  useEffect(() => {
    if (isOpen) {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8002/api';
      
      // 1. Busca diretamente na tabela `projects` (/api/projects)
      authFetch(`${apiUrl}/projects`)
        .then(r => r.ok ? r.json() : [])
        .then((data: any[]) => {
          if (Array.isArray(data)) {
            const mapped = data.map(p => ({
              id: String(p.id || p.jiraProjectKey || '').trim(),
              name: String(p.name || p.id || '').trim()
            })).filter(p => p.id);
            setDbProjects(mapped);
          }
        })
        .catch(err => console.warn('Erro ao carregar tabela projects:', err));

      // 2. Busca os projetos vinculados ao usuário logado na tabela `projects`
      const userIdent = userProfile?.email || userProfile?.id;
      if (userIdent) {
        authFetch(`${apiUrl}/projects/user/${encodeURIComponent(userIdent)}`)
          .then(r => r.ok ? r.json() : null)
          .then((res: any) => {
            if (res && res.accessibleProjects && Array.isArray(res.accessibleProjects)) {
              const pIds = res.accessibleProjects.map((p: any) => String(p.projectId || '').trim()).filter(Boolean);
              setUserDbProjectIds(pIds);
            }
          })
          .catch(() => {});
      }

      // 3. Busca squads diretamente na tabela `squads` (/api/squads)
      authFetch(`${apiUrl}/squads`)
        .then(r => r.ok ? r.json() : [])
        .then((data: any[]) => {
          if (Array.isArray(data)) {
            const parsed: RawSquad[] = data
              .filter(s => s && (s.id || s.jiraProjectKey))
              .map(s => ({
                id: String(s.id || s.jiraProjectKey).trim(),
                name: String(s.name || s.jiraProjectKey || s.id).trim(),
                jiraProjectKey: String(s.jiraProjectKey || s.id).trim()
              }));
            setRawSquads(parsed);
          }
        })
        .catch(err => console.warn('Erro ao carregar tabela squads:', err))
        .finally(() => setIsSquadsLoaded(true));
    }
  }, [isOpen, userProfile?.email, userProfile?.id]);

  // 1. Identificadores de Squads/Projetos vinculados no banco ao usuário logado
  const userSquadIds = (function() {
    const ids = new Set<string>();
    if (userSquads && Array.isArray(userSquads)) {
      userSquads.forEach(s => {
        if (s.squadId) ids.add(s.squadId.trim());
      });
    }
    userDbProjectIds.forEach(id => ids.add(id));
    if (userProfile?.squadId) {
      ids.add(userProfile.squadId.trim());
    }
    return ids;
  })();

  // 2. Filtra exclusivamente as squads/projetos do banco que possuem vínculo com o usuário
  const allowedRawSquads = (function() {
    if (userSquadIds.size > 0) {
      const filtered = rawSquads.filter(s => {
        const idMatch = userSquadIds.has(s.id);
        const keyMatch = userSquadIds.has(s.jiraProjectKey);
        return idMatch || keyMatch;
      });
      if (filtered.length > 0) return filtered;
    }
    return rawSquads;
  })();

  // 3. Deriva a lista de Projetos vinculados diretamente da tabela `projects` no PostgreSQL
  const availableProjects = (function() {
    const map = new Map<string, string>();

    // Prioriza os projetos da tabela `projects` que têm vínculo com o usuário
    if (userDbProjectIds.length > 0) {
      userDbProjectIds.forEach(id => {
        const found = dbProjects.find(p => p.id.toLowerCase() === id.toLowerCase());
        map.set(id, found ? found.name : id);
      });
    }

    // Se o mapa ainda estiver vazio ou para complementar com projetos do banco
    if (map.size === 0 && dbProjects.length > 0) {
      dbProjects.forEach(p => {
        if (!map.has(p.id)) map.set(p.id, p.name);
      });
    }

    // Complementa com projetos vinculados nas squads salvas
    allowedRawSquads.forEach(s => {
      const key = (s.jiraProjectKey || s.id || '').trim();
      const name = (s.name || s.jiraProjectKey || s.id || '').trim();
      if (key && !map.has(key)) map.set(key, name);
    });

    if (userProfile?.squadId && !map.has(userProfile.squadId)) {
      const match = rawSquads.find(rs => rs.id === userProfile.squadId);
      const projKey = match ? (match.jiraProjectKey || match.id) : userProfile.squadId;
      if (projKey && !map.has(projKey)) {
        map.set(projKey, projKey);
      }
    }

    return Array.from(map.entries()).map(([id, name]) => ({ id, name }));
  })();

  // 4. Deriva as Squads vinculadas ao Projeto selecionado (exclusivamente do banco)
  const availableSquadsForProject = (function() {
    if (!projectId || projectId === 'other') return [];
    return allowedRawSquads
      .filter(s => {
        const pKey = (s.jiraProjectKey || s.id || '').toLowerCase();
        const target = projectId.toLowerCase();
        return pKey === target && s.id.toLowerCase() !== target;
      })
      .map(s => ({ id: s.id, name: s.name || s.id }));
  })();

  // Carrega configurações de Jira salvas
  useEffect(() => {
    try {
      const savedDomain = localStorage.getItem('agileSpace_jiraSync_domain') || localStorage.getItem('agileSpace_jiraDomain') || '';
      const savedToken = localStorage.getItem('agileSpace_jiraSync_token') || localStorage.getItem('agileSpace_jiraToken') || '';
      setJiraDomain(savedDomain);
      setJiraToken(savedToken);
    } catch {}
  }, [isOpen]);

  useEffect(() => {
    if (userProfile && isOpen && isSquadsLoaded) {
      setName(userProfile.name || '');
      const initialRole = userProfile.role ? normalizeRole(userProfile.role) : '';
      setRole(initialRole);
      setEmail(userProfile.email || '');
      setAvatarSeed(userProfile.avatarSeed || AVATAR_SEEDS[0]);

      const activeSquadOrProject = userProfile.squadId || '';
      const foundSquad = rawSquads.find(s => s.id === activeSquadOrProject);
      if (foundSquad) {
        setProjectId(foundSquad.jiraProjectKey || foundSquad.id);
        if (foundSquad.id !== foundSquad.jiraProjectKey) {
          setSquadId(foundSquad.id);
        } else {
          setSquadId('none');
        }
      } else if (availableProjects.some(p => p.id === activeSquadOrProject)) {
        setProjectId(activeSquadOrProject);
        setSquadId('none');
      } else if (activeSquadOrProject) {
        setProjectId('other');
        setCustomProject(activeSquadOrProject);
        setIsCustomProject(true);
      }

      if (!userProfile.isGuest && userProfile.name) {
        setStep(1);
      } else if (!userProfile.name && !userProfile.isGuest) {
        setStep(0);
      }
    }
  }, [userProfile, isOpen, isSquadsLoaded, rawSquads]);

  const onGoogleLogin = async () => {
    setIsLoggingIn(true);
    try {
      await loginWithGoogle();
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleSyncFromJira = async (customToken?: string, customDomain?: string) => {
    const tokenToUse = (customToken || jiraToken || localStorage.getItem('agileSpace_jiraToken') || localStorage.getItem('agileSpace_jiraSync_token') || '').trim();
    const domainToUse = (customDomain || jiraDomain || localStorage.getItem('agileSpace_jiraSync_domain') || '').trim();

    if (!tokenToUse) {
      toast({
        title: "Token Jira necessário",
        description: "Informe o seu Personal Access Token (PAT) do Jira para puxar seus dados automaticamente.",
        variant: "destructive",
      });
      setActiveTab('security');
      return;
    }

    setIsSyncingJira(true);
    try {
      const jiraUser = await userApi.getMyself(domainToUse, tokenToUse);
      if (jiraUser) {
        if (jiraUser.displayName) setName(jiraUser.displayName);
        const resolvedEmail = jiraUser.emailAddress || email || '';
        if (resolvedEmail) setEmail(resolvedEmail);

        // Salva tokens no localStorage
        localStorage.setItem('agileSpace_jiraToken', tokenToUse);
        localStorage.setItem('agileSpace_jiraSync_token', tokenToUse);
        localStorage.setItem('agileSpace_jiraSync_domain', domainToUse);
        setJiraToken(tokenToUse);
        setJiraDomain(domainToUse);
        setJiraAccountDetails(jiraUser);

        setStep(1);
        toast({
          title: "Jira Sincronizado!",
          description: `Identidade carregada: ${jiraUser.displayName || jiraUser.name}. Seus campos de Projeto e Squad foram mantidos.`,
        });
      }
    } catch (err: any) {
      toast({
        title: "Erro ao conectar ao Jira",
        description: err.message || "Verifique o token e o domínio corporativo.",
        variant: "destructive",
      });
    } finally {
      setIsSyncingJira(false);
    }
  };

  const handleSave = () => {
    if (!name.trim()) {
      toast({ title: "Nome obrigatório", variant: "destructive" });
      return;
    }
    if (!role) {
      toast({ title: "Função obrigatória", variant: "destructive" });
      return;
    }

    const finalProject = isCustomProject ? customProject.trim() : projectId;
    const finalSquad = isCustomSquad 
      ? customSquad.trim() 
      : (squadId && squadId !== 'none' ? squadId : finalProject);

    if (!finalProject && !finalSquad) {
      toast({ title: "Projeto obrigatório", variant: "destructive" });
      return;
    }

    if (!userProfile || userProfile.isGuest) {
      setGuestProfile(
        name.trim(),
        role as GlobalRole,
        finalSquad,
        email.trim(),
        avatarSeed
      );
    } else {
      updateProfile({
        name: name.trim(),
        role: role as GlobalRole,
        squadId: finalSquad,
        email: email.trim(),
        avatarSeed,
      });
    }

    toast({
      title: "Perfil Atualizado",
      description: "Suas informações foram salvas com sucesso no sistema.",
    });

    setIsEditProfileOpen(false);
    setIsIdentityRequested(false);
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => {
      if (!open) {
        setIsEditProfileOpen(false);
        setIsIdentityRequested(false);
      }
    }}>
      <DialogContent className="sm:max-w-[560px] rounded-[2rem] p-0 overflow-hidden bg-card text-card-foreground border border-border/80 shadow-2xl font-body animate-in zoom-in-95 duration-200 focus:outline-none">
        
        {/* HERO HEADER */}
        <div className="relative overflow-hidden shrink-0 bg-slate-950 text-slate-50 border-b border-white/10">
          <div className="absolute -top-20 -left-20 w-64 h-64 bg-primary/25 blur-[80px] rounded-full pointer-events-none transition-colors duration-500" />
          <div className="absolute -bottom-20 -right-20 w-64 h-64 bg-primary/15 blur-[80px] rounded-full pointer-events-none transition-colors duration-500" />
          <div className="absolute inset-0 bg-[radial-gradient(rgba(255,255,255,0.04)_1px,transparent_1px)] [background-size:16px_16px]" />
          
          <div className="relative px-6 py-4 flex items-center justify-between z-10">
            <div className="space-y-0.5">
              <DialogTitle className="text-xl font-black uppercase tracking-tighter italic text-white leading-none font-headline flex items-center gap-2">
                Minha <span className="text-primary not-italic transition-colors duration-300">Identidade</span>
              </DialogTitle>
              <div className="flex items-center gap-2 mt-1">
                <DialogDescription className="text-slate-400 text-[10px] font-bold uppercase tracking-widest font-body">
                  Gestão de Perfil & Integração Jira API
                </DialogDescription>
                {jiraToken && (
                  <Badge className="bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-[8px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md">
                    Jira Ativo
                  </Badge>
                )}
              </div>
            </div>
            
            <div className="relative shrink-0 z-10">
               <div className="absolute inset-0 bg-primary/30 blur-md rounded-full opacity-60 transition-opacity duration-300" />
               <NiceAvatar 
                 className="h-11 w-11 rounded-xl border-2 border-white/20 shadow-md bg-slate-900 relative z-10" 
                 {...(PREDEFINED_AVATARS[avatarSeed] || genConfig(avatarSeed))} 
               />
            </div>
          </div>

          <div className="px-6 pb-2 relative z-10">
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
              <TabsList className="bg-white/10 backdrop-blur-md border border-white/10 p-0.5 h-8 rounded-lg w-full max-w-[280px]">
                <TabsTrigger 
                  value="profile" 
                  className="rounded-md text-[9px] font-black uppercase tracking-widest text-slate-300 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground transition-all flex-1 py-1 shadow-sm"
                >
                  <User className="h-3 w-3 mr-1.5" />
                  Perfil
                </TabsTrigger>
                <TabsTrigger 
                  value="security" 
                  className="rounded-lg text-[9px] font-black uppercase tracking-widest text-slate-300 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground transition-all flex-1 py-1 shadow-sm"
                >
                  <Shield className="h-3 w-3 mr-1.5" />
                  Jira & Segurança
                </TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
        </div>

        <div className="bg-card text-card-foreground transition-colors duration-300">
          <Tabs value={activeTab} className="w-full">
            <TabsContent value="profile" className="m-0 px-6 py-4 space-y-3.5 animate-in fade-in duration-200">
              
              {/* GRID NOME & EMAIL */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground flex items-center gap-1.5">
                    <User className="h-3.5 w-3.5 text-primary" /> Nome Completo
                  </Label>
                  <Input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="h-9 rounded-xl bg-background/50 border-input text-foreground placeholder:text-muted-foreground/40 font-bold text-xs focus-visible:ring-primary focus-visible:border-primary transition-all"
                    placeholder="Seu nome completo"
                  />
                </div>

                <div className="space-y-1">
                  <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground flex items-center gap-1.5">
                    <ChevronRight className="h-3.5 w-3.5 text-primary" /> E-mail Corporativo
                  </Label>
                  <Input
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="h-9 rounded-xl bg-background/50 border-input text-foreground placeholder:text-muted-foreground/40 font-bold text-xs focus-visible:ring-primary focus-visible:border-primary transition-all"
                    placeholder="seu.email@empresa.com"
                  />
                </div>
              </div>

              {/* GRID CARGO & PROJETO */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground flex items-center gap-1.5">
                    <ChevronRight className="h-3.5 w-3.5 text-primary" /> Cargo / Papel
                  </Label>
                  <Select value={role} onValueChange={(v: GlobalRole) => setRole(v)}>
                    <SelectTrigger className="h-9 rounded-xl bg-background/50 border-input text-foreground font-bold text-xs focus-visible:ring-primary focus-visible:border-primary transition-all">
                      <SelectValue placeholder="Selecione o cargo..." />
                    </SelectTrigger>
                    <SelectContent className="rounded-xl border border-border bg-card shadow-2xl p-1 max-h-[220px]">
                      {ROLES.map(r => (
                        <SelectItem
                          key={r}
                          value={r}
                          className="font-bold text-xs py-1.5 pl-7 rounded-lg focus:bg-primary/10 focus:text-primary text-foreground uppercase tracking-tight"
                        >
                          {r}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1">
                  <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground flex items-center gap-1.5">
                    <Building2 className="h-3.5 w-3.5 text-primary" /> Projeto
                  </Label>
                  <Select
                    value={availableProjects.some(p => p.id === projectId) ? projectId : (projectId ? 'other' : '')}
                    onValueChange={(v) => {
                      setProjectId(v);
                      setIsCustomProject(v === 'other');
                      setSquadId('none');
                    }}
                  >
                    <SelectTrigger className="h-9 rounded-xl bg-background/50 border-input text-foreground font-bold text-xs focus-visible:ring-primary focus-visible:border-primary transition-all">
                      <SelectValue placeholder="Selecione o projeto..." />
                    </SelectTrigger>
                    <SelectContent className="rounded-xl border border-border bg-card shadow-2xl p-1 max-h-[220px]">
                      {!isSquadsLoaded && (
                        <SelectItem value="loading" disabled className="text-xs text-muted-foreground font-bold">
                          Carregando projetos...
                        </SelectItem>
                      )}
                      {isSquadsLoaded && availableProjects.map(p => (
                        <SelectItem
                          key={p.id}
                          value={p.id}
                          className="font-bold text-xs py-1.5 pl-7 rounded-lg focus:bg-primary/10 focus:text-primary text-foreground uppercase tracking-tight"
                        >
                          {p.name}
                        </SelectItem>
                      ))}
                      <SelectItem
                        value="other"
                        className="text-[10px] font-black text-primary py-1.5 pl-7 rounded-lg focus:bg-primary/10 focus:text-primary border-t border-border/70 mt-1"
                      >
                        + Digitar Novo Projeto
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* GRID SQUAD & AVATAR */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground flex items-center gap-1.5">
                    <Users className="h-3.5 w-3.5 text-primary" /> Squad / Equipe
                  </Label>
                  <Select
                    disabled={!projectId || (availableSquadsForProject.length === 0 && projectId !== 'other')}
                    value={availableSquadsForProject.some(sq => sq.id === squadId) ? squadId : (squadId === 'other' ? 'other' : 'none')}
                    onValueChange={(v) => { setSquadId(v); setIsCustomSquad(v === 'other'); }}
                  >
                    <SelectTrigger className="h-9 rounded-xl bg-background/50 border-input text-foreground font-bold text-xs focus-visible:ring-primary focus-visible:border-primary transition-all disabled:opacity-60">
                      <SelectValue placeholder={
                        !projectId 
                          ? "Selecione um projeto primeiro" 
                          : (availableSquadsForProject.length === 0 ? "Sem Squad (Projeto Único)" : "Selecione a squad...")
                      } />
                    </SelectTrigger>
                    <SelectContent className="rounded-xl border border-border bg-card shadow-2xl p-1 max-h-[220px]">
                      <SelectItem value="none" className="text-xs font-medium py-1.5 pl-7 text-muted-foreground">
                        Sem Squad (Projeto Único)
                      </SelectItem>
                      {availableSquadsForProject.map(sq => (
                        <SelectItem
                          key={sq.id}
                          value={sq.id}
                          className="font-bold text-xs py-1.5 pl-7 rounded-lg focus:bg-primary/10 focus:text-primary text-foreground uppercase tracking-tight"
                        >
                          {sq.name}
                        </SelectItem>
                      ))}
                      <SelectItem
                        value="other"
                        className="text-[10px] font-black text-primary py-1.5 pl-7 rounded-lg focus:bg-primary/10 focus:text-primary border-t border-border/70 mt-1"
                      >
                        + Digitar Nova Squad
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1">
                  <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground flex items-center gap-1.5">
                    <ChevronRight className="h-3.5 w-3.5 text-primary" /> Avatar Escolhido
                  </Label>
                  <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5 pr-1">
                    {AVATAR_SEEDS.map((seed) => (
                      <button
                        key={seed}
                        type="button"
                        onClick={() => setAvatarSeed(seed)}
                        className={cn(
                          "relative shrink-0 h-8 w-8 transition-all rounded-lg border-2",
                          avatarSeed === seed ? "border-primary scale-105 shadow-md shadow-primary/20" : "border-transparent opacity-50 hover:opacity-80"
                        )}
                      >
                        <NiceAvatar className="w-full h-full rounded-[6px]" {...(PREDEFINED_AVATARS[seed] || genConfig(seed))} />
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* CAMPOS CUSTOMIZADOS SE NECESSÁRIO */}
              {isCustomProject && (
                <div className="animate-in slide-in-from-top-2 duration-200 space-y-1">
                  <Label className="text-[10px] font-black uppercase tracking-widest text-primary">Nome do Projeto Customizado</Label>
                  <Input 
                    value={customProject} 
                    onChange={(e) => setCustomProject(e.target.value)} 
                    className="h-9 rounded-xl border-primary/30 bg-primary/5 font-bold text-xs text-foreground focus-visible:ring-primary focus-visible:border-primary" 
                    placeholder="Nome do projeto"
                  />
                </div>
              )}

              {isCustomSquad && (
                <div className="animate-in slide-in-from-top-2 duration-200 space-y-1">
                  <Label className="text-[10px] font-black uppercase tracking-widest text-primary">Nome da Squad Customizada</Label>
                  <Input 
                    value={customSquad} 
                    onChange={(e) => setCustomSquad(e.target.value)} 
                    className="h-9 rounded-xl border-primary/30 bg-primary/5 font-bold text-xs text-foreground focus-visible:ring-primary focus-visible:border-primary" 
                    placeholder="Nome da squad"
                  />
                </div>
              )}
            </TabsContent>

            <TabsContent value="security" className="m-0 px-6 py-4 space-y-3.5 animate-in fade-in duration-200">
              <div className="space-y-3">
                <div>
                  <h4 className="text-xs font-black uppercase tracking-widest text-foreground flex items-center gap-2 font-headline">
                    <Key className="h-4 w-4 text-primary" /> Conexão Jira API & Token
                  </h4>
                  <p className="text-[10px] text-muted-foreground mt-0.5 font-medium">
                    Configure seu Personal Access Token (PAT) para consultar seus dados no endpoint <code>/rest/api/2/myself</code>.
                  </p>
                </div>

                <div className="space-y-2.5 bg-muted/30 p-3 rounded-xl border border-border/70">
                  <div className="space-y-1">
                    <Label className="text-[9px] font-black uppercase tracking-widest text-muted-foreground flex items-center gap-1.5">
                      <Globe className="h-3 w-3 text-primary" /> Domínio Jira
                    </Label>
                    <Input
                      value={jiraDomain}
                      onChange={(e) => setJiraDomain(e.target.value)}
                      placeholder="jira.empresa.com"
                      className="h-9 rounded-xl text-xs bg-background/50 border-input text-foreground font-medium focus-visible:ring-primary focus-visible:border-primary"
                    />
                  </div>

                  <div className="space-y-1">
                    <Label className="text-[9px] font-black uppercase tracking-widest text-muted-foreground flex items-center gap-1.5">
                      <Key className="h-3 w-3 text-primary" /> Token de Acesso (PAT)
                    </Label>
                    <Input
                      type="password"
                      value={jiraToken}
                      onChange={(e) => setJiraToken(e.target.value)}
                      placeholder="Cole seu Personal Access Token do Jira"
                      className="h-9 rounded-xl text-xs bg-background/50 border-input text-foreground font-mono focus-visible:ring-primary focus-visible:border-primary"
                    />
                  </div>

                  <Button
                    type="button"
                    onClick={() => handleSyncFromJira(jiraToken, jiraDomain)}
                    disabled={isSyncingJira}
                    className="w-full h-9 rounded-xl bg-primary hover:opacity-90 text-primary-foreground font-black uppercase text-[10px] tracking-widest gap-2 shadow-md shadow-primary/20 transition-all mt-1"
                  >
                    {isSyncingJira ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
                    {isSyncingJira ? 'Sincronizando...' : 'Testar e Puxar Dados do Jira'}
                  </Button>
                </div>

                {jiraAccountDetails && (
                  <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 space-y-1.5 animate-in fade-in">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                      <span className="text-xs font-black uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
                        Conta Jira Conectada
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-[11px]">
                      <div>
                        <span className="text-muted-foreground text-[9px] uppercase font-bold block">Nome de Exibição</span>
                        <span className="font-bold text-foreground">{jiraAccountDetails.displayName || '—'}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground text-[9px] uppercase font-bold block">Usuário</span>
                        <span className="font-mono text-foreground">{jiraAccountDetails.name || jiraAccountDetails.key || '—'}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground text-[9px] uppercase font-bold block">E-mail</span>
                        <span className="text-foreground">{jiraAccountDetails.emailAddress || '—'}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground text-[9px] uppercase font-bold block">Fuso Horário</span>
                        <span className="text-foreground">{jiraAccountDetails.timeZone || '—'}</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </TabsContent>
          </Tabs>
        </div>

        {activeTab === 'profile' && (
          <div className="shrink-0 px-6 py-3 border-t border-border/70 bg-card flex items-center justify-between transition-colors duration-300">
            <div className="flex gap-2">
               <Button
                onClick={handleSave}
                className="h-9 px-7 rounded-xl bg-primary hover:opacity-90 text-primary-foreground font-black uppercase text-[10px] tracking-widest shadow-md shadow-primary/20 active:scale-95 transition-all"
               >
                 {mustOnboard ? 'Finalizar Acesso' : 'Salvar Alterações'}
               </Button>
            </div>
          </div>
        )}

      </DialogContent>
    </Dialog>
  );
}

