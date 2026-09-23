'use client';

/**
 * Conexão com o Google Calendar via Google Identity Services (GIS) token client,
 * client-side, sem tocar no fluxo de login do Espaço Ágil (que continua e-mail/senha).
 *
 * Guarda só o essencial no localStorage — um flag por usuário dizendo que ele já
 * consentiu — pra tentar recuperar o access token em silêncio (`prompt: ''`) na
 * próxima visita. O access token em si NUNCA é persistido: vive só em memória
 * (state) e expira em ~1h, junto com a aba.
 *
 * Requer NEXT_PUBLIC_GOOGLE_CLIENT_ID (OAuth Client ID "Aplicativo da Web", app
 * interno no Workspace, ver .env.example). Sem essa env var, `isConfigured` é
 * false e nada aqui tenta carregar o script do Google.
 */

import { useCallback, useEffect, useRef, useState } from 'react';

const GIS_SCRIPT_SRC = 'https://accounts.google.com/gsi/client';
const CALENDAR_READONLY_SCOPE = 'https://www.googleapis.com/auth/calendar.readonly';
const CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || '';

// Renova o token um pouco antes de expirar de verdade.
const REFRESH_SAFETY_MARGIN_MS = 60_000;

declare global {
  interface Window {
    google?: {
      accounts: {
        oauth2: {
          initTokenClient: (config: {
            client_id: string;
            scope: string;
            callback: (resp: TokenResponse) => void;
            error_callback?: (err: { type: string }) => void;
          }) => { requestAccessToken: (opts?: { prompt?: string }) => void };
        };
      };
    };
  }
}

interface TokenResponse {
  access_token?: string;
  expires_in?: number; // segundos
  error?: string;
}

let gisScriptPromise: Promise<void> | null = null;

function loadGisScript(): Promise<void> {
  if (typeof window === 'undefined') return Promise.reject(new Error('sem window'));
  if (window.google?.accounts?.oauth2) return Promise.resolve();
  if (gisScriptPromise) return gisScriptPromise;

  gisScriptPromise = new Promise((resolve, reject) => {
    const existing = document.querySelector(`script[src="${GIS_SCRIPT_SRC}"]`);
    if (existing) {
      existing.addEventListener('load', () => resolve());
      existing.addEventListener('error', () => reject(new Error('Falha ao carregar o script do Google')));
      return;
    }
    const script = document.createElement('script');
    script.src = GIS_SCRIPT_SRC;
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Falha ao carregar o script do Google'));
    document.head.appendChild(script);
  });

  return gisScriptPromise;
}

function storageKey(userKey: string) {
  return `agileSpace_googleCalendarConnected_${userKey}`;
}

export interface GoogleCalendarConnection {
  /** false quando NEXT_PUBLIC_GOOGLE_CLIENT_ID não está definida — o card deve ficar oculto. */
  isConfigured: boolean;
  isConnected: boolean;
  isConnecting: boolean;
  accessToken: string | null;
  error: string | null;
  connect: () => void;
  disconnect: () => void;
}

/**
 * @param userKey chave estável do usuário (ex: email) usada só pra lembrar,
 *   por navegador, que ele já consentiu antes — não é o token em si.
 */
export function useGoogleCalendarConnection(userKey: string): GoogleCalendarConnection {
  const isConfigured = !!CLIENT_ID;

  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasStoredConsent, setHasStoredConsent] = useState(false);

  const tokenClientRef = useRef<{ requestAccessToken: (opts?: { prompt?: string }) => void } | null>(null);
  const refreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const silentAttemptedRef = useRef(false);
  // O callback do GIS é único por token client e não recebe de volta os `opts` da
  // chamada que o disparou — este ref marca se a requisição em voo foi silenciosa
  // (`prompt: ''`), pra não mostrar erro visível quando ela falhar.
  const pendingIsSilentRef = useRef(false);

  const clearRefreshTimer = useCallback(() => {
    if (refreshTimerRef.current) {
      clearTimeout(refreshTimerRef.current);
      refreshTimerRef.current = null;
    }
  }, []);

  const handleTokenResponse = useCallback(
    (resp: TokenResponse) => {
      const wasSilent = pendingIsSilentRef.current;
      pendingIsSilentRef.current = false;
      setIsConnecting(false);
      if (!resp.access_token) {
        // Falha silenciosa (ex: sessão do Google expirada) não deve virar erro visível —
        // o usuário só vê o botão de conectar de novo.
        if (!wasSilent) {
          setError(resp.error || 'Não foi possível conectar com o Google Calendar.');
        }
        return;
      }
      setError(null);
      setAccessToken(resp.access_token);
      if (userKey) {
        try {
          localStorage.setItem(storageKey(userKey), '1');
        } catch {
          /* modo privado / storage bloqueado: reconecta manualmente na próxima vez */
        }
      }

      clearRefreshTimer();
      const expiresInMs = (resp.expires_in || 3300) * 1000;
      const delay = Math.max(expiresInMs - REFRESH_SAFETY_MARGIN_MS, 10_000);
      refreshTimerRef.current = setTimeout(() => {
        pendingIsSilentRef.current = true;
        tokenClientRef.current?.requestAccessToken({ prompt: '' });
      }, delay);
    },
    [clearRefreshTimer, userKey]
  );

  const ensureTokenClient = useCallback(async () => {
    if (!isConfigured) return null;
    await loadGisScript();
    if (!tokenClientRef.current && window.google?.accounts?.oauth2) {
      tokenClientRef.current = window.google.accounts.oauth2.initTokenClient({
        client_id: CLIENT_ID,
        scope: CALENDAR_READONLY_SCOPE,
        callback: (resp) => handleTokenResponse(resp),
        error_callback: () => {
          const wasSilent = pendingIsSilentRef.current;
          pendingIsSilentRef.current = false;
          setIsConnecting(false);
          if (!wasSilent) {
            setError('Você fechou a janela de consentimento do Google antes de terminar.');
          }
        },
      });
    }
    return tokenClientRef.current;
  }, [handleTokenResponse, isConfigured]);

  const connect = useCallback(() => {
    if (!isConfigured) return;
    setError(null);
    setIsConnecting(true);
    ensureTokenClient()
      .then((client) => client?.requestAccessToken({ prompt: 'consent' }))
      .catch((err) => {
        setIsConnecting(false);
        setError(err?.message || 'Não foi possível carregar o Google Identity Services.');
      });
  }, [ensureTokenClient, isConfigured]);

  const disconnect = useCallback(() => {
    clearRefreshTimer();
    setAccessToken(null);
    setError(null);
    if (userKey) {
      try {
        localStorage.removeItem(storageKey(userKey));
      } catch {
        /* ignora */
      }
    }
  }, [clearRefreshTimer, userKey]);

  // Descobre se o usuário já consentiu antes (por navegador).
  useEffect(() => {
    if (!userKey) return;
    try {
      setHasStoredConsent(localStorage.getItem(storageKey(userKey)) === '1');
    } catch {
      setHasStoredConsent(false);
    }
  }, [userKey]);

  // Tenta recuperar o token em silêncio uma única vez, se já houve consentimento antes.
  useEffect(() => {
    if (!isConfigured || !hasStoredConsent || silentAttemptedRef.current || accessToken) return;
    silentAttemptedRef.current = true;
    ensureTokenClient()
      .then((client) => {
        pendingIsSilentRef.current = true;
        client?.requestAccessToken({ prompt: '' });
      })
      .catch(() => {
        /* sem token silencioso, o usuário reconecta manualmente */
      });
  }, [accessToken, ensureTokenClient, hasStoredConsent, isConfigured]);

  useEffect(() => () => clearRefreshTimer(), [clearRefreshTimer]);

  return {
    isConfigured,
    isConnected: !!accessToken,
    isConnecting,
    accessToken,
    error,
    connect,
    disconnect,
  };
}
