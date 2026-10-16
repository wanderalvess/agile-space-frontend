'use client';

import { ArrowRight, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { jiraProfileUrl, type JiraFormErrors } from '@/lib/onboarding';
import { cn } from '@/lib/utils';
import { BackButton, Caption, Spinner, WIDE_CTA } from './ui';

/** Passo a passo para gerar o token pessoal no Jira Data Center da empresa (não é o Jira Cloud). */
const TOKEN_STEPS = [
  'No Jira, abra o seu Perfil (menu da sua foto, no canto superior direito).',
  'Vá em Tokens de acesso pessoal e clique em Criar token.',
  'Dê o nome Portal Tech V&D, copie o token e cole aqui. A gente guarda pra você não precisar de novo.',
];

interface Props {
  domain: string;
  keys: string;
  token: string;
  errors: JiraFormErrors;
  busy: boolean;
  keyCount: number;
  onDomainChange: (v: string) => void;
  onKeysChange: (v: string) => void;
  onTokenChange: (v: string) => void;
  onSubmit: (e: React.FormEvent) => void;
  /** "Voltar" do passo (no /onboarding); ausente no diálogo do painel. */
  onBack?: () => void;
  /** Saída alternativa na lateral (ex.: "Criar uma squad sem o Jira"). */
  skipAction?: { label: string; onClick: () => void };
  skipHint?: string;
}

function FieldError({ id, message }: { id: string; message?: string }) {
  if (!message) return null;
  return (
    <span id={id} role="alert" className="text-xs font-medium text-red-700 dark:text-red-300">
      {message}
    </span>
  );
}

/** Credenciais do Jira: endereço, chaves das squads e token. Controlado por quem orquestra a importação. */
export function JiraCredentialsForm({
  domain,
  keys,
  token,
  errors,
  busy,
  keyCount,
  onDomainChange,
  onKeysChange,
  onTokenChange,
  onSubmit,
  onBack,
  skipAction,
  skipHint,
}: Props) {
  const profileUrl = jiraProfileUrl(domain);
  const invalid = (msg?: string) => (msg ? 'border-red-500/60 focus-visible:ring-red-500/40' : '');

  return (
    <div className="grid w-full grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_300px]">
      <form onSubmit={onSubmit} noValidate className="flex min-w-0 flex-col gap-3.5">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="jira-dominio">
            <Caption>Endereço do Jira</Caption>
          </Label>
          <Input
            id="jira-dominio"
            value={domain}
            onChange={(e) => onDomainChange(e.target.value)}
            placeholder="jiraproducao.totvs.com.br"
            autoComplete="off"
            autoCapitalize="none"
            spellCheck={false}
            inputMode="url"
            aria-invalid={!!errors.domain}
            aria-describedby={errors.domain ? 'jira-dominio-erro' : undefined}
            className={cn('h-11 rounded-[10px]', invalid(errors.domain))}
          />
          <FieldError id="jira-dominio-erro" message={errors.domain} />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="jira-chave">
            <Caption>Projetos no Jira</Caption>
          </Label>
          <Input
            id="jira-chave"
            name="jiraProjectKey"
            value={keys}
            onChange={(e) => onKeysChange(e.target.value)}
            placeholder="Ex: DDWMISSI, DDWFENIX, DDWATLAS"
            autoComplete="off"
            data-lpignore="true"
            aria-invalid={!!errors.keys}
            aria-describedby={errors.keys ? 'jira-chave-erro' : 'jira-chave-dica'}
            className={cn('h-11 rounded-[10px] font-code uppercase tracking-wider', invalid(errors.keys))}
          />
          <FieldError id="jira-chave-erro" message={errors.keys} />
          <span id="jira-chave-dica" className="text-xs leading-relaxed text-muted-foreground">
            Mais de uma squad? Cole todas as chaves, separadas por vírgula ou espaço. Repetidas contam uma vez.
          </span>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="jira-token">
            <Caption>Seu token do Jira</Caption>
          </Label>
          <Input
            id="jira-token"
            name="jiraPersonalAccessToken"
            type="password"
            value={token}
            onChange={(e) => onTokenChange(e.target.value)}
            autoComplete="new-password"
            data-lpignore="true"
            placeholder="Token de acesso pessoal do Jira"
            aria-invalid={!!errors.token}
            aria-describedby={errors.token ? 'jira-token-erro' : undefined}
            className={cn('h-11 rounded-[10px] font-code', invalid(errors.token))}
          />
          <FieldError id="jira-token-erro" message={errors.token} />
        </div>

        <Button type="submit" disabled={busy} className={WIDE_CTA}>
          {busy ? (
            <Spinner />
          ) : (
            <>
              {keyCount > 1 ? `Começar com ${keyCount} squads` : 'Ver o que vai ser importado'} <ArrowRight aria-hidden="true" className="h-4 w-4" strokeWidth={1.5} />
            </>
          )}
        </Button>
        <p className="text-xs leading-relaxed text-muted-foreground">Nada é gravado até você conferir a prévia. O token vai para a sua conta só depois que você confirmar.</p>

        {onBack && <BackButton onClick={onBack} disabled={busy} />}
      </form>

      <aside className="flex flex-col gap-3 self-start rounded-2xl border border-border bg-muted/40 p-[18px]" aria-label="Como gerar o token">
        <span className="text-sm font-bold">Não tem um token? Leva 30 segundos.</span>
        <ol className="flex flex-col gap-2.5">
          {TOKEN_STEPS.map((text, i) => (
            <li key={text} className="flex gap-2.5">
              <span aria-hidden="true" className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[11px] font-bold text-primary dark:bg-primary/15 [.theme-totvs:not(.dark)_&]:text-foreground">
                {i + 1}
              </span>
              <span className="text-[13px] leading-relaxed text-muted-foreground">{text}</span>
            </li>
          ))}
        </ol>
        {profileUrl && (
          <Button asChild variant="outline" className="h-10 gap-2 rounded-[10px] text-[13px] font-semibold">
            <a href={profileUrl} target="_blank" rel="noopener noreferrer">
              Abrir meu perfil no Jira <ExternalLink aria-hidden="true" className="h-3.5 w-3.5" strokeWidth={1.5} />
            </a>
          </Button>
        )}
        {skipAction && (
          <div className="mt-1 flex flex-col items-start gap-1.5 border-t border-border pt-3">
            {!!skipHint && <span className="text-xs leading-relaxed text-muted-foreground">{skipHint}</span>}
            <button
              type="button"
              onClick={skipAction.onClick}
              className="rounded-sm text-[13px] font-semibold text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring [.theme-totvs:not(.dark)_&]:text-foreground"
            >
              {skipAction.label}
            </button>
          </div>
        )}
      </aside>
    </div>
  );
}
