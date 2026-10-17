import { CARD_SHADOW } from '@/components/room-kit/tokens';

/** Cartão padrão das páginas: superfície do tema, borda e a sombra suave do desenho. */
export const PAGE_CARD = `rounded-2xl border border-border bg-card text-card-foreground ${CARD_SHADOW}`;

/** Espessura do traço dos ícones de linha (guia de marca: 1,5). */
export const ICON_STROKE = 1.5;

/** Larguras máximas do conteúdo. `default` é a da Home (1680 px). */
export const PAGE_WIDTHS = {
  default: 'max-w-[1680px]',
  narrow: 'max-w-[1120px]',
  wide: 'max-w-[1920px]',
} as const;

export type PageWidth = keyof typeof PAGE_WIDTHS;
