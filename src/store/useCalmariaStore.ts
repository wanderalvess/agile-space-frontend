import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export const CALMARIA_QUOTES = [
  "Devagar é a forma mais rápida de chegar lá.",
  "Solte os ombros. Você está indo bem.",
  "O foco é a habilidade de dizer não a outras 99 boas ideias.",
  "Não pare até se orgulhar de você.",
  "Faça do foco o seu superpoder diário.",
  "A persistência realiza o impossível.",
  "Respire fundo, relaxe os ombros e volte ao fluxo.",
  "Grandes coisas são feitas de uma série de pequenas coisas juntas."
];

interface CalmariaStoreState {
  isOpen: boolean;
  isMinimized: boolean;
  masterVolume: number;
  activeSounds: Record<string, number>; // soundId -> volume (0-100)
  isTimerRunning: boolean;
  timeRemaining: number; // in seconds
  baseMinutes: number; // in minutes (default 25)
  cycles: number;
  lastTickTimestamp: number | null;
  currentQuote: string;
  isMuted: boolean;

  // Actions
  toggleOpen: () => void;
  setOpen: (isOpen: boolean) => void;
  setMinimized: (isMinimized: boolean) => void;
  setMasterVolume: (volume: number) => void;
  setSoundVolume: (soundId: string, volume: number) => void;
  toggleMute: () => void;
  
  // Timer Actions
  startTimer: () => void;
  pauseTimer: () => void;
  resetTimer: () => void;
  setBaseMinutes: (minutes: number) => void;
  tick: () => void;
  incrementCycle: () => void;
  rotateQuote: () => void;
  stopAll: () => void;
}

export const useCalmariaStore = create<CalmariaStoreState>()(
  persist(
    (set, get) => ({
      isOpen: false,
      isMinimized: false,
      masterVolume: 80,
      activeSounds: {},
      isTimerRunning: false,
      timeRemaining: 25 * 60,
      baseMinutes: 25,
      cycles: 0,
      lastTickTimestamp: null,
      currentQuote: CALMARIA_QUOTES[0],
      isMuted: false,

      toggleOpen: () => set(state => ({ isOpen: !state.isOpen, isMinimized: false })),
      setOpen: (isOpen) => set({ isOpen, isMinimized: false }),
      setMinimized: (isMinimized) => set({ isMinimized, isOpen: !isMinimized }),
      
      setMasterVolume: (volume) => set({ masterVolume: volume }),
      setSoundVolume: (soundId, volume) => set(state => {
        const updated = { ...state.activeSounds };
        if (volume === 0) {
          delete updated[soundId];
        } else {
          updated[soundId] = volume;
        }
        return { activeSounds: updated };
      }),
      toggleMute: () => set(state => ({ isMuted: !state.isMuted })),

      startTimer: () => set({ isTimerRunning: true, lastTickTimestamp: Date.now() }),
      pauseTimer: () => set({ isTimerRunning: false, lastTickTimestamp: null }),
      resetTimer: () => set(state => ({
        isTimerRunning: false,
        timeRemaining: state.baseMinutes * 60,
        lastTickTimestamp: null
      })),
      setBaseMinutes: (minutes) => set({
        baseMinutes: minutes,
        timeRemaining: minutes * 60,
        isTimerRunning: false,
        lastTickTimestamp: null
      }),
      tick: () => set(state => {
        if (!state.isTimerRunning) return {};
        
        const now = Date.now();
        const lastTick = state.lastTickTimestamp || now;
        const elapsedSeconds = Math.floor((now - lastTick) / 1000);
        
        if (elapsedSeconds <= 0) {
          return {};
        }
        
        const newTimeRemaining = Math.max(0, state.timeRemaining - elapsedSeconds);
        
        if (newTimeRemaining > 0) {
          return { 
            timeRemaining: newTimeRemaining,
            lastTickTimestamp: lastTick + (elapsedSeconds * 1000)
          };
        } else {
          // Cycle completed
          return {
            isTimerRunning: false,
            timeRemaining: state.baseMinutes * 60,
            lastTickTimestamp: null,
            cycles: state.cycles + 1,
            currentQuote: CALMARIA_QUOTES[Math.floor(Math.random() * CALMARIA_QUOTES.length)]
          };
        }
      }),
      incrementCycle: () => set(state => ({ cycles: state.cycles + 1 })),
      rotateQuote: () => set({
        currentQuote: CALMARIA_QUOTES[Math.floor(Math.random() * CALMARIA_QUOTES.length)]
      }),

      stopAll: () => set({
        isTimerRunning: false,
        activeSounds: {}
      })
    }),
    {
      name: 'agile-space-calmaria-store',
      partialize: (state) => ({
        masterVolume: state.masterVolume,
        activeSounds: state.activeSounds,
        cycles: state.cycles,
        baseMinutes: state.baseMinutes
      })
    }
  )
);
