'use client';

import * as React from 'react';
import * as AlertDialogPrimitive from '@radix-ui/react-alert-dialog';
import type { LucideIcon } from 'lucide-react';
import { AlertDialog, AlertDialogOverlay, AlertDialogPortal } from '@/components/ui/alert-dialog';
import { cn } from '@/lib/utils';
import { IconTile } from './primitives';
import { MODAL_OVERLAY, MODAL_SURFACE, ModalButton } from './Modal';
import { TONES, type Tone } from './tokens';

export interface ConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Aviso (alerta), destrutivo (perigo) ou neutro. Define a placa, o filete e o botão. */
  tone?: Tone;
  icon?: LucideIcon;
  title: React.ReactNode;
  description?: React.ReactNode;
  /** Conteúdo extra entre a descrição e o rodapé (números, campo de motivo...). */
  children?: React.ReactNode;
  cancelLabel?: string;
  confirmLabel: string;
  onConfirm: () => void;
  /** Mostra o estado de carregando e trava os botões. */
  loading?: boolean;
  loadingLabel?: string;
  /** Mantém aberto depois de confirmar (a tela fecha quando a operação termina). */
  keepOpenOnConfirm?: boolean;
  confirmDisabled?: boolean;
  /** 'sm' (420, padrão) ou 'md' (520) quando o corpo tem formulário. */
  size?: 'sm' | 'md';
}

/**
 * Confirmação do kit (P 420): aviso ou ação destrutiva, sem X — a pessoa escolhe.
 * Vermelho só em encerrar/excluir (`tone="danger"`). Embrulha o AlertDialog do
 * shadcn, então Esc/foco/retorno de foco seguem o padrão do Radix.
 */
export function ConfirmDialog({
  open,
  onOpenChange,
  tone = 'warn',
  icon,
  title,
  description,
  children,
  cancelLabel = 'Cancelar',
  confirmLabel,
  onConfirm,
  loading = false,
  loadingLabel,
  keepOpenOnConfirm = false,
  confirmDisabled = false,
  size = 'sm',
}: ConfirmDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={(next) => { if (loading && !next) return; onOpenChange(next); }}>
      <AlertDialogPortal>
        <AlertDialogOverlay className={MODAL_OVERLAY} />
        <AlertDialogPrimitive.Content className={cn(MODAL_SURFACE, size === 'md' ? 'sm:max-w-[520px]' : 'sm:max-w-[420px]')}>
          <div aria-hidden="true" className={cn('h-0.5 shrink-0', TONES[tone].hairline)} />
          <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-6 pb-2 pt-5">
            {icon && <IconTile icon={icon} tone={tone} />}
            <AlertDialogPrimitive.Title className="text-xl font-bold leading-tight tracking-tight text-foreground">
              {title}
            </AlertDialogPrimitive.Title>
            {description ? (
              <AlertDialogPrimitive.Description asChild>
                <div className="text-sm leading-relaxed text-muted-foreground">{description}</div>
              </AlertDialogPrimitive.Description>
            ) : (
              <AlertDialogPrimitive.Description className="sr-only">{typeof title === 'string' ? title : 'Confirmação'}</AlertDialogPrimitive.Description>
            )}
            {children}
          </div>
          <div className="flex shrink-0 items-center justify-end gap-2 px-6 pb-5 pt-4">
            <AlertDialogPrimitive.Cancel asChild>
              <ModalButton variant="secondary" disabled={loading}>{cancelLabel}</ModalButton>
            </AlertDialogPrimitive.Cancel>
            <ModalButton
              variant={tone === 'danger' ? 'danger' : 'primary'}
              disabled={loading || confirmDisabled}
              onClick={(e) => {
                e.preventDefault();
                onConfirm();
                if (!keepOpenOnConfirm) onOpenChange(false);
              }}
            >
              {loading ? (loadingLabel ?? 'Aguarde…') : confirmLabel}
            </ModalButton>
          </div>
        </AlertDialogPrimitive.Content>
      </AlertDialogPortal>
    </AlertDialog>
  );
}
