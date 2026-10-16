'use client';

import { useState } from 'react';
import { Check, Send } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { InitialsAvatar } from '@/components/common/InitialsAvatar';
import { useToast } from '@/hooks/use-toast';
import { createLinkRequest, isLinkRequestUnavailable, type CreatedLinkRequest } from '@/lib/link-requests-api';
import { TONES } from '@/components/room-kit/tokens';
import { cn } from '@/lib/utils';
import { BackButton, Caption, InlineNotice, Spinner, StepCard, StepHeading, WIDE_CTA } from './ui';

export interface LinkRequestTarget {
  projectKey: string;
  /** Linha da lista sobre a qual é o pedido; ausente quando a pessoa nem aparece na lista. */
  member?: { memberId: string; displayName: string; roleName: string; emailHint?: string; avatarUrl?: string };
}

interface Props {
  target: LinkRequestTarget;
  /** E-mail do login, sugerido no campo. */
  defaultEmail: string;
  onBack: () => void;
  /** Depois de enviado: avisa o fluxo para atualizar "Meus pedidos". */
  onSent: (created: CreatedLinkRequest) => void;
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Pedir vínculo: a pessoa não entra pelos caminhos normais (liderança com outro e-mail, linha que o servidor
 * não reconhece como sua). Um admin confere o e-mail do Jira e aprova. O pedido fica em "Meus pedidos".
 */
export function RequestLinkStep({ target, defaultEmail, onBack, onSent }: Props) {
  const { toast } = useToast();
  const [email, setEmail] = useState(defaultEmail);
  const [message, setMessage] = useState('');
  const [emailError, setEmailError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [unavailable, setUnavailable] = useState(false);
  const { member, projectKey } = target;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!EMAIL_PATTERN.test(email.trim())) {
      setEmailError(email.trim() ? 'Confira o e-mail' : 'Informe o e-mail que você usa no Jira');
      return;
    }
    setEmailError(null);
    setSending(true);
    try {
      const created = await createLinkRequest({ projectKey, memberId: member?.memberId, emailInJira: email, message });
      setSent(true);
      onSent(created);
    } catch (err: any) {
      if (isLinkRequestUnavailable(err)) {
        setUnavailable(true);
        toast({ title: 'Pedido de vínculo ainda não está disponível' });
      } else {
        toast({ title: 'Não foi possível enviar o pedido', description: err?.message, variant: 'destructive' });
      }
    } finally {
      setSending(false);
    }
  };

  if (sent) {
    return (
      <StepCard>
        <div className="flex flex-col items-start gap-2.5">
          <span aria-hidden="true" className={cn('flex h-[52px] w-[52px] items-center justify-center rounded-2xl', TONES.success.tile)}>
            <Check className="h-[26px] w-[26px]" strokeWidth={1.5} />
          </span>
          <StepHeading title="Pedido enviado" subtitle={`Um admin vai confirmar o seu vínculo com a ${projectKey}. Você acompanha o andamento em “Meus pedidos”.`} />
        </div>
        <BackButton onClick={onBack}>Voltar</BackButton>
      </StepCard>
    );
  }

  return (
    <StepCard>
      <StepHeading
        title={`Pedir vínculo à ${projectKey}`}
        subtitle={
          member
            ? `${member.displayName} aparece como ${member.roleName}. Um admin confirma que é você.`
            : 'Um admin confirma que você faz parte da squad e libera a entrada.'
        }
      />

      {member && (
        <div className="flex items-center gap-3.5 rounded-2xl border border-primary/25 bg-primary/5 p-4">
          <InitialsAvatar name={member.displayName} src={member.avatarUrl} className="h-12 w-12 text-base" />
          <span className="flex min-w-0 flex-col">
            <span className="truncate text-base font-bold">{member.displayName}</span>
            <span className="truncate text-[13px] text-muted-foreground">
              {member.roleName}
              {member.emailHint ? ` · ${member.emailHint}` : ''}
            </span>
          </span>
        </div>
      )}

      <form onSubmit={submit} noValidate className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="vinculo-email">
            <Caption>Seu e-mail no Jira</Caption>
          </Label>
          <Input
            id="vinculo-email"
            type="email"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              if (emailError) setEmailError(null);
            }}
            autoComplete="email"
            aria-invalid={!!emailError}
            aria-describedby={emailError ? 'vinculo-email-erro' : undefined}
            className={cn('h-11 rounded-[10px]', emailError && 'border-red-500/60')}
          />
          {emailError && (
            <span id="vinculo-email-erro" role="alert" className="text-xs font-medium text-red-700 dark:text-red-300">
              {emailError}
            </span>
          )}
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="vinculo-msg">
            <Caption>
              Mensagem ao admin <span className="font-normal normal-case tracking-normal">(opcional)</span>
            </Caption>
          </Label>
          <Textarea id="vinculo-msg" rows={3} value={message} onChange={(e) => setMessage(e.target.value)} maxLength={500} className="resize-none rounded-[10px] text-sm" />
        </div>

        {unavailable && (
          <InlineNotice role="status" tone="warn">
            Pedido de vínculo ainda não está disponível. Por enquanto, use um link de convite.
          </InlineNotice>
        )}

        <div className="flex items-center justify-between gap-3">
          <BackButton onClick={onBack} disabled={sending} />
          <Button type="submit" disabled={sending} className={cn(WIDE_CTA, 'w-auto px-6')}>
            {sending ? (
              <Spinner />
            ) : (
              <>
                Enviar pedido <Send aria-hidden="true" className="h-4 w-4" strokeWidth={1.5} />
              </>
            )}
          </Button>
        </div>
      </form>
    </StepCard>
  );
}
