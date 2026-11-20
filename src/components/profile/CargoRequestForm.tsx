'use client';

import * as React from 'react';
import Link from 'next/link';
import { CheckCircle2, Loader2 } from 'lucide-react';
import { supportApi } from '@/app/support/api';
import { ModalButton } from '@/components/room-kit';
import { CONTRIBUTOR_ROLES } from '@/lib/types';
import { FIELD_INPUT, Field, FieldError } from './fields';
import { TEXT_ACTION } from './ui';
import { MAX_CARGO, MAX_REASON, OTHER_CARGO, buildCargoRequestTicket, desiredCargoOf } from './cargo-request';

export interface CargoRequestFormProps {
  currentCargo?: string;
  email?: string;
  name?: string;
  squad?: string;
  /** Liderança vem do Jira/convite: o cargo desejado é opcional. */
  leadership: boolean;
  onClose: () => void;
  /** Fecha o modal antes de seguir para outra tela (acompanhar o chamado). */
  onNavigate: () => void;
}

type Phase = 'idle' | 'sending' | 'sent' | 'error';

/** Pedido de ajuste de cargo, dentro do modal: vira um chamado do Suporte (`/api/support/tickets`). */
export function CargoRequestForm({ currentCargo, email, name, squad, leadership, onClose, onNavigate }: CargoRequestFormProps) {
  const [desired, setDesired] = React.useState('');
  const [other, setOther] = React.useState('');
  const [reason, setReason] = React.useState('');
  const [phase, setPhase] = React.useState<Phase>('idle');
  const [fieldError, setFieldError] = React.useState<string | undefined>();

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const wanted = desiredCargoOf({ desired, other });
    if (!wanted && !leadership) {
      setFieldError(desired === OTHER_CARGO ? 'Escreva o cargo que você precisa.' : 'Escolha o cargo desejado.');
      return;
    }
    if (!wanted && leadership && !reason.trim()) {
      setFieldError('Escolha um cargo ou explique o ajuste no motivo.');
      return;
    }
    setFieldError(undefined);
    setPhase('sending');
    try {
      await supportApi.createTicket(buildCargoRequestTicket({ currentCargo, desired, other, reason, email, squad, name }));
      setPhase('sent');
    } catch {
      setPhase('error');
    }
  };

  if (phase === 'sent') {
    return (
      <div role="status" className="flex flex-col gap-3 rounded-xl border border-border bg-muted/30 p-4">
        <p className="flex items-center gap-2 text-sm font-semibold text-foreground">
          <CheckCircle2 aria-hidden="true" className="h-4 w-4 text-emerald-600 dark:text-emerald-400" strokeWidth={1.5} />
          Pedido enviado ao Suporte
        </p>
        <p className="text-[13px] text-muted-foreground">O Suporte responde no chamado. Você acompanha em Suporte, na lista dos seus chamados.</p>
        <div className="flex flex-wrap items-center gap-3">
          <Link href="/support" onClick={onNavigate} className={TEXT_ACTION}>
            Ver meus chamados
          </Link>
          <button type="button" onClick={onClose} className={TEXT_ACTION}>
            Fechar
          </button>
        </div>
      </div>
    );
  }

  const sending = phase === 'sending';
  return (
    <form onSubmit={submit} aria-label="Pedir ajuste do cargo" className="flex flex-col gap-3 rounded-xl border border-border bg-muted/30 p-4">
      <Field htmlFor="cargo-desired" label={leadership ? 'Cargo desejado (opcional)' : 'Cargo desejado'}>
        <select
          id="cargo-desired"
          value={desired}
          onChange={(e) => {
            setDesired(e.target.value);
            setFieldError(undefined);
          }}
          disabled={sending}
          aria-invalid={!!fieldError}
          aria-describedby={fieldError ? 'cargo-error' : undefined}
          className={FIELD_INPUT}
        >
          <option value="">{leadership ? 'Sem cargo específico' : 'Escolha um cargo'}</option>
          {CONTRIBUTOR_ROLES.map((r) => (
            <option key={r} value={r}>
              {r}
            </option>
          ))}
          <option value={OTHER_CARGO}>Outro</option>
        </select>
      </Field>

      {desired === OTHER_CARGO && (
        <Field htmlFor="cargo-other" label="Qual cargo?">
          <input
            id="cargo-other"
            value={other}
            maxLength={MAX_CARGO}
            onChange={(e) => {
              setOther(e.target.value);
              setFieldError(undefined);
            }}
            disabled={sending}
            autoComplete="off"
            className={FIELD_INPUT}
          />
        </Field>
      )}

      {leadership && (
        <p className="text-xs text-muted-foreground">Cargos de liderança vêm do Jira ou do convite. Se o seu está errado, explique no motivo.</p>
      )}
      <FieldError id="cargo-error">{fieldError}</FieldError>

      <Field htmlFor="cargo-reason" label="Motivo (opcional)">
        <textarea
          id="cargo-reason"
          value={reason}
          maxLength={MAX_REASON}
          rows={3}
          onChange={(e) => setReason(e.target.value)}
          disabled={sending}
          className={`${FIELD_INPUT} h-auto min-h-20 py-2 max-sm:h-auto`}
        />
        <span className="self-end text-xs text-muted-foreground">
          {reason.length}/{MAX_REASON}
        </span>
      </Field>

      {phase === 'error' && (
        <p role="alert" className="text-[13px] font-medium text-red-700 dark:text-red-300">
          Não foi possível enviar o pedido. Tente de novo.
        </p>
      )}

      <div className="flex flex-wrap justify-end gap-2">
        <ModalButton onClick={onClose} disabled={sending} className="max-sm:h-11">
          Cancelar
        </ModalButton>
        <ModalButton type="submit" variant="primary" disabled={sending} className="min-w-32 gap-2 max-sm:h-11">
          {sending && <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin motion-reduce:animate-none" strokeWidth={1.5} />}
          {phase === 'error' ? 'Tentar de novo' : 'Enviar pedido'}
        </ModalButton>
      </div>
    </form>
  );
}
