import { AlertCircle, CheckCircle2, CircleDot, Heart, Info, ListChecks, Zap, type LucideIcon } from 'lucide-react';
import { BRAND_TEXT } from '@/components/room-kit/tokens';
import type { RetroColumnTheme } from '@/lib/types';

/**
 * Cor de cada tipo de coluna da retro. A coluna de ação usa a cor da marca (`primary`), então acompanha os 7
 * temas; as demais são categorias (bom, atenção, ideia, carinho, nota) com par claro/escuro, como os tons do kit.
 * Classes escritas por inteiro: o Tailwind só gera o que encontra no código.
 */
export interface ColumnTone {
  icon: LucideIcon;
  /** Filete de 3 px no topo da coluna. */
  top: string;
  /** Texto e ícone da cor. */
  text: string;
  /** Placa do ícone e chips da cor. */
  tint: string;
  /** Barrinha do formato no "Nova retro". */
  bar: string;
}

export const COLUMN_TONES: Record<RetroColumnTheme, ColumnTone> = {
  success: {
    icon: CheckCircle2,
    top: 'border-t-emerald-500',
    text: 'text-emerald-700 dark:text-emerald-300',
    tint: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300',
    bar: 'bg-emerald-500',
  },
  warning: {
    icon: AlertCircle,
    top: 'border-t-amber-500',
    text: 'text-amber-700 dark:text-amber-300',
    tint: 'bg-amber-500/10 text-amber-700 dark:text-amber-300',
    bar: 'bg-amber-500',
  },
  action: {
    icon: ListChecks,
    top: 'border-t-primary',
    text: BRAND_TEXT,
    tint: 'bg-primary/10 dark:bg-primary/15 text-primary [.theme-totvs:not(.dark)_&]:text-foreground',
    bar: 'bg-primary',
  },
  neutral: {
    icon: CircleDot,
    top: 'border-t-muted-foreground/60',
    text: 'text-muted-foreground',
    tint: 'bg-muted text-muted-foreground',
    bar: 'bg-muted-foreground/60',
  },
  purple: {
    icon: Zap,
    top: 'border-t-violet-500',
    text: 'text-violet-700 dark:text-violet-300',
    tint: 'bg-violet-500/10 text-violet-700 dark:text-violet-300',
    bar: 'bg-violet-500',
  },
  pink: {
    icon: Heart,
    top: 'border-t-pink-500',
    text: 'text-pink-700 dark:text-pink-300',
    tint: 'bg-pink-500/10 text-pink-700 dark:text-pink-300',
    bar: 'bg-pink-500',
  },
  cyan: {
    icon: Info,
    top: 'border-t-cyan-500',
    text: 'text-cyan-700 dark:text-cyan-300',
    tint: 'bg-cyan-500/10 text-cyan-700 dark:text-cyan-300',
    bar: 'bg-cyan-500',
  },
};

export const columnTone = (theme?: RetroColumnTheme): ColumnTone => COLUMN_TONES[theme ?? 'neutral'] ?? COLUMN_TONES.neutral;

/** O que escrever em cada tipo de coluna quando ela está vazia (um convite, não um "silêncio" genérico). */
export const COLUMN_EMPTY_COPY: Record<RetroColumnTheme, { title: string; hint: string }> = {
  success: { title: 'Nenhuma vitória ainda', hint: 'O que deu certo e merece ser repetido?' },
  warning: { title: 'Nada travando por aqui', hint: 'O que atrapalhou ou pode melhorar?' },
  action: { title: 'Nenhuma ação ainda', hint: 'O que vamos fazer a respeito, e quem leva?' },
  neutral: { title: 'Coluna vazia', hint: 'Compartilhe o primeiro ponto desta coluna.' },
  purple: { title: 'Nenhuma ideia ainda', hint: 'Que novas ideias o time quer experimentar?' },
  pink: { title: 'Nenhum reconhecimento ainda', hint: 'Quem ou o que merece um agradecimento?' },
  cyan: { title: 'Nenhuma nota ainda', hint: 'Algum contexto que o time precisa saber?' },
};
