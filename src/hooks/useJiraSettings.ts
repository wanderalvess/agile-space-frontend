'use client';

import { useState, useEffect } from 'react';
import { useUserContext } from '@/context/UserContext';
import { userApi } from '@/app/users/api';

export interface JiraSettings {
  domain: string;
  token: string;
}

/** Chave localStorage com escopo de usuário — única fonte de verdade no browser. */
function localKey(userId: string): string {
  return `agile_jira_config_${userId}`;
}

/** Migra dados do slot genérico legado (sem userId) para o slot com userId, se existir. */
function migrateLegacySlot(userId: string): void {
  if (typeof window === 'undefined') return;
  try {
    const legacyKey = 'agileSpace_jira_config';
    const legacy = localStorage.getItem(legacyKey);
    if (legacy && !localStorage.getItem(localKey(userId))) {
      localStorage.setItem(localKey(userId), legacy);
    }
    localStorage.removeItem(legacyKey);
  } catch {}
}

export async function getJiraCredentials(userId: string): Promise<{ domain: string; token: string } | null> {
  if (!userId) return null;
  // 1. Check localStorage (slot com userId — único slot usado)
  if (typeof window !== 'undefined') {
    try {
      migrateLegacySlot(userId);
      const local = localStorage.getItem(localKey(userId));
      if (local) {
        const parsed = JSON.parse(local);
        if (parsed.domain && parsed.token) return parsed;
      }
    } catch {}
  }
  // 2. Check userApi (Spring Boot)
  try {
    const config = await userApi.getJiraConfig(userId);
    if (config?.domain && config?.token) {
      return { domain: config.domain, token: config.token };
    }
  } catch {}
  return null;
}

export function useJiraSettings() {
  const { userProfile } = useUserContext();
  const userId = userProfile?.id || userProfile?.email;
  const [settings, setSettings] = useState<JiraSettings | null>(() => {
    if (typeof window !== 'undefined' && userId) {
      try {
        migrateLegacySlot(userId);
        const local = localStorage.getItem(localKey(userId));
        if (local) return JSON.parse(local);
      } catch {}
    }
    return null;
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId) {
      setLoading(false);
      return;
    }

    let isMounted = true;
    async function loadSettings() {
      // 1. Migra slot legado e lê slot com userId
      if (typeof window !== 'undefined') {
        try {
          migrateLegacySlot(userId!);
          const cached = localStorage.getItem(localKey(userId!));
          if (cached) {
            const parsed = JSON.parse(cached);
            if (parsed.domain && parsed.token && isMounted) {
              setSettings(parsed);
            }
          }
        } catch {}
      }

      // 2. Fetch from backend API
      try {
        const config = await userApi.getJiraConfig(userId!);
        if (config && config.domain && config.token && isMounted) {
          const s = {
            domain: config.domain || '',
            token: config.token || ''
          };
          setSettings(s);
          if (typeof window !== 'undefined') {
            // Salva apenas no slot com userId
            localStorage.setItem(localKey(userId!), JSON.stringify(s));
          }
        }
      } catch (err) {
        console.error('Erro ao carregar configurações do Jira:', err);
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    loadSettings();
    return () => { isMounted = false; };
  }, [userId]);

  const saveSettings = async (newSettings: JiraSettings) => {
    if (!userId) return;
    const cleanSettings = {
      domain: newSettings.domain.trim().replace(/^https?:\/\//i, '').replace(/\/+$/, ''),
      token: newSettings.token.trim()
    };

    setSettings(cleanSettings);
    if (typeof window !== 'undefined') {
      try {
        // Salva apenas no slot com userId
        localStorage.setItem(localKey(userId), JSON.stringify(cleanSettings));
      } catch {}
    }

    try {
      await userApi.saveJiraConfig(userId, {
        userId,
        domain: cleanSettings.domain,
        token: cleanSettings.token
      });
    } catch (err) {
      console.warn('Erro ao salvar configurações do Jira no backend:', err);
    }
  };

  return { settings, loading, saveSettings };
}
