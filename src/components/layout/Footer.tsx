'use client';

import React from 'react';
import { MessageSquareHeart, ChevronRight } from 'lucide-react';
import { BrandWordmark } from './BrandWordmark';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

/** @deprecated Sem uso nas telas: o rodapé do portal é o AppFooter (via PageShell). Remover quando as branches das salas fundirem. */
interface FooterProps {
  className?: string;
  onOpenFeedback?: () => void;
  subtitle?: string;
  badge?: React.ReactNode;
}

export function Footer({ className, onOpenFeedback, subtitle, badge }: FooterProps) {
  return (
    <footer className={cn(
      "mx-2 md:mx-8 lg:mx-10 mb-4 md:mb-8 p-4 md:py-5 md:px-8 bg-white/60 dark:bg-slate-900/60 backdrop-blur-xl rounded-2xl md:rounded-[2.5rem] border border-white/60 dark:border-slate-800/60 shadow-lg shadow-slate-200/50 dark:shadow-none flex flex-col md:flex-row items-center justify-between gap-3 md:gap-4 shrink-0 relative z-10 transition-all duration-500 hover:shadow-xl hover:border-primary/20 group overflow-hidden",
      className
    )}>
      {/* Background glow orbs */}
      <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 dark:bg-primary/10 rounded-full blur-2xl pointer-events-none group-hover:scale-125 transition-transform duration-700" />
      <div className="absolute bottom-0 left-0 w-24 h-24 bg-blue-500/5 dark:bg-blue-500/10 rounded-full blur-2xl pointer-events-none" />

      {/* Assinatura em texto */}
      <div className="relative z-10">
        <BrandWordmark />
        <p className="mt-1 text-[9px] font-bold leading-none text-slate-400 dark:text-slate-500">
          {subtitle ? (
            <span>{subtitle}</span>
          ) : (
            <>
              <a href="https://espacoagil.com.br" className="hover:text-primary transition-colors" aria-label="Acesse o site oficial do Portal Tech V&D">espacoagil.com.br</a>
              <span className="ml-1 text-[8px] opacity-70">© 2026</span>
            </>
          )}
        </p>
      </div>

      {/* Navigation links & optional badge */}
      <div className="flex flex-wrap items-center justify-center gap-2 md:gap-3 relative z-10">
        {badge && (
          <div className="flex items-center shrink-0">
            {badge}
          </div>
        )}

        <nav className="flex flex-wrap items-center justify-center gap-1.5 md:gap-2" aria-label="Links úteis do rodapé">
          {onOpenFeedback && (
            <Button
              variant="outline"
              onClick={onOpenFeedback}
              className="h-8 text-[9px] font-black uppercase tracking-widest text-primary hover:text-white bg-primary/10 hover:bg-primary px-3 rounded-xl transition-all duration-300 active:scale-95 flex items-center gap-1.5 border-primary/20"
              aria-label="Dar feedback sobre o sistema"
            >
              <MessageSquareHeart className="h-3.5 w-3.5" aria-hidden="true" /> Feedback
            </Button>
          )}
          
          <a 
            href="/changelog" 
            className="h-8 text-[9px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-100/50 dark:hover:bg-slate-800/50 px-3 rounded-xl transition-all duration-300 flex items-center border border-transparent hover:border-slate-200/60 dark:hover:border-slate-800/80" 
            aria-label="Ver histórico de versões e atualizações"
          >
            Versões
          </a>
          <a 
            href="/manual" 
            className="h-8 text-[9px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-100/50 dark:hover:bg-slate-800/50 px-3 rounded-xl transition-all duration-300 flex items-center border border-transparent hover:border-slate-200/60 dark:hover:border-slate-800/80" 
            aria-label="Ver manual do usuário"
          >
            Manual
          </a>
          <a 
            href="/governance" 
            className="h-8 text-[9px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-100/50 dark:hover:bg-slate-800/50 px-3 rounded-xl transition-all duration-300 flex items-center border border-transparent hover:border-slate-200/60 dark:hover:border-slate-800/80" 
            aria-label="Ver políticas de governança"
          >
            Governança
          </a>
          <a 
            href="/support" 
            className="h-8 text-[9px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-100/50 dark:hover:bg-slate-800/50 px-3 rounded-xl transition-all duration-300 flex items-center border border-transparent hover:border-slate-200/60 dark:hover:border-slate-800/80" 
            aria-label="Acessar suporte técnico"
          >
            Suporte
          </a>
        </nav>
      </div>
    </footer>
  );
}
