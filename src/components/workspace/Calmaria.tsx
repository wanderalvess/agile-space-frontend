'use client';

import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Moon, Volume2, VolumeX, Play, Pause, RotateCcw, X,
  CloudRain, Zap, Waves, Leaf, Coffee, Flame, Activity, Music
} from 'lucide-react';
import { useCalmariaStore, CALMARIA_QUOTES } from '@/store/useCalmariaStore';
import { useSystemConfig } from '@/context/SystemConfigContext';

// Spotify SVG Icon
const SpotifyIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 24 24" fill="currentColor" {...props}>
    <path d="M12 2C6.477 2 2 6.477 2 12s4.477 10 10 10 10-4.477 10-10S17.523 2 12 2zm4.586 14.424c-.18.295-.565.387-.86.207-2.377-1.454-5.37-1.783-8.893-1.007-.336.074-.67-.14-.744-.477-.074-.336.14-.67.477-.744 3.844-.88 7.143-.507 9.813 1.13.295.18.387.563.207.86-.001.001-.001.001 0 0zm1.224-2.72c-.226.367-.707.487-1.074.26-2.72-1.672-6.87-2.157-10.082-1.182-.413.125-.85-.107-.975-.52-.125-.413.107-.85.52-.975 3.673-1.114 8.243-.574 11.35 1.338.367.226.487.707.26 1.074l.001.005zm.106-2.833C14.733 8.877 9.49 8.703 6.45 9.626c-.477.145-.98-.125-1.125-.603-.145-.477.125-.98.603-1.125 3.523-1.07 9.317-.866 13.003 1.32.43.255.57.808.315 1.238-.255.43-.808.57-1.238.315l-.013-.006z"/>
  </svg>
);

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
  const { config } = useSystemConfig();
  const spotifyClientId = config.spotifyClientId || 'a2693d23e9cb4c42b971c458f5ad20b8';

  const {
    isOpen, isMinimized, activeTab, masterVolume, activeSounds,
    isTimerRunning, timeRemaining, baseMinutes, cycles, currentQuote,
    spotifyToken, spotifyUser, spotifyPlaylists, selectedPlaylistId, isMuted,
    setOpen, setMinimized, setActiveTab, setMasterVolume, setSoundVolume,
    toggleMute, startTimer, pauseTimer, resetTimer, setBaseMinutes, tick,
    setSpotifyToken, setSpotifyUser, setSpotifyPlaylists, setSelectedPlaylistId,
    logoutSpotify, stopAll
  } = useCalmariaStore();

  const audiosRef = useRef<Record<string, HTMLAudioElement>>({});
  const bellAudioRef = useRef<HTMLAudioElement | null>(null);
  const timerIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const [spotifyLoading, setSpotifyLoading] = useState(false);

  const handleCustomTimePrompt = () => {
    const res = window.prompt("Definir minutos de foco:", String(baseMinutes));
    if (res !== null) {
      const val = parseInt(res);
      if (val > 0) {
        setBaseMinutes(val);
      }
    }
  };

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
      // Play bell sound
      if (bellAudioRef.current) {
        bellAudioRef.current.play().catch(e => console.warn('Error playing completion bell:', e));
      }
      prevCycles.current = cycles;
    }
  }, [cycles]);

  // Handle OAuth Popup message listener
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return;
      if (event.data?.type === 'SPOTIFY_AUTH_SUCCESS' && event.data.token) {
        setSpotifyToken(event.data.token);
        fetchSpotifyData(event.data.token);
      }
    };
    window.addEventListener('message', handleMessage);
    
    // Check if token exists in localStorage (direct callback fallback)
    const directToken = localStorage.getItem('spotify_token_direct');
    if (directToken) {
      setSpotifyToken(directToken);
      fetchSpotifyData(directToken);
      localStorage.removeItem('spotify_token_direct');
    }

    // Load initial Spotify data if token exists
    if (spotifyToken) {
      fetchSpotifyData(spotifyToken);
    }

    return () => window.removeEventListener('message', handleMessage);
  }, [spotifyToken]);

  const fetchSpotifyData = async (token: string) => {
    setSpotifyLoading(true);
    try {
      // Fetch profile
      const userRes = await fetch('https://api.spotify.com/v1/me', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (userRes.ok) {
        const userData = await userRes.json();
        setSpotifyUser({
          display_name: userData.display_name,
          image_url: userData.images?.[0]?.url || ''
        });
      } else if (userRes.status === 401) {
        // Token expired
        logoutSpotify();
        setSpotifyLoading(false);
        return;
      }

      // Fetch playlists
      const playlistsRes = await fetch('https://api.spotify.com/v1/me/playlists?limit=20', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (playlistsRes.ok) {
        const playlistsData = await playlistsRes.json();
        const mapped = playlistsData.items
          .filter((item: any) => item !== null)
          .map((item: any) => ({
            id: item.id,
            name: item.name,
            image: item.images?.[0]?.url || '',
            uri: item.uri
          }));
        setSpotifyPlaylists(mapped);
      }
    } catch (err) {
      console.error('Error loading Spotify data:', err);
    } finally {
      setSpotifyLoading(false);
    }
  };

  const handleSpotifyConnect = () => {
    const width = 500;
    const height = 650;
    const left = window.screenX + (window.outerWidth - width) / 2;
    const top = window.screenY + (window.outerHeight - height) / 2;
    
    const redirectUri = `${window.location.origin}/spotify-callback`;
    const scopes = 'user-read-private user-read-email playlist-read-private';
    const authUrl = `https://accounts.spotify.com/authorize?client_id=${spotifyClientId}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=token&scope=${encodeURIComponent(scopes)}`;
    
    window.open(authUrl, 'Spotify Login', `width=${width},height=${height},left=${left},top=${top}`);
  };

  const handleStopAll = () => {
    // Pause all playing audio elements
    Object.values(audiosRef.current).forEach(audio => {
      audio.pause();
    });
    stopAll();
  };

  const toggleSound = (soundId: string) => {
    const currentVol = activeSounds[soundId] || 0;
    setSoundVolume(soundId, currentVol > 0 ? 0 : 50);
  };

  const progress = ((baseMinutes * 60 - timeRemaining) / (baseMinutes * 60)) * 100;
  const minutesDisplay = Math.floor(timeRemaining / 60);
  const secondsDisplay = timeRemaining % 60;

  if (!isOpen || isMinimized) return null;

  return (
    <AnimatePresence>
      <motion.div 
        drag
        dragMomentum={false}
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        className="fixed bottom-6 right-6 z-[9999] w-[350px] bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl text-slate-900 dark:text-white shadow-2xl rounded-[2.5rem] border border-primary/20 dark:border-primary/30 shadow-[0_20px_50px_rgba(249,115,22,0.1)] dark:shadow-[0_20px_50px_rgba(249,115,22,0.05)] p-5 font-sans overflow-hidden flex flex-col justify-between select-none cursor-default"
        style={{ touchAction: 'none' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-4 shrink-0">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-orange-500/20 text-orange-500 flex items-center justify-center">
              <Moon className="h-4.5 w-4.5" />
            </div>
             <span className="text-sm font-extrabold uppercase tracking-wider text-slate-900 dark:text-white">Calmaria</span>
          </div>
          <div className="flex items-center gap-2">
            <button 
              onClick={handleStopAll}
              className="bg-orange-500/10 hover:bg-orange-500/20 text-orange-600 dark:text-orange-400 rounded-xl px-3.5 py-1.5 text-[10px] font-black uppercase tracking-wider transition-all"
            >
              Parar
            </button>
            <button 
              onClick={() => setMinimized(true)}
              className="w-8 h-8 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 transition-colors flex items-center justify-center text-slate-450 dark:text-slate-500 hover:text-slate-900 dark:hover:text-slate-200"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Tab Selection */}
        <div className="bg-slate-100 dark:bg-slate-950 p-1 rounded-full flex gap-1 mb-4 w-fit shrink-0 border border-slate-200/50 dark:border-slate-800/50">
          <button
            onClick={() => setActiveTab('ambient')}
            className={`px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-wider transition-all ${activeTab === 'ambient' ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm' : 'text-slate-450 dark:text-slate-500 hover:text-slate-900 dark:hover:text-white'}`}
          >
            Ambiente
          </button>
          <button
            onClick={() => setActiveTab('spotify')}
            className={`px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-wider transition-all ${activeTab === 'spotify' ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm' : 'text-slate-450 dark:text-slate-500 hover:text-slate-900 dark:hover:text-white'}`}
          >
            Spotify
          </button>
        </div>

        {/* Dynamic Content Panel */}
        <div className="flex-1 overflow-y-auto no-scrollbar min-h-0 mb-4 max-h-[320px]">
          {activeTab === 'ambient' ? (
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
                      className={`rounded-2xl flex flex-col items-center justify-center p-2.5 h-16 w-full transition-all active:scale-95 border ${isActive ? sound.activeColor + ' border-transparent shadow-lg' : 'bg-slate-50 dark:bg-slate-950/40 border-slate-200/60 dark:border-slate-800/60 text-slate-450 dark:text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-900 hover:text-slate-900 dark:hover:text-slate-200'}`}
                    >
                      <Icon className="h-5 w-5 mb-1" />
                      <span className="text-[8px] font-black uppercase tracking-wider">{sound.name}</span>
                    </button>
                  );
                })}
              </div>

              {/* Volume Mixer Controls */}
              {Object.keys(activeSounds).length > 0 && (
                <div className="bg-slate-50/50 dark:bg-slate-950/20 border border-slate-200/60 dark:border-slate-800/60 rounded-2xl p-3 space-y-2.5">
                  <span className="text-[8px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500">Mixer de Volumes</span>
                  <div className="space-y-2 max-h-[120px] overflow-y-auto no-scrollbar">
                    {SOUNDSCAPES.map(sound => {
                      const vol = activeSounds[sound.id] || 0;
                      if (vol === 0) return null;
                      const Icon = sound.icon;
                      return (
                        <div key={sound.id} className="flex items-center gap-3">
                          <Icon className="h-3.5 w-3.5 text-slate-400 dark:text-slate-500 shrink-0" />
                          <input 
                            type="range" 
                            min="0" 
                            max="100" 
                            value={vol}
                            onChange={(e) => setSoundVolume(sound.id, Number(e.target.value))}
                            className="flex-1 h-1 bg-slate-200 dark:bg-slate-800 rounded-full appearance-none outline-none cursor-pointer accent-orange-500 [&::-webkit-slider-thumb]:w-2.5 [&::-webkit-slider-thumb]:h-2.5 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-orange-500 [&::-webkit-slider-thumb]:appearance-none"
                          />
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Master Volume */}
              <div className="flex items-center gap-3 bg-slate-50 dark:bg-slate-950/40 border border-slate-200/60 dark:border-slate-800/60 rounded-2xl p-3">
                <button 
                  onClick={toggleMute}
                  className="text-slate-405 dark:text-slate-500 hover:text-slate-900 dark:hover:text-white transition-colors"
                >
                  {isMuted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
                </button>
                <input 
                  type="range" 
                  min="0" 
                  max="100" 
                  value={masterVolume}
                  onChange={(e) => setMasterVolume(Number(e.target.value))}
                  className="flex-1 h-1.5 bg-slate-200 dark:bg-slate-800 rounded-full appearance-none outline-none cursor-pointer accent-orange-500 [&::-webkit-slider-thumb]:w-3.5 [&::-webkit-slider-thumb]:h-3.5 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-orange-500 [&::-webkit-slider-thumb]:appearance-none"
                />
                <span className="text-[10px] font-black font-mono w-6 text-right text-slate-500 dark:text-slate-400">{masterVolume}</span>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center min-h-[180px]">
              {spotifyLoading ? (
                <div className="flex flex-col items-center gap-2">
                  <div className="w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
                  <span className="text-[9px] font-black uppercase tracking-wider text-slate-400">Carregando Spotify...</span>
                </div>
              ) : !spotifyToken ? (
                <div className="flex flex-col items-center text-center p-4">
                  <SpotifyIcon className="w-12 h-12 text-[#1db954] mb-3 animate-pulse" />
                  <p className="text-[10px] font-semibold text-[#a69891] max-w-[200px] leading-relaxed mb-4">
                    Conecte sua conta Spotify pra ouvir suas playlists enquanto foca. Login independente do sistema.
                  </p>
                  <button
                    onClick={handleSpotifyConnect}
                    className="bg-[#1db954] hover:bg-[#1ed760] text-black rounded-full px-6 py-2.5 text-xs font-black uppercase tracking-wider flex items-center gap-2 transition-all active:scale-95 shadow-lg shadow-emerald-500/20"
                  >
                    <SpotifyIcon className="w-4 h-4 text-black" />
                    Conectar Spotify
                  </button>
                </div>
              ) : (
                <div className="w-full space-y-4">
                  {/* Spotify Header Account info */}
                  <div className="flex items-center justify-between bg-slate-50/50 dark:bg-slate-950/20 border border-slate-200/60 dark:border-slate-800/60 p-2 rounded-2xl">
                    <div className="flex items-center gap-2.5">
                      {spotifyUser?.image_url ? (
                        <img 
                          src={spotifyUser.image_url} 
                          alt={spotifyUser.display_name} 
                          className="w-7 h-7 rounded-full border border-emerald-500/30 object-cover" 
                        />
                      ) : (
                        <div className="w-7 h-7 rounded-full bg-emerald-500/10 text-emerald-500 flex items-center justify-center">
                          <SpotifyIcon className="w-4 h-4" />
                        </div>
                      )}
                      <span className="text-[10px] font-extrabold text-slate-900 dark:text-white truncate max-w-[130px]">{spotifyUser?.display_name || 'Usuário Spotify'}</span>
                    </div>
                    <button 
                      onClick={logoutSpotify}
                      className="text-[8px] font-black text-rose-400 hover:text-rose-500 uppercase tracking-widest bg-rose-500/10 border border-rose-500/10 px-2.5 py-1 rounded-lg"
                    >
                      Sair
                    </button>
                  </div>

                  {/* Playlists grid / list */}
                  {!selectedPlaylistId ? (
                    <div className="space-y-2">
                      <span className="text-[8px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500 block">Minhas Playlists</span>
                      <div className="grid grid-cols-2 gap-2 max-h-[160px] overflow-y-auto no-scrollbar">
                        {spotifyPlaylists.map(pl => (
                          <button
                            key={pl.id}
                            onClick={() => setSelectedPlaylistId(pl.id)}
                            className="bg-slate-50 dark:bg-slate-950/40 hover:bg-slate-100 dark:hover:bg-slate-900 border border-slate-200/60 dark:border-slate-800/60 rounded-xl p-1.5 flex items-center gap-2 text-left transition-all truncate"
                          >
                            {pl.image ? (
                              <img src={pl.image} alt={pl.name} className="w-8 h-8 rounded-lg object-cover shrink-0" />
                            ) : (
                              <div className="w-8 h-8 rounded-lg bg-emerald-500/10 text-emerald-500 flex items-center justify-center shrink-0">
                                <Music className="w-4 h-4" />
                              </div>
                            )}
                            <span className="text-[9px] font-bold text-slate-900 dark:text-white truncate flex-1">{pl.name}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-[8px] font-black uppercase tracking-widest text-[#a69891]">Player Spotify</span>
                        <button 
                          onClick={() => setSelectedPlaylistId(null)}
                          className="text-[8px] font-black text-slate-450 dark:text-slate-500 hover:text-slate-900 dark:hover:text-white uppercase tracking-widest underline decoration-dashed underline-offset-2"
                        >
                          Voltar para Playlists
                        </button>
                      </div>
                      <div className="bg-slate-100 dark:bg-black/40 rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-800 shadow-inner">
                        <iframe 
                          src={`https://open.spotify.com/embed/playlist/${selectedPlaylistId}`}
                          width="100%" 
                          height="152" 
                          frameBorder="0" 
                          allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture" 
                          loading="lazy"
                          className="border-none"
                        />
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Pomodoro Timer widget */}
        <div className="bg-slate-50 dark:bg-slate-950/40 border border-slate-200/60 dark:border-slate-800/60 rounded-[2rem] p-3.5 flex items-center justify-between gap-3 mb-3 shrink-0">
          {/* Circular SVG Timer */}
          <div 
            onClick={handleCustomTimePrompt} 
            className="relative w-14 h-14 flex items-center justify-center shrink-0 cursor-pointer hover:scale-105 transition-transform"
            title="Clique para digitar os minutos de foco"
          >
            <svg viewBox="0 0 100 100" className="w-full h-full transform -rotate-90">
              <circle cx="50" cy="50" r="42" stroke="currentColor" strokeWidth="4" fill="transparent" className="text-slate-200 dark:text-slate-800/40" />
              <circle cx="50" cy="50" r="42" stroke="currentColor" strokeWidth="6" fill="transparent"
                strokeDasharray={263.89}
                strokeDashoffset={263.89 - (263.89 * progress) / 100}
                className="text-orange-500 transition-all duration-300"
                strokeLinecap="round"
              />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="font-extrabold italic text-sm text-slate-900 dark:text-white select-none">
                {String(minutesDisplay).padStart(2, '0')}:{String(secondsDisplay).padStart(2, '0')}
              </span>
            </div>
          </div>

          {/* Pomodoro Actions */}
          <div className="flex-1 flex flex-col gap-1">
            <div className="flex items-center justify-between mb-1.5 shrink-0">
              <div className="flex items-center gap-1">
                {[15, 25, 45, 60].map(m => (
                  <button
                    key={m}
                    onClick={() => setBaseMinutes(m)}
                    className={`px-1.5 py-0.5 rounded text-[8px] font-black uppercase transition-all ${baseMinutes === m ? 'bg-orange-600 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700 hover:text-slate-900 dark:hover:text-slate-100'}`}
                  >
                    {m}m
                  </button>
                ))}
              </div>
              <span className="text-[8px] font-bold text-slate-400 dark:text-slate-500">{cycles}c</span>
            </div>
            
            <div className="flex items-center gap-1.5">
              <button
                onClick={isTimerRunning ? pauseTimer : startTimer}
                className="flex-1 bg-orange-600 hover:bg-orange-700 text-white rounded-xl h-9.5 text-xs font-black uppercase tracking-wider transition-all flex items-center justify-center gap-1 active:scale-95 shadow-lg shadow-orange-600/10"
              >
                {isTimerRunning ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5 fill-current ml-0.5" />}
                {isTimerRunning ? 'Pausar' : 'Iniciar'}
              </button>
              
              <button
                onClick={resetTimer}
                className="bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-400 rounded-xl w-9.5 h-9.5 flex items-center justify-center transition-all active:scale-95"
              >
                <RotateCcw className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Motivational Quote */}
        <div className="text-center shrink-0">
          <p className="text-[9.5px] italic text-slate-500 dark:text-slate-400 font-semibold font-body leading-relaxed max-w-[280px] mx-auto">
            "{currentQuote}"
          </p>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
