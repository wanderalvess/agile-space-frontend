'use client';

import React, { useCallback, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Lock, type LucideIcon } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { ConfirmDialog, ModalButton } from '@/components/room-kit';
import { TONES, type Tone } from '@/components/room-kit/tokens';
import { cn } from '@/lib/utils';

/** Quem está usando o Jolt: logado, visitante ou ainda carregando a sessão (nesse caso nada de "Entre" piscando). */
export function useJoltIdentity() {
  const { session, isAuthenticated, isLoading } = useAuth();
  const router = useRouter();
  const [loginOpen, setLoginOpen] = useState(false);

  const goLogin = useCallback(() => {
    const here = typeof window === 'undefined' ? '/jolt' : window.location.pathname + window.location.search;
    router.push(`/login?returnUrl=${encodeURIComponent(here)}`);
  }, [router]);

  return {
    userId: isAuthenticated ? session?.id ?? null : null,
    userName: isAuthenticated ? session?.name ?? null : null,
    isLoading,
    isGuest: !isLoading && !isAuthenticated,
    loginOpen,
    askLogin: () => setLoginOpen(true),
    closeLogin: () => setLoginOpen(false),
    goLogin,
  };
}

/** "Entre para executar": aparece quando um visitante tenta executar, salvar ou gerar. */
export function LoginRequiredDialog({ open, onOpenChange, onLogin }: { open: boolean; onOpenChange: (open: boolean) => void; onLogin: () => void }) {
  return (
    <ConfirmDialog
      open={open}
      onOpenChange={onOpenChange}
      tone="brand"
      icon={Lock}
      title="Entre para executar"
      description="Você pode ler, editar e conhecer o Jolt sem entrar. Para executar uma transformação, gerar uma spec ou salvar um layout, entre com a sua conta do portal."
      cancelLabel="Agora não"
      confirmLabel="Entrar"
      onConfirm={onLogin}
    />
  );
}

const NOTICE_STYLE: Record<'warn' | 'danger' | 'success' | 'neutral', string> = {
  warn: 'border-amber-500/40 bg-amber-500/10',
  danger: 'border-red-500/40 bg-red-500/10',
  success: 'border-emerald-500/40 bg-emerald-500/10',
  neutral: 'border-dashed border-border bg-transparent',
};

/** Aviso em faixa: âmbar (atenção), vermelho (erro), verde (ok) ou tracejado neutro (nada feito ainda). */
export function Notice({
  tone = 'warn',
  icon: Icon,
  children,
  action,
  role,
  className,
}: {
  tone?: 'warn' | 'danger' | 'success' | 'neutral';
  icon?: LucideIcon;
  children: React.ReactNode;
  action?: React.ReactNode;
  role?: 'status' | 'alert' | 'note';
  className?: string;
}) {
  const iconTone: Tone = tone === 'neutral' ? 'neutral' : tone;
  return (
    <div role={role} className={cn('flex flex-wrap items-center gap-x-3 gap-y-2 rounded-xl border px-4 py-3 text-sm leading-relaxed text-foreground', NOTICE_STYLE[tone], className)}>
      {Icon && <Icon className={cn('h-[18px] w-[18px] shrink-0', TONES[iconTone].text)} strokeWidth={1.5} aria-hidden="true" />}
      <div className="min-w-[240px] flex-1">{children}</div>
      {action}
    </div>
  );
}

/** Faixa do topo para visitantes. */
export function GuestBanner({ children, onLogin }: { children: React.ReactNode; onLogin: () => void }) {
  return (
    <Notice tone="warn" icon={Lock} role="status" action={<ModalButton variant="primary" onClick={onLogin} className="h-9">Entrar</ModalButton>}>
      {children}
    </Notice>
  );
}
