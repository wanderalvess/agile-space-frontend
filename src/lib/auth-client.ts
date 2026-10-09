export const TOKEN_STORAGE_KEY = 'agileSpace_auth_token';
const LAST_USER_STORAGE_KEY = 'agileSpace_lastUserId';
/** Chaves do localStorage que descrevem a sessão de UMA pessoa (equipe ativa, perfil em cache, fluxo de onboarding). */
const USER_SCOPED_KEYS = [
  'agileSpace_guest_profile',
  'agileSpace_public_exploration',
  'agileSpace_activeSquadId',
  'agileSpace_justSignedUp',
  'agileSpace_jiraSync_projectKey',
  'agileSpace_projectEstimationUnit',
];
const USER_SCOPED_PREFIXES = ['favorites_', 'agileSpace_newSquad_', 'agileSpace_estimationUnit_'];
export const UNAUTHORIZED_EVENT = 'agile-space:unauthorized';

export interface AuthResponse {
  token: string;
  tokenType: string;
  expiresIn: number;
  id: string;
  email: string;
  name: string;
  role: string;
  authProvider: string;
  jiraAccountId?: string;
  avatarSeed?: string;
  activeProjectId?: string;
  activeProjectName?: string;
  activeProjectRole?: string;
  segmentName?: string;
  tribeName?: string;
  transversalLeader: boolean;
  accessibleProjects: Array<{
    projectId: string;
    projectName: string;
    segmentName?: string;
    tribeName?: string;
    roleName?: string;
    roleKey?: string;
    directAssignment: boolean;
    leadership: boolean;
  }>;
}

/** Lê o `sub` (id da conta) do JWT só para comparar sessões entre abas; não valida assinatura. */
export function tokenUserId(token: string | null | undefined): string | null {
  if (!token) return null;
  try {
    const payload = token.split('.')[1];
    if (!payload) return null;
    const json = atob(payload.replace(/-/g, '+').replace(/_/g, '/'));
    const sub = JSON.parse(json)?.sub;
    return typeof sub === 'string' ? sub : null;
  } catch {
    return null;
  }
}

export function getAuthToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(TOKEN_STORAGE_KEY);
}

export function setAuthToken(token: string) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(TOKEN_STORAGE_KEY, token);
}

export function clearAuthToken() {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(TOKEN_STORAGE_KEY);
}

/**
 * Apaga o que o navegador guardou sobre a pessoa que estava logada (equipe ativa, perfil em cache...),
 * para que a próxima conta no mesmo navegador não herde nada. Preferências do aparelho (tema, som) ficam.
 */
export function clearUserScopedStorage() {
  if (typeof window === 'undefined') return;
  try {
    const toRemove: string[] = [...USER_SCOPED_KEYS, LAST_USER_STORAGE_KEY];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && USER_SCOPED_PREFIXES.some((prefix) => key.startsWith(prefix))) toRemove.push(key);
    }
    toRemove.forEach((key) => localStorage.removeItem(key));
  } catch {
    /* storage indisponível (modo privado): nada a limpar */
  }
}

/**
 * Chamado depois de um login/cadastro: se quem entrou não é quem usou o navegador por último,
 * descarta o que sobrou da conta anterior antes de a nova sessão ser montada.
 */
export function rememberSessionUser(userId: string) {
  if (typeof window === 'undefined') return;
  try {
    const previous = localStorage.getItem(LAST_USER_STORAGE_KEY);
    if (previous && previous !== userId) clearUserScopedStorage();
    localStorage.setItem(LAST_USER_STORAGE_KEY, userId);
  } catch {
    /* storage indisponível */
  }
}

/**
 * Drop-in replacement para `fetch` que injeta o Bearer token da sessão.
 * Em 401 (token ausente/expirado), dispara UNAUTHORIZED_EVENT para o AuthProvider
 * limpar a sessão e redirecionar ao /login.
 */
export async function authFetch(input: RequestInfo | URL, init: RequestInit = {}): Promise<Response> {
  const token = getAuthToken();
  const headers = new Headers(init.headers);
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }
  // fetch só define Content-Type sozinho para alguns tipos de body (Blob, FormData,
  // URLSearchParams); uma string (JSON.stringify) cai em text/plain por padrão e o
  // Spring rejeita com 415. FormData fica de fora aqui pois precisa do boundary
  // multipart que o próprio fetch calcula — setar o header à mão quebraria o upload.
  if (init.body && !(init.body instanceof FormData) && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  const response = await fetch(input, { ...init, headers });

  if (response.status === 401 && typeof window !== 'undefined') {
    window.dispatchEvent(new Event(UNAUTHORIZED_EVENT));
  }

  return response;
}
