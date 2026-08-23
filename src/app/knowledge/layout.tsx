"use client";

import React, { useState, useMemo } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useRouter, usePathname } from 'next/navigation';
import { GlobalSearch } from '@/components/knowledge/GlobalSearch';
import { 
  ArrowLeft,
  BookMarked, 
  Search, 
  LayoutDashboard, 
  BookOpen, 
  Bot, 
  Settings, 
  Database,
  SearchIcon,
  Plus,
  Headphones
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

import { KnowledgeGuide } from '@/components/knowledge/KnowledgeGuide';
import { HelpCircle } from 'lucide-react';
import { useCalmariaStore } from '@/store/useCalmariaStore';
import { ThemeToggle } from '@/components/layout/ThemeToggle';
import { useUserContext } from '@/context/UserContext';

export default function KnowledgeLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { session, isLoading: isUserLoading } = useAuth();
  const { userProfile, isInitializing } = useUserContext();
  const router = useRouter();
  const pathname = usePathname();
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isGuideOpen, setIsGuideOpen] = useState(false);
  const { isOpen: isFocusActive, toggleOpen } = useCalmariaStore();

  const navItems = [
    { label: 'Base de Conhecimento', path: '/knowledge/kb', icon: BookOpen },
    { label: 'Assistente Virtual', path: '/knowledge/chat', icon: Bot },
    { label: 'Ajustes', path: '/knowledge/settings', icon: Settings },
  ];

  const effectiveUser = session || userProfile;

  // Se não está logado, renderiza apenas o children (a page.tsx cuida da tela de "Identidade Necessária")
  if (!effectiveUser && !isInitializing && !isUserLoading) {
    return <>{children}</>;
  }

  return (
    <div className="flex flex-col h-dvh w-full overflow-hidden bg-white dark:bg-slate-950">
      
      {/* Help Guide (Standard Sheet) */}
      <KnowledgeGuide open={isGuideOpen} onOpenChange={setIsGuideOpen} />
         {/* 1. PORTAL HEADER GLOBAL CONSOLIDADO */}
      <header className="h-[74px] border-b z-50 shrink-0 sticky top-0 flex items-center bg-white/80 dark:bg-slate-950/80 backdrop-blur-2xl border-slate-100 dark:border-slate-800 transition-all duration-500">
        <div className="max-w-[1600px] mx-auto w-full flex items-center justify-between px-8 lg:px-12">
          
          <div className="flex items-center gap-6">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => router.push('/')}
              className="h-10 w-10 rounded-xl border border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-900/40 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 transition-all group"
              title="Voltar ao Início"
            >
              <ArrowLeft className="h-5 w-5 group-hover:-translate-x-1 transition-transform" />
            </Button>
 
            <div className="flex items-center gap-3 cursor-pointer group" onClick={() => router.push('/knowledge')}>
               <div className="w-10 h-10 border rounded-xl flex items-center justify-center shadow-2xl group-hover:scale-110 transition-transform duration-500 bg-slate-900 dark:bg-slate-950 border-slate-950 dark:border-slate-800 text-white">
                  <BookMarked className="h-5 w-5 text-cyan-400" />
               </div>
               <div className="flex flex-col">
                  <span className="text-lg font-black font-headline uppercase tracking-tighter italic leading-none transition-colors text-slate-900 dark:text-slate-100">
                    Wiki <span className="text-cyan-500 not-italic">Space</span>
                  </span>
                  <span className="text-[8px] font-black uppercase tracking-[0.3em] text-slate-500 dark:text-slate-400 leading-none mt-1">
                    Knowledge Hub
                  </span>
               </div>
            </div>
 
            <div className="hidden lg:flex h-8 w-[1px] mx-2 transition-colors bg-slate-100 dark:bg-slate-800" />
 
            <nav className="hidden xl:flex items-center gap-1">
              {navItems.map((item) => {
                const isActive = pathname === item.path || (item.path !== '/knowledge' && pathname.startsWith(item.path));
                return (
                  <button
                    key={item.path}
                    onClick={() => router.push(item.path)}
                    className={cn(
                      "px-4 h-10 rounded-xl relative flex items-center gap-2 text-[9px] font-black uppercase tracking-widest transition-all whitespace-nowrap",
                      isActive 
                        ? "bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 shadow-xl shadow-slate-200 dark:shadow-none"
                        : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-50 dark:hover:bg-slate-900/40"
                    )}
                  >
                    <item.icon className={cn("h-4 w-4", isActive ? "text-cyan-400" : "text-slate-500")} />
                    {item.label}
                  </button>
                );
              })}
            </nav>
          </div>
 
          <div className="flex items-center gap-6">
            {/* Busca Global Compacta */}
            <div 
               onClick={() => setIsSearchOpen(true)}
               className="relative group w-64 hidden md:flex items-center border rounded-xl h-10 px-4 cursor-text transition-all bg-slate-50 dark:bg-slate-900/40 border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700"
            >
              <Search className="h-4 w-4 text-slate-600 dark:text-slate-400 mr-3" />
              <span className="text-[10px] font-bold text-slate-600 dark:text-slate-400">Pesquisar Wiki...</span>
              <kbd className="ml-auto text-[9px] font-black px-1.5 py-0.5 rounded border transition-colors bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400">⌘K</kbd>
            </div>
 
            <div className="flex items-center gap-3">
                {/* Calmaria Focus Button */}
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={toggleOpen}
                  className={cn(
                    "h-10 w-10 border rounded-xl transition-all relative bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800",
                    isFocusActive 
                      ? "bg-orange-50 hover:bg-orange-100 dark:bg-orange-950/20 text-orange-500 border border-orange-500/30" 
                      : "text-slate-600 hover:text-orange-500 dark:text-slate-400 dark:hover:text-slate-100 hover:bg-slate-50 dark:hover:bg-slate-900/40"
                  )}
                  title="Modo de Foco (Calmaria)"
                >
                  <Headphones className={cn("h-4.5 w-4.5", isFocusActive && "animate-pulse")} />
                  {isFocusActive && (
                    <span className="absolute -top-0.5 -right-0.5 flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-orange-400 opacity-75 animate-duration-1000"></span>
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-orange-500"></span>
                    </span>
                  )}
                </Button>
 
                {/* Theme Switcher Toggle */}
                <ThemeToggle className="h-10 w-10 border rounded-xl bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-50 dark:hover:bg-slate-900/40" />
 
                <button 
                  onClick={() => setIsGuideOpen(true)}
                  className="h-10 w-10 rounded-xl border flex items-center justify-center transition-all bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-50 dark:hover:bg-slate-900/40"
                >
                  <HelpCircle className="h-5 w-5" />
                </button>
                <Button onClick={() => router.push('/knowledge/admin/new-asset')} className="h-10 px-6 bg-cyan-600 hover:bg-cyan-500 text-white text-[9px] font-black uppercase tracking-widest rounded-xl shadow-xl shadow-cyan-900/20 gap-2 transition-all active:scale-95">
                   <Plus className="h-3.5 w-3.5" /> Criar
                </Button>
            </div>
          </div>
        </div>
      </header>
 
      {/* 3. MAIN CONTENT AREA */}
      <main className="flex-1 overflow-hidden relative flex flex-col">
        {/* Global Search Component */}
        <GlobalSearch open={isSearchOpen} onOpenChange={setIsSearchOpen} />
        
        {/* Decorative Gradient Background (Silent) */}
        <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-cyan-500/5 rounded-full blur-[120px] -z-10 pointer-events-none" />
        
        <div className="flex-1 overflow-y-auto w-full relative">
          {children}
        </div>
      </main>
    </div>
  );
}
