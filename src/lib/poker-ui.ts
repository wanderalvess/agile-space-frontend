/**
 * Estilo unificado dos modais do Scrum Poker.
 *
 * Antes cada <Dialog>/<AlertDialog> repetia (ou divergia em) classes de vidro,
 * raio e sombra soltas — uns ficavam `rounded-[2.5rem]` glassmorphism, o de
 * importação em lote caía no `DialogContent` liso do shadcn (`bg-background
 * sm:rounded-lg`). Estas constantes centralizam a linguagem visual para que os
 * modais do poker fiquem consistentes. Aplicam-se via `cn(...)`, então as
 * classes daqui sobrescrevem as do base (twMerge, última vence).
 */

/** Casca de vidro do modal: raio grande, blur, borda e sombra profunda. */
export const pokerDialogContent =
  'border border-slate-200/70 dark:border-border/70 bg-white/90 dark:bg-card/95 ' +
  'backdrop-blur-2xl shadow-[0_24px_64px_-16px_rgba(0,0,0,0.3)] sm:rounded-[1.75rem]';

/** Cabeçalho: respiro maior e separador sutil. Use dentro de <DialogHeader>. */
export const pokerDialogHeaderCls =
  'gap-1.5 text-left';

/** Título padrão: preto, uppercase, tracking apertado, com ícone à esquerda. */
export const pokerDialogTitleCls =
  'text-xl font-black uppercase tracking-tight flex items-center gap-2.5';

/** Descrição padrão: menor e em uppercase discreto. */
export const pokerDialogDescCls =
  'text-[11px] font-medium text-muted-foreground leading-relaxed';

/**
 * Rodapé "faixa": barra colada nas bordas do modal, fundo levemente destacado
 * e borda superior. Assume um <DialogContent> com padding `p-6` (padrão).
 */
export const pokerDialogFooterCls =
  'gap-2 sm:gap-0 sm:justify-between items-center bg-slate-50/70 dark:bg-slate-950/30 ' +
  'p-4 -mx-6 -mb-6 border-t border-slate-100 dark:border-border/60 mt-2';
