import { CARD_SHADOW, FIELD } from '@/components/room-kit';

/** Espessura do traço dos ícones de linha da tela (guia de marca: 1,5). */
export const ICON_STROKE = 1.5;

/** Cartão da tela: superfície do tema, borda e sombra do kit. */
export const ROSTER_CARD = `rounded-2xl border border-border bg-card text-card-foreground ${CARD_SHADOW}`;

/** Campo de texto (altura 40) e versão compacta (altura 32) para células de tabela. */
export const FIELD_40 = `${FIELD} h-10`;
export const FIELD_32 = `${FIELD} h-8 rounded-lg px-2 text-[13px]`;

/** Campo inválido: borda e anel de perigo. */
export const FIELD_INVALID = 'border-red-500/70 focus-visible:border-red-500 focus-visible:ring-red-500/40';

/**
 * Colunas da tabela do time a partir de 1280 px: pessoa, cargo, sugeridas, reais, semanal, sprint, variação, fonte,
 * ações. Abaixo disso cada pessoa vira um cartão (a tabela não rola de lado em tela estreita).
 */
export const ROSTER_GRID_COLS =
  'xl:grid-cols-[minmax(0,1.6fr)_140px_104px_124px_72px_84px_72px_144px_200px]';
