'use client';

import React, { useEffect, useRef, useState } from 'react';
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
  ArrowRight,
  Activity,
  AlertCircle,
  TriangleAlert,
} from 'lucide-react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/context/AuthContext';
import { clearJustSignedUp, markJustSignedUp } from '@/lib/team-welcome';
import { ThemeToggle } from '@/components/layout/ThemeToggle';
import packageInfo from '../../../package.json';

const LAST_EMAIL_KEY = 'agile-space:last-email';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const LABEL = 'text-[10px] font-black uppercase tracking-widest text-muted-foreground flex items-center gap-1.5';
const INPUT = 'h-10 rounded-xl bg-background/50 border-input text-foreground placeholder:text-muted-foreground/50 pl-9 focus-visible:ring-primary focus-visible:border-primary transition-all';

function passwordScore(pw: string): number {
  let n = 0;
  if (pw.length >= 8) n++;
  if (/[a-z]/.test(pw) && /[A-Z]/.test(pw)) n++;
  if (/\d/.test(pw)) n++;
  if (/[^A-Za-z0-9]/.test(pw) || pw.length >= 12) n++;
  return n;
}
const STRENGTH = [
  { label: 'Muito fraca', bar: 'bg-red-500' },
  { label: 'Fraca', bar: 'bg-red-500' },
  { label: 'Razoável', bar: 'bg-amber-500' },
  { label: 'Boa', bar: 'bg-emerald-500' },
  { label: 'Forte', bar: 'bg-emerald-500' },
];

function FieldError({ id, message }: { id: string; message?: string }) {
  if (!message) return null;
  return (
    <p id={id} role="alert" className="flex items-center gap-1 text-[11px] font-semibold text-destructive animate-in fade-in slide-in-from-top-1 duration-200">
      <AlertCircle className="w-3 h-3 shrink-0" /> {message}
    </p>
  );
}

// Mini-mesa de poker animada: cartas viram em ciclo e mostram o consenso.
const PREVIEW_ROUNDS = [
  { votes: ['5', '5', '8'], result: '5' },
  { votes: ['3', '5', '5'], result: '5' },
  { votes: ['8', '8', '8'], result: '8' },
];

function PokerPreview() {
  const [i, setI] = useState(0);
  const [revealed, setRevealed] = useState(false);
  useEffect(() => {
    const reveal = setTimeout(() => setRevealed(true), 1400);
    const next = setTimeout(() => {
      setRevealed(false);
      setI(v => (v + 1) % PREVIEW_ROUNDS.length);
    }, 3800);
    return () => {
      clearTimeout(reveal);
      clearTimeout(next);
    };
  }, [i]);
  const r = PREVIEW_ROUNDS[i];
  return (
    <div className="rounded-2xl bg-white/5 border border-white/10 p-4 backdrop-blur-sm" aria-hidden>
      <div className="flex items-center justify-between mb-3">
        <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Scrum Poker ao vivo</span>
        <span className="flex items-center gap-1.5 text-[10px] font-bold text-emerald-400">
          <span className="relative flex h-1.5 w-1.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-400" />
          </span>
          3 online
        </span>
      </div>
      <div className="flex items-center justify-center gap-3" style={{ perspective: 600 }}>
        {r.votes.map((v, idx) => (
          <motion.div
            key={`${i}-${idx}`}
            initial={{ rotateY: 0, y: 12, opacity: 0 }}
            animate={{ rotateY: revealed ? 180 : 0, y: 0, opacity: 1 }}
            transition={{ rotateY: { duration: 0.5, delay: revealed ? idx * 0.12 : 0 }, y: { delay: idx * 0.1 }, opacity: { delay: idx * 0.1 } }}
            style={{ transformStyle: 'preserve-3d' }}
            className="relative h-16 w-11"
          >
            <div className="absolute inset-0 rounded-lg bg-gradient-to-br from-primary to-violet-600 border border-white/20 shadow-lg" style={{ backfaceVisibility: 'hidden' }} />
            <div className="absolute inset-0 flex items-center justify-center rounded-lg bg-white text-slate-900 text-xl font-black italic shadow-lg" style={{ backfaceVisibility: 'hidden', transform: 'rotateY(180deg)' }}>{v}</div>
          </motion.div>
        ))}
      </div>
      <p className={cn('mt-3 text-center text-[11px] font-bold transition-all duration-300', revealed ? 'text-emerald-400' : 'text-slate-400 opacity-60')}>
        {revealed ? `Consenso: ${r.result} pontos` : 'Votando em segredo…'}
      </p>
    </div>
  );
}

export default function LoginPage() {
  const { toast } = useToast();
  const { login, register } = useAuth();

  const [activeTab, setActiveTab] = useState<'login' | 'register' | 'forgot'>('login');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [forgotSent, setForgotSent] = useState(false);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [confirm, setConfirm] = useState('');
  const [capsOn, setCapsOn] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [shakeKey, setShakeKey] = useState(0);
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const passwordRef = useRef<HTMLInputElement>(null);

  // Lembra apenas o e-mail (nunca a senha) para não digitar a cada login.
  useEffect(() => {
    try {
      const saved = localStorage.getItem(LAST_EMAIL_KEY);
      if (saved) {
        setEmail(saved);
        passwordRef.current?.focus();
      }
    } catch {
      // localStorage indisponível (modo privado etc.): segue sem pré-preencher.
    }
  }, []);

  const touch = (f: string) => setTouched(t => ({ ...t, [f]: true }));
  const failAuth = (msg: string) => {
    setAuthError(msg);
    setShakeKey(k => k + 1);
  };
  const switchTab = (t: 'login' | 'register' | 'forgot') => {
    setActiveTab(t);
    setAuthError(null);
    setTouched({});
  };
  const onCaps = (e: React.KeyboardEvent) => setCapsOn(e.getModifierState?.('CapsLock') ?? false);

  const errors = {
    name: !name.trim() ? 'Informe seu nome.' : undefined,
    email: !email.trim()
      ? 'Informe seu e-mail.'
      : activeTab !== 'login' && !EMAIL_RE.test(email.trim())
        ? 'E-mail inválido. Ex.: nome@empresa.com.br'
        : undefined,
    password: !password
      ? 'Informe a senha.'
      : activeTab === 'register' && password.length < 8
        ? 'Mínimo de 8 caracteres.'
        : undefined,
    confirm: confirm !== password ? 'As senhas não conferem.' : undefined,
  };
  const show = (f: keyof typeof errors) => (touched[f] ? errors[f] : undefined);
  const score = passwordScore(password);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setTouched(t => ({ ...t, email: true, password: true }));
    if (errors.email || errors.password) return;
    setAuthError(null);

    setLoading(true);
    try {
      const session = await login(email, password);
      try {
        localStorage.setItem(LAST_EMAIL_KEY, email.trim());
      } catch {
        // ignora: lembrar o e-mail é só conveniência
      }
      toast({
        title: `Bem-vindo, ${session.name}!`,
        description: `Projeto ativo: ${session.activeProjectName || session.activeProjectId || 'a definir'} (${session.activeProjectRole || 'Membro'})`,
      });
    } catch (err: any) {
      failAuth(err.message || 'E-mail ou senha inválidos.');
      setPassword('');
      passwordRef.current?.focus();
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setTouched({ name: true, email: true, password: true, confirm: true });
    if (errors.name || errors.email || errors.password || errors.confirm) return;
    setAuthError(null);

    setLoading(true);
    try {
      // Gravado antes: o AuthGuard decide o destino assim que a sessão existe.
      markJustSignedUp();
      await register({
        email,
        name,
        password,
        jiraAccountId: email.split('@')[0],
      });
      toast({
        title: "Conta criada com sucesso!",
        description: "Identidade corporativa vinculada aos seus projetos.",
      });
    } catch (err: any) {
      clearJustSignedUp();
      failAuth(err.message || 'Não foi possível registrar o usuário.');
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setTouched(t => ({ ...t, email: true }));
    if (errors.email) return;
    setAuthError(null);

    setLoading(true);
    try {
      const baseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8002/api';
      const res = await fetch(`${baseUrl}/auth/forgot-password`, {
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
      failAuth(err.message || 'Não foi possível registrar o pedido de reset.');
    } finally {
      setLoading(false);
    }
  };

  return (
      <div className="relative min-h-screen w-full flex items-center justify-center p-4 sm:p-8 overflow-hidden bg-slate-950">
        {/* BACKGROUND ATMOSFÉRICO: aurora em CSS puro (sem dependência de imagem externa) */}
        {/* overflow-hidden aqui evita que os blobs com offset negativo criem uma região de
            scroll no container externo (o navegador rola pra focar a aba ao trocar de tab) */}
        <div className="absolute inset-0 z-0 overflow-hidden">
          <div className="absolute -top-48 -left-48 w-[560px] h-[560px] bg-primary/20 blur-[140px] rounded-full animate-aurora-drift" />
          <div className="absolute top-1/4 -right-40 w-[480px] h-[480px] bg-blue-600/15 blur-[130px] rounded-full animate-aurora-drift" style={{ animationDelay: '-8s' }} />
          <div className="absolute -bottom-48 left-1/4 w-[500px] h-[500px] bg-violet-600/10 blur-[140px] rounded-full animate-aurora-drift" style={{ animationDelay: '-15s' }} />

          {/* Overlay escuro radial para focar a luz no centro */}
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(2,6,23,0.85)_0%,rgba(0,0,0,0.98)_100%)]" />
        </div>

        {/* Glow ambiente atrás do card, centralizado independente do fluxo flex */}
        <div
            className="absolute inset-0 m-auto z-[5] w-[820px] h-[420px] max-w-[85vw] max-h-[70vh] bg-primary/15 blur-[110px] rounded-full animate-aurora-drift pointer-events-none"
            aria-hidden="true"
        />

        {/* ENVOLTÓRIO 3D (Reflexo sutil, sem borda branca dura) */}
        <div className="relative z-10 w-full max-w-[1000px] rounded-[2.6rem] p-[1px] bg-gradient-to-b from-white/10 via-white/5 to-white/5 shadow-[0_40px_100px_-20px_rgba(0,0,0,0.8)] animate-in fade-in zoom-in-95 slide-in-from-bottom-6 duration-700">

          {/* CENTRAL CARD */}
          <div className="w-full flex flex-col lg:flex-row backdrop-blur-2xl rounded-[2.5rem] border border-white/10 shadow-[inset_0_1px_1px_rgba(255,255,255,0.05)] overflow-hidden lg:min-h-[600px]">

            {/* LADO ESQUERDO: INFORMAÇÕES SINTETIZADAS (SEMPRE ESCURO COM ACENTOS DO TEMA) */}
            <div className="hidden lg:flex lg:w-5/12 bg-slate-950/40 backdrop-blur-xl p-10 flex-col justify-between relative overflow-hidden text-slate-50 border-r border-white/10">
              {/* Starfield temático (Portal Tech V&D) */}
              <div className="starfield-sm absolute inset-0 opacity-50 animate-twinkle pointer-events-none" />
              <div className="starfield-lg absolute inset-0 opacity-30 animate-twinkle pointer-events-none" style={{ animationDelay: '-2.5s' }} />

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
                    Portal Tech <span className="text-primary not-italic transition-colors duration-300">V&D</span>
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

                <PokerPreview />

                <div className="space-y-2.5 pt-2">
                  <div className="flex items-center gap-3 p-3 rounded-2xl bg-white/5 border border-white/5 backdrop-blur-sm transition-all hover:bg-white/10 hover:border-white/10 hover:-translate-y-0.5">
                    <div className="p-2 rounded-xl bg-emerald-500/20 text-emerald-400 shrink-0">
                      <CheckCircle2 className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-slate-200 font-headline tracking-tight">Integração nativa com Jira</h4>
                      <p className="text-[11px] text-slate-400 font-body">Sincronização de papéis e projetos</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 p-3 rounded-2xl bg-white/5 border border-white/5 backdrop-blur-sm transition-all hover:bg-white/10 hover:border-white/10 hover:-translate-y-0.5">
                    <div className="p-2 rounded-xl bg-primary/20 text-primary shrink-0 transition-colors duration-300">
                      <CheckCircle2 className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-slate-200 font-headline tracking-tight">Scrum Poker & Retrospectivas</h4>
                      <p className="text-[11px] text-slate-400 font-body">Consenso por papel e quadros de ação</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 p-3 rounded-2xl bg-white/5 border border-white/5 backdrop-blur-sm transition-all hover:bg-white/10 hover:border-white/10 hover:-translate-y-0.5">
                    <div className="p-2 rounded-xl bg-blue-500/20 text-blue-400 shrink-0">
                      <Activity className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-slate-200 font-headline tracking-tight">Squad Pulse & Radar Diário</h4>
                      <p className="text-[11px] text-slate-400 font-body">Board e bloqueios sincronizados com o Jira</p>
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
            <div className="w-full lg:w-7/12 p-6 sm:p-10 flex flex-col relative justify-center bg-card/95 dark:bg-card/50 text-card-foreground backdrop-blur-xl transition-colors duration-300">
              <div className="absolute top-5 right-5 lg:top-6 lg:right-6">
                <ThemeToggle />
              </div>

              <div className="w-full max-w-sm mx-auto space-y-4 flex flex-col justify-center min-h-[420px]">
                {/* Cabecalho Mobile */}
                <div className="flex lg:hidden items-center gap-2 mb-2">
                  <div className="flex items-center justify-center h-8 w-8 rounded-lg bg-primary text-primary-foreground">
                    <Rocket className="h-4 w-4" />
                  </div>
                  <span className="text-lg font-black tracking-tight italic font-headline uppercase text-foreground">
                    Portal Tech <span className="text-primary not-italic">V&D</span>
                  </span>
                </div>

                <div className="space-y-1 text-left">
                  <h1 className="text-2xl sm:text-3xl font-black tracking-tight font-headline text-foreground">
                    {activeTab === 'login' ? 'Bem-vindo de volta' : activeTab === 'register' ? 'Crie sua conta' : 'Recuperar senha'}
                  </h1>
                  <p className="text-xs sm:text-sm text-muted-foreground font-medium">
                    {activeTab === 'forgot'
                      ? (forgotSent ? 'Solicitação registrada. Aguarde a aprovação do seu Admin, Agile Master ou Tribe Lead.' : 'Registraremos o pedido para aprovação do seu Admin, Agile Master ou Tribe Lead.')
                      : activeTab === 'register'
                        ? 'Use seu e-mail corporativo para vincular seus projetos.'
                        : 'Insira suas credenciais corporativas para continuar.'}
                  </p>
                </div>

                <Tabs value={activeTab} onValueChange={(v) => switchTab(v as 'login' | 'register' | 'forgot')} className="w-full">
                  {activeTab !== 'forgot' && (
                    <TabsList className="grid grid-cols-2 bg-muted/60 p-1 rounded-xl mb-3 border border-border/50">
                      <TabsTrigger value="login" disabled={loading} className="text-xs font-bold uppercase tracking-wider text-muted-foreground data-[state=active]:text-foreground data-[state=active]:bg-card data-[state=active]:shadow-sm rounded-lg py-1.5 transition-all">
                        Entrar
                      </TabsTrigger>
                      <TabsTrigger value="register" disabled={loading} className="text-xs font-bold uppercase tracking-wider text-muted-foreground data-[state=active]:text-foreground data-[state=active]:bg-card data-[state=active]:shadow-sm rounded-lg py-1.5 transition-all">
                        Cadastrar
                      </TabsTrigger>
                    </TabsList>
                  )}

                  {/* ERRO DE AUTENTICAÇÃO: fica no card até o usuário editar; shake a cada nova falha */}
                  {authError && (
                    <div
                      key={shakeKey}
                      role="alert"
                      className="mb-3 flex items-start gap-2 rounded-xl border border-destructive/40 bg-destructive/10 px-3 py-2.5 text-xs font-semibold text-destructive animate-shake"
                    >
                      <TriangleAlert className="w-4 h-4 shrink-0 mt-px" />
                      <span>
                        <strong className="block font-black">
                          {activeTab === 'login' ? 'Falha na autenticação' : activeTab === 'register' ? 'Erro no cadastro' : 'Erro na solicitação'}
                        </strong>
                        {authError}
                      </span>
                    </div>
                  )}

                  <div>
                    {activeTab === 'login' ? (
                      <form onSubmit={handleLogin} className="space-y-3" noValidate>
                        <div className="space-y-1">
                          <label htmlFor="login-email" className={LABEL}>
                            <Mail className="w-3.5 h-3.5" /> E-mail ou Usuário
                          </label>
                          <div className="relative">
                            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground/50 pointer-events-none" />
                            <Input
                              id="login-email"
                              type="text"
                              name="email"
                              autoComplete="username"
                              autoCapitalize="none"
                              spellCheck={false}
                              placeholder="usuario ou nome@empresa.com.br"
                              value={email}
                              disabled={loading}
                              onChange={(e) => { setEmail(e.target.value); setAuthError(null); }}
                              onBlur={() => touch('email')}
                              aria-invalid={!!show('email')}
                              aria-describedby={show('email') ? 'login-email-err' : undefined}
                              className={cn(INPUT, show('email') && 'border-destructive focus-visible:ring-destructive')}
                            />
                          </div>
                          <FieldError id="login-email-err" message={show('email')} />
                        </div>

                        <div className="space-y-1">
                          <div className="flex items-center justify-between">
                            <label htmlFor="login-password" className={LABEL}>
                              <Lock className="w-3.5 h-3.5" /> Senha
                            </label>
                            <button type="button" onClick={() => switchTab('forgot')} className="text-[11px] font-bold text-primary hover:opacity-80 transition-opacity">
                              Esqueceu a senha?
                            </button>
                          </div>
                          <div className="relative">
                            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground/50 pointer-events-none" />
                            <Input
                              id="login-password"
                              type={showPassword ? 'text' : 'password'}
                              name="password"
                              autoComplete="current-password"
                              ref={passwordRef}
                              placeholder="••••••••"
                              value={password}
                              disabled={loading}
                              onChange={(e) => { setPassword(e.target.value); setAuthError(null); }}
                              onBlur={() => touch('password')}
                              onKeyDown={onCaps}
                              onKeyUp={onCaps}
                              aria-invalid={!!show('password')}
                              aria-describedby={show('password') ? 'login-password-err' : undefined}
                              className={cn(INPUT, 'pr-10', show('password') && 'border-destructive focus-visible:ring-destructive')}
                            />
                            <button
                              type="button"
                              onClick={() => setShowPassword(!showPassword)}
                              aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
                              aria-pressed={showPassword}
                              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                            >
                              {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                            </button>
                          </div>
                          {capsOn && (
                            <p className="flex items-center gap-1 text-[11px] font-semibold text-amber-600 dark:text-amber-400">
                              <TriangleAlert className="w-3 h-3 shrink-0" /> Caps Lock está ativado.
                            </p>
                          )}
                          <FieldError id="login-password-err" message={show('password')} />
                        </div>

                        <Button
                          type="submit"
                          disabled={loading}
                          className="group w-full h-10 rounded-xl bg-primary hover:opacity-90 text-primary-foreground font-black uppercase tracking-widest text-[11px] shadow-lg shadow-primary/25 transition-all mt-4"
                        >
                          {loading ? (
                            <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Autenticando…</>
                          ) : (
                            <>Acessar Plataforma <ArrowRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-1" /></>
                          )}
                        </Button>
                        {loading && (
                          <p className="text-center text-[11px] font-medium text-muted-foreground" role="status">
                            Sincronizando identidade corporativa e projetos vinculados…
                          </p>
                        )}
                      </form>
                    ) : activeTab === 'register' ? (
                      <form onSubmit={handleRegister} className="space-y-3" noValidate>
                        <div className="space-y-1">
                          <label htmlFor="reg-name" className={LABEL}>
                            <UserIcon className="w-3.5 h-3.5" /> Nome Completo
                          </label>
                          <div className="relative">
                            <UserIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground/50 pointer-events-none" />
                            <Input
                              id="reg-name"
                              type="text"
                              autoComplete="name"
                              placeholder="João da Silva"
                              value={name}
                              disabled={loading}
                              onChange={(e) => { setName(e.target.value); setAuthError(null); }}
                              onBlur={() => touch('name')}
                              aria-invalid={!!show('name')}
                              aria-describedby={show('name') ? 'reg-name-err' : undefined}
                              className={cn(INPUT, show('name') && 'border-destructive focus-visible:ring-destructive')}
                            />
                          </div>
                          <FieldError id="reg-name-err" message={show('name')} />
                        </div>

                        <div className="space-y-1">
                          <label htmlFor="reg-email" className={LABEL}>
                            <Mail className="w-3.5 h-3.5" /> E-mail Corporativo
                          </label>
                          <div className="relative">
                            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground/50 pointer-events-none" />
                            <Input
                              id="reg-email"
                              type="email"
                              autoComplete="email"
                              autoCapitalize="none"
                              spellCheck={false}
                              placeholder="nome@empresa.com.br"
                              value={email}
                              disabled={loading}
                              onChange={(e) => { setEmail(e.target.value); setAuthError(null); }}
                              onBlur={() => touch('email')}
                              aria-invalid={!!show('email')}
                              aria-describedby={show('email') ? 'reg-email-err' : undefined}
                              className={cn(INPUT, show('email') && 'border-destructive focus-visible:ring-destructive')}
                            />
                          </div>
                          <FieldError id="reg-email-err" message={show('email')} />
                        </div>

                        <div className="space-y-1">
                          <label htmlFor="reg-password" className={LABEL}>
                            <Lock className="w-3.5 h-3.5" /> Definir Senha
                          </label>
                          <div className="relative">
                            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground/50 pointer-events-none" />
                            <Input
                              id="reg-password"
                              type={showPassword ? 'text' : 'password'}
                              autoComplete="new-password"
                              placeholder="Mínimo 8 caracteres"
                              value={password}
                              disabled={loading}
                              onChange={(e) => { setPassword(e.target.value); setAuthError(null); }}
                              onBlur={() => touch('password')}
                              onKeyDown={onCaps}
                              onKeyUp={onCaps}
                              aria-invalid={!!show('password')}
                              aria-describedby="reg-password-hint"
                              className={cn(INPUT, 'pr-10', show('password') && 'border-destructive focus-visible:ring-destructive')}
                            />
                            <button
                              type="button"
                              onClick={() => setShowPassword(!showPassword)}
                              aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
                              aria-pressed={showPassword}
                              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                            >
                              {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                            </button>
                          </div>
                          {capsOn && (
                            <p className="flex items-center gap-1 text-[11px] font-semibold text-amber-600 dark:text-amber-400">
                              <TriangleAlert className="w-3 h-3 shrink-0" /> Caps Lock está ativado.
                            </p>
                          )}
                          {password && (
                            <div id="reg-password-hint" className="space-y-1" aria-live="polite">
                              <div className="flex gap-1">
                                {[1, 2, 3, 4].map(n => (
                                  <span key={n} className={cn('h-1 flex-1 rounded-full transition-colors', n <= score ? STRENGTH[score].bar : 'bg-muted')} />
                                ))}
                              </div>
                              <p className="text-[11px] font-medium text-muted-foreground">
                                Força: <span className="font-bold text-foreground">{STRENGTH[score].label}</span>
                                {score < 3 && ' — misture maiúsculas, números e símbolos.'}
                              </p>
                            </div>
                          )}
                          <FieldError id="reg-password-err" message={show('password')} />
                        </div>

                        <div className="space-y-1">
                          <label htmlFor="reg-confirm" className={LABEL}>
                            <Lock className="w-3.5 h-3.5" /> Confirmar Senha
                          </label>
                          <div className="relative">
                            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground/50 pointer-events-none" />
                            <Input
                              id="reg-confirm"
                              type={showPassword ? 'text' : 'password'}
                              autoComplete="new-password"
                              placeholder="Repita a senha"
                              value={confirm}
                              disabled={loading}
                              onChange={(e) => setConfirm(e.target.value)}
                              onBlur={() => touch('confirm')}
                              aria-invalid={!!show('confirm')}
                              aria-describedby={show('confirm') ? 'reg-confirm-err' : undefined}
                              className={cn(INPUT, show('confirm') && 'border-destructive focus-visible:ring-destructive')}
                            />
                          </div>
                          <FieldError id="reg-confirm-err" message={show('confirm')} />
                        </div>

                        <Button
                          type="submit"
                          disabled={loading}
                          className="group w-full h-10 rounded-xl bg-primary hover:opacity-90 text-primary-foreground font-black uppercase tracking-widest text-[11px] shadow-lg shadow-primary/25 transition-all mt-4"
                        >
                          {loading ? (
                            <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Criando conta…</>
                          ) : (
                            <>Criar Conta <ArrowRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-1" /></>
                          )}
                        </Button>
                      </form>
                    ) : (
                      <form onSubmit={handleForgotPassword} className="space-y-3" noValidate>
                        <div className="space-y-1">
                          <label htmlFor="forgot-email" className={LABEL}>
                            <Mail className="w-3.5 h-3.5" /> E-mail Corporativo
                          </label>
                          <div className="relative">
                            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground/50 pointer-events-none" />
                            <Input
                              id="forgot-email"
                              type="email"
                              autoComplete="email"
                              autoCapitalize="none"
                              spellCheck={false}
                              placeholder="nome@empresa.com.br"
                              value={email}
                              disabled={loading || forgotSent}
                              onChange={(e) => { setEmail(e.target.value); setAuthError(null); }}
                              onBlur={() => touch('email')}
                              aria-invalid={!!show('email')}
                              aria-describedby={show('email') ? 'forgot-email-err' : undefined}
                              className={cn(INPUT, show('email') && 'border-destructive focus-visible:ring-destructive')}
                            />
                          </div>
                          <FieldError id="forgot-email-err" message={show('email')} />
                        </div>

                        <div className="pt-2">
                          {forgotSent ? (
                            <Button
                              type="button"
                              onClick={() => { setForgotSent(false); switchTab('login'); }}
                              className="w-full h-10 rounded-xl bg-primary hover:opacity-90 text-primary-foreground font-black uppercase tracking-widest text-[11px] shadow-lg shadow-primary/25 transition-all mt-4"
                            >
                              Voltar para Login
                            </Button>
                          ) : (
                            <div className="flex flex-col gap-2">
                              <Button
                                type="submit"
                                disabled={loading}
                                className="group w-full h-10 rounded-xl bg-primary hover:opacity-90 text-primary-foreground font-black uppercase tracking-widest text-[11px] shadow-lg shadow-primary/25 transition-all"
                              >
                                {loading ? (
                                  <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Enviando…</>
                                ) : (
                                  <>Solicitar Reset <ArrowRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-1" /></>
                                )}
                              </Button>
                              <Button
                                type="button"
                                variant="ghost"
                                disabled={loading}
                                onClick={() => switchTab('login')}
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
              </div>
            </div>
          </div>
        </div>
      </div>
  );
}
