/**
 * Convite "pendente" do navegador: quem abre `/invite/{token}` sem conta guarda o token aqui. Se o `returnUrl` do login
 * se perder (outra aba, cadastro por outro caminho), o AuthGuard ainda leva a pessoa de volta ao convite. Expira,
 * e é apagado ao aceitar ou quando o link se mostra inválido, para não puxar a pessoa a um convite velho.
 */
const KEY = 'agileSpace_pendingInvite';
export const PENDING_INVITE_TTL_MS = 60 * 60 * 1000;

const TOKEN_FORMAT = /^[A-Za-z0-9_-]{8,128}$/;

export function savePendingInvite(token: string): void {
  if (!TOKEN_FORMAT.test(token)) return;
  try {
    localStorage.setItem(KEY, JSON.stringify({ token, at: Date.now() }));
  } catch {
    /* storage bloqueado: o returnUrl continua valendo */
  }
}

export function clearPendingInvite(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* ignora */
  }
}

/** Token guardado e ainda dentro do prazo, ou null. */
export function readPendingInvite(now: number = Date.now()): string | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { token?: unknown; at?: unknown };
    if (typeof parsed.token !== 'string' || typeof parsed.at !== 'number' || !TOKEN_FORMAT.test(parsed.token)) {
      localStorage.removeItem(KEY);
      return null;
    }
    if (now - parsed.at > PENDING_INVITE_TTL_MS) {
      localStorage.removeItem(KEY);
      return null;
    }
    return parsed.token;
  } catch {
    return null;
  }
}
