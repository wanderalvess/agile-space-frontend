import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/verify-auth';
import { checkRateLimit } from '@/lib/rate-limit';
import { resolveSafeHost } from '@/lib/ssrf-guard';

// Chave de caso de teste do Zephyr (ex.: PROJ-T123): só letras, números, hífen e sublinhado.
const TEST_CASE_KEY = /^[A-Za-z0-9_-]{1,64}$/;
// Só host[:porta]. Caminho, query ou "usuário@" no domínio trocariam o destino da chamada.
const HOST_ONLY = /^[A-Za-z0-9.-]+(:\d{1,5})?$/;
const UPSTREAM_TIMEOUT_MS = 20_000;
const MAX_UPSTREAM_TEXT = 300;

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
    const { testCaseKey, pat, domain } = body;

    if (!testCaseKey) {
      return NextResponse.json({ error: 'O código do caso de teste é obrigatório.' }, { status: 400 });
    }
    if (typeof testCaseKey !== 'string' || !TEST_CASE_KEY.test(testCaseKey.trim())) {
      return NextResponse.json({ error: 'Código do caso de teste inválido.' }, { status: 400 });
    }

    const domainToUse = (typeof domain === 'string' ? domain : '').trim() || (process.env.JIRA_DEFAULT_DOMAIN || '').trim();
    if (!domainToUse) {
      return NextResponse.json({ error: 'O domínio do Jira é obrigatório.' }, { status: 400 });
    }

    // O domínio vem do cliente: sem esta checagem a rota vira um proxy para a rede interna (SSRF).
    let host: string;
    try {
      host = await resolveSafeHost(domainToUse);
    } catch (e: any) {
      return NextResponse.json({ error: e.message || 'Domínio do Jira inválido.' }, { status: 400 });
    }
    if (!HOST_ONLY.test(host)) {
      return NextResponse.json({ error: 'Domínio do Jira inválido: informe só o endereço, sem caminho.' }, { status: 400 });
    }

    if (!pat) {
      return NextResponse.json({ error: 'Credenciais de autenticação (Token PAT) são necessárias.' }, { status: 400 });
    }

    const jiraUrl = `https://${host}/rest/atm/1.0/testcase/${encodeURIComponent(testCaseKey.trim())}`;

    const userAgent = request.headers.get('user-agent') || 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';
    const acceptLanguage = request.headers.get('accept-language') || 'pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7';

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'User-Agent': userAgent,
      'Accept-Language': acceptLanguage,
      'Cache-Control': 'no-cache',
      'Authorization': `Bearer ${pat}`,
    };

    // Fazer a chamada ao Jira TOTVS. Redirecionamento não é seguido: um 30x poderia levar o PAT a outro host.
    const response = await fetch(jiraUrl, {
      method: 'GET',
      headers,
      redirect: 'error',
      signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
    });

    if (!response.ok) {
      const text = await response.text();
      let errorMsg = `Erro na API do Jira (${response.status})`;
      try {
        const errJson = JSON.parse(text);
        errorMsg = errJson.message || errorMsg;
      } catch (_) {
        if (text) errorMsg += `: ${text.slice(0, MAX_UPSTREAM_TEXT)}`;
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
