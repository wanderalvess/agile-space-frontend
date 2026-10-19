'use client';

import { Suspense } from 'react';
import { LoginPanel } from '@/components/login/LoginPanel';
import { LoginShowcase } from '@/components/login/LoginShowcase';
import { useLoginFlow } from '@/components/login/useLoginFlow';

/**
 * Entrar, cadastrar e recuperar senha. Estado e envio em useLoginFlow; o destino depois de entrar (convite, sala,
 * onboarding, squad ativa) é decidido pelo AuthGuard assim que a sessão existe.
 * Só tokens semânticos: vale para os 7 temas, claro e escuro. O halo do fundo é discreto e some no tema "leitura".
 */
function LoginScreen() {
  const flow = useLoginFlow();

  return (
    <main className="relative flex min-h-dvh w-full items-center justify-center overflow-hidden bg-background p-4 sm:p-8 [@media(max-height:760px)]:sm:py-4">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_55%_55%_at_35%_50%,hsl(var(--primary)/0.07),transparent_70%)] dark:bg-[radial-gradient(ellipse_55%_55%_at_35%_50%,hsl(var(--primary)/0.12),transparent_70%)] [.theme-leitura_&]:hidden"
      />

      <div className="relative w-full max-w-[1000px] overflow-hidden rounded-[28px] border border-border bg-card shadow-2xl lg:grid lg:min-h-[600px] lg:grid-cols-[10fr_11fr] [@media(max-height:760px)]:lg:min-h-0">
        <LoginShowcase className="hidden lg:flex" />
        <LoginPanel flow={flow} />
      </div>
    </main>
  );
}

/** useSearchParams (destino e aba) pede um limite de Suspense para a página poder ser pré-renderizada. */
export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginScreen />
    </Suspense>
  );
}
