import { cn } from '@/lib/utils';

/**
 * Assinatura do portal: só texto, sem logo nem ícone (guia de marca TOTVS). Herda a cor do contexto;
 * o "V&D" usa a cor de destaque, e no TOTVS claro (ciano, sem contraste) cai para o texto padrão.
 */
export function BrandWordmark({ className, showTagline = true }: { className?: string; showTagline?: boolean }) {
  return (
    <span className={cn('flex flex-col leading-tight', className)}>
      <span className="text-[15px] font-bold">
        Portal Tech <span className="text-primary [.theme-totvs:not(.dark)_&]:text-foreground">V&amp;D</span>
      </span>
      {showTagline && <span className="text-[11px] font-normal text-muted-foreground">TOTVS · Varejo e Distribuição</span>}
    </span>
  );
}
