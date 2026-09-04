// Ignora erro de certificado em rede corporativa (proxy / self-signed)
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
import fs from 'fs';

const LOG_FILE = 'C:/Users/wanderson.alves/projetosWanderson/agile-space-frontend/mcp/knowledge-server/mcp_debug.log';

function log(msg: string) {
  try {
    const line = `[${new Date().toISOString()}] ${msg}\n`;
    fs.appendFileSync(LOG_FILE, line, 'utf-8');
  } catch {}
}

log(`Knowledge server module loaded. ENV: LEGACY_BASE_URL=${process.env.LEGACY_BASE_URL}, LEGACY_API_KEY=${process.env.LEGACY_API_KEY ? (process.env.LEGACY_API_KEY.slice(0, 8) + '...') : 'undefined'}, NEW_BASE_URL=${process.env.NEW_BASE_URL}`);

export type Source = 'legacy' | 'new';

interface SourceConfig {
  baseUrl: string;
  apiKey: string;
}

function getConfig(source: Source): SourceConfig {
  const prefix = source === 'legacy' ? 'LEGACY' : 'NEW';
  const baseUrl = process.env[`${prefix}_BASE_URL`];
  const apiKey = process.env[`${prefix}_API_KEY`];
  if (!baseUrl || !apiKey) {
    const err = `Configuração ausente para source="${source}": defina ${prefix}_BASE_URL e ${prefix}_API_KEY (env vars do servidor MCP). Recebido: ${prefix}_BASE_URL=${baseUrl}, ${prefix}_API_KEY=${apiKey ? 'definida' : 'ausente'}`;
    log(`getConfig error: ${err}`);
    throw new Error(err);
  }
  return { baseUrl: baseUrl.replace(/\/+$/, ''), apiKey };
}

async function call(source: Source, path: string, options?: { method?: string; body?: any }): Promise<Response> {
  const { baseUrl, apiKey } = getConfig(source);
  const targetUrl = `${baseUrl}${path}`;
  log(`Calling [${source}] ${options?.method || 'GET'} -> ${targetUrl} (apiKey: ${apiKey.slice(0, 8)}...)`);
  try {
    const headers: Record<string, string> = { 'X-Api-Key': apiKey };
    let bodyText: string | undefined;
    if (options?.body !== undefined) {
      headers['Content-Type'] = 'application/json';
      bodyText = JSON.stringify(options.body);
    }
    const res = await fetch(targetUrl, {
      method: options?.method || 'GET',
      headers,
      body: bodyText,
    });
    log(`Response from ${targetUrl}: HTTP ${res.status}`);
    return res;
  } catch (err: any) {
    const causeMsg = err?.cause?.message || err?.cause?.code || err?.cause || err?.message;
    const msg = `Falha ao conectar em ${targetUrl}: ${err?.message} (detalhe: ${causeMsg})`;
    log(`Fetch error on ${targetUrl}: ${msg}\nStack: ${err?.stack}\nCause: ${JSON.stringify(err?.cause || {})}`);
    throw new Error(msg);
  }
}

async function callJson<T>(source: Source, path: string, options?: { method?: string; body?: any }): Promise<T> {
  const res = await call(source, path, options);
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    log(`API ${source} error HTTP ${res.status}: ${body.slice(0, 300)}`);
    throw new Error(`API ${source} respondeu ${res.status}: ${body.slice(0, 300)}`);
  }
  return res.json() as Promise<T>;
}

export interface DocSummary {
  id: string;
  title: string;
  category?: string;
  fullPath?: string;
  tags: string[];
  byteSize: number;
  status: string;
  createdAt: string;
  updatedAt: string;
  contentPreview: string;
}

export interface DocListResponse {
  docs: DocSummary[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export interface DocDetail {
  id: string;
  title: string;
  category?: string;
  fullPath?: string;
  tags: string[];
  byteSize: number;
  status: string;
  createdAt: string;
  updatedAt: string;
  format: string;
  content: string;
}

export function listDocs(source: Source, params: { q?: string; category?: string; tag?: string; page?: number; pageSize?: number }): Promise<DocListResponse> {
  const qs = new URLSearchParams();
  if (params.q) qs.set('q', params.q);
  if (params.category) qs.set('category', params.category);
  if (params.tag) qs.set('tag', params.tag);
  if (params.page) qs.set('page', String(params.page));
  if (params.pageSize) qs.set('pageSize', String(params.pageSize));
  const query = qs.toString();
  return callJson<DocListResponse>(source, `/api/v1/knowledge/docs${query ? `?${query}` : ''}`);
}

export function getDoc(source: Source, id: string, format: 'html' | 'md' | 'txt' = 'html'): Promise<DocDetail> {
  return callJson<DocDetail>(source, `/api/v1/knowledge/docs/${encodeURIComponent(id)}?format=${format}`);
}

export async function downloadDoc(source: Source, id: string, format: 'html' | 'md' | 'txt' = 'md'): Promise<string> {
  const res = await call(source, `/api/v1/knowledge/docs/${encodeURIComponent(id)}/download?format=${format}`);
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`API ${source} respondeu ${res.status}: ${body.slice(0, 300)}`);
  }
  return res.text();
}

export interface CreateDocParams {
  title: string;
  content: string;
  category?: string;
  tags?: string[];
}

export function createDoc(source: Source, params: CreateDocParams): Promise<any> {
  return callJson<any>(source, '/api/v1/knowledge/docs', {
    method: 'POST',
    body: params,
  });
}
