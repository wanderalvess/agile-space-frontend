/**
 * Normaliza o endereço digitado num atalho: completa com https:// quando falta o esquema e só aceita
 * http/https com host. Devolve null para qualquer outra coisa (javascript:, data:, ftp:, texto solto).
 */
export function normalizeHttpUrl(raw: string | null | undefined): string | null {
  const text = (raw ?? '').trim();
  if (!text) return null;
  // Já tem esquema? Só http(s) passa. "host:porta/..." não conta como esquema.
  const hasScheme = /^[a-z][a-z0-9+.-]*:\/\//i.test(text) || /^(javascript|data|vbscript|file|mailto):/i.test(text);
  const candidate = hasScheme ? text : `https://${text}`;
  try {
    const url = new URL(candidate);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
    const knownHost = url.hostname.includes('.') || url.hostname === 'localhost';
    if (!knownHost) return null;
    return candidate;
  } catch {
    return null;
  }
}

/** Para renderizar href de dado vindo do servidor: só devolve o link se for http(s) ou caminho interno. */
export function safeHref(raw: string | null | undefined): string | undefined {
  const text = (raw ?? '').trim();
  if (!text) return undefined;
  if (text.startsWith('/') && !text.startsWith('//') && !text.includes('\\')) return text;
  return normalizeHttpUrl(text) === text ? text : undefined;
}
