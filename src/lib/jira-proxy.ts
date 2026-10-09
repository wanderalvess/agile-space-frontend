/**
 * Regras puras do proxy `/jira/*` (usado pelo iframe do JiraDash): quais caminhos do Jira podem passar,
 * como identificar o cliente para o limite de requisições e quando um erro TLS autoriza a segunda tentativa.
 */

export const ALLOWED_JIRA_PATHS: RegExp[] = [
  /^\/rest\/api\/2\/field(?:\?|$)/,
  /^\/rest\/api\/2\/search(?:\?|$)/,
  /^\/rest\/api\/2\/issue\/[A-Za-z0-9_]+-\d+\/worklog(?:\?|$)/i,
  /^\/rest\/agile\/1\.0\/sprint\/\d+(?:\?|$)/,
  /^\/rest\/api\/2\/user\/search(?:\?|$)/,
];

export function isAllowedJiraPath(pathWithQuery: string): boolean {
  return ALLOWED_JIRA_PATHS.some((re) => re.test(pathWithQuery));
}

/** Códigos do Node que indicam certificado não confiável (cadeia corporativa, autoassinado, expirado). */
const TLS_TRUST_ERRORS = new Set([
  'UNABLE_TO_VERIFY_LEAF_SIGNATURE',
  'UNABLE_TO_GET_ISSUER_CERT_LOCALLY',
  'SELF_SIGNED_CERT_IN_CHAIN',
  'DEPTH_ZERO_SELF_SIGNED_CERT',
  'CERT_HAS_EXPIRED',
  'ERR_TLS_CERT_ALTNAME_INVALID',
]);

export function isTlsTrustError(err: unknown): boolean {
  const code = (err as { code?: string } | null)?.code;
  return typeof code === 'string' && TLS_TRUST_ERRORS.has(code);
}

/** IP do cliente atrás do Caddy (primeiro item de x-forwarded-for). */
export function clientKey(headers: { get(name: string): string | null }): string {
  const fwd = headers.get('x-forwarded-for');
  const first = fwd ? fwd.split(',')[0].trim() : '';
  return first || headers.get('x-real-ip') || 'local-client';
}

/** `JIRA_TLS_INSECURE=0` exige certificado válido (sem segunda tentativa). Qualquer outro valor: estrito primeiro. */
export function allowTlsFallback(envValue: string | undefined): boolean {
  return envValue !== '0';
}
