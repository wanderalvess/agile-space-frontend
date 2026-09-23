'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

export type ThemeMode = 'light' | 'dark' | 'system';
export type ResolvedThemeMode = 'light' | 'dark';
export type ThemeVariant = 'default' | 'nebula' | 'cyberpunk' | 'midnight' | 'nordic';

interface ThemeContextType {
  mode: ThemeMode;
  /** Aparência realmente aplicada ('system' já resolvido para light/dark) */
  resolvedMode: ResolvedThemeMode;
  variant: ThemeVariant;
  setMode: (mode: ThemeMode) => void;
  setVariant: (variant: ThemeVariant) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

const getSystemPreference = (): ResolvedThemeMode =>
  typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches
    ? 'dark'
    : 'light';

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [mode, setModeState] = useState<ThemeMode>('system');
  const [resolvedMode, setResolvedMode] = useState<ResolvedThemeMode>('light');
  const [variant, setVariantState] = useState<ThemeVariant>('default');
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    // Read initial theme and variant from localStorage (safe on client side)
    const savedTheme = (localStorage.getItem('theme') as ThemeMode | null) || 'system';
    const savedVariant = localStorage.getItem('theme-variant') as ThemeVariant | null;

    setModeState(savedTheme);
    setResolvedMode(savedTheme === 'system' ? getSystemPreference() : savedTheme);

    if (savedVariant) {
      setVariantState(savedVariant);
    }

    setMounted(true);
  }, []);

  // Enquanto o modo 'system' estiver ativo, acompanha mudanças de claro/escuro do SO em tempo real.
  // O guard `mounted` evita rodar com o placeholder 'system' antes da preferência salva ser lida acima.
  useEffect(() => {
    if (!mounted || mode !== 'system' || typeof window === 'undefined') return;

    const mql = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = (e: MediaQueryListEvent) => setResolvedMode(e.matches ? 'dark' : 'light');

    mql.addEventListener('change', handleChange);
    return () => mql.removeEventListener('change', handleChange);
  }, [mounted, mode]);

  const setMode = (newMode: ThemeMode) => {
    setModeState(newMode);
    localStorage.setItem('theme', newMode);
    const nextResolved = newMode === 'system' ? getSystemPreference() : newMode;
    setResolvedMode(nextResolved);
    applyThemeClasses(nextResolved, variant);
  };

  const setVariant = (newVariant: ThemeVariant) => {
    setVariantState(newVariant);
    localStorage.setItem('theme-variant', newVariant);
    applyThemeClasses(resolvedMode, newVariant);
  };

  const applyThemeClasses = (currentResolvedMode: ResolvedThemeMode, currentVariant: ThemeVariant) => {
    if (typeof window === 'undefined') return;

    const root = document.documentElement;

    // Apply base mode (light/dark)
    if (currentResolvedMode === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }

    // List of all variants to clean up
    const variants: ThemeVariant[] = ['default', 'nebula', 'cyberpunk', 'midnight', 'nordic'];
    
    // Remove all variant classes
    variants.forEach((v) => {
      root.classList.remove(`theme-${v}`);
    });

    // Add current variant class
    root.classList.add(`theme-${currentVariant}`);

    // Clean any inline overrides so class tokens apply seamlessly
    if (currentVariant !== 'default') {
      root.style.removeProperty('--primary');
      root.style.removeProperty('--ring');
    }
  };

  // Sync classes on initial mount
  useEffect(() => {
    if (mounted) {
      applyThemeClasses(resolvedMode, variant);
    }
  }, [mounted, resolvedMode, variant]);

  return (
    <ThemeContext.Provider value={{ mode, resolvedMode, variant, setMode, setVariant }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}
