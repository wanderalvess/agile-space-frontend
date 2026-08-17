'use client';

import { useUserContext } from '@/context/UserContext';
import { UserProfileModal } from '@/components/layout/UserProfileModal';
import { cn } from '@/lib/utils';

export function IdentityGatekeeper({ children }: { children: React.ReactNode }) {
  const { mustOnboard, isInitializing, isIdentityRequested, isPublicExploration } = useUserContext();

  // Enquanto inicializa o Firebase/Auth, não bloqueamos para evitar flashes indesejados
  // O Header já lida com o estado de carregamento visual
  if (isInitializing) {
    return <>{children}</>;
  }

  // Se o usuário optou por explorar publicamente (mesmo com onboarding pendente),
  // removemos o bloqueio visual
  const shouldBlock = (mustOnboard || isIdentityRequested) && !isPublicExploration;
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
      
      {/* O Modal detecta automaticamente o flag 'mustOnboard' e abre em modo mandatório */}
      <UserProfileModal />
    </>
  );
}
