'use client';

import React from 'react';
import Link from 'next/link';
import { ArrowLeft, Hourglass } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface ComingSoonProps {
  title: string;
  description: string;
  /** Ícone da ferramenta, exibido no selo. */
  icon?: React.ReactNode;
  /** Onde o usuário pode seguir enquanto o módulo não chega. */
  backHref?: string;
  backLabel?: string;
}

// Página-padrão de módulo que ainda não foi liberado. Mantém a rota viva (sem 404)
// e deixa claro que a ausência é decisão de produto, não erro.
export function ComingSoon({ title, description, icon, backHref = '/', backLabel = 'Voltar ao Hub' }: ComingSoonProps) {
  return (
    <main className="relative flex min-h-dvh w-full items-center justify-center overflow-hidden bg-[#fafafa] px-4 dark:bg-slate-950">
      <div className="pointer-events-none absolute inset-0 -z-10" aria-hidden>
        <div className="absolute left-[10%] top-[-10%] h-[60%] w-[60%] rounded-full bg-primary/5 blur-[140px]" />
        <div className="absolute bottom-[-10%] right-[5%] h-[50%] w-[50%] rounded-full bg-blue-500/5 blur-[130px]" />
      </div>

      <section className="w-full max-w-lg rounded-[2.5rem] border border-slate-200 bg-white/70 p-10 text-center shadow-lg backdrop-blur-xl dark:border-slate-800 dark:bg-slate-900/60">
        <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl border border-primary/20 bg-primary/10 text-primary [&_svg]:h-7 [&_svg]:w-7">
          {icon ?? <Hourglass />}
        </div>
        <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-[9px] font-black uppercase tracking-widest text-primary">
          <Hourglass className="h-3 w-3" /> Em breve
        </span>
        <h1 className="mt-4 text-3xl font-black uppercase tracking-tight text-slate-950 dark:text-slate-50">{title}</h1>
        <p className="mx-auto mt-3 max-w-sm text-sm font-medium leading-relaxed text-slate-500 dark:text-slate-400">{description}</p>
        <Button asChild variant="outline" className="mt-8 h-10 rounded-xl text-[10px] font-black uppercase tracking-widest">
          <Link href={backHref}>
            <ArrowLeft className="mr-2 h-3.5 w-3.5" /> {backLabel}
          </Link>
        </Button>
      </section>
    </main>
  );
}
