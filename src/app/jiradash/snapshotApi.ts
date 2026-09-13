import { authFetch } from '@/lib/auth-client';

// Cache compartilhado do JiraDash: o backend guarda o último resultado de
// cada JQL, pra abrir a tela não bater no Jira toda vez — só quem clica
// "Atualizar" busca de verdade. Ver plano em memória/AGENTS para o porquê da
// chave ser a JQL (o "squad" do JiraDash é só um agrupamento local, sem
// identidade compartilhada entre navegadores).
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8002/api';

export interface JiraDashSnapshot {
  id: string;
  jql: string;
  payload: unknown;
  fetchedAt: string | null;
  fetchedByUserId: string | null;
  fetchedByName: string | null;
}

export async function getSnapshot(jql: string): Promise<JiraDashSnapshot | null> {
  const res = await authFetch(`${API_BASE_URL}/jiradash/snapshot?jql=${encodeURIComponent(jql)}`);
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`GET snapshot ${res.status}`);
  return res.json();
}

export async function saveSnapshot(jql: string, payload: unknown): Promise<JiraDashSnapshot> {
  const res = await authFetch(`${API_BASE_URL}/jiradash/snapshot`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jql, payload }),
  });
  if (!res.ok) throw new Error(`POST snapshot ${res.status}`);
  return res.json();
}
