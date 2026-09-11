'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Compass, Home, LifeBuoy } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function NotFound() {
  const router = useRouter();

  return (
    <div className="flex flex-1 items-center justify-center px-6 py-16">
      <div className="w-full max-w-xl text-center">
        <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl border border-border bg-muted/40">
          <Compass className="h-8 w-8 text-primary" aria-hidden="true" />
        </div>

        <p className="text-xs font-bold uppercase tracking-[0.3em] text-muted-foreground">
          Erro 404
        </p>

        <h1 className="mt-3 text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
          Essa página saiu do board
        </h1>

        <p className="mx-auto mt-4 max-w-md text-sm leading-relaxed text-muted-foreground">
          O endereço que você acessou não existe, foi movido ou o recurso ainda não
          está disponível nesta versão do Espaço Ágil.
        </p>

        <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Button onClick={() => router.back()} variant="outline" className="w-full sm:w-auto">
            <ArrowLeft className="mr-2 h-4 w-4" aria-hidden="true" />
            Voltar
          </Button>

          <Button asChild className="w-full sm:w-auto">
            <Link href="/">
              <Home className="mr-2 h-4 w-4" aria-hidden="true" />
              Ir para o início
            </Link>
          </Button>
        </div>

        <Link
          href="/support"
          className="mt-8 inline-flex items-center gap-2 text-xs font-medium text-muted-foreground underline-offset-4 transition-colors hover:text-foreground hover:underline"
        >
          <LifeBuoy className="h-3.5 w-3.5" aria-hidden="true" />
          Acha que isso é um erro? Fale com o suporte
        </Link>
      </div>
    </div>
  );
}
