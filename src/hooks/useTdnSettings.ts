import { useState, useEffect } from 'react';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { useFirebase } from '@/firebase';

export interface TdnSettings {
  baseUrl: string;
  token: string;
  space?: string;
  label?: string;
}

export function useTdnSettings() {
  const { firestore, user } = useFirebase();
  const [settings, setSettings] = useState<TdnSettings | null>(null);
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
        const ref = doc(firestore, 'users', user.uid, 'config', 'tdn');
        const snap = await getDoc(ref);
        if (snap.exists()) {
          setSettings(snap.data() as TdnSettings);
        }
      } catch (err) {
        console.error('Erro ao carregar configurações do TDN:', err);
      } finally {
        setLoading(false);
      }
    }

    loadSettings();
  }, [user, firestore]);

  const saveSettings = async (newSettings: TdnSettings) => {
    if (!user || !firestore) return;

    try {
      const ref = doc(firestore, 'users', user.uid, 'config', 'tdn');
      await setDoc(ref, newSettings, { merge: true });
      setSettings(newSettings);
    } catch (err) {
      console.error('Erro ao salvar configurações do TDN:', err);
      throw err;
        }
    };

    return { settings, loading, saveSettings };
}
