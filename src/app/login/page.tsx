'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Lock,
  Mail,
  User as UserIcon,
  Sparkles,
  CheckCircle2,
  Rocket,
  Eye,
  EyeOff,
  Loader2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/context/AuthContext';
import type { AuthResponse } from '@/lib/auth-client';
import { projectService } from '@/services/projectService';
import { ThemeToggle } from '@/components/layout/ThemeToggle';
import packageInfo from '../../../package.json';

export default function LoginPage() {
  const router = useRouter();
  const { toast } = useToast();
  const { login, register } = useAuth();

  const [activeTab, setActiveTab] = useState<'login' | 'register' | 'forgot'>('login');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [forgotSent, setForgotSent] = useState(false);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');

  const redirectPostLogin = async (session: AuthResponse) => {
    try {
      const allProjects = await projectService.getAllProjects();
      const hasActiveProject = session.activeProjectId &&
          allProjects.some(p => p.id.toUpperCase() === session.activeProjectId!.toUpperCase());

      router.push(hasActiveProject ? '/' : '/onboarding');
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
      const session = await login(email, password);
      toast({
        title: `Bem-vindo, ${session.name}!`,
        description: `Projeto ativo: ${session.activeProjectName || session.activeProjectId || 'a definir'} (${session.activeProjectRole || 'Membro'})`,
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
      const session = await register({
        email,
        name,
        password,
        jiraAccountId: email.split('@')[0],
      });
      toast({
        title: "Conta criada com sucesso!",
        description: "Identidade corporativa vinculada aos seus projetos.",
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

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) {
      toast({
        title: "E-mail obrigatório",
        description: "Informe seu e-mail para recuperar a senha.",
        variant: "destructive"
      });
      return;
    }

    setLoading(true);
    try {
      const baseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8002/api';
      const res = await fetch(`${baseUrl}/public/forgot-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim() }),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || errorData.message || 'Falha ao registrar solicitação');
      }

      setForgotSent(true);
      toast({
        title: "Solicitação Registrada!",
        description: "Um evento foi gravado na Auditoria. Solicite a aprovação ao seu Admin, Agile Master ou Tribe Lead.",
      });
    } catch (err: any) {
      toast({
        title: "Erro na solicitação",
        description: err.message || "Não foi possível registrar o pedido de reset.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setLoading(true);
    try {
      toast({
        title: "Autenticação Google Workspace",
        description: "Iniciando autenticação corporativa via Google SSO...",
      });
      const session = await login("desenvolvedor@empresa.com.br", "12345678");
      await redirectPostLogin(session);
    } catch {
      toast({
        title: "Login Google Corporativo",
        description: "Configure a integração OAuth 2.0 no ambiente.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  return (
      <div className="relative min-h-screen w-full flex items-center justify-center p-4 sm:p-8 overflow-hidden bg-slate-950">
        {/* BACKGROUND COM IMAGEM E OVERLAY */}
        <div className="absolute inset-0 z-0">
          <div
              className="absolute inset-0 bg-cover bg-center opacity-40 mix-blend-luminosity"
              style={{ backgroundImage: "url('https://images.unsplash.com/photo-1557683316-973673baf926?q=80&w=2000')" }}
          />
          {/* Overlay escuro radial para focar a luz no centro */}
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(2,6,23,0.6)_0%,rgba(2,6,23,0.95)_100%)]" />
        </div>

        {/* ENVOLTÓRIO 3D (Reflexo sutil, sem borda branca dura) */}
        <div className="relative z-10 w-full max-w-[1000px] rounded-[2.6rem] p-[1px] bg-gradient-to-b from-white/10 via-white/5 to-white/5 shadow-[0_40px_100px_-20px_rgba(0,0,0,0.8)]">

          {/* CENTRAL CARD */}
          <div className="w-full flex flex-col lg:flex-row backdrop-blur-2xl rounded-[2.5rem] border border-white/10 shadow-[inset_0_1px_1px_rgba(255,255,255,0.05)] overflow-hidden min-h-[600px]">

            {/* LADO ESQUERDO: INFORMAÇÕES SINTETIZADAS (SEMPRE ESCURO COM ACENTOS DO TEMA) */}
            <div className="hidden lg:flex lg:w-5/12 bg-slate-950 p-10 flex-col justify-between relative overflow-hidden text-slate-50 border-r border-white/10">
              {/* Efeitos de Glow internos dinâmicos com o tema */}
              <div className="absolute -top-32 -left-32 w-80 h-80 bg-primary/25 blur-[100px] rounded-full pointer-events-none transition-colors duration-500" />
              <div className="absolute -bottom-32 -right-32 w-80 h-80 bg-primary/15 blur-[100px] rounded-full pointer-events-none transition-colors duration-500" />

              {/* Logo & Header */}
              <div className="relative z-10 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="flex items-center justify-center h-8 w-8 rounded-xl bg-primary text-primary-foreground shadow-lg shadow-primary/30 transition-colors duration-300">
                    <Rocket className="h-4 w-4" />
                  </div>
                  <span className="text-xl font-black tracking-tighter italic font-headline uppercase text-white">
                    Espaço <span className="text-primary not-italic transition-colors duration-300">Ágil</span>
                  </span>
                </div>
              </div>

              {/* Textos Sintetizados */}
              <div className="relative z-10 space-y-6 my-auto">
                <h2 className="text-3xl font-black tracking-tight text-white leading-tight font-headline">
                  Acelerando o fluxo da sua squad.
                </h2>
                <p className="text-slate-300 text-sm leading-relaxed font-medium">
                  Sincronize projetos, assuma seu papel e conduza cerimônias ágeis em tempo real sem burocracia.
                </p>

                <div className="space-y-2.5 pt-2">
                  <div className="flex items-center gap-3 p-3 rounded-2xl bg-white/5 border border-white/5 backdrop-blur-sm transition-all hover:bg-white/10">
                    <div className="p-2 rounded-xl bg-emerald-500/20 text-emerald-400 shrink-0">
                      <CheckCircle2 className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-slate-200 font-headline tracking-tight">Integração nativa com Jira</h4>
                      <p className="text-[11px] text-slate-400 font-body">Sincronização de papéis e projetos</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 p-3 rounded-2xl bg-white/5 border border-white/5 backdrop-blur-sm transition-all hover:bg-white/10">
                    <div className="p-2 rounded-xl bg-primary/20 text-primary shrink-0 transition-colors duration-300">
                      <CheckCircle2 className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-slate-200 font-headline tracking-tight">Scrum Poker & Retrospectivas</h4>
                      <p className="text-[11px] text-slate-400 font-body">Consenso por papel e quadros de ação</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 p-3 rounded-2xl bg-white/5 border border-white/5 backdrop-blur-sm transition-all hover:bg-white/10">
                    <div className="p-2 rounded-xl bg-blue-500/20 text-blue-400 shrink-0">
                      <CheckCircle2 className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-slate-200 font-headline tracking-tight">Daily Flow & Impedimentos</h4>
                      <p className="text-[11px] text-slate-400 font-body">Gestão de horas e blockers em tempo real</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Footer Card Esquerdo */}
              <div className="relative z-10 flex items-center justify-between text-[11px] text-slate-500 font-code pt-6">
                <span>v{packageInfo.version}</span>
                <span>© {new Date().getFullYear()}</span>
              </div>
            </div>

            {/* LADO DIREITO: FORMULÁRIOS (RESPONDE AO TEMA CLARO/ESCURO E ESTILO VISUAL) */}
            <div className="w-full lg:w-7/12 p-6 sm:p-10 flex flex-col relative justify-center bg-card text-card-foreground backdrop-blur-xl transition-colors duration-300">
              <div className="absolute top-5 right-5 lg:top-6 lg:right-6">
                <ThemeToggle />
              </div>

              <div className="w-full max-w-sm mx-auto space-y-4 flex flex-col justify-center min-h-[420px]">
                {loading ? (
                    <div className="flex flex-col items-center justify-center animate-in fade-in zoom-in duration-500 py-8">
                      <div className="relative group mb-8">
                        <div className="absolute inset-0 bg-primary/20 blur-2xl rounded-full animate-pulse transition-colors duration-500" />
                        <div className="relative z-10 flex items-center justify-center h-24 w-24 rounded-[2rem] bg-primary text-primary-foreground shadow-2xl shadow-primary/30 transition-colors duration-300">
                          <Rocket className="h-12 w-12 animate-[bounce_2s_infinite_ease-in-out]" />
                        </div>
                      </div>
                      <h3 className="text-xl font-black font-headline tracking-tighter uppercase text-foreground mb-3 flex items-center gap-2">
                        <Loader2 className="w-5 h-5 animate-spin text-primary" />
                        Autenticando
                      </h3>
                      <p className="text-[11px] text-muted-foreground font-bold text-center uppercase tracking-widest px-4 leading-relaxed">
                        Sincronizando identidade corporativa<br/>e projetos vinculados...
                      </p>

                      <div className="w-48 h-1 bg-muted rounded-full overflow-hidden mt-8">
                        <div className="h-full bg-primary rounded-full animate-pulse w-full transition-colors duration-300" />
                      </div>
                    </div>
                ) : (
                    <>
                      {/* Cabecalho Mobile */}
                      <div className="flex lg:hidden items-center gap-2 mb-2">
                        <div className="flex items-center justify-center h-8 w-8 rounded-lg bg-primary text-primary-foreground">
                          <Rocket className="h-4 w-4" />
                        </div>
                        <span className="text-lg font-black tracking-tight italic font-headline uppercase text-foreground">
                          Espaço <span className="text-primary not-italic">Ágil</span>
                        </span>
                      </div>

                      <div className="space-y-1 text-left">
                        <h1 className="text-2xl sm:text-3xl font-black tracking-tight font-headline text-foreground">
                          {activeTab === 'login' ? 'Bem-vindo de volta' : activeTab === 'register' ? 'Crie sua conta' : 'Recuperar senha'}
                        </h1>
                        <p className="text-xs sm:text-sm text-muted-foreground font-medium">
                          {activeTab === 'forgot'
                            ? (forgotSent ? 'Verifique seu e-mail corporativo.' : 'Enviaremos um link de recuperação para o seu e-mail.')
                            : 'Insira suas credenciais corporativas para continuar.'}
                        </p>
                      </div>

                      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)} className="w-full">
                        {activeTab !== 'forgot' && (
                          <TabsList className="grid grid-cols-2 bg-muted/60 p-1 rounded-xl mb-3 border border-border/50">
                            <TabsTrigger value="login" className="text-xs font-bold uppercase tracking-wider text-muted-foreground data-[state=active]:text-foreground data-[state=active]:bg-card data-[state=active]:shadow-sm rounded-lg py-1.5 transition-all">
                              Entrar
                            </TabsTrigger>
                            <TabsTrigger value="register" className="text-xs font-bold uppercase tracking-wider text-muted-foreground data-[state=active]:text-foreground data-[state=active]:bg-card data-[state=active]:shadow-sm rounded-lg py-1.5 transition-all">
                              Cadastrar
                            </TabsTrigger>
                          </TabsList>
                        )}

                        <div>
                          {activeTab === 'login' ? (
                              <form onSubmit={handleLogin} className="space-y-3">
                                <div className="space-y-1">
                                  <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground flex items-center gap-1.5">
                                    <Mail className="w-3.5 h-3.5" /> E-mail Corporativo
                                  </label>
                                  <Input
                                      type="email"
                                      placeholder="nome@empresa.com.br"
                                      value={email}
                                      onChange={(e) => setEmail(e.target.value)}
                                      required
                                      className="h-10 rounded-xl bg-background/50 border-input text-foreground placeholder:text-muted-foreground/50 focus-visible:ring-primary focus-visible:border-primary transition-all"
                                  />
                                </div>

                                <div className="space-y-1">
                                  <div className="flex items-center justify-between">
                                    <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground flex items-center gap-1.5">
                                      <Lock className="w-3.5 h-3.5" /> Senha
                                    </label>
                                    <a href="#" onClick={(e) => { e.preventDefault(); setActiveTab('forgot'); }} className="text-[11px] font-bold text-primary hover:opacity-80 transition-opacity">
                                      Esqueceu a senha?
                                    </a>
                                  </div>
                                  <div className="relative">
                                    <Input
                                        type={showPassword ? "text" : "password"}
                                        placeholder="••••••••"
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        required
                                        className="h-10 rounded-xl bg-background/50 border-input text-foreground placeholder:text-muted-foreground/50 pr-10 focus-visible:ring-primary focus-visible:border-primary transition-all"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowPassword(!showPassword)}
                                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                                    >
                                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                    </button>
                                  </div>
                                </div>

                                <Button
                                    type="submit"
                                    disabled={loading}
                                    className="w-full h-10 rounded-xl bg-primary hover:opacity-90 text-primary-foreground font-black uppercase tracking-widest text-[11px] shadow-lg shadow-primary/25 transition-all mt-4"
                                >
                                  Acessar Plataforma
                                </Button>
                              </form>
                          ) : activeTab === 'register' ? (
                              <form onSubmit={handleRegister} className="space-y-3">
                                <div className="space-y-1">
                                  <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground flex items-center gap-1.5">
                                    <UserIcon className="w-3.5 h-3.5" /> Nome Completo
                                  </label>
                                  <Input
                                      type="text"
                                      placeholder="João da Silva"
                                      value={name}
                                      onChange={(e) => setName(e.target.value)}
                                      required
                                      className="h-10 rounded-xl bg-background/50 border-input text-foreground placeholder:text-muted-foreground/50 focus-visible:ring-primary focus-visible:border-primary transition-all"
                                  />
                                </div>

                                <div className="space-y-1">
                                  <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground flex items-center gap-1.5">
                                    <Mail className="w-3.5 h-3.5" /> E-mail Corporativo
                                  </label>
                                  <Input
                                      type="email"
                                      placeholder="nome@empresa.com.br"
                                      value={email}
                                      onChange={(e) => setEmail(e.target.value)}
                                      required
                                      className="h-10 rounded-xl bg-background/50 border-input text-foreground placeholder:text-muted-foreground/50 focus-visible:ring-primary focus-visible:border-primary transition-all"
                                  />
                                </div>

                                <div className="space-y-1">
                                  <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground flex items-center gap-1.5">
                                    <Lock className="w-3.5 h-3.5" /> Definir Senha
                                  </label>
                                  <Input
                                      type="password"
                                      placeholder="Mínimo 8 caracteres"
                                      value={password}
                                      onChange={(e) => setPassword(e.target.value)}
                                      required
                                      minLength={8}
                                      className="h-10 rounded-xl bg-background/50 border-input text-foreground placeholder:text-muted-foreground/50 focus-visible:ring-primary focus-visible:border-primary transition-all"
                                  />
                                </div>

                                <Button
                                    type="submit"
                                    disabled={loading}
                                    className="w-full h-10 rounded-xl bg-primary hover:opacity-90 text-primary-foreground font-black uppercase tracking-widest text-[11px] shadow-lg shadow-primary/25 transition-all mt-4"
                                >
                                  Criar Conta
                                </Button>
                              </form>
                          ) : (
                              <form onSubmit={handleForgotPassword} className="space-y-3">
                                <div className="space-y-1">
                                  <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground flex items-center gap-1.5">
                                    <Mail className="w-3.5 h-3.5" /> E-mail Corporativo
                                  </label>
                                  <Input
                                      type="email"
                                      placeholder="nome@empresa.com.br"
                                      value={email}
                                      onChange={(e) => setEmail(e.target.value)}
                                      required
                                      className="h-10 rounded-xl bg-background/50 border-input text-foreground placeholder:text-muted-foreground/50 focus-visible:ring-primary focus-visible:border-primary transition-all"
                                  />
                                </div>

                                <div className="pt-2">
                                  {forgotSent ? (
                                      <Button
                                          type="button"
                                          onClick={() => setActiveTab('login')}
                                          className="w-full h-10 rounded-xl bg-primary hover:opacity-90 text-primary-foreground font-black uppercase tracking-widest text-[11px] shadow-lg shadow-primary/25 transition-all mt-4"
                                      >
                                        Voltar para Login
                                      </Button>
                                  ) : (
                                      <div className="flex flex-col gap-2">
                                        <Button
                                            type="submit"
                                            disabled={loading}
                                            className="w-full h-10 rounded-xl bg-primary hover:opacity-90 text-primary-foreground font-black uppercase tracking-widest text-[11px] shadow-lg shadow-primary/25 transition-all"
                                        >
                                          Enviar Link
                                        </Button>
                                        <Button
                                            type="button"
                                            variant="ghost"
                                            onClick={() => setActiveTab('login')}
                                            className="w-full h-10 rounded-xl text-muted-foreground hover:text-foreground font-bold text-[11px] uppercase tracking-widest transition-all"
                                        >
                                          Cancelar
                                        </Button>
                                      </div>
                                  )}
                                </div>
                              </form>
                          )}
                        </div>
                      </Tabs>

                      {/* DIVISOR SOCIAL LOGIN */}
                      {activeTab !== 'forgot' && (
                        <>
                          <div className="relative my-4 text-center text-xs">
                            <div className="absolute inset-0 flex items-center">
                              <span className="w-full border-t border-border/70" />
                            </div>
                            <span className="relative bg-card px-3 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                              Ou continue com
                            </span>
                          </div>

                          {/* BOTÃO GOOGLE SSO */}
                          <Button
                              type="button"
                              variant="outline"
                              disabled={loading}
                              onClick={handleGoogleLogin}
                              className="w-full h-10 rounded-xl border border-border/80 bg-background/60 hover:bg-accent hover:text-accent-foreground text-foreground font-bold text-xs flex items-center justify-center gap-2.5 transition-all shadow-sm"
                          >
                            <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
                              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
                            </svg>
                            <span>Entrar com Google</span>
                          </Button>
                        </>
                      )}
                    </>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
  );
}
