/**
 * Layouts do Jolt no servidor (`/api/jolt/projects`), no lugar do navegador. Cada layout é um projeto Jolt privado
 * da pessoa: nome, URL de origem, spec e última entrada. O JWT vai pelo `authFetch`; quem é o autor sai do token.
 */
import { authFetch } from '@/lib/auth-client';
import { ensureOk } from '@/lib/ceremony-api';
import { API_BASE_URL } from '@/lib/home-api';
import { readLayouts, removeKey, layoutsKey, writeLayouts, type SavedLayout } from '@/lib/jolt-storage';

interface JoltProjectApi {
  id: string;
  name: string;
  apiUrl: string | null;
  specJson: string | null;
  inputJson: string | null;
  authorId: string;
  authorName: string | null;
  version: number | null;
  updatedAt: string | null;
}

export interface LayoutInput {
  name: string;
  apiUrl: string;
  joltSpec: string;
  lastInput: string;
}

const BASE = `${API_BASE_URL}/jolt/projects`;
const JSON_HEADERS = { 'Content-Type': 'application/json' };

export function layoutFromApi(p: JoltProjectApi): SavedLayout {
  return {
    id: p.id,
    name: p.name,
    apiUrl: p.apiUrl ?? '',
    joltSpec: p.specJson ?? '',
    lastInput: p.inputJson ?? '',
    updatedAt: p.updatedAt ?? '',
    toolType: 'jolt',
    creatorId: p.authorId,
    authorName: p.authorName ?? undefined,
    version: p.version ?? undefined,
  };
}

function bodyOf(input: LayoutInput, expectedVersion?: number): string {
  return JSON.stringify({
    name: input.name,
    apiUrl: input.apiUrl,
    specJson: input.joltSpec,
    inputJson: input.lastInput,
    isPublic: false,
    ...(expectedVersion !== undefined ? { expectedVersion } : {}),
  });
}

/** Só os layouts da própria pessoa (a API também devolve os públicos e os da squad). */
export async function listLayouts(userId: string): Promise<SavedLayout[]> {
  const res = await authFetch(BASE);
  await ensureOk(res, 'Não foi possível carregar os seus layouts.');
  const data = (await res.json()) as JoltProjectApi[];
  return data.filter((p) => p.authorId === userId).map(layoutFromApi);
}

export async function createLayout(input: LayoutInput): Promise<SavedLayout> {
  const res = await authFetch(BASE, { method: 'POST', headers: JSON_HEADERS, body: bodyOf(input) });
  await ensureOk(res, 'Não foi possível salvar o layout.');
  return layoutFromApi((await res.json()) as JoltProjectApi);
}

/** `expectedVersion`: a versão que a tela carregou; se outra aba salvou antes, o servidor recusa (409) em vez de sobrescrever. */
export async function updateLayout(id: string, input: LayoutInput, expectedVersion?: number): Promise<SavedLayout> {
  const res = await authFetch(`${BASE}/${encodeURIComponent(id)}`, { method: 'PUT', headers: JSON_HEADERS, body: bodyOf(input, expectedVersion) });
  await ensureOk(res, 'Não foi possível salvar o layout.');
  return layoutFromApi((await res.json()) as JoltProjectApi);
}

export async function deleteLayout(id: string): Promise<void> {
  const res = await authFetch(`${BASE}/${encodeURIComponent(id)}`, { method: 'DELETE' });
  await ensureOk(res, 'Não foi possível excluir o layout.');
}

/**
 * Layouts que a pessoa guardou neste navegador antes de existir o servidor: sobem uma vez e a cópia local sai.
 * Cada layout sai da cópia local assim que sobe, para uma falha no meio não duplicar os que já subiram na próxima
 * abertura; os que faltam ficam para ela. Devolve quantos subiram.
 */
export async function importLocalLayouts(userId: string): Promise<number> {
  const local = readLayouts(userId);
  if (local.length === 0) return 0;
  let sent = 0;
  for (const l of local) {
    try {
      await createLayout({ name: l.name || 'Layout sem nome', apiUrl: l.apiUrl, joltSpec: l.joltSpec, lastInput: l.lastInput });
    } catch {
      return sent; // para no primeiro erro
    }
    sent += 1;
    const remaining = local.slice(sent);
    if (remaining.length === 0) removeKey(layoutsKey(userId));
    else writeLayouts(userId, remaining);
  }
  return sent;
}
