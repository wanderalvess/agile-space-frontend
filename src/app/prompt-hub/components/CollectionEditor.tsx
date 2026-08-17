'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { Search, X, GripVertical, ArrowUp, ArrowDown, Check } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import type { PromptCollection, PromptItem } from '../types';
import { getTypeMeta } from '../constants';

interface CollectionEditorProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: Partial<PromptCollection>) => void;
  initialData?: PromptCollection | null;
  /** Itens que a pessoa pode incluir na trilha. */
  availableItems: PromptItem[];
}

const EMPTY: Partial<PromptCollection> = {
  name: '',
  description: '',
  itemIds: [],
  visibility: 'private'
};

export function CollectionEditor({
  isOpen,
  onClose,
  onSave,
  initialData,
  availableItems
}: CollectionEditorProps) {
  const [formData, setFormData] = useState<Partial<PromptCollection>>(EMPTY);
  const [search, setSearch] = useState('');

  useEffect(() => {
    setFormData(initialData ? { ...initialData } : EMPTY);
    setSearch('');
  }, [initialData, isOpen]);

  const selectedIds = formData.itemIds || [];

  const itemsById = useMemo(() => {
    const map = new Map<string, PromptItem>();
    availableItems.forEach(item => map.set(item.id, item));
    return map;
  }, [availableItems]);

  // A ordem da trilha é a ordem do array — por isso a lista escolhida é
  // renderizada a partir de itemIds, não do acervo.
  const selectedItems = selectedIds
    .map(id => itemsById.get(id))
    .filter((item): item is PromptItem => !!item);

  const searchResults = useMemo(() => {
    const term = search.trim().toLowerCase();
    return availableItems
      .filter(item => !selectedIds.includes(item.id))
      .filter(item => {
        if (!term) return true;
        return [item.title, item.description, ...(item.tags || [])]
          .filter(Boolean)
          .join(' ')
          .toLowerCase()
          .includes(term);
      })
      .slice(0, 8);
  }, [availableItems, selectedIds, search]);

  const addItem = (id: string) =>
    setFormData(prev => ({ ...prev, itemIds: [...(prev.itemIds || []), id] }));

  const removeItem = (id: string) =>
    setFormData(prev => ({ ...prev, itemIds: (prev.itemIds || []).filter(i => i !== id) }));

  const move = (index: number, direction: -1 | 1) => {
    const next = [...selectedIds];
    const target = index + direction;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    setFormData(prev => ({ ...prev, itemIds: next }));
  };

  const handleSubmit = () => {
    if (!formData.name?.trim()) {
      toast.error('Dê um nome à coleção');
      return;
    }
    if (!formData.itemIds?.length) {
      toast.error('Adicione pelo menos um item', {
        description: 'Uma coleção vazia não ajuda ninguém a encontrar nada.'
      });
      return;
    }
    onSave(formData);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="flex max-h-[92vh] flex-col gap-0 overflow-hidden p-0 sm:max-w-2xl">
        <DialogHeader className="border-b border-border px-6 py-4 text-left">
          <DialogTitle className="text-lg font-semibold">
            {initialData ? 'Editar coleção' : 'Nova coleção'}
          </DialogTitle>
          <DialogDescription className="text-sm">
            Agrupe itens numa trilha ordenada, como "Onboarding de dev" ou "Fechamento de sprint".
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 space-y-5 overflow-y-auto px-6 py-5">
          <div className="space-y-1.5">
            <Label htmlFor="collection-name" className="text-sm font-medium">
              Nome
            </Label>
            <Input
              id="collection-name"
              value={formData.name || ''}
              onChange={e => setFormData({ ...formData, name: e.target.value })}
              placeholder="Ex: Onboarding de pessoa desenvolvedora"
              className="h-10"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="collection-description" className="text-sm font-medium">
              Descrição
            </Label>
            <Textarea
              id="collection-description"
              value={formData.description || ''}
              onChange={e => setFormData({ ...formData, description: e.target.value })}
              placeholder="Para quem é esta trilha e em que ordem usar."
              className="min-h-[64px] resize-y text-sm"
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-sm font-medium">Quem pode ver</Label>
            <Select
              value={formData.visibility}
              onValueChange={(value: any) => setFormData({ ...formData, visibility: value })}
            >
              <SelectTrigger className="h-10 sm:w-64">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="private">Somente eu</SelectItem>
                <SelectItem value="public">Público</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              A coleção não muda a visibilidade dos itens: quem não pode ver um item continua sem
              vê-lo, mesmo abrindo a trilha.
            </p>
          </div>

          <section className="space-y-2">
            <Label className="text-sm font-medium">
              Itens da trilha
              <span className="ml-2 font-normal text-muted-foreground">
                {selectedItems.length} {selectedItems.length === 1 ? 'item' : 'itens'}
              </span>
            </Label>

            {selectedItems.length > 0 && (
              <ol className="space-y-1.5">
                {selectedItems.map((item, index) => {
                  const meta = getTypeMeta(item.type);
                  const Icon = meta.icon;
                  return (
                    <li
                      key={item.id}
                      className="flex items-center gap-2 rounded-lg border border-border px-3 py-2"
                    >
                      <GripVertical className="h-4 w-4 shrink-0 text-muted-foreground" />
                      <span className="w-5 shrink-0 text-xs text-muted-foreground">{index + 1}</span>
                      <Icon className={cn('h-4 w-4 shrink-0', meta.accent)} />
                      <span className="min-w-0 flex-1 truncate text-sm text-foreground">
                        {item.title?.trim() || 'Item sem título'}
                      </span>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        disabled={index === 0}
                        onClick={() => move(index, -1)}
                        title="Subir"
                      >
                        <ArrowUp className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        disabled={index === selectedItems.length - 1}
                        onClick={() => move(index, 1)}
                        title="Descer"
                      >
                        <ArrowDown className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-muted-foreground hover:text-destructive"
                        onClick={() => removeItem(item.id)}
                        title="Remover da coleção"
                      >
                        <X className="h-3.5 w-3.5" />
                      </Button>
                    </li>
                  );
                })}
              </ol>
            )}

            <div className="space-y-2 rounded-lg border border-border p-3">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="Buscar item para adicionar..."
                  className="h-9 pl-9 text-sm"
                />
              </div>

              {searchResults.length === 0 ? (
                <p className="px-1 py-2 text-xs text-muted-foreground">
                  {search ? 'Nenhum item encontrado.' : 'Todos os itens já estão na coleção.'}
                </p>
              ) : (
                <ul className="space-y-1">
                  {searchResults.map(item => {
                    const meta = getTypeMeta(item.type);
                    const Icon = meta.icon;
                    return (
                      <li key={item.id}>
                        <button
                          onClick={() => addItem(item.id)}
                          className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left transition-colors hover:bg-accent"
                        >
                          <Icon className={cn('h-4 w-4 shrink-0', meta.accent)} />
                          <span className="min-w-0 flex-1 truncate text-sm text-foreground">
                            {item.title?.trim() || 'Item sem título'}
                          </span>
                          <Check className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </section>
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-border px-6 py-4">
          <Button variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit}>{initialData ? 'Salvar alterações' : 'Criar coleção'}</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
