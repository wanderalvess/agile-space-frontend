'use client';

import React from 'react';
import { Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { FIELD } from '@/components/room-kit/tokens';
import { cn } from '@/lib/utils';

export const NEW_LAYOUT_VALUE = '__novo__';

export const FIELD_LABEL = 'text-xs font-semibold text-muted-foreground';

interface LayoutDetailsProps {
  name: string;
  onName: (value: string) => void;
  url: string;
  onUrl: (value: string) => void;
  onDelete: () => void;
  canDelete: boolean;
}

/** Detalhes do layout (popover da barra do Sandbox): nome, URL de origem e excluir. Ficam na conta da pessoa, no servidor. */
export function LayoutDetails({ name, onName, url, onUrl, onDelete, canDelete }: LayoutDetailsProps) {
  return (
    <div className="flex flex-col gap-3.5">
      <div className="flex flex-col gap-1.5">
        <label htmlFor="jolt-layout-nome" className={FIELD_LABEL}>Nome do layout</label>
        <input
          id="jolt-layout-nome"
          value={name}
          onChange={(e) => onName(e.target.value)}
          placeholder="Ex.: Pedido de venda — Protheus"
          className={cn(FIELD, 'h-11')}
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <label htmlFor="jolt-layout-url" className={FIELD_LABEL}>URL de origem</label>
        <input
          id="jolt-layout-url"
          value={url}
          onChange={(e) => onUrl(e.target.value)}
          placeholder="https://"
          className={cn(FIELD, 'h-11 font-code text-[13px]')}
        />
      </div>
      <div className="flex items-center gap-2.5">
        <span className="flex-1 text-xs leading-snug text-muted-foreground">Ficam salvos na sua conta, em qualquer navegador.</span>
        <Button
          type="button"
          variant="outline"
          onClick={onDelete}
          disabled={!canDelete}
          title={canDelete ? 'Excluir este layout salvo' : 'Escolha um layout salvo para excluir'}
          className="h-11 gap-2 rounded-[10px] px-3.5 font-semibold text-red-700 hover:text-red-700 dark:text-red-300 dark:hover:text-red-300"
        >
          <Trash2 className="h-4 w-4" strokeWidth={1.5} aria-hidden="true" />
          Excluir layout
        </Button>
      </div>
    </div>
  );
}
