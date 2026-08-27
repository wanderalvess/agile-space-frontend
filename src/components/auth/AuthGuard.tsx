'use client';

import { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { AgileSpinner } from '@/components/ui/AgileSpinner';

const PUBLIC_ROUTES = ['/login'];

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const isPublicRoute = PUBLIC_ROUTES.includes(pathname);

  useEffect(() => {
    if (isLoading) return;
    if (!isAuthenticated && !isPublicRoute) {
      router.replace('/login');
    }
    if (isAuthenticated && isPublicRoute) {
      router.replace('/');
    }
  }, [isLoading, isAuthenticated, isPublicRoute, router]);

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
