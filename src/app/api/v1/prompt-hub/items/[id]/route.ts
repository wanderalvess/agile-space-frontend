import { NextRequest, NextResponse } from 'next/server';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || process.env.NEXT_PUBLIC_SPRING_API_URL || 'http://localhost:8002/api';

/** Proxy fino pra /api/v1/prompt-hub/items/{id} do backend Spring — ver items/route.ts. */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const apiKey = req.headers.get('x-api-key');
  if (!apiKey) {
    return NextResponse.json({ error: 'Chave de API ausente.' }, { status: 401 });
  }

  try {
    const res = await fetch(`${API_BASE_URL}/v1/prompt-hub/items/${encodeURIComponent(id)}`, {
      headers: { 'X-Api-Key': apiKey },
    });

    if (res.status === 404) {
      return NextResponse.json({ error: 'Prompt não encontrado.' }, { status: 404 });
    }
    if (!res.ok) {
      const error = res.status === 401 ? 'Chave de API ausente ou inválida.' : 'Erro ao buscar prompt.';
      return NextResponse.json({ error }, { status: res.status });
    }

    const prompt = await res.json();
    return NextResponse.json(prompt);
  } catch (err) {
    console.error('[api/v1/prompt-hub/items/[id]] Erro ao consultar backend:', err);
    return NextResponse.json({ error: 'Erro interno ao buscar prompt.' }, { status: 500 });
  }
}
