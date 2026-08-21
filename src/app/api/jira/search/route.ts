import { NextRequest, NextResponse } from 'next/server';
import { checkRateLimit } from '@/lib/rate-limit';

export async function POST(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for') || 'local-client';
  if (!checkRateLimit(`jira-search:${ip}`, 100, 60_000)) {
    return NextResponse.json({ error: 'Muitas requisições. Tente novamente em instantes.' }, { status: 429 });
  }

  try {
    const body = await req.json();
    const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8002/api';
    
    // Encaminha a chamada para o Spring Boot centralizado
    const response = await fetch(`${API_BASE_URL}/jira/search`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body)
    });

    if (!response.ok) {
      const errorText = await response.text();
      return NextResponse.json(
        { error: 'Erro ao buscar no Jira via Spring Boot', details: errorText },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error: any) {
    console.error('[Next.js Jira Proxy] Error:', error);
    return NextResponse.json(
      { error: 'Erro interno ao processar a requisição no proxy.' },
      { status: 500 }
    );
  }
}
