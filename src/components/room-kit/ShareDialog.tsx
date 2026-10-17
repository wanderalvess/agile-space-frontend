'use client';

import * as React from 'react';
import { Check, Copy, Link2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { copyToClipboard } from '@/lib/copy-to-clipboard';
import { cn } from '@/lib/utils';
import { Modal, ModalButton } from './Modal';
import { RoomQr } from './RoomQr';
import { FIELD } from './tokens';

export interface ShareDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title?: string;
  /** Uma frase de apoio ("Review da Sprint 42"). */
  description?: React.ReactNode;
  /** Endereço da sala (sem parâmetros de uso interno). */
  url: string;
  /** Aviso curto sob o link (quem entra, com que permissão). */
  note?: React.ReactNode;
  /** Convite em texto, editável; sem ele só o link e o QR code aparecem. */
  inviteText?: string;
  onInviteTextChange?: (text: string) => void;
}

/**
 * Compartilhar a sala: link com Copiar, QR code para abrir no celular e convite em texto. A sala monta o
 * texto do convite (`inviteText`) com o que é dela; aqui só se copia e se ajusta.
 */
export function ShareDialog({ open, onOpenChange, title = 'Compartilhar', description, url, note, inviteText, onInviteTextChange }: ShareDialogProps) {
  const { toast } = useToast();
  const [copied, setCopied] = React.useState<'link' | 'invite' | null>(null);
  const timer = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  React.useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  const copy = async (text: string, kind: 'link' | 'invite') => {
    const ok = await copyToClipboard(text);
    if (!ok) {
      toast({ title: 'Não foi possível copiar', description: kind === 'link' ? text : 'Selecione o texto e copie à mão.', variant: 'destructive' });
      return;
    }
    setCopied(kind);
    toast({ title: kind === 'link' ? 'Link copiado!' : 'Convite copiado', description: kind === 'link' ? 'Compartilhe com sua squad para prepararem a sessão juntos.' : 'O texto do convite está na área de transferência.' });
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setCopied(null), 2500);
  };

  const copyLabel = (kind: 'link' | 'invite', idle: string) =>
    copied === kind ? <><Check className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" /> Copiado</> : <><Copy className="h-4 w-4" strokeWidth={1.5} aria-hidden="true" /> {idle}</>;

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      size="md"
      icon={Link2}
      title={title}
      description={description}
      footer={<ModalButton onClick={() => onOpenChange(false)}>Fechar</ModalButton>}
    >
      <div className="flex flex-col gap-5">
        <div className="flex flex-col gap-2">
          <label htmlFor="share-url" className="text-[13px] font-semibold text-muted-foreground">Link</label>
          <div className="flex gap-2">
            <input id="share-url" readOnly value={url} onFocus={(e) => e.currentTarget.select()} className={cn(FIELD, 'h-10 min-w-0 flex-1 font-mono text-xs')} />
            <ModalButton variant="primary" className="shrink-0 gap-2" onClick={() => copy(url, 'link')}>{copyLabel('link', 'Copiar')}</ModalButton>
          </div>
          {note && <p className="m-0 text-xs text-muted-foreground">{note}</p>}
        </div>

        <div className="flex items-center gap-4 rounded-xl border border-border bg-muted/40 p-4">
          <RoomQr url={url} size={112} />
          <div className="flex min-w-0 flex-col gap-1">
            <span className="text-sm font-bold">QR code</span>
            <span className="text-xs text-muted-foreground">Para abrir a sala no celular de quem está presente.</span>
          </div>
        </div>

        {inviteText !== undefined && (
          <div className="flex flex-col gap-2">
            <label htmlFor="share-invite" className="text-[13px] font-semibold text-muted-foreground">Convite em texto</label>
            <textarea
              id="share-invite"
              value={inviteText}
              onChange={(e) => onInviteTextChange?.(e.target.value)}
              readOnly={!onInviteTextChange}
              rows={5}
              className={cn(FIELD, 'resize-none py-2.5 text-[13px] leading-relaxed')}
            />
            <div className="flex justify-end">
              <ModalButton className="gap-2" onClick={() => copy(inviteText, 'invite')}>{copyLabel('invite', 'Copiar convite')}</ModalButton>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}
