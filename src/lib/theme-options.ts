import { BookOpen, Hexagon, Leaf, Monitor, Moon, Orbit, Sparkles, Sun, Terminal, Zap, type LucideIcon } from 'lucide-react';
import type { ThemeMode, ThemeVariant } from '@/context/ThemeContext';

/** Opções de aparência compartilhadas pelo ThemeToggle e pela página de configurações. */

export const THEME_MODES: { id: ThemeMode; name: string; icon: LucideIcon; activeColor: string }[] = [
  { id: 'light', name: 'Claro', icon: Sun, activeColor: 'text-amber-500' },
  { id: 'dark', name: 'Escuro', icon: Moon, activeColor: 'text-blue-500' },
  { id: 'system', name: 'Sistema', icon: Monitor, activeColor: 'text-primary' },
];

export const THEME_VARIANTS: { id: ThemeVariant; name: string; icon: LucideIcon; color: string }[] = [
  { id: 'midnight', name: 'Midnight Tech', icon: Terminal, color: 'text-blue-500' },
  { id: 'totvs', name: 'TOTVS', icon: Hexagon, color: 'text-cyan-500' },
  { id: 'leitura', name: 'Leitura confortável', icon: BookOpen, color: 'text-slate-500' },
  { id: 'default', name: 'Espaço Clássico', icon: Orbit, color: 'text-orange-500' },
  { id: 'nebula', name: 'Nebulosa Cósmica', icon: Sparkles, color: 'text-violet-500' },
  { id: 'cyberpunk', name: 'Cyberpunk Neon', icon: Zap, color: 'text-pink-500' },
  { id: 'nordic', name: 'Floresta Nórdica', icon: Leaf, color: 'text-emerald-500' },
];

export interface ThemeSwatch {
  /** Valores HSL no formato "H S% L%" (mesmo formato das variáveis do globals.css). */
  background: string;
  card: string;
  foreground: string;
  primary: string;
}

/**
 * Amostras de paleta para a prévia. Espelham os blocos de tema do globals.css (a prévia mostra um tema
 * que não está aplicado, então não dá para ler as variáveis vivas). Se uma paleta mudar lá, atualize aqui.
 */
export const THEME_SWATCHES: Record<ThemeVariant, { light: ThemeSwatch; dark: ThemeSwatch }> = {
  default: {
    light: { background: '210 40% 98%', card: '0 0% 100%', foreground: '222 47% 11%', primary: '17 88% 40%' },
    dark: { background: '222 84% 5%', card: '222 47% 11%', foreground: '210 40% 98%', primary: '25 100% 50%' },
  },
  nebula: {
    light: { background: '262 45% 98%', card: '262 40% 99.5%', foreground: '262 40% 12%', primary: '262 83% 58%' },
    dark: { background: '240 25% 4%', card: '240 20% 8%', foreground: '210 40% 98%', primary: '262 90% 68%' },
  },
  cyberpunk: {
    light: { background: '327 55% 98%', card: '0 0% 100%', foreground: '300 35% 12%', primary: '327 83% 41%' },
    dark: { background: '280 100% 1.5%', card: '280 60% 4.5%', foreground: '180 100% 90%', primary: '327 100% 54%' },
  },
  midnight: {
    light: { background: '217 50% 98%', card: '0 0% 100%', foreground: '217 45% 12%', primary: '221 83% 50%' },
    dark: { background: '0 0% 2%', card: '0 0% 5.5%', foreground: '210 40% 98%', primary: '217 91% 60%' },
  },
  nordic: {
    light: { background: '140 15% 98%', card: '140 10% 95%', foreground: '155 50% 10%', primary: '155 50% 25%' },
    dark: { background: '155 20% 8%', card: '155 15% 12%', foreground: '140 20% 95%', primary: '156 51% 46%' },
  },
  totvs: {
    light: { background: '200 28% 96%', card: '0 0% 100%', foreground: '200 100% 10%', primary: '189 100% 50%' },
    dark: { background: '200 100% 10%', card: '203 75% 16%', foreground: '195 80% 97%', primary: '189 100% 50%' },
  },
  leitura: {
    light: { background: '214 22% 96%', card: '0 0% 100%', foreground: '221 39% 11%', primary: '224 76% 48%' },
    dark: { background: '214 18% 8%', card: '215 18% 13%', foreground: '210 20% 98%', primary: '213 94% 78%' },
  },
};
