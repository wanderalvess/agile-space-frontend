'use client';

import { useState, useEffect } from 'react';
import { useUserContext } from '@/context/UserContext';
import { userApi } from '@/app/users/api';

export interface JiraSettings {
  domain: string;
  token: string;
}

export function useJiraSettings() {
  const { userProfile } = useUserContext();
  const userId = userProfile?.id;
  const [settings, setSettings] = useState<JiraSettings | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Reseta ao trocar de perfil de usuário
    setSettings(null);
    setLoading(true);

    async function loadSettings() {
      if (!userId) {
        setLoading(false);
        return;
      }

      try {
        const config = await userApi.getJiraConfig(userId);
        if (config) {
          setSettings({
            domain: config.domain || '',
            token: config.token || ''
          });
        }
      } catch (err) {
        console.error('Erro ao carregar configurações do Jira:', err);
      } finally {
        setLoading(false);
      }
    }

    loadSettings();
  }, [userId]);

  const saveSettings = async (newSettings: JiraSettings) => {
    if (!userId) return;

    try {
      const saved = await userApi.saveJiraConfig(userId, {
        userId,
        domain: newSettings.domain,
        token: newSettings.token
      });
      setSettings({
        domain: saved.domain,
        token: saved.token
      });
    } catch (err) {
      console.error('Erro ao salvar configurações do Jira:', err);
      throw err;
    }
  };

  return { settings, loading, saveSettings };
}
