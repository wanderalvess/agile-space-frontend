import { NextRequest, NextResponse } from 'next/server';
import { embedText } from '@/lib/embeddings';
import { requireAuth } from '@/lib/verify-auth';
import { checkRateLimit } from '@/lib/rate-limit';

const MAX_EMBED_TEXT_LENGTH = 4000;

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const auth = await requireAuth(req);
  if (!auth) {
    return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 });
  }
  if (!checkRateLimit(`embed:${auth.uid}`, 60, 60_000)) {
    return NextResponse.json({ error: 'Muitas requisições. Tente novamente em instantes.' }, { status: 429 });
  }
  try {
    const { text } = await req.json();
    if (!text || typeof text !== 'string') {
      return NextResponse.json({ error: 'Campo obrigatório: text.' }, { status: 400 });
    }
    if (text.length > MAX_EMBED_TEXT_LENGTH) {
      return NextResponse.json({ error: `Texto excede ${MAX_EMBED_TEXT_LENGTH} caracteres.` }, { status: 413 });
    }

    const embedding = await embedText(text);
    return NextResponse.json({ embedding });
  } catch (error: any) {
    return NextResponse.json(
      { error: 'Erro interno ao gerar embedding.' },
      { status: 500 }
    );
  }
}
