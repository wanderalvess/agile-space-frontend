'use client';

import * as React from 'react';
import { Link as LinkIcon } from 'lucide-react';
import { FIELD, Modal, ModalButton } from '@/components/room-kit';
import { cn } from '@/lib/utils';
import { normalizeLinkHref } from '@/lib/knowledge-editor';

export interface LinkDialogValue {
  href: string;
  text: string;
}

export interface LinkDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Endereço e texto de partida (link já existente ou texto selecionado). */
  initial: LinkDialogValue;
  /** O cursor está dentro de um link: mostra "Remover link". */
  hasLink: boolean;
  onApply: (value: LinkDialogValue) => void;
  onRemove: () => void;
}

/** Janela "Inserir link": endereço e texto; aceita só http(s) e mailto. Substitui o window.prompt. */
export function LinkDialog(props: LinkDialogProps) {
  // Montada só enquanto aberta: o estado dos campos nasce a cada abertura, sem efeito para limpar.
  return props.open ? <LinkDialogBody {...props} /> : null;
}

function LinkDialogBody({ open, onOpenChange, initial, hasLink, onApply, onRemove }: LinkDialogProps) {
  const formId = React.useId();
  const hrefId = React.useId();
  const textId = React.useId();
  const errorId = React.useId();
  const [href, setHref] = React.useState(initial.href);
  const [text, setText] = React.useState(initial.text);
  const [error, setError] = React.useState('');
  const hrefRef = React.useRef<HTMLInputElement>(null);

  // O Modal manda o foco para a própria janela ao abrir; depois disso vai para o endereço.
  React.useEffect(() => {
    const frame = requestAnimationFrame(() => hrefRef.current?.focus());
    return () => cancelAnimationFrame(frame);
  }, []);

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    const normalized = normalizeLinkHref(href);
    if (!normalized) {
      setError('Use um endereço que comece com http://, https:// ou mailto:.');
      return;
    }
    onApply({ href: normalized, text: text.trim() });
    onOpenChange(false);
  };

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      size="sm"
      icon={LinkIcon}
      title="Inserir link"
      footerStart={
        hasLink ? (
          <ModalButton
            variant="ghost"
            onClick={() => {
              onRemove();
              onOpenChange(false);
            }}
            className="text-red-700 hover:text-red-700 dark:text-red-300 dark:hover:text-red-300"
          >
            Remover link
          </ModalButton>
        ) : undefined
      }
      footer={
        <>
          <ModalButton variant="secondary" onClick={() => onOpenChange(false)}>
            Cancelar
          </ModalButton>
          <ModalButton variant="primary" type="submit" form={formId}>
            Aplicar
          </ModalButton>
        </>
      }
    >
      <form id={formId} onSubmit={submit} className="flex flex-col gap-4" noValidate>
        <div className="flex flex-col gap-1.5">
          <label htmlFor={hrefId} className="text-xs font-semibold text-muted-foreground">
            Endereço
          </label>
          <input
            id={hrefId}
            ref={hrefRef}
            value={href}
            onChange={(e) => {
              setHref(e.target.value);
              if (error) setError('');
            }}
            placeholder="https://tdn.totvs.com/"
            autoComplete="off"
            inputMode="url"
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? errorId : undefined}
            className={cn(FIELD, 'h-10')}
          />
          {error && (
            <p id={errorId} role="alert" className="text-xs font-medium text-red-700 dark:text-red-300">
              {error}
            </p>
          )}
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor={textId} className="text-xs font-semibold text-muted-foreground">
            Texto do link
          </label>
          <input
            id={textId}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Se ficar em branco, mostra o endereço"
            autoComplete="off"
            className={cn(FIELD, 'h-10')}
          />
        </div>
      </form>
    </Modal>
  );
}
