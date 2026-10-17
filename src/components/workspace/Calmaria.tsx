'use client';

import React, { useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Moon, Volume2, VolumeX, X,
  CloudRain, Zap, Waves, Leaf, Coffee, Flame, Activity, Music
} from 'lucide-react';
import { useCalmariaStore } from '@/store/useCalmariaStore';
import { Button } from '@/components/ui/button';

interface Soundscape {
  id: string;
  name: string;
  icon: any;
  color: string;
  activeColor: string;
  url: string;
}

const SOUNDSCAPES: Soundscape[] = [
  { id: 'rain', name: 'Chuva', icon: CloudRain, color: 'bg-blue-500/10 text-blue-500', activeColor: 'bg-blue-600 text-white', url: 'https://actions.google.com/sounds/v1/weather/light_rain.ogg' },
  { id: 'thunder', name: 'Trovões', icon: Zap, color: 'bg-violet-500/10 text-violet-500', activeColor: 'bg-violet-600 text-white', url: 'https://actions.google.com/sounds/v1/weather/thunderstorm.ogg' },
  { id: 'waves', name: 'Ondas', icon: Waves, color: 'bg-cyan-500/10 text-cyan-500', activeColor: 'bg-cyan-600 text-white', url: 'https://actions.google.com/sounds/v1/water/waves_crashing_on_rock_beach.ogg' },
  { id: 'forest', name: 'Floresta', icon: Leaf, color: 'bg-emerald-500/10 text-emerald-500', activeColor: 'bg-emerald-600 text-white', url: 'https://actions.google.com/sounds/v1/ambiences/spring_day_forest.ogg' },
  { id: 'cafe', name: 'Café', icon: Coffee, color: 'bg-amber-800/10 text-amber-500', activeColor: 'bg-amber-800 text-white', url: 'https://actions.google.com/sounds/v1/ambiences/coffee_shop.ogg' },
  { id: 'fire', name: 'Lareira', icon: Flame, color: 'bg-orange-500/10 text-orange-500', activeColor: 'bg-orange-600 text-white', url: 'https://actions.google.com/sounds/v1/ambiences/daytime_forrest_bonfire.ogg' },
  { id: 'noise', name: 'Ruído', icon: Activity, color: 'bg-slate-500/10 text-slate-400', activeColor: 'bg-slate-500 text-white', url: 'https://actions.google.com/sounds/v1/ambiences/white_noise.ogg' },
  { id: 'lofi', name: 'Lofi', icon: Music, color: 'bg-fuchsia-500/10 text-fuchsia-400', activeColor: 'bg-fuchsia-500 text-white', url: 'https://www.chosic.com/wp-content/uploads/2021/04/Warm-Lights.mp3' },
];

export function Calmaria() {
  const {
    isOpen, isMinimized, masterVolume, activeSounds,
    isTimerRunning, cycles,
    setMinimized, setMasterVolume, setSoundVolume,
    toggleMute, tick, stopAll
  } = useCalmariaStore();

  const isMuted = useCalmariaStore(state => state.isMuted);

  const audiosRef = useRef<Record<string, HTMLAudioElement>>({});
  const bellAudioRef = useRef<HTMLAudioElement | null>(null);
  const timerIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Audio setup and synchronization
  useEffect(() => {
    // Synchronize individual audio elements with state
    SOUNDSCAPES.forEach(sound => {
      const currentVol = activeSounds[sound.id] || 0;
      let audio = audiosRef.current[sound.id];

      if (currentVol > 0 && !isMuted) {
        if (!audio) {
          audio = new Audio(sound.url);
          audio.loop = true;
          audiosRef.current[sound.id] = audio;
        }
        
        // Calculate adjusted volume
        audio.volume = (currentVol / 100) * (masterVolume / 100);
        
        if (audio.paused) {
          audio.play().catch(e => console.warn(`Error playing sound ${sound.id}:`, e));
        }
      } else {
        if (audio && !audio.paused) {
          audio.pause();
        }
      }
    });

    // Handle bell alert audio
    if (!bellAudioRef.current) {
      bellAudioRef.current = new Audio('https://actions.google.com/sounds/v1/alarms/medium_bell_ringing_near.ogg');
    }
  }, [activeSounds, masterVolume, isMuted]);

  // Handle page unload / cleanup
  useEffect(() => {
    return () => {
      // Pause all playing audio elements
      Object.values(audiosRef.current).forEach(audio => {
        audio.pause();
      });
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    };
  }, []);

  // Timer tick interval
  useEffect(() => {
    if (isTimerRunning) {
      timerIntervalRef.current = setInterval(() => {
        tick();
      }, 1000);
    } else {
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
        timerIntervalRef.current = null;
      }
    }

    return () => {
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    };
  }, [isTimerRunning, tick]);

  // Detect timer completion (when cycles count increments)
  const prevCycles = useRef(cycles);
  useEffect(() => {
    if (cycles > prevCycles.current) {
      if (bellAudioRef.current) {
        bellAudioRef.current.play().catch(e => console.warn('Error playing completion bell:', e));
      }
      prevCycles.current = cycles;
    }
  }, [cycles]);

  const handleStopAll = () => {
    Object.values(audiosRef.current).forEach(audio => {
      audio.pause();
    });
    stopAll();
  };

  const toggleSound = (soundId: string) => {
    const currentVol = activeSounds[soundId] || 0;
    setSoundVolume(soundId, currentVol > 0 ? 0 : 50);
  };

  if (!isOpen || isMinimized) return null;

  return (
    <AnimatePresence>
      <motion.div 
        drag
        dragMomentum={false}
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        className="fixed bottom-6 right-6 z-[9999] w-[350px] max-w-[calc(100vw-2rem)] bg-card/95 backdrop-blur-xl text-card-foreground rounded-3xl border border-border shadow-[0_24px_64px_rgba(15,23,42,0.18)] dark:shadow-[0_24px_64px_rgba(0,0,0,0.6)] p-5 overflow-hidden flex flex-col justify-between select-none cursor-default"
        style={{ touchAction: 'none' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-4 shrink-0">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-[10px] bg-primary/10 text-primary dark:bg-primary/15 [.theme-totvs:not(.dark)_&]:text-foreground flex items-center justify-center">
              <Moon className="h-[18px] w-[18px]" strokeWidth={1.5} aria-hidden="true" />
            </div>
             <span className="text-sm font-bold text-foreground">Calmaria</span>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              onClick={handleStopAll}
              className="h-auto rounded-[10px] border border-border bg-transparent px-3.5 py-1.5 text-xs font-semibold text-foreground hover:bg-accent"
            >
              Parar
            </Button>
            <button 
              onClick={() => setMinimized(true)}
              aria-label="Minimizar"
              className="w-8 h-8 rounded-[10px] border border-border text-muted-foreground hover:bg-accent hover:text-foreground transition-colors flex items-center justify-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <X className="h-4 w-4" strokeWidth={1.5} />
            </button>
          </div>
        </div>

        {/* Soundscapes Content */}
        <div className="flex-1 overflow-y-auto no-scrollbar min-h-0 mb-4 max-h-[320px]">
          <div className="space-y-4">
            {/* Sounds Grid */}
            <div className="grid grid-cols-4 gap-2">
              {SOUNDSCAPES.map(sound => {
                const Icon = sound.icon;
                const isActive = (activeSounds[sound.id] || 0) > 0;
                return (
                  <button
                    key={sound.id}
                    onClick={() => toggleSound(sound.id)}
                    aria-pressed={isActive}
                    className={`rounded-2xl flex flex-col items-center justify-center p-2.5 h-16 w-full transition-all active:scale-95 border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${isActive ? 'bg-primary text-primary-foreground border-transparent' : 'bg-muted/40 border-border text-muted-foreground hover:bg-accent hover:text-foreground'}`}
                  >
                    <Icon className="h-5 w-5 mb-1" strokeWidth={1.5} />
                    <span className="text-xs font-semibold">{sound.name}</span>
                  </button>
                );
              })}
            </div>

            {/* Volume Mixer Controls */}
            {Object.keys(activeSounds).length > 0 && (
              <div className="bg-muted/40 border border-border rounded-2xl p-3 space-y-2.5">
                <span className="text-xs font-bold text-muted-foreground">Mixer de volumes</span>
                <div className="space-y-2 max-h-[120px] overflow-y-auto no-scrollbar">
                  {SOUNDSCAPES.map(sound => {
                    const vol = activeSounds[sound.id] || 0;
                    if (vol === 0) return null;
                    const Icon = sound.icon;
                    return (
                      <div key={sound.id} className="flex items-center gap-3">
                        <Icon className="h-3.5 w-3.5 text-muted-foreground shrink-0" strokeWidth={1.5} />
                        <input 
                          type="range" 
                          min="0" 
                          max="100" 
                          value={vol}
                          onChange={(e) => setSoundVolume(sound.id, Number(e.target.value))}
                          aria-label={`Volume: ${sound.name}`}
                          className="flex-1 h-1 bg-muted rounded-full appearance-none outline-none cursor-pointer accent-primary [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-primary [&::-webkit-slider-thumb]:appearance-none"
                        />
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Master Volume */}
            <div className="flex items-center gap-3 bg-muted/40 border border-border rounded-2xl p-3">
              <button 
                onClick={toggleMute}
                aria-label={isMuted ? 'Ativar o som' : 'Silenciar'}
                className="text-muted-foreground hover:text-foreground transition-colors"
              >
                {isMuted ? <VolumeX className="h-4 w-4" strokeWidth={1.5} /> : <Volume2 className="h-4 w-4" strokeWidth={1.5} />}
              </button>
              <input 
                type="range" 
                min="0" 
                max="100" 
                value={masterVolume}
                onChange={(e) => setMasterVolume(Number(e.target.value))}
                aria-label="Volume geral"
                className="flex-1 h-1.5 bg-muted rounded-full appearance-none outline-none cursor-pointer accent-primary [&::-webkit-slider-thumb]:w-3.5 [&::-webkit-slider-thumb]:h-3.5 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-primary [&::-webkit-slider-thumb]:appearance-none"
              />
              <span className="text-xs font-semibold font-code w-7 text-right text-muted-foreground">{masterVolume}</span>
            </div>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
