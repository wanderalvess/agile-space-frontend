/**
 * Erro de uma chamada das cerimônias (Brainstorming, Health Check, Plano de Ação). `status` deixa a tela
 * distinguir "não existe/sem acesso" (404/403) de "falhou agora" (rede, 5xx).
 */
export class CeremonyApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = 'CeremonyApiError';
    this.status = status;
  }
}

/**
 * Lança se a resposta não for 2xx. Mensagens de 4xx vêm do servidor (já em português, ex.: "Apenas o facilitador
 * pode alterar a sessão."); erros 5xx e de rede usam o texto padrão da chamada, sem vazar stack nem JSON cru.
 */
export async function ensureOk(res: Response, fallback: string): Promise<void> {
  if (res.ok) return;
  let message = fallback;
  if (res.status >= 400 && res.status < 500) {
    try {
      const text = await res.text();
      try {
        const json = JSON.parse(text);
        if (typeof json?.message === 'string' && json.message.trim()) message = json.message;
        // O filtro de rate limit (429) responde {"error":"Muitas requisições. Tente de novo em N s."} sem "message".
        else if (res.status === 429 && typeof json?.error === 'string' && json.error.trim()) message = json.error;
      } catch {
        if (text && text.length < 200 && !text.trim().startsWith('<')) message = text;
      }
    } catch { /* corpo ilegível: fica o texto padrão */ }
  }
  if (res.status === 429 && message === fallback) {
    const wait = Number(res.headers?.get?.('Retry-After'));
    if (Number.isFinite(wait) && wait > 0) message = `Tente de novo em ${Math.ceil(wait)} s.`;
  }
  throw new CeremonyApiError(message, res.status);
}

/** Texto para mostrar ao usuário num toast de erro (a mensagem do servidor, quando houver). */
export function errorMessage(error: unknown, fallback: string): string {
  if (error instanceof CeremonyApiError && error.message) return error.message;
  return fallback;
}
