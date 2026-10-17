'use client';

import * as React from 'react';
import Link from 'next/link';
import { Lock } from 'lucide-react';
import { PRIMARY_BUTTON, FOCUS_RING } from '@/components/room-kit';
import { cn } from '@/lib/utils';

/** Tela de quem abriu o editor de um artigo que não pode editar (o servidor marca `canEdit: false`). */
export function NoEditPermission({ documentId }: { documentId: string }) {
  return (
    <div className="flex flex-1 items-center justify-center px-6 py-16">
      <div className="flex max-w-md flex-col items-center gap-3 text-center">
        <span aria-hidden="true" className="flex h-16 w-16 items-center justify-center rounded-[18px] bg-muted text-muted-foreground">
          <Lock className="h-7 w-7" strokeWidth={1.5} />
        </span>
        <h1 className="text-[22px] font-bold text-foreground">Só o autor ou a liderança editam este artigo</h1>
        <p className="text-sm text-muted-foreground">Você pode ler o artigo e pedir a edição ao autor.</p>
        <Link
          href={`/knowledge/kb?id=${documentId}`}
          className={cn('mt-1 inline-flex h-10 items-center justify-center rounded-[10px] px-4 text-sm font-semibold', PRIMARY_BUTTON, FOCUS_RING)}
        >
          Abrir para leitura
        </Link>
      </div>
    </div>
  );
}
