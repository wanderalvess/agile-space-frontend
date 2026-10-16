'use client';

import Link from 'next/link';
import { AlertCircle, CheckCircle2, KeyRound, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { FOCUS_RING, TONES } from '@/components/room-kit/tokens';
import { ACCESS_INPUT, AccessButton, AccessCard, AccessPage } from '@/components/access/access-ui';
import { PasswordStrength } from '@/components/access/PasswordStrength';
import { MIN_PASSWORD_LENGTH } from '@/lib/password-api';

export interface ResetPasswordViewProps {
  /** Sem token na URL o link está incompleto. */
  hasToken: boolean;
  done: boolean;
  password: string;
  confirmation: string;
  onPasswordChange: (value: string) => void;
  onConfirmationChange: (value: string) => void;
  error: string | null;
  saving: boolean;
  onSubmit: (e: React.FormEvent) => void;
}

const LABEL = 'text-xs font-bold uppercase tracking-wider text-muted-foreground';

function Notice({ tone, role, children }: { tone: 'success' | 'danger'; role: 'status' | 'alert'; children: React.ReactNode }) {
  return (
    <div role={role} className={cn('flex items-start gap-2.5 rounded-xl border px-3.5 py-3 text-sm', TONES[tone].chip, tone === 'success' ? 'border-emerald-500/30' : 'border-red-500/40')}>
      {tone === 'success' ? <CheckCircle2 className="mt-0.5 h-[18px] w-[18px] shrink-0" strokeWidth={1.5} aria-hidden="true" /> : <AlertCircle className="mt-0.5 h-[18px] w-[18px] shrink-0" strokeWidth={1.5} aria-hidden="true" />}
      <span>{children}</span>
    </div>
  );
}

/** Tela de `/reset-password`: sem link, formulário (com erro do servidor) e concluída. */
export function ResetPasswordView(p: ResetPasswordViewProps) {
  const describedBy = p.error ? 'rp-error' : undefined;
  return (
    <AccessPage>
      <AccessCard className="max-w-[460px] gap-[18px]">
        <div className="flex items-center gap-3">
          <span aria-hidden="true" className={cn('flex h-11 w-11 shrink-0 items-center justify-center rounded-xl', TONES.brand.tile)}>
            <KeyRound className="h-[22px] w-[22px]" strokeWidth={1.5} />
          </span>
          <div className="flex flex-col leading-tight">
            <h1 className="text-xl font-bold text-foreground">Redefinir senha</h1>
            <span className="text-xs text-muted-foreground">Portal Tech V&amp;D</span>
          </div>
        </div>

        {p.done ? (
          <div className="flex flex-col gap-3.5">
            <Notice tone="success" role="status">
              Senha redefinida. Entre com a nova senha.
            </Notice>
            <AccessButton variant="primary" asChild>
              <Link href="/login">Ir para o login</Link>
            </AccessButton>
          </div>
        ) : !p.hasToken ? (
          <div className="flex flex-col gap-3.5">
            <Notice tone="danger" role="alert">
              Link incompleto. Peça um novo link a um Admin.
            </Notice>
            <AccessButton variant="secondary" asChild>
              <Link href="/login">Voltar ao login</Link>
            </AccessButton>
          </div>
        ) : (
          <form onSubmit={p.onSubmit} className="flex flex-col gap-4" noValidate>
            <p className="text-sm text-muted-foreground">Defina a sua nova senha. O link vale uma vez só.</p>
            <div className="flex flex-col gap-1.5">
              <label htmlFor="new-password" className={LABEL}>
                Nova senha
              </label>
              <input
                id="new-password"
                type="password"
                autoComplete="new-password"
                value={p.password}
                onChange={(e) => p.onPasswordChange(e.target.value)}
                placeholder={`Pelo menos ${MIN_PASSWORD_LENGTH} caracteres`}
                aria-describedby={cn('rp-strength', describedBy) || undefined}
                aria-invalid={!!p.error}
                className={ACCESS_INPUT}
              />
            </div>
            <PasswordStrength id="rp-strength" password={p.password} />
            <div className="flex flex-col gap-1.5">
              <label htmlFor="confirm-password" className={LABEL}>
                Confirmar nova senha
              </label>
              <input
                id="confirm-password"
                type="password"
                autoComplete="new-password"
                value={p.confirmation}
                onChange={(e) => p.onConfirmationChange(e.target.value)}
                aria-describedby={describedBy}
                aria-invalid={!!p.error}
                className={ACCESS_INPUT}
              />
            </div>
            {p.error && (
              <p id="rp-error" role="alert" className={cn('flex items-center gap-1.5 text-[13px] font-semibold', TONES.danger.text)}>
                <AlertCircle className="h-3.5 w-3.5 shrink-0" strokeWidth={1.5} aria-hidden="true" /> {p.error}
              </p>
            )}
            <AccessButton type="submit" variant="primary" disabled={p.saving} className="sm:w-full">
              {p.saving ? <Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" strokeWidth={1.5} aria-label="Redefinindo senha" /> : 'Redefinir senha'}
            </AccessButton>
            <Link href="/login" className={cn('rounded-md text-center text-[13px] text-muted-foreground hover:text-foreground', FOCUS_RING)}>
              Voltar ao login
            </Link>
          </form>
        )}
      </AccessCard>
    </AccessPage>
  );
}
