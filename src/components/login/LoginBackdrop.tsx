import { cn } from '@/lib/utils';

/** Estrelas do fundo: posições fixas (sem aleatório, para não divergir entre servidor e navegador). */
const STARS = Array.from({ length: 22 }, (_, i) => ({
  x: (i * 37) % 97,
  y: (i * 61) % 93,
  big: i % 4 === 0,
  delay: (i * 310) % 4000,
}));

/**
 * Fundo do login: halo na cor primária e estrelas discretas. Usado na vitrine (telas largas) e atrás do formulário
 * no celular e no tablet. Só tokens semânticos; some no tema "leitura".
 */
export function LoginBackdrop({ className }: { className?: string }) {
  return (
    <div aria-hidden="true" className={cn('pointer-events-none absolute inset-0 [.theme-leitura_&]:hidden', className)}>
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_90%_70%_at_15%_95%,hsl(var(--primary)/0.10),transparent_65%)] dark:bg-[radial-gradient(ellipse_90%_70%_at_15%_95%,hsl(var(--primary)/0.16),transparent_65%)]" />
      {STARS.map((s, i) => (
        <span
          key={i}
          className={cn('absolute rounded-full bg-foreground/40 motion-safe:animate-twinkle', s.big ? 'h-0.5 w-0.5' : 'h-px w-px')}
          style={{ left: `${s.x}%`, top: `${s.y}%`, animationDelay: `${s.delay}ms` }}
        />
      ))}
    </div>
  );
}
