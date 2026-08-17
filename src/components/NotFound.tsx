'use client';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Home, Frown } from 'lucide-react';
import Link from 'next/link';

interface NotFoundProps {
    resourceName?: string;
}

export function NotFound({ resourceName = 'página' }: NotFoundProps) {
  return (
    <div className="flex flex-1 items-center justify-center bg-background p-4 w-full">
      <Card className="w-full max-w-md text-center">
        <CardHeader>
          <div className="mx-auto bg-destructive/10 p-3 rounded-full w-fit">
            <Frown className="h-12 w-12 text-destructive" />
          </div>
          <CardTitle className="mt-4">Oops! {resourceName.charAt(0).toUpperCase() + resourceName.slice(1)} não encontrada.</CardTitle>
          <CardDescription>
            A {resourceName} que você está procurando não existe ou foi movida. Verifique o link e tente novamente.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button asChild>
            <Link href="/">
              <Home className="mr-2 h-4 w-4" />
              Voltar para o Início
            </Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
