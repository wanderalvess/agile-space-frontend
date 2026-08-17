"use client";

import React from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import {
  LayoutDashboard,
  MessageSquare,
  BookMarked,
  Settings,
  ChevronLeft,
  Sparkles,
  ShieldCheck,
  Search
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useUserContext } from '@/context/UserContext';

export function KnowledgeSidebar({ onSearchClick }: { onSearchClick?: () => void }) {
  const router = useRouter();
  const pathname = usePathname();
  const { userProfile } = useUserContext();
  const [isCollapsed, setIsCollapsed] = React.useState(false);

  const isAdmin = userProfile?.role === 'admin';

  const menuItems = [
    { label: 'Assistente Virtual', icon: MessageSquare, href: '/knowledge/chat' },
    { label: 'Documentação Wiki', icon: BookMarked, href: '/knowledge/kb' },
  ];



  return (
    <aside
      className={cn(
        "relative h-full bg-white border-r border-slate-200 transition-all duration-500 z-30 flex flex-col shadow-[20px_0_40px_rgba(0,0,0,0.02)]",
        isCollapsed ? "w-20" : "w-72"
      )}
    >
      {/* Header do Sidebar */}
      <div className={cn(
        "p-6 flex items-center mb-4 transition-all duration-500",
        isCollapsed ? "justify-center" : "justify-between"
      )}>
        {!isCollapsed && (
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 bg-slate-900 rounded-2xl flex items-center justify-center shadow-xl shadow-slate-900/20">
              <Sparkles className="h-5 w-5 text-cyan-400" />
            </div>
            <div className="flex flex-col">
              <span className="text-base font-black uppercase tracking-tighter text-slate-900 italic leading-none">Wiki Space</span>
              <span className="text-[9px] font-black uppercase tracking-widest text-cyan-600 leading-none mt-1.5">Central de Documentação</span>
            </div>
          </div>
        )}
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="h-10 w-10 hover:bg-slate-100 rounded-xl transition-all shadow-sm"
        >
          <ChevronLeft className={cn("h-5 w-5 text-slate-600 transition-transform duration-500", isCollapsed && "rotate-180")} />
        </Button>
      </div>

      {/* Busca Rápida (Trigger) */}
      <div className="px-4 mb-8">
        <button
          onClick={onSearchClick}
          className={cn(
            "w-full flex items-center gap-4 px-5 py-4 rounded-[1.5rem] bg-slate-50 border border-slate-200 hover:border-cyan-400 hover:bg-white hover:shadow-2xl hover:shadow-cyan-500/10 transition-all group overflow-hidden",
            isCollapsed && "justify-center px-0 h-14"
          )}
        >
          <Search className="h-6 w-6 text-slate-700 group-hover:text-cyan-600 transition-colors" />
          {!isCollapsed && (
            <div className="flex items-center justify-between flex-1">
              <span className="text-[11px] font-black uppercase tracking-widest text-slate-900 group-hover:text-slate-900 leading-none">Busca Global</span>
              <kbd className="text-[10px] font-black bg-slate-900 text-cyan-400 px-2 py-0.5 rounded-lg border border-slate-700 shadow-lg">K</kbd>
            </div>
          )}
        </button>
      </div>

      {/* Navegação */}
      <nav className="flex-1 px-4 space-y-2">
        {menuItems.map((item) => {
          const isActive = pathname === item.href || (item.href !== '/knowledge' && pathname.startsWith(item.href));
          const Icon = item.icon;

          return (
            <button
              key={item.href}
              onClick={() => router.push(item.href)}
              className={cn(
                "w-full flex items-center gap-4 px-5 py-4 rounded-[1.25rem] transition-all group overflow-hidden relative",
                isActive
                  ? "bg-slate-900 text-white shadow-2xl shadow-slate-900/20"
                  : "text-slate-800 hover:bg-slate-50 hover:text-slate-900 border border-transparent hover:border-slate-100"
              )}
            >
              <Icon className={cn(
                "h-6 w-6 transition-transform duration-500 group-hover:scale-110",
                isActive ? "text-cyan-400" : "text-slate-700 group-hover:text-slate-900"
              )} />
              {!isCollapsed && (
                <span className={cn(
                  "text-[11px] font-black uppercase tracking-widest transition-opacity duration-500",
                  isActive ? "opacity-100" : "opacity-90 group-hover:opacity-100"
                )}>
                  {item.label}
                </span>
              )}
              {isCollapsed && (
                <div className="absolute left-20 bg-slate-900 text-white text-[11px] px-3 py-1.5 rounded-xl opacity-0 group-hover:opacity-100 pointer-events-none transition-all duration-300 translate-x-2 group-hover:translate-x-0 whitespace-nowrap z-50 shadow-2xl border border-slate-700 font-bold uppercase tracking-widest">
                  {item.label}
                </div>
              )}
            </button>
          );
        })}
      </nav>

      {/* Footer / User Profile Summary */}
      <div className="p-4 border-t border-slate-100 mb-2">
        <button
          onClick={() => router.push('/knowledge/settings')}
          className={cn(
            "w-full flex items-center gap-4 p-4 rounded-2xl hover:bg-slate-50 border border-transparent hover:border-slate-100 transition-all group",
            isCollapsed && "justify-center"
          )}
        >
          <Settings className="h-6 w-6 text-slate-700 group-hover:text-cyan-600 group-hover:rotate-90 transition-all duration-700" />
          {!isCollapsed && (
            <span className="text-[10px] font-black uppercase tracking-widest text-slate-700">Configurações</span>
          )}
        </button>
      </div>
    </aside>
  );
}
