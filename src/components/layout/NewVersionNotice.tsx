'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { FOCUS_RING, IconTile, ModalButton } from '@/components/room-kit';
import { moduleIcon } from '@/lib/modules-registry';
import { useNewVersion } from '@/lib/new-version';

/**
 * Aviso curto de versão nova, uma vez por versão, em qualquer página que tenha o rodapé do portal.
 * "Ver o que mudou" leva às Versões e marca como lido; "Agora não" só dispensa o aviso (o ponto no rodapé fica).
 * Não aparece para visitante sem sessão, nem na própria página Versões.
 */
export function NewVersionNotice() {
  const { showNotice, latest, markRead, dismiss } = useNewVersion();
  const pathname = usePathname() ?? '';
  if (!showNotice || !latest || pathname.startsWith('/changelog')) return null;

  return (
    <div className="pointer-events-none fixed right-4 top-[72px] z-50 w-[min(400px,calc(100vw-2rem))] sm:right-8">
      <div
        role="status"
        aria-live="polite"
        className="pointer-events-auto flex items-start gap-3 rounded-[14px] border border-primary/50 bg-card p-3.5 pl-4 text-card-foreground shadow-[0_16px_40px_rgba(0,0,0,0.35)] motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-top-2"
      >
        <IconTile icon={moduleIcon('changelog')} />
        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <p className="text-sm font-semibold leading-snug text-foreground">Nova versão {latest}: veja o que mudou</p>
          <div className="flex flex-wrap gap-2">
            <ModalButton variant="primary" asChild className="h-8 px-3 text-[13px]">
              <Link href="/changelog" onClick={() => markRead(latest)}>
                Ver o que mudou
              </Link>
            </ModalButton>
            <ModalButton className="h-8 px-3 text-[13px]" onClick={dismiss}>
              Agora não
            </ModalButton>
          </div>
        </div>
        <button
          type="button"
          onClick={dismiss}
          aria-label="Dispensar aviso"
          className={cn('inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-muted-foreground hover:bg-accent hover:text-accent-foreground', FOCUS_RING)}
        >
          <X aria-hidden="true" className="h-4 w-4" strokeWidth={1.5} />
        </button>
      </div>
    </div>
  );
}
