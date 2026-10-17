'use client';

import { useState } from 'react';
import { AtSign, CircleCheck, Clock, Eye, EyeOff, Loader2, Mail, Plug, RefreshCw, UserRound } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import { cn } from '@/lib/utils';
import { InitialsAvatar } from '@/components/common/InitialsAvatar';
import { bestJiraAvatar } from '@/lib/profile-photo';
import { FOCUS_RING, ModalButton, StatusChip } from '@/components/room-kit';
import { FIELD_INPUT, FIELD_LABEL, Field } from './fields';
import { DetailItem, SectionCard } from './ui';

/** Resposta do `/myself` do Jira que a tela usa. */
export interface JiraAccount {
  displayName?: string;
  name?: string;
  key?: string;
  accountId?: string;
  emailAddress?: string;
  timeZone?: string;
  avatarUrls?: Record<string, string | null | undefined>;
}

export interface JiraPanelProps {
  connected: boolean;
  domain: string;
  onDomain: (v: string) => void;
  token: string;
  onToken: (v: string) => void;
  /** Já há um token guardado e a pessoa não pediu para trocá-lo. */
  hasSavedToken: boolean;
  onReplaceToken: () => void;
  onRemoveToken: () => void;
  remember: boolean;
  onRemember: (v: boolean) => void;
  syncing: boolean;
  onSync: () => void;
  account: JiraAccount | null;
}

/** Seção "Jira": conexão (domínio, token pessoal, sincronização) e os dados da conta sincronizada. */
export function JiraPanel(p: JiraPanelProps) {
  const [showToken, setShowToken] = useState(false);
  const accountPhoto = bestJiraAvatar(p.account?.avatarUrls);
  const accountName = p.account?.displayName || p.account?.name || '';

  return (
    <div className="flex flex-col gap-4">
      <SectionCard
        icon={Plug}
        tone={p.connected ? 'success' : 'brand'}
        title="Conexão"
        titleId="identity-jira-conexao"
        aside={<StatusChip tone={p.connected ? 'success' : 'neutral'}>{p.connected ? 'Conectado' : 'Não conectado'}</StatusChip>}
      >
        {!p.connected && <p className="-mt-1 text-[13px] text-muted-foreground">Informe o domínio e o seu token pessoal para trazer nome e foto do Jira.</p>}

        <div className="grid gap-4 sm:grid-cols-2">
          <Field htmlFor="jiraInstanceDomain" label="Domínio">
            <input
              id="jiraInstanceDomain"
              name="jiraInstanceDomain"
              autoComplete="off"
              data-lpignore="true"
              value={p.domain}
              onChange={(e) => p.onDomain(e.target.value)}
              placeholder="empresa.atlassian.net"
              className={FIELD_INPUT}
            />
          </Field>

          <div className="flex min-w-0 flex-col gap-1.5">
            <label htmlFor={p.hasSavedToken ? undefined : 'jiraPersonalAccessToken'} id="identity-token-label" className={FIELD_LABEL}>
              Token pessoal (PAT)
            </label>
            {p.hasSavedToken ? (
              <div
                role="group"
                aria-labelledby="identity-token-label"
                className="flex min-h-10 items-center justify-between gap-2 rounded-[10px] border border-border bg-muted/40 pl-3 pr-1 max-sm:min-h-11"
              >
                <span className="flex items-center gap-1.5 whitespace-nowrap text-[13px] text-foreground">
                  <CircleCheck aria-hidden="true" className="h-4 w-4 text-emerald-600 dark:text-emerald-400" strokeWidth={1.5} />
                  Token salvo
                </span>
                <span className="flex items-center">
                  <ModalButton variant="ghost" onClick={p.onReplaceToken} className="h-9 px-2.5 text-[13px] max-sm:h-11">
                    Trocar
                  </ModalButton>
                  <ModalButton
                    variant="ghost"
                    onClick={p.onRemoveToken}
                    className="h-9 px-2.5 text-[13px] text-red-700 hover:text-red-700 dark:text-red-300 dark:hover:text-red-300 max-sm:h-11"
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
                  value={p.token}
                  onChange={(e) => p.onToken(e.target.value)}
                  placeholder="Cole o token"
                  className={cn(FIELD_INPUT, 'pr-11 font-code')}
                />
                <button
                  type="button"
                  aria-label={showToken ? 'Ocultar token' : 'Mostrar token'}
                  aria-pressed={showToken}
                  onClick={() => setShowToken((v) => !v)}
                  className={cn(
                    'absolute right-1 top-1/2 inline-flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-lg text-muted-foreground transition-colors duration-fast hover:bg-accent hover:text-accent-foreground max-sm:h-11 max-sm:w-11',
                    FOCUS_RING
                  )}
                >
                  {showToken ? <EyeOff className="h-4 w-4" strokeWidth={1.5} /> : <Eye className="h-4 w-4" strokeWidth={1.5} />}
                </button>
              </div>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-3 border-t border-border pt-4">
          <label htmlFor="identity-jira-remember" className="flex min-h-9 w-fit cursor-pointer items-center gap-2.5 text-[13px] text-foreground max-sm:min-h-11">
            <Checkbox id="identity-jira-remember" checked={p.remember} onCheckedChange={(v) => p.onRemember(!!v)} className="h-[18px] w-[18px] rounded-[5px]" />
            Lembrar credenciais
          </label>
          <ModalButton variant="primary" onClick={p.onSync} disabled={p.syncing} className="gap-2 max-sm:h-11 max-sm:w-full">
            {p.syncing ? (
              <Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" strokeWidth={1.5} aria-hidden="true" />
            ) : (
              <RefreshCw className="h-4 w-4" strokeWidth={1.5} aria-hidden="true" />
            )}
            {p.syncing ? 'Sincronizando' : 'Sincronizar com o Jira'}
          </ModalButton>
        </div>
      </SectionCard>

      {p.account ? (
        <SectionCard icon={UserRound} tone="success" title="Conta do Jira" titleId="identity-jira-conta" aside={<StatusChip tone="success">Sincronizada</StatusChip>}>
          <dl className="m-0 grid gap-3 sm:grid-cols-2">
            <DetailItem
              icon={UserRound}
              label="Nome"
              value={p.account.displayName}
              leading={<InitialsAvatar name={accountName} email={p.account.emailAddress} src={accountPhoto} className="h-9 w-9 border border-border text-xs" />}
            />
            <DetailItem icon={AtSign} label="Usuário" value={p.account.name || p.account.key || p.account.accountId} mono />
            <DetailItem icon={Mail} label="E-mail" value={p.account.emailAddress} />
            <DetailItem icon={Clock} label="Fuso horário" value={p.account.timeZone} />
          </dl>
        </SectionCard>
      ) : (
        p.connected && <p className="px-1 text-[13px] text-muted-foreground">Sincronize para ver os dados da sua conta do Jira.</p>
      )}
    </div>
  );
}
