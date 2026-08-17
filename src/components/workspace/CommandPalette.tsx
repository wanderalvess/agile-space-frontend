'use client';

import React, { useEffect, useState } from 'react';
import {
  CommandDialog,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandSeparator,
} from '@/components/ui/command';
import { 
  LayoutGrid, 
  Plus, 
  History, 
  FileText, 
  StickyNote, 
  User, 
  Settings, 
  Terminal, 
  Zap,
  Home,
  MessageSquare,
  Search,
  CheckCircle2,
  Rocket
} from 'lucide-react';
import { useRouter } from 'next/navigation';

interface CommandPaletteProps {
  onNavigate: (tab: string) => void;
  onAddTask: () => void;
  onAddNote: () => void;
  onAddSnippet: () => void;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export function CommandPalette({ 
  onNavigate, 
  onAddTask, 
  onAddNote, 
  onAddSnippet,
  open: controlledOpen,
  onOpenChange: setControlledOpen
}: CommandPaletteProps) {
  const [internalOpen, setInternalOpen] = useState(false);
  
  const open = controlledOpen !== undefined ? controlledOpen : internalOpen;
  const setOpen = setControlledOpen !== undefined ? setControlledOpen : setInternalOpen;

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen(!open);
      }
    };


    document.addEventListener('keydown', down);
    return () => document.removeEventListener('keydown', down);
  }, []);

  const runCommand = (command: () => void) => {
    setOpen(false);
    command();
  };

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput placeholder="Digite um comando ou procure algo..." />
      <CommandList className="max-h-[400px]">
        <CommandEmpty>Nenhum resultado encontrado.</CommandEmpty>
        
        <CommandGroup heading="Navegação">
          <CommandItem onSelect={() => runCommand(() => onNavigate('home'))}>
            <Home className="mr-2 h-4 w-4 text-slate-400" />
            <span>Painel Principal (Home)</span>
            <kbd className="ml-auto pointer-events-none inline-flex h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground opacity-100">
              H
            </kbd>
          </CommandItem>
          <CommandItem onSelect={() => runCommand(() => onNavigate('kanban'))}>
            <LayoutGrid className="mr-2 h-4 w-4 text-slate-400" />
            <span>Quadro Kanban</span>
            <kbd className="ml-auto pointer-events-none inline-flex h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground opacity-100">
              K
            </kbd>
          </CommandItem>
          <CommandItem onSelect={() => runCommand(() => onNavigate('daily'))}>
            <Zap className="mr-2 h-4 w-4 text-indigo-500" />
            <span>Daily Helper</span>
          </CommandItem>
          <CommandItem onSelect={() => runCommand(() => onNavigate('snippets'))}>
            <Terminal className="mr-2 h-4 w-4 text-emerald-500" />
            <span>Biblioteca de Snippets</span>
          </CommandItem>
          <CommandItem onSelect={() => runCommand(() => onNavigate('notes'))}>
            <StickyNote className="mr-2 h-4 w-4 text-amber-500" />
            <span>Minhas Notas</span>
          </CommandItem>
          <CommandItem onSelect={() => runCommand(() => onNavigate('history'))}>
            <History className="mr-2 h-4 w-4 text-blue-500" />
            <span>Histórico de Sessões</span>
          </CommandItem>
        </CommandGroup>

        <CommandSeparator />

        <CommandGroup heading="Ações Rápidas">
          <CommandItem onSelect={() => runCommand(onAddTask)}>
            <Plus className="mr-2 h-4 w-4 text-slate-400" />
            <span>Nova Tarefa (Kanban)</span>
          </CommandItem>
          <CommandItem onSelect={() => runCommand(onAddNote)}>
            <Plus className="mr-2 h-4 w-4 text-slate-400" />
            <span>Criar Nova Nota</span>
          </CommandItem>
          <CommandItem onSelect={() => runCommand(onAddSnippet)}>
            <Plus className="mr-2 h-4 w-4 text-slate-400" />
            <span>Registrar Snippet</span>
          </CommandItem>
        </CommandGroup>

        <CommandSeparator />

        <CommandGroup heading="Espaço Ágil">
          <CommandItem onSelect={() => runCommand(() => onNavigate('prompts'))}>
            <MessageSquare className="mr-2 h-4 w-4 text-slate-400" />
            <span>Meus Prompts Hub</span>
          </CommandItem>
          <CommandItem onSelect={() => runCommand(() => onNavigate('profile'))}>
            <User className="mr-2 h-4 w-4 text-slate-400" />
            <span>Meu Perfil</span>
          </CommandItem>
        </CommandGroup>
      </CommandList>

      <div className="flex items-center justify-between border-t p-3 bg-slate-50/50">
        <div className="flex items-center gap-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
           <span className="flex items-center gap-1.5"><kbd className="bg-white border rounded px-1 py-0.5">↑↓</kbd> Navegar</span>
           <span className="flex items-center gap-1.5"><kbd className="bg-white border rounded px-1 py-0.5">Enter</kbd> Selecionar</span>
        </div>
        <div className="flex items-center gap-2">
           <Rocket className="h-3 w-3 text-indigo-400" />
           <span className="text-[9px] font-black uppercase text-indigo-400 tracking-tighter italic">Command Center v3.12</span>
        </div>
      </div>
    </CommandDialog>
  );
}
