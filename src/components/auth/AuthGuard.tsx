'use client';

import { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { AgileSpinner } from '@/components/ui/AgileSpinner';

const PUBLIC_ROUTES = ['/login'];

export function resolvePostLoginRedirect(returnUrl: string | null): string {
  if (returnUrl && returnUrl.startsWith('/') && !returnUrl.startsWith('/login')) {
    return returnUrl;
  }
  return '/';
}

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth();
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
        target = resolvePostLoginRedirect(params.get('returnUrl'));
      }
      router.replace(target);
    }
  }, [isLoading, isAuthenticated, isPublicRoute, router, pathname]);

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
