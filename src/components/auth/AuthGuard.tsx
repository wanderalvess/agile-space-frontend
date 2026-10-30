'use client';

import { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { AgileSpinner } from '@/components/ui/AgileSpinner';
import { SQUAD_SUMMARY_HREF } from '@/lib/squad-hub';
import { hasLinkedTeam, isJustSignedUp } from '@/lib/team-welcome';
import { readPendingInvite } from '@/lib/pending-invite';

const PUBLIC_ROUTES = ['/login'];

/**
 * Rotas abertas a quem não está logado, mas que também servem a quem está (não redirecionam).
 * Só páginas cujo dado vem de endpoint público do servidor: o changelog (`GET /api/changelog`) e a
 * redefinição de senha pelo link (`POST /api/auth/reset-password`, a pessoa não tem sessão) e a página do convite
 * (`GET /api/public/invites/{token}`): quem recebe o link precisa ver a squad antes de entrar ou criar a conta.
 * O Jolt (`/jolt`, Sandbox e Gerador) abre a visitantes só para ler e editar: executar, gerar e salvar pedem login
 * (a execução no servidor exige token) e as telas mostram o diálogo "Entre para executar".
 */
const OPEN_ROUTES = ['/changelog', '/reset-password', '/invite', '/jolt'];

export function isOpenRoute(path: string): boolean {
  return OPEN_ROUTES.some((route) => path === route || path.startsWith(route + '/'));
}

/**
 * Só aceita caminho do próprio app. '//host' e '/\host' parecem caminhos mas o navegador os trata como outro
 * site; tab/quebra de linha e barra invertida são removidos ou normalizados pelo parser de URL e transformam
 * '/<TAB>/evil.com' em '//evil.com'. Por isso rejeita caracteres de controle e barra invertida e confere
 * a origem resultante.
 */
export function isSafeInternalPath(path: string): boolean {
  if (!path.startsWith('/') || path.startsWith('//')) return false;
  if (/[\u0000-\u001f\u007f\\]/.test(path)) return false;
  try {
    return new URL(path, 'http://internal.invalid').origin === 'http://internal.invalid';
  } catch {
    return false;
  }
}

/**
 * Para onde ir depois de entrar. Um link (returnUrl) sempre vence: quem chegou por uma sala vai para a sala.
 * Sem link, quem tem um convite pendente neste navegador volta a ele (o returnUrl pode ter se perdido no caminho);
 * depois, quem acabou de criar a conta e já foi vinculado a um time vai direto ao Resumo dele.
 */
export function resolvePostLoginRedirect(returnUrl: string | null, opts?: { linkedTeam?: boolean; pendingInviteToken?: string | null }): string {
  const isInternalPath = !!returnUrl && isSafeInternalPath(returnUrl);
  if (returnUrl && isInternalPath && !returnUrl.startsWith('/login')) {
    return returnUrl;
  }
  if (opts?.pendingInviteToken) return `/invite/${encodeURIComponent(opts.pendingInviteToken)}`;
  return opts?.linkedTeam ? SQUAD_SUMMARY_HREF : '/';
}

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading, session } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const isPublicRoute = PUBLIC_ROUTES.includes(pathname);
  const isOpen = isOpenRoute(pathname);

  useEffect(() => {
    if (isLoading) return;
    if (!isAuthenticated && !isPublicRoute && !isOpen) {
      const currentQuery = typeof window !== 'undefined' ? window.location.search : '';
      const fullTarget = `${pathname}${currentQuery}`;
      const returnUrl = encodeURIComponent(fullTarget);
      router.replace(`/login?returnUrl=${returnUrl}`);
    }
    if (isAuthenticated && isPublicRoute) {
      let target = '/';
      if (typeof window !== 'undefined') {
        const params = new URLSearchParams(window.location.search);
        target = resolvePostLoginRedirect(params.get('returnUrl'), {
          linkedTeam: isJustSignedUp() && hasLinkedTeam(session?.activeProjectId),
          pendingInviteToken: readPendingInvite(),
        });
      }
      router.replace(target);
    }
  }, [isLoading, isAuthenticated, isPublicRoute, isOpen, router, pathname, session]);

  if (isPublicRoute || isOpen) {
    return <>{children}</>;
  }

  if (isLoading || !isAuthenticated) {
    return (
      <div className="flex min-h-dvh w-full items-center justify-center">
        <AgileSpinner size="lg" />
      </div>
    );
  }

  return <>{children}</>;
}
