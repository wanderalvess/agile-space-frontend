import { cn } from '@/lib/utils';

/** Esqueleto do índice enquanto a página carrega: a mesma grade de cartões, sem texto inventado. */
export function ManualIndexSkeleton({ className }: { className?: string }) {
  return (
    <div role="status" aria-busy="true" aria-label="Carregando o manual" className={cn('grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4', className)}>
      {Array.from({ length: 8 }, (_, i) => (
        <div key={i} className="h-[156px] rounded-2xl border border-border bg-card motion-safe:animate-pulse" />
      ))}
    </div>
  );
}
