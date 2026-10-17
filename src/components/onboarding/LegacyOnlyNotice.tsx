'use client';

import { Link2 } from 'lucide-react';
import { IconTile, ModalButton } from '@/components/room-kit';
import { cn } from '@/lib/utils';

export const LEGACY_ONLY_MESSAGE = 'Seu acesso ainda não tem vínculo: peça à liderança da squad.';

export interface LegacyOnlyNoticeProps {
  /** Texto do botão; sem `onAction` o aviso aparece sem botão (as saídas já estão na tela). */
  actionLabel?: string;
  onAction?: () => void;
  /** Dispensa o aviso (só no formato de faixa). */
  onDismiss?: () => void;
  className?: string;
}

/**
 * Aviso de conta sem vínculo (`legacyOnly`): a pessoa ainda entra pelo acesso antigo, mas nenhuma liderança
 * a vinculou a uma squad. Curto e acionável; o botão leva ao caminho que já existe (pedir vínculo / convite).
 */
export function LegacyOnlyNotice({ actionLabel = 'Pedir vínculo', onAction, onDismiss, className }: LegacyOnlyNoticeProps) {
  return (
    <div
      role="status"
      className={cn('flex w-full flex-wrap items-center gap-x-3 gap-y-2 rounded-2xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-foreground', className)}
    >
      <IconTile icon={Link2} tone="warn" size="sm" />
      <p className="min-w-0 flex-1 basis-60 text-[13px] font-medium leading-snug">{LEGACY_ONLY_MESSAGE}</p>
      <div className="flex items-center gap-2 max-sm:w-full">
        {onAction && (
          <ModalButton variant="primary" onClick={onAction} className="h-9 text-[13px] max-sm:h-11 max-sm:flex-1">
            {actionLabel}
          </ModalButton>
        )}
        {onDismiss && (
          <ModalButton variant="ghost" onClick={onDismiss} className="h-9 text-[13px] max-sm:h-11" aria-label="Dispensar aviso">
            Agora não
          </ModalButton>
        )}
      </div>
    </div>
  );
}
