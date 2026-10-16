'use client';

import { useEffect, useRef, useState } from 'react';
import { Check, CheckCircle2, Copy, KeyRound } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { copyToClipboard } from '@/lib/copy-to-clipboard';
import { StatusChip } from '@/components/room-kit/primitives';
import { Modal, ModalButton } from '@/components/room-kit/Modal';
import { FOCUS_RING, TONES } from '@/components/room-kit/tokens';
import { expiryLabel, type ResetLink } from './approvals-utils';

/**
 * Campo com o link de redefinição, "Copiar" e "Enviar por e-mail" (desligado: o backend ainda não envia e-mail).
 * `compact` = só o ícone no botão de copiar (diálogo).
 */
export function ResetLinkField({ url, compact = false }: { url: string; compact?: boolean }) {
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  const copy = async () => {
    const ok = await copyToClipboard(url);
    if (!ok) {
      toast.error('Não foi possível copiar', { description: 'Selecione o link e copie manualmente.' });
      return;
    }
    setCopied(true);
    toast.success('Copiado!', { description: 'Link copiado para a área de transferência.' });
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="flex flex-col gap-2.5">
      <div className="flex flex-wrap items-center gap-2.5">
        <code
          data-testid="reset-link"
          className="min-w-0 flex-1 basis-60 select-all break-all rounded-[10px] border border-border bg-background px-3 py-2.5 font-mono text-[13px] text-foreground"
        >
          {url}
        </code>
        <ModalButton variant="primary" onClick={copy} aria-label={compact ? 'Copiar link' : undefined} className={cn('gap-2', compact && 'w-11 px-0')}>
          {copied ? <Check className="h-4 w-4" strokeWidth={1.5} /> : <Copy className="h-4 w-4" strokeWidth={1.5} />}
          {!compact && (copied ? 'Copiado!' : 'Copiar Link')}
        </ModalButton>
      </div>
      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        <ModalButton disabled className="h-9 text-[13px]">
          Enviar por e-mail
        </ModalButton>
        em breve
      </div>
    </div>
  );
}

/** Aviso fixo depois de "Aprovar & Gerar Link": o link só aparece agora. */
export function ResetLinkBanner({ link, onClose }: { link: ResetLink; onClose: () => void }) {
  const expiry = expiryLabel(link.expiresAt);
  return (
    <div role="status" className="flex flex-col gap-3 rounded-[14px] border border-emerald-500/35 bg-emerald-500/[0.08] p-4">
      <div className="flex items-start justify-between gap-3">
        <span className={cn('flex items-start gap-2 text-sm font-bold', TONES.success.text)}>
          <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0" strokeWidth={1.5} aria-hidden="true" />
          <span className="break-all">Link de redefinição gerado para {link.email}</span>
        </span>
        <button type="button" onClick={onClose} className={cn('shrink-0 rounded-md px-1 py-0.5 text-xs font-bold', TONES.success.text, FOCUS_RING)}>
          Fechar
        </button>
      </div>
      <ResetLinkField url={link.url} />
      <div className="flex flex-wrap items-center gap-2">
        <StatusChip tone="warn" className="font-bold">Mostrado uma vez</StatusChip>
        <StatusChip tone="brand" className="font-bold">Uso único</StatusChip>
        <StatusChip tone="brand" className="font-bold">{expiry ? `Vale 2 h · ${expiry}` : 'Vale 2 h'}</StatusChip>
        <span className="text-xs text-muted-foreground">A senha atual continua valendo até o link ser usado. Se perder, gere outro.</span>
      </div>
    </div>
  );
}

/** Diálogo do botão de chave por usuário: o link aparece só uma vez. */
export function ResetLinkDialog({ link, onClose }: { link: ResetLink | null; onClose: () => void }) {
  const expiry = expiryLabel(link?.expiresAt);
  return (
    <Modal
      open={!!link}
      onOpenChange={(open) => { if (!open) onClose(); }}
      size="md"
      icon={KeyRound}
      title={<span className="break-all">Link de redefinição de {link?.email}</span>}
      description={`Copie agora e repasse à pessoa: é a única vez que o link aparece e ele vale uma vez só${expiry ? `, ${expiry}` : ''}.`}
    >
      {link && <ResetLinkField url={link.url} compact />}
    </Modal>
  );
}
