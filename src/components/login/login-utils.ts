/** Regras puras do login: validação dos campos, força da senha e rotação dos módulos da vitrine. */

export type LoginMode = 'login' | 'register' | 'forgot';

export const LAST_EMAIL_KEY = 'agile-space:last-email';

export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const MIN_PASSWORD_LENGTH = 8;

export interface LoginFields {
  name: string;
  email: string;
  password: string;
  confirm: string;
}

export type FieldKey = keyof LoginFields;
export type FieldErrors = Partial<Record<FieldKey, string>>;

/**
 * Erros de cada campo no modo atual. No login o e-mail aceita também o nome de usuário, então só o cadastro e o
 * pedido de reset conferem o formato; a regra de 8 caracteres vale só para criar a conta.
 */
export function getFieldErrors(mode: LoginMode, values: LoginFields): FieldErrors {
  const email = values.email.trim();
  return {
    name: !values.name.trim() ? 'Informe seu nome.' : undefined,
    email: !email
      ? 'Informe seu e-mail.'
      : mode !== 'login' && !EMAIL_RE.test(email)
        ? 'E-mail inválido. Ex.: nome@empresa.com.br'
        : undefined,
    password: !values.password
      ? 'Informe a senha.'
      : mode === 'register' && values.password.length < MIN_PASSWORD_LENGTH
        ? 'Mínimo de 8 caracteres.'
        : undefined,
    confirm: values.confirm !== values.password ? 'As senhas não conferem.' : undefined,
  };
}

/** Campos que bloqueiam o envio em cada modo (os demais campos do estado não participam do formulário). */
export const REQUIRED_FIELDS: Record<LoginMode, FieldKey[]> = {
  login: ['email', 'password'],
  register: ['name', 'email', 'password', 'confirm'],
  forgot: ['email'],
};

export function hasBlockingError(mode: LoginMode, errors: FieldErrors): boolean {
  return REQUIRED_FIELDS[mode].some((f) => !!errors[f]);
}

export function passwordScore(pw: string): number {
  let n = 0;
  if (pw.length >= 8) n++;
  if (/[a-z]/.test(pw) && /[A-Z]/.test(pw)) n++;
  if (/\d/.test(pw)) n++;
  if (/[^A-Za-z0-9]/.test(pw) || pw.length >= 12) n++;
  return n;
}

export type StrengthTone = 'weak' | 'fair' | 'good';

const STRENGTH: { label: string; tone: StrengthTone }[] = [
  { label: 'Muito fraca', tone: 'weak' },
  { label: 'Fraca', tone: 'weak' },
  { label: 'Razoável', tone: 'fair' },
  { label: 'Boa', tone: 'good' },
  { label: 'Forte', tone: 'good' },
];

export function passwordStrength(pw: string): { score: number; label: string; tone: StrengthTone } {
  const score = passwordScore(pw);
  return { score, ...STRENGTH[score] };
}

/** Índice do próximo módulo da vitrine, em ciclo. */
export function nextIndex(current: number, total: number): number {
  return total <= 0 ? 0 : (current + 1) % total;
}

/** Mensagem de um erro capturado, ou o texto padrão quando não há mensagem (o servidor devolve a do limite de tentativas, 429). */
export function errorMessage(err: unknown, fallback: string): string {
  return err instanceof Error && err.message ? err.message : fallback;
}
