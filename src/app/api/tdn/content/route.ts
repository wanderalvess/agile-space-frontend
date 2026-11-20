import { NextRequest, NextResponse } from 'next/server';
import { resolveSafeHost } from '@/lib/ssrf-guard';
import { requireAuth } from '@/lib/verify-auth';
import { checkRateLimit } from '@/lib/rate-limit';

export async function POST(req: NextRequest) {
  // Sem login a rota virava um relay aberto para qualquer servidor Confluence.
  const auth = await requireAuth(req);
  if (!auth) return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 });
  if (!checkRateLimit(`tdn-content:${auth.uid}`, 60, 60_000)) {
    return NextResponse.json({ error: 'Muitas requisições. Tente novamente em instantes.' }, { status: 429 });
  }
  try {
    const body = await req.json();
    const { baseUrl, token, pageId } = body;

    if (!baseUrl || !token || !pageId) {
      return NextResponse.json(
        { error: 'Campos obrigatórios: baseUrl, token e pageId.' },
        { status: 400 }
      );
    }

    // pageId entra no caminho da URL: só dígitos, para não alcançar outros endpoints do Confluence.
    if (!/^\d{1,20}$/.test(String(pageId))) {
      return NextResponse.json({ error: 'pageId inválido.' }, { status: 400 });
    }

    let cleanBaseUrl: string;
    try {
      cleanBaseUrl = await resolveSafeHost(baseUrl);
    } catch (e: any) {
      return NextResponse.json({ error: e.message || 'Host inválido.' }, { status: 400 });
    }
    const tdnUrl = `https://${cleanBaseUrl}/rest/api/content/${pageId}?expand=body.storage,version,space,metadata.labels`;

    const response = await fetch(tdnUrl, {
      method: 'GET',
      redirect: 'error', // um redirecionamento poderia levar a um host interno, driblando o guarda de SSRF
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/json, text/plain, */*',
        'Content-Type': 'application/json',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
        'Accept-Language': 'pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7',
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache',
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      return NextResponse.json(
        { 
          error: `Erro ao buscar conteúdo TDN: ${response.status}`, 
          details: errorText.substring(0, 500) 
        }, 
        { status: response.status }
      );
    }

    const data = await response.json();
    
    return NextResponse.json({
      id: data.id,
      title: data.title,
      content: data.body?.storage?.value || '',
      space: data.space?.name || data.space?.key,
      version: data.version?.number,
      link: `https://${cleanBaseUrl}/pages/viewpage.action?pageId=${data.id}`,
      labels: data.metadata?.labels?.results?.map((l: any) => l.name) || []
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: 'Erro interno ao recuperar conteúdo do TDN.' },
      { status: 500 }
    );
  }
}
