'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { LayoutGrid, StickyNote } from 'lucide-react';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList, CommandSeparator } from '@/components/ui/command';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { ModuleIcon } from '@/components/brand/ModuleIcon';
import { useUserContext } from '@/context/UserContext';
import { visibleModules } from '@/lib/modules-registry';
import { PALETTE_GROUPS, paletteItemsOf, paletteSearchValue, type PaletteAction, type PaletteItem } from './palette-items';
import type { KanbanCardData, StickyNote as StickyNoteData } from './types';
import type { WorkspaceLocation } from './workspace-nav';

interface CommandPaletteProps {
  onNavigate: (loc: WorkspaceLocation) => void;
  onAddTask: () => void;
  onAddNote: () => void;
  onAddSnippet: () => void;
  onAddLink: () => void;
  /** "Buscar tarefas e notas": leva à aba Notas com o foco na busca. */
  onSearchNotes: () => void;
  /** Tarefas e notas para a busca ao digitar. */
  tasks?: KanbanCardData[];
  notes?: StickyNoteData[];
  onOpenTask?: (card: KanbanCardData) => void;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

const MAX_HITS = 5;
const MIN_QUERY = 2;

function normalize(text: string): string {
  return text.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

/** Filtro da paleta: cada palavra digitada precisa estar no item, sem diferenciar acento nem caixa. */
export function paletteFilter(value: string, search: string, keywords?: string[]): number {
  const haystack = normalize(`${value} ${(keywords ?? []).join(' ')}`);
  const terms = normalize(search).split(/\s+/).filter(Boolean);
  return terms.every((t) => haystack.includes(t)) ? 1 : 0;
}

/** Tarefas (título e descrição) e notas (texto) que casam com a busca, no máximo 5 de cada. */
export function searchWorkspace(
  query: string,
  tasks: KanbanCardData[] = [],
  notes: StickyNoteData[] = [],
): { tasks: KanbanCardData[]; notes: StickyNoteData[] } {
  const q = normalize(query.trim());
  if (q.length < MIN_QUERY) return { tasks: [], notes: [] };
  return {
    tasks: tasks.filter((t) => normalize(`${t.title} ${t.description ?? ''}`).includes(q)).slice(0, MAX_HITS),
    notes: notes.filter((n) => normalize(n.content || '').includes(q)).slice(0, MAX_HITS),
  };
}

export function CommandPalette({
  onNavigate,
  onAddTask,
  onAddNote,
  onAddSnippet,
  onAddLink,
  onSearchNotes,
  tasks,
  notes,
  onOpenTask,
  open: controlledOpen,
  onOpenChange: setControlledOpen,
}: CommandPaletteProps) {
  const [internalOpen, setInternalOpen] = useState(false);
  const [query, setQuery] = useState('');
  const router = useRouter();
  const { userProfile } = useUserContext();
  const isAdmin = userProfile?.role?.toLowerCase() === 'admin';

  const open = controlledOpen !== undefined ? controlledOpen : internalOpen;
  const setOpen = setControlledOpen !== undefined ? setControlledOpen : setInternalOpen;
  const openRef = useRef(open);
  openRef.current = open;

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen(!openRef.current);
      }
    };
    document.addEventListener('keydown', down);
    return () => document.removeEventListener('keydown', down);
  }, [setOpen]);

  // Cada abertura começa com a busca limpa.
  useEffect(() => {
    if (!open) setQuery('');
  }, [open]);

  const hits = useMemo(() => searchWorkspace(query, tasks, notes), [query, tasks, notes]);

  const actions: Record<PaletteAction, () => void> = {
    'new-task': onAddTask,
    'new-note': onAddNote,
    'new-snippet': onAddSnippet,
    'new-link': onAddLink,
    'search-notes': onSearchNotes,
  };

  const runCommand = (command: () => void) => {
    setOpen(false);
    command();
  };

  const runItem = (item: PaletteItem) => {
    if (item.run.type === 'nav') onNavigate(item.run.loc);
    else if (item.run.type === 'action') actions[item.run.action]();
    else router.push(item.run.href);
  };

  const modules = useMemo(() => visibleModules(isAdmin), [isAdmin]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="overflow-hidden rounded-2xl border-border p-0 shadow-2xl sm:max-w-[560px]">
        <DialogTitle className="sr-only">Busca e comandos</DialogTitle>
        <DialogDescription className="sr-only">Digite para buscar uma tela, uma ação, um módulo, uma tarefa ou uma nota.</DialogDescription>
        <Command filter={paletteFilter} className="[&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:font-semibold [&_[cmdk-group-heading]]:text-muted-foreground [&_[cmdk-group]]:px-2 [&_[cmdk-input-wrapper]_svg]:h-5 [&_[cmdk-input-wrapper]_svg]:w-5 [&_[cmdk-input]]:h-12 [&_[cmdk-item]]:px-2 [&_[cmdk-item]]:py-2.5">
          <CommandInput value={query} onValueChange={setQuery} placeholder="Digite um comando ou procure algo..." />
          <CommandList className="max-h-[420px]">
            <CommandEmpty>Nenhum resultado encontrado.</CommandEmpty>

            {hits.tasks.length > 0 && (
              <CommandGroup heading="Tarefas">
                {hits.tasks.map((t) => (
                  <CommandItem key={t.id} value={`tarefa ${t.id} ${t.title} ${t.description ?? ''}`} onSelect={() => runCommand(() => { onNavigate({ aba: 'kanban' }); onOpenTask?.(t); })}>
                    <LayoutGrid className="mr-2 h-4 w-4 text-muted-foreground" strokeWidth={1.5} aria-hidden="true" />
                    <span className="truncate">{t.title}</span>
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
            {hits.notes.length > 0 && (
              <CommandGroup heading="Notas">
                {hits.notes.map((n) => (
                  <CommandItem key={n.id} value={`nota ${n.id} ${n.content}`} onSelect={() => runCommand(() => onNavigate({ aba: 'notas' }))}>
                    <StickyNote className="mr-2 h-4 w-4 text-muted-foreground" strokeWidth={1.5} aria-hidden="true" />
                    <span className="truncate">{(n.content || '').split('\n')[0] || 'Nota sem conteúdo'}</span>
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
            {(hits.tasks.length > 0 || hits.notes.length > 0) && <CommandSeparator />}

            {PALETTE_GROUPS.filter((g) => g !== 'Portal Tech V&D').map((group) => (
              <React.Fragment key={group}>
                <CommandGroup heading={group}>
                  {paletteItemsOf(group).map((item) => (
                    <CommandItem key={item.id} value={paletteSearchValue(item)} onSelect={() => runCommand(() => runItem(item))}>
                      <item.icon className="mr-2 h-4 w-4 text-muted-foreground" strokeWidth={1.5} aria-hidden="true" />
                      <span>{item.label}</span>
                    </CommandItem>
                  ))}
                </CommandGroup>
                <CommandSeparator />
              </React.Fragment>
            ))}

            <CommandGroup heading="Módulos do portal">
              {modules.map((m) => (
                <CommandItem key={m.key} value={`${m.label} ${(m.aliases ?? []).join(' ')}`} onSelect={() => runCommand(() => router.push(m.href))}>
                  <ModuleIcon module={m.key} className="mr-2 h-4 w-4 text-muted-foreground" />
                  <span>{m.label}</span>
                  {m.soon && <span className="ml-auto text-xs text-muted-foreground">Em breve</span>}
                </CommandItem>
              ))}
            </CommandGroup>

            <CommandSeparator />

            <CommandGroup heading="Portal Tech V&D">
              {paletteItemsOf('Portal Tech V&D').map((item) => (
                <CommandItem key={item.id} value={paletteSearchValue(item)} onSelect={() => runCommand(() => runItem(item))}>
                  <item.icon className="mr-2 h-4 w-4 text-muted-foreground" strokeWidth={1.5} aria-hidden="true" />
                  <span>{item.label}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>

          <div className="flex items-center justify-between border-t border-border bg-muted/30 px-3 py-2.5 text-xs text-muted-foreground">
            <div className="flex items-center gap-4">
              <span className="flex items-center gap-1.5">
                <kbd className="rounded border border-border bg-background px-1.5 py-0.5 font-code text-foreground">↑↓</kbd> Navegar
              </span>
              <span className="flex items-center gap-1.5">
                <kbd className="rounded border border-border bg-background px-1.5 py-0.5 font-code text-foreground">Enter</kbd> Selecionar
              </span>
            </div>
            <span className="font-semibold">Command Center</span>
          </div>
        </Command>
      </DialogContent>
    </Dialog>
  );
}
