'use client';

import { LogIn, UserRound } from 'lucide-react';
import { IconTile, ModalButton } from '@/components/room-kit';

/** Quem não entrou ainda: sem perfil para editar, o caminho é entrar na conta. */
export function VisitorPanel({ onLogin }: { onLogin: () => void }) {
  return (
    <section aria-labelledby="identity-visitante" className="flex min-h-full flex-col items-center justify-center gap-4 px-6 py-10 text-center max-sm:px-4">
      <IconTile icon={UserRound} tone="neutral" size="lg" />
      <div className="flex flex-col gap-1">
        <h3 id="identity-visitante" className="text-lg font-bold leading-tight text-foreground">
          Você está como visitante
        </h3>
        <p className="text-[13px] text-muted-foreground">Entre na sua conta para ver suas squads e usar as ferramentas do time.</p>
      </div>
      <ModalButton variant="primary" onClick={onLogin} className="gap-2 max-sm:h-11 max-sm:w-full">
        <LogIn aria-hidden="true" className="h-4 w-4" strokeWidth={1.5} />
        Entrar
      </ModalButton>
    </section>
  );
}
