import React from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, ArrowUpRight, LucideIcon } from 'lucide-react';
import Link from 'next/link';
import { cn } from '@/lib/utils';

interface ManualHeroProps {
  title: string;
  subtitle: string;
  description: string;
  icon: LucideIcon;
  color?: string;
  badgeBg?: string;
  badgeBorder?: string;
  badgeText?: string;
  actionUrl?: string;
  actionLabel?: string;
}

export function ManualHero({
  title,
  subtitle,
  description,
  icon: Icon,
  color = 'text-primary [.theme-totvs:not(.dark)_&]:text-foreground',
  badgeBg = 'bg-primary/10',
  badgeBorder = 'border-primary/20',
  badgeText = 'text-foreground',
  actionUrl,
  actionLabel = 'Abrir Ferramenta',
}: ManualHeroProps) {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-border bg-card p-6 md:p-10 text-foreground shadow-sm">
      <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-8">
        <div className="space-y-4 max-w-4xl flex-1">
          {/* Caminho de volta e etiqueta do tópico */}
          <div className="flex flex-wrap items-center gap-3">
            <Link
              href="/manual"
              className="inline-flex min-h-6 items-center gap-1.5 rounded-md text-sm font-semibold text-muted-foreground hover:text-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring max-sm:min-h-11"
            >
              <ArrowLeft className="h-4 w-4" aria-hidden="true" />
              <span>Manual</span>
            </Link>
            <span className="text-muted-foreground" aria-hidden="true">/</span>
            <div className={cn("inline-flex items-center gap-2 px-3 py-1 rounded-full border text-xs font-semibold", badgeBg, badgeBorder, badgeText)}>
              <Icon className="h-3.5 w-3.5" aria-hidden="true" />
              <span>{subtitle}</span>
            </div>
          </div>

          <div className="flex items-center gap-4 pt-1">
            <div className="w-14 h-14 md:w-16 md:h-16 rounded-2xl bg-muted flex items-center justify-center shrink-0 border border-border">
              <Icon className={cn("h-7 w-7 md:h-8 md:w-8", color)} aria-hidden="true" />
            </div>
            <div>
              <h2 className="text-3xl md:text-4xl font-bold tracking-tight leading-tight text-foreground">
                {title}
              </h2>
              <p className="text-sm font-medium text-muted-foreground mt-1">
                Guia de operação e boas práticas
              </p>
            </div>
          </div>

          <p className="text-muted-foreground text-sm md:text-base leading-relaxed pt-2">
            {description}
          </p>
        </div>

        {/* Atalho para a ferramenta, quando ela abre direto */}
        {actionUrl && (
          <div className="shrink-0 w-full md:w-auto">
            <Button
              asChild
              size="lg"
              className="w-full md:w-auto h-12 px-8 rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 font-semibold text-sm group transition-colors"
            >
              <Link href={actionUrl} className="flex items-center justify-center gap-2">
                <span>{actionLabel}</span>
                <ArrowUpRight className="h-4 w-4 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" aria-hidden="true" />
              </Link>
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
