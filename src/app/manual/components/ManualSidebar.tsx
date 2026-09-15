'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { 
  MANUAL_CATEGORIES, 
  MANUAL_TOPICS, 
  ManualCategory 
} from '../data/topics';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  BookOpen, 
  Search, 
  ChevronRight, 
  Sparkles, 
  X,
  Compass,
  ArrowUpRight
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface ManualSidebarProps {
  className?: string;
  onNavigate?: () => void;
}

export function ManualSidebar({ className, onNavigate }: ManualSidebarProps) {
  const pathname = usePathname();
  const [searchQuery, setSearchQuery] = useState('');

  const filteredTopics = MANUAL_TOPICS.filter((topic) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      topic.title.toLowerCase().includes(q) ||
      topic.subtitle.toLowerCase().includes(q) ||
      topic.description.toLowerCase().includes(q)
    );
  });

  const isTopicActive = (topicId: string) => {
    return pathname === `/manual/${topicId}`;
  };

  return (
    <aside className={cn("w-72 flex flex-col border-r border-slate-200/80 dark:border-slate-800 bg-white/70 dark:bg-slate-900/70 backdrop-blur-xl h-full", className)}>
      {/* Brand & Guide Subtitle */}
      <div className="p-5 border-b border-slate-200/60 dark:border-slate-800/60 flex flex-col gap-3">
        <Link 
          href="/manual" 
          onClick={onNavigate}
          className="flex items-center gap-3 group"
        >
          <div className="w-9 h-9 rounded-xl bg-primary flex items-center justify-center text-white shadow-md shadow-primary/25 group-hover:scale-105 transition-transform">
            <BookOpen className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-xs font-black uppercase tracking-tight text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
              Engineering Guide
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            </h2>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
              Manual Espaço Ágil
            </p>
          </div>
        </Link>

        {/* Live Search Input */}
        <div className="relative mt-1">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400 pointer-events-none" />
          <Input 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Buscar guia ou tópico..."
            className="pl-9 pr-8 h-9 text-xs rounded-xl bg-slate-100/80 dark:bg-slate-800/80 border-slate-200/60 dark:border-slate-700/60 focus-visible:ring-1 focus-visible:ring-primary font-medium"
          />
          {searchQuery && (
            <button 
              onClick={() => setSearchQuery('')}
              className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      {/* Topics Navigation Tree */}
      <ScrollArea className="flex-1 px-3 py-4">
        {/* Visão Geral (Root) */}
        <div className="mb-4">
          <Link
            href="/manual"
            onClick={onNavigate}
            className={cn(
              "flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-xs font-bold transition-all group",
              pathname === '/manual'
                ? "bg-primary text-white shadow-md shadow-primary/20"
                : "text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800/60"
            )}
          >
            <Compass className={cn("h-4 w-4 shrink-0", pathname === '/manual' ? "text-white" : "text-slate-400 group-hover:text-primary")} />
            <span className="flex-1 truncate">Visão Geral & Índice</span>
            {pathname === '/manual' && <ChevronRight className="h-3 w-3 text-white/70" />}
          </Link>
        </div>

        {/* If searching, display flat list */}
        {searchQuery.trim() ? (
          <div className="space-y-1">
            <p className="px-3 text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">
              Resultados ({filteredTopics.length})
            </p>
            {filteredTopics.length === 0 ? (
              <div className="p-6 text-center text-xs text-slate-400 font-medium">
                Nenhum tópico encontrado para &quot;{searchQuery}&quot;
              </div>
            ) : (
              filteredTopics.map((topic) => {
                const Icon = topic.icon;
                const active = isTopicActive(topic.id);
                return (
                  <Link
                    key={topic.id}
                    href={`/manual/${topic.id}`}
                    onClick={onNavigate}
                    className={cn(
                      "flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-bold transition-all group",
                      active
                        ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-sm"
                        : "text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800/60"
                    )}
                  >
                    <Icon className={cn("h-4 w-4 shrink-0", active ? (pathname.includes('/manual') ? "text-primary" : topic.color) : topic.color)} />
                    <span className="flex-1 truncate">{topic.title}</span>
                    <ChevronRight className={cn("h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity", active && "opacity-100")} />
                  </Link>
                );
              })
            )}
          </div>
        ) : (
          /* Grouped by Category */
          <div className="space-y-6">
            {MANUAL_CATEGORIES.map((category) => {
              const categoryTopics = MANUAL_TOPICS.filter((t) => t.category === category.id);
              if (categoryTopics.length === 0) return null;

              return (
                <div key={category.id} className="space-y-1.5">
                  <div className="px-3 py-1">
                    <p className="text-[10px] font-black uppercase tracking-wider text-slate-400 dark:text-slate-500">
                      {category.label}
                    </p>
                  </div>

                  <div className="space-y-1">
                    {categoryTopics.map((topic) => {
                      const Icon = topic.icon;
                      const active = isTopicActive(topic.id);
                      return (
                        <Link
                          key={topic.id}
                          href={`/manual/${topic.id}`}
                          onClick={onNavigate}
                          className={cn(
                            "flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold transition-all group",
                            active
                              ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-sm font-bold"
                              : "text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800/60"
                          )}
                        >
                          <div className={cn(
                            "w-6 h-6 rounded-lg flex items-center justify-center transition-transform group-hover:scale-110",
                            active ? "bg-white/10 dark:bg-slate-900/10" : "bg-slate-100 dark:bg-slate-800"
                          )}>
                            <Icon className={cn("h-3.5 w-3.5", topic.color)} />
                          </div>
                          <span className="flex-1 truncate text-[11px]">{topic.title}</span>
                          {active && <ChevronRight className="h-3 w-3 opacity-80" />}
                        </Link>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </ScrollArea>

      {/* Footer / Quick Out */}
      <div className="p-4 border-t border-slate-200/60 dark:border-slate-800/60 bg-slate-50/50 dark:bg-slate-950/30">
        <Button 
          asChild 
          variant="outline" 
          size="sm" 
          className="w-full h-9 rounded-xl font-black uppercase text-[10px] tracking-widest text-slate-600 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-800"
        >
          <Link href="/" onClick={onNavigate} className="flex items-center justify-center gap-2">
            <span>Voltar à Plataforma</span>
            <ArrowUpRight className="h-3.5 w-3.5 opacity-60" />
          </Link>
        </Button>
      </div>
    </aside>
  );
}
