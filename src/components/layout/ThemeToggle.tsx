'use client';

import { useState, useEffect } from 'react';
import { Sun, Moon, Monitor, SunMoon, Palette, Rocket, Sparkles, Terminal, Leaf, Zap, Check } from 'lucide-react';
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
  const { mode, resolvedMode, variant, setMode, setVariant } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <div className={cn("w-10 h-10 rounded-xl bg-muted/20 border border-border/40 animate-pulse", className)} />
    );
  }

  const colorModes: { id: ThemeMode; name: string; icon: any; activeColor: string }[] = [
    { id: 'light', name: 'Claro', icon: Sun, activeColor: 'text-amber-500' },
    { id: 'dark', name: 'Escuro', icon: Moon, activeColor: 'text-blue-500' },
    { id: 'system', name: 'Sistema', icon: Monitor, activeColor: 'text-primary' },
  ];

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
              key={resolvedMode}
              initial={{ y: -20, opacity: 0, rotate: -45 }}
              animate={{ y: 0, opacity: 1, rotate: 0 }}
              exit={{ y: 20, opacity: 0, rotate: 45 }}
              transition={{ duration: 0.2, ease: 'easeInOut' }}
              className="flex items-center justify-center"
            >
              {resolvedMode === 'light' ? (
                <Sun className="h-[18px] w-[18px] text-amber-500 fill-amber-500/20" />
              ) : (
                <Moon className="h-[18px] w-[18px] text-blue-400 fill-blue-400/20" />
              )}
            </motion.div>
          </AnimatePresence>

          {mode === 'system' && (
            <span
              className="absolute bottom-1 right-1 h-2 w-2 rounded-full bg-primary ring-2 ring-background"
              title="Seguindo o sistema"
            />
          )}
        </Button>
      </DropdownMenuTrigger>
      
      <DropdownMenuContent align="end" className="w-[220px] rounded-2xl border-border/40 bg-white/90 dark:bg-slate-950/90 backdrop-blur-xl shadow-2xl p-2 z-50">
        <DropdownMenuLabel className="text-[10px] font-black uppercase tracking-[0.15em] text-slate-400 dark:text-slate-500 px-2.5 py-2 flex items-center gap-1.5">
          <SunMoon className="h-3.5 w-3.5 text-slate-400" />
          Modo de Cor
        </DropdownMenuLabel>

        <div className="grid grid-cols-3 gap-1 px-1 pb-1.5">
          {colorModes.map((item) => {
            const Icon = item.icon;
            const isActive = mode === item.id;
            return (
              <DropdownMenuItem
                key={item.id}
                onSelect={(e) => e.preventDefault()}
                onClick={() => setMode(item.id)}
                className={cn(
                  "flex flex-col items-center justify-center gap-1.5 rounded-xl py-2.5 px-1 text-center transition-all cursor-pointer",
                  isActive
                    ? "bg-primary/10 text-primary ring-1 ring-inset ring-primary/30"
                    : "text-slate-600 dark:text-slate-400 hover:bg-muted/60"
                )}
              >
                <Icon className={cn("h-4 w-4 shrink-0", isActive && item.activeColor)} />
                <span className="text-[10px] font-bold leading-none">{item.name}</span>
              </DropdownMenuItem>
            );
          })}
        </div>

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
