import { NextRequest } from 'next/server';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || process.env.NEXT_PUBLIC_SPRING_API_URL || 'http://localhost:8002/api';

/**
 * Valida o Bearer token da requisição delegando ao próprio backend Spring
 * (GET /auth/me) em vez de verificar a assinatura do JWT localmente. O
 * backend já possui o JwtAuthenticationFilter que valida assinatura,
 * expiração e claims; reimplementar essa checagem aqui duplicaria a fonte de
 * verdade (e exigiria expor o segredo de assinatura para o Next.js). Um 200
 * em /auth/me confirma que o token é válido; qualquer outra resposta ou
 * falha de rede é tratada como não autenticado.
 */
export async function requireAuth(req: NextRequest): Promise<{ uid: string } | null> {
  const authHeader = req.headers.get('authorization') || '';
  const match = authHeader.match(/^Bearer\s+(.+)$/i);
  if (!match) {
    console.error('[verify-auth] No Bearer token found in header:', authHeader);
    return null;
  }

  const tokenStr = match[1];

  try {
    const res = await fetch(`${API_BASE_URL}/auth/me`, {
      headers: { Authorization: `Bearer ${tokenStr}` },
    });

    if (!res.ok) {
      console.error('[verify-auth] /auth/me returned non-200:', res.status);
      return null;
    }

    const data = await res.json();
    if (typeof data?.id !== 'string' || !data.id) {
      console.error('[verify-auth] /auth/me response missing id:', data);
      return null;
    }

    return { uid: data.id };
  } catch (err: any) {
    console.error('[verify-auth] Failed to validate token against /auth/me:', err?.message || err);
    return null;
  }
}
