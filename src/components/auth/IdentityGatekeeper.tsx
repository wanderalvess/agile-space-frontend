'use client';

import { usePathname, useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { useUserContext } from '@/context/UserContext';

export function IdentityGatekeeper({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { userProfile, isInitializing } = useUserContext();

  useEffect(() => {
    if (isInitializing) return;
    
    // Se não estiver na página de login e não houver usuário autenticado, redireciona
    if (pathname !== '/login' && !userProfile) {
      router.replace('/login');
    }
  }, [userProfile, isInitializing, pathname, router]);

  if (isInitializing) {
    return <>{children}</>;
  }

  return <>{children}</>;
}
