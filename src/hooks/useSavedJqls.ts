'use client';

import { useState, useEffect, useCallback } from 'react';
import { useUserContext } from '@/context/UserContext';

export interface SavedJql {
  id: string;
  label: string;
  jql: string;
  isPublic: boolean;
  createdBy?: string;
  createdAt: string;
}

const PUBLIC_KEY = 'agile_jql_presets_public';

function privateKey(userId: string): string {
  return `agile_jql_presets_private_${userId}`;
}

export function useSavedJqls() {
  const { userProfile } = useUserContext();
  const userId = userProfile?.id || userProfile?.email || 'default';
  const userName = userProfile?.name || userProfile?.email || 'Usuário';

  const [savedJqls, setSavedJqls] = useState<SavedJql[]>([]);

  const loadJqls = useCallback(() => {
    if (typeof window === 'undefined') return;

    let publicList: SavedJql[] = [];
    let privateList: SavedJql[] = [];

    try {
      const pubRaw = localStorage.getItem(PUBLIC_KEY);
      if (pubRaw) publicList = JSON.parse(pubRaw);
    } catch (e) {
      console.warn('Erro ao carregar JQLs públicas:', e);
    }

    if (userId) {
      try {
        const privRaw = localStorage.getItem(privateKey(userId));
        if (privRaw) privateList = JSON.parse(privRaw);
      } catch (e) {
        console.warn('Erro ao carregar JQLs privadas:', e);
      }
    }

    const allMap = new Map<string, SavedJql>();
    publicList.forEach(item => allMap.set(item.id, { ...item, isPublic: true }));
    privateList.forEach(item => allMap.set(item.id, { ...item, isPublic: false }));

    setSavedJqls(Array.from(allMap.values()));
  }, [userId]);

  useEffect(() => {
    loadJqls();
  }, [loadJqls]);

  const saveJql = useCallback((preset: { label: string; jql: string; isPublic: boolean }) => {
    if (typeof window === 'undefined') return;

    const newPreset: SavedJql = {
      id: `jql_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      label: preset.label.trim(),
      jql: preset.jql.trim(),
      isPublic: preset.isPublic,
      createdBy: userName,
      createdAt: new Date().toISOString(),
    };

    if (preset.isPublic) {
      try {
        const currentPub: SavedJql[] = JSON.parse(localStorage.getItem(PUBLIC_KEY) || '[]');
        const updated = [newPreset, ...currentPub];
        localStorage.setItem(PUBLIC_KEY, JSON.stringify(updated));
      } catch (e) {
        console.error('Erro ao salvar JQL pública:', e);
      }
    } else {
      if (userId) {
        try {
          const currentPriv: SavedJql[] = JSON.parse(localStorage.getItem(privateKey(userId)) || '[]');
          const updated = [newPreset, ...currentPriv];
          localStorage.setItem(privateKey(userId), JSON.stringify(updated));
        } catch (e) {
          console.error('Erro ao salvar JQL privada:', e);
        }
      }
    }

    loadJqls();
  }, [userId, userName, loadJqls]);

  const deleteJql = useCallback((id: string) => {
    if (typeof window === 'undefined') return;

    const target = savedJqls.find(j => j.id === id);
    if (!target) return;

    if (target.isPublic) {
      try {
        const currentPub: SavedJql[] = JSON.parse(localStorage.getItem(PUBLIC_KEY) || '[]');
        const updated = currentPub.filter(j => j.id !== id);
        localStorage.setItem(PUBLIC_KEY, JSON.stringify(updated));
      } catch (e) {
        console.error('Erro ao deletar JQL pública:', e);
      }
    } else {
      if (userId) {
        try {
          const currentPriv: SavedJql[] = JSON.parse(localStorage.getItem(privateKey(userId)) || '[]');
          const updated = currentPriv.filter(j => j.id !== id);
          localStorage.setItem(privateKey(userId), JSON.stringify(updated));
        } catch (e) {
          console.error('Erro ao deletar JQL privada:', e);
        }
      }
    }

    loadJqls();
  }, [savedJqls, userId, loadJqls]);

  return {
    savedJqls,
    saveJql,
    deleteJql,
  };
}
