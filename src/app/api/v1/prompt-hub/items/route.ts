import { NextRequest, NextResponse } from 'next/server';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || process.env.NEXT_PUBLIC_SPRING_API_URL || 'http://localhost:8002/api';

interface BackendPage<T> {
  content: T[];
  totalElements: number;
  number: number;
  size: number;
  totalPages: number;
}

/**
 * Proxy fino pra /api/v1/prompt-hub/items do backend Spring (agile-space-backend),
 * que já valida a API key (ApiKeyAuthenticationFilter) e já restringe a
 * visibility="public" (PromptService.listPublicPrompts). Essa camada só normaliza
 * o formato de página (1-based, mesmo shape do endpoint equivalente no legado
 * Agile-Space) — ver src/app/api/v1/knowledge/docs/route.ts pro mesmo padrão.
 */
export async function GET(req: NextRequest) {
  const apiKey = req.headers.get('x-api-key');
  if (!apiKey) {
    return NextResponse.json({ error: 'Chave de API ausente.' }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const q = searchParams.get('q')?.trim();
  const authorId = searchParams.get('authorId')?.trim();
  const page = Math.max(1, Number(searchParams.get('page')) || 1);
  const pageSize = Math.min(100, Math.max(1, Number(searchParams.get('pageSize')) || 20));

  const backendParams = new URLSearchParams({
    page: String(page - 1), // Spring Pageable é 0-based
    size: String(pageSize),
  });
  if (q) backendParams.set('q', q);
  if (authorId) backendParams.set('authorId', authorId);

  try {
    const res = await fetch(`${API_BASE_URL}/v1/prompt-hub/items?${backendParams.toString()}`, {
      headers: { 'X-Api-Key': apiKey },
    });

    if (!res.ok) {
      const error = res.status === 401 ? 'Chave de API ausente ou inválida.' : 'Erro ao listar prompts.';
      return NextResponse.json({ error }, { status: res.status });
    }

    const backendPage: BackendPage<unknown> = await res.json();

    return NextResponse.json({
      items: backendPage.content,
      page,
      pageSize,
      total: backendPage.totalElements,
      totalPages: backendPage.totalPages,
    });
  } catch (err) {
    console.error('[api/v1/prompt-hub/items] Erro ao consultar backend:', err);
    return NextResponse.json({ error: 'Erro interno ao listar prompts.' }, { status: 500 });
  }
}
