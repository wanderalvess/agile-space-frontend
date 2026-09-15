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
  color = 'text-primary',
  badgeBg = 'bg-primary/10',
  badgeBorder = 'border-primary/20',
  badgeText = 'text-primary',
  actionUrl,
  actionLabel = 'Abrir Ferramenta',
}: ManualHeroProps) {
  return (
    <div className="relative overflow-hidden rounded-[2.5rem] bg-gradient-to-br from-slate-900 via-slate-900 to-slate-950 p-8 md:p-12 text-white shadow-2xl border border-slate-800">
      {/* Ambient background decoration */}
      <div className="absolute top-0 right-0 -mt-12 -mr-12 w-96 h-96 bg-primary/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 right-1/4 -mb-12 w-64 h-64 bg-cyan-500/10 rounded-full blur-2xl pointer-events-none" />

      <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-8">
        <div className="space-y-4 max-w-3xl">
          {/* Tag & Navigation link */}
          <div className="flex flex-wrap items-center gap-3">
            <Link
              href="/manual"
              className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-400 hover:text-white transition-colors"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              <span>Manual</span>
            </Link>
            <span className="text-slate-600">/</span>
            <div className={cn("inline-flex items-center gap-2 px-3 py-1 rounded-full border text-[10px] font-black uppercase tracking-widest", badgeBg, badgeBorder, badgeText)}>
              <Icon className="h-3 w-3" />
              <span>{subtitle}</span>
            </div>
          </div>

          {/* Title with distinctive typography */}
          <div className="flex items-center gap-4 pt-1">
            <div className="w-14 h-14 md:w-16 md:h-16 rounded-2xl bg-white/10 backdrop-blur-md flex items-center justify-center shrink-0 border border-white/10 shadow-inner">
              <Icon className={cn("h-7 w-7 md:h-8 md:w-8", color)} />
            </div>
            <div>
              <h1 className="text-3xl md:text-5xl font-black uppercase tracking-tighter italic leading-none text-white">
                {title}
              </h1>
              <p className="text-xs md:text-sm font-bold text-slate-400 uppercase tracking-widest mt-1">
                Guia de Operação & Boas Práticas
              </p>
            </div>
          </div>

          <p className="text-slate-300 font-medium text-sm md:text-base leading-relaxed pt-2">
            {description}
          </p>
        </div>

        {/* Call to action if tool is usable directly */}
        {actionUrl && (
          <div className="shrink-0 w-full md:w-auto">
            <Button
              asChild
              size="lg"
              className="w-full md:w-auto h-14 px-8 rounded-2xl bg-white text-slate-900 hover:bg-slate-100 dark:bg-primary dark:text-white dark:hover:bg-primary/90 font-black uppercase tracking-widest text-xs shadow-xl group transition-all"
            >
              <Link href={actionUrl} className="flex items-center justify-center gap-2">
                <span>{actionLabel}</span>
                <ArrowUpRight className="h-4 w-4 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
              </Link>
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
