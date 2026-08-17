import { NextRequest, NextResponse } from 'next/server';
import { resolveSafeHost } from '@/lib/ssrf-guard';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  let cql = '';
  let tdnUrl = '';

  try {
    const body = await req.json();
    const { baseUrl, token, query, space, label } = body;

    if (!baseUrl || !token) {
      return NextResponse.json({ error: 'Campos obrigatórios: baseUrl e token.' }, { status: 400 });
    }

    let cleanBaseUrl: string;
    try {
      cleanBaseUrl = await resolveSafeHost(baseUrl);
    } catch (e: any) {
      return NextResponse.json({ error: e.message || 'Host inválido.' }, { status: 400 });
    }

    // Confluence CQL Search (common in TDN)
    // Escapa aspas duplas e barra invertida nos valores fornecidos pelo
    // cliente para evitar que quebrem a string CQL e injetem cláusulas
    // arbitrárias (ex: ampliar o escopo além do space/label pretendido).
    const escapeCql = (value: string) => value.replace(/\\/g, '\\\\').replace(/"/g, '\\"');

    cql = 'type = "page"';
    if (query && query.trim()) {
      const safeQuery = escapeCql(query);
      cql += ` AND (text ~ "${safeQuery}" OR title ~ "${safeQuery}")`;
    }
    if (space) cql += ` AND space = "${escapeCql(space)}"`;

    if (label) {
      const labels: string[] = label.split(',').map((l: string) => l.trim()).filter(Boolean).map(escapeCql);
      if (labels.length > 1) {
        cql += ` AND label IN (${labels.map((l: string) => `"${l}"`).join(',')})`;
      } else if (labels.length === 1) {
        cql += ` AND label = "${labels[0]}"`;
      }
    }

    tdnUrl = `https://${cleanBaseUrl}/rest/api/content/search?cql=${encodeURIComponent(cql)}&limit=100&expand=space,history,metadata.labels`;

    // Perform the search
    const response = await fetch(tdnUrl, {
      method: 'GET',
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

    const status = response.status;
    const responseText = await response.text();

    if (!response.ok) {
      return NextResponse.json(
        { 
          error: `Erro TDN: ${status}`, 
          details: responseText.substring(0, 500) 
        }, 
        { status }
      );
    }

    const data = JSON.parse(responseText);
    
    // Transform to a standard format
    const results = (data.results || []).map((page: any) => ({
      id: page.id,
      title: page.title,
      type: page.type,
      link: `https://${cleanBaseUrl}/pages/viewpage.action?pageId=${page.id}`,
      space: page.space?.name || page.space?.key,
      lastModified: page.history?.lastUpdated?.when,
      labels: page.metadata?.labels?.results?.map((l: any) => l.name) || [],
    }));

    return NextResponse.json({ results });
  } catch (error: any) {
    return NextResponse.json(
      { error: 'Erro interno ao processar a requisição TDN.' },
      { status: 500 }
    );
  }
}
