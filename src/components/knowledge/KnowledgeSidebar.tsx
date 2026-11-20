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

export function KnowledgeSidebar({ onSearchClick }: { onSearchClick?: () => void }) {
  const router = useRouter();
  const pathname = usePathname();
  const [isCollapsed, setIsCollapsed] = React.useState(false);

  const menuItems = [
    { label: 'Assistente Virtual', icon: MessageSquare, href: '/knowledge/chat' },
    { label: 'Documentação Wiki', icon: BookMarked, href: '/knowledge/kb' },
  ];



  return (
    <aside
      className={cn(
        "relative h-full bg-card border-r border-border transition-all duration-500 z-30 flex flex-col shadow-[20px_0_40px_rgba(0,0,0,0.02)]",
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
            <div className="w-10 h-10 bg-card rounded-2xl flex items-center justify-center shadow-xl shadow-black/10">
              <Sparkles className="h-5 w-5 text-primary [.theme-totvs:not(.dark)_&]:text-foreground" />
            </div>
            <div className="flex flex-col">
              <span className="text-base font-bold tracking-tighter text-foreground leading-none">Wiki Space</span>
              <span className="text-xs font-bold tracking-normal text-primary [.theme-totvs:not(.dark)_&]:text-foreground leading-none mt-1.5">Central de Documentação</span>
            </div>
          </div>
        )}
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="h-10 w-10 hover:bg-muted/60 rounded-xl transition-all shadow-sm"
        >
          <ChevronLeft className={cn("h-5 w-5 text-muted-foreground transition-transform duration-500", isCollapsed && "rotate-180")} />
        </Button>
      </div>

      {/* Busca Rápida (Trigger) */}
      <div className="px-4 mb-8">
        <button
          onClick={onSearchClick}
          className={cn(
            "w-full flex items-center gap-4 px-5 py-4 rounded-xl bg-muted/40 border border-border hover:border-primary/30 hover:bg-card hover:shadow-2xl hover:shadow-primary/10 transition-all group overflow-hidden",
            isCollapsed && "justify-center px-0 h-14"
          )}
        >
          <Search className="h-6 w-6 text-foreground group-hover:text-primary transition-colors" />
          {!isCollapsed && (
            <div className="flex items-center justify-between flex-1">
              <span className="text-xs font-bold tracking-normal text-foreground group-hover:text-foreground leading-none">Busca Global</span>
              <kbd className="text-xs font-bold bg-card text-primary [.theme-totvs:not(.dark)_&]:text-foreground px-2 py-0.5 rounded-lg border border-border shadow-lg">K</kbd>
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
                  ? "bg-card text-foreground shadow-2xl shadow-black/10"
                  : "text-foreground hover:bg-muted/40 hover:text-foreground border border-transparent hover:border-border"
              )}
            >
              <Icon className={cn(
                "h-6 w-6 transition-transform duration-500 group-hover:scale-110",
                isActive ? "text-primary [.theme-totvs:not(.dark)_&]:text-foreground" : "text-foreground group-hover:text-foreground"
              )} />
              {!isCollapsed && (
                <span className={cn(
                  "text-xs font-bold tracking-normal transition-opacity duration-500",
                  isActive ? "opacity-100" : "opacity-90 group-hover:opacity-100"
                )}>
                  {item.label}
                </span>
              )}
              {isCollapsed && (
                <div className="absolute left-20 bg-card text-foreground text-xs px-3 py-1.5 rounded-xl opacity-0 group-hover:opacity-100 pointer-events-none transition-all duration-300 translate-x-2 group-hover:translate-x-0 whitespace-nowrap z-50 shadow-2xl border border-border font-bold tracking-normal">
                  {item.label}
                </div>
              )}
            </button>
          );
        })}
      </nav>

      {/* Footer / User Profile Summary */}
      <div className="p-4 border-t border-border mb-2">
        <button
          onClick={() => router.push('/knowledge/settings')}
          className={cn(
            "w-full flex items-center gap-4 p-4 rounded-2xl hover:bg-muted/40 border border-transparent hover:border-border transition-all group",
            isCollapsed && "justify-center"
          )}
        >
          <Settings className="h-6 w-6 text-foreground group-hover:text-primary group-hover:rotate-90 transition-all duration-700" />
          {!isCollapsed && (
            <span className="text-xs font-bold tracking-normal text-foreground">Configurações</span>
          )}
        </button>
      </div>
    </aside>
  );
}
