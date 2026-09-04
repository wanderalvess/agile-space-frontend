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
    throw new Error(
      `Configuração ausente para source="${source}": defina ${prefix}_BASE_URL e ${prefix}_API_KEY (env vars do servidor MCP).`
    );
  }
  return { baseUrl: baseUrl.replace(/\/+$/, ''), apiKey };
}

async function call(source: Source, path: string): Promise<Response> {
  const { baseUrl, apiKey } = getConfig(source);
  const res = await fetch(`${baseUrl}${path}`, {
    headers: { 'X-Api-Key': apiKey },
  });
  return res;
}

async function callJson<T>(source: Source, path: string): Promise<T> {
  const res = await call(source, path);
  if (!res.ok) {
    const body = await res.text().catch(() => '');
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
