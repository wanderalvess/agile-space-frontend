'use client';

import { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useUserContext } from '@/context/UserContext';
import { UserProfileModal } from '@/components/layout/UserProfileModal';
import { cn } from '@/lib/utils';

export const ONBOARDING_EXEMPT_ROUTES = ['/onboarding', '/login'];

export const isCollaborativeRoute = (path: string) => {
  return (
    path.startsWith('/room/') ||
    path.startsWith('/showcase/') ||
    path.startsWith('/retro/') ||
    path.startsWith('/brainstorming/') ||
    path.startsWith('/health-check/') ||
    path.startsWith('/action-plan/') ||
    path.startsWith('/jiradash')
  );
};

export function IdentityGatekeeper({ children }: { children: React.ReactNode }) {
  const { mustOnboard, isInitializing, isIdentityRequested, isPublicExploration } = useUserContext();
  const pathname = usePathname();
  const router = useRouter();

  // Sem projeto vinculado ainda: manda direto pro fluxo de onboarding (criar/entrar/sincronizar)
  // a menos que o usuário esteja acessando uma cerimônia colaborativa para a qual foi convidado.
  useEffect(() => {
    if (isInitializing) return;
    if (mustOnboard && !ONBOARDING_EXEMPT_ROUTES.includes(pathname) && !isCollaborativeRoute(pathname)) {
      router.replace('/onboarding');
    }
  }, [mustOnboard, isInitializing, pathname, router]);

  // Enquanto inicializa a sessão, não bloqueamos para evitar flashes indesejados
  // O Header já lida com o estado de carregamento visual
  if (isInitializing) {
    return <>{children}</>;
  }

  // Se o usuário optou por explorar publicamente (mesmo com onboarding pendente),
  // removemos o bloqueio visual
  const shouldBlock = isIdentityRequested && !isPublicExploration;
  const shouldPreventEvents = shouldBlock;

  return (
    <>
      <div className={cn(
        "transition-all duration-500",
        shouldBlock && "blur-sm",
        shouldPreventEvents && "pointer-events-none"
      )}>
        {children}
      </div>

      {/* Edição voluntária de perfil (nome, avatar) — não é mais o caminho de onboarding obrigatório */}
      <UserProfileModal />
    </>
  );
}
