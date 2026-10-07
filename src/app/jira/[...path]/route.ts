import { NextRequest, NextResponse } from 'next/server';
import https from 'node:https';

const JIRA_BASE = (process.env.JIRA_BASE || 'https://jiraproducao.totvs.com.br').replace(/\/$/, '');

const ALLOWED_JIRA_PATHS = [
  /^\/rest\/api\/2\/field(?:\?|$)/,
  /^\/rest\/api\/2\/search(?:\?|$)/,
  /^\/rest\/api\/2\/issue\/[A-Za-z0-9_]+-\d+\/worklog(?:\?|$)/i,
  /^\/rest\/agile\/1\.0\/sprint\/\d+(?:\?|$)/,
  /^\/rest\/api\/2\/user\/search(?:\?|$)/,
];

// Agent configurado para aceitar certificados corporativos TOTVS
const httpsAgent = new https.Agent({
  rejectUnauthorized: process.env.JIRA_TLS_INSECURE === '0' ? true : false,
});

export async function GET(req: NextRequest) {
  const pathname = req.nextUrl.pathname;
  // Remove o prefixo '/jira' se presente
  const subPath = pathname.startsWith('/jira') ? pathname.slice(5) : pathname;
  const targetPathWithQuery = subPath + req.nextUrl.search;

  const token =
    req.headers.get('x-jira-token') ||
    req.headers.get('authorization')?.replace(/^Bearer\s+/i, '');

  if (!token) {
    return new NextResponse('Token ausente', { status: 401 });
  }

  if (!ALLOWED_JIRA_PATHS.some((re) => re.test(targetPathWithQuery))) {
    return new NextResponse('Endpoint não permitido', { status: 403 });
  }

  const targetUrl = new URL(targetPathWithQuery, JIRA_BASE);

  try {
    const result = await new Promise<{ status: number; headers: Record<string, string>; body: Buffer }>(
      (resolve, reject) => {
        const proxyReq = https.request(
          targetUrl,
          {
            method: 'GET',
            agent: httpsAgent,
            headers: {
              Authorization: `Bearer ${token}`,
              Accept: 'application/json',
              'Content-Type': 'application/json',
              // User-Agent proprio (JiraDash-AgileSpace/1.0) apanha do WAF/Cloudflare na
              // frente do Jira quando a chamada sai de IP de nuvem publica (Render) —
              // confirmado reproduzindo o bloqueio manualmente. O mesmo proxy no legado
              // (Agile-Space, commit 9c1fee5) resolveu disfarcando a chamada como
              // navegador real; replicando aqui.
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
              Origin: `https://${JIRA_BASE.replace(/^https?:\/\//, '')}`,
              Referer: `https://${JIRA_BASE.replace(/^https?:\/\//, '')}/`,
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
              resolve({
                status: proxyRes.statusCode || 200,
                headers: resHeaders,
                body: Buffer.concat(chunks),
              });
            });
            proxyRes.on('error', reject);
          }
        );

        proxyReq.on('error', reject);
        proxyReq.end();
      }
    );

    return new NextResponse(result.body, {
      status: result.status,
      headers: result.headers,
    });
  } catch (error: any) {
    console.error('[Jira Proxy] Error:', error.message);
    return new NextResponse(
      JSON.stringify({ error: 'Erro ao conectar ao Jira: ' + error.message }),
      {
        status: 502,
        headers: { 'content-type': 'application/json' },
      }
    );
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
