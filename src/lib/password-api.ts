import { authFetch, setAuthToken, type AuthResponse } from '@/lib/auth-client';

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL || process.env.NEXT_PUBLIC_SPRING_API_URL || 'http://localhost:8002/api';

export const MIN_PASSWORD_LENGTH = 8;
export const MAX_PASSWORD_LENGTH = 128;

/** Mensagem legível de uma resposta de erro do backend (campo `message` ou `error`). */
export async function passwordErrorMessage(res: Response, fallback: string): Promise<string> {
  try {
    const body = await res.json();
    const text = body?.message || body?.error;
    return typeof text === 'string' && text.trim() ? text : fallback;
  } catch {
    return fallback;
  }
}

/** Regras do formulário (o servidor confere de novo). Devolve a mensagem do primeiro problema, ou null. */
export function validateNewPassword(password: string, confirmation: string): string | null {
  if (password.length < MIN_PASSWORD_LENGTH) return `A senha precisa ter pelo menos ${MIN_PASSWORD_LENGTH} caracteres.`;
  if (password.length > MAX_PASSWORD_LENGTH) return `A senha pode ter no máximo ${MAX_PASSWORD_LENGTH} caracteres.`;
  if (password !== confirmation) return 'A confirmação não é igual à nova senha.';
  return null;
}

/** Link de redefinição que o administrador repassa à pessoa. O token vai na query e nunca é guardado. */
export function buildResetLink(token: string, origin: string): string {
  return `${origin.replace(/\/+$/, '')}/reset-password?token=${encodeURIComponent(token)}`;
}

/** Troca a própria senha (logado). O servidor devolve um token novo, que mantém esta sessão e derruba as outras. */
export async function changeOwnPassword(currentPassword: string, newPassword: string): Promise<void> {
  const res = await authFetch(`${API_BASE_URL}/auth/change-password`, {
    method: 'POST',
    body: JSON.stringify({ currentPassword, newPassword }),
  });
  if (!res.ok) throw new Error(await passwordErrorMessage(res, 'Não foi possível trocar a senha.'));
  const data: AuthResponse = await res.json();
  if (data?.token) setAuthToken(data.token);
}

/** Conclui a redefinição com o token do link (rota pública: a pessoa não tem sessão). */
export async function resetPasswordWithToken(token: string, newPassword: string): Promise<void> {
  const res = await fetch(`${API_BASE_URL}/auth/reset-password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token, newPassword }),
  });
  if (!res.ok) throw new Error(await passwordErrorMessage(res, 'Link de redefinição inválido ou expirado.'));
}
