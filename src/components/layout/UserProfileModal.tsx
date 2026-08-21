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
import { ROLES, SQUADS, AVATAR_SEEDS, PREDEFINED_AVATARS } from '@/lib/types';
import type { GlobalRole, SquadMember } from '@/lib/types';
import { cn } from '@/lib/utils';
import NiceAvatar, { genConfig } from 'react-nice-avatar';
import { userApi } from '@/app/users/api';
import { Badge } from '@/components/ui/badge';

export function UserProfileModal() {
  const {
    userProfile,
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
  const [squadId, setSquadId] = useState('');
  const [customSquad, setCustomSquad] = useState('');
  const [isCustomSquad, setIsCustomSquad] = useState(false);
  const [email, setEmail] = useState('');
  const [avatarSeed, setAvatarSeed] = useState(AVATAR_SEEDS[0]);
  const [step, setStep] = useState(0); // 0 = auth, 1 = profile

  // Jira PAT Token & Domain
  const [jiraDomain, setJiraDomain] = useState('jiraproducao.totvs.com.br');
  const [jiraToken, setJiraToken] = useState('');
  const [jiraAccountDetails, setJiraAccountDetails] = useState<any | null>(null);
  
  const [dynamicSquads, setDynamicSquads] = useState<string[]>([]);
  const [isSquadsLoaded, setIsSquadsLoaded] = useState(false);

  const isOpen = isEditProfileOpen || ((mustOnboard || isIdentityRequested) && !isPublicExploration);
  const isNewUser = !userProfile || userProfile.isGuest || !userProfile.name;

  // Carrega squads da API
  useEffect(() => {
    if (isOpen) {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8002/api';
      fetch(`${apiUrl}/squads`)
        .then(r => r.ok ? r.json() : [])
        .then(data => {
          if (Array.isArray(data)) {
            const mapped = data.map((s: any) => s.id || s.jiraProjectKey).filter(Boolean);
            setDynamicSquads(mapped);
          }
        })
        .catch(err => console.warn('Erro ao carregar projetos:', err))
        .finally(() => setIsSquadsLoaded(true));
    }
  }, [isOpen]);

  // Carrega configurações de Jira salvas
  useEffect(() => {
    try {
      const savedDomain = localStorage.getItem('agileSpace_jiraSync_domain') || localStorage.getItem('agileSpace_jiraDomain') || 'jiraproducao.totvs.com.br';
      const savedToken = localStorage.getItem('agileSpace_jiraSync_token') || localStorage.getItem('agileSpace_jiraToken') || '';
      setJiraDomain(savedDomain);
      setJiraToken(savedToken);
    } catch {}
  }, [isOpen]);

  // Forçar step 0 se for um novo usuário abrindo o modal pela primeira vez nesta sessão
  useEffect(() => {
    if (isOpen && isNewUser && !userProfile?.name) {
      setStep(0);
    }
  }, [isOpen, isNewUser, userProfile?.name]);

  useEffect(() => {
    if (userProfile && isOpen && isSquadsLoaded) {
      setName(userProfile.name || '');
      setRole(userProfile.role || '');
      setEmail(userProfile.email || '');
      setAvatarSeed(userProfile.avatarSeed || AVATAR_SEEDS[0]);

      // Combina a lista da API com os SQUADS hardcoded apenas para não quebrar 
      // quem tem squads antigos, mas só vamos renderizar os da API ou o atual do usuário
      const allKnown = Array.from(new Set([...dynamicSquads, ...SQUADS]));
      const isPredefined = allKnown.includes(userProfile.squadId);
      
      if (userProfile.squadId && !isPredefined) {
        setSquadId('other');
        setCustomSquad(userProfile.squadId);
        setIsCustomSquad(true);
      } else {
        setSquadId(userProfile.squadId || '');
        setIsCustomSquad(false);
      }

      if (!userProfile.isGuest && userProfile.name) {
        setStep(1);
      } else if (!userProfile.name && !userProfile.isGuest) {
        setStep(0);
      }
    }
  }, [userProfile, isOpen, isSquadsLoaded, dynamicSquads]);

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
    const domainToUse = (customDomain || jiraDomain || localStorage.getItem('agileSpace_jiraSync_domain') || 'jiraproducao.totvs.com.br').trim();

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
        const resolvedEmail = jiraUser.emailAddress || (jiraUser.name ? `${jiraUser.name}@totvs.com.br` : '');
        if (resolvedEmail) setEmail(resolvedEmail);

        // Salva tokens no localStorage
        localStorage.setItem('agileSpace_jiraToken', tokenToUse);
        localStorage.setItem('agileSpace_jiraSync_token', tokenToUse);
        localStorage.setItem('agileSpace_jiraSync_domain', domainToUse);
        setJiraToken(tokenToUse);
        setJiraDomain(domainToUse);
        setJiraAccountDetails(jiraUser);

        // Busca se o usuário já tem squad e cargo registrado no banco local
        try {
          const id = resolvedEmail || jiraUser.name || jiraUser.key || jiraUser.accountId;
          const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8002/api';
          const res = await fetch(`${apiUrl}/squads/by-user?identifier=${encodeURIComponent(id)}`);
          if (res.ok) {
            const data: SquadMember[] = await res.json();
            if (Array.isArray(data) && data.length > 0) {
              const first = data[0];
              if (first.squadId) {
                // Se a squad recuperada está na lista de projetos dinâmicos ou nos SQUADS antigos
                const allKnown = Array.from(new Set([...dynamicSquads, ...SQUADS]));
                const isPredefined = allKnown.includes(first.squadId);
                if (isPredefined) {
                  setSquadId(first.squadId);
                  setIsCustomSquad(false);
                } else {
                  setSquadId('other');
                  setCustomSquad(first.squadId);
                  setIsCustomSquad(true);
                }
              }
              if (first.role) setRole(first.role as GlobalRole);
            }
          }
        } catch (squadErr) {
          console.debug("Squad check error:", squadErr);
        }

        setStep(1);
        toast({
          title: "Jira Sincronizado!",
          description: `Identidade carregada: ${jiraUser.displayName || jiraUser.name}`,
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

    const finalSquad = isCustomSquad ? customSquad.trim() : squadId;
    if (!finalSquad) {
      toast({ title: "Squad obrigatória", variant: "destructive" });
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

    setIsEditProfileOpen(false);
    setIsIdentityRequested(false);
    setIsPublicExploration(true);

    toast({
      title: mustOnboard ? "Bem-vindo ao Espaço Ágil!" : "Perfil Atualizado",
      description: "Sua identidade foi sincronizada com sucesso.",
    });
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => {
      if (open) {
        setIsEditProfileOpen(true);
        return;
      }
      if (mustOnboard || isIdentityRequested) {
        setIsPublicExploration(true);
      }
      setIsEditProfileOpen(false);
      setIsIdentityRequested(false);
    }}>
      <DialogContent className="sm:max-w-[650px] max-h-[95vh] overflow-hidden bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-[2.5rem] shadow-2xl p-0 font-body animate-in zoom-in-95 duration-300 flex flex-col focus:outline-none">
        
        {/* HERO HEADER */}
        <div className="relative overflow-hidden shrink-0">
          <div className="absolute inset-0 bg-slate-900 dark:bg-slate-950" />
          <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/20 via-transparent to-cyan-500/10" />
          <div className="absolute inset-0 bg-[radial-gradient(rgba(255,255,255,0.05)_1px,transparent_1px)] [background-size:16px_16px]" />
          
          <div className="relative p-8 pb-6 flex items-center justify-between">
            <div className="space-y-1">
              <DialogTitle className="text-3xl font-black uppercase tracking-tighter italic text-white leading-none">
                <div dangerouslySetInnerHTML={{ __html: isInitializing ? 'Sincronizando...' : 'Minha <span class="text-indigo-400 not-italic">Identidade</span>' }} className="contents" />
              </DialogTitle>
              <DialogDescription className="text-white/40 text-[10px] font-bold uppercase tracking-widest mt-2 flex items-center gap-2">
                Gestão de Perfil & Integração Jira API
                {jiraToken && (
                  <Badge className="bg-emerald-500/20 text-emerald-300 border-none text-[8px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md">
                    Jira Ativo
                  </Badge>
                )}
              </DialogDescription>
            </div>
            
            <div className="relative shrink-0">
               <div className="absolute inset-0 bg-white/20 blur-2xl rounded-full opacity-0 group-hover:opacity-100 transition-opacity" />
               <NiceAvatar 
                 className="h-16 w-16 rounded-2xl border-4 border-white/10 shadow-2xl bg-slate-800" 
                 {...(PREDEFINED_AVATARS[avatarSeed] || genConfig(avatarSeed))} 
               />
            </div>
          </div>

          <div className="px-8 pb-2">
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
              <TabsList className="bg-white/5 border border-white/10 p-1 h-11 rounded-xl w-full max-w-[320px]">
                <TabsTrigger 
                  value="profile" 
                  className="rounded-lg text-[9px] font-black uppercase tracking-widest data-[state=active]:bg-white data-[state=active]:text-slate-900 data-[state=active]:dark:bg-slate-800 data-[state=active]:dark:text-slate-100 transition-all flex-1"
                >
                  <User className="h-3 w-3 mr-2" />
                  Perfil
                </TabsTrigger>
                <TabsTrigger 
                  value="security" 
                  className="rounded-lg text-[9px] font-black uppercase tracking-widest data-[state=active]:bg-white data-[state=active]:text-slate-900 data-[state=active]:dark:bg-slate-800 data-[state=active]:dark:text-slate-100 transition-all flex-1"
                >
                  <Shield className="h-3 w-3 mr-2" />
                  Jira & Segurança
                </TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto no-scrollbar">
          <Tabs value={activeTab} className="w-full h-full">
            <TabsContent value="profile" className="m-0 p-8 pt-6 space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-400">
              
              {isNewUser && step === 0 ? (
                <div className="space-y-4">
                  {/* Botão Sincronizar com Jira */}
                  <button
                    onClick={() => handleSyncFromJira()}
                    disabled={isSyncingJira}
                    className="w-full h-16 rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white border-2 border-transparent shadow-lg shadow-indigo-500/20 transition-all flex items-center justify-center gap-4 group active:scale-[0.98] disabled:opacity-50"
                  >
                    {isSyncingJira ? (
                      <Loader2 className="h-5 w-5 animate-spin text-white" />
                    ) : (
                      <>
                        <div className="w-8 h-8 flex items-center justify-center bg-white/10 rounded-lg backdrop-blur-sm">
                          <RefreshCw className="h-4 w-4 text-white" />
                        </div>
                        <span className="text-xs font-black uppercase tracking-widest text-white">
                          Puxar Dados do Jira (/myself)
                        </span>
                      </>
                    )}
                  </button>

                  <button
                    onClick={onGoogleLogin}
                    disabled={isLoggingIn}
                    className="w-full h-16 rounded-2xl bg-white dark:bg-slate-900 border-2 border-slate-100 dark:border-slate-800 hover:border-indigo-200 dark:hover:border-indigo-900 hover:shadow-xl dark:hover:shadow-none transition-all flex items-center justify-center gap-4 group active:scale-[0.98] disabled:opacity-50"
                  >
                    {isLoggingIn ? <Loader2 className="h-5 w-5 animate-spin text-slate-400" /> : (
                      <>
                        <div className="w-8 h-8 flex items-center justify-center bg-white dark:bg-slate-950 rounded-lg shadow-sm border border-slate-100 dark:border-slate-800">
                           <svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>
                        </div>
                        <span className="text-xs font-black uppercase tracking-widest text-slate-700 dark:text-slate-200">Entrar com Google</span>
                      </>
                    )}
                  </button>

                  <div className="relative flex items-center py-2">
                    <div className="flex-grow border-t border-slate-100 dark:border-slate-800"></div>
                    <span className="flex-shrink mx-4 text-[8px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.3em]">ou</span>
                    <div className="flex-grow border-t border-slate-100 dark:border-slate-800"></div>
                  </div>

                  <button
                    onClick={() => setStep(1)}
                    className="w-full h-16 rounded-2xl bg-slate-50 dark:bg-slate-900/40 border-2 border-dashed border-slate-200 dark:border-slate-800 hover:border-slate-350 dark:hover:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-900/60 transition-all flex items-center justify-center gap-3 group active:scale-[0.98]"
                  >
                    <Fingerprint className="h-5 w-5 text-slate-400 dark:text-slate-500" />
                    <span className="text-xs font-black uppercase tracking-widest text-slate-650 dark:text-slate-350">Preencher Perfil Manualmente</span>
                  </button>

                  <button
                    onClick={() => setIsPublicExploration(true)}
                    className="w-full text-center pt-1 text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 transition-colors active:scale-[0.98]"
                  >
                    Explorar como visitante
                  </button>
                </div>
              ) : (
                <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
                  
                  {/* Atalho de sincronização rápida com o Jira */}
                  <div className="flex items-center justify-between p-3 rounded-2xl bg-indigo-50/50 dark:bg-indigo-950/20 border border-indigo-100 dark:border-indigo-900/30">
                    <div className="flex items-center gap-2.5">
                      <div className="p-2 rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400">
                        <RefreshCw className={cn("h-4 w-4", isSyncingJira && "animate-spin")} />
                      </div>
                      <div>
                        <p className="text-[11px] font-bold text-slate-800 dark:text-slate-200">Sincronizar com o Jira</p>
                        <p className="text-[9px] text-slate-400">Atualiza seu nome, e-mail e dados via API corporativa (/myself)</p>
                      </div>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => handleSyncFromJira()}
                      disabled={isSyncingJira}
                      className="h-8 rounded-xl text-[9px] font-black uppercase tracking-widest gap-1.5 border-indigo-200 dark:border-indigo-800 text-indigo-600 dark:text-indigo-300 hover:bg-indigo-100 dark:hover:bg-indigo-900/50"
                    >
                      {isSyncingJira ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
                      Atualizar do Jira
                    </Button>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-400 ml-1 flex items-center gap-2">
                      <User className="h-3.5 w-3.5 text-indigo-500" /> Nome Completo
                    </Label>
                    <Input
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="h-12 rounded-xl border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/40 font-bold text-sm focus:bg-white dark:focus:bg-slate-950 dark:text-slate-100 transition-all"
                      placeholder="Ex: Wanderson Alves"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-400 ml-1 flex items-center gap-2">
                      <ChevronRight className="h-3.5 w-3.5 text-indigo-500" /> E-mail Corporativo
                    </Label>
                    <Input
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="h-12 rounded-xl border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/40 font-bold text-sm focus:bg-white dark:focus:bg-slate-950 dark:text-slate-100 transition-all"
                      placeholder="exemplo@totvs.com.br"
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-400 ml-1 flex items-center gap-2">
                        <ChevronRight className="h-3.5 w-3.5 text-indigo-500" /> Cargo / Papel
                      </Label>
                      <Select value={role} onValueChange={(v: GlobalRole) => setRole(v)}>
                        <SelectTrigger className="h-12 rounded-xl border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/40 font-bold text-sm dark:text-slate-100">
                          <SelectValue placeholder="Selecione..." />
                        </SelectTrigger>
                        <SelectContent className="rounded-xl border border-slate-200 dark:border-slate-800 dark:bg-slate-950 shadow-2xl p-2">
                          {ROLES.map(r => (
                            <SelectItem
                              key={r}
                              value={r}
                              className="font-bold text-xs py-3 pl-8 rounded-lg focus:bg-slate-100 dark:focus:bg-slate-900 focus:text-slate-900 dark:focus:text-slate-100 text-slate-700 dark:text-slate-350 uppercase tracking-tight"
                            >
                              {r}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-400 ml-1 flex items-center gap-2">
                        <Building2 className="h-3.5 w-3.5 text-indigo-500" /> Projeto / Equipe
                      </Label>
                      <Select
                        value={(dynamicSquads.includes(squadId) || SQUADS.includes(squadId)) ? squadId : (squadId ? 'other' : '')}
                        onValueChange={(v) => { setSquadId(v); setIsCustomSquad(v === 'other'); }}
                      >
                        <SelectTrigger className="h-12 rounded-xl border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/40 font-bold text-sm dark:text-slate-100">
                          <SelectValue placeholder="Selecione..." />
                        </SelectTrigger>
                        <SelectContent className="rounded-xl border border-slate-200 dark:border-slate-800 dark:bg-slate-950 shadow-2xl p-2 max-h-[300px]">
                          {!isSquadsLoaded && (
                            <SelectItem value="loading" disabled className="text-xs text-slate-400 font-bold">
                              Carregando projetos...
                            </SelectItem>
                          )}
                          {/* Garante que a squad atual do usuário apareça, mesmo se for legada, enquanto ele não alterar */}
                          {isSquadsLoaded && Array.from(new Set([...dynamicSquads, ...(userProfile?.squadId && SQUADS.includes(userProfile.squadId) ? [userProfile.squadId] : [])])).map(s => (
                            <SelectItem
                              key={s}
                              value={s}
                              className="font-bold text-xs py-3 pl-8 rounded-lg focus:bg-slate-100 dark:focus:bg-slate-900 focus:text-slate-900 dark:focus:text-slate-100 text-slate-700 dark:text-slate-350 uppercase tracking-tight"
                            >
                              {s}
                            </SelectItem>
                          ))}
                          <SelectItem
                            value="other"
                            className="text-[10px] font-black text-indigo-600 dark:text-indigo-400 py-3 pl-8 rounded-lg focus:bg-slate-100 dark:focus:bg-slate-900 focus:text-indigo-700 dark:focus:text-indigo-300 border-t border-slate-100 dark:border-slate-800 mt-1"
                          >
                            + Digitar Novo
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-400 ml-1 flex items-center gap-2">
                      <ChevronRight className="h-3.5 w-3.5 text-indigo-500" /> Escolher Avatar
                    </Label>
                    <div className="grid grid-cols-5 sm:grid-cols-10 gap-3">
                      {AVATAR_SEEDS.map((seed) => (
                        <button
                          key={seed}
                          onClick={() => setAvatarSeed(seed)}
                          className={cn(
                            "relative aspect-square w-full transition-all rounded-xl border-2",
                            avatarSeed === seed ? "border-indigo-500 scale-105 shadow-lg" : "border-transparent opacity-50 hover:opacity-80"
                          )}
                        >
                          <NiceAvatar className="w-full h-full rounded-[10px]" {...(PREDEFINED_AVATARS[seed] || genConfig(seed))} />
                        </button>
                      ))}
                    </div>
                  </div>

                  {isCustomSquad && (
                    <div className="animate-in slide-in-from-top-2 duration-300">
                      <Label className="text-[10px] font-black uppercase tracking-widest text-indigo-500 dark:text-indigo-400 ml-1">Nome da Squad Customizada</Label>
                      <Input 
                        value={customSquad} 
                        onChange={(e) => setCustomSquad(e.target.value)} 
                        className="h-12 mt-2 rounded-xl border-indigo-200 dark:border-indigo-900/40 bg-indigo-50/30 dark:bg-indigo-950/20 font-bold text-indigo-900 dark:text-indigo-300" 
                        placeholder="Ex: DDWMISSI"
                      />
                    </div>
                  )}

                </div>
              )}
            </TabsContent>

            <TabsContent value="security" className="m-0 p-8 space-y-6 animate-in fade-in duration-300">
              <div className="space-y-4">
                <div>
                  <h4 className="text-sm font-black uppercase tracking-widest text-slate-900 dark:text-slate-100 flex items-center gap-2">
                    <Key className="h-4 w-4 text-indigo-500" /> Conexão Jira API & Token
                  </h4>
                  <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5">
                    Configure seu Personal Access Token (PAT) para puxar seus dados de usuário do endpoint <code>/rest/api/2/myself</code>.
                  </p>
                </div>

                <div className="space-y-3 bg-slate-50 dark:bg-slate-950/40 p-4 rounded-2xl border border-slate-100 dark:border-slate-800">
                  <div className="space-y-1.5">
                    <Label className="text-[9px] font-black uppercase tracking-widest text-slate-400 flex items-center gap-1.5">
                      <Globe className="h-3 w-3 text-indigo-500" /> Domínio Jira
                    </Label>
                    <Input
                      value={jiraDomain}
                      onChange={(e) => setJiraDomain(e.target.value)}
                      placeholder="jiraproducao.totvs.com.br"
                      className="h-10 rounded-xl text-xs bg-white dark:bg-slate-900 font-medium"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-[9px] font-black uppercase tracking-widest text-slate-400 flex items-center gap-1.5">
                      <Key className="h-3 w-3 text-indigo-500" /> Token de Acesso (PAT)
                    </Label>
                    <Input
                      type="password"
                      value={jiraToken}
                      onChange={(e) => setJiraToken(e.target.value)}
                      placeholder="Cole seu Personal Access Token do Jira"
                      className="h-10 rounded-xl text-xs bg-white dark:bg-slate-900 font-mono"
                    />
                  </div>

                  <Button
                    type="button"
                    onClick={() => handleSyncFromJira(jiraToken, jiraDomain)}
                    disabled={isSyncingJira}
                    className="w-full h-10 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-black uppercase text-[10px] tracking-widest gap-2 shadow-sm"
                  >
                    {isSyncingJira ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
                    {isSyncingJira ? 'Consultando /rest/api/2/myself...' : 'Testar e Puxar Dados do Jira'}
                  </Button>
                </div>

                {jiraAccountDetails && (
                  <div className="p-4 rounded-2xl bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800/40 space-y-2 animate-in fade-in">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                      <span className="text-xs font-black uppercase tracking-wider text-emerald-700 dark:text-emerald-300">
                        Conta Jira Conectada
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-[11px] pt-1">
                      <div>
                        <span className="text-slate-400 text-[9px] uppercase font-bold block">Nome de Exibição</span>
                        <span className="font-bold text-slate-800 dark:text-slate-200">{jiraAccountDetails.displayName || '—'}</span>
                      </div>
                      <div>
                        <span className="text-slate-400 text-[9px] uppercase font-bold block">Usuário / Key</span>
                        <span className="font-mono text-slate-800 dark:text-slate-200">{jiraAccountDetails.name || jiraAccountDetails.key || '—'}</span>
                      </div>
                      <div>
                        <span className="text-slate-400 text-[9px] uppercase font-bold block">E-mail</span>
                        <span className="text-slate-800 dark:text-slate-200">{jiraAccountDetails.emailAddress || '—'}</span>
                      </div>
                      <div>
                        <span className="text-slate-400 text-[9px] uppercase font-bold block">Fuso Horário</span>
                        <span className="text-slate-800 dark:text-slate-200">{jiraAccountDetails.timeZone || '—'}</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </TabsContent>
          </Tabs>
        </div>

        {activeTab === 'profile' && !(isNewUser && step === 0) && (
          <div className="shrink-0 px-8 py-5 border-t border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 flex items-center justify-between">
            <p className="text-[9px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest max-w-[280px] leading-relaxed">
              Suas informações são armazenadas e sincronizadas de forma segura no PostgreSQL.
            </p>
            <div className="flex gap-3">
               {isNewUser && (
                 <Button variant="ghost" onClick={() => setStep(0)} className="h-11 px-6 rounded-xl font-black uppercase text-[9px] tracking-widest text-slate-400 hover:text-slate-900 dark:text-slate-500 dark:hover:text-slate-200">
                   <ArrowLeft className="h-4 w-4 mr-2" />
                   Voltar
                 </Button>
               )}
               <Button
                onClick={handleSave}
                className="h-11 px-10 rounded-xl bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-slate-200 font-black uppercase text-[10px] tracking-widest shadow-xl shadow-slate-900/10 active:scale-95 transition-all"
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

