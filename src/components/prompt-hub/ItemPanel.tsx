'use client';

import Link from 'next/link';
import { X } from 'lucide-react';
import { Sheet, SheetClose, SheetContent, SheetDescription, SheetTitle } from '@/components/ui/sheet';
import { cn } from '@/lib/utils';
import type { PromptItem } from '@/app/prompt-hub/types';
import { ItemDetail } from './ItemDetail';

/** Painel lateral do catálogo: o mesmo conteúdo da página do item, sem sair da lista. */
export function ItemPanel({
  item,
  onClose,
  onPatch,
  onDeleted,
  onSelectTag,
}: {
  item: PromptItem | null;
  onClose: () => void;
  onPatch: (id: string, patch: Partial<PromptItem>) => void;
  onDeleted: (id: string) => void;
  onSelectTag?: (tag: string) => void;
}) {
  return (
    <Sheet
      open={!!item}
      onOpenChange={open => {
        if (!open) onClose();
      }}
    >
      <SheetContent
        side="right"
        className="flex w-full flex-col gap-0 overflow-y-auto border-border bg-background p-0 sm:max-w-[660px] [&>button]:hidden"
      >
        {item && (
          <div className="px-5 pb-12 pt-5 sm:px-6">
            <ItemDetail
              item={item}
              mode="panel"
              onPatch={patch => onPatch(item.id, patch)}
              onDeleted={() => onDeleted(item.id)}
              onSelectTag={onSelectTag}
              Title={SheetTitle}
              Description={SheetDescription}
              topBar={
                <>
                  <Link
                    href={`/prompt-hub/${encodeURIComponent(item.id)}`}
                    className="rounded-md text-[13px] font-bold text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring [.theme-totvs:not(.dark)_&]:text-foreground"
                  >
                    Abrir como página
                  </Link>
                  <SheetClose
                    aria-label="Fechar painel"
                    className={cn(
                      'ml-auto inline-flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition-colors duration-fast hover:bg-accent hover:text-accent-foreground',
                      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'
                    )}
                  >
                    <X className="h-4 w-4" strokeWidth={1.5} />
                  </SheetClose>
                </>
              }
            />
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
