/** Avisa quando faltar menos que isso (dias) para a chave vencer. */
export const EXPIRY_WARNING_DAYS = 14;

export type ExpiryLevel = 'none' | 'ok' | 'soon' | 'expired';

export interface ExpiryInfo {
  level: ExpiryLevel;
  /** Dias inteiros que faltam (negativo = já venceu). Null quando a chave não expira. */
  daysLeft: number | null;
  label: string;
}

/** "Expira em 12 dias", "Expira hoje", "Expirou há 3 dias" ou "Sem expiração". */
export function describeExpiry(expiresAt?: string | null, now: Date = new Date()): ExpiryInfo {
  if (!expiresAt) return { level: 'none', daysLeft: null, label: 'Sem expiração' };
  const t = new Date(expiresAt).getTime();
  if (Number.isNaN(t)) return { level: 'none', daysLeft: null, label: 'Sem expiração' };
  const diffMs = t - now.getTime();
  const daysLeft = Math.ceil(diffMs / 86_400_000);
  if (diffMs <= 0) {
    const ago = Math.max(1, Math.floor(-diffMs / 86_400_000));
    return { level: 'expired', daysLeft: -ago, label: ago === 1 ? 'Expirou ontem' : `Expirou há ${ago} dias` };
  }
  const label = daysLeft <= 1 ? 'Expira hoje ou amanhã' : `Expira em ${daysLeft} dias`;
  return { level: daysLeft < EXPIRY_WARNING_DAYS ? 'soon' : 'ok', daysLeft, label };
}

/** Chaves ativas (não revogadas) vencidas ou a menos de 14 dias de vencer, para o aviso no topo da tela. */
export function keysNeedingAttention<T extends { revokedAt?: string | null; expiresAt?: string | null }>(
  keys: T[],
  now: Date = new Date(),
): T[] {
  return keys.filter((k) => {
    if (k.revokedAt) return false;
    const level = describeExpiry(k.expiresAt, now).level;
    return level === 'soon' || level === 'expired';
  });
}

export const EXPIRY_CHOICES: Array<{ value: string; label: string; adminOnly?: boolean }> = [
  { value: '90', label: '90 dias (padrão)' },
  { value: '30', label: '30 dias' },
  { value: '180', label: '180 dias' },
  { value: 'never', label: 'Sem expiração (não recomendado)', adminOnly: true },
];
