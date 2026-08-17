'use client';

import { useState, useEffect } from 'react';
import { Sun, Moon, Palette, Rocket, Sparkles, Terminal, Leaf, Zap, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import { useTheme, ThemeVariant, ThemeMode } from '@/context/ThemeContext';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface ThemeToggleProps {
  className?: string;
}

export function ThemeToggle({ className }: ThemeToggleProps) {
  const { mode, variant, setMode, setVariant } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <div className={cn("w-10 h-10 rounded-xl bg-muted/20 border border-border/40 animate-pulse", className)} />
    );
  }

  const themes: { id: ThemeVariant; name: string; icon: any; color: string }[] = [
    { id: 'default', name: 'Espaço Clássico', icon: Rocket, color: 'text-orange-500' },
    { id: 'nebula', name: 'Nebulosa Cósmica', icon: Sparkles, color: 'text-violet-500' },
    { id: 'cyberpunk', name: 'Cyberpunk Neon', icon: Zap, color: 'text-pink-500' },
    { id: 'midnight', name: 'Midnight Tech', icon: Terminal, color: 'text-blue-500' },
    { id: 'nordic', name: 'Floresta Nórdica', icon: Leaf, color: 'text-emerald-500' },
  ];

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className={cn(
            "relative w-10 h-10 rounded-xl border border-border/40 hover:bg-muted/50 transition-all flex items-center justify-center overflow-hidden active:scale-95 shrink-0 select-none outline-none focus-visible:ring-0 focus-visible:ring-offset-0",
            className
          )}
          title="Personalizar Tema"
        >
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={mode}
              initial={{ y: -20, opacity: 0, rotate: -45 }}
              animate={{ y: 0, opacity: 1, rotate: 0 }}
              exit={{ y: 20, opacity: 0, rotate: 45 }}
              transition={{ duration: 0.2, ease: 'easeInOut' }}
              className="flex items-center justify-center"
            >
              {mode === 'light' ? (
                <Sun className="h-[18px] w-[18px] text-amber-500 fill-amber-500/20" />
              ) : (
                <Moon className="h-[18px] w-[18px] text-blue-400 fill-blue-400/20" />
              )}
            </motion.div>
          </AnimatePresence>
        </Button>
      </DropdownMenuTrigger>
      
      <DropdownMenuContent align="end" className="w-[220px] rounded-2xl border-border/40 bg-white/90 dark:bg-slate-950/90 backdrop-blur-xl shadow-2xl p-2 z-50">
        <DropdownMenuLabel className="text-[10px] font-black uppercase tracking-[0.15em] text-slate-400 dark:text-slate-500 px-2.5 py-2">
          Modo de Cor
        </DropdownMenuLabel>
        
        <DropdownMenuItem
          onClick={() => setMode('light')}
          className={cn(
            "text-xs font-bold gap-2.5 py-2.5 rounded-xl cursor-pointer transition-colors px-2.5",
            mode === 'light' ? "bg-amber-500/10 text-amber-600 dark:text-amber-400" : "text-slate-600 dark:text-slate-400"
          )}
        >
          <Sun className="h-4 w-4 shrink-0 text-amber-500" />
          <span className="flex-1">Modo Claro</span>
          {mode === 'light' && <Check className="h-3.5 w-3.5 shrink-0" />}
        </DropdownMenuItem>

        <DropdownMenuItem
          onClick={() => setMode('dark')}
          className={cn(
            "text-xs font-bold gap-2.5 py-2.5 rounded-xl cursor-pointer transition-colors px-2.5",
            mode === 'dark' ? "bg-blue-500/10 text-blue-600 dark:text-blue-400" : "text-slate-600 dark:text-slate-400"
          )}
        >
          <Moon className="h-4 w-4 shrink-0 text-blue-500" />
          <span className="flex-1">Modo Escuro</span>
          {mode === 'dark' && <Check className="h-3.5 w-3.5 shrink-0" />}
        </DropdownMenuItem>

        <DropdownMenuSeparator className="my-1.5 opacity-40" />

        <DropdownMenuLabel className="text-[10px] font-black uppercase tracking-[0.15em] text-slate-400 dark:text-slate-500 px-2.5 py-2 flex items-center gap-1.5">
          <Palette className="h-3.5 w-3.5 text-slate-400" />
          Estilo Visual
        </DropdownMenuLabel>

        {themes.map((theme) => {
          const Icon = theme.icon;
          const isActive = variant === theme.id;
          return (
            <DropdownMenuItem
              key={theme.id}
              onClick={() => setVariant(theme.id)}
              className={cn(
                "text-xs font-bold gap-2.5 py-2.5 rounded-xl cursor-pointer transition-colors px-2.5",
                isActive ? "bg-primary/10 text-primary" : "text-slate-600 dark:text-slate-400"
              )}
            >
              <Icon className={cn("h-4 w-4 shrink-0", theme.color)} />
              <span className="flex-1">{theme.name}</span>
              {isActive && <Check className="h-3.5 w-3.5 shrink-0" />}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
