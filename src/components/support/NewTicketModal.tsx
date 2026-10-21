'use client';

import { useId, useState } from 'react';
import { Loader2, Send } from 'lucide-react';
import type { SupportTicketType } from '@/app/support/api';
import { Modal, ModalButton } from '@/components/room-kit';
import { BRAND_TINT, FIELD, FOCUS_RING } from '@/components/room-kit/tokens';
import { cn } from '@/lib/utils';
import { MAX_MESSAGE, MAX_SUBJECT, SUPPORT_TYPES, canSendNew, formHint } from './support-utils';

interface NewTicketModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Devolve true quando o chamado foi criado (a janela fecha e o rascunho some); false mantém o texto. */
  onSubmit: (input: { type: SupportTicketType; subject: string; message: string }) => Promise<boolean>;
}

/** Formulário "Nova solicitação": tipo em 4 cartões, assunto e descrição com contagem. */
export function NewTicketModal({ open, onOpenChange, onSubmit }: NewTicketModalProps) {
  const [type, setType] = useState<SupportTicketType>('support');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const subjectId = useId();
  const messageId = useId();
  const current = SUPPORT_TYPES.find((t) => t.id === type) ?? SUPPORT_TYPES[0];
  const ok = canSendNew({ subject, message, sending });

  const submit = async () => {
    if (!ok) return;
    setSending(true);
    const created = await onSubmit({ type, subject: subject.trim(), message: message.trim() });
    setSending(false);
    if (created) {
      setSubject('');
      setMessage('');
      setType('support');
    }
  };

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      size="md"
      title="Nova solicitação"
      preventClose={sending}
      footerStart={<span className="text-xs text-muted-foreground">{formHint({ subject, message })}</span>}
      footer={
        <>
          <ModalButton onClick={() => onOpenChange(false)} disabled={sending}>
            Cancelar
          </ModalButton>
          <ModalButton variant="primary" className="gap-2" disabled={!ok} onClick={() => void submit()}>
            {sending ? (
              <Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" strokeWidth={1.5} aria-hidden="true" />
            ) : (
              <Send className="h-4 w-4" strokeWidth={1.5} aria-hidden="true" />
            )}
            {sending ? 'Enviando…' : 'Enviar solicitação'}
          </ModalButton>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <div role="radiogroup" aria-label="Tipo" className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
          {SUPPORT_TYPES.map((t) => {
            const on = t.id === type;
            return (
              <button
                key={t.id}
                type="button"
                role="radio"
                aria-checked={on}
                disabled={sending}
                onClick={() => setType(t.id)}
                className={cn(
                  'flex flex-col items-center gap-2 rounded-xl border px-2.5 py-3.5 text-foreground transition-colors duration-fast',
                  FOCUS_RING,
                  on ? cn('border-primary', BRAND_TINT) : 'border-border bg-muted/40 hover:bg-muted/70',
                )}
              >
                <t.icon className={cn('h-[22px] w-[22px]', on ? 'text-primary [.theme-totvs:not(.dark)_&]:text-foreground' : 'text-muted-foreground')} strokeWidth={1.5} aria-hidden="true" />
                <span className="text-sm font-semibold">{t.label}</span>
              </button>
            );
          })}
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor={subjectId} className="flex justify-between text-[13px] font-semibold text-muted-foreground">
            <span>Assunto</span>
            <span className="font-normal tabular-nums">
              {subject.length}/{MAX_SUBJECT}
            </span>
          </label>
          <input
            id={subjectId}
            value={subject}
            maxLength={MAX_SUBJECT}
            disabled={sending}
            onChange={(e) => setSubject(e.target.value)}
            placeholder="Resuma em uma frase"
            className={cn(FIELD, 'h-[42px]')}
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor={messageId} className="flex justify-between text-[13px] font-semibold text-muted-foreground">
            <span>Descrição</span>
            <span className="font-normal tabular-nums">
              {message.length}/{MAX_MESSAGE}
            </span>
          </label>
          <textarea
            id={messageId}
            value={message}
            maxLength={MAX_MESSAGE}
            rows={6}
            disabled={sending}
            onChange={(e) => setMessage(e.target.value)}
            placeholder={current.hint}
            className={cn(FIELD, 'resize-y py-2.5 leading-relaxed')}
          />
        </div>
      </div>
    </Modal>
  );
}
