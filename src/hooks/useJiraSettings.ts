import { useState, useEffect } from 'react';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { useFirebase } from '@/firebase/provider';

export interface JiraSettings {
  domain: string;
  token: string;
}

export function useJiraSettings() {
  const { firestore, user } = useFirebase();
  const [settings, setSettings] = useState<JiraSettings | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Reseta imediatamente ao trocar de usuário para não deixar
    // token/domínio da conta anterior visíveis na UI durante o carregamento.
    setSettings(null);
    setLoading(true);

    async function loadSettings() {
      if (!user || !firestore) {
        setLoading(false);
        return;
      }

      try {
        const ref = doc(firestore, 'users', user.uid, 'config', 'jira');
        const snap = await getDoc(ref);
        if (snap.exists()) {
          setSettings(snap.data() as JiraSettings);
        }
      } catch (err) {
        console.error('Erro ao carregar configurações do Jira:', err);
      } finally {
        setLoading(false);
      }
    }

    loadSettings();
  }, [user, firestore]);

  const saveSettings = async (newSettings: JiraSettings) => {
    if (!user || !firestore) return;

    try {
      const ref = doc(firestore, 'users', user.uid, 'config', 'jira');
      await setDoc(ref, newSettings, { merge: true });
      setSettings(newSettings);
    } catch (err) {
      console.error('Erro ao salvar configurações do Jira:', err);
      throw err;
    }
  };

  return { settings, loading, saveSettings };
}
