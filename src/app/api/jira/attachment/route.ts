import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/verify-auth';
import { checkRateLimit } from '@/lib/rate-limit';

/**
 * Proxy fino pro Spring Boot (/api/jira/attachment) — o backend já valida que
 * a URL do anexo pertence ao domínio Jira configurado (evita virar proxy
 * aberto) e faz o SSRF guard (assertNotBlockedHost/exchangeSecure) que os
 * outros endpoints Jira já usam. Essa rota só repassa a chamada autenticada e
 * devolve os bytes crus — sem isso, <img> cross-origin pro próprio Jira nunca
 * carrega (exige sessão/cookie que o navegador não envia num request de
 * terceiro).
 */
export async function POST(req: NextRequest) {
  const auth = await requireAuth(req);
  if (!auth) {
    return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 });
  }
  if (!checkRateLimit(`jira-attachment:${auth.uid}`, 60, 60_000)) {
    return NextResponse.json({ error: 'Muitas requisições. Tente novamente em instantes.' }, { status: 429 });
  }

  try {
    const body = await req.json();
    const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8002/api';
    const authHeader = req.headers.get('authorization');

    const response = await fetch(`${API_BASE_URL}/jira/attachment`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(authHeader ? { Authorization: authHeader } : {}),
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorText = await response.text();
      return NextResponse.json(
        { error: 'Erro ao buscar anexo do Jira via Spring Boot', details: errorText },
        { status: response.status }
      );
    }

    const contentType = response.headers.get('content-type') || 'application/octet-stream';
    const buffer = await response.arrayBuffer();
    return new NextResponse(buffer, {
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'private, max-age=300',
      },
    });
  } catch (error: any) {
    console.error('[Next.js Jira Attachment Proxy] Error:', error);
    return NextResponse.json(
      { error: 'Erro interno ao processar a requisição no proxy.' },
      { status: 500 }
    );
  }
}
