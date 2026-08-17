'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { 
  ChevronDown, 
  Settings, 
  LogOut, 
  BookOpen, 
  Home,
  LayoutGrid,
  MessageSquareHeart,
  Headphones
} from 'lucide-react';
import { useUserContext } from '@/context/UserContext';
import { useCalmariaStore } from '@/store/useCalmariaStore';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import NiceAvatar, { genConfig } from 'react-nice-avatar';
import { PREDEFINED_AVATARS } from '@/lib/types';
import { cn } from '@/lib/utils';
import { ThemeToggle } from './ThemeToggle';

interface RoomHeaderProps {
  title: string;
  toolIcon: React.ReactNode;
  actions?: React.ReactNode;
  toolColorClass?: string;
  badge?: React.ReactNode;
  onOpenFeedback?: () => void;
  isEditable?: boolean;
  onTitleChange?: (newTitle: string) => void;
}

export function RoomHeader({ 
  title, 
  toolIcon, 
  actions, 
  toolColorClass = "text-primary text-blue-600", 
  badge, 
  onOpenFeedback,
  isEditable = false,
  onTitleChange
}: RoomHeaderProps) {
  const router = useRouter();
  const { userProfile, logout, setIsEditProfileOpen, requestIdentity } = useUserContext();
  const { toggleOpen, isTimerRunning, activeSounds } = useCalmariaStore();
  const [isMounted, setIsMounted] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [localTitle, setLocalTitle] = useState(title);
  
  const isFocusActive = isTimerRunning || Object.keys(activeSounds).length > 0;

  useEffect(() => {
    setIsMounted(true);
  }, []);

  useEffect(() => {
    setLocalTitle(title);
  }, [title]);

  const handleTitleSubmit = () => {
    setIsEditing(false);
    if (localTitle.trim() && localTitle !== title) {
      onTitleChange?.(localTitle.trim());
    }
  };

  return (
    <header className="sticky top-0 z-50 w-full animate-in fade-in slide-in-from-top-2 duration-500">
      <div className="bg-white/70 dark:bg-slate-900/70 backdrop-blur-2xl border-b border-white/60 dark:border-slate-800/60 h-12 flex items-center justify-between px-4 md:px-6 shadow-sm">
        
        {/*
          Lado Esquerdo: Breadcrumb / Logo / Título.
          `min-w-0` + `shrink` reais: sem isso o bloco do título não encolhia,
          as ações da direita transbordavam e o botão de home acabava colado
          no primeiro controle da tool (o cronômetro, na sala de poker).
        */}
        <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1 mr-2">
          <Link 
            href="/" 
            className="p-2 rounded-xl hover:bg-slate-100/50 dark:hover:bg-slate-800/50 transition-colors text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 group shrink-0 relative z-50"
            title="Ir para Home"
            aria-label="Voltar para a página inicial"
          >
            <Home className="h-4 w-4" aria-hidden="true" />
          </Link>
          
          <div className="w-px h-6 bg-slate-200 dark:bg-slate-800 shrink-0 hidden sm:block" aria-hidden="true" />

          <div className="flex items-center gap-2.5 sm:pl-1.5 overflow-hidden min-w-0">
            {/* Abaixo de sm o ícone da tool cede o lugar para o nome da sala:
                saber onde se está vale mais que o enfeite. */}
            <div className={cn("w-8 h-8 rounded-xl bg-slate-50 dark:bg-slate-950 hidden sm:flex items-center justify-center shadow-inner shrink-0", toolColorClass)} aria-hidden="true">
               {toolIcon}
            </div>
            <div className="flex items-center gap-2 min-w-0">
               {isEditable && isEditing ? (
                 <input
                   autoFocus
                   value={localTitle}
                   onChange={(e) => setLocalTitle(e.target.value)}
                   onBlur={handleTitleSubmit}
                   onKeyDown={(e) => e.key === 'Enter' && handleTitleSubmit()}
                   className="text-xs font-black uppercase tracking-tighter text-slate-900 dark:text-slate-100 bg-slate-100 dark:bg-slate-850 px-2 py-1 rounded-lg outline-none w-full"
                 />
               ) : (
                 <div 
                   onClick={() => isEditable && setIsEditing(true)}
                   className={cn(
                     "text-xs font-black uppercase tracking-tighter text-slate-900 dark:text-slate-100 truncate",
                     isEditable && "cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800 px-2 py-1 rounded-lg transition-colors"
                   )}
                 >
                    {title}
                 </div>
               )}
               {badge}
            </div>
          </div>
        </div>

        {/* Lado Direito: Ações customizadas + Perfil */}
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          
          {/* Custom Tool Actions (Share, Settings, Toggle Sound, etc) */}
          <div className="flex items-center gap-1.5">
             {actions}
          </div>

          {/* Calmaria Widget Toggle */}
          <Button
            variant="ghost"
            size="icon"
            onClick={toggleOpen}
            className={cn(
              // Some abaixo de md: em telas estreitas o título da sala não
              // sobrava espaço nenhum, e foco/feedback não são de uso constante.
              "h-8 w-8 rounded-xl transition-all relative hidden md:inline-flex",
              isFocusActive
                ? "bg-orange-50 hover:bg-orange-100 dark:bg-orange-950/20 text-orange-500 border border-orange-500/30" 
                : "text-slate-400 hover:text-orange-500 hover:bg-orange-100/50 dark:hover:bg-slate-850/50"
            )}
            title="Modo de Foco (Calmaria)"
            aria-label="Toggle Calmaria Focus Mode"
          >
            <Headphones className={cn("h-4 w-4", isFocusActive && "animate-pulse")} />
            {isFocusActive && (
              <span className="absolute -top-0.5 -right-0.5 flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-orange-400 opacity-75 animate-duration-1000"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-orange-500"></span>
              </span>
            )}
          </Button>

          {/* Theme Toggle */}
          <ThemeToggle className="h-8 w-8 rounded-xl border-none hover:bg-slate-100/50 dark:hover:bg-slate-800/50 text-slate-400 hover:text-slate-900 transition-all dark:text-slate-300 dark:hover:text-slate-100" />

          <div className="w-px h-6 bg-slate-200 dark:bg-slate-800 mx-1 hidden sm:block" aria-hidden="true" />

          {/* Feedback Button */}
          {onOpenFeedback && (
            <Button
              variant="ghost"
              size="icon"
              onClick={onOpenFeedback}
              className="h-8 w-8 text-slate-400 hover:text-orange-500 hover:bg-orange-100/50 dark:hover:bg-slate-850/50 rounded-xl transition-all hidden md:inline-flex"
              title="Sugerir Melhoria"
              aria-label="Sugerir uma melhoria ou dar feedback"
            >
              <MessageSquareHeart className="h-4 w-4" aria-hidden="true" />
            </Button>
          )}

          {/* Profile Dropdown */}
          {isMounted && userProfile ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button 
                  className="group flex items-center gap-2.5 pl-2.5 pr-1.5 py-1 rounded-2xl hover:bg-slate-100/50 dark:hover:bg-slate-800/50 transition-all border border-transparent hover:border-slate-200 dark:hover:border-slate-800"
                  aria-label={`Menu do usuário: ${userProfile.name}`}
                >
                  <div className="flex flex-col items-end hidden md:flex" aria-hidden="true">
                    <span className="text-[9px] font-black uppercase text-slate-800 dark:text-slate-200 leading-none">{userProfile.name.split(' ')[0]}</span>
                    <span className="text-[8px] font-bold text-slate-400 dark:text-slate-550 uppercase tracking-widest mt-0.5">{userProfile.role ? userProfile.role.split(' ')[0] : 'Convidado'}</span>
                  </div>
                  <NiceAvatar className="w-8 h-8 rounded-xl bg-slate-900 border-2 border-white shadow-md shadow-slate-200 group-hover:scale-105 transition-transform" {...(PREDEFINED_AVATARS[userProfile.avatarSeed || ''] || genConfig(userProfile.avatarSeed || userProfile.email || userProfile.name))} />
                  <ChevronDown className="h-3 w-3 text-slate-300 group-hover:text-slate-900 transition-colors" aria-hidden="true" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-[220px] rounded-[1.5rem] border-none shadow-[0_24px_48px_-12px_rgba(0,0,0,0.15)] p-2 bg-white/95 backdrop-blur-xl mt-2">
                <DropdownMenuLabel className="text-[9px] font-black uppercase tracking-widest text-slate-400 p-2">Configurações</DropdownMenuLabel>
                <DropdownMenuItem onClick={() => setIsEditProfileOpen(true)} className="rounded-xl font-bold text-xs p-3 cursor-pointer gap-2 transition-colors hover:bg-slate-50">
                  <Settings className="h-4 w-4 text-primary" aria-hidden="true" /> Meu Perfil
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => router.push('/workspace')} className="rounded-xl font-bold text-xs p-3 cursor-pointer gap-2 transition-colors hover:bg-slate-50">
                  <LayoutGrid className="h-4 w-4 text-primary" aria-hidden="true" /> Meu Workspace
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => router.push('/manual')} className="rounded-xl font-bold text-xs p-3 cursor-pointer gap-2 transition-colors hover:bg-slate-50">
                  <BookOpen className="h-4 w-4 text-primary" aria-hidden="true" /> Manual de Uso
                </DropdownMenuItem>
                <div className="h-px bg-slate-100 my-2 mx-2" aria-hidden="true" />
                <DropdownMenuItem onClick={logout} className="rounded-xl font-bold text-xs p-3 text-red-500 hover:bg-red-50 cursor-pointer gap-2">
                  <LogOut className="h-4 w-4" aria-hidden="true" /> Sair da Conta
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <Button size="sm" onClick={() => requestIdentity()} className="rounded-xl font-black uppercase text-[9px] tracking-widest px-4 h-9 shadow-lg shadow-primary/20">
              Entrar
            </Button>
          )}
        </div>
      </div>
    </header>
  );
}
