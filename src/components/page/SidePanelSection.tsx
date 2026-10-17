import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ICON_STROKE, PAGE_CARD } from './styles';

export interface SidePanelSectionProps {
  title: string;
  description?: React.ReactNode;
  icon?: LucideIcon;
  /** Botão ou link pequeno no canto do título. */
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}

/** Bloco da coluna lateral: título, texto de apoio opcional e o conteúdo. */
export function SidePanelSection({ title, description, icon: Icon, action, children, className }: SidePanelSectionProps) {
  return (
    <section className={cn(PAGE_CARD, 'flex flex-col gap-3 p-[18px]', className)}>
      <header className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-0.5">
          <h2 className="flex items-center gap-2 text-base font-bold text-foreground">
            {Icon && <Icon className="h-4 w-4 shrink-0 text-muted-foreground" strokeWidth={ICON_STROKE} aria-hidden="true" />}
            {title}
          </h2>
          {description && <p className="text-xs text-muted-foreground">{description}</p>}
        </div>
        {action}
      </header>
      {children}
    </section>
  );
}

/** Conteúdo principal e coluna lateral. A lateral desce para baixo do conteúdo abaixo de 1280 px. */
export function PageColumns({ children, aside, asideWidth = 360, className }: { children: React.ReactNode; aside: React.ReactNode; asideWidth?: 320 | 360 | 400; className?: string }) {
  const cols = asideWidth === 320 ? 'xl:grid-cols-[minmax(0,1fr)_320px]' : asideWidth === 400 ? 'xl:grid-cols-[minmax(0,1fr)_400px]' : 'xl:grid-cols-[minmax(0,1fr)_360px]';
  return (
    <div className={cn('grid grid-cols-1 items-start gap-5', cols, className)}>
      <div className="flex min-w-0 flex-col gap-5">{children}</div>
      <aside className="flex min-w-0 flex-col gap-5">{aside}</aside>
    </div>
  );
}
