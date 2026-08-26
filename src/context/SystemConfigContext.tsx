'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { publicApi } from '@/app/admin/api';

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
  primaryColor: '',
  logoUrl: '',
  allowAnonymous: true,
  maintenanceMode: false
};

export function SystemConfigProvider({ children }: { children: ReactNode }) {
  const [config, setConfig] = useState<SystemConfig>(DEFAULT_CONFIG);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const configs = await publicApi.getSystemConfig();

        if (cancelled) return;

        const data: SystemConfig = {
          companyName: configs.companyName || DEFAULT_CONFIG.companyName,
          primaryColor: configs.primaryColor || '',
          logoUrl: configs.logoUrl || DEFAULT_CONFIG.logoUrl,
          allowAnonymous: configs.allowAnonymous ? configs.allowAnonymous === 'true' : DEFAULT_CONFIG.allowAnonymous,
          maintenanceMode: configs.maintenanceMode ? configs.maintenanceMode === 'true' : DEFAULT_CONFIG.maintenanceMode,
        };

        setConfig(data);
        applyTheme(data);
      } catch (error) {
        console.error("SystemConfigProvider: Error fetching configs:", error);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const applyTheme = (data: SystemConfig) => {
    if (typeof window === 'undefined') return;

    const root = document.documentElement;
    const currentVariant = localStorage.getItem('theme-variant') || 'default';

    // Se o usuário estiver usando um tema com variante (Nebula, Cyberpunk, Midnight, Nordic),
    // NUNCA sobrescrever com estilo inline a cor primária para não anular a classe do tema!
    if (currentVariant !== 'default') {
      root.style.removeProperty('--primary');
      root.style.removeProperty('--ring');
    } else if (data.primaryColor && data.primaryColor.trim() !== '') {
      root.style.setProperty('--primary', data.primaryColor);
    } else {
      root.style.removeProperty('--primary');
    }

    // Atualizar Título da Página Dinamicamente (Opcional)
    if (data.companyName && data.companyName !== 'Espaço Ágil') {
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
