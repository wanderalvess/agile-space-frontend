import Link from 'next/link';
import { ArrowLeft, ChevronRight } from 'lucide-react';
import { IconTile } from '@/components/room-kit';
import { getModule, type ModuleKey } from '@/lib/modules-registry';
import { cn } from '@/lib/utils';
import { ICON_STROKE } from './styles';

export interface Crumb {
  label: string;
  /** Sem href é o item atual (o último). */
  href?: string;
}

export interface PageHeaderProps {
  title: string;
  subtitle?: React.ReactNode;
  /** Caminho até aqui. O último item é a página atual. */
  breadcrumb?: Crumb[];
  /** Módulo da página: mostra o ícone dele ao lado do título (o mesmo do menu e da Home). */
  module?: ModuleKey;
  /** Etiquetas ao lado do título (estado, contagem). Não repita o nome da squad aqui: ele está no cabeçalho. */
  badges?: React.ReactNode;
  /** Botões à direita. */
  actions?: React.ReactNode;
  className?: string;
}

/** Cabeçalho da página: migalha, título, subtítulo opcional e ações à direita. */
export function PageHeader({ title, subtitle, breadcrumb, module, badges, actions, className }: PageHeaderProps) {
  const crumbs = breadcrumb ?? [];
  return (
    <section className={cn('flex flex-wrap items-end justify-between gap-4', className)}>
      <div className="flex min-w-0 flex-col gap-2">
        {crumbs.length > 0 && (
          <nav aria-label="Caminho" className="flex flex-wrap items-center gap-1.5 text-[13px] text-muted-foreground">
            {crumbs.map((c, i) => {
              const last = i === crumbs.length - 1;
              return (
                <span key={`${c.label}-${i}`} className="inline-flex items-center gap-1.5">
                  {c.href && !last ? (
                    <Link
                      href={c.href}
                      className="inline-flex items-center gap-1.5 rounded-md transition-colors duration-fast hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring max-sm:min-h-11"
                    >
                      {i === 0 && crumbs.length > 1 && <ArrowLeft className="h-3.5 w-3.5" strokeWidth={ICON_STROKE} aria-hidden="true" />}
                      {c.label}
                    </Link>
                  ) : (
                    <span aria-current={last ? 'page' : undefined} className={last ? 'text-foreground' : undefined}>
                      {c.label}
                    </span>
                  )}
                  {!last && <ChevronRight className="h-3 w-3" strokeWidth={ICON_STROKE} aria-hidden="true" />}
                </span>
              );
            })}
          </nav>
        )}
        <div className="flex min-w-0 flex-wrap items-center gap-3">
          {module && <IconTile icon={getModule(module).icon} size="lg" />}
          <h1 className="text-[28px] font-bold leading-tight tracking-tight text-foreground sm:text-[32px]">{title}</h1>
          {badges}
        </div>
        {subtitle && <p className="max-w-3xl text-sm text-muted-foreground">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </section>
  );
}
