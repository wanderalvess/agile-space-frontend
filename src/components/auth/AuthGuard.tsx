'use client';

import { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { AgileSpinner } from '@/components/ui/AgileSpinner';
import { hasLinkedTeam, isJustSignedUp } from '@/lib/team-welcome';

const PUBLIC_ROUTES = ['/login'];

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
 * Sem link, quem acabou de criar a conta e já foi vinculado a um time vai direto ao Painel dele.
 */
export function resolvePostLoginRedirect(returnUrl: string | null, opts?: { linkedTeam?: boolean }): string {
  const isInternalPath = !!returnUrl && isSafeInternalPath(returnUrl);
  if (returnUrl && isInternalPath && !returnUrl.startsWith('/login')) {
    return returnUrl;
  }
  return opts?.linkedTeam ? '/painel' : '/';
}

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading, session } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const isPublicRoute = PUBLIC_ROUTES.includes(pathname);

  useEffect(() => {
    if (isLoading) return;
    if (!isAuthenticated && !isPublicRoute) {
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
        });
      }
      router.replace(target);
    }
  }, [isLoading, isAuthenticated, isPublicRoute, router, pathname, session]);

  if (isPublicRoute) {
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
