import { NextRequest, NextResponse } from 'next/server';
import { embedText } from '@/lib/embeddings';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const { text } = await req.json();
    if (!text || typeof text !== 'string') {
      return NextResponse.json({ error: 'Campo obrigatório: text.' }, { status: 400 });
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
