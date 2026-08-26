'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

export type ThemeMode = 'light' | 'dark';
export type ThemeVariant = 'default' | 'nebula' | 'cyberpunk' | 'midnight' | 'nordic';

interface ThemeContextType {
  mode: ThemeMode;
  variant: ThemeVariant;
  setMode: (mode: ThemeMode) => void;
  setVariant: (variant: ThemeVariant) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [mode, setModeState] = useState<ThemeMode>('light');
  const [variant, setVariantState] = useState<ThemeVariant>('default');
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    // Read initial theme and variant from localStorage (safe on client side)
    const savedTheme = localStorage.getItem('theme') as ThemeMode | null;
    const savedVariant = localStorage.getItem('theme-variant') as ThemeVariant | null;

    if (savedTheme) {
      setModeState(savedTheme);
    } else if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
      setModeState('dark');
    }

    if (savedVariant) {
      setVariantState(savedVariant);
    }

    setMounted(true);
  }, []);

  const setMode = (newMode: ThemeMode) => {
    setModeState(newMode);
    localStorage.setItem('theme', newMode);
    applyThemeClasses(newMode, variant);
  };

  const setVariant = (newVariant: ThemeVariant) => {
    setVariantState(newVariant);
    localStorage.setItem('theme-variant', newVariant);
    applyThemeClasses(mode, newVariant);
  };

  const applyThemeClasses = (currentMode: ThemeMode, currentVariant: ThemeVariant) => {
    if (typeof window === 'undefined') return;

    const root = document.documentElement;

    // Apply base mode (light/dark)
    if (currentMode === 'dark') {
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
      applyThemeClasses(mode, variant);
    }
  }, [mounted, mode, variant]);

  return (
    <ThemeContext.Provider value={{ mode, variant, setMode, setVariant }}>
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
