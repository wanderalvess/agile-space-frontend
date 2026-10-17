'use client';

import { DoorOpen, TriangleAlert, UserPlus } from 'lucide-react';
import { BrandWordmark } from '@/components/layout/BrandWordmark';
import { ThemeToggle } from '@/components/layout/ThemeToggle';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';
import { LoginBackdrop } from './LoginBackdrop';
import { ForgotForm, LoginForm, RegisterForm } from './AuthForms';
import { TINT_TEXT } from './login-fields';
import type { LoginMode } from './login-utils';
import type { LoginFlow } from './useLoginFlow';

const HEADING: Record<LoginMode, string> = {
  login: 'Bem-vindo de volta',
  register: 'Crie sua conta',
  forgot: 'Recuperar senha',
};

const SUBTITLE: Record<LoginMode, string> = {
  login: 'Insira suas credenciais corporativas para continuar.',
  register: 'Use seu e-mail corporativo para vincular seus projetos.',
  forgot: 'O pedido vai para aprovação de um Admin.',
};

const ERROR_TITLE: Record<LoginMode, string> = {
  login: 'Falha na autenticação',
  register: 'Erro no cadastro',
  forgot: 'Erro na solicitação',
};

const TAB_TRIGGER =
  'h-9 flex-1 rounded-[9px] border border-transparent px-3 text-sm font-medium text-muted-foreground shadow-none transition-colors ' +
  'data-[state=active]:border-border data-[state=active]:bg-card data-[state=active]:font-semibold data-[state=active]:text-foreground data-[state=active]:shadow-sm';

const TAB_CONTENT = 'mt-0 rounded-lg ring-offset-background';

/** Lado do formulário: marca (no celular), título, aviso de convite, abas, erro e o formulário do modo atual. */
export function LoginPanel({ flow, className }: { flow: LoginFlow; className?: string }) {
  const { mode, linkContext, authError } = flow;
  const ContextIcon = linkContext?.kind === 'invite' ? UserPlus : DoorOpen;

  return (
    <section
      className={cn(
        'relative flex flex-col justify-center overflow-hidden bg-background px-6 py-8 text-card-foreground sm:px-12 sm:py-12 lg:bg-card [@media(max-height:760px)]:sm:py-6',
        className,
      )}
    >
      {/* Celular e tablet: o mesmo fundo da vitrine (halo e estrelas) atrás do formulário. */}
      <LoginBackdrop className="lg:hidden" />

      <div className="absolute right-4 top-4 sm:right-5 sm:top-5">
        <ThemeToggle className="h-10 w-10 rounded-[11px]" />
      </div>

      <div className="relative mx-auto flex w-full max-w-[380px] flex-col gap-4 [@media(max-height:760px)]:gap-3">
        {/* No celular e no tablet a vitrine some; a marca fica aqui. */}
        <BrandWordmark className="lg:hidden" />

        <div className="space-y-1.5">
          <h1 className="text-[26px] font-bold leading-tight tracking-tight text-foreground sm:text-[28px]">{HEADING[mode]}</h1>
          {!(mode === 'forgot' && flow.forgotSent) && <p className="text-sm leading-normal text-muted-foreground">{SUBTITLE[mode]}</p>}
        </div>

        {linkContext && mode !== 'forgot' && (
          <div role="note" className="flex items-start gap-2.5 rounded-xl border border-primary/30 bg-primary/10 px-3 py-2.5 text-[13px]">
            <ContextIcon aria-hidden="true" strokeWidth={1.5} className={cn('mt-0.5 h-4 w-4 shrink-0', TINT_TEXT)} />
            <div className="min-w-0">
              <p className="font-semibold text-foreground">{linkContext.title}</p>
              <p className="text-muted-foreground [@media(max-height:700px)]:hidden">{linkContext.description}</p>
            </div>
          </div>
        )}

        <Tabs value={mode} onValueChange={(v) => flow.switchMode(v as LoginMode)} className="flex w-full flex-col gap-4 [@media(max-height:760px)]:gap-3">
          {mode !== 'forgot' && (
            <TabsList className="grid h-auto grid-cols-2 gap-1 rounded-xl border border-border bg-muted/50 p-1">
              <TabsTrigger value="login" disabled={flow.loading} className={TAB_TRIGGER}>
                Entrar
              </TabsTrigger>
              <TabsTrigger value="register" disabled={flow.loading} className={TAB_TRIGGER}>
                Cadastrar
              </TabsTrigger>
            </TabsList>
          )}

          {/* O erro fica no cartão até a pessoa editar um campo; a cada nova falha treme (menos com movimento reduzido). */}
          {authError && (
            <div
              key={flow.shakeKey}
              role="alert"
              className="flex items-start gap-2.5 rounded-xl border border-destructive/40 bg-destructive/10 px-3 py-2.5 text-[13px] text-destructive animate-shake dark:text-red-300"
            >
              <TriangleAlert aria-hidden="true" strokeWidth={1.5} className="mt-0.5 h-4 w-4 shrink-0" />
              <span>
                <strong className="block font-semibold">{ERROR_TITLE[mode]}</strong>
                {authError}
              </span>
            </div>
          )}

          <TabsContent value="login" className={TAB_CONTENT}>
            <LoginForm flow={flow} />
          </TabsContent>
          <TabsContent value="register" className={TAB_CONTENT}>
            <RegisterForm flow={flow} />
          </TabsContent>
          <TabsContent value="forgot" className={TAB_CONTENT}>
            <ForgotForm flow={flow} />
          </TabsContent>
        </Tabs>
      </div>
    </section>
  );
}
