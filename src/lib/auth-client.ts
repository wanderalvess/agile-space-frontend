const TOKEN_STORAGE_KEY = 'agileSpace_auth_token';
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
  isTransversalLeader: boolean;
  accessibleProjects: Array<{
    projectId: string;
    projectName: string;
    segmentName?: string;
    tribeName?: string;
    roleName?: string;
    roleKey?: string;
    isDirectAssignment: boolean;
    isLeadership: boolean;
  }>;
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
