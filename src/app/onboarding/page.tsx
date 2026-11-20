'use client';

import { OnboardingFlow } from '@/components/onboarding/OnboardingFlow';
import { PageShell } from '@/components/page';

/**
 * /onboarding — o fluxo de entrada na squad. Cada tela mora em components/onboarding.
 * A pessoa ainda pode não ter squad: o cabeçalho vai sem o seletor (`squadControl={null}`).
 * O fluxo traz o próprio espaçamento e o halo, por isso o miolo do shell vai sem folga.
 */
export default function OnboardingPage() {
  return (
    <PageShell
      documentTitle="Entrar na squad"
      header={{ squadControl: null }}
      width="wide"
      contentClassName="gap-0 p-0 sm:p-0 2xl:px-0 pb-0 sm:pb-0 pt-0 sm:pt-0"
    >
      <OnboardingFlow />
    </PageShell>
  );
}
