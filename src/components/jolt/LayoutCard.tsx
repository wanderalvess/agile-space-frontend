'use client';

import React from 'react';
import { Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { SelectField } from '@/components/room-kit';
import { FIELD } from '@/components/room-kit/tokens';
import { cn } from '@/lib/utils';
import type { SavedLayout } from '@/lib/jolt-storage';

export const NEW_LAYOUT_VALUE = '__novo__';

export const FIELD_LABEL = 'text-xs font-semibold text-muted-foreground';

interface LayoutCardProps {
  layouts: SavedLayout[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  name: string;
  onName: (value: string) => void;
  url: string;
  onUrl: (value: string) => void;
  onDelete: () => void;
}

/** Cartão "Layout": escolher um layout salvo, dar nome e URL de origem, excluir. Fica neste navegador, por usuário. */
export function LayoutCard({ layouts, selectedId, onSelect, name, onName, url, onUrl, onDelete }: LayoutCardProps) {
  const sorted = [...layouts].sort((a, b) => (a.name || '').localeCompare(b.name || ''));
  const options = [
    { value: NEW_LAYOUT_VALUE, label: 'Novo layout em branco' },
    ...sorted.map((l) => ({ value: l.id, label: l.name || 'Layout sem nome' })),
  ];
  return (
    <section aria-label="Layout" className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-4 shadow-sm">
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="text-[15px] font-bold text-foreground">Layout</h2>
        <span className="text-xs text-muted-foreground">Ficam salvos neste navegador, ligados ao seu usuário.</span>
      </div>
      <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="jolt-layout-salvo" className={FIELD_LABEL}>Layout salvo</label>
          <SelectField
            id="jolt-layout-salvo"
            aria-label="Layout salvo"
            value={selectedId ?? NEW_LAYOUT_VALUE}
            onChange={(v) => onSelect(v === NEW_LAYOUT_VALUE ? null : v)}
            options={options}
            className="h-10"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="jolt-layout-nome" className={FIELD_LABEL}>Nome do layout</label>
          <input
            id="jolt-layout-nome"
            value={name}
            onChange={(e) => onName(e.target.value)}
            placeholder="Ex.: Pedido de venda — Protheus"
            className={cn(FIELD, 'h-10')}
          />
        </div>
      </div>
      <div className="flex items-end gap-2.5">
        <div className="flex min-w-0 flex-1 flex-col gap-1.5">
          <label htmlFor="jolt-layout-url" className={FIELD_LABEL}>URL de origem</label>
          <input
            id="jolt-layout-url"
            value={url}
            onChange={(e) => onUrl(e.target.value)}
            placeholder="https://"
            className={cn(FIELD, 'h-10 font-code text-[13px]')}
          />
        </div>
        <Button
          type="button"
          variant="outline"
          onClick={onDelete}
          disabled={!selectedId}
          title={selectedId ? 'Excluir este layout salvo' : 'Escolha um layout salvo para excluir'}
          className="h-10 gap-2 rounded-[10px] px-3.5 font-semibold text-red-700 hover:text-red-700 dark:text-red-300 dark:hover:text-red-300"
        >
          <Trash2 className="h-4 w-4" strokeWidth={1.5} aria-hidden="true" />
          Excluir
        </Button>
      </div>
    </section>
  );
}
