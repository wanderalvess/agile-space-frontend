export interface FetchOptions extends RequestInit {
  retries?: number;
  retryDelay?: number;
  timeout?: number;
}

export class ApiError extends Error {
  status: number;
  data: any;

  constructor(status: number, message: string, data?: any) {
    super(message);
    this.status = status;
    this.data = data;
    this.name = 'ApiError';
  }
}

const DEFAULT_RETRIES = 3;
const DEFAULT_RETRY_DELAY = 1000;
const DEFAULT_TIMEOUT = 10000;

export async function fetchWithRetry(url: string, options: FetchOptions = {}): Promise<Response> {
  const {
    retries = DEFAULT_RETRIES,
    retryDelay = DEFAULT_RETRY_DELAY,
    timeout = DEFAULT_TIMEOUT,
    ...fetchOptions
  } = options;

  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const controller = new AbortController();
      const id = setTimeout(() => controller.abort(), timeout);

      const response = await fetch(url, {
        ...fetchOptions,
        signal: controller.signal,
      });

      clearTimeout(id);

      if (response.status === 401 || response.status === 403) {
        throw new ApiError(response.status, 'Sessão expirada ou acesso negado. Faça login novamente.');
      }

      if (response.status >= 500 || response.status === 429) {
        if (attempt < retries) {
          const delay = retryDelay * Math.pow(2, attempt);
          await new Promise(resolve => setTimeout(resolve, delay));
          continue;
        }
        throw new ApiError(response.status, `Erro no servidor (${response.status}). Falha após ${retries + 1} tentativas.`);
      }

      if (!response.ok) {
        let errorData;
        try {
          errorData = await response.json();
        } catch {
          errorData = null;
        }
        throw new ApiError(response.status, errorData?.message || `Erro na requisição (${response.status})`, errorData);
      }

      return response;

    } catch (error: any) {
      lastError = error;
      
      if (error.name === 'AbortError' || error.message?.includes('fetch') || error.message?.includes('Network')) {
        if (attempt < retries) {
          const delay = retryDelay * Math.pow(2, attempt);
          await new Promise(resolve => setTimeout(resolve, delay));
          continue;
        }
        throw new ApiError(0, `Falha de rede ou timeout. O servidor não respondeu.`);
      }
      
      throw error;
    }
  }

  throw lastError;
}

export async function req<T>(url: string, options?: FetchOptions): Promise<T> {
  const response = await fetchWithRetry(url, {
    headers: { 'Content-Type': 'application/json', ...options?.headers },
    ...options,
  });

  if (response.status === 204) return undefined as T;
  
  const contentType = response.headers.get('content-type');
  if (contentType && contentType.includes('application/json')) {
    return response.json();
  }
  
  return response.text() as unknown as T;
}
