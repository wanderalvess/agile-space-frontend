/**
 * joltService.ts
 * Execução de transformações Jolt no servidor do portal (biblioteca oficial Bazaarvoice, em Java).
 * A rota exige login: `authFetch` manda o token da sessão.
 */

import { authFetch } from '@/lib/auth-client';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8002/api';

export interface JoltBackendTransformResult {
  success: boolean;
  output: unknown;
  executionTimeMs: number;
  error?: string;
}

/**
 * Lê a mensagem de erro de uma resposta HTTP do backend. O Spring devolve JSON
 * ({message}, {error}); isso não deve aparecer cru na tela.
 */
export async function readApiError(res: Response, fallback: string): Promise<string> {
  const text = await res.text().catch(() => '');
  let msg = '';
  if (text) {
    try {
      const json = JSON.parse(text);
      msg = (typeof json?.message === 'string' && json.message) || (typeof json?.error === 'string' && json.error) || '';
    } catch {
      msg = text.length <= 300 && !text.trim().startsWith('<') ? text : '';
    }
  }
  return msg || `${fallback} (${res.status})`;
}

/**
 * Executa a transformação no servidor. `signal` permite abandonar a chamada (ex.: a pessoa trocou de layout
 * enquanto executava): a resposta atrasada não deve aparecer na tela.
 */
export async function transformJoltBackend(
  input: unknown,
  spec: unknown,
  signal?: AbortSignal,
): Promise<JoltBackendTransformResult> {
  const res = await authFetch(`${API_BASE_URL}/jolt/transform`, {
    method: 'POST',
    body: JSON.stringify({ input, spec }),
    signal,
  });

  if (!res.ok) {
    if (res.status === 401) throw new Error('Sua sessão terminou. Entre de novo para executar.');
    throw new Error(await readApiError(res, 'Não foi possível executar a transformação'));
  }

  return res.json();
}
