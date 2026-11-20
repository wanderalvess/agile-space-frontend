/**
 * Mensagem de erro para o cliente a partir da resposta de falha do backend (que repassa o corpo do Jira).
 * Prioriza o `error` do próprio backend (ex.: token recusado), depois a primeira `errorMessages` do Jira
 * (ex.: JQL inválida) e só então o texto genérico da rota.
 */
export function upstreamErrorMessage(errorText: string, fallback: string): string {
  try {
    const body = JSON.parse(errorText);
    if (typeof body?.error === 'string' && body.error.trim()) return body.error.trim();
    const first = Array.isArray(body?.errorMessages) ? body.errorMessages.find((m: unknown) => typeof m === 'string' && m.trim()) : undefined;
    if (first) return first.trim();
  } catch {
    // corpo não é JSON (HTML de proxy/WAF, vazio): cai no texto genérico
  }
  return fallback;
}
