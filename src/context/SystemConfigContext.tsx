'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { useFirebase } from '@/firebase';

interface SystemConfig {
  companyName: string;
  primaryColor: string;
  logoUrl: string;
  allowAnonymous: boolean;
  maintenanceMode: boolean;
}

interface SystemConfigContextType {
  config: SystemConfig;
  isLoading: boolean;
}

const SystemConfigContext = createContext<SystemConfigContextType | undefined>(undefined);

const DEFAULT_CONFIG: SystemConfig = {
  companyName: 'Espaço Ágil',
  primaryColor: '24 93% 53%',
  logoUrl: '',
  allowAnonymous: true,
  maintenanceMode: false
};

export function SystemConfigProvider({ children }: { children: ReactNode }) {
  const { firestore } = useFirebase();
  const [config, setConfig] = useState<SystemConfig>(DEFAULT_CONFIG);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!firestore) return;

    const unsubscribe = onSnapshot(doc(firestore, 'system_configs', 'global'), (snap) => {
      if (snap.exists()) {
        const data = snap.data() as SystemConfig;
        setConfig(data);
        applyTheme(data);
      }
      setIsLoading(false);
    }, (error) => {
      console.error("SystemConfigProvider: Error fetching configs:", error);
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, [firestore]);

  const applyTheme = (data: SystemConfig) => {
    if (typeof window === 'undefined') return;
    
    const root = document.documentElement;
    
    // Aplicar Cor Primária (HSL)
    if (data.primaryColor) {
      root.style.setProperty('--primary', data.primaryColor);
    }
    
    // Atualizar Título da Página Dinamicamente (Opcional)
    if (data.companyName) {
      document.title = `${data.companyName} | Gestão Ágil`;
    }
  };

  return (
    <SystemConfigContext.Provider value={{ config, isLoading }}>
      {children}
    </SystemConfigContext.Provider>
  );
}

export const useSystemConfig = () => {
  const context = useContext(SystemConfigContext);
  if (context === undefined) {
    throw new Error('useSystemConfig must be used within a SystemConfigProvider');
  }
  return context;
};
