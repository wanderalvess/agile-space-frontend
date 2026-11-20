'use client';

import { CheckCircle2, Info, UserPlus } from 'lucide-react';
import { Modal, ModalButton, FIELD } from '@/components/room-kit';
import { cn } from '@/lib/utils';
import { DecimalInput } from './DecimalInput';
import { CANDIDATE_MIN_CHARS, type useAddMember } from './hooks/useAddMember';
import { RoleSelect } from './RoleSelect';
import { FIELD_40, ICON_STROKE } from './styles';

function Label({ text, children }: { text: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5 text-[13px] font-semibold text-foreground">
      {text}
      {children}
    </label>
  );
}

/**
 * Adicionar integrante (só quem gerencia o time). Digitando o e-mail (3+ caracteres) aparecem as contas que já
 * existem; escolher uma dá acesso à squad na hora. Sem conta, vira um pré-cadastro que vale quando a pessoa entrar
 * com aquele e-mail.
 */
export function AddMemberDialog({ form, isAdmin }: { form: ReturnType<typeof useAddMember>; isAdmin: boolean }) {
  const chosen = !!form.userId;
  const HintIcon = chosen ? CheckCircle2 : Info;
  return (
    <Modal
      open={form.open}
      onOpenChange={form.setOpen}
      size="md"
      icon={UserPlus}
      title="Adicionar integrante"
      preventClose={form.saving}
      footer={
        <>
          <ModalButton disabled={form.saving} onClick={form.close}>Cancelar</ModalButton>
          <ModalButton variant="primary" disabled={form.saving || !form.hoursValid} onClick={form.submit}>
            <UserPlus className="h-4 w-4" strokeWidth={ICON_STROKE} aria-hidden="true" />
            {form.saving ? 'Adicionando…' : 'Adicionar'}
          </ModalButton>
        </>
      }
    >
      <div className="flex flex-col gap-3.5">
        <Label text="Nome">
          <input value={form.name} onChange={(e) => form.setName(e.target.value)} disabled={chosen} placeholder="Ex.: Maria Silva" className={FIELD_40} />
        </Label>
        <div className="flex flex-col gap-1.5">
          <Label text="E-mail (opcional)">
            <input
              type="email"
              value={form.email}
              onChange={(e) => form.setEmail(e.target.value)}
              placeholder="maria@empresa.com"
              autoComplete="off"
              className={FIELD_40}
            />
          </Label>
          {form.candidates.length > 0 && (
            <ul aria-label="Contas encontradas" className="overflow-hidden rounded-xl border border-border">
              {form.candidates.map((c) => (
                <li key={c.userId} className="border-t border-border first:border-t-0">
                  <button
                    type="button"
                    onClick={() => form.pick(c)}
                    className="flex w-full items-baseline gap-2.5 px-3 py-2 text-left text-[13px] transition-colors duration-fast hover:bg-accent focus-visible:bg-accent focus-visible:outline-none"
                  >
                    <span className="font-bold text-foreground">{c.name}</span>
                    <span className="truncate text-muted-foreground">{c.email}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
          <span className={cn('flex items-start gap-2 text-xs', chosen ? 'text-emerald-700 dark:text-emerald-300' : 'text-muted-foreground')}>
            <HintIcon className="mt-px h-3.5 w-3.5 shrink-0" strokeWidth={ICON_STROKE} aria-hidden="true" />
            {chosen
              ? 'Conta existente selecionada: a pessoa já entra com acesso à squad.'
              : `Digite ${CANDIDATE_MIN_CHARS} ou mais caracteres do e-mail para achar quem já tem conta. Sem conta, vira um pré-cadastro que vale quando a pessoa entrar com esse e-mail.`}
          </span>
        </div>
        <div className="grid grid-cols-[minmax(0,1fr)_130px] gap-3">
          <Label text="Cargo">
            <RoleSelect aria-label="Cargo" value={form.role} onChange={form.setRole} isAdmin={isAdmin} editable className="h-10 text-sm" />
          </Label>
          <Label text="Horas/dia">
            <DecimalInput
              aria-label="Horas por dia"
              value={form.hoursText}
              onValueChange={form.setHoursText}
              invalid={!form.hoursValid}
              className={cn(FIELD, 'h-10 tabular-nums')}
            />
          </Label>
        </div>
      </div>
    </Modal>
  );
}
