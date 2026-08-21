"use client";

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { 
  Building2, 
  Lock, 
  Mail, 
  User as UserIcon, 
  ShieldCheck, 
  Sparkles, 
  CheckCircle2, 
  Rocket, 
  Eye, 
  EyeOff, 
  Flame 
} from 'lucide-react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { authService, UserSession } from '@/services/authService';
import { projectService, UserProjectAccess } from '@/services/projectService';
import { useUser } from '@/context/UserContext';
import { ThemeToggle } from '@/components/layout/ThemeToggle';
import packageInfo from '../../../package.json';

export default function LoginPage() {
  const router = useRouter();
  const { toast } = useToast();
  const { setGuestProfile } = useUser();

  const [activeTab, setActiveTab] = useState<'login' | 'register'>('login');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  // Form states
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [jiraAccountId, setJiraAccountId] = useState('');

  // Profields Role Discovery Preview
  const [previewAccess, setPreviewAccess] = useState<UserProjectAccess | null>(null);
  const [discoveringRoles, setDiscoveringRoles] = useState(false);

  // Efeito de auto-descoberta de projetos ao digitar o e-mail
  useEffect(() => {
    const clean = email.trim();
    if (clean.length > 4 && (clean.includes('@') || clean.includes('.'))) {
      const timer = setTimeout(async () => {
        try {
          setDiscoveringRoles(true);
          const access = await projectService.getUserProjectAccess(clean);
          if (access && access.projects && access.projects.length > 0) {
            setPreviewAccess(access);
          } else {
            setPreviewAccess(null);
          }
        } catch {
          setPreviewAccess(null);
        } finally {
          setDiscoveringRoles(false);
        }
      }, 400);

      return () => clearTimeout(timer);
    } else {
      setPreviewAccess(null);
    }
  }, [email]);

  const redirectPostLogin = async (session: UserSession) => {
    try {
      const allProjects = await projectService.getAllProjects();
      const hasActiveProject = session.activeProjectId && allProjects.some(p => p.id.toUpperCase() === session.activeProjectId.toUpperCase());
      
      if (hasActiveProject) {
        router.push('/');
      } else {
        router.push('/admin?tab=projects&onboarding=true');
      }
    } catch {
      router.push('/');
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      toast({
        title: "Campos obrigatórios",
        description: "Informe seu e-mail corporativo e senha.",
        variant: "destructive"
      });
      return;
    }

    setLoading(true);
    try {
      const session = await authService.login({ email, password });
      
      const matchedRole = (session.activeProjectRole || 'Membro') as any;
      setGuestProfile(
        session.name,
        matchedRole,
        session.activeProjectId || 'DDWMISSI',
        session.email,
        session.avatarSeed || 'Felix'
      );

      toast({
        title: `Bem-vindo, ${session.name}!`,
        description: `Projeto ativo: ${session.activeProjectName || session.activeProjectId || 'DDWMISSI'} (${session.activeProjectRole || 'Membro'})`,
      });

      await redirectPostLogin(session);
    } catch (err: any) {
      toast({
        title: "Falha na autenticação",
        description: err.message || "E-mail ou senha inválidos.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password || !name) {
      toast({
        title: "Campos incompletos",
        description: "Preencha nome, e-mail e senha para criar sua conta.",
        variant: "destructive"
      });
      return;
    }

    setLoading(true);
    try {
      const session = await authService.register({
        email,
        name,
        password,
        jiraAccountId: jiraAccountId || email.split('@')[0],
      });

      const matchedRole = (session.activeProjectRole || 'Membro') as any;
      setGuestProfile(
        session.name,
        matchedRole,
        session.activeProjectId || 'DDWMISSI',
        session.email,
        session.avatarSeed || 'Felix'
      );

      toast({
        title: "Conta criada com sucesso!",
        description: `Identidade corporativa vinculada aos seus projetos.`,
      });

      await redirectPostLogin(session);
    } catch (err: any) {
      toast({
        title: "Erro no cadastro",
        description: err.message || "Não foi possível registrar o usuário.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full min-h-screen flex flex-col lg:flex-row bg-background text-foreground">
      
      {/* PAINEL ESQUERDO: BRANDING & VALOR AGIL (Desktop) */}
      <div className="hidden lg:flex lg:w-1/2 relative bg-slate-950 text-white flex-col justify-between p-12 overflow-hidden border-r border-slate-800">
        
        {/* Efeitos de Luz e Mesh de Fundo */}
        <div className="absolute -top-32 -left-32 w-96 h-96 bg-primary/20 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-32 -right-32 w-96 h-96 bg-indigo-600/20 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute inset-0 bg-[radial-gradient(rgba(255,255,255,0.05)_1px,transparent_1px)] [background-size:24px_24px] pointer-events-none" />

        {/* Top Header Esquerda */}
        <div className="relative z-10 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center h-10 w-10 rounded-xl bg-gradient-to-br from-primary to-orange-500 text-white shadow-lg shadow-primary/25">
              <Rocket className="h-5 w-5" />
            </div>
            <span className="text-2xl font-black tracking-tighter italic font-headline uppercase">
              Espaço <span className="text-primary not-italic">Ágil</span>
            </span>
          </div>
          <Badge variant="outline" className="text-xs text-slate-400 border-slate-700 font-mono">
            v{packageInfo.version}
          </Badge>
        </div>

        {/* Conteúdo Central Hero */}
        <div className="relative z-10 space-y-8 max-w-lg my-auto">
          <div className="space-y-3">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 border border-primary/20 text-primary text-xs font-semibold">
              <Sparkles className="w-3.5 h-3.5" /> Plataforma Integrada de Governança
            </div>
            <h2 className="text-4xl font-extrabold tracking-tight text-white leading-tight font-headline">
              Acelerando o fluxo da sua squad, do planning ao release.
            </h2>
            <p className="text-slate-400 text-base leading-relaxed">
              Autentique-se com sua identidade corporativa para sincronizar instantaneamente papéis, projetos e cerimônias ágeis.
            </p>
          </div>

          {/* Destaques em Lista */}
          <div className="grid gap-4 pt-2">
            <div className="flex items-start gap-3.5 p-3.5 rounded-xl bg-slate-900/60 border border-slate-800/80 backdrop-blur-sm">
              <div className="p-2 rounded-lg bg-blue-500/10 text-blue-400 shrink-0 mt-0.5">
                <Building2 className="w-4 h-4" />
              </div>
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-200">Sincronização Jira Profields</h4>
                <p className="text-xs text-slate-400 mt-0.5">Mapeamento automático de papéis de liderança e governança do projeto.</p>
              </div>
            </div>

            <div className="flex items-start gap-3.5 p-3.5 rounded-xl bg-slate-900/60 border border-slate-800/80 backdrop-blur-sm">
              <div className="p-2 rounded-lg bg-orange-500/10 text-orange-400 shrink-0 mt-0.5">
                <Flame className="w-4 h-4" />
              </div>
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-200">Cerimônias em Tempo Real</h4>
                <p className="text-xs text-slate-400 mt-0.5">Planning Poker assíncrono, Retrospectivas interativas e Daily Flow integrado.</p>
              </div>
            </div>
          </div>
        </div>

        {/* Rodapé Esquerda */}
        <div className="relative z-10 flex items-center justify-between text-xs text-slate-500 pt-6 border-t border-slate-800/80">
          <span>© {new Date().getFullYear()} Espaço Ágil</span>
          <span className="flex items-center gap-1 text-slate-400">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> PostgreSQL & JWT Seguro
          </span>
        </div>

      </div>

      {/* PAINEL DIREITO: FORMULÁRIO DE LOGIN / CADASTRO */}
      <div className="w-full lg:w-1/2 flex flex-col justify-between p-6 sm:p-10 lg:p-12 relative min-h-screen">
        
        {/* Topbar Direita com Tema */}
        <div className="flex items-center justify-between w-full max-w-md mx-auto">
          {/* Logo visível apenas no mobile */}
          <div className="flex lg:hidden items-center gap-2">
            <div className="flex items-center justify-center h-8 w-8 rounded-lg bg-primary text-white">
              <Rocket className="h-4 w-4" />
            </div>
            <span className="text-lg font-black tracking-tight italic font-headline uppercase">
              Espaço <span className="text-primary not-italic">Ágil</span>
            </span>
          </div>
          <div className="ml-auto">
            <ThemeToggle />
          </div>
        </div>

        {/* Card de Autenticação Centralizado */}
        <div className="w-full max-w-md mx-auto my-auto space-y-6">
          
          <div className="space-y-1.5 text-left">
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight font-headline">
              {activeTab === 'login' ? 'Acesse sua conta' : 'Crie seu cadastro'}
            </h1>
            <p className="text-sm text-muted-foreground">
              Utilize seu e-mail corporativo para vincular sua squad e projetos.
            </p>
          </div>

          <Card className="border border-border bg-card shadow-xl rounded-2xl overflow-hidden">
            <CardHeader className="pb-4 pt-6 px-6 border-b border-border/50 bg-muted/20">
              <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)} className="w-full">
                <TabsList className="grid grid-cols-2 bg-muted/60 p-1 rounded-xl">
                  <TabsTrigger value="login" className="text-xs font-bold data-[state=active]:bg-background data-[state=active]:shadow-sm rounded-lg py-2">
                    Entrar
                  </TabsTrigger>
                  <TabsTrigger value="register" className="text-xs font-bold data-[state=active]:bg-background data-[state=active]:shadow-sm rounded-lg py-2">
                    Novo Cadastro
                  </TabsTrigger>
                </TabsList>
              </Tabs>
            </CardHeader>

            <CardContent className="p-6 space-y-5">
              
              {/* Notificação Visual de Auto-Descoberta de Papel */}
              {previewAccess && previewAccess.projects && previewAccess.projects.length > 0 && (
                <div className="p-3 rounded-xl bg-primary/10 border border-primary/20 space-y-1 animate-in fade-in duration-300">
                  <div className="flex items-center gap-1.5 text-primary text-xs font-bold uppercase tracking-wider">
                    <Sparkles className="w-3.5 h-3.5" /> Projeto Identificado no Jira
                  </div>
                  <div className="text-xs space-y-0.5 text-muted-foreground">
                    {previewAccess.projects.map((p, i) => (
                      <div key={i} className="flex items-center justify-between font-medium text-foreground">
                        <span>{p.projectId} • {p.roleName}</span>
                        <Badge variant="secondary" className="text-[10px] font-mono">
                          {p.tribeName || 'Squad'}
                        </Badge>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {activeTab === 'login' ? (
                <form onSubmit={handleLogin} className="space-y-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                      <Mail className="w-3.5 h-3.5 text-primary" /> E-mail Corporativo
                    </label>
                    <Input 
                      type="email"
                      placeholder="seu.nome@empresa.com.br"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      className="h-11 rounded-xl bg-background border-border text-sm focus-visible:ring-primary"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                        <Lock className="w-3.5 h-3.5 text-primary" /> Senha
                      </label>
                    </div>
                    <div className="relative">
                      <Input 
                        type={showPassword ? "text" : "password"}
                        placeholder="••••••••"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                        className="h-11 rounded-xl bg-background border-border text-sm pr-10 focus-visible:ring-primary"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      >
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  <Button 
                    type="submit" 
                    disabled={loading}
                    className="w-full h-11 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground font-bold shadow-md transition-all text-sm mt-2"
                  >
                    {loading ? 'Autenticando...' : 'Acessar Espaço Ágil'}
                  </Button>
                </form>
              ) : (
                <form onSubmit={handleRegister} className="space-y-3.5">
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                      <UserIcon className="w-3.5 h-3.5 text-primary" /> Nome Completo
                    </label>
                    <Input 
                      type="text"
                      placeholder="Seu Nome Completo"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      required
                      className="h-11 rounded-xl bg-background border-border text-sm"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                      <Mail className="w-3.5 h-3.5 text-primary" /> E-mail Corporativo
                    </label>
                    <Input 
                      type="email"
                      placeholder="seu.nome@empresa.com.br"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      className="h-11 rounded-xl bg-background border-border text-sm"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                      <Lock className="w-3.5 h-3.5 text-primary" /> Definir Senha
                    </label>
                    <Input 
                      type="password"
                      placeholder="Mínimo 6 caracteres"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      className="h-11 rounded-xl bg-background border-border text-sm"
                    />
                  </div>

                  <Button 
                    type="submit" 
                    disabled={loading}
                    className="w-full h-11 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground font-bold shadow-md transition-all text-sm mt-2"
                  >
                    {loading ? 'Cadastrando...' : 'Criar Conta e Conectar'}
                  </Button>
                </form>
              )}

            </CardContent>
          </Card>

        </div>

        {/* Rodapé Direita */}
        <div className="w-full max-w-md mx-auto text-center text-xs text-muted-foreground pt-4">
          Precisa de suporte? Acesse o painel de <a href="/admin" className="text-primary hover:underline font-semibold">Governança</a>.
        </div>

      </div>

    </div>
  );
}
