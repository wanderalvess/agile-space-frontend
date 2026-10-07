import { NextRequest, NextResponse } from 'next/server';
import { exportKnowledgeContent, KnowledgeExportFormat } from '@/lib/knowledge-export';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || process.env.NEXT_PUBLIC_SPRING_API_URL || 'http://localhost:8002/api';
const VALID_FORMATS = new Set(['html', 'md', 'txt']);

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

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const apiKey = req.headers.get('x-api-key');
  if (!apiKey) {
    return NextResponse.json({ error: 'Chave de API ausente.' }, { status: 401 });
  }

  const formatParam = req.nextUrl.searchParams.get('format') || 'html';
  const format = (VALID_FORMATS.has(formatParam) ? formatParam : 'html') as KnowledgeExportFormat;

  try {
    const res = await fetch(`${API_BASE_URL}/v1/knowledge/docs/${encodeURIComponent(id)}`, {
      headers: { 'X-Api-Key': apiKey },
    });

    if (res.status === 404) {
      return NextResponse.json({ error: 'Documento não encontrado.' }, { status: 404 });
    }
    if (!res.ok) {
      const error = res.status === 401 ? 'Chave de API ausente ou inválida.' : 'Erro ao buscar documento.';
      return NextResponse.json({ error }, { status: res.status });
    }

    const data: BackendDoc = await res.json();
    const { body } = exportKnowledgeContent(data.content, format);

    return NextResponse.json({
      id: data.id,
      title: data.title,
      category: data.category,
      fullPath: data.fullPath,
      tags: data.tags || [],
      byteSize: data.byteSize,
      status: data.status,
      createdAt: data.createdAt,
      updatedAt: data.updatedAt,
      format,
      content: body,
    });
  } catch (err) {
    console.error('[api/v1/knowledge/docs/[id]] Erro ao consultar backend:', err);
    return NextResponse.json({ error: 'Erro interno ao buscar documento.' }, { status: 500 });
  }
}
