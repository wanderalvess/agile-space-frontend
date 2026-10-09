import { NextRequest, NextResponse } from 'next/server';
import https from 'node:https';
import { checkRateLimit } from '@/lib/rate-limit';
import { allowTlsFallback, clientKey, isAllowedJiraPath, isTlsTrustError } from '@/lib/jira-proxy';

const JIRA_BASE = (process.env.JIRA_BASE || 'https://jiraproducao.totvs.com.br').replace(/\/$/, '');

// Validação de certificado padrão primeiro; só cai para o agente que aceita certificado corporativo quando o
// handshake falha por confiança (e `JIRA_TLS_INSECURE` não é '0'). Assim um Jira com certificado válido nunca
// fica exposto a MITM só porque outro ambiente usa certificado próprio.
const strictAgent = new https.Agent({ rejectUnauthorized: true });
const lenientAgent = new https.Agent({ rejectUnauthorized: false });

// Este proxy não exige login do portal (o iframe do JiraDash só conhece o token do Jira) e o host de destino é
// fixo (JIRA_BASE). O limite por IP contém abuso como retransmissor; ver docs/fluxos/integracao-jira.md.
const RATE_MAX = 600;
const RATE_WINDOW_MS = 60_000;

type ProxyResult = { status: number; headers: Record<string, string>; body: Buffer };

function requestOnce(targetUrl: URL, token: string, agent: https.Agent): Promise<ProxyResult> {
  return new Promise((resolve, reject) => {
    const proxyReq = https.request(
      targetUrl,
      {
        method: 'GET',
        agent,
        timeout: 60_000,
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/json',
          'Content-Type': 'application/json',
          // User-Agent de navegador: o WAF/Cloudflare na frente do Jira bloqueia UA próprio quando a chamada sai de
          // IP de nuvem pública (mesma solução do proxy do legado).
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
          Origin: JIRA_BASE,
          Referer: `${JIRA_BASE}/`,
        },
      },
      (proxyRes) => {
        const chunks: Buffer[] = [];
        proxyRes.on('data', (chunk) => chunks.push(Buffer.from(chunk)));
        proxyRes.on('end', () => {
          const resHeaders: Record<string, string> = {};
          if (proxyRes.headers['content-type']) {
            resHeaders['content-type'] = proxyRes.headers['content-type'] as string;
          }
          if (proxyRes.headers['ratelimit-reason']) {
            resHeaders['ratelimit-reason'] = proxyRes.headers['ratelimit-reason'] as string;
          }
          if (proxyRes.headers['retry-after']) {
            resHeaders['retry-after'] = proxyRes.headers['retry-after'] as string;
          }
          resolve({ status: proxyRes.statusCode || 200, headers: resHeaders, body: Buffer.concat(chunks) });
        });
        proxyRes.on('error', reject);
      }
    );
    proxyReq.on('timeout', () => proxyReq.destroy(Object.assign(new Error('timeout'), { code: 'ETIMEDOUT' })));
    proxyReq.on('error', reject);
    proxyReq.end();
  });
}

export async function GET(req: NextRequest) {
  const pathname = req.nextUrl.pathname;
  // Remove o prefixo '/jira' se presente
  const subPath = pathname.startsWith('/jira') ? pathname.slice(5) : pathname;
  const targetPathWithQuery = subPath + req.nextUrl.search;

  if (!checkRateLimit(`jira-proxy:${clientKey(req.headers)}`, RATE_MAX, RATE_WINDOW_MS)) {
    return new NextResponse('Muitas requisições. Tente novamente em instantes.', {
      status: 429,
      headers: { 'retry-after': '30' },
    });
  }

  const token =
    req.headers.get('x-jira-token') ||
    req.headers.get('authorization')?.replace(/^Bearer\s+/i, '');

  if (!token) {
    return new NextResponse('Token ausente', { status: 401 });
  }

  if (!isAllowedJiraPath(targetPathWithQuery)) {
    return new NextResponse('Endpoint não permitido', { status: 403 });
  }

  const targetUrl = new URL(targetPathWithQuery, JIRA_BASE);

  try {
    let result: ProxyResult;
    try {
      result = await requestOnce(targetUrl, token, strictAgent);
    } catch (err) {
      if (!isTlsTrustError(err) || !allowTlsFallback(process.env.JIRA_TLS_INSECURE)) throw err;
      console.warn('[Jira Proxy] Certificado do Jira não confiável pela validação padrão; usando conexão tolerante.');
      result = await requestOnce(targetUrl, token, lenientAgent);
    }
    return new NextResponse(new Uint8Array(result.body), { status: result.status, headers: result.headers });
  } catch (error: any) {
    // Sem repassar a mensagem bruta do Node (pode trazer endereço interno).
    console.error('[Jira Proxy] Erro:', error?.code || error?.message);
    return new NextResponse(JSON.stringify({ error: 'Erro ao conectar ao Jira. Tente novamente em instantes.' }), {
      status: 502,
      headers: { 'content-type': 'application/json' },
    });
  }
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, x-jira-token, Authorization',
    },
  });
}
