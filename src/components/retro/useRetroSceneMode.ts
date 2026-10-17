'use client';

import { useEffect, useState } from 'react';
import { useRoomPreference } from '@/components/room-kit';
import {
  DEFAULT_RETRO_SCENE_MODE,
  RETRO_SCENE_PREF_KEY,
  parseSceneMode,
  resolveSceneMode,
  type RetroSceneMode,
} from './retro-scene-mode';

const LEITURA_CLASS = 'theme-leitura';

/** O tema "Leitura confortável" está ativo? Acompanha a troca de tema (a classe vive no <html>). */
export function useLeituraTheme(): boolean {
  const [leitura, setLeitura] = useState(false);
  useEffect(() => {
    const root = document.documentElement;
    const read = () => setLeitura(root.classList.contains(LEITURA_CLASS));
    read();
    if (typeof MutationObserver === 'undefined') return;
    const observer = new MutationObserver(read);
    observer.observe(root, { attributes: true, attributeFilter: ['class'] });
    return () => observer.disconnect();
  }, []);
  return leitura;
}

/** O sistema pede "reduzir movimento"? */
export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return;
    const mql = window.matchMedia('(prefers-reduced-motion: reduce)');
    const read = () => setReduced(mql.matches);
    read();
    mql.addEventListener?.('change', read);
    return () => mql.removeEventListener?.('change', read);
  }, []);
  return reduced;
}

export interface RetroSceneModeState {
  /** O que a pessoa escolheu (a preferência do navegador). */
  preference: RetroSceneMode;
  setPreference: (mode: RetroSceneMode) => void;
  /** O que vale agora, depois do tema Leitura, da apresentação e de "reduzir movimento". */
  mode: RetroSceneMode;
  /** Tema Leitura: as três opções ficam bloqueadas. */
  locked: boolean;
}

/** Preferência "Cenário da retro" (Completo, Suave ou Desligado) e o modo em vigor. */
export function useRetroSceneMode(presenting: boolean): RetroSceneModeState {
  const [preference, setPreference] = useRoomPreference<RetroSceneMode>(RETRO_SCENE_PREF_KEY, DEFAULT_RETRO_SCENE_MODE, parseSceneMode);
  const leitura = useLeituraTheme();
  const reducedMotion = useReducedMotion();
  return {
    preference,
    setPreference,
    mode: resolveSceneMode({ preference, leitura, presenting, reducedMotion }),
    locked: leitura,
  };
}
