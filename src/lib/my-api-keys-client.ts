import { authFetch } from '@/lib/auth-client';

/**
 * Cliente do self-service de API key (/api/api-keys no backend Spring) — cada
 * usuário autenticado vê/cria/revoga só as próprias chaves, com escopo limitado
 * pelo papel (ver ApiKeyController.allowedScopesFor no backend, espelhado em
 * ALLOWED_SCOPES_BY_ROLE abaixo pra já esconder da UI o que o backend recusaria
 * de qualquer jeito — não é a checagem real, só evita a viagem de rede).
 * Diferente de adminApi.getApiKeys/createApiKey/revokeApiKey (/admin/api-keys),
 * que é a visão global de ADMIN/LEAD sobre as chaves de todo mundo.
 */

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8002/api';

export interface MyApiKeyData {
  id: string;
  name: string;
  scopes: string[];
  squadId?: string | null;
  createdAt: string;
  lastUsedAt?: string;
  revokedAt?: string;
  /** Null/ausente = sem expiração. */
  expiresAt?: string | null;
}

export interface CreatedMyApiKey extends MyApiKeyData {
  rawKey: string;
}

export const API_KEY_SCOPES: { value: string; label: string; description: string }[] = [
  { value: 'KNOWLEDGE_READ', label: 'Base de Conhecimento · leitura', description: 'Listar e ler documentos da KB.' },
  { value: 'KNOWLEDGE_WRITE', label: 'Base de Conhecimento · escrita', description: 'Criar documentos na KB.' },
  { value: 'SQUAD_READ', label: 'Squad · leitura', description: 'Status, membros e issues — sempre restrito à sua própria squad.' },
  { value: 'PROMPTHUB_READ', label: 'Prompt Hub · leitura', description: 'Prompts e coleções públicas.' },
  { value: 'PROMPTHUB_WRITE', label: 'Prompt Hub · escrita', description: 'Criar e importar prompts e skills.' },
  { value: 'POKER_READ', label: 'Scrum Poker · leitura', description: 'Buscar estimativas de rodadas já feitas.' },
  { value: 'POKER_WRITE', label: 'Scrum Poker · escrita', description: 'Criar sessão de planning poker.' },
];

/** Espelha ApiKeyController.allowedScopesFor — só pra UI, a checagem real é no backend. */
export function scopesAllowedForRole(role: string | undefined | null): string[] {
  const privileged = role?.toUpperCase() === 'ADMIN' || role?.toUpperCase() === 'LEAD';
  if (privileged) return API_KEY_SCOPES.map(s => s.value);
  return ['KNOWLEDGE_READ', 'SQUAD_READ'];
}

async function req<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await authFetch(`${API_BASE_URL}${url}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  // .json() em corpo vazio lança "Unexpected end of JSON input" — os endpoints de
  // revoke devolvem 200 sem corpo (ResponseEntity.ok().<Void>build() no backend,
  // não .noContent()), então checar só status 204 não bastava.
  const text = await res.text();
  if (!res.ok) {
    const body = text ? safeJsonParse(text) : null;
    throw new Error(body?.error || `Erro ${res.status}`);
  }
  if (!text) return undefined as T;
  return JSON.parse(text);
}

function safeJsonParse(text: string): any {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function expiryBody(expiresIn?: string): Record<string, unknown> {
  if (!expiresIn) return {};
  return expiresIn === 'never' ? { neverExpires: true } : { expiresInDays: Number(expiresIn) };
}

export const myApiKeysApi = {
  async list(): Promise<MyApiKeyData[]> {
    return req<MyApiKeyData[]>('/api-keys');
  },

  /** expiresIn: '30' | '90' | '180' | 'never' (só admin). Omitido = 90 dias. */
  async create(name: string, scopes: string[], expiresIn?: string): Promise<CreatedMyApiKey> {
    return req<CreatedMyApiKey>('/api-keys', {
      method: 'POST',
      body: JSON.stringify({ name, scopes, ...expiryBody(expiresIn) }),
    });
  },

  /** Estende a validade e reavalia o papel do dono. */
  async renew(id: string, expiresIn?: string): Promise<MyApiKeyData> {
    return req<MyApiKeyData>(`/api-keys/${encodeURIComponent(id)}/renew`, {
      method: 'POST',
      body: JSON.stringify(expiryBody(expiresIn)),
    });
  },

  /** Cria uma chave nova igual e revoga a antiga; a chave crua nova só vem nesta resposta. */
  async rotate(id: string, expiresIn?: string): Promise<CreatedMyApiKey> {
    return req<CreatedMyApiKey>(`/api-keys/${encodeURIComponent(id)}/rotate`, {
      method: 'POST',
      body: JSON.stringify(expiryBody(expiresIn)),
    });
  },

  async revoke(id: string): Promise<void> {
    return req<void>(`/api-keys/${encodeURIComponent(id)}/revoke`, { method: 'POST' });
  },
};
