
'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState, useEffect } from 'react';
import { Logo } from '@/components/Logo';
import { Button } from '@/components/ui/button';
import {
  BookOpenText,
  LogOut,
  LogIn,
  UserPlus,
  Settings,
  ChevronDown,
  User,
  LayoutGrid,
  Sparkles,
  Rocket,
  Headphones
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useCalmariaStore } from '@/store/useCalmariaStore';
import { useUserContext } from '@/context/UserContext';
import { PREDEFINED_AVATARS } from '@/lib/types';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { UserProfileModal } from './UserProfileModal';
import NiceAvatar, { genConfig } from 'react-nice-avatar';
import { ThemeToggle } from './ThemeToggle';
import { GlobalProjectSelector } from '@/components/admin/GlobalProjectSelector';


export function Header() {
  const pathname = usePathname();
  const { userProfile, logout, requestIdentity, setIsEditProfileOpen } = useUserContext();
  const { toggleOpen, isTimerRunning, activeSounds } = useCalmariaStore();
  const [isMounted, setIsMounted] = useState(false);
  
  const isFocusActive = isTimerRunning || Object.keys(activeSounds).length > 0;

  useEffect(() => {
    setIsMounted(true);
  }, []);

  // Oculta o header global em módulos que possuem seu próprio cabeçalho ou sidebar dedicada
  const isMinimalLayout =
    pathname === '/' ||
    pathname === '/login' ||
    pathname.startsWith('/jolt') ||
    pathname.startsWith('/manual') ||
    pathname.startsWith('/room') ||
    pathname.startsWith('/retro') ||
    pathname.startsWith('/brainstorming') ||
    pathname.startsWith('/health-check') ||
    pathname.startsWith('/workspace') ||
    pathname.startsWith('/sprint-planner') ||
    pathname.startsWith('/admin') ||
    pathname.startsWith('/devtools') ||
    pathname.startsWith('/showcase') ||
    pathname.startsWith('/daily-flow') ||
    pathname.startsWith('/squad') ||
    pathname.startsWith('/qa') ||
    pathname.startsWith('/knowledge') ||
    pathname.startsWith('/governance') ||
    pathname.startsWith('/changelog') ||
    pathname.startsWith('/support') ||
    pathname.startsWith('/vault') ||
    pathname.startsWith('/prompt-hub') ||
    pathname.startsWith('/dashboards') ||
    pathname.startsWith('/focus') ||
    pathname.startsWith('/action-plan');

  if (isMinimalLayout) {
    return null;
  }

  return (
    <>
      <header className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/70 backdrop-blur-2xl supports-[backdrop-filter]:bg-background/40 shadow-sm">
        <div className="flex h-16 w-full items-center px-6 md:px-10">
          <div className="flex items-center gap-6">
            <Link href="/" className="flex items-center gap-3 group transition-transform">
              <div className="relative flex items-center justify-center h-10 w-10 rounded-xl bg-gradient-to-br from-primary/20 to-primary/5 border border-primary/20 shadow-inner group-hover:scale-105 transition-transform">
                <Rocket className="h-5 w-5 text-primary drop-shadow-md" />
              </div>
              <span className="text-xl font-black tracking-tighter italic font-headline uppercase bg-gradient-to-br from-foreground to-foreground/70 bg-clip-text text-transparent group-hover:opacity-80 transition-opacity">
                Espaço <span className="text-primary not-italic">Ágil</span>
              </span>
            </Link>
          </div>

          <div className="flex flex-1 items-center justify-end gap-3">
            <nav className="hidden md:flex items-center">
              <Button asChild variant="ghost" className="h-9 px-4 text-[11px] font-black uppercase tracking-widest text-muted-foreground hover:text-primary hover:bg-primary/10 rounded-full transition-all border border-transparent hover:border-primary/20 group">
                <Link href="/manual" className="flex items-center gap-2">
                  <BookOpenText className="h-4 w-4 group-hover:scale-110 transition-transform" />
                  <span>Manual</span>
                </Link>
              </Button>
            </nav>

            {/* Calmaria Widget Toggle */}
            <Button
              variant="ghost"
              size="icon"
              onClick={toggleOpen}
              className={cn(
                "h-9 w-9 rounded-xl transition-all relative mr-1",
                isFocusActive 
                  ? "bg-orange-50 hover:bg-orange-100 dark:bg-orange-950/20 text-orange-500 border border-orange-500/30" 
                  : "text-slate-400 hover:text-orange-500 hover:bg-orange-100/50"
              )}
              title="Modo de Foco (Calmaria)"
              aria-label="Toggle Calmaria Focus Mode"
            >
              <Headphones className={cn("h-4.5 w-4.5", isFocusActive && "animate-pulse")} />
              {isFocusActive && (
                <span className="absolute -top-0.5 -right-0.5 flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-orange-400 opacity-75 animate-duration-1000"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-orange-500"></span>
                </span>
              )}
            </Button>

            <GlobalProjectSelector />
            <ThemeToggle />

            {/* Hydration-safe auth area */}
            {!isMounted ? (
              // Placeholder para evitar layout shift durante hidratação
              <div className="w-36 h-9 rounded-md bg-muted/30 animate-pulse" />
            ) : userProfile ? (
              // Logado: Dropdown de Perfil
              <div className="flex items-center gap-3 ml-2 border-l pl-4 border-border/50">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button className="flex items-center gap-2.5 px-3 py-1.5 rounded-full hover:bg-muted/50 transition-all outline-none group border border-transparent hover:border-border/40">
                      <NiceAvatar className="w-8 h-8 rounded-full border border-primary/20 shadow-md shadow-primary/20 shrink-0 group-hover:scale-105 transition-transform bg-primary" {...(PREDEFINED_AVATARS[userProfile.avatarSeed || ''] || genConfig(userProfile.avatarSeed || userProfile.email || userProfile.name))} />
                      <div className="flex flex-col items-start hidden md:flex">
                        <span className="text-[11px] font-black text-foreground uppercase tracking-tight leading-none mb-1">
                          {userProfile.name}
                        </span>
                        <div className="flex items-center gap-1">
                          <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest opacity-60">
                            {userProfile.role || 'Convidado'}
                          </span>
                          <ChevronDown className="h-2.5 w-2.5 text-muted-foreground opacity-40 group-hover:translate-y-0.5 transition-transform" />
                        </div>
                      </div>
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-[200px] border-primary/10 shadow-xl shadow-primary/5 rounded-xl">
                    <DropdownMenuLabel className="text-[10px] font-black uppercase tracking-widest text-muted-foreground px-3 py-2">
                      Sua Conta
                    </DropdownMenuLabel>
                    <DropdownMenuItem
                      onClick={() => setIsEditProfileOpen(true)}
                      className="text-xs font-bold gap-2 py-3 cursor-pointer group"
                    >
                      <Settings className="h-4 w-4 text-primary group-hover:rotate-45 transition-transform" />
                      ⚙️ Meu Perfil
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild className="text-xs font-bold gap-2 py-3 cursor-pointer group">
                      <Link href="/workspace" className="flex items-center w-full">
                        <LayoutGrid className="h-4 w-4 text-primary mr-2 group-hover:scale-110 transition-transform" />
                        Meu Workspace
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuSeparator className="opacity-50" />
                    <DropdownMenuItem
                      onClick={logout}
                      className="text-xs font-bold gap-2 py-3 cursor-pointer text-destructive focus:text-destructive focus:bg-destructive/5"
                    >
                      <LogOut className="h-4 w-4" />
                      Sair / Trocar Usuário
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            ) : (
              // Não logado: Entrar + Cadastrar-se
              <div className="flex items-center gap-2 ml-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => requestIdentity()}
                  className="h-9 px-4 font-black text-[10px] uppercase tracking-widest hidden sm:flex items-center gap-2 hover:bg-muted/50 rounded-full"
                >
                  <LogIn className="h-3.5 w-3.5" />
                  Entrar
                </Button>
                <Button
                  size="sm"
                  onClick={() => requestIdentity()}
                  className="h-9 px-4 font-black text-[10px] uppercase tracking-widest shadow-md hover:shadow-lg shadow-primary/20 hover:shadow-primary/30 flex items-center gap-2 rounded-full transition-all hover:-translate-y-0.5"
                >
                  <Sparkles className="h-3.5 w-3.5" />
                  Começar
                </Button>
              </div>
            )}
          </div>
        </div>
      </header>
    </>
  );
}

