'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { Home, LifeBuoy, RotateCcw, TriangleAlert } from 'lucide-react';
import { Button } from '@/components/ui/button';

/**
 * Erro de renderização em qualquer tela do portal. Fica DENTRO do layout raiz (cabeçalho, tema e provedores
 * continuam de pé), então a pessoa pode tentar de novo ou sair da tela sem recarregar o site inteiro.
 * `retry` refaz a busca e o render da tela; `error.digest` casa com o log do servidor, por isso vai na tela.
 */
export default function ErrorPage({ error, retry }: { error: unknown; retry: () => void }) {
  const digest = error instanceof Error ? (error as Error & { digest?: string }).digest : undefined;

  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div role="alert" className="flex flex-1 items-center justify-center px-6 py-16">
      <div className="w-full max-w-xl text-center">
        <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl border border-border bg-muted/40">
          <TriangleAlert className="h-8 w-8 text-primary" aria-hidden="true" />
        </div>

        <p className="text-xs font-bold uppercase tracking-[0.3em] text-muted-foreground">Algo deu errado</p>

        <h1 className="mt-3 text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
          Não conseguimos abrir esta tela
        </h1>

        <p className="mx-auto mt-4 max-w-md text-sm leading-relaxed text-muted-foreground">
          Aconteceu um problema inesperado. O que você já salvou continua salvo. Tente de novo; se persistir, volte ao
          início e fale com o suporte.
        </p>

        <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Button onClick={() => retry()} className="w-full sm:w-auto">
            <RotateCcw className="mr-2 h-4 w-4" aria-hidden="true" />
            Tentar de novo
          </Button>

          <Button asChild variant="outline" className="w-full sm:w-auto">
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
          Falar com o suporte
        </Link>

        {digest ? (
          <p className="mt-4 text-[11px] text-muted-foreground/70">
            Código do erro para o suporte: <span className="font-mono">{digest}</span>
          </p>
        ) : null}
      </div>
    </div>
  );
}
