'use client';

import React, { useState, useEffect } from 'react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { useCalmariaStore, CALMARIA_QUOTES } from '@/store/useCalmariaStore';
import { useSystemConfig } from '@/context/SystemConfigContext';
import {
  Play,
  Pause,
  RotateCcw,
  Headphones,
  Moon,
  CloudRain,
  Zap,
  Waves,
  Leaf,
  Coffee,
  Flame,
  Activity,
  Music,
  Volume2,
  VolumeX
} from 'lucide-react';

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

export function FocusWidget() {
  const { config } = useSystemConfig();
  const spotifyClientId = config.spotifyClientId || 'a2693d23e9cb4c42b971c458f5ad20b8';

  const {
    activeTab, masterVolume, activeSounds,
    isTimerRunning, timeRemaining, baseMinutes, cycles, currentQuote,
    spotifyToken, spotifyUser, spotifyPlaylists, selectedPlaylistId, isMuted,
    setActiveTab, setMasterVolume, setSoundVolume, toggleMute,
    startTimer, pauseTimer, resetTimer, setBaseMinutes,
    setSpotifyToken, setSpotifyUser, setSpotifyPlaylists, setSelectedPlaylistId,
    logoutSpotify, stopAll
  } = useCalmariaStore();

  const [spotifyLoading, setSpotifyLoading] = useState(false);

  const isFocusActive = isTimerRunning || Object.keys(activeSounds).length > 0;
  const minutesDisplay = Math.floor(timeRemaining / 60);
  const secondsDisplay = timeRemaining % 60;
  const progress = ((baseMinutes * 60 - timeRemaining) / (baseMinutes * 60)) * 100;

  const handleCustomTimePrompt = () => {
    const res = window.prompt("Definir minutos de foco:", String(baseMinutes));
    if (res !== null) {
      const val = parseInt(res);
      if (val > 0) {
        setBaseMinutes(val);
      }
    }
  };

  const toggleSound = (soundId: string) => {
    const currentVol = activeSounds[soundId] || 0;
    setSoundVolume(soundId, currentVol > 0 ? 0 : 50);
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

  const fetchSpotifyData = async (token: string) => {
    setSpotifyLoading(true);
    try {
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
        logoutSpotify();
        return;
      }

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

  useEffect(() => {
    if (spotifyToken) {
      fetchSpotifyData(spotifyToken);
    }
  }, [spotifyToken]);

  return (
    <div className="group relative border border-primary/20 dark:border-primary/30 bg-white/95 dark:bg-slate-900/95 text-slate-900 dark:text-white rounded-[2.5rem] p-6 shadow-2xl shadow-[0_20px_50px_rgba(249,115,22,0.08)] dark:shadow-[0_20px_50px_rgba(249,115,22,0.03)] flex flex-col justify-between overflow-hidden h-full min-h-[440px]">
      {/* Header */}
      <div className="flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="w-10 h-10 bg-orange-500/20 rounded-xl flex items-center justify-center border border-orange-500/30">
            <Moon className="h-5 w-5 text-orange-500" />
          </div>
          <div>
            <h3 className="text-base font-extrabold uppercase tracking-tight text-slate-900 dark:text-white leading-none">Foco Ativo</h3>
            <p className="text-[10px] font-bold text-slate-450 dark:text-slate-500 mt-1 font-sans">Sincronizado com Calmaria</p>
          </div>
        </div>
        
        <div className="flex bg-slate-100 dark:bg-slate-950 p-1 rounded-full gap-1 border border-slate-200/50 dark:border-slate-800/50">
          <button
            onClick={() => setActiveTab('ambient')}
            className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-wider transition-all ${activeTab === 'ambient' ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm' : 'bg-transparent text-slate-450 dark:text-slate-500 hover:text-slate-900 dark:hover:text-white'}`}
          >
            Sons
          </button>
          <button
            onClick={() => setActiveTab('spotify')}
            className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-wider transition-all ${activeTab === 'spotify' ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm' : 'bg-transparent text-slate-450 dark:text-slate-500 hover:text-slate-900 dark:hover:text-white'}`}
          >
            Spotify
          </button>
        </div>
      </div>

      {/* Dynamic Tabs Content */}
      <div className="flex-1 overflow-y-auto no-scrollbar my-4 min-h-[160px] max-h-[180px]">
        {activeTab === 'ambient' ? (
          <div className="space-y-3">
            {/* Sounds Grid */}
            <div className="grid grid-cols-4 gap-1.5">
              {SOUNDSCAPES.map(sound => {
                const Icon = sound.icon;
                const isActive = (activeSounds[sound.id] || 0) > 0;
                return (
                  <button
                    key={sound.id}
                    onClick={() => toggleSound(sound.id)}
                    className={`rounded-xl flex flex-col items-center justify-center p-1.5 h-12 w-full transition-all active:scale-95 border ${isActive ? sound.activeColor + ' border-transparent shadow-md' : 'bg-slate-50 dark:bg-slate-950/40 border-slate-200/60 dark:border-slate-800/60 text-slate-450 dark:text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-900 hover:text-slate-900 dark:hover:text-slate-200'}`}
                  >
                    <Icon className="h-4 w-4 mb-0.5" />
                    <span className="text-[7px] font-black uppercase tracking-wider">{sound.name}</span>
                  </button>
                );
              })}
            </div>

            {/* Mixer & Volume Row */}
            <div className="flex items-center gap-3 bg-slate-50 dark:bg-slate-950/40 border border-slate-200/60 dark:border-slate-800/60 rounded-xl p-2.5">
              <button onClick={toggleMute} className="text-slate-450 dark:text-slate-500 hover:text-slate-900 dark:hover:text-white transition-colors">
                {isMuted ? <VolumeX className="h-3.5 w-3.5" /> : <Volume2 className="h-3.5 w-3.5" />}
              </button>
              <input 
                type="range" 
                min="0" 
                max="100" 
                value={masterVolume}
                onChange={(e) => setMasterVolume(Number(e.target.value))}
                className="flex-1 h-1 bg-slate-200 dark:bg-slate-800 rounded-full appearance-none outline-none cursor-pointer accent-orange-500 [&::-webkit-slider-thumb]:w-2.5 [&::-webkit-slider-thumb]:h-2.5 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-orange-500 [&::-webkit-slider-thumb]:appearance-none"
              />
              <span className="text-[9px] font-black font-mono w-5 text-right text-slate-500 dark:text-slate-400">{masterVolume}</span>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center min-h-[150px]">
            {spotifyLoading ? (
              <div className="flex flex-col items-center gap-1.5">
                <div className="w-6 h-6 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
                <span className="text-[8px] font-black uppercase text-slate-400">Spotify...</span>
              </div>
            ) : !spotifyToken ? (
              <div className="flex flex-col items-center text-center p-2">
                <SpotifyIcon className="w-10 h-10 text-[#1db954] mb-2 animate-pulse" />
                <p className="text-[9px] font-semibold text-slate-500 dark:text-slate-400 mb-3 leading-snug">
                  Conecte sua conta Spotify pra ouvir suas músicas.
                </p>
                <button
                  onClick={handleSpotifyConnect}
                  className="bg-[#1db954] hover:bg-[#1ed760] text-black rounded-full px-5 py-2 text-[10px] font-black uppercase tracking-wider flex items-center gap-1.5 transition-all active:scale-95 shadow-md shadow-emerald-500/10"
                >
                  <SpotifyIcon className="w-3.5 h-3.5 text-black" />
                  Conectar
                </button>
              </div>
            ) : (
              <div className="w-full space-y-2">
                {!selectedPlaylistId ? (
                  <div className="space-y-1.5">
                    <div className="flex justify-between items-center bg-slate-50/50 dark:bg-slate-950/20 p-1.5 rounded-xl border border-slate-200/60 dark:border-slate-800/60">
                      <span className="text-[8px] font-extrabold text-slate-900 dark:text-white truncate max-w-[150px]">{spotifyUser?.display_name || 'Spotify'}</span>
                      <button onClick={logoutSpotify} className="text-[7.5px] font-black text-rose-450 uppercase">Sair</button>
                    </div>
                    <div className="grid grid-cols-2 gap-1.5 max-h-[120px] overflow-y-auto no-scrollbar">
                      {spotifyPlaylists.map(pl => (
                        <button
                          key={pl.id}
                          onClick={() => setSelectedPlaylistId(pl.id)}
                          className="bg-slate-50 dark:bg-slate-950/40 hover:bg-slate-100 dark:hover:bg-slate-900 border border-slate-200/60 dark:border-slate-800/60 rounded-lg p-1 flex items-center gap-1.5 text-left transition-all truncate"
                        >
                          {pl.image ? (
                            <img src={pl.image} alt={pl.name} className="w-6 h-6 rounded object-cover shrink-0" />
                          ) : (
                            <div className="w-6 h-6 rounded bg-emerald-500/10 text-emerald-500 flex items-center justify-center shrink-0">
                              <Music className="w-3 h-3" />
                            </div>
                          )}
                          <span className="text-[8.5px] font-bold text-slate-900 dark:text-white truncate flex-1">{pl.name}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="space-y-1">
                    <div className="flex justify-between items-center">
                      <span className="text-[7.5px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500">Player Spotify</span>
                      <button onClick={() => setSelectedPlaylistId(null)} className="text-[7.5px] font-black text-slate-450 dark:text-slate-500 hover:text-slate-900 dark:hover:text-white uppercase underline">Playlists</button>
                    </div>
                    <div className="bg-slate-100 dark:bg-black/40 rounded-xl overflow-hidden border border-slate-200 dark:border-slate-800 shadow-inner">
                      <iframe 
                        src={`https://open.spotify.com/embed/playlist/${selectedPlaylistId}`}
                        width="100%" 
                        height="80" 
                        frameBorder="0" 
                        allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture" 
                        loading="lazy"
                      />
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Pomodoro controls in a nice layout */}
      <div className="flex items-center justify-between gap-5 bg-slate-50 dark:bg-slate-950/40 border border-slate-200/60 dark:border-slate-800/60 rounded-[2rem] p-3.5 shrink-0">
        <div 
          onClick={handleCustomTimePrompt}
          className="relative w-14 h-14 flex items-center justify-center shrink-0 cursor-pointer hover:scale-105 transition-transform"
          title="Clique para definir tempo personalizado"
        >
          <svg viewBox="0 0 100 100" className="w-full h-full transform -rotate-90">
            <circle cx="50" cy="50" r="42" stroke="currentColor" strokeWidth="4" fill="transparent" className="text-slate-200 dark:text-slate-800/40" />
            <circle cx="50" cy="50" r="42" stroke="currentColor" strokeWidth="5" fill="transparent"
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

        <div className="flex-1 flex flex-col justify-center gap-1.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1">
              {[15, 25, 45, 60].map(m => (
                <button
                  key={m}
                  onClick={() => setBaseMinutes(m)}
                  className={cn(
                    "px-1.5 py-0.5 rounded text-[8px] font-black uppercase transition-all",
                    baseMinutes === m ? "bg-orange-600 text-white" : "bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700 hover:text-slate-900 dark:hover:text-slate-100"
                  )}
                >
                  {m}m
                </button>
              ))}
            </div>
            <span className="text-[8px] font-bold text-slate-450 dark:text-slate-500">{cycles}c</span>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              onClick={isTimerRunning ? pauseTimer : startTimer}
              className="flex-1 h-9 bg-orange-600 hover:bg-orange-700 text-white font-extrabold uppercase text-[10px] tracking-wider rounded-xl transition-all shadow-lg active:scale-95 flex items-center justify-center gap-1"
            >
              {isTimerRunning ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5 fill-current ml-0.5" />}
              {isTimerRunning ? 'Pausar' : 'Iniciar'}
            </button>
            
            <button
              onClick={resetTimer}
              className="h-9 w-9 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-400 rounded-xl active:scale-95 transition-all shrink-0 flex items-center justify-center"
            >
              <RotateCcw className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Quote display at bottom */}
      <div className="text-center mt-2.5 border-t border-slate-200/60 dark:border-slate-800/60 pt-2 shrink-0">
        <p className="text-[9.5px] italic text-slate-500 dark:text-slate-400 font-semibold leading-relaxed max-w-[280px] mx-auto">
          "{currentQuote}"
        </p>
      </div>
    </div>
  );
}
