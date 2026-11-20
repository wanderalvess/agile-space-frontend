'use client';

import { useCallback, useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useUserContext } from '@/context/UserContext';
import { UserProfileModal } from '@/components/layout/UserProfileModal';
import { LegacyOnlyNotice } from '@/components/onboarding/LegacyOnlyNotice';
import { cn } from '@/lib/utils';

export const ONBOARDING_EXEMPT_ROUTES = ['/onboarding', '/login', '/reset-password'];

export const isCollaborativeRoute = (path: string) => {
  return (
    path.startsWith('/room/') ||
    path.startsWith('/showcase/') ||
    path.startsWith('/retro/') ||
    path.startsWith('/brainstorming/') ||
    path.startsWith('/health-check/') ||
    path.startsWith('/action-plan/')
  );
};

const LEGACY_NOTICE_DISMISSED_KEY = 'agileSpace_legacyNoticeDismissed';

/** Rotas onde o aviso de "sem vínculo" não aparece: o próprio fluxo de vínculo, login, salas e convites. */
export function hidesLegacyNotice(path: string): boolean {
  return ONBOARDING_EXEMPT_ROUTES.includes(path) || isCollaborativeRoute(path) || path.startsWith('/invite/');
}

export function IdentityGatekeeper({ children }: { children: React.ReactNode }) {
  const { mustOnboard, legacyOnly, isInitializing, isIdentityRequested, isPublicExploration } = useUserContext();
  const pathname = usePathname();
  const router = useRouter();
  const [noticeDismissed, setNoticeDismissed] = useState(() => {
    try {
      return typeof window !== 'undefined' && sessionStorage.getItem(LEGACY_NOTICE_DISMISSED_KEY) === '1';
    } catch {
      return false;
    }
  });
  const dismissNotice = useCallback(() => {
    setNoticeDismissed(true);
    try {
      sessionStorage.setItem(LEGACY_NOTICE_DISMISSED_KEY, '1');
    } catch {
      /* sem storage: some só até recarregar */
    }
  }, []);

  // Sem projeto vinculado ainda: manda direto pro fluxo de onboarding (criar/entrar/sincronizar)
  // a menos que o usuário esteja acessando uma cerimônia colaborativa para a qual foi convidado.
  useEffect(() => {
    if (isInitializing) return;
    // /invite/{token} precisa do mesmo passe livre que as rotas colaborativas: é
    // exatamente o link que resolve "usuário sem squad ainda" — forçar onboarding
    // antes jogaria fora o vínculo que o convite ia estabelecer.
    if (mustOnboard && !ONBOARDING_EXEMPT_ROUTES.includes(pathname) && !isCollaborativeRoute(pathname) && !pathname.startsWith('/invite/')) {
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
        {legacyOnly && !mustOnboard && !noticeDismissed && !hidesLegacyNotice(pathname) && (
          <div className="px-4 pt-3 sm:px-6">
            <LegacyOnlyNotice onAction={() => router.push('/onboarding')} onDismiss={dismissNotice} />
          </div>
        )}
        {children}
      </div>

      {/* Edição voluntária de perfil (nome, avatar) — não é mais o caminho de onboarding obrigatório */}
      <UserProfileModal />
    </>
  );
}
