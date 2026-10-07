import { NextRequest, NextResponse } from 'next/server';
import { checkRateLimit } from '@/lib/rate-limit';

// Proxy fino para o backend: lista os quadros Scrum de um projeto do Jira (descobre o rapidViewId).
export async function POST(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for') || 'local-client';
  if (!checkRateLimit(`jira-boards:${ip}`, 60, 60_000)) {
    return NextResponse.json({ error: 'Muitas requisições. Tente novamente em instantes.' }, { status: 429 });
  }
  try {
    const body = await req.json();
    const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8002/api';
    const authHeader = req.headers.get('authorization');
    const response = await fetch(`${API_BASE_URL}/jira/boards`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(authHeader ? { Authorization: authHeader } : {}) },
      body: JSON.stringify(body),
    });
    const text = await response.text();
    return new NextResponse(text, { status: response.status, headers: { 'Content-Type': 'application/json' } });
  } catch (error) {
    console.error('[Next.js Jira Boards Proxy] Error:', error);
    return NextResponse.json({ error: 'Erro interno ao listar quadros do Jira.' }, { status: 500 });
  }
}
