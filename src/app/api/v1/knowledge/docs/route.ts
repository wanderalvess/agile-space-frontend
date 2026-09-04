import { NextRequest, NextResponse } from 'next/server';
import { htmlToPlainText } from '@/lib/knowledge-export';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || process.env.NEXT_PUBLIC_SPRING_API_URL || 'http://localhost:8002/api';

interface BackendDoc {
  id: string;
  title: string;
  content: string;
  category: string;
  fullPath?: string;
  tags?: string[];
  byteSize: number;
  status: string;
  createdAt: string;
  updatedAt: string;
}

interface BackendPage {
  content: BackendDoc[];
  totalElements: number;
  totalPages: number;
}

/**
 * Proxy fino pra /api/v1/knowledge/docs do backend Spring (agile-space-backend),
 * que já valida a API key (ApiKeyAuthenticationFilter, mesmo header X-Api-Key
 * repassado como veio). Essa camada só normaliza o formato de página (1-based,
 * mesmo shape do endpoint equivalente no legado) e recorta um preview em texto
 * puro do conteúdo — a doc completa fica em GET /docs/{id}.
 */
export async function GET(req: NextRequest) {
  const apiKey = req.headers.get('x-api-key');
  if (!apiKey) {
    return NextResponse.json({ error: 'Chave de API ausente.' }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const q = searchParams.get('q')?.trim();
  const page = Math.max(1, Number(searchParams.get('page')) || 1);
  const pageSize = Math.min(100, Math.max(1, Number(searchParams.get('pageSize')) || 20));

  const backendParams = new URLSearchParams({
    page: String(page - 1), // Spring Pageable é 0-based
    size: String(pageSize),
  });
  if (q) backendParams.set('q', q);

  try {
    const res = await fetch(`${API_BASE_URL}/v1/knowledge/docs?${backendParams.toString()}`, {
      headers: { 'X-Api-Key': apiKey },
    });

    if (!res.ok) {
      const error = res.status === 401 ? 'Chave de API ausente ou inválida.' : 'Erro ao listar documentos.';
      return NextResponse.json({ error }, { status: res.status });
    }

    const backendPage: BackendPage = await res.json();

    return NextResponse.json({
      docs: backendPage.content.map(d => ({
        id: d.id,
        title: d.title,
        category: d.category,
        fullPath: d.fullPath,
        tags: d.tags || [],
        byteSize: d.byteSize,
        status: d.status,
        createdAt: d.createdAt,
        updatedAt: d.updatedAt,
        contentPreview: htmlToPlainText(d.content).slice(0, 240),
      })),
      page,
      pageSize,
      total: backendPage.totalElements,
      totalPages: backendPage.totalPages,
    });
  } catch (err) {
    console.error('[api/v1/knowledge/docs] Erro ao consultar backend:', err);
    return NextResponse.json({ error: 'Erro interno ao listar documentos.' }, { status: 500 });
  }
}
