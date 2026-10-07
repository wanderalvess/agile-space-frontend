import { NextResponse } from 'next/server';

export async function GET() {
  return new NextResponse('Este endpoint foi desabilitado temporariamente por questões de segurança e privacidade dos dados.', {
    status: 403,
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'no-store, max-age=0'
    }
  });
}
