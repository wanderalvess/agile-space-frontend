'use client';

import { useState } from 'react';
import { AtSign, CircleCheck, Clock, Eye, EyeOff, Loader2, Mail, Plug, RefreshCw, UserRound } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import { cn } from '@/lib/utils';
import { InitialsAvatar } from '@/components/common/InitialsAvatar';
import { bestJiraAvatar } from '@/lib/profile-photo';
import { FOCUS_RING, ModalButton } from '@/components/room-kit';
import { FIELD_INPUT, FIELD_LABEL, Field } from './fields';
import { IdentityRow } from './IdentityRow';
import { DetailItem } from './ui';
import type { JiraConnection } from './useJiraConnection';

export interface RowJiraProps {
  open: boolean;
  onToggle: () => void;
  jira: JiraConnection;
  /** Nome da conta em uso; se o Jira trouxer outro, a pessoa pode adotá-lo. */
  currentName: string;
  onUseJiraName: (name: string) => void;
}

/** Linha "Jira": conectado ou não; aberta, traz domínio, token pessoal, sincronização e a conta sincronizada. */
export function RowJira({ open, onToggle, jira, currentName, onUseJiraName }: RowJiraProps) {
  const [showToken, setShowToken] = useState(false);
  const accountPhoto = bestJiraAvatar(jira.account?.avatarUrls);
  const accountName = jira.account?.displayName || jira.account?.name || '';
  const jiraName = jira.account?.displayName?.trim();

  return (
    <IdentityRow
      id="jira"
      icon={Plug}
      label="Jira"
      value={jira.connected ? 'Conectado' : 'Não conectado'}
      actionLabel={jira.connected ? 'Gerenciar' : 'Conectar'}
      open={open}
      onToggle={onToggle}
    >
      <p className="text-[13px] text-muted-foreground">
        {jira.connected ? 'O token fica neste navegador e na sua conta. Sincronize para atualizar nome e foto.' : 'Conecte com o seu domínio e um token pessoal para trazer a sua foto e o seu nome do Jira.'}
      </p>

      <Field htmlFor="jiraInstanceDomain" label="Domínio">
        <input
          id="jiraInstanceDomain"
          name="jiraInstanceDomain"
          autoComplete="off"
          data-lpignore="true"
          value={jira.domain}
          onChange={(e) => jira.setDomain(e.target.value)}
          placeholder="empresa.atlassian.net"
          className={FIELD_INPUT}
        />
      </Field>

      <div className="flex min-w-0 flex-col gap-1.5">
        <label htmlFor={jira.hasSavedToken ? undefined : 'jiraPersonalAccessToken'} id="identity-token-label" className={FIELD_LABEL}>
          Token pessoal (PAT)
        </label>
        {jira.hasSavedToken ? (
          <div role="group" aria-labelledby="identity-token-label" className="flex min-h-11 items-center justify-between gap-2 rounded-[10px] border border-border bg-muted/40 pl-3 pr-1">
            <span className="flex items-center gap-1.5 whitespace-nowrap text-[13px] text-foreground">
              <CircleCheck aria-hidden="true" className="h-4 w-4 text-emerald-700 dark:text-emerald-400" strokeWidth={1.5} />
              Token salvo
            </span>
            <span className="flex items-center">
              <ModalButton variant="ghost" onClick={jira.replaceToken} className="h-11 px-2.5 text-[13px]">
                Trocar
              </ModalButton>
              <ModalButton
                variant="ghost"
                onClick={() => void jira.removeToken()}
                className="h-11 px-2.5 text-[13px] text-red-700 hover:text-red-700 dark:text-red-300 dark:hover:text-red-300"
              >
                Remover
              </ModalButton>
            </span>
          </div>
        ) : (
          <div className="relative">
            <input
              id="jiraPersonalAccessToken"
              name="jiraPersonalAccessToken"
              type={showToken ? 'text' : 'password'}
              autoComplete="new-password"
              data-lpignore="true"
              value={jira.token}
              onChange={(e) => jira.setToken(e.target.value)}
              placeholder="Cole o token"
              className={cn(FIELD_INPUT, 'pr-12 font-code')}
            />
            <button
              type="button"
              aria-label={showToken ? 'Ocultar token' : 'Mostrar token'}
              aria-pressed={showToken}
              onClick={() => setShowToken((v) => !v)}
              className={cn(
                'absolute right-0.5 top-1/2 inline-flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-lg text-muted-foreground transition-colors duration-fast hover:bg-accent hover:text-accent-foreground',
                FOCUS_RING,
              )}
            >
              {showToken ? <EyeOff className="h-4 w-4" strokeWidth={1.5} /> : <Eye className="h-4 w-4" strokeWidth={1.5} />}
            </button>
          </div>
        )}
      </div>

      <label htmlFor="identity-jira-remember" className="flex min-h-11 w-fit cursor-pointer items-center gap-2.5 text-[13px] text-foreground">
        <Checkbox id="identity-jira-remember" checked={jira.remember} onCheckedChange={(v) => jira.setRemember(!!v)} className="h-[18px] w-[18px] rounded-[5px]" />
        Lembrar credenciais neste navegador
      </label>

      <div>
        <ModalButton variant="primary" onClick={() => void jira.sync()} disabled={jira.syncing} className="h-11 gap-2 max-sm:w-full">
          {jira.syncing ? (
            <Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" strokeWidth={1.5} aria-hidden="true" />
          ) : (
            <RefreshCw className="h-4 w-4" strokeWidth={1.5} aria-hidden="true" />
          )}
          {jira.syncing ? 'Sincronizando' : 'Sincronizar com o Jira'}
        </ModalButton>
      </div>

      {jira.account && (
        <div className="flex flex-col gap-3 border-t border-border pt-3">
          <p className="text-[13px] font-semibold text-foreground">Conta do Jira sincronizada</p>
          <dl className="m-0 grid gap-3 sm:grid-cols-2">
            <DetailItem
              icon={UserRound}
              label="Nome"
              value={jira.account.displayName}
              leading={<InitialsAvatar name={accountName} email={jira.account.emailAddress} src={accountPhoto} className="h-9 w-9 border border-border text-xs" />}
            />
            <DetailItem icon={AtSign} label="Usuário" value={jira.account.name || jira.account.key || jira.account.accountId} mono />
            <DetailItem icon={Mail} label="E-mail" value={jira.account.emailAddress} />
            <DetailItem icon={Clock} label="Fuso horário" value={jira.account.timeZone} />
          </dl>
          {jiraName && jiraName !== currentName.trim() && (
            <div>
              <ModalButton onClick={() => onUseJiraName(jiraName)} className="h-11 max-sm:w-full">
                Usar o nome do Jira
              </ModalButton>
            </div>
          )}
        </div>
      )}
    </IdentityRow>
  );
}
