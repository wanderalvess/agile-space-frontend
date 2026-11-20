
'use client';

import { BrandWordmark } from './BrandWordmark';
import { Loader2 } from 'lucide-react';

interface LoadingScreenProps {
  message?: string;
  submessage?: string;
}

export function LoadingScreen({ 
  message = "Carregando...", 
  submessage = "Preparando seu espaço de trabalho" 
}: LoadingScreenProps) {
  return (
    <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-background">
      {/* ELITE MESH BACKGROUND */}
      <div className="absolute inset-0 -z-10 overflow-hidden pointer-events-none" aria-hidden="true">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-primary/10 rounded-full blur-[120px] motion-safe:animate-pulse" />
        <div className="absolute top-1/4 left-1/4 w-[300px] h-[300px] bg-blue-500/5 rounded-full blur-[80px] animate-pulse" style={{ animationDelay: '1s' }} />
        <div className="absolute bottom-1/4 right-1/4 w-[320px] h-[320px] bg-amber-500/5 rounded-full blur-[90px] animate-pulse" style={{ animationDelay: '2s' }} />
      </div>

      <div className="relative flex flex-col items-center gap-10">
        {/* Logo with pulsing effect */}
        <div className="relative group">
          <div className="absolute inset-0 bg-primary/30 blur-3xl rounded-full scale-150 animate-pulse transition-all duration-1000" />
          <div className="relative z-10 p-6 bg-card rounded-2xl border border-border shadow-sm">
            <BrandWordmark className='items-center text-center [&>span:first-child]:text-3xl' />
          </div>
        </div>

        {/* Text and Spinner */}
        <div className="flex flex-col items-center gap-4 text-center px-4 relative z-10">
          <div className="flex items-center gap-4 py-2 px-6 bg-card border border-border rounded-xl shadow-sm">
            <div className="relative">
              <Loader2 className="h-6 w-6 animate-spin text-primary relative z-10" />
              <div className="absolute inset-0 bg-primary/20 blur-md rounded-full animate-pulse" />
            </div>
            <h2 className="text-2xl font-bold font-headline tracking-tight text-foreground">
              {message}
            </h2>
          </div>
          
          <div className="flex flex-col items-center gap-2">
            <p className="text-muted-foreground font-medium motion-safe:animate-pulse text-xs">
              {submessage}
            </p>
            
            {/* Elite Progress Indicator */}
            <div className="w-56 h-1.5 bg-muted rounded-full overflow-hidden relative mt-2">
               <div className="h-full bg-primary rounded-full animate-[loading-bar_2s_infinite_ease-in-out]" />
            </div>
          </div>
        </div>
      </div>
      
      <style jsx global>{`
        @keyframes loading-bar {
          0% { width: 0%; transform: translateX(-100%); }
          50% { width: 70%; transform: translateX(20%); }
          100% { width: 0%; transform: translateX(200%); }
        }
      `}</style>
    </div>
  );
}
