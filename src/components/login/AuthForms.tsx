'use client';

import { useEffect, useRef } from 'react';
import { CheckCircle2, Lock, Mail, User as UserIcon } from 'lucide-react';
import {
  CapsLockNote,
  FOCUS_RING,
  GhostButton,
  PasswordToggle,
  SecondaryButton,
  StrengthMeter,
  SubmitButton,
  TextField,
} from './login-fields';
import type { LoginFlow } from './useLoginFlow';
import { cn } from '@/lib/utils';

/** Os três formulários do login. Estado e envio vêm de useLoginFlow; aqui só a montagem. */

export function LoginForm({ flow }: { flow: LoginFlow }) {
  const { values, setters, show, blur, loading, showPassword, capsOn, hasSavedEmail, passwordFocusToken } = flow;
  const passwordInput = useRef<HTMLInputElement>(null);
  // Com o e-mail lembrado, a pessoa só digita a senha; depois de uma falha, o foco volta para ela.
  useEffect(() => {
    if (hasSavedEmail || passwordFocusToken > 0) passwordInput.current?.focus();
  }, [hasSavedEmail, passwordFocusToken]);
  return (
    <form onSubmit={flow.handleLogin} className="space-y-3.5" noValidate>
      <TextField
        id="login-email"
        label="E-mail ou usuário"
        icon={Mail}
        type="text"
        name="email"
        autoComplete="username"
        autoCapitalize="none"
        spellCheck={false}
        placeholder="nome@empresa.com.br"
        value={values.email}
        disabled={loading}
        onChange={(e) => setters.email(e.target.value)}
        onBlur={() => blur('email')}
        error={show('email')}
      />
      <TextField
        id="login-password"
        label="Senha"
        icon={Lock}
        ref={passwordInput}
        type={showPassword ? 'text' : 'password'}
        name="password"
        autoComplete="current-password"
        placeholder="••••••••"
        value={values.password}
        disabled={loading}
        onChange={(e) => setters.password(e.target.value)}
        onBlur={() => blur('password')}
        onKeyDown={flow.onCaps}
        onKeyUp={flow.onCaps}
        error={show('password')}
        aside={
          <button
            type="button"
            onClick={() => flow.switchMode('forgot')}
            className={cn('rounded-sm text-[13px] font-semibold text-foreground underline decoration-primary decoration-2 underline-offset-4 hover:decoration-foreground', FOCUS_RING)}
          >
            Esqueceu a senha?
          </button>
        }
        trailing={<PasswordToggle shown={showPassword} onToggle={flow.toggleShowPassword} disabled={loading} />}
      >
        {capsOn && <CapsLockNote />}
      </TextField>
      <SubmitButton loading={loading} idle="Acessar plataforma" busy="Entrando…" />
      {loading && (
        <p className="sr-only" role="status">
          Entrando…
        </p>
      )}
    </form>
  );
}

export function RegisterForm({ flow }: { flow: LoginFlow }) {
  const { values, setters, show, blur, loading, showPassword, capsOn } = flow;
  return (
    <form onSubmit={flow.handleRegister} className="space-y-3 [@media(max-height:760px)]:space-y-2.5" noValidate>
      <TextField
        id="reg-name"
        label="Nome completo"
        icon={UserIcon}
        type="text"
        autoComplete="name"
        placeholder="João da Silva"
        value={values.name}
        disabled={loading}
        onChange={(e) => setters.name(e.target.value)}
        onBlur={() => blur('name')}
        error={show('name')}
      />
      <TextField
        id="reg-email"
        label="E-mail corporativo"
        icon={Mail}
        type="email"
        autoComplete="email"
        autoCapitalize="none"
        spellCheck={false}
        placeholder="nome@empresa.com.br"
        value={values.email}
        disabled={loading}
        onChange={(e) => setters.email(e.target.value)}
        onBlur={() => blur('email')}
        error={show('email')}
      />
      <TextField
        id="reg-password"
        label="Definir senha"
        icon={Lock}
        type={showPassword ? 'text' : 'password'}
        autoComplete="new-password"
        placeholder="Mínimo 8 caracteres"
        value={values.password}
        disabled={loading}
        onChange={(e) => setters.password(e.target.value)}
        onBlur={() => blur('password')}
        onKeyDown={flow.onCaps}
        onKeyUp={flow.onCaps}
        aria-describedby="reg-password-strength"
        error={show('password')}
        trailing={<PasswordToggle shown={showPassword} onToggle={flow.toggleShowPassword} disabled={loading} />}
      >
        {capsOn && <CapsLockNote />}
        <StrengthMeter id="reg-password-strength" password={values.password} />
      </TextField>
      <TextField
        id="reg-confirm"
        label="Confirmar senha"
        icon={Lock}
        type={showPassword ? 'text' : 'password'}
        autoComplete="new-password"
        placeholder="Repita a senha"
        value={values.confirm}
        disabled={loading}
        onChange={(e) => setters.confirm(e.target.value)}
        onBlur={() => blur('confirm')}
        error={show('confirm')}
      />
      <div className="pt-1">
        <SubmitButton loading={loading} idle="Criar conta" busy="Criando conta…" />
      </div>
    </form>
  );
}

export function ForgotForm({ flow }: { flow: LoginFlow }) {
  const { values, setters, show, blur, loading, forgotSent } = flow;

  if (forgotSent) {
    return (
      <div role="status" className="flex flex-col items-center gap-3.5 text-center">
        <span className="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-700 dark:text-emerald-400">
          <CheckCircle2 aria-hidden="true" strokeWidth={1.5} className="h-7 w-7" />
        </span>
        <span className="text-[15px] font-bold text-foreground">Solicitação registrada</span>
        <span className="text-[13px] leading-relaxed text-muted-foreground">
          Aguarde a aprovação do seu Admin, Agile Master ou Tribe Lead.
        </span>
        <SecondaryButton onClick={flow.backToLogin}>Voltar para o login</SecondaryButton>
      </div>
    );
  }

  return (
    <form onSubmit={flow.handleForgot} className="space-y-3.5" noValidate>
      <TextField
        id="forgot-email"
        label="E-mail corporativo"
        icon={Mail}
        type="email"
        autoComplete="email"
        autoCapitalize="none"
        spellCheck={false}
        placeholder="nome@empresa.com.br"
        value={values.email}
        disabled={loading}
        onChange={(e) => setters.email(e.target.value)}
        onBlur={() => blur('email')}
        error={show('email')}
      />
      <div className="flex flex-col gap-2 pt-1">
        <SubmitButton loading={loading} idle="Solicitar reset" busy="Enviando…" />
        <GhostButton disabled={loading} onClick={() => flow.switchMode('login')}>
          Voltar para o login
        </GhostButton>
      </div>
    </form>
  );
}
