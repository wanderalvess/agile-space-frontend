'use client';

import React, { useMemo, useState, useSyncExternalStore } from 'react';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/context/AuthContext';
import { clearJustSignedUp, markJustSignedUp } from '@/lib/team-welcome';
import { loginContextFrom, signUpToastDescription } from '@/lib/login-context';
import {
  errorMessage,
  getFieldErrors,
  hasBlockingError,
  LAST_EMAIL_KEY,
  type FieldKey,
  type LoginMode,
} from './login-utils';

const noopSubscribe = () => () => {};

function readSavedEmail(): string {
  try {
    return localStorage.getItem(LAST_EMAIL_KEY) ?? '';
  } catch {
    // localStorage indisponível (modo privado etc.): segue sem pré-preencher.
    return '';
  }
}

/**
 * Estado e ações das três telas do login (entrar, cadastrar, recuperar senha). O redirecionamento depois de entrar
 * não é feito aqui: o AuthGuard decide o destino (returnUrl, onboarding, squad ativa) assim que a sessão existe.
 */
export function useLoginFlow() {
  const { toast } = useToast();
  const { login, register } = useAuth();

  const [mode, setMode] = useState<LoginMode>('login');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [forgotSent, setForgotSent] = useState(false);

  const [typedEmail, setEmail] = useState<string | null>(null);
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [confirm, setConfirm] = useState('');
  const [capsOn, setCapsOn] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [shakeKey, setShakeKey] = useState(0);
  const [touched, setTouched] = useState<Partial<Record<FieldKey, boolean>>>({});
  // Pedido de foco no campo de senha (falha de login). Quem foca é o LoginForm, depois de o campo voltar a ficar habilitado.
  const [passwordFocusToken, setPasswordFocusToken] = useState(0);

  // Chegou por um link (convite, sala): o cartão diz para onde a pessoa volta depois de entrar.
  // Lido do endereço só no navegador (no servidor fica vazio), sem estado extra nem divergência na hidratação.
  const search = useSyncExternalStore(noopSubscribe, () => window.location.search, () => '');
  const linkContext = useMemo(() => loginContextFrom(new URLSearchParams(search).get('returnUrl')), [search]);

  // Lembra apenas o e-mail (nunca a senha) para não digitar a cada login.
  const savedEmail = useSyncExternalStore(noopSubscribe, readSavedEmail, () => '');
  const email = typedEmail ?? savedEmail;

  // Ao sair do campo só aponta erro de quem digitou algo. Campo vazio fica para o envio: o erro que aparece no
  // blur empurra o cartão (centralizado) e fazia o clique seguinte (ex.: "Esqueceu a senha?") se perder.
  const blur = (f: FieldKey) => {
    if (values[f]) setTouched((t) => ({ ...t, [f]: true }));
  };
  const failAuth = (msg: string) => {
    setAuthError(msg);
    setShakeKey((k) => k + 1);
  };
  const switchMode = (next: LoginMode) => {
    setMode(next);
    setAuthError(null);
    setTouched({});
  };
  const onCaps = (e: React.KeyboardEvent) => setCapsOn(e.getModifierState?.('CapsLock') ?? false);

  const values = { name, email, password, confirm };
  const errors = getFieldErrors(mode, values);
  const show = (f: FieldKey) => (touched[f] ? errors[f] : undefined);

  const setters = {
    name: (v: string) => {
      setName(v);
      setAuthError(null);
    },
    email: (v: string) => {
      setEmail(v);
      setAuthError(null);
    },
    password: (v: string) => {
      setPassword(v);
      setAuthError(null);
    },
    confirm: (v: string) => {
      setConfirm(v);
      setAuthError(null);
    },
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setTouched((t) => ({ ...t, email: true, password: true }));
    if (hasBlockingError('login', errors)) return;
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
    } catch (err) {
      // A mensagem vem do servidor, inclusive a do limite de tentativas (429).
      failAuth(errorMessage(err, 'E-mail ou senha inválidos.'));
      setPassword('');
      // O campo esvaziado pela falha não deve acusar "Informe a senha" logo depois da mensagem do servidor.
      setTouched((t) => ({ ...t, password: false }));
      setPasswordFocusToken((t) => t + 1);
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setTouched({ name: true, email: true, password: true, confirm: true });
    if (hasBlockingError('register', errors)) return;
    setAuthError(null);

    setLoading(true);
    try {
      // Gravado antes: o AuthGuard decide o destino assim que a sessão existe.
      markJustSignedUp();
      const session = await register({
        email,
        name,
        password,
        jiraAccountId: email.split('@')[0],
      });
      toast({
        title: 'Conta criada com sucesso!',
        description: signUpToastDescription(session.activeProjectName || session.activeProjectId, linkContext),
      });
    } catch (err) {
      clearJustSignedUp();
      failAuth(errorMessage(err, 'Não foi possível registrar o usuário.'));
    } finally {
      setLoading(false);
    }
  };

  const handleForgot = async (e: React.FormEvent) => {
    e.preventDefault();
    setTouched((t) => ({ ...t, email: true }));
    if (hasBlockingError('forgot', errors)) return;
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
        title: 'Solicitação registrada',
        description: 'Um evento foi gravado na Auditoria. Solicite a aprovação ao seu Admin, Agile Master ou Tribe Lead.',
      });
    } catch (err) {
      failAuth(errorMessage(err, 'Não foi possível registrar o pedido de reset.'));
    } finally {
      setLoading(false);
    }
  };

  const backToLogin = () => {
    setForgotSent(false);
    switchMode('login');
  };

  return {
    mode,
    switchMode,
    backToLogin,
    loading,
    showPassword,
    toggleShowPassword: () => setShowPassword((v) => !v),
    forgotSent,
    values,
    setters,
    show,
    blur,
    capsOn,
    onCaps,
    authError,
    shakeKey,
    hasSavedEmail: savedEmail !== '',
    passwordFocusToken,
    linkContext,
    handleLogin,
    handleRegister,
    handleForgot,
  };
}

export type LoginFlow = ReturnType<typeof useLoginFlow>;
