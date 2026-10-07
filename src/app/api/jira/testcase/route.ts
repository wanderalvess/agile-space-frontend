import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/verify-auth';
import { checkRateLimit } from '@/lib/rate-limit';

export async function POST(request: NextRequest) {
  const auth = await requireAuth(request);
  if (!auth) {
    return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 });
  }
  if (!checkRateLimit(`jira-testcase:${auth.uid}`, 20, 60_000)) {
    return NextResponse.json({ error: 'Muitas requisições. Tente novamente em instantes.' }, { status: 429 });
  }

  try {
    const body = await request.json();
    const { testCaseKey, pat, username, password, domain } = body;

    if (!testCaseKey) {
      return NextResponse.json({ error: 'O código do caso de teste é obrigatório.' }, { status: 400 });
    }

    const domainToUse = (domain || process.env.JIRA_DEFAULT_DOMAIN || '').trim();
    if (!domainToUse) {
      return NextResponse.json({ error: 'O domínio do Jira é obrigatório.' }, { status: 400 });
    }

    const jiraUrl = `https://${domainToUse}/rest/atm/1.0/testcase/${testCaseKey}`;
    
    const userAgent = request.headers.get('user-agent') || 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';
    const acceptLanguage = request.headers.get('accept-language') || 'pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7';

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'User-Agent': userAgent,
      'Accept-Language': acceptLanguage,
      'Cache-Control': 'no-cache',
    };

    if (pat) {
      headers['Authorization'] = `Bearer ${pat}`;
    } else {
      return NextResponse.json({ error: 'Credenciais de autenticação (Token PAT) são necessárias.' }, { status: 400 });
    }

    // Fazer a chamada ao Jira TOTVS
    const response = await fetch(jiraUrl, {
      method: 'GET',
      headers,
    });

    if (!response.ok) {
      const text = await response.text();
      let errorMsg = `Erro na API do Jira (${response.status})`;
      try {
        const errJson = JSON.parse(text);
        errorMsg = errJson.message || errorMsg;
      } catch (_) {
        if (text) errorMsg += `: ${text}`;
      }
      return NextResponse.json({ error: errorMsg }, { status: response.status });
    }

    const testCaseData = await response.json();
    return NextResponse.json(testCaseData);
  } catch (error: any) {
    console.error('Erro no proxy do Jira:', error);
    return NextResponse.json({ error: error.message || 'Erro interno do servidor.' }, { status: 500 });
  }
}
