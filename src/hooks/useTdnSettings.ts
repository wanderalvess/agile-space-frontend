'use client';

import { useState, useEffect } from 'react';
import { useUserContext } from '@/context/UserContext';
import { userApi } from '@/app/users/api';

export interface TdnSettings {
  baseUrl: string;
  token: string;
  space?: string;
  label?: string;
}

export function useTdnSettings() {
  const { userProfile } = useUserContext();
  const userId = userProfile?.id;
  const [settings, setSettings] = useState<TdnSettings | null>(null);
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
        const config = await userApi.getTdnConfig(userId);
        if (config) {
          setSettings({
            baseUrl: config.baseUrl || '',
            token: config.token || '',
            space: config.space || '',
            label: config.label || ''
          });
        }
      } catch (err) {
        console.error('Erro ao carregar configurações do TDN:', err);
      } finally {
        setLoading(false);
      }
    }

    loadSettings();
  }, [userId]);

  const saveSettings = async (newSettings: TdnSettings) => {
    if (!userId) return;

    try {
      const saved = await userApi.saveTdnConfig(userId, {
        userId,
        baseUrl: newSettings.baseUrl,
        token: newSettings.token,
        space: newSettings.space,
        label: newSettings.label
      });
      setSettings({
        baseUrl: saved.baseUrl,
        token: saved.token,
        space: saved.space,
        label: saved.label
      });
    } catch (err) {
      console.error('Erro ao salvar configurações do TDN:', err);
      throw err;
    }
  };

  return { settings, loading, saveSettings };
}
