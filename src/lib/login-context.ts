/**
 * Por que a pessoa caiu no login: quem chega por um link (convite, sala) precisa saber que, depois de entrar ou criar
 * a conta, volta para ele. Lido do returnUrl que o AuthGuard põe na URL.
 */
export type LoginContext = { kind: 'invite' | 'room'; title: string; description: string } | null;

const ROOM_PREFIXES = ['/room/', '/retro/', '/brainstorming/'];

export function loginContextFrom(returnUrl: string | null | undefined): LoginContext {
  if (!returnUrl || !returnUrl.startsWith('/') || returnUrl.startsWith('//')) return null;
  const path = returnUrl.split(/[?#]/)[0];
  if (path.startsWith('/invite/')) {
    return {
      kind: 'invite',
      title: 'Você recebeu um convite para uma squad',
      description: 'Entre ou crie a sua conta; em seguida o convite abre para você aceitar.',
    };
  }
  if (ROOM_PREFIXES.some((p) => path.startsWith(p))) {
    return {
      kind: 'room',
      title: 'Você foi chamado para uma sala',
      description: 'Entre ou crie a sua conta; em seguida a sala abre.',
    };
  }
  return null;
}

/** Só leitura do link atual, para o texto do card; o redirecionamento continua só no AuthGuard. */
export function loginContextFromLocation(): LoginContext {
  if (typeof window === 'undefined') return null;
  return loginContextFrom(new URLSearchParams(window.location.search).get('returnUrl'));
}

/** Texto do aviso depois do cadastro: só fala de time quando o cadastro realmente vinculou um. */
export function signUpToastDescription(activeProjectName: string | null | undefined, context: LoginContext): string {
  if (context?.kind === 'invite') return 'Agora é só aceitar o convite.';
  if (context?.kind === 'room') return 'Abrindo a sala…';
  if (activeProjectName) return `Você já está no time ${activeProjectName}.`;
  return 'Agora conecte você ao seu time.';
}
